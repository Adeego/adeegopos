const { v4: uuidv4 } = require('uuid');
const {
  applyStockDeltaToProduct,
  buildActorReference,
  getSaleMetricSign,
  recordStockMovement,
  toNumber,
} = require('./postingService');
const { findAll } = require('./pouchQueryService');

function roundQuantity(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function previousDayWindow(now = new Date()) {
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { auditDate: localDateKey(start), startAt: start.toISOString(), endAt: end.toISOString() };
}

function dailyAuditId(storeNo, auditDate) {
  return `${storeNo}:stock-audit:${auditDate}`;
}

function isNotFound(error) {
  return error?.status === 404 || error?.name === 'not_found';
}

function sameStore(actor, storeNo) {
  return actor && String(actor.storeNo) === String(storeNo);
}

async function putWithRevision(db, doc) {
  const result = await db.put(doc);
  return { ...doc, _rev: result.rev || doc._rev };
}

async function findSalesForWindow(db, storeNo, window) {
  const result = await findAll(db, { selector: { type: 'sale', state: 'Active', storeNo } });
  const start = new Date(window.startAt);
  const end = new Date(window.endAt);
  return (result.docs || []).filter((sale) => {
    const createdAt = new Date(sale.createdAt);
    return !Number.isNaN(createdAt.getTime())
      && createdAt >= start
      && createdAt <= end
      && getSaleMetricSign(sale) !== 0;
  });
}

async function buildDailyItems(db, storeNo, window) {
  const sales = await findSalesForWindow(db, storeNo, window);
  const totals = new Map();
  for (const sale of sales) {
    const sign = getSaleMetricSign(sale);
    for (const line of sale.items || []) {
      if (!line.productId) continue;
      if (sign < 0 && (line.condition || 'sellable') !== 'sellable') continue;
      const baseUnits = Math.abs(toNumber(line.quantity)) * (Math.abs(toNumber(line.conversionFactor)) || 1);
      totals.set(line.productId, roundQuantity((totals.get(line.productId) || 0) + (baseUnits * sign)));
    }
  }

  const items = [];
  for (const [productId, netSoldQuantity] of totals.entries()) {
    if (netSoldQuantity <= 0) continue;
    try {
      const product = await db.get(productId);
      if (product.type !== 'product' || product.state !== 'Active' || String(product.storeNo) !== String(storeNo)) continue;
      items.push({
        productId,
        productName: product.name || 'Unknown product',
        netSoldQuantity,
        systemStock: roundQuantity(product.stock),
        physicalCount: null,
        variance: null,
        adjustmentDelta: null,
        buyPrice: toNumber(product.buyPrice),
        shrinkageValue: null,
        reason: '',
        resolution: '',
        stockMovementId: null,
      });
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }
  return items.sort((a, b) => a.productName.localeCompare(b.productName));
}

function calculateSummary(items = []) {
  const discrepancies = items.filter((item) => toNumber(item.variance) !== 0);
  const totalProducts = items.length;
  const discrepancyCount = discrepancies.length;
  return {
    totalProducts,
    discrepancyCount,
    totalShrinkageUnits: roundQuantity(discrepancies.reduce((sum, item) => sum + toNumber(item.variance), 0)),
    totalShrinkageValue: roundQuantity(discrepancies.reduce((sum, item) => sum + toNumber(item.shrinkageValue), 0)),
    shrinkageRate: totalProducts ? roundQuantity((discrepancyCount / totalProducts) * 100) : 0,
    accuracyRate: totalProducts ? roundQuantity(((totalProducts - discrepancyCount) / totalProducts) * 100) : 100,
  };
}

async function getDailyAudit(db, storeNo, now = new Date()) {
  try {
    const window = previousDayWindow(now);
    return { success: true, audit: await db.get(dailyAuditId(storeNo, window.auditDate)) };
  } catch (error) {
    if (isNotFound(error)) return { success: true, audit: null };
    return { success: false, error: error.message };
  }
}

async function createAudit(db, storeNo, actor, now = new Date()) {
  try {
    if (!storeNo) return { success: false, error: 'Store number is required' };
    if (!sameStore(actor, storeNo)) return { success: false, error: 'You cannot create an audit for another store' };
    const window = previousDayWindow(now);
    const id = dailyAuditId(storeNo, window.auditDate);
    try {
      return { success: true, audit: await db.get(id), resumed: true };
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }

    const createdAt = new Date(now).toISOString();
    const audit = {
      _id: id,
      type: 'stock-audit',
      version: 2,
      storeNo,
      auditDate: window.auditDate,
      salesWindow: { startAt: window.startAt, endAt: window.endAt },
      status: 'in_progress',
      items: await buildDailyItems(db, storeNo, window),
      summary: null,
      createdBy: buildActorReference(actor),
      submittedBy: null,
      approvedBy: null,
      reviewHistory: [],
      printedAt: null,
      printCount: 0,
      createdAt,
      updatedAt: createdAt,
      submittedAt: null,
      completedAt: null,
    };
    await db.put(audit);
    return { success: true, audit, resumed: false };
  } catch (error) {
    if (error?.status === 409) return getDailyAudit(db, storeNo, now);
    console.error('[StockAudit] Error creating daily audit:', error);
    return { success: false, error: error.message };
  }
}

async function submitAudit(db, auditId, payload, actor) {
  try {
    const audit = await db.get(auditId);
    if (audit.type !== 'stock-audit') return { success: false, error: 'Selected record is not a stock audit' };
    if (!sameStore(actor, audit.storeNo)) return { success: false, error: 'You cannot submit an audit for another store' };
    if (audit.status === 'completed') return { success: false, error: 'Audit is already completed' };
    if (audit.status === 'pending_approval') return { success: false, error: 'Audit is already awaiting manager approval' };

    const discrepancies = Array.isArray(payload) ? payload : (payload?.discrepancies || []);
    const knownIds = new Set((audit.items || []).map((item) => item.productId));
    const entries = new Map();
    for (const entry of discrepancies) {
      if (!knownIds.has(entry.productId)) return { success: false, error: 'A discrepancy references a product outside this audit' };
      if (entries.has(entry.productId)) return { success: false, error: 'Each product may only be entered once' };
      const physicalCount = Number(entry.physicalCount);
      if (!Number.isFinite(physicalCount) || physicalCount < 0) return { success: false, error: 'Physical counts must be valid non-negative numbers' };
      entries.set(entry.productId, {
        physicalCount: roundQuantity(physicalCount),
        reason: String(entry.reason || '').trim(),
        resolution: String(entry.resolution || '').trim(),
      });
    }

    const liveProducts = new Map();
    for (const item of audit.items || []) {
      const product = await db.get(item.productId);
      if (product.type !== 'product' || product.state !== 'Active' || String(product.storeNo) !== String(audit.storeNo)) {
        throw new Error(`${item.productName} is no longer an active product in this store`);
      }
      liveProducts.set(item.productId, product);
    }

    const items = audit.items.map((item) => {
      const entry = entries.get(item.productId);
      const submissionStock = roundQuantity(liveProducts.get(item.productId).stock);
      const physicalCount = entry ? entry.physicalCount : submissionStock;
      const variance = roundQuantity(submissionStock - physicalCount);
      if (variance !== 0 && (!entry.reason || !entry.resolution)) throw new Error(`${item.productName}: reason and resolution are required`);
      return {
        ...item,
        submissionStock,
        physicalCount,
        variance,
        adjustmentDelta: roundQuantity(physicalCount - submissionStock),
        shrinkageValue: roundQuantity(variance * toNumber(item.buyPrice)),
        reason: variance === 0 ? '' : entry.reason,
        resolution: variance === 0 ? '' : entry.resolution,
        stockMovementId: null,
      };
    });
    const now = new Date().toISOString();
    const updated = {
      ...audit,
      items,
      summary: calculateSummary(items),
      status: 'pending_approval',
      submittedBy: buildActorReference(actor),
      submittedAt: now,
      updatedAt: now,
      approvalLock: null,
    };
    await db.put(updated);
    return { success: true, audit: updated };
  } catch (error) {
    console.error('[StockAudit] Error submitting audit:', error);
    return { success: false, error: error.message };
  }
}

async function rollbackProducts(db, appliedEntries) {
  for (const applied of [...appliedEntries].reverse()) {
    try {
      const current = await db.get(applied.original._id);
      if (current._rev === applied.writtenRev) {
        await db.put({ ...applied.original, _rev: current._rev });
      } else {
        const reversed = applyStockDeltaToProduct(current, -applied.delta).updatedProduct;
        await db.put(reversed);
      }
    } catch (error) {
      console.error(`[StockAudit] Failed to roll back ${applied.original._id}:`, error.message);
    }
  }
}

async function approveAudit(db, auditId, approver) {
  let lockedAudit = null;
  const appliedEntries = [];
  const movements = [];
  try {
    const audit = await db.get(auditId);
    if (audit.type !== 'stock-audit') return { success: false, error: 'Selected record is not a stock audit' };
    if (!sameStore(approver, audit.storeNo)) return { success: false, error: 'You cannot approve an audit for another store' };
    if (audit.status === 'completed') return { success: true, audit, alreadyCompleted: true };
    if (audit.status !== 'pending_approval') return { success: false, error: 'Only submitted audits can be approved' };
    if (audit.submittedBy?.id && audit.submittedBy.id === (approver?._id || approver?.id)) return { success: false, error: 'A different Inventory Manager must approve this audit' };
    if (audit.approvalLock?.startedAt && Date.now() - new Date(audit.approvalLock.startedAt).getTime() < 300000) return { success: false, error: 'This audit is currently being approved by another manager' };

    const prepared = [];
    for (const item of audit.items || []) {
      const product = await db.get(item.productId);
      if (product.type !== 'product' || product.state !== 'Active' || String(product.storeNo) !== String(audit.storeNo)) throw new Error(`${item.productName} is no longer an active product in this store`);
      const hasSubmissionSnapshot = item.submissionStock !== null && item.submissionStock !== undefined;
      // Audits submitted before count-time snapshots were introduced used the
      // morning stock as their baseline. Rebase those pending records once so
      // legitimate sales made during the day are not deducted a second time.
      const delta = hasSubmissionSnapshot
        ? roundQuantity(item.adjustmentDelta)
        : roundQuantity(toNumber(item.physicalCount) - toNumber(product.stock));
      const updatedProduct = applyStockDeltaToProduct(product, delta).updatedProduct;
      const needsProductWrite = delta !== 0
        || JSON.stringify(updatedProduct.batches || []) !== JSON.stringify(product.batches || []);
      prepared.push({ item, product, updatedProduct, delta, needsProductWrite });
    }

    lockedAudit = await putWithRevision(db, {
      ...audit,
      approvalLock: { token: uuidv4(), approver: buildActorReference(approver), startedAt: new Date().toISOString() },
      updatedAt: new Date().toISOString(),
    });
    for (const entry of prepared) {
      if (!entry.needsProductWrite) continue;
      const result = await db.put(entry.updatedProduct);
      appliedEntries.push({ original: entry.product, delta: entry.delta, writtenRev: result.rev });
    }
    for (const entry of prepared) {
      if (!entry.delta) continue;
      movements.push(await recordStockMovement(db, {
        storeNo: audit.storeNo,
        productId: entry.item.productId,
        quantityDelta: entry.delta,
        lineQuantity: Math.abs(entry.delta),
        sourceDocType: 'stock-audit',
        sourceDocId: audit._id,
        metadata: { auditDate: audit.auditDate, reason: entry.item.reason, resolution: entry.item.resolution },
      }));
    }

    const movementByProduct = new Map(movements.map((movement) => [movement.productId, movement._id]));
    const approvalByProduct = new Map(prepared.map((entry) => [entry.item.productId, entry]));
    const now = new Date().toISOString();
    const actor = buildActorReference(approver);
    const completedItems = audit.items.map((item) => {
      const approval = approvalByProduct.get(item.productId);
      const submissionStock = item.submissionStock ?? approval?.product?.stock ?? item.systemStock;
      const adjustmentDelta = approval?.delta ?? item.adjustmentDelta ?? 0;
      const variance = roundQuantity(-adjustmentDelta);
      return {
        ...item,
        submissionStock: roundQuantity(submissionStock),
        variance,
        adjustmentDelta,
        shrinkageValue: roundQuantity(variance * toNumber(item.buyPrice)),
        stockMovementId: movementByProduct.get(item.productId) || null,
      };
    });
    const completed = {
      ...lockedAudit,
      status: 'completed',
      approvalLock: null,
      approvedBy: actor,
      approvedAt: now,
      completedAt: now,
      updatedAt: now,
      reviewHistory: [...(audit.reviewHistory || []), { action: 'approved', actor, at: now }],
      items: completedItems,
      summary: calculateSummary(completedItems),
    };
    await db.put(completed);
    return { success: true, audit: completed };
  } catch (error) {
    await rollbackProducts(db, appliedEntries);
    for (const movement of movements) {
      try {
        const current = await db.get(movement._id);
        await db.put({ ...current, state: 'Inactive', rollbackReason: 'Stock audit approval failed', updatedAt: new Date().toISOString() });
      } catch (movementError) {
        console.error(`[StockAudit] Failed to deactivate movement ${movement._id}:`, movementError.message);
      }
    }
    if (lockedAudit) {
      try {
        const current = await db.get(lockedAudit._id);
        if (current.status === 'pending_approval') await db.put({ ...current, approvalLock: null, updatedAt: new Date().toISOString() });
      } catch (unlockError) {
        console.error('[StockAudit] Failed to clear approval lock:', unlockError.message);
      }
    }
    console.error('[StockAudit] Error approving audit:', error);
    return { success: false, error: `Audit was not adjusted: ${error.message}` };
  }
}

async function rejectAudit(db, auditId, reason, reviewer) {
  try {
    const audit = await db.get(auditId);
    if (audit.type !== 'stock-audit') return { success: false, error: 'Selected record is not a stock audit' };
    if (!sameStore(reviewer, audit.storeNo)) return { success: false, error: 'You cannot reject an audit for another store' };
    if (audit.status !== 'pending_approval') return { success: false, error: 'Only submitted audits can be rejected' };
    if (audit.submittedBy?.id && audit.submittedBy.id === (reviewer?._id || reviewer?.id)) return { success: false, error: 'A different Inventory Manager must review this audit' };
    const rejectionReason = String(reason || '').trim();
    if (!rejectionReason) return { success: false, error: 'A rejection reason is required' };
    const now = new Date().toISOString();
    const actor = buildActorReference(reviewer);
    const updated = {
      ...audit,
      status: 'in_progress',
      submittedBy: null,
      submittedAt: null,
      approvalLock: null,
      updatedAt: now,
      reviewHistory: [...(audit.reviewHistory || []), { action: 'rejected', actor, reason: rejectionReason, at: now }],
    };
    await db.put(updated);
    return { success: true, audit: updated };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function markAuditPrinted(db, auditId) {
  try {
    const audit = await db.get(auditId);
    const now = new Date().toISOString();
    const updated = { ...audit, printedAt: now, printCount: toNumber(audit.printCount) + 1, updatedAt: now };
    await db.put(updated);
    return { success: true, audit: updated };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getAudit(db, auditId) {
  try {
    return { success: true, audit: await db.get(auditId) };
  } catch (error) {
    return { success: false, error: isNotFound(error) ? 'Audit not found' : error.message };
  }
}

async function getAuditHistory(db, storeNo, limit = 50) {
  try {
    const result = await findAll(db, { selector: { type: 'stock-audit', storeNo, status: 'completed' } });
    const audits = (result.docs || []).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)).slice(0, limit);
    return { success: true, audits: audits.map((audit) => ({
      _id: audit._id,
      auditDate: audit.auditDate,
      status: audit.status,
      summary: audit.summary,
      createdBy: audit.createdBy,
      submittedBy: audit.submittedBy,
      approvedBy: audit.approvedBy,
      createdAt: audit.createdAt,
      completedAt: audit.completedAt,
    })) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getOpenAudits(db, storeNo) {
  try {
    const result = await findAll(db, { selector: { type: 'stock-audit', storeNo } });
    const audits = (result.docs || [])
      .filter((audit) => ['in_progress', 'pending_approval'].includes(audit.status))
      .sort((a, b) => String(a.auditDate || b.createdAt).localeCompare(String(b.auditDate || a.createdAt)));
    return { success: true, audits };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getAuditSummary(db, storeNo) {
  const history = await getAuditHistory(db, storeNo, 9999);
  if (!history.success) return history;
  const audits = history.audits;
  if (!audits.length) return { success: true, summary: { totalAudits: 0, latestShrinkageValue: 0, latestShrinkageRate: 0, latestAccuracyRate: 100, trend: 'stable', trendDelta: 0 } };
  const latest = audits[0].summary || {};
  const previous = audits[1]?.summary;
  const trendDelta = previous ? roundQuantity(toNumber(latest.shrinkageRate) - toNumber(previous.shrinkageRate)) : 0;
  return { success: true, summary: {
    totalAudits: audits.length,
    latestShrinkageValue: toNumber(latest.totalShrinkageValue),
    latestShrinkageRate: toNumber(latest.shrinkageRate),
    latestAccuracyRate: latest.accuracyRate ?? 100,
    trend: trendDelta > 0.5 ? 'worsening' : trendDelta < -0.5 ? 'improving' : 'stable',
    trendDelta,
  } };
}

module.exports = {
  approveAudit,
  buildDailyItems,
  calculateSummary,
  createAudit,
  dailyAuditId,
  getAudit,
  getAuditHistory,
  getAuditSummary,
  getDailyAudit,
  getOpenAudits,
  markAuditPrinted,
  previousDayWindow,
  rejectAudit,
  submitAudit,
};
