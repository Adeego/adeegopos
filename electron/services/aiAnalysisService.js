const OpenAI = require('openai');

// Initialize OpenAI client with better error handling for API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function aiAnalysis(event, metrics) {
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

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-2024-11-20",
        messages: [
          {
            role: "system",
            content: `You are a retail business analyst. Analyze the provided store data and provide actionable insights. The currency is KES (Kenya shillings). The analysis should be in 200 words not more. The analysis should be in English language`
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
        max_tokens: 400
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
