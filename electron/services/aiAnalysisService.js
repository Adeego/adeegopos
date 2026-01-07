const OpenAI = require('openai');

// Initialize OpenAI client with better error handling for API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function getInventoryInsights(db) {
  if (!db) return { lowStock: [], topSelling: [] };

  try {
    // Fetch low stock items (Active products where restock is true or stock is low)
    // We use a broad selector to catch items that might need attention
    const lowStockResult = await db.find({
        selector: {
            type: 'product',
            state: 'Active',
            $or: [
              { restock: true },
              { stock: { $lte: 10 } } // Fallback threshold if restock flag isn't set
            ]
        },
        limit: 20
    });
    
    const lowStock = lowStockResult.docs.map(p => `${p.name} (Stock: ${p.stock})`);

    // Fetch recent sales for trend analysis (last 14 days to catch recent trends)
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - 14);
    
    const recentSalesResult = await db.find({
        selector: {
            type: 'sale',
            state: 'Active',
            createdAt: { $gte: lookbackDate.toISOString() }
        },
        limit: 500 // Analyze last 500 sales for speed
    });

    const productCounts = {};
    recentSalesResult.docs.forEach(sale => {
        if (sale.items && Array.isArray(sale.items)) {
            sale.items.forEach(item => {
                const name = item.name || (item.productVariant && item.productVariant.product && item.productVariant.product.name);
                if (name) {
                    productCounts[name] = (productCounts[name] || 0) + (Number(item.quantity) || 0);
                }
            });
        }
    });

    const topSelling = Object.entries(productCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([name, count]) => `${name} (${count} units)`);

    return { lowStock, topSelling };
  } catch (error) {
    console.error("Error gathering inventory insights:", error);
    return { lowStock: [], topSelling: [] };
  }
}

function getShoppingPeriod() {
  const today = new Date();
  const day = today.getDate();
  
  // Monthly Shopping Time: Start (1-5) and End (25-31) of month
  if (day >= 25 || day <= 9) {
    return {
      name: "Monthly Shopping Season",
      focus: "High Volume & Stock Availability",
      description: "Customers are doing bulk monthly shopping. Prioritize high-velocity items and bulk packs. Ensure stock levels are high to prevent stockouts."
    };
  } 
  // Slow Time: 10th to 25th
  else if (day >= 10 && day < 25) {
    return {
      name: "Mid-Month Slow Season",
      focus: "Maintain Velocity & Cash Flow",
      description: "Sales typically slow down. Focus on ensuring availability of daily essentials that move quickly regardless of date. Use promotions to boost velocity of slower items."
    };
  } 
  // Transition periods (6-9)
  else {
    return {
      name: "Regular Trading Period",
      focus: "Balanced Operations",
      description: "Standard trading days. Maintain balanced inventory and focus on customer service."
    };
  }
}

async function aiAnalysis(event, metrics, db) {
    // Input validation
    if (!metrics || typeof metrics !== 'object') {
        console.error('Invalid metrics provided');
        return null;
    }

    try {
      // Validate required metric fields
      const requiredFields = [
        'currentPeriod', 
        'previousPeriod', 
        'trends', 
        'percentageChanges'
      ];

      const missingFields = requiredFields.filter(field => 
        metrics[field] === undefined || metrics[field] === null
      );

      if (missingFields.length > 0) {
        console.error(`Missing metric fields: ${missingFields.join(', ')}`);
        return null;
      }

      // Gather Context
      const periodContext = getShoppingPeriod();
      const inventoryContext = await getInventoryInsights(db);
      
      const currentDate = new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      const stream = await openai.chat.completions.create({
        model: "gpt-5.1-2025-11-13",
        messages: [
          {
            role: "system",
            content: `You are a vital AI retail agent for AdeegoPOS. Your goal is to ensure profitability and stock availability.
            
            Current Context:
            - Date: ${currentDate}
            - Season: ${periodContext.name}
            - Focus: ${periodContext.focus}
            - Strategy: ${periodContext.description}
            
            Inventory Status:
            - Critical Low Stock: ${inventoryContext.lowStock.length > 0 ? inventoryContext.lowStock.join(', ') : "No critical alerts."}
            - Top Movers (Last 14 days): ${inventoryContext.topSelling.length > 0 ? inventoryContext.topSelling.join(', ') : "Insufficient data."}
            
            Task:
            Analyze the store data below. Provide actionable insights focusing on:
            1. **Stock Optimization:** Recommend specific actions for low stock or fast-moving items based on the current "${periodContext.name}".
            2. **Financial Health:** Briefly comment on Revenue/Profit trends.
            3. **Strategic Advice:** Give 1 concrete step to improve sales right now.
            
            Keep the tone professional, encouraging, and direct. Max 250 words. Currency: KES.`
          },
          {
            role: "user",
            content: `Analyze these store metrics:
              Current Period:
              Revenue: ${metrics.currentPeriod.sales.revenue}
              Number of Sales: ${metrics.currentPeriod.sales.numberOfSales}
              Profit: ${metrics.currentPeriod.sales.profit}
              Expenses: ${metrics.currentPeriod.expenses.total}
              Customer Credits: ${metrics.currentPeriod.sales.customerCredit}
              Credits Paid: ${metrics.currentPeriod.transactions.customerCredits}
              Supplier Payments: ${metrics.currentPeriod.transactions.supplierPayments}
              Cashflow: ${metrics.currentPeriod.cashflow}

              Trends:
              Revenue Trend: ${metrics.trends.sales.revenue}
              Number of Sales Trend: ${metrics.trends.sales.numberOfSales}
              Profit Trend: ${metrics.trends.sales.profit}
              Expenses Trend: ${metrics.trends.expenses.total}

              Percentage Changes:
              Revenue Change: ${metrics.percentageChanges.sales.revenue}%
              Number of Sales Change: ${metrics.percentageChanges.sales.numberOfSales}%
              Profit Change: ${metrics.percentageChanges.sales.profit}%
              Expenses Change: ${metrics.percentageChanges.expenses.total}%`
          }
        ],
        stream: true,
        max_tokens: 500
      });

      let buffer = '';
      let lastSend = Date.now();
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          buffer += content;
          
          // Send chunks every 100ms or when buffer reaches 50 characters
          if (Date.now() - lastSend > 100 || buffer.length >= 50) {
            event.sender.send('aiAnalysis-data', { chunk: buffer });
            buffer = '';
            lastSend = Date.now();
          }
        }
      }
      
      // Send any remaining content in buffer
      if (buffer.length > 0) {
        event.sender.send('aiAnalysis-data', { chunk: buffer });
      }
      
      event.sender.send('aiAnalysis-data', { done: true });
    } catch (error) {
      console.error("OpenAI API Error:", error);
      
      // Enhanced error handling with different types of errors
      if (error.response) {
        // The request was made and the server responded with a status code
        console.error('OpenAI API Response Error:', error.response.data);
        return 'Service temporarily unavailable';
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received from OpenAI');
        return 'Network error occurred';
      } else {
        // Something happened in setting up the request
        console.error('Error setting up OpenAI request');
        return 'Internal error processing request';
      }
    }
}

module.exports = {
    aiAnalysis
}
