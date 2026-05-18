const { v4: uuidv4 } = require('uuid');

// ============================================================
// Create a new stock audit
// ============================================================
async function createAudit(db, storeNo) {
  try {
    // Fetch all active products
    const result = await db.find({
      selector: {
        type: 'product',
        state: 'Active',
        storeNo: storeNo,
      },
      limit: 9999,
    });

    const products = result.docs;
    if (products.length === 0) {
      return { success: false, error: 'No active products found' };
    }

    const items = products.map((p) => ({
      productId: p._id,
      productName: p.name,
      category: p.category || 'Reserve',
      systemStock: p.stock,
      physicalCount: null,
      variance: null,
      buyPrice: p.buyPrice,
      shrinkageValue: null,
      batches: (p.batches || []).map((b) => ({
        batchId: b.batchId,
        quantity: b.quantity,
        expiryDate: b.expiryDate || null,
      })),
      expiryChanges: [],
    }));

    const auditId = `${storeNo}:stock-audit:${uuidv4()}`;
    const auditDoc = {
      _id: auditId,
      type: 'stock-audit',
      storeNo,
      status: 'in_progress',
      items,
      summary: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    await db.put(auditDoc);

    return { success: true, audit: auditDoc };
  } catch (error) {
    console.error('[StockAudit] Error creating audit:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================
// Submit a completed audit
// ============================================================
async function submitAudit(db, auditId, counts) {
  try {
    const auditDoc = await db.get(auditId);

    if (auditDoc.status === 'completed') {
      return { success: false, error: 'Audit already completed' };
    }

    let totalShrinkageUnits = 0;
    let totalShrinkageValue = 0;
    let discrepancyCount = 0;
    let expiryUpdatesCount = 0;
    let categoryUpdatesCount = 0;

    // Build a map from counts for quick lookup
    const countsMap = {};
    for (const c of counts) {
      countsMap[c.productId] = c;
    }

    for (const item of auditDoc.items) {
      const countEntry = countsMap[item.productId];
      if (!countEntry || countEntry.physicalCount == null) {
        // Product not counted — treat physical = system (no change)
        item.physicalCount = item.systemStock;
        item.variance = 0;
        item.shrinkageValue = 0;
        item.expiryChanges = [];
        continue;
      }

      const physicalCount = Number(countEntry.physicalCount);
      const variance = item.systemStock - physicalCount;

      item.physicalCount = physicalCount;
      item.variance = variance;
      item.shrinkageValue = variance * item.buyPrice;

      if (variance !== 0) {
        discrepancyCount++;
        totalShrinkageUnits += variance;
        totalShrinkageValue += item.shrinkageValue;
      }

      // Auto-adjust product stock
      try {
        const product = await db.get(item.productId);
        const updates = {
          ...product,
          stock: physicalCount,
          updatedAt: new Date().toISOString(),
        };

        // Apply category change
        const newCategory = countEntry.category || null;
        if (newCategory && newCategory !== item.category) {
          item.categoryChange = { oldCategory: item.category, newCategory };
          item.category = newCategory;
          updates.category = newCategory;
          categoryUpdatesCount++;
        }

        // Apply expiry date change
        const newExpiry = countEntry.expiryDate || null;
        if (newExpiry) {
          if (!updates.batches) updates.batches = [];

          if (updates.batches.length > 0) {
            // Update first batch's expiry
            const batch = updates.batches[0];
            const oldExpiry = batch.expiryDate || null;
            if (oldExpiry !== newExpiry) {
              item.expiryChanges = [{ batchId: batch.batchId, oldExpiry, newExpiry }];
              batch.expiryDate = newExpiry;
              expiryUpdatesCount++;
            }
          } else {
            // No batches exist — create one with the physical count and expiry
            const newBatchId = require('uuid').v4();
            updates.batches.push({
              batchId: newBatchId,
              expiryDate: newExpiry,
              quantity: physicalCount,
              addedAt: new Date().toISOString(),
            });
            item.expiryChanges = [{ batchId: newBatchId, oldExpiry: null, newExpiry }];
            expiryUpdatesCount++;
          }
        }

        await db.put(updates);
      } catch (productErr) {
        console.error(`[StockAudit] Error updating product ${item.productId}:`, productErr.message);
      }
    }

    const totalProducts = auditDoc.items.length;
    const matchingCount = totalProducts - discrepancyCount;

    auditDoc.summary = {
      totalProducts,
      discrepancyCount,
      totalShrinkageUnits,
      totalShrinkageValue,
      shrinkageRate: totalProducts > 0 ? Math.round((discrepancyCount / totalProducts) * 10000) / 100 : 0,
      accuracyRate: totalProducts > 0 ? Math.round((matchingCount / totalProducts) * 10000) / 100 : 0,
      expiryUpdatesCount,
      categoryUpdatesCount,
    };

    auditDoc.status = 'completed';
    auditDoc.completedAt = new Date().toISOString();

    await db.put(auditDoc);

    return { success: true, audit: auditDoc };
  } catch (error) {
    console.error('[StockAudit] Error submitting audit:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================
// Get a single audit by ID
// ============================================================
async function getAudit(db, auditId) {
  try {
    const doc = await db.get(auditId);
    return { success: true, audit: doc };
  } catch (error) {
    if (error.status === 404) {
      return { success: false, error: 'Audit not found' };
    }
    return { success: false, error: error.message };
  }
}

// ============================================================
// Get audit history
// ============================================================
async function getAuditHistory(db, storeNo, limit = 50) {
  try {
    const result = await db.find({
      selector: {
        type: 'stock-audit',
        storeNo: storeNo,
        status: 'completed',
      },
      limit: limit,
    });

    // Sort by completedAt descending
    const audits = result.docs.sort(
      (a, b) => new Date(b.completedAt) - new Date(a.completedAt)
    );

    // Return lightweight summaries (no full items array)
    const history = audits.map((a) => ({
      _id: a._id,
      status: a.status,
      summary: a.summary,
      createdAt: a.createdAt,
      completedAt: a.completedAt,
    }));

    return { success: true, audits: history };
  } catch (error) {
    console.error('[StockAudit] Error fetching audit history:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================
// Get aggregated audit summary (latest + trends)
// ============================================================
async function getAuditSummary(db, storeNo) {
  try {
    const result = await db.find({
      selector: {
        type: 'stock-audit',
        storeNo: storeNo,
        status: 'completed',
      },
      limit: 9999,
    });

    const audits = result.docs.sort(
      (a, b) => new Date(b.completedAt) - new Date(a.completedAt)
    );

    if (audits.length === 0) {
      return {
        success: true,
        summary: {
          totalAudits: 0,
          latestShrinkageValue: 0,
          latestShrinkageRate: 0,
          latestAccuracyRate: 100,
          trend: 'stable',
          trendDelta: 0,
        },
      };
    }

    const latest = audits[0].summary;
    const previous = audits.length > 1 ? audits[1].summary : null;

    let trend = 'stable';
    let trendDelta = 0;
    if (previous) {
      trendDelta = latest.shrinkageRate - previous.shrinkageRate;
      if (trendDelta > 0.5) trend = 'worsening';
      else if (trendDelta < -0.5) trend = 'improving';
    }

    return {
      success: true,
      summary: {
        totalAudits: audits.length,
        latestShrinkageValue: latest.totalShrinkageValue,
        latestShrinkageRate: latest.shrinkageRate,
        latestAccuracyRate: latest.accuracyRate,
        trend,
        trendDelta: Math.round(trendDelta * 100) / 100,
      },
    };
  } catch (error) {
    console.error('[StockAudit] Error fetching audit summary:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  createAudit,
  submitAudit,
  getAudit,
  getAuditHistory,
  getAuditSummary,
};
