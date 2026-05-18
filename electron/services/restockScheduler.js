const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getOpenAIClient, getOpenAIModel, hasOpenAIAuth } = require('./openaiAuth');

// Load environment variables
function loadEnvVariables() {
  try {
    if (process.env.NODE_ENV === 'production') {
      const envPath = path.join(process.resourcesPath, '.env');
      if (fs.existsSync(envPath)) {
        const envConfig = require('dotenv').parse(fs.readFileSync(envPath));
        for (const k in envConfig) {
          process.env[k] = envConfig[k];
        }
      }
    } else {
      require('dotenv').config();
    }
  } catch (error) {
    console.error('Error loading environment variables:', error);
  }
}

loadEnvVariables();

// ============================================================
// Constants
// ============================================================

const RESTOCK_CATEGORIES = {
  PERISHABLE: 'Perishable',
  PRIMARY: 'Primary',
  SECONDARY: 'Secondary',
  DRINKS: 'Drinks'
};

const SCHEDULE_TIMES = {
  MORNING: { hour: 6, minute: 0 },   // 6:00 AM
  EVENING: { hour: 18, minute: 0 }   // 6:00 PM
};

// Categories processed in morning vs evening
const MORNING_CATEGORIES = ['Primary', 'Secondary', 'Drinks'];
const EVENING_CATEGORIES = ['Perishable'];

// ============================================================
// Restock List Management
// ============================================================

async function addToRestockList(db, product, storeNo, recommendation = null) {
  const category = product.category || 'Reserve';
  
  // Skip Reserve products
  if (category === 'Reserve') {
    return { success: false, reason: 'Reserve products excluded' };
  }

  const restockListId = `${storeNo}:restock-list`;
  
  try {
    let restockList;
    try {
      restockList = await db.get(restockListId);
    } catch (e) {
      // Create new restock list if it doesn't exist
      restockList = {
        _id: restockListId,
        type: 'restock-list',
        storeNo: storeNo,
        items: {
          Primary: [],
          Secondary: [],
          Perishable: [],
          Drinks: []
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    // Check if product already in list
    const categoryItems = restockList.items[category] || [];
    const existingIndex = categoryItems.findIndex(item => item.productId === product._id);
    
    const recommendationData = recommendation ? {
      source: recommendation.source || null,
      sourcePlanId: recommendation.sourcePlanId || null,
      riskLevel: recommendation.riskLevel || null,
      priority: recommendation.priority || null,
      recommendationGroup: recommendation.recommendationGroup || null,
      recommendedQty: Number(recommendation.recommendedQty) || 0,
      recommendedPurchaseQty: Number(recommendation.recommendedPurchaseQty) || 0,
      recommendedUnitName: recommendation.recommendedUnitName || null,
      estimatedCost: Number(recommendation.estimatedCost) || 0,
      supplierRecommendation: recommendation.supplierRecommendation || null,
      updatedAt: new Date().toISOString(),
    } : {};

    if (existingIndex === -1) {
      // Add new item
      categoryItems.push({
        productId: product._id,
        name: product.name,
        currentStock: product.stock,
        restockThreshold: product.restockThreshold || 10,
        addedAt: new Date().toISOString(),
        ...recommendationData,
      });
      restockList.items[category] = categoryItems;
    } else {
      // Update existing item
      categoryItems[existingIndex].currentStock = product.stock;
      categoryItems[existingIndex].updatedAt = new Date().toISOString();
      restockList.items[category][existingIndex] = {
        ...categoryItems[existingIndex],
        ...recommendationData,
      };
    }

    restockList.updatedAt = new Date().toISOString();
    await db.put(restockList);

    return { success: true, category, productId: product._id };
  } catch (error) {
    console.error('Error adding to restock list:', error);
    return { success: false, error: error.message };
  }
}

async function removeFromRestockList(db, productId, category, storeNo) {
  const restockListId = `${storeNo}:restock-list`;
  
  try {
    const restockList = await db.get(restockListId);
    const categoryItems = restockList.items[category] || [];
    
    restockList.items[category] = categoryItems.filter(item => item.productId !== productId);
    restockList.updatedAt = new Date().toISOString();
    
    await db.put(restockList);
    return { success: true };
  } catch (error) {
    console.error('Error removing from restock list:', error);
    return { success: false, error: error.message };
  }
}

async function getRestockList(db, storeNo, categories = null) {
  const restockListId = `${storeNo}:restock-list`;
  
  try {
    const restockList = await db.get(restockListId);
    
    if (categories) {
      // Filter to specific categories
      const filtered = {};
      for (const cat of categories) {
        filtered[cat] = restockList.items[cat] || [];
      }
      return { success: true, items: filtered };
    }
    
    return { success: true, items: restockList.items };
  } catch (error) {
    if (error.status === 404) {
      return { success: true, items: { Primary: [], Secondary: [], Perishable: [], Drinks: [] } };
    }
    return { success: false, error: error.message };
  }
}

async function clearRestockList(db, storeNo, categories = null) {
  const restockListId = `${storeNo}:restock-list`;
  
  try {
    const restockList = await db.get(restockListId);
    
    if (categories) {
      for (const cat of categories) {
        restockList.items[cat] = [];
      }
    } else {
      restockList.items = { Primary: [], Secondary: [], Perishable: [], Drinks: [] };
    }
    
    restockList.updatedAt = new Date().toISOString();
    await db.put(restockList);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================
// Low Stock Detection
// ============================================================

async function checkAndAddLowStockProducts(db, storeNo) {
  try {
    // Find all active products
    const result = await db.find({
      selector: {
        type: 'product',
        state: 'Active',
        storeNo: storeNo,
        category: { $ne: 'Reserve' }
      },
      limit: 10000
    });

    const products = result.docs;
    const added = [];

    for (const product of products) {
      const threshold = product.restockThreshold || 10;
      
      // Check if stock is at or below threshold
      if (product.stock <= threshold) {
        const addResult = await addToRestockList(db, product, storeNo);
        if (addResult.success) {
          added.push({ productId: product._id, name: product.name, category: addResult.category });
        }
      }
    }

    return { success: true, addedCount: added.length, added };
  } catch (error) {
    console.error('Error checking low stock products:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================
// Equation 5.2 Helper Functions (imported logic)
// ============================================================

function toYmd(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function nextMondayOnOrAfter(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (1 - day + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function nextMonthlyRestockOnOrAfter(date) {
  const d = new Date(date);
  const day = d.getDate();
  let targetYear = d.getFullYear();
  let targetMonth = d.getMonth();
  let targetDay;

  if (day <= 21) {
    targetDay = 21;
  } else if (day <= 25) {
    targetDay = day;
  } else {
    targetMonth += 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
    targetDay = 21;
  }

  const candidate = new Date(d);
  candidate.setFullYear(targetYear, targetMonth, targetDay);
  return candidate;
}

function nextMonthlyRestockAfter(date) {
  const d = new Date(date);
  let targetYear = d.getFullYear();
  let targetMonth = d.getMonth() + 1;
  if (targetMonth > 11) {
    targetMonth = 0;
    targetYear += 1;
  }
  const day = d.getDate();
  const targetDay = Math.max(21, Math.min(25, day));
  const candidate = new Date(d);
  candidate.setFullYear(targetYear, targetMonth, targetDay);
  return candidate;
}

function weekOfMonthBucket(date) {
  const day = date.getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function estimateSeasonalityFactorsFromHistory(dates, S) {
  const byMonth = new Map();
  for (let i = 0; i < dates.length; i++) {
    const d = dates[i];
    const mk = monthKey(d);
    if (!byMonth.has(mk)) byMonth.set(mk, { hiSum: 0, hiN: 0, midSum: 0, midN: 0 });
    const b = byMonth.get(mk);
    const w = weekOfMonthBucket(d);
    const v = S[i] ?? 0;
    if (w === 1 || w === 4) {
      b.hiSum += v;
      b.hiN += 1;
    } else {
      b.midSum += v;
      b.midN += 1;
    }
  }

  const months = Array.from(byMonth.keys()).sort();
  const lastTwo = months.slice(-2);
  if (lastTwo.length === 0) {
    return { sHi: 1, sMid: 1 };
  }

  let num = 0;
  let den = 0;
  for (const mk of lastTwo) {
    const b = byMonth.get(mk);
    const midAvg = b.midN > 0 ? (b.midSum / b.midN) : 0;
    const hiAvg = b.hiN > 0 ? (b.hiSum / b.hiN) : 0;
    const u_p = midAvg > 0 ? (hiAvg / midAvg - 1) : 0;
    num += b.midN * u_p;
    den += b.midN;
  }

  const u = den > 0 ? (num / den) : 0;
  const mHi = 1 + u;
  const mMid = 1;
  const mBar = (mHi + mMid) / 2;

  if (!isFinite(mBar) || mBar <= 0) {
    return { sHi: 1, sMid: 1 };
  }

  return { sHi: mHi / mBar, sMid: mMid / mBar };
}

function build60DaySeries(salesDocs, productId, startDate, endDate) {
  const byDate = Object.create(null);
  for (const sale of salesDocs) {
    const date = sale.createdAt.split('T')[0];
    const item = sale.items?.find(i => i.productId === productId);
    const qty = Number(item?.quantity) || 0;
    const rawConversion = Number(item?.conversionFactor ?? item?.productVariant?.conversionFactor);
    const conversion = Number.isFinite(rawConversion) && rawConversion > 0 ? rawConversion : 1;
    const baseQty = qty * conversion;
    if (!baseQty) continue;
    byDate[date] = (byDate[date] || 0) + baseQty;
  }

  const dates = [];
  const S = [];
  let cur = new Date(startDate);
  const end = new Date(endDate);

  while (cur <= end) {
    const ymd = toYmd(cur);
    dates.push(new Date(cur));
    S.push(byDate[ymd] || 0);
    cur = addDays(cur, 1);
  }

  return { dates, S };
}

function wmaRecent(S, lambda, N) {
  const n = S.length;
  if (n === 0) return 0;
  const startIdx = Math.max(0, n - N);
  const slice = S.slice(startIdx);
  let num = 0;
  let den = 0;
  for (let i = 0; i < slice.length; i++) {
    const w = Math.pow(lambda, slice.length - 1 - i);
    num += w * slice[i];
    den += w;
  }
  return den > 0 ? (num / den) : 0;
}

function trendFromTwoWmas(S, lambda, Ns, Nl) {
  const ms = wmaRecent(S, lambda, Ns);
  const ml = wmaRecent(S, lambda, Nl);
  return ms - ml;
}

function stdev(arr) {
  const n = arr.length;
  if (n === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const sqSum = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
  return Math.sqrt(sqSum / n);
}

function leadTimeStatsUniform1to3() {
  const a = 1, b = 3;
  const muL = (a + b) / 2;
  const sigmaL = Math.sqrt(Math.pow(b - a, 2) / 12);
  return { muL, sigmaL };
}

function getCadenceParams(product) {
  const category = product.category || 'Reserve';
  if (category === 'Reserve') {
    return { type: 'reserve', R: 0, C: 0 };
  }
  if (category === 'Perishable') {
    return { type: 'perishable', R: 1, C: product.restockPeriod ?? 1 };
  }
  if (category === 'Secondary' || category === 'Drinks') {
    const C = product.restockPeriod ?? 30;
    return { type: 'slow', R: C, C };
  }
  const C = product.restockPeriod ?? 7;
  return { type: 'fast', R: C, C };
}

function seasonalityFactor(date, factors) {
  const w = weekOfMonthBucket(date);
  return (w === 1 || w === 4) ? factors.sHi : factors.sMid;
}

function computeOrderQtyEq52({ product, dates, S, OH, OO = 0, BO = 0 }) {
  const lambda = 0.94;
  const Ns = 14;
  const Nl = 42;

  const factors = estimateSeasonalityFactorsFromHistory(dates, S);
  const mu = wmaRecent(S, lambda, Ns);
  const g = trendFromTwoWmas(S, lambda, Ns, Nl);
  const sigmaD = stdev(S);
  const { muL, sigmaL } = leadTimeStatsUniform1to3();
  const { type, R, C } = getCadenceParams(product);

  if (type === 'reserve') {
    return { Q: 0, mu, g, sigmaD, SS: 0, DhatH: 0, T: 0, IP: OH, H: 0, C: 0 };
  }

  const category = product.category || 'Reserve';
  const z = category === 'Perishable' ? 1.04 : 1.28;
  const H = R + muL;

  let DhatH = 0;
  const today = new Date();
  for (let d = 1; d <= Math.ceil(H); d++) {
    const futureDate = addDays(today, d);
    const s_d = seasonalityFactor(futureDate, factors);
    DhatH += (mu + g * d) * s_d;
  }
  DhatH = Math.max(0, DhatH);

  const sigmaH = sigmaD * Math.sqrt(H + (mu * mu * sigmaL * sigmaL));
  const SS = z * sigmaH;
  const T = DhatH + SS;
  const IP = OH + OO - BO;

  let Q = Math.max(0, Math.ceil(T - IP));

  if (type === 'perishable') {
    const wasteRate = product.wasteRate ?? 0.05;
    Q = Math.ceil(Q / (1 - wasteRate));
  }

  return { Q, mu, g, sigmaD, SS, DhatH, T, IP, H, C };
}

// ============================================================
// AI Analysis for Batch Restock Report
// ============================================================

async function generateBatchRestockReport(calculatedProducts, scheduleType) {
  if (!hasOpenAIAuth() || calculatedProducts.length === 0) {
    return generateDefaultBatchReport(calculatedProducts, scheduleType);
  }

  // Group products by category
  const byCategory = {};
  for (const p of calculatedProducts) {
    const cat = p.category || 'Unknown';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  }

  // Build detailed context for AI
  const productSummaries = calculatedProducts.map(p => ({
    name: p.name,
    category: p.category,
    currentStock: p.currentStock,
    recommendedQty: p.restockQuantity,
    dailyDemand: p.metrics.level?.toFixed(2) || 'N/A',
    trend: p.metrics.trend > 0 ? 'increasing' : p.metrics.trend < 0 ? 'decreasing' : 'stable',
    safetyStock: p.metrics.safetyStock?.toFixed(0) || 'N/A',
    deliveryDate: new Date(p.dates.restockedDate).toLocaleDateString(),
    coverageUntil: new Date(p.dates.stockEndDate).toLocaleDateString(),
    urgency: p.currentStock === 0 ? 'critical' : p.currentStock <= p.metrics.restockThreshold * 0.5 ? 'high' : 'normal'
  }));

  const totalItems = calculatedProducts.length;
  const criticalItems = productSummaries.filter(p => p.urgency === 'critical').length;
  const highUrgencyItems = productSummaries.filter(p => p.urgency === 'high').length;
  const tableHeader = '| Product | Category | Current Stock | Restock Qty | Restock Date | Stock End Date | Avg Daily Demand | Urgency |';
  const tableDivider = '| --- | --- | --- | --- | --- | --- | --- | --- |';
  const tableRows = productSummaries.map(p => (
    `| ${p.name} | ${p.category || 'Unknown'} | ${p.currentStock} | ${p.recommendedQty} | ${p.deliveryDate} | ${p.coverageUntil} | ${p.dailyDemand} | ${p.urgency} |`
  )).join('\n');

  try {
    const openai = await getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: getOpenAIModel(),
      messages: [
        {
          role: "system",
          content: "You are an expert inventory management analyst. Respond in Markdown. Provide: (1) an intro insight paragraph, (2) a Markdown table listing all products to restock with their details, and (3) a concise conclusion insight paragraph."
        },
        {
          role: "user",
          content: `Generate a ${scheduleType} restock report with the required structure.

Overview:
- Total items requiring restock: ${totalItems}
- Critical (out of stock): ${criticalItems}
- High urgency: ${highUrgencyItems}
- Report generated: ${new Date().toLocaleString()}

Use this Markdown table in the response (do not add additional columns):
${tableHeader}
${tableDivider}
${tableRows}

Rules:
- Intro insight first (short paragraph)
- Then the Markdown table (exact headers as provided)
- Then a concise conclusion insight paragraph
- No title or subject line.`
        }
      ],
      max_tokens: 10000
    });

    if (!response?.choices?.[0]?.message?.content) {
      return generateDefaultBatchReport(calculatedProducts, scheduleType);
    }

    return response.choices[0].message.content;
  } catch (error) {
    console.error('AI Report Generation Error:', error.message);
    return generateDefaultBatchReport(calculatedProducts, scheduleType);
  }
}

function generateDefaultBatchReport(calculatedProducts, scheduleType) {
  if (calculatedProducts.length === 0) {
    return `No items currently require restocking. All inventory levels are adequate.`;
  }

  const byCategory = {};
  for (const p of calculatedProducts) {
    const cat = p.category || 'Unknown';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  }

  const productSummaries = calculatedProducts.map(p => ({
    name: p.name,
    category: p.category || 'Unknown',
    currentStock: p.currentStock,
    recommendedQty: p.restockQuantity,
    deliveryDate: new Date(p.dates.restockedDate).toLocaleDateString(),
    coverageUntil: new Date(p.dates.stockEndDate).toLocaleDateString(),
    dailyDemand: p.metrics.level?.toFixed(2) || 'N/A',
    urgency: p.currentStock === 0 ? 'critical' : p.currentStock <= p.metrics.restockThreshold * 0.5 ? 'high' : 'normal'
  }));

  const tableHeader = '| Product | Category | Current Stock | Restock Qty | Restock Date | Stock End Date | Avg Daily Demand | Urgency |';
  const tableDivider = '| --- | --- | --- | --- | --- | --- | --- | --- |';
  const tableRows = productSummaries.map(p => (
    `| ${p.name} | ${p.category} | ${p.currentStock} | ${p.recommendedQty} | ${p.deliveryDate} | ${p.coverageUntil} | ${p.dailyDemand} | ${p.urgency} |`
  )).join('\n');

  const intro = `${calculatedProducts.length} items require restocking for the ${scheduleType} cycle. Prioritize critical and high-urgency items to prevent stockouts.`;
  const conclusion = `Ensure orders are placed to meet the listed delivery dates and maintain coverage through the stock end dates.`;

  return `${intro}\n\n${tableHeader}\n${tableDivider}\n${tableRows}\n\n${conclusion}`;
}

// ============================================================
// Scheduled Restock Calculation
// ============================================================

async function runScheduledRestockCalculation(db, storeNo, mainWindow, scheduleType) {
  const isMorning = scheduleType === 'morning';
  const categories = isMorning ? MORNING_CATEGORIES : EVENING_CATEGORIES;
  
  console.log(`[RestockScheduler] Running ${scheduleType} restock calculation for categories:`, categories);

  try {
    // First, check and add any new low-stock products
    await checkAndAddLowStockProducts(db, storeNo);

    // Get restock list for relevant categories
    const listResult = await getRestockList(db, storeNo, categories);
    if (!listResult.success) {
      throw new Error(listResult.error);
    }

    // Collect all products to process
    const productsToProcess = [];
    for (const category of categories) {
      const items = listResult.items[category] || [];
      for (const item of items) {
        productsToProcess.push({ ...item, category });
      }
    }

    if (productsToProcess.length === 0) {
      console.log(`[RestockScheduler] No products to process for ${scheduleType} schedule`);
      return { success: true, processed: 0, message: 'No products require restocking' };
    }

    // Calculate restock for each product
    const DAYS_FOR_HISTORICAL = 60;
    const { muL } = leadTimeStatsUniform1to3();
    const calculatedProducts = [];

    for (const item of productsToProcess) {
      try {
        const product = await db.get(item.productId);
        const currentStock = product.stock;

        // Get sales data
        const endDate = new Date();
        const startDate = new Date(Date.now() - (DAYS_FOR_HISTORICAL * 24 * 60 * 60 * 1000));

        const salesResult = await db.find({
          selector: {
            type: 'sale',
            state: 'Active',
            storeNo: product.storeNo,
            createdAt: {
              $gte: startDate.toISOString(),
              $lte: endDate.toISOString()
            },
            'items': {
              '$elemMatch': {
                'productId': item.productId
              }
            }
          },
          limit: 150000
        });

        const sales = salesResult.docs;
        if (!sales.length) continue;

        const { dates: seriesDates, S: seriesS } = build60DaySeries(
          sales,
          item.productId,
          startDate.toISOString(),
          endDate.toISOString()
        );

        if (seriesS.length === 0 || seriesS.every(v => v === 0)) continue;

        const eq52Result = computeOrderQtyEq52({
          product,
          dates: seriesDates,
          S: seriesS,
          OH: currentStock,
          OO: product.onOrder || 0,
          BO: 0
        });

        if (isNaN(eq52Result.Q) || eq52Result.Q <= 0) continue;

        // Calculate dates
        const orderDate = new Date();
        const expectedLeadDays = Math.round(muL);
        const earliestDeliveryDate = addDays(orderDate, expectedLeadDays);
        const cadence = getCadenceParams(product);

        let restockedDate = earliestDeliveryDate;
        if (cadence.type === 'fast') {
          restockedDate = nextMondayOnOrAfter(earliestDeliveryDate);
        } else if (cadence.type === 'slow') {
          restockedDate = nextMonthlyRestockOnOrAfter(earliestDeliveryDate);
        }

        let stockEndDate = addDays(restockedDate, eq52Result.C || 7);
        if (cadence.type === 'fast') {
          stockEndDate = nextMondayOnOrAfter(addDays(restockedDate, 1));
        } else if (cadence.type === 'slow') {
          stockEndDate = nextMonthlyRestockAfter(restockedDate);
        }

        const thresholdQty = Math.ceil(eq52Result.mu * muL + 0.5 * eq52Result.SS);

        calculatedProducts.push({
          productId: item.productId,
          name: product.name,
          category: item.category,
          currentStock,
          restockQuantity: eq52Result.Q,
          dates: {
            orderDate: orderDate.toISOString(),
            restockedDate: restockedDate.toISOString(),
            stockEndDate: stockEndDate.toISOString()
          },
          metrics: {
            level: eq52Result.mu,
            trend: eq52Result.g,
            standardDeviation: eq52Result.sigmaD,
            safetyStock: eq52Result.SS,
            forecastDemand: eq52Result.DhatH,
            horizon: eq52Result.H,
            inventoryPosition: eq52Result.IP,
            period: eq52Result.C,
            restockThreshold: thresholdQty
          }
        });

        // Update product threshold
        const currentProduct = await db.get(item.productId);
        await db.put({
          ...currentProduct,
          restockThreshold: thresholdQty,
          lastRestockCalculation: new Date().toISOString()
        });

      } catch (productError) {
        console.error(`[RestockScheduler] Error processing ${item.productId}:`, productError.message);
      }
    }

    if (calculatedProducts.length === 0) {
      return { success: true, processed: 0, message: 'No valid calculations completed' };
    }

    // Generate AI report
    const aiReport = await generateBatchRestockReport(calculatedProducts, scheduleType);

    // Create message document
    const messageDoc = {
      _id: `${storeNo}:${uuidv4()}`,
      from: 'SYSTEM',
      header: `${scheduleType.charAt(0).toUpperCase() + scheduleType.slice(1)} Restock Report - ${new Date().toLocaleDateString()}`,
      content: aiReport,
      read: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: 'message',
      subtype: 'restock-report',
      scheduleType: scheduleType,
      state: 'Active',
      storeNo: storeNo,
      productsIncluded: calculatedProducts.map(p => ({
        productId: p.productId,
        name: p.name,
        quantity: p.restockQuantity
      }))
    };

    await db.put(messageDoc);

    // Notify frontend
    if (mainWindow) {
      mainWindow.webContents.send('message-created');
      mainWindow.webContents.send('restock-report-generated', {
        scheduleType,
        productCount: calculatedProducts.length,
        messageId: messageDoc._id
      });
    }

    // Clear processed items from restock list
    await clearRestockList(db, storeNo, categories);

    console.log(`[RestockScheduler] ${scheduleType} calculation complete. Processed ${calculatedProducts.length} products.`);

    return {
      success: true,
      processed: calculatedProducts.length,
      messageId: messageDoc._id,
      products: calculatedProducts
    };

  } catch (error) {
    console.error(`[RestockScheduler] Error in ${scheduleType} calculation:`, error);
    return { success: false, error: error.message };
  }
}

// ============================================================
// Scheduler Setup
// ============================================================

let morningInterval = null;
let eveningInterval = null;

function getNextScheduleTime(hour, minute) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  
  return next.getTime() - now.getTime();
}

function startRestockScheduler(db, storeNo, mainWindow) {
  console.log('[RestockScheduler] Starting scheduler...');

  // Clear any existing intervals
  stopRestockScheduler();

  // Schedule morning run
  const morningDelay = getNextScheduleTime(SCHEDULE_TIMES.MORNING.hour, SCHEDULE_TIMES.MORNING.minute);
  console.log(`[RestockScheduler] Next morning run in ${Math.round(morningDelay / 1000 / 60)} minutes`);
  
  setTimeout(() => {
    runScheduledRestockCalculation(db, storeNo, mainWindow, 'morning');
    // Then run every 24 hours
    morningInterval = setInterval(() => {
      runScheduledRestockCalculation(db, storeNo, mainWindow, 'morning');
    }, 24 * 60 * 60 * 1000);
  }, morningDelay);

  // Schedule evening run
  const eveningDelay = getNextScheduleTime(SCHEDULE_TIMES.EVENING.hour, SCHEDULE_TIMES.EVENING.minute);
  console.log(`[RestockScheduler] Next evening run in ${Math.round(eveningDelay / 1000 / 60)} minutes`);
  
  setTimeout(() => {
    runScheduledRestockCalculation(db, storeNo, mainWindow, 'evening');
    // Then run every 24 hours
    eveningInterval = setInterval(() => {
      runScheduledRestockCalculation(db, storeNo, mainWindow, 'evening');
    }, 24 * 60 * 60 * 1000);
  }, eveningDelay);

  return { success: true, message: 'Scheduler started' };
}

function stopRestockScheduler() {
  if (morningInterval) {
    clearInterval(morningInterval);
    morningInterval = null;
  }
  if (eveningInterval) {
    clearInterval(eveningInterval);
    eveningInterval = null;
  }
  console.log('[RestockScheduler] Scheduler stopped');
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  // Restock list management
  addToRestockList,
  removeFromRestockList,
  getRestockList,
  clearRestockList,
  checkAndAddLowStockProducts,
  
  // Scheduled calculations
  runScheduledRestockCalculation,
  startRestockScheduler,
  stopRestockScheduler,
  
  // AI report
  generateBatchRestockReport,
  
  // Equation 5.2 helpers (reused by stockManager)
  build60DaySeries,
  wmaRecent,
  trendFromTwoWmas,
  computeOrderQtyEq52,
  leadTimeStatsUniform1to3,
  
  // Constants
  MORNING_CATEGORIES,
  EVENING_CATEGORIES,
  SCHEDULE_TIMES
};
