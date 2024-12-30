const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');

// Function to fetch products that need restocking
function getProductsToRestock(db) {
  return db.find({
    selector: {
      type: 'product',
      state: 'Active'
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

    // Filter products that need restocking after fetching
    const productsToRestock = result.docs.filter(product => product.restock === true);
    
    return {
      success: true,
      products: productsToRestock
    };
  })
  .catch((error) => ({
    success: false,
    error: `Failed to fetch products to restock: ${error.message}`
  }));
}

// Initialize OpenAI client with better error handling for API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Function to generate a user-friendly restocking message
async function generateRestockingMessage(productDetails, restockDetails) {
  // Validate inputs and API key
  if (!process.env.OPENAI_API_KEY) {
    console.error("OpenAI API key is not set in environment variables");
    return `Automated restocking recommendation: OpenAI API key is missing.`;
  }

  if (!productDetails || !restockDetails) {
    return `Automated restocking recommendation: Invalid product or restock details.`;
  }

  try {
    // Verify API key is not empty before making the request
    if (openai.apiKey === '') {
      throw new Error('OpenAI API key is empty');
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-2024-11-20", // Updated to a valid model name
      messages: [
        {
          role: "system", 
          content: "You are a helpful inventory management assistant. Let the message be in paragraph form and without a subject. Generate the message in Kiswahili language"
        },
        {
          role: "user", 
          content: `Generate a user-friendly restocking recommendation message. 
          Product Name: ${productDetails.name}
          Current Stock: ${productDetails.currentStock}
          Restock Amount: ${restockDetails.restockAmount}
          Order Date: ${new Date(restockDetails.dates.orderDate).toLocaleDateString()}
          Restocked Date: ${new Date(restockDetails.dates.restockedDate).toLocaleDateString()}
          Stock End Date: ${new Date(restockDetails.dates.stockEndDate).toLocaleDateString()}
          Historical Average Demand: ${restockDetails.metrics.historicalAvgDemand.toFixed(2)}`
        }
      ],
      max_tokens: 200
    });

    return response.choices[0].message.content || "No recommendation generated.";
  } catch (error) {
    console.error("OpenAI API Error:", error.message);
    // Fallback response in case of API errors
    return `Automated restocking recommendation for ${productDetails.name}. Restock ${restockDetails.restockAmount} units by ${new Date(restockDetails.dates.restockedDate).toLocaleDateString()}.`;
  }
}

async function calculateRestock(db, productIds) {
  // Validate inputs
  console.log(productIds);
  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    return {
      success: false,
      error: 'Invalid or empty product IDs list'
    };
  }

  try {
    // Constants
    const BETA = 0.6;  // Blending factor (β) - more weight to recent trends
    const Z_SCORE = 1.32;  // Service level 99%
    const SEASONAL_FACTOR = 0.01;  // 1% seasonal increase
    const DAYS_FOR_HISTORICAL = 60;  // Days for historical calculation

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
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
      }
    }

        const period = product.restockPeriod || 14; // Default to 14 days if not specified
        const currentStock = product.stock;

        // Get sales transactions for the past 60 days
        const endDate = new Date().toISOString();
        const startDate = new Date(Date.now() - (DAYS_FOR_HISTORICAL * 24 * 60 * 60 * 1000)).toISOString();

        const salesResult = await db.find({
          selector: {
            type: 'sale',
            state: 'Active',
            createdAt: {
              $gte: startDate,
              $lte: endDate
            },
            'items': {
              '$elemMatch': {
                'productId': productId
              }
            }
          }
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

        // Calculate daily sales amounts with proper quantity extraction
        const dailySales = {};
        sales.forEach(sale => {
          const date = sale.createdAt.split('T')[0];
          const productItem = sale.items.find(item => item.productId === productId);
          if (productItem && productItem.quantity) {
            dailySales[date] = (dailySales[date] || 0) + productItem.quantity;
          }
        });

        const dailyAmounts = Object.values(dailySales);
        if (dailyAmounts.length === 0) {
          results.push({
            productId,
            success: false,
            error: 'No valid sales quantities found'
          });
          continue;
        }

        // Calculate μw (weighted average of recent sales)
        const recentSales = dailyAmounts.slice(-period);
        const μw = recentSales.length > 0 
          ? recentSales.reduce((sum, amount) => sum + amount, 0) / recentSales.length
          : 0;

        // Calculate μh (historical average)
        const μh = dailyAmounts.reduce((sum, amount) => sum + amount, 0) / dailyAmounts.length;

        // Calculate σ (standard deviation)
        const mean = μh;
        const squaredDiffs = dailyAmounts.map(x => Math.pow(x - mean, 2));
        const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / dailyAmounts.length;
        const σ = Math.sqrt(variance);

        // Validate calculations
        if (isNaN(μw) || isNaN(μh) || isNaN(σ)) {
          results.push({
            productId,
            success: false,
            error: 'Statistical calculations resulted in invalid values'
          });
          continue;
        }

        // Calculate restock quantity
        const restockQuantity = Math.max(1, Math.ceil(
          (
            (BETA * μw + (1 - BETA) * μh) * period + 
            Z_SCORE * σ * Math.sqrt(period)
          ) * (1 + SEASONAL_FACTOR)
        ));

        // Calculate dates
        const orderDate = new Date();
        const restockDays = Math.max(1, Math.round(period * 0.15));
        const restockedDate = new Date(orderDate);
        restockedDate.setDate(orderDate.getDate() + restockDays);
        const stockEndDate = new Date(restockedDate);
        stockEndDate.setDate(restockedDate.getDate() + period);

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
            weightedAvgDemand: μw,
            historicalAvgDemand: μh,
            standardDeviation: σ,
            period: period,
            restockThreshold: Math.ceil(restockQuantity * 0.15),
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

        // Update product with retry mechanism
        retryCount = 0;
        while (retryCount < maxRetries) {
          try {
            // Get latest version of product
            const currentProduct = await db.get(productId);
            const updatedProduct = {
              ...currentProduct,
                restockThreshold: Math.ceil(restockQuantity * 0.15),
              restock: false
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
            weightedAvgDemand: μw,
            historicalAvgDemand: μh,
            standardDeviation: σ,
            period: period,
            restockThreshold: Math.ceil(restockQuantity * 0.15),
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
