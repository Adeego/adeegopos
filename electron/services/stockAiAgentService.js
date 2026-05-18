const { v4: uuidv4 } = require('uuid');
const restockScheduler = require('./restockScheduler');

const PLAN_VERSION = 2;
const PLAN_HORIZON_DAYS = 7;
const HISTORY_DAYS = 60;
const RANKING_DAYS = 30;
const SUPPLIER_PRICE_DAYS = 180;
const SHORT_WINDOW_DAYS = 14;
const LONG_WINDOW_DAYS = 42;
const PRIORITY_REVENUE_SKUS = 70;
const LOW_TICKET_MAX_PRICE = 50;
const FAST_MOVER_SOLD_30D = 30;
const FAST_MOVER_SALES_DAYS = 6;
const LEAD_TIME_DAYS = 2;
const LOW_MARGIN_PERCENT = 8;
const ABNORMAL_HIGH_MARGIN_PERCENT = 80;
const MANAGED_EXCLUDED_CATEGORIES = new Set(['Reserve']);
const RISK_ORDER = { Critical: 0, High: 1, Watch: 2 };

function toYmd(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function round(value, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(toNumber(value) * factor) / factor;
}

function planIdFor(storeNo, date = new Date()) {
  return `${storeNo}:stock-ai-plan:${toYmd(date)}`;
}

function isActiveBusinessDoc(doc = {}) {
  return doc.state === 'Active' && doc.status !== 'voided' && doc.reconciliationCaseType !== 'sale_void';
}

function getItemProductId(item = {}) {
  return item.productId || item.productVariant?.product?._id || item.product?._id || null;
}

function getItemBaseQuantity(item = {}) {
  const quantity = Math.abs(toNumber(item.quantity));
  const conversion = Math.abs(toNumber(item.conversionFactor ?? item.productVariant?.conversionFactor, 1)) || 1;
  return quantity * conversion;
}

function getItemRevenue(item = {}) {
  const subtotal = Number(item.subtotal);
  if (Number.isFinite(subtotal)) {
    return subtotal;
  }
  return toNumber(item.unitPrice) * Math.abs(toNumber(item.quantity));
}

function getSaleLineUnitPrice(item = {}) {
  const quantity = Math.abs(toNumber(item.quantity));
  const revenue = getItemRevenue(item);
  if (quantity > 0 && revenue > 0) {
    return revenue / quantity;
  }
  return toNumber(item.unitPrice);
}

function getSaleLineBuyCost(item = {}) {
  const quantity = Math.abs(toNumber(item.quantity));
  const unitBuyPrice = toNumber(item.buyPrice);
  return unitBuyPrice * quantity;
}

function getLineMarginPercent(item = {}) {
  const revenue = getItemRevenue(item);
  const cost = getSaleLineBuyCost(item);
  if (revenue <= 0 || cost <= 0) return null;
  return ((revenue - cost) / revenue) * 100;
}

function saleIncludesProduct(sale, productId) {
  return (sale.items || []).some((item) => getItemProductId(item) === productId);
}

function buildDailySeries(sales, productId, startDate, endDate) {
  const byDate = Object.create(null);

  for (const sale of sales) {
    if (!sale.createdAt || !isActiveBusinessDoc(sale)) continue;
    const date = String(sale.createdAt).split('T')[0];
    for (const item of sale.items || []) {
      if (getItemProductId(item) !== productId) continue;
      byDate[date] = (byDate[date] || 0) + getItemBaseQuantity(item);
    }
  }

  const series = [];
  let current = startOfDay(startDate);
  const end = startOfDay(endDate);
  while (current <= end) {
    series.push(byDate[toYmd(current)] || 0);
    current = addDays(current, 1);
  }

  return series;
}

function getProductExpiryRisk(product, horizonDays = PLAN_HORIZON_DAYS) {
  const now = startOfDay();
  const horizon = addDays(now, horizonDays);
  const urgent = addDays(now, 2);
  let expiringQty = 0;
  let urgentExpiryQty = 0;
  let expiredQty = 0;
  const batches = [];

  for (const batch of product.batches || []) {
    const quantity = toNumber(batch.quantity);
    if (!batch.expiryDate || quantity <= 0) continue;

    const expiry = startOfDay(new Date(batch.expiryDate));
    if (Number.isNaN(expiry.getTime())) continue;

    const entry = {
      batchId: batch.batchId || null,
      quantity: round(quantity),
      expiryDate: batch.expiryDate,
      isExpired: expiry <= now,
      daysUntilExpiry: Math.ceil((expiry - now) / (24 * 60 * 60 * 1000)),
    };

    if (expiry <= now) {
      expiredQty += quantity;
      expiringQty += quantity;
      batches.push(entry);
    } else if (expiry <= horizon) {
      expiringQty += quantity;
      batches.push(entry);
      if (expiry <= urgent) {
        urgentExpiryQty += quantity;
      }
    }
  }

  return {
    expiringQty: round(expiringQty),
    urgentExpiryQty: round(urgentExpiryQty),
    expiredQty: round(expiredQty),
    batches,
  };
}

function getTargetCoverDays(product = {}) {
  const restockPeriod = toNumber(product.restockPeriod);
  if (restockPeriod > 0) {
    return product.category === 'Perishable' ? Math.min(restockPeriod, 3) : restockPeriod;
  }
  if (product.category === 'Perishable') return 3;
  if (product.category === 'Secondary') return 14;
  return 7;
}

function getBaseUnitName(product = {}) {
  return product.uom || product.baseUnit || 'units';
}

function getRecommendedPurchaseUnit(product = {}, recommendedBaseQty = 0) {
  const baseUnit = {
    name: getBaseUnitName(product),
    conversionFactor: 1,
  };

  const units = (product.variants || [])
    .map((variant) => ({
      name: variant.name || baseUnit.name,
      conversionFactor: Math.abs(toNumber(variant.conversionFactor)) || 1,
    }))
    .filter((unit) => unit.conversionFactor > 0)
    .sort((a, b) => b.conversionFactor - a.conversionFactor);

  const preferred = units.find((unit) => recommendedBaseQty >= unit.conversionFactor) || units[0] || baseUnit;
  return preferred;
}

function buildDemandMetrics(sales, product, startDate, endDate) {
  const productSales = sales.filter((sale) => saleIncludesProduct(sale, product._id));
  const series = buildDailySeries(productSales, product._id, startDate, endDate);
  const sold60d = series.reduce((sum, value) => sum + toNumber(value), 0);
  const shortDemand = restockScheduler.wmaRecent(series, 0.94, SHORT_WINDOW_DAYS);
  const longDemand = restockScheduler.wmaRecent(series, 0.94, LONG_WINDOW_DAYS);
  const fallbackDemand = sold60d / HISTORY_DAYS;
  const dailyDemand = Math.max(shortDemand || 0, fallbackDemand || 0);
  const trend = (shortDemand || 0) - (longDemand || 0);
  const forecastDemand7d = Math.max(0, dailyDemand * PLAN_HORIZON_DAYS + Math.max(0, trend) * 3);
  const salesDays = series.filter((value) => toNumber(value) > 0).length;

  return {
    dailyDemand,
    trend,
    forecastDemand7d,
    salesDays,
    sold60d,
    series,
  };
}

function classifyRecommendation({ currentStock, effectiveStock, daysOfStock, forecastDemand7d, threshold }) {
  if (currentStock <= 0 || effectiveStock <= 0 || daysOfStock <= 2) {
    return 'Critical';
  }

  if (daysOfStock <= 5) {
    return 'High';
  }

  if (daysOfStock <= PLAN_HORIZON_DAYS || effectiveStock <= threshold || forecastDemand7d > effectiveStock) {
    return 'Watch';
  }

  return null;
}

function buildReason({ currentStock, effectiveStock, daysOfStock, forecastDemand7d, dailyDemand, expiryRisk, trend }) {
  if (currentStock <= 0) {
    return `Out of stock with ${round(forecastDemand7d)} units forecast for the next 7 days.`;
  }

  if (effectiveStock <= 0 && expiryRisk.expiringQty > 0) {
    return `${expiryRisk.expiringQty} units expire within 7 days, leaving no reliable cover.`;
  }

  if (dailyDemand <= 0) {
    return 'Stock is low against the threshold, but there is no recent sales history.';
  }

  if (trend > 0.05) {
    return `${round(daysOfStock, 1)} days of stock left and demand is rising.`;
  }

  return `${round(daysOfStock, 1)} days of stock left against ${round(forecastDemand7d)} units forecast for 7 days.`;
}

function emptyProductStats() {
  return {
    revenue30d: 0,
    revenue60d: 0,
    sold30d: 0,
    sold60d: 0,
    unitQty30d: 0,
    saleDays30d: new Set(),
    saleDays60d: new Set(),
    todaySold: 0,
    todayRevenue: 0,
    marginSum: 0,
    marginCount: 0,
    minMargin: null,
    maxMargin: null,
    belowCostLines: [],
    abnormalMarginLines: [],
  };
}

function getProductStats(statsByProduct, productId) {
  if (!statsByProduct.has(productId)) {
    statsByProduct.set(productId, emptyProductStats());
  }
  return statsByProduct.get(productId);
}

function compactSaleLineEvidence(sale, item, marginPercent = null) {
  return {
    saleId: sale._id,
    date: sale.createdAt,
    itemName: item.name || '',
    quantity: round(toNumber(item.quantity)),
    unitPrice: round(getSaleLineUnitPrice(item)),
    buyPrice: round(toNumber(item.buyPrice)),
    marginPercent: marginPercent === null ? null : round(marginPercent, 1),
  };
}

function buildSalesStats(sales, rankingStartDate, todayStartDate) {
  const statsByProduct = new Map();

  for (const sale of sales) {
    if (!sale.createdAt || !isActiveBusinessDoc(sale)) continue;
    const saleDate = parseDate(sale.createdAt);
    if (!saleDate) continue;

    const dateKey = toYmd(saleDate);
    const isInRankingWindow = saleDate >= rankingStartDate;
    const isToday = saleDate >= todayStartDate;

    for (const item of sale.items || []) {
      const productId = getItemProductId(item);
      if (!productId) continue;

      const stats = getProductStats(statsByProduct, productId);
      const baseQty = getItemBaseQuantity(item);
      const quantity = Math.abs(toNumber(item.quantity));
      const revenue = getItemRevenue(item);
      const unitPrice = getSaleLineUnitPrice(item);
      const buyPrice = toNumber(item.buyPrice);
      const marginPercent = getLineMarginPercent(item);

      stats.revenue60d += revenue;
      stats.sold60d += baseQty;
      stats.saleDays60d.add(dateKey);

      if (isInRankingWindow) {
        stats.revenue30d += revenue;
        stats.sold30d += baseQty;
        stats.unitQty30d += quantity;
        stats.saleDays30d.add(dateKey);
      }

      if (isToday) {
        stats.todaySold += baseQty;
        stats.todayRevenue += revenue;
      }

      if (marginPercent !== null) {
        stats.marginSum += marginPercent;
        stats.marginCount += 1;
        stats.minMargin = stats.minMargin === null ? marginPercent : Math.min(stats.minMargin, marginPercent);
        stats.maxMargin = stats.maxMargin === null ? marginPercent : Math.max(stats.maxMargin, marginPercent);

        if (marginPercent < 0 || marginPercent < LOW_MARGIN_PERCENT || marginPercent > ABNORMAL_HIGH_MARGIN_PERCENT) {
          stats.abnormalMarginLines.push(compactSaleLineEvidence(sale, item, marginPercent));
        }
      }

      if (buyPrice > 0 && unitPrice > 0 && unitPrice < buyPrice) {
        stats.belowCostLines.push(compactSaleLineEvidence(sale, item, marginPercent));
      }
    }
  }

  return statsByProduct;
}

function serializeStats(stats = emptyProductStats()) {
  return {
    revenue30d: round(stats.revenue30d),
    revenue60d: round(stats.revenue60d),
    sold30d: round(stats.sold30d),
    sold60d: round(stats.sold60d),
    unitQty30d: round(stats.unitQty30d),
    saleDays30d: stats.saleDays30d.size,
    saleDays60d: stats.saleDays60d.size,
    todaySold: round(stats.todaySold),
    todayRevenue: round(stats.todayRevenue),
    avgSaleUnitPrice30d: stats.unitQty30d > 0 ? round(stats.revenue30d / stats.unitQty30d) : 0,
    avgMarginPercent: stats.marginCount > 0 ? round(stats.marginSum / stats.marginCount, 1) : null,
    minMarginPercent: stats.minMargin === null ? null : round(stats.minMargin, 1),
    maxMarginPercent: stats.maxMargin === null ? null : round(stats.maxMargin, 1),
  };
}

function selectPriorityProducts(products, statsByProduct) {
  const ranked = [...products]
    .map((product) => ({
      product,
      stats: statsByProduct.get(product._id) || emptyProductStats(),
    }))
    .sort((a, b) => {
      if (b.stats.revenue30d !== a.stats.revenue30d) {
        return b.stats.revenue30d - a.stats.revenue30d;
      }
      return String(a.product.name || '').localeCompare(String(b.product.name || ''));
    });

  const priority = new Map();

  ranked.slice(0, PRIORITY_REVENUE_SKUS).forEach((entry, index) => {
    priority.set(entry.product._id, {
      priorityTier: 'top_revenue',
      priorityRank: index + 1,
    });
  });

  ranked.slice(PRIORITY_REVENUE_SKUS).forEach((entry) => {
    const avgSaleUnitPrice = entry.stats.unitQty30d > 0 ? entry.stats.revenue30d / entry.stats.unitQty30d : 0;
    const isFastSmallItem = avgSaleUnitPrice > 0
      && avgSaleUnitPrice <= LOW_TICKET_MAX_PRICE
      && (entry.stats.sold30d >= FAST_MOVER_SOLD_30D || entry.stats.saleDays30d.size >= FAST_MOVER_SALES_DAYS);

    if (isFastSmallItem) {
      priority.set(entry.product._id, {
        priorityTier: 'fast_small_item',
        priorityRank: priority.size + 1,
      });
    }
  });

  return priority;
}

function getInvoiceProductId(item = {}) {
  return item.productId || item.product?._id || item.productVariant?.product?._id || null;
}

function getInvoiceLineBaseQuantity(item = {}) {
  const explicitBase = toNumber(item.baseQuantity || item.restockQuantity);
  if (explicitBase > 0) return explicitBase;

  const quantity = Math.abs(toNumber(item.quantity));
  const conversion = Math.abs(toNumber(item.conversionFactor || item.restockConversionFactor, 1)) || 1;
  return quantity * conversion;
}

function getInvoiceLineCost(item = {}) {
  const subtotal = toNumber(item.subtotal);
  if (subtotal > 0) return subtotal;

  const quantity = Math.abs(toNumber(item.quantity));
  const buyPrice = toNumber(item.buyPrice || item.newBuyPrice);
  if (quantity > 0 && buyPrice > 0) {
    return quantity * buyPrice;
  }

  return 0;
}

async function buildSupplierPriceIndex(db, storeNo, suppliersById, recentStartDate) {
  const result = await db.find({
    selector: {
      type: 'invoice',
      state: 'Active',
      $or: [
        { storeNo },
        { store: storeNo },
      ],
    },
    limit: 50000,
  });

  const entriesByProduct = new Map();
  for (const invoice of result.docs || []) {
    if (invoice.status === 'voided') continue;

    const date = parseDate(invoice.createdAt || invoice.updatedAt);
    if (!date) continue;

    for (const item of invoice.items || []) {
      const productId = getInvoiceProductId(item);
      const baseQuantity = getInvoiceLineBaseQuantity(item);
      const cost = getInvoiceLineCost(item);
      if (!productId || baseQuantity <= 0 || cost <= 0) continue;

      const unitCost = cost / baseQuantity;
      const supplier = suppliersById.get(invoice.supplierId);
      const entry = {
        supplierId: invoice.supplierId || null,
        supplierName: supplier?.name || 'Unknown supplier',
        invoiceId: invoice._id,
        invoiceDate: invoice.createdAt || invoice.updatedAt,
        unitCost: round(unitCost, 4),
        baseQuantity: round(baseQuantity),
        totalCost: round(cost),
        isRecent: date >= recentStartDate,
      };

      if (!entriesByProduct.has(productId)) {
        entriesByProduct.set(productId, []);
      }
      entriesByProduct.get(productId).push(entry);
    }
  }

  for (const entries of entriesByProduct.values()) {
    entries.sort((a, b) => new Date(b.invoiceDate || 0) - new Date(a.invoiceDate || 0));
  }

  return entriesByProduct;
}

function chooseSupplierRecommendation(product, supplierEntries = [], recommendedBaseQty = 0) {
  const recentEntries = supplierEntries.filter((entry) => entry.isRecent && entry.unitCost > 0);
  const sourceEntries = recentEntries.length > 0 ? recentEntries : supplierEntries.filter((entry) => entry.unitCost > 0);
  const best = [...sourceEntries].sort((a, b) => {
    if (a.unitCost !== b.unitCost) return a.unitCost - b.unitCost;
    return new Date(b.invoiceDate || 0) - new Date(a.invoiceDate || 0);
  })[0];

  const fallbackUnitCost = toNumber(product.buyPrice);
  const unitCost = best?.unitCost || fallbackUnitCost;
  const estimatedCost = recommendedBaseQty > 0 && unitCost > 0 ? recommendedBaseQty * unitCost : 0;

  return {
    supplierId: best?.supplierId || null,
    supplierName: best?.supplierName || null,
    unitCost: round(unitCost, 4),
    estimatedCost: round(estimatedCost),
    source: best ? (best.isRecent ? 'best_recent_invoice_price' : 'latest_invoice_price') : 'current_product_buy_price',
    invoiceId: best?.invoiceId || null,
    invoiceDate: best?.invoiceDate || null,
    hasSupplierHistory: Boolean(best),
  };
}

function buildVariantMarginFlags(product = {}) {
  const flags = [];
  for (const variant of product.variants || []) {
    const margin = variant.marginPercent === undefined || variant.marginPercent === null || variant.marginPercent === ''
      ? null
      : toNumber(variant.marginPercent, null);

    if (margin === null) continue;
    if (margin < LOW_MARGIN_PERCENT) {
      flags.push(`Low saved margin on ${variant.name || 'variant'} (${round(margin, 1)}%)`);
    } else if (margin > ABNORMAL_HIGH_MARGIN_PERCENT) {
      flags.push(`Abnormally high saved margin on ${variant.name || 'variant'} (${round(margin, 1)}%)`);
    }
  }
  return flags;
}

function buildCashFlags({ product, stats, demand, daysOfStock, targetCoverDays }) {
  const flags = [];
  const stockValue = toNumber(product.stock) * toNumber(product.buyPrice);
  const avgMargin = stats.marginCount > 0 ? stats.marginSum / stats.marginCount : null;
  const overstockLimit = Math.max(targetCoverDays * 2, 14);

  if (demand.dailyDemand > 0 && daysOfStock > overstockLimit) {
    flags.push('Overstocked');
  }

  if (toNumber(product.stock) > 0 && stats.sold60d <= 2) {
    flags.push('Slow-moving');
  }

  if (avgMargin !== null && avgMargin < LOW_MARGIN_PERCENT) {
    flags.push('Low-margin');
  }

  if (stockValue >= 5000 && (demand.dailyDemand <= 0 || daysOfStock > overstockLimit)) {
    flags.push('Tying up cash');
  }

  return flags;
}

function buildStockErrorFlags({ product, stats, expiryRisk, auditEntry, movementEntry }) {
  const flags = [];

  if (stats.belowCostLines.length > 0) {
    flags.push(`${stats.belowCostLines.length} sale line(s) below buy price`);
  }

  if (stats.abnormalMarginLines.length > 0) {
    flags.push(`${stats.abnormalMarginLines.length} abnormal margin sale line(s)`);
  }

  if (expiryRisk.expiredQty > 0) {
    flags.push(`${expiryRisk.expiredQty} expired unit(s) still in stock`);
  } else if (expiryRisk.urgentExpiryQty > 0) {
    flags.push(`${expiryRisk.urgentExpiryQty} unit(s) expire within 2 days`);
  }

  if (auditEntry && toNumber(auditEntry.variance) !== 0) {
    flags.push(`Latest count variance: ${round(auditEntry.variance)} unit(s)`);
  }

  if (movementEntry?.nonSellableQty > 0) {
    flags.push(`${round(movementEntry.nonSellableQty)} damaged/expired return unit(s) recorded`);
  }

  flags.push(...buildVariantMarginFlags(product));

  return flags;
}

function buildStockErrorRecords(product, stats, expiryRisk, auditEntry, movementEntry) {
  const records = [];

  if (stats.belowCostLines.length > 0) {
    records.push({
      productId: product._id,
      name: product.name,
      category: product.category || 'Uncategorized',
      type: 'below_buy_price',
      severity: 'high',
      message: `${stats.belowCostLines.length} sale line(s) were sold below buy price.`,
      evidence: stats.belowCostLines.slice(0, 5),
    });
  }

  if (stats.abnormalMarginLines.length > 0) {
    records.push({
      productId: product._id,
      name: product.name,
      category: product.category || 'Uncategorized',
      type: 'abnormal_margin',
      severity: 'medium',
      message: `${stats.abnormalMarginLines.length} sale line(s) have low or abnormal margins.`,
      evidence: stats.abnormalMarginLines.slice(0, 5),
    });
  }

  if (expiryRisk.expiredQty > 0 || expiryRisk.urgentExpiryQty > 0) {
    records.push({
      productId: product._id,
      name: product.name,
      category: product.category || 'Uncategorized',
      type: expiryRisk.expiredQty > 0 ? 'expired_stock' : 'urgent_expiry',
      severity: expiryRisk.expiredQty > 0 ? 'high' : 'medium',
      message: expiryRisk.expiredQty > 0
        ? `${expiryRisk.expiredQty} expired unit(s) still appear in stock.`
        : `${expiryRisk.urgentExpiryQty} unit(s) expire within 2 days.`,
      evidence: expiryRisk.batches,
    });
  }

  if (auditEntry && toNumber(auditEntry.variance) !== 0) {
    records.push({
      productId: product._id,
      name: product.name,
      category: product.category || 'Uncategorized',
      type: 'stock_count_mismatch',
      severity: 'high',
      message: `Latest audit counted ${round(auditEntry.physicalCount)} against system stock ${round(auditEntry.systemStock)}.`,
      evidence: {
        variance: round(auditEntry.variance),
        shrinkageValue: round(auditEntry.shrinkageValue),
      },
    });
  }

  if (movementEntry?.nonSellableQty > 0) {
    records.push({
      productId: product._id,
      name: product.name,
      category: product.category || 'Uncategorized',
      type: 'damaged_or_expired_return',
      severity: 'medium',
      message: `${round(movementEntry.nonSellableQty)} damaged/expired return unit(s) were recorded recently.`,
      evidence: movementEntry.conditions,
    });
  }

  for (const flag of buildVariantMarginFlags(product)) {
    records.push({
      productId: product._id,
      name: product.name,
      category: product.category || 'Uncategorized',
      type: 'saved_variant_margin',
      severity: flag.includes('high') ? 'medium' : 'high',
      message: flag,
      evidence: null,
    });
  }

  return records;
}

async function getActiveStockProducts(db, storeNo) {
  const result = await db.find({
    selector: {
      type: 'product',
      state: 'Active',
      storeNo,
    },
    limit: 10000,
  });

  return (result.docs || []).filter((product) => !MANAGED_EXCLUDED_CATEGORIES.has(product.category || 'Reserve'));
}

async function getRecentSales(db, storeNo, startDate, endDate) {
  const result = await db.find({
    selector: {
      type: 'sale',
      state: 'Active',
      storeNo,
      createdAt: {
        $gte: startDate.toISOString(),
        $lte: endDate.toISOString(),
      },
    },
    limit: 150000,
  });

  return (result.docs || []).filter(isActiveBusinessDoc);
}

async function getSuppliersById(db, storeNo) {
  const result = await db.find({
    selector: {
      type: 'supplier',
      state: 'Active',
      ...(storeNo ? { storeNo } : {}),
    },
    limit: 10000,
  });

  return new Map((result.docs || []).map((supplier) => [supplier._id, supplier]));
}

async function getLatestAuditItemsByProduct(db, storeNo) {
  const result = await db.find({
    selector: {
      type: 'stock-audit',
      status: 'completed',
      storeNo,
    },
    limit: 100,
  });

  const latest = (result.docs || []).sort((a, b) =>
    new Date(b.completedAt || b.createdAt || 0) - new Date(a.completedAt || a.createdAt || 0)
  )[0];

  const byProduct = new Map();
  for (const item of latest?.items || []) {
    if (item.productId) {
      byProduct.set(item.productId, item);
    }
  }
  return byProduct;
}

async function getStockMovementStats(db, storeNo, startDate, endDate) {
  const result = await db.find({
    selector: {
      type: 'stock-movement',
      state: 'Active',
      storeNo,
      createdAt: {
        $gte: startDate.toISOString(),
        $lte: endDate.toISOString(),
      },
    },
    limit: 50000,
  });

  const byProduct = new Map();
  for (const movement of result.docs || []) {
    if (!movement.productId) continue;
    const condition = movement.condition || 'sellable';
    if (condition === 'sellable') continue;

    const conversion = Math.abs(toNumber(movement.conversionFactor, 1)) || 1;
    const qty = Math.abs(toNumber(movement.quantityDelta)) || Math.abs(toNumber(movement.lineQuantity) * conversion);
    if (!byProduct.has(movement.productId)) {
      byProduct.set(movement.productId, { nonSellableQty: 0, conditions: {} });
    }
    const entry = byProduct.get(movement.productId);
    entry.nonSellableQty += qty;
    entry.conditions[condition] = (entry.conditions[condition] || 0) + qty;
  }

  for (const entry of byProduct.values()) {
    entry.nonSellableQty = round(entry.nonSellableQty);
    Object.keys(entry.conditions).forEach((key) => {
      entry.conditions[key] = round(entry.conditions[key]);
    });
  }

  return byProduct;
}

function buildRecommendation(product, sales, startDate, endDate, options = {}) {
  const {
    stats = emptyProductStats(),
    priorityMeta = { priorityTier: 'monitor', priorityRank: null },
    supplierEntries = [],
    auditEntry = null,
    movementEntry = null,
  } = options;

  const currentStock = toNumber(product.stock);
  const threshold = toNumber(product.restockThreshold, 10);
  const targetCoverDays = getTargetCoverDays(product);
  const expiryRisk = getProductExpiryRisk(product);
  const demand = buildDemandMetrics(sales, product, startDate, endDate);
  const effectiveStock = Math.max(0, currentStock - expiryRisk.expiringQty);
  const daysOfStock = demand.dailyDemand > 0 ? effectiveStock / demand.dailyDemand : (effectiveStock > 0 ? 999 : 0);
  const riskLevel = classifyRecommendation({
    currentStock,
    effectiveStock,
    daysOfStock,
    forecastDemand7d: demand.forecastDemand7d,
    threshold,
  });

  const stockErrorFlags = buildStockErrorFlags({ product, stats, expiryRisk, auditEntry, movementEntry });
  const cashFlags = buildCashFlags({ product, stats, demand, daysOfStock, targetCoverDays });

  if (!riskLevel) {
    return {
      analysisOnly: true,
      productId: product._id,
      name: product.name,
      category: product.category || 'Uncategorized',
      currentStock,
      daysOfStock: daysOfStock >= 999 ? 999 : round(daysOfStock, 1),
      daysToStockout: daysOfStock >= 999 ? 999 : round(daysOfStock, 1),
      dailyDemand: round(demand.dailyDemand, 2),
      targetCoverDays,
      cashFlags,
      stockErrorFlags,
      stats: serializeStats(stats),
      stockValue: round(currentStock * toNumber(product.buyPrice)),
    };
  }

  const baseTargetStock = demand.dailyDemand > 0
    ? Math.max(demand.dailyDemand * (LEAD_TIME_DAYS + targetCoverDays), threshold)
    : threshold;
  const recommendedBaseQty = Math.max(0, Math.ceil(baseTargetStock - effectiveStock));
  const purchaseUnit = getRecommendedPurchaseUnit(product, recommendedBaseQty);
  const recommendedPurchaseQty = recommendedBaseQty > 0
    ? Math.max(1, Math.ceil(recommendedBaseQty / purchaseUnit.conversionFactor))
    : 0;
  const purchaseBaseQty = recommendedPurchaseQty * purchaseUnit.conversionFactor;
  const supplierRecommendation = chooseSupplierRecommendation(product, supplierEntries, purchaseBaseQty);
  const estimatedCost = supplierRecommendation.estimatedCost;
  const recommendationGroup = riskLevel === 'Watch' ? 'Buy this week' : 'Buy today';

  return {
    productId: product._id,
    name: product.name,
    category: product.category || 'Uncategorized',
    currentStock,
    effectiveStock: round(effectiveStock),
    daysOfStock: daysOfStock >= 999 ? 999 : round(daysOfStock, 1),
    daysToStockout: daysOfStock >= 999 ? 999 : round(daysOfStock, 1),
    dailyDemand: round(demand.dailyDemand, 2),
    forecastDemand7d: round(demand.forecastDemand7d),
    recommendedQty: recommendedBaseQty,
    recommendedPurchaseQty,
    recommendedUnitName: purchaseUnit.name,
    recommendedBaseQuantity: purchaseBaseQty,
    estimatedCost: round(estimatedCost),
    riskLevel,
    priorityTier: priorityMeta.priorityTier,
    priorityRank: priorityMeta.priorityRank,
    recommendationGroup,
    supplierRecommendation,
    cashFlags,
    stockErrorFlags,
    reason: buildReason({
      currentStock,
      effectiveStock,
      daysOfStock,
      forecastDemand7d: demand.forecastDemand7d,
      dailyDemand: demand.dailyDemand,
      expiryRisk,
      trend: demand.trend,
    }),
    status: 'pending',
    evidence: {
      dailyDemand: round(demand.dailyDemand, 2),
      trend: round(demand.trend, 2),
      effectiveStock: round(effectiveStock),
      threshold,
      targetCoverDays,
      leadTimeDays: LEAD_TIME_DAYS,
      expiringQty7d: expiryRisk.expiringQty,
      urgentExpiryQty: expiryRisk.urgentExpiryQty,
      expiredQty: expiryRisk.expiredQty,
      sold60d: round(demand.sold60d),
      salesDays: demand.salesDays,
      revenue30d: round(stats.revenue30d),
      sold30d: round(stats.sold30d),
      saleDays30d: stats.saleDays30d.size,
    },
  };
}

function summarizeItems(items, extras = {}) {
  const buyToday = items.filter((item) => item.recommendationGroup === 'Buy today');
  const buyThisWeek = items.filter((item) => item.recommendationGroup === 'Buy this week');

  return {
    planVersion: PLAN_VERSION,
    criticalCount: items.filter((item) => item.riskLevel === 'Critical').length,
    highCount: items.filter((item) => item.riskLevel === 'High').length,
    watchCount: items.filter((item) => item.riskLevel === 'Watch').length,
    buyTodayCount: buyToday.length,
    buyThisWeekCount: buyThisWeek.length,
    estimatedCost: round(items.reduce((sum, item) => sum + toNumber(item.estimatedCost), 0)),
    estimatedCashNeededToday: round(buyToday.reduce((sum, item) => sum + toNumber(item.estimatedCost), 0)),
    ...extras,
  };
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    const riskDiff = RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel];
    if (riskDiff !== 0) return riskDiff;
    if (a.daysToStockout !== b.daysToStockout) return a.daysToStockout - b.daysToStockout;
    if (a.priorityRank && b.priorityRank && a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
    return b.forecastDemand7d - a.forecastDemand7d;
  });
}

function sortCashProtection(items) {
  return [...items].sort((a, b) => {
    if (b.stockValue !== a.stockValue) return b.stockValue - a.stockValue;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

function getDoNotRestockItems(cashProtection) {
  return sortCashProtection(cashProtection)
    .filter((item) => item.cashFlags.some((flag) => ['Overstocked', 'Slow-moving', 'Low-margin', 'Tying up cash'].includes(flag)))
    .slice(0, 50);
}

function buildBuyingList(items, cashProtection, stockErrors) {
  return {
    buyToday: items.filter((item) => item.recommendationGroup === 'Buy today'),
    buyThisWeek: items.filter((item) => item.recommendationGroup === 'Buy this week'),
    doNotRestock: getDoNotRestockItems(cashProtection),
    checkShelfCount: stockErrors
      .filter((item) => ['stock_count_mismatch', 'expired_stock', 'urgent_expiry', 'damaged_or_expired_return'].includes(item.type))
      .slice(0, 50),
  };
}

function getFastestMoversToday(analyses) {
  return analyses
    .filter((item) => item.stats.todaySold > 0)
    .sort((a, b) => {
      if (b.stats.todaySold !== a.stats.todaySold) return b.stats.todaySold - a.stats.todaySold;
      return b.stats.todayRevenue - a.stats.todayRevenue;
    })
    .slice(0, 15)
    .map((item) => ({
      productId: item.productId,
      name: item.name,
      category: item.category,
      todaySold: item.stats.todaySold,
      todayRevenue: item.stats.todayRevenue,
      dailyDemand: item.dailyDemand,
    }));
}

function getRunningLowerThanExpected(analyses) {
  return analyses
    .filter((item) => item.dailyDemand > 0 && item.stats.todaySold > Math.max(item.dailyDemand * 1.5, item.dailyDemand + 1))
    .sort((a, b) => b.stats.todaySold - a.stats.todaySold)
    .slice(0, 15)
    .map((item) => ({
      productId: item.productId,
      name: item.name,
      category: item.category,
      todaySold: item.stats.todaySold,
      expectedDailyDemand: item.dailyDemand,
      daysToStockout: item.daysToStockout,
    }));
}

function buildReportSections(items, cashProtection, stockErrors, analyses) {
  const buyingList = buildBuyingList(items, cashProtection, stockErrors);
  const stockCountMismatches = stockErrors.filter((item) => item.type === 'stock_count_mismatch').slice(0, 15);
  const fastestMoversToday = getFastestMoversToday(analyses);
  const runningLowerThanExpected = getRunningLowerThanExpected(analyses);

  return {
    buyingList,
    morningReport: {
      stockoutRisks: items.filter((item) => item.riskLevel === 'Critical' || item.riskLevel === 'High').slice(0, 30),
      reorderToday: buyingList.buyToday,
      estimatedCashNeeded: round(buyingList.buyToday.reduce((sum, item) => sum + toNumber(item.estimatedCost), 0)),
      doNotRestock: buyingList.doNotRestock.slice(0, 20),
    },
    eveningReport: {
      fastestMoversToday,
      stockCountMismatches,
      runningLowerThanExpected,
      tomorrowBuyingPriorities: [...buyingList.buyToday, ...buyingList.buyThisWeek].slice(0, 20),
    },
  };
}

function rebuildStoredSections(plan, items) {
  const cashProtection = plan.cashProtection || [];
  const stockErrors = plan.stockErrors || [];
  const buyingList = buildBuyingList(items, cashProtection, stockErrors);

  return {
    ...plan,
    items,
    buyingList,
    morningReport: {
      ...(plan.morningReport || {}),
      stockoutRisks: items.filter((item) => item.riskLevel === 'Critical' || item.riskLevel === 'High').slice(0, 30),
      reorderToday: buyingList.buyToday,
      estimatedCashNeeded: round(buyingList.buyToday.reduce((sum, item) => sum + toNumber(item.estimatedCost), 0)),
      doNotRestock: buyingList.doNotRestock.slice(0, 20),
    },
    eveningReport: {
      ...(plan.eveningReport || {}),
      stockCountMismatches: stockErrors.filter((item) => item.type === 'stock_count_mismatch').slice(0, 15),
      tomorrowBuyingPriorities: [...buyingList.buyToday, ...buyingList.buyThisWeek].slice(0, 20),
    },
  };
}

function formatCurrency(amount) {
  return `KES ${Math.round(toNumber(amount)).toLocaleString()}`;
}

function formatPurchase(item) {
  const supplier = item.supplierRecommendation?.supplierName
    ? ` from ${item.supplierRecommendation.supplierName}`
    : '';
  const qty = item.recommendedPurchaseQty || item.recommendedQty || 0;
  const unit = item.recommendedUnitName || getBaseUnitName(item);
  return `${item.name}: buy ${qty} ${unit}${supplier} - ${formatCurrency(item.estimatedCost)} (${item.riskLevel})`;
}

function formatMorningReport(plan) {
  const report = plan.morningReport || {};
  const risks = report.stockoutRisks || [];
  const reorderToday = report.reorderToday || [];
  const doNotRestock = report.doNotRestock || [];
  const lines = [
    `*Morning Stock Report* - ${plan.date}`,
    `Stockout risks: ${risks.length}`,
    `Items to reorder today: ${reorderToday.length}`,
    `Estimated cash needed: ${formatCurrency(report.estimatedCashNeeded || 0)}`,
    '',
  ];

  if (risks.length > 0) {
    lines.push('*Items at risk of stockout*');
    lines.push(...risks.slice(0, 8).map((item) => `- ${item.name}: ${item.daysToStockout >= 999 ? 'enough' : `${item.daysToStockout}d`} left, ${item.reason}`));
    lines.push('');
  }

  if (reorderToday.length > 0) {
    lines.push('*Items to reorder today*');
    lines.push(...reorderToday.slice(0, 10).map((item) => `- ${formatPurchase(item)}`));
    lines.push('');
  }

  if (doNotRestock.length > 0) {
    lines.push('*Do not restock*');
    lines.push(...doNotRestock.slice(0, 8).map((item) => `- ${item.name}: ${item.cashFlags.join(', ')}`));
  }

  return lines.join('\n').trim();
}

function formatEveningReport(plan) {
  const report = plan.eveningReport || {};
  const movers = report.fastestMoversToday || [];
  const mismatches = report.stockCountMismatches || [];
  const lowerThanExpected = report.runningLowerThanExpected || [];
  const priorities = report.tomorrowBuyingPriorities || [];
  const lines = [
    `*Evening Stock Report* - ${plan.date}`,
    '',
  ];

  if (movers.length > 0) {
    lines.push('*Fastest movers today*');
    lines.push(...movers.slice(0, 8).map((item) => `- ${item.name}: ${item.todaySold} units, ${formatCurrency(item.todayRevenue)}`));
    lines.push('');
  }

  if (mismatches.length > 0) {
    lines.push('*Stock count mismatches*');
    lines.push(...mismatches.slice(0, 8).map((item) => `- ${item.name}: ${item.message}`));
    lines.push('');
  }

  if (lowerThanExpected.length > 0) {
    lines.push('*Running lower than expected*');
    lines.push(...lowerThanExpected.slice(0, 8).map((item) => `- ${item.name}: sold ${item.todaySold}, expected ${item.expectedDailyDemand}/day`));
    lines.push('');
  }

  if (priorities.length > 0) {
    lines.push("*Tomorrow's buying priorities*");
    lines.push(...priorities.slice(0, 10).map((item) => `- ${formatPurchase(item)}`));
  }

  if (lines.length <= 2) {
    lines.push('No urgent movement, mismatch, or buying priority found this evening.');
  }

  return lines.join('\n').trim();
}

function formatNotification(plan) {
  return formatMorningReport(plan);
}

async function maybeNotifyPlan(db, plan, mainWindow, sendAlert) {
  const urgentCount = plan.summary.criticalCount + plan.summary.highCount;
  if (urgentCount === 0 || plan.notifiedAt) return plan;

  const content = formatNotification(plan);
  if (!content) return plan;

  const now = new Date().toISOString();
  const messageDoc = {
    _id: `${plan.storeNo}:${uuidv4()}`,
    from: 'STOCK_AI',
    sender: 'STOCK_AI',
    header: `Stock AI Action Plan - ${plan.date}`,
    subject: `Stock AI found ${urgentCount} urgent stock risk(s)`,
    content,
    read: false,
    createdAt: now,
    updatedAt: now,
    timestamp: now,
    type: 'message',
    subtype: 'stock-ai-plan',
    state: 'Active',
    storeNo: plan.storeNo,
    planId: plan._id,
  };

  await db.put(messageDoc);
  if (mainWindow) {
    mainWindow.webContents.send('message-created');
    mainWindow.webContents.send('stock-ai-plan-generated', {
      planId: plan._id,
      urgentCount,
    });
  }

  if (typeof sendAlert === 'function') {
    await sendAlert(content);
  }

  return {
    ...plan,
    notifiedAt: now,
    notificationMessageId: messageDoc._id,
  };
}

async function generateStockAiPlan(db, storeNo, mainWindow, sendAlert, options = {}) {
  if (!storeNo) {
    return { success: false, error: 'Store number is required' };
  }

  try {
    const now = new Date();
    const endDate = endOfDay(now);
    const startDate = startOfDay(addDays(now, -HISTORY_DAYS));
    const rankingStartDate = startOfDay(addDays(now, -RANKING_DAYS));
    const supplierStartDate = startOfDay(addDays(now, -SUPPLIER_PRICE_DAYS));
    const todayStartDate = startOfDay(now);

    const [
      products,
      sales,
      suppliersById,
      auditItemsByProduct,
      stockMovementStats,
    ] = await Promise.all([
      getActiveStockProducts(db, storeNo),
      getRecentSales(db, storeNo, startDate, endDate),
      getSuppliersById(db, storeNo),
      getLatestAuditItemsByProduct(db, storeNo),
      getStockMovementStats(db, storeNo, startDate, endDate),
    ]);

    const supplierPriceIndex = await buildSupplierPriceIndex(db, storeNo, suppliersById, supplierStartDate);
    const statsByProduct = buildSalesStats(sales, rankingStartDate, todayStartDate);
    const priorityByProduct = selectPriorityProducts(products, statsByProduct);
    const existing = await db.get(planIdFor(storeNo, now)).catch(() => null);
    const existingStatusByProduct = new Map((existing?.items || []).map((item) => [item.productId, item.status]));

    const analyses = [];
    const recommendationItems = [];
    const stockErrors = [];

    for (const product of products) {
      const stats = statsByProduct.get(product._id) || emptyProductStats();
      const priorityMeta = priorityByProduct.get(product._id) || { priorityTier: 'monitor', priorityRank: null };
      const auditEntry = auditItemsByProduct.get(product._id) || null;
      const movementEntry = stockMovementStats.get(product._id) || null;
      const supplierEntries = supplierPriceIndex.get(product._id) || [];
      const recommendation = buildRecommendation(product, sales, startDate, endDate, {
        stats,
        priorityMeta,
        supplierEntries,
        auditEntry,
        movementEntry,
      });

      const analysis = recommendation.analysisOnly ? recommendation : {
        ...recommendation,
        stats: serializeStats(stats),
        stockValue: round(toNumber(product.stock) * toNumber(product.buyPrice)),
      };
      analyses.push(analysis);

      stockErrors.push(...buildStockErrorRecords(
        product,
        stats,
        getProductExpiryRisk(product),
        auditEntry,
        movementEntry
      ));

      if (!recommendation.analysisOnly && priorityByProduct.has(product._id)) {
        recommendationItems.push({
          ...recommendation,
          status: existingStatusByProduct.get(recommendation.productId) || recommendation.status,
        });
      }
    }

    const items = sortItems(recommendationItems);
    const cashProtection = sortCashProtection(analyses
      .filter((item) => Array.isArray(item.cashFlags) && item.cashFlags.length > 0)
      .map((item) => ({
        productId: item.productId,
        name: item.name,
        category: item.category,
        currentStock: item.currentStock,
        daysOfStock: item.daysOfStock,
        dailyDemand: item.dailyDemand,
        stockValue: item.stockValue,
        cashFlags: item.cashFlags,
        stats: item.stats,
      })));

    const sortedStockErrors = stockErrors.sort((a, b) => {
      const severityRank = { high: 0, medium: 1, low: 2 };
      const diff = (severityRank[a.severity] ?? 3) - (severityRank[b.severity] ?? 3);
      if (diff !== 0) return diff;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    const sections = buildReportSections(items, cashProtection, sortedStockErrors, analyses);
    let plan = {
      _id: planIdFor(storeNo, now),
      type: 'stock-ai-plan',
      planVersion: PLAN_VERSION,
      storeNo,
      date: toYmd(now),
      status: 'active',
      generatedAt: now.toISOString(),
      horizonDays: PLAN_HORIZON_DAYS,
      historyDays: HISTORY_DAYS,
      prioritySkuCount: priorityByProduct.size,
      activeSkuCount: products.length,
      summary: summarizeItems(items, {
        activeSkuCount: products.length,
        prioritySkuCount: priorityByProduct.size,
        cashProtectionCount: cashProtection.length,
        stockErrorCount: sortedStockErrors.length,
        doNotRestockCount: sections.buyingList.doNotRestock.length,
        checkShelfCount: sections.buyingList.checkShelfCount.length,
      }),
      items,
      cashProtection,
      stockErrors: sortedStockErrors,
      analysis: analyses.slice(0, 250),
      ...sections,
      updatedAt: now.toISOString(),
    };

    if (existing) {
      plan = {
        ...existing,
        ...plan,
        _rev: existing._rev,
        createdAt: existing.createdAt || existing.generatedAt,
        notifiedAt: existing.notifiedAt,
        notificationMessageId: existing.notificationMessageId,
      };
    } else {
      plan.createdAt = now.toISOString();
    }

    if (options.notify !== false) {
      plan = await maybeNotifyPlan(db, plan, mainWindow, sendAlert);
    }

    const saved = await db.put(plan);

    return {
      success: true,
      plan: { ...plan, _rev: saved.rev },
    };
  } catch (error) {
    console.error('[Stock AI Agent] Failed to generate plan:', error);
    return { success: false, error: error.message };
  }
}

async function getLatestStockAiPlan(db, storeNo) {
  if (!storeNo) {
    return { success: false, error: 'Store number is required' };
  }

  try {
    const result = await db.find({
      selector: {
        type: 'stock-ai-plan',
        storeNo,
      },
      limit: 100,
    });

    const plans = (result.docs || []).sort((a, b) =>
      new Date(b.generatedAt || b.createdAt || 0) - new Date(a.generatedAt || a.createdAt || 0)
    );

    return {
      success: true,
      plan: plans[0] || null,
    };
  } catch (error) {
    console.error('[Stock AI Agent] Failed to fetch latest plan:', error);
    return { success: false, error: error.message };
  }
}

async function getStockIntelligenceReport(db, storeNo, reportType = 'full') {
  const latest = await getLatestStockAiPlan(db, storeNo);
  if (!latest.success) return latest;

  let plan = latest.plan;
  if (!plan || plan.date !== toYmd() || plan.planVersion !== PLAN_VERSION) {
    const generated = await generateStockAiPlan(db, storeNo, null, null, { notify: false });
    if (!generated.success) return generated;
    plan = generated.plan;
  }

  if (reportType === 'morning') {
    return { success: true, reportType, report: plan.morningReport, planSummary: plan.summary };
  }

  if (reportType === 'evening') {
    return { success: true, reportType, report: plan.eveningReport, planSummary: plan.summary };
  }

  if (reportType === 'buying-list') {
    return { success: true, reportType, report: plan.buyingList, planSummary: plan.summary };
  }

  return { success: true, reportType: 'full', plan };
}

async function updatePlanItemStatus(db, storeNo, planId, productId, status, extra = {}) {
  if (!storeNo || !planId || !productId) {
    return { success: false, error: 'Store number, plan ID, and product ID are required' };
  }

  try {
    const plan = await db.get(planId);
    if (plan.type !== 'stock-ai-plan' || plan.storeNo !== storeNo) {
      return { success: false, error: 'Stock AI plan not found for this store' };
    }

    let found = false;
    const now = new Date().toISOString();
    const items = (plan.items || []).map((item) => {
      if (item.productId !== productId) return item;
      found = true;
      return {
        ...item,
        status,
        ...extra,
        decidedAt: now,
      };
    });

    if (!found) {
      return { success: false, error: 'Recommendation was not found in this plan' };
    }

    const updatedPlan = rebuildStoredSections({
      ...plan,
      updatedAt: now,
    }, items);

    const saved = await db.put(updatedPlan);
    return { success: true, plan: { ...updatedPlan, _rev: saved.rev } };
  } catch (error) {
    console.error('[Stock AI Agent] Failed to update recommendation:', error);
    return { success: false, error: error.message };
  }
}

async function approveStockAiRecommendation(db, storeNo, planId, productId) {
  try {
    const plan = await db.get(planId);
    const recommendation = (plan.items || []).find((item) => item.productId === productId);
    if (!recommendation) {
      return { success: false, error: 'Recommendation was not found in this plan' };
    }

    const product = await db.get(productId);
    const addResult = await restockScheduler.addToRestockList(db, product, storeNo, {
      source: 'stock-ai',
      sourcePlanId: planId,
      riskLevel: recommendation.riskLevel,
      priority: recommendation.priorityTier,
      recommendationGroup: recommendation.recommendationGroup,
      recommendedQty: recommendation.recommendedQty,
      recommendedPurchaseQty: recommendation.recommendedPurchaseQty,
      recommendedUnitName: recommendation.recommendedUnitName,
      estimatedCost: recommendation.estimatedCost,
      supplierRecommendation: recommendation.supplierRecommendation,
    });
    if (!addResult.success && addResult.reason !== 'Reserve products excluded') {
      return addResult;
    }

    return updatePlanItemStatus(db, storeNo, planId, productId, 'approved', {
      approvedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Stock AI Agent] Failed to approve recommendation:', error);
    return { success: false, error: error.message };
  }
}

async function dismissStockAiRecommendation(db, storeNo, planId, productId, reason = '') {
  return updatePlanItemStatus(db, storeNo, planId, productId, 'dismissed', {
    dismissedAt: new Date().toISOString(),
    dismissReason: reason,
  });
}

module.exports = {
  PLAN_HORIZON_DAYS,
  PLAN_VERSION,
  generateStockAiPlan,
  getLatestStockAiPlan,
  getStockIntelligenceReport,
  approveStockAiRecommendation,
  dismissStockAiRecommendation,
  buildRecommendation,
  classifyRecommendation,
  summarizeItems,
  formatMorningReport,
  formatEveningReport,
};
