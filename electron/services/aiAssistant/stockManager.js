const {
  build60DaySeries,
  wmaRecent,
  computeOrderQtyEq52,
  leadTimeStatsUniform1to3,
} = require('../restockScheduler');
const productService = require('../productService');
const stockAiAgent = require('../stockAiAgentService');

const MANAGED_CATEGORIES = ['Primary', 'Secondary', 'Drinks'];
const PERISHABLE_CATEGORY = 'Perishable';
const TOP_N = 50;
const MAX_SHELF_DAYS = 10;
const PERISHABLE_MAX_SHELF_DAYS = 3;
const DAYS_HISTORY = 60;

const SCHEDULE = {
  MORNING: { hour: 7, minute: 0, catchUpWindowHours: 5 },
  EVENING: { hour: 18, minute: 0, catchUpWindowHours: 4 },
};

let morningTimeout = null;
let morningInterval = null;
let eveningTimeout = null;
let eveningInterval = null;
let sendAlertFn = null;
let dbRef = null;
let storeNoRef = '';

// ============================================================
// Top 50 SKU Selection
// ============================================================

async function getTop50SKUs(db, storeNo) {
  const result = await db.find({
    selector: {
      type: 'product',
      state: 'Active',
      storeNo: storeNo,
    },
    limit: 9999,
  });

  // Filter to managed categories in JS (PouchDB $in can be unreliable without index)
  const products = result.docs.filter((p) => MANAGED_CATEGORIES.includes(p.category));
  console.log(`[StockManager] getTop50SKUs: ${result.docs.length} total active, ${products.length} in managed categories`);
  if (products.length === 0) return [];

  // Get 30-day sales to compute velocity
  const endDate = new Date();
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const salesResult = await db.find({
    selector: {
      type: 'sale',
      state: 'Active',
      storeNo: storeNo,
      createdAt: {
        $gte: startDate.toISOString(),
        $lte: endDate.toISOString(),
      },
    },
    limit: 99999,
  });

  // Tally quantity sold and revenue per product
  const velocityMap = {};
  const revenueMap = {};
  for (const sale of salesResult.docs) {
    if (!sale.items) continue;
    for (const item of sale.items) {
      const pid = item.productId || item.productVariant?.product?._id;
      if (!pid) continue;
      const conversion = Number(item.conversionFactor ?? item.productVariant?.conversionFactor) || 1;
      const baseQty = (Number(item.quantity) || 0) * conversion;
      velocityMap[pid] = (velocityMap[pid] || 0) + baseQty;
      revenueMap[pid] = (revenueMap[pid] || 0) + (Number(item.subtotal) || 0);
    }
  }

  // Attach velocity/revenue and sort by revenue
  const ranked = products
    .map((p) => ({
      ...p,
      totalSold30d: velocityMap[p._id] || 0,
      revenue30d: revenueMap[p._id] || 0,
      dailyDemand: (velocityMap[p._id] || 0) / 30,
    }))
    .sort((a, b) => b.revenue30d - a.revenue30d)
    .slice(0, TOP_N);

  return ranked;
}

// ============================================================
// All SKU Selection (no limit)
// ============================================================

async function getAllStockProducts(db, storeNo) {
  const result = await db.find({
    selector: {
      type: 'product',
      state: 'Active',
      storeNo: storeNo,
    },
    limit: 9999,
  });

  // Filter to managed categories
  const products = result.docs.filter((p) => MANAGED_CATEGORIES.includes(p.category));
  console.log(`[StockManager] getAllStockProducts: ${result.docs.length} total active, ${products.length} in managed categories`);
  if (products.length === 0) return [];

  // Get 30-day sales to compute velocity
  const endDate = new Date();
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const salesResult = await db.find({
    selector: {
      type: 'sale',
      state: 'Active',
      storeNo: storeNo,
      createdAt: {
        $gte: startDate.toISOString(),
        $lte: endDate.toISOString(),
      },
    },
    limit: 99999,
  });

  // Tally quantity sold and revenue per product
  const velocityMap = {};
  const revenueMap = {};
  for (const sale of salesResult.docs) {
    if (!sale.items) continue;
    for (const item of sale.items) {
      const pid = item.productId || item.productVariant?.product?._id;
      if (!pid) continue;
      const conversion = Number(item.conversionFactor ?? item.productVariant?.conversionFactor) || 1;
      const baseQty = (Number(item.quantity) || 0) * conversion;
      velocityMap[pid] = (velocityMap[pid] || 0) + baseQty;
      revenueMap[pid] = (revenueMap[pid] || 0) + (Number(item.subtotal) || 0);
    }
  }

  // Attach velocity/revenue and sort by revenue (no limit)
  const ranked = products
    .map((p) => ({
      ...p,
      totalSold30d: velocityMap[p._id] || 0,
      revenue30d: revenueMap[p._id] || 0,
      dailyDemand: (velocityMap[p._id] || 0) / 30,
    }))
    .sort((a, b) => b.revenue30d - a.revenue30d);

  return ranked;
}

// ============================================================
// Stock Analysis
// ============================================================

async function analyzeStock(db, storeNo, products, maxShelfDays) {
  const endDate = new Date();
  const startDate = new Date(Date.now() - DAYS_HISTORY * 24 * 60 * 60 * 1000);

  const results = [];

  for (const product of products) {
    try {
      const salesResult = await db.find({
        selector: {
          type: 'sale',
          state: 'Active',
          storeNo: storeNo,
          createdAt: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
          items: { $elemMatch: { productId: product._id } },
        },
        limit: 150000,
      });

      const sales = salesResult.docs;
      let dailyDemand = product.dailyDemand || 0;
      let trend = 0;
      let forecastQty = 0;

      if (sales.length > 0) {
        const { dates, S } = build60DaySeries(
          sales,
          product._id,
          startDate.toISOString(),
          endDate.toISOString()
        );

        if (S.length > 0 && !S.every((v) => v === 0)) {
          const eq52 = computeOrderQtyEq52({
            product,
            dates,
            S,
            OH: product.stock,
            OO: product.onOrder || 0,
            BO: 0,
          });

          dailyDemand = eq52.mu || dailyDemand;
          trend = eq52.g || 0;
          forecastQty = eq52.Q || 0;
        }
      }

      const currentStock = product.stock || 0;
      const daysOfStock = dailyDemand > 0 ? currentStock / dailyDemand : currentStock > 0 ? 999 : 0;
      const targetQty = Math.max(0, Math.ceil(maxShelfDays * dailyDemand) - currentStock);

      let status;
      if (daysOfStock < 1) status = 'critical';
      else if (daysOfStock < 3) status = 'low';
      else if (daysOfStock <= maxShelfDays) status = 'ok';
      else status = 'overstock';

      const buyPrice = Number(product.buyPrice) || 0;
      const restockCost = targetQty * buyPrice;

      results.push({
        _id: product._id,
        name: product.name,
        category: product.category,
        currentStock,
        dailyDemand: Math.round(dailyDemand * 100) / 100,
        daysOfStock: Math.round(daysOfStock * 10) / 10,
        targetRestockQty: targetQty,
        buyPrice,
        restockCost: Math.round(restockCost * 100) / 100,
        trend: trend > 0.05 ? 'up' : trend < -0.05 ? 'down' : 'stable',
        trendValue: Math.round(trend * 100) / 100,
        status,
      });
    } catch (err) {
      console.error(`[StockManager] Error analyzing ${product.name}:`, err.message);
    }
  }

  return results;
}

// ============================================================
// Perishable Analysis
// ============================================================

async function analyzePerishables(db, storeNo) {
  const result = await db.find({
    selector: {
      type: 'product',
      state: 'Active',
      storeNo: storeNo,
      category: PERISHABLE_CATEGORY,
    },
    limit: 9999,
  });

  const products = result.docs;
  if (products.length === 0) return { items: [], expiring: [] };

  // Analyze stock levels
  const endDate = new Date();
  const startDate = new Date(Date.now() - DAYS_HISTORY * 24 * 60 * 60 * 1000);

  // Get velocities for perishables
  const salesResult = await db.find({
    selector: {
      type: 'sale',
      state: 'Active',
      storeNo: storeNo,
      createdAt: {
        $gte: startDate.toISOString(),
        $lte: endDate.toISOString(),
      },
    },
    limit: 99999,
  });

  const velocityMap = {};
  for (const sale of salesResult.docs) {
    if (!sale.items) continue;
    for (const item of sale.items) {
      const pid = item.productId || item.productVariant?.product?._id;
      if (!pid) continue;
      const conversion = Number(item.conversionFactor ?? item.productVariant?.conversionFactor) || 1;
      velocityMap[pid] = (velocityMap[pid] || 0) + (Number(item.quantity) || 0) * conversion;
    }
  }

  const enriched = products.map((p) => ({
    ...p,
    totalSold30d: velocityMap[p._id] || 0,
    dailyDemand: (velocityMap[p._id] || 0) / 30,
  }));

  const items = await analyzeStock(db, storeNo, enriched, PERISHABLE_MAX_SHELF_DAYS);

  // Check batch expiry (items expiring within 2 days)
  const now = new Date();
  const expiryThreshold = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const expiring = [];

  for (const product of products) {
    const batches = product.batches || [];
    for (const batch of batches) {
      if (!batch.expiryDate || batch.quantity <= 0) continue;
      const expiry = new Date(batch.expiryDate);
      if (expiry <= expiryThreshold) {
        expiring.push({
          name: product.name,
          batchId: batch.batchId,
          quantity: batch.quantity,
          expiryDate: batch.expiryDate,
          isExpired: expiry <= now,
        });
      }
    }
  }

  return { items, expiring };
}

// ============================================================
// Alert Formatting
// ============================================================

function formatMorningAlert(analysis, expiringProducts) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const TOP_PRIORITY_N = 70;

  // Analysis is already sorted by revenue (from getAllStockProducts).
  // Split into priority (top 70) and remaining groups.
  const topIds = new Set(analysis.slice(0, TOP_PRIORITY_N).map((i) => i._id));
  const priorityItems = analysis.filter((i) => topIds.has(i._id));
  const remainingItems = analysis.filter((i) => !topIds.has(i._id));

  // Find top mover
  const topMover = [...analysis].sort((a, b) => b.dailyDemand - a.dailyDemand)[0];

  let msg = `📊 *Morning Stock Report* — ${dateStr}\n`;
  msg += `All SKUs (Primary + Secondary + Drinks) — ${analysis.length} products\n\n`;

  // --- Priority group ---
  msg += formatStockGroup(priorityItems, `🏆 Priority (Top ${priorityItems.length} by revenue)`);

  // --- Remaining group ---
  if (remainingItems.length > 0) {
    msg += formatStockGroup(remainingItems, `📦 Other Items (${remainingItems.length})`);
  }

  // Expiring products section (within 30 days)
  if (expiringProducts && expiringProducts.length > 0) {
    let totalBatches = 0;
    for (const product of expiringProducts) {
      totalBatches += (product.batches || []).length;
    }

    msg += `⏰ *Expiring within 30 days — ${expiringProducts.length} product(s), ${totalBatches} batch(es)*\n`;
    for (const product of expiringProducts) {
      for (const batch of (product.batches || [])) {
        const label = batch.isExpired ? '❌ EXPIRED' : '⏰ Expiring';
        const expDate = new Date(batch.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        msg += `• ${product.name} — ${batch.quantity} units (${label}, ${expDate})\n`;
      }
    }
    msg += '\n';
  }

  if (topMover) {
    const arrow = topMover.trend === 'up' ? '↑' : topMover.trend === 'down' ? '↓' : '→';
    msg += `📈 *Top mover:* ${topMover.name} (${topMover.dailyDemand}/day, ${arrow})`;
  }

  return msg;
}

// Helper: format a stock group section (critical/low/overstock/ok + restock cost)
function formatStockGroup(items, heading) {
  const critical = items.filter((i) => i.status === 'critical');
  const low = items.filter((i) => i.status === 'low');
  const overstock = items.filter((i) => i.status === 'overstock');
  const ok = items.filter((i) => i.status === 'ok');

  let msg = `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `*${heading}*\n\n`;

  if (critical.length > 0) {
    msg += `🔴 *Critical — ${critical.length} item(s)*\n`;
    for (const i of critical) {
      msg += `• ${i.name} — ${i.currentStock} units (${i.daysOfStock}d), need ${i.targetRestockQty} (KSh ${i.restockCost.toLocaleString()})\n`;
    }
    msg += '\n';
  }

  if (low.length > 0) {
    msg += `🟡 *Low — ${low.length} item(s)*\n`;
    for (const i of low) {
      msg += `• ${i.name} — ${i.currentStock} units (${i.daysOfStock}d), need ${i.targetRestockQty} (KSh ${i.restockCost.toLocaleString()})\n`;
    }
    msg += '\n';
  }

  if (overstock.length > 0) {
    msg += `🔵 *Overstock — ${overstock.length} item(s)*\n`;
    for (const i of overstock) {
      msg += `• ${i.name} — ${i.currentStock} units (${i.daysOfStock}d)\n`;
    }
    msg += '\n';
  }

  if (ok.length > 0) {
    msg += `🟢 *OK — ${ok.length} item(s)* within 10-day target\n\n`;
  }

  // Restock cost for this group
  const needsRestock = items.filter((i) => i.targetRestockQty > 0);
  const totalCost = needsRestock.reduce((sum, i) => sum + i.restockCost, 0);
  if (needsRestock.length > 0) {
    msg += `💰 *Restock cost:* KSh ${Math.round(totalCost).toLocaleString()} (${needsRestock.length} items)\n\n`;
  }

  return msg;
}

function formatEveningAlert(perishableData) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const { items, expiring } = perishableData;
  const critical = items.filter((i) => i.status === 'critical');
  const low = items.filter((i) => i.status === 'low');
  const overstock = items.filter((i) => i.status === 'overstock');

  let msg = `🥬 *Evening Perishable Report* — ${dateStr}\n\n`;

  if (expiring.length > 0) {
    msg += `⚠️ *Expiring/Expired — ${expiring.length} batch(es)*\n`;
    for (const e of expiring) {
      const label = e.isExpired ? '❌ EXPIRED' : '⏰ Expiring';
      const expDate = new Date(e.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      msg += `• ${e.name} — ${e.quantity} units (${label}, ${expDate})\n`;
    }
    msg += '\n';
  }

  if (critical.length > 0) {
    msg += `🔴 *Critical — ${critical.length} item(s)*\n`;
    for (const i of critical) {
      msg += `• ${i.name} — ${i.currentStock} units (${i.daysOfStock}d), need ${i.targetRestockQty}\n`;
    }
    msg += '\n';
  }

  if (low.length > 0) {
    msg += `🟡 *Low — ${low.length} item(s)*\n`;
    for (const i of low) {
      msg += `• ${i.name} — ${i.currentStock} units (${i.daysOfStock}d), need ${i.targetRestockQty}\n`;
    }
    msg += '\n';
  }

  if (overstock.length > 0) {
    msg += `🔵 *Overstock — ${overstock.length} item(s)*\n`;
    for (const i of overstock) {
      msg += `• ${i.name} — ${i.currentStock} units (${i.daysOfStock}d)\n`;
    }
    msg += '\n';
  }

  if (items.length === 0 && expiring.length === 0) {
    msg += '✅ All perishables are within target levels and no batches expiring soon.';
  }

  return msg;
}

// ============================================================
// Stockout Snapshot Recording
// ============================================================

async function saveStockoutSnapshot(db, storeNo, analysis, snapshotType) {
  try {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const suffix = snapshotType === 'perishable' ? ':perishable' : '';
    const docId = `${storeNo}:stockout-snapshot:${dateStr}${suffix}`;

    const stockoutItems = analysis.filter(i => i.currentStock === 0);
    const criticalItems = analysis.filter(i => i.status === 'critical');
    const lowItems = analysis.filter(i => i.status === 'low');
    const totalTracked = analysis.length;
    const stockoutCount = stockoutItems.length;
    const stockoutRate = totalTracked > 0 ? Math.round((stockoutCount / totalTracked) * 10000) / 100 : 0;

    const doc = {
      _id: docId,
      type: 'stockout-snapshot',
      snapshotType: snapshotType || 'main',
      storeNo,
      date: dateStr,
      totalTracked,
      stockoutCount,
      stockoutRate,
      criticalCount: criticalItems.length,
      lowCount: lowItems.length,
      stockoutProducts: stockoutItems.map(i => ({ name: i.name, category: i.category })),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Upsert: if doc exists for today, update it
    try {
      const existing = await db.get(docId);
      doc._rev = existing._rev;
      doc.createdAt = existing.createdAt;
    } catch (e) {
      // Doc doesn't exist yet, that's fine
    }

    await db.put(doc);
    console.log(`[StockManager] Stockout snapshot saved: ${docId} — ${stockoutCount}/${totalTracked} (${stockoutRate}%)`);
  } catch (err) {
    console.error('[StockManager] Error saving stockout snapshot:', err.message);
  }
}

// ============================================================
// Orchestrators
// ============================================================

async function runMorningCheck(db, storeNo) {
  console.log('[StockManager] Running morning check...');
  try {
    const result = await stockAiAgent.generateStockAiPlan(db, storeNo, null, null, { notify: false });
    if (!result.success) {
      throw new Error(result.error);
    }

    const plan = result.plan;
    if (!plan) {
      console.log('[StockManager] No Stock AI plan generated for morning check');
      return;
    }

    const analysis = (plan.items || []).map((item) => ({
      ...item,
      _id: item.productId,
      status: item.riskLevel === 'Critical' ? 'critical' : item.riskLevel === 'High' ? 'low' : 'ok',
    }));
    const alert = stockAiAgent.formatMorningReport(plan);

    // Record stockout snapshot for tracking AI effectiveness
    await saveStockoutSnapshot(db, storeNo, analysis, 'main');

    console.log(`[StockManager] Morning check complete: ${plan.activeSkuCount || 0} products analyzed, ${plan.items?.length || 0} buying recommendations`);
    console.log(`[StockManager] Alert length: ${alert.length} chars, sendAlertFn: ${typeof sendAlertFn}`);

    if (sendAlertFn) {
      console.log('[StockManager] Sending morning alert via Telegram...');
      await sendAlertFn(alert);
      console.log('[StockManager] Morning alert sent');
    } else {
      console.warn('[StockManager] No sendAlertFn — alert not sent');
    }

    return plan.morningReport;
  } catch (error) {
    console.error('[StockManager] Morning check error:', error.message, error.stack);
  }
}

async function runEveningCheck(db, storeNo) {
  console.log('[StockManager] Running evening check...');
  try {
    const result = await stockAiAgent.generateStockAiPlan(db, storeNo, null, null, { notify: false });
    if (!result.success) {
      throw new Error(result.error);
    }

    const plan = result.plan;
    const alert = stockAiAgent.formatEveningReport(plan);

    console.log(`[StockManager] Evening check complete: ${plan.eveningReport?.fastestMoversToday?.length || 0} movers, ${plan.eveningReport?.stockCountMismatches?.length || 0} mismatches`);

    if (sendAlertFn) {
      await sendAlertFn(alert);
    }

    return plan.eveningReport;
  } catch (error) {
    console.error('[StockManager] Evening check error:', error.message);
  }
}

// ============================================================
// Scheduler
// ============================================================

function getNextScheduleTime(hour, minute) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

function hasMissedSchedule(hour, minute, catchUpWindowHours = 4) {
  const now = new Date();
  const scheduled = new Date(now);
  scheduled.setHours(hour, minute, 0, 0);
  // Missed if scheduled time was within the configured catch-up window.
  const diffMs = now.getTime() - scheduled.getTime();
  return diffMs >= 0 && diffMs <= catchUpWindowHours * 60 * 60 * 1000;
}

async function resolveStoreNo(db, storeNo) {
  if (storeNo) return storeNo;
  try {
    const result = await db.find({
      selector: { type: 'product', state: 'Active' },
      limit: 1,
      fields: ['storeNo'],
    });
    if (result.docs.length > 0 && result.docs[0].storeNo) {
      console.log(`[StockManager] Auto-detected storeNo: ${result.docs[0].storeNo}`);
      return result.docs[0].storeNo;
    }
  } catch (err) {
    console.error('[StockManager] Failed to auto-detect storeNo:', err.message);
  }
  return storeNo;
}

async function startStockManager(db, storeNo, alertFn) {
  console.log('[StockManager] Starting stock manager...');
  stopStockManager();

  // Auto-detect storeNo from DB if not provided
  storeNo = await resolveStoreNo(db, storeNo);
  console.log(`[StockManager] storeNo="${storeNo}", alertFn=${typeof alertFn}, db=${!!db}`);

  dbRef = db;
  storeNoRef = storeNo;
  sendAlertFn = alertFn;

  // Catch-up: if app was down during a scheduled run, fire it now
  // Delay 10s to let Telegram bot finish connecting before sending alerts
  const missedMorning = hasMissedSchedule(
    SCHEDULE.MORNING.hour,
    SCHEDULE.MORNING.minute,
    SCHEDULE.MORNING.catchUpWindowHours
  );
  const missedEvening = hasMissedSchedule(
    SCHEDULE.EVENING.hour,
    SCHEDULE.EVENING.minute,
    SCHEDULE.EVENING.catchUpWindowHours
  );

  if (missedMorning || missedEvening) {
    console.log(`[StockManager] Catch-up needed — morning: ${missedMorning}, evening: ${missedEvening}`);
    setTimeout(async () => {
      try {
        if (missedMorning) {
          console.log('[StockManager] Running missed morning check...');
          await runMorningCheck(db, storeNo);
          console.log('[StockManager] Missed morning check done');
        }
        if (missedEvening) {
          console.log('[StockManager] Running missed evening check...');
          await runEveningCheck(db, storeNo);
          console.log('[StockManager] Missed evening check done');
        }
      } catch (err) {
        console.error('[StockManager] Catch-up error:', err);
      }
    }, 10000);
  }

  // Schedule morning run (Primary/Secondary/Drinks top 50)
  const morningDelay = getNextScheduleTime(SCHEDULE.MORNING.hour, SCHEDULE.MORNING.minute);
  console.log(`[StockManager] Next morning check in ${Math.round(morningDelay / 1000 / 60)} minutes`);

  morningTimeout = setTimeout(() => {
    runMorningCheck(db, storeNo);
    morningInterval = setInterval(() => {
      runMorningCheck(db, storeNo);
    }, 24 * 60 * 60 * 1000);
  }, morningDelay);

  // Schedule evening run (Perishables)
  const eveningDelay = getNextScheduleTime(SCHEDULE.EVENING.hour, SCHEDULE.EVENING.minute);
  console.log(`[StockManager] Next evening check in ${Math.round(eveningDelay / 1000 / 60)} minutes`);

  eveningTimeout = setTimeout(() => {
    runEveningCheck(db, storeNo);
    eveningInterval = setInterval(() => {
      runEveningCheck(db, storeNo);
    }, 24 * 60 * 60 * 1000);
  }, eveningDelay);
}

function stopStockManager() {
  if (morningTimeout) { clearTimeout(morningTimeout); morningTimeout = null; }
  if (morningInterval) { clearInterval(morningInterval); morningInterval = null; }
  if (eveningTimeout) { clearTimeout(eveningTimeout); eveningTimeout = null; }
  if (eveningInterval) { clearInterval(eveningInterval); eveningInterval = null; }
  console.log('[StockManager] Stopped');
}

function updateStockManagerStoreNo(storeNo) {
  storeNoRef = storeNo;
}

// On-demand report for AI assistant tool
async function getStockHealthReport(db, storeNo) {
  const result = await stockAiAgent.getStockIntelligenceReport(db, storeNo, 'full');
  if (!result.success) return result;

  return {
    success: true,
    plan: result.plan,
    morningReport: result.plan.morningReport,
    eveningReport: result.plan.eveningReport,
    buyingList: result.plan.buyingList,
    cashProtection: result.plan.cashProtection,
    stockErrors: result.plan.stockErrors,
  };
}

module.exports = {
  startStockManager,
  stopStockManager,
  updateStockManagerStoreNo,
  getStockHealthReport,
  runMorningCheck,
  runEveningCheck,
};
