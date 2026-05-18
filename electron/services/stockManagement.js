const path = require('path');
const fs = require('fs');
const { getOpenAIClient, getOpenAIModel, hasOpenAIAuth } = require('./openaiAuth');

// Load environment variables from .env file in production
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
const { v4: uuidv4 } = require('uuid');

// ============================================================
// Equation 5.2 Helper Functions
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

function seasonalityFactor(date, factors) {
  const w = weekOfMonthBucket(date);
  return (w === 1 || w === 4) ? factors.sHi : factors.sMid;
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
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    dates.push(new Date(d));
    const ymd = toYmd(d);
    S.push(byDate[ymd] || 0);
  }

  return { dates, S };
}

function wmaRecent(values, lambda, N) {
  const n = Math.min(N, values.length);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const v = values[values.length - 1 - i];
    const w = Math.pow(lambda, i);
    num += w * v;
    den += w;
  }
  return den === 0 ? 0 : num / den;
}

function trendFromTwoWmas(values, lambda, Ns, Nl) {
  const muS = wmaRecent(values, lambda, Ns);
  const muL = wmaRecent(values, lambda, Nl);
  const denom = (Nl - Ns) / 2;
  if (denom <= 0) return 0;
  return (muS - muL) / denom;
}

function stdev(values) {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((acc, x) => acc + Math.pow(x - mean, 2), 0) / values.length;
  return Math.sqrt(v);
}

function leadTimeStatsUniform1to3() {
  return { muL: 2, sigmaL: Math.sqrt(2 / 3) };
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

  // Primary (default)
  const C = product.restockPeriod ?? 7;
  return { type: 'fast', R: C, C };
}

function computeOrderQtyEq52({
  product,
  dates,
  S,
  OH,
  OO = 0,
  BO = 0,
  lambda = 0.94,
  Ns = 14,
  Nl = 42,
}) {
  const { type, R, C } = getCadenceParams(product);
  const { muL, sigmaL } = leadTimeStatsUniform1to3();

  if (type === 'reserve') {
    return { Q: 0, mu: 0, g: 0, sigmaD: 0, DhatH: 0, SS: 0, H: 0, IP: OH + OO - BO, R, C };
  }

  const seasonality = estimateSeasonalityFactorsFromHistory(dates, S);
  const sHist = dates.map(d => seasonalityFactor(d, seasonality));
  const X = S.map((st, i) => (sHist[i] ? st / sHist[i] : 0));

  // Level and trend on de-seasonalized series
  const mu = wmaRecent(X, lambda, Nl);
  const g = trendFromTwoWmas(X, lambda, Ns, Nl);

  // Residuals
  const residuals = X.map((xt, idx) => {
    const k = (X.length - 1) - idx;
    return xt - (mu + g * k);
  });
  const sigmaD = stdev(residuals);

  // Choose horizon and z
  const H = R + muL;
  const z = (type === 'perishable') ? 1.04 : 1.28;

  // Forecast daily demand over horizon
  const today = new Date();
  const Dhat = [];
  for (let d = 1; d <= H; d++) {
    const baseline = Math.max(0, mu + g * d);
    const futureDate = addDays(today, d);
    const sf = seasonalityFactor(futureDate, seasonality);
    Dhat.push(baseline * sf);
  }

  // Total forecast demand and average
  const DhatH = Dhat.reduce((a, b) => a + b, 0);
  const dbar = H > 0 ? (DhatH / H) : 0;

  // Safety stock
  const sigmaH = Math.sqrt(H * sigmaD * sigmaD + (dbar * dbar) * (sigmaL * sigmaL));
  const SS = z * sigmaH;

  // Inventory position and target
  const IP = OH + OO - BO;

  // Perishables: use coverage C and waste factor
  if (type === 'perishable') {
    const pw = Math.max(0, Math.min(0.5, product.wasteRate ?? 0.05));
    const alpha = 1 / (1 - pw);

    const DhatC = Dhat.slice(0, C).reduce((a, b) => a + b, 0);
    const dbarC = C > 0 ? (DhatC / C) : 0;

    const sigmaC = Math.sqrt(C * sigmaD * sigmaD + (dbarC * dbarC) * (sigmaL * sigmaL));
    const SSC = z * sigmaC;

    const Qp = Math.max(0, alpha * (DhatC + SSC) - IP);
    return { Q: Math.ceil(Qp), mu, g, sigmaD, DhatH: DhatC, SS: SSC, H: C, IP, R, C };
  }

  // Non-perishables
  const T = DhatH + SS;
  const Q = Math.max(0, T - IP);

  return { Q: Math.ceil(Q), mu, g, sigmaD, DhatH, SS, H, IP, R, C };
}

// ============================================================
// End Equation 5.2 Helper Functions
// ============================================================

// Function to fetch products that need restocking
function getProductsToRestock(db, storeNo) {
  return db.find({
    selector: {
      type: 'product',
      state: 'Active',
      storeNo: storeNo,
      restock: true
    }
  })
  .then((result) => {
    // Validate result
    if (!result || !result.docs) {
      return {
        success: false,
        error: 'No products found or invalid result'
      };
    }

    return {
      success: true,
      products: result.docs
    };
  })
  .catch((error) => ({
    success: false,
    error: `Failed to fetch products to restock: ${error.message}`
  }));
}

// Function to generate a user-friendly restocking message
async function generateRestockingMessage(productDetails, restockDetails) {
  console.log(`The restock detail. Check if stock; ${restockDetails.currentStock}`)
  // Validate inputs and OpenAI auth
  if (!hasOpenAIAuth()) {
    console.error("OpenAI OAuth is not configured");
    return generateDefaultMessage(productDetails, restockDetails);
  }

  if (!productDetails || !restockDetails) {
    return generateDefaultMessage(productDetails, restockDetails);
  }

  try {
    const openai = await getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: getOpenAIModel(),
      messages: [
        {
          role: "system", 
          content: "You are a helpful inventory management assistant. Respond in Markdown. Provide: (1) an intro insight paragraph, (2) a Markdown table listing all products to restock with their details, and (3) a concise conclusion insight paragraph."
        },
        {
          role: "user", 
          content: `Generate a restocking recommendation with the required structure.

Data to include in the table (single product row if only one product is provided):
- Product: ${productDetails.name}
- Current Stock: ${restockDetails.currentStock}
- Restock Qty: ${restockDetails.restockAmount}
- Restock Date: ${new Date(restockDetails.dates.restockedDate).toLocaleDateString()}
- Stock End Date: ${new Date(restockDetails.dates.stockEndDate).toLocaleDateString()}
- Avg Daily Demand: ${restockDetails.metrics.historicalAvgDemand.toFixed(2)}

Rules:
- Intro insight first (short paragraph)
- Then a Markdown table with headers: Product | Current Stock | Restock Qty | Restock Date | Stock End Date | Avg Daily Demand
- Then a concise conclusion insight paragraph
- No title or subject line.`
        }
      ],
      max_tokens: 10000
    });

    // If OpenAI returns an empty or invalid response, use default message
    if (!response?.choices?.[0]?.message?.content) {
      return generateDefaultMessage(productDetails, restockDetails);
    }
    return response.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI API Error:", error.message);
    return generateDefaultMessage(productDetails, restockDetails);
  }
}

// Helper function to generate a default message
function generateDefaultMessage(productDetails, restockDetails) {
  if (!productDetails || !restockDetails) {
    return "Unable to generate restocking recommendation due to missing product details.";
  }

  return `Based on the inventory analysis for ${productDetails.name}, we recommend restocking ${restockDetails.restockAmount} units. The current stock level stands at ${restockDetails.currentStock} units. To maintain optimal inventory levels through ${new Date(restockDetails.dates.stockEndDate).toLocaleDateString()}, please submit your order today for delivery by ${new Date(restockDetails.dates.restockedDate).toLocaleDateString()}. Historical data indicates an average daily demand of ${restockDetails.metrics.historicalAvgDemand.toFixed(2)} units.`;
}

async function calculateRestock(db, productIds, mainWindow) {
  // Validate inputs
  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    return {
      success: false,
      error: 'Invalid or empty product IDs list'
    };
  }

  try {
    // Equation 5.2 Constants
    const DAYS_FOR_HISTORICAL = 60;
    const { muL } = leadTimeStatsUniform1to3();

    const results = [];

    for (const productId of productIds) {
      try {
        // Get product details with retry mechanism
        let product;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
          try {
            product = await db.get(productId);
            break;
          } catch (error) {
            if (retryCount === maxRetries - 1) throw error;
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }

        const currentStock = product.stock;
        const category = product.category || 'Reserve';

        // Skip Reserve category products
        if (category === 'Reserve') {
          results.push({
            productId,
            success: false,
            error: 'Reserve category products are excluded from restock calculations'
          });
          continue;
        }

        // Get sales transactions for the past 60 days
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
                'productId': productId
              }
            }
          },
          limit: 150000
        });

        const sales = salesResult.docs;
        if (!sales.length) {
          results.push({
            productId,
            success: false,
            error: 'No sales data available for calculation'
          });
          continue;
        }

        // Build ordered 60-day series (including zeros)
        const { dates: seriesDates, S: seriesS } = build60DaySeries(
          sales,
          productId,
          startDate.toISOString(),
          endDate.toISOString()
        );

        if (seriesS.length === 0 || seriesS.every(v => v === 0)) {
          results.push({
            productId,
            success: false,
            error: 'No valid sales quantities found in 60-day period'
          });
          continue;
        }

        // Compute order quantity using Equation 5.2
        const eq52Result = computeOrderQtyEq52({
          product,
          dates: seriesDates,
          S: seriesS, 
          OH: currentStock,
          OO: product.onOrder || 0,
          BO: 0
        });

        const restockQuantity = eq52Result.Q;

        // Validate calculations
        if (isNaN(restockQuantity) || isNaN(eq52Result.mu) || isNaN(eq52Result.sigmaD)) {
          results.push({
            productId,
            success: false,
            error: 'Statistical calculations resulted in invalid values'
          });
          continue;
        }

        // Calculate dates using lead time and cadence schedule
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

        // Calculate threshold based on lead time demand + fraction of safety stock
        const thresholdQty = Math.ceil(eq52Result.mu * muL + 0.5 * eq52Result.SS);

        // Generate AI-powered restocking message
        const aiRestockMessage = await generateRestockingMessage(product, {
          restockAmount: restockQuantity,
          currentStock: currentStock,
          dates: {
            orderDate: orderDate.toISOString(),
            restockedDate: restockedDate.toISOString(),
            stockEndDate: stockEndDate.toISOString()
          },
          metrics: {
            historicalAvgDemand: eq52Result.mu,
            trend: eq52Result.g,
            standardDeviation: eq52Result.sigmaD,
            safetyStock: eq52Result.SS,
            forecastDemand: eq52Result.DhatH,
            horizon: eq52Result.H,
            inventoryPosition: eq52Result.IP,
            period: eq52Result.C,
            restockThreshold: thresholdQty,
          }
        });

        // Create and save message document
        const messageDoc = {
          _id: `${product.storeNo}:${uuidv4()}`,
          from: 'SYSTEM',
          header: `Restock Recommendation for ${product.name}`,
          content: aiRestockMessage,
          read: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          type: 'message',
          state: 'Active',
          storeNo: product.storeNo
        };

        await db.put(messageDoc);
        
        // Emit message-created event
        if (mainWindow) {
          mainWindow.webContents.send('message-created');
        }

        // Update product with retry mechanism
        retryCount = 0;
        while (retryCount < maxRetries) {
          try {
            const currentProduct = await db.get(productId);
            const updatedProduct = {
              ...currentProduct,
              restockThreshold: thresholdQty,
              restock: false,
              lastRestockMessageDate: new Date().toISOString()
            };
            await db.put(updatedProduct);
            break;
          } catch (error) {
            if (retryCount === maxRetries - 1) throw error;
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }

        results.push({
          productId,
          success: true,
          restockAmount: restockQuantity,
          currentStock: currentStock,
          aiRestockMessage,
          messageDoc,
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
            restockThreshold: thresholdQty,
          }
        });

      } catch (productError) {
        console.error(`Error processing product ${productId}:`, productError);
        results.push({
          productId,
          success: false,
          error: `Failed to process product: ${productError.message}`
        });
      }
    }

    return {
      success: true,
      results
    };
  } catch (error) {
    console.error('Restock calculation error:', error);
    return {
      success: false,
      error: `Restock calculation failed: ${error.message}`
    };
  }
}

module.exports = {
  getProductsToRestock,
  calculateRestock
};
