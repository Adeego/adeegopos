// Function to get today's sales metrics including revenue, number of sales, and profit
function getTodaysSalesMetrics(db) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999); // End of today

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1); // Start of yesterday
  const endOfYesterday = new Date(yesterday);
  endOfYesterday.setHours(23, 59, 59, 999); // End of yesterday

  // Function to calculate metrics from sales documents
  const calculateMetrics = (docs) => {
    let totalRevenue = 0;
    let totalCost = 0;
    let customerCredit = 0;
    const numberOfSales = docs.length;

    docs.forEach(sale => {
      // Calculate revenue
      totalRevenue += Number(sale.totalAmount) || 0;

      // Calculate customer credit (total revenue from credit sales)
      if (sale.paymentMethod === 'CREDIT') {
        customerCredit += Number(sale.totalAmount) || 0;
      }

      // Calculate total cost of products
      sale.items.forEach(item => {
        const quantity = Number(item.quantity) || 0;
        const buyPrice = Number(item.buyPrice) || 0;
        totalCost += quantity * buyPrice;
      });
    });

    // Calculate profit
    const profit = totalRevenue - totalCost;

    return {
        revenue: Number(totalRevenue.toFixed(2)),
        numberOfSales,
        profit: Number(profit.toFixed(2)),
        customerCredit: Number(customerCredit.toFixed(2))
    };
  };

  // Promise for today's data
  const todayPromise = db.find({
    selector: {
      createdAt: { 
        $gte: today.toISOString(), 
        $lte: endOfDay.toISOString() 
      },
      type: "sale",
      state: "Active"
}
  });

  // Promise for yesterday's data
  const yesterdayPromise = db.find({
    selector: {
      createdAt: { 
        $gte: yesterday.toISOString(), 
        $lte: endOfYesterday.toISOString() 
      },
      type: "sale",
      state: "Active"
    }
  });

  // Execute both promises concurrently
  return Promise.all([todayPromise, yesterdayPromise])
    .then(([todayResult, yesterdayResult]) => {
      return {
        success: true,
        data: {
          today: calculateMetrics(todayResult.docs),
          yesterday: calculateMetrics(yesterdayResult.docs)
        }
      };
    })
    .catch(error => {
      console.error('Error getting sales metrics:', error);
      return { success: false, error: error.message };
    });
}

// Function to get today's total expenses
function getTodaysExpenses(db) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999); // End of today

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1); // Start of yesterday
  const endOfYesterday = new Date(yesterday);
  endOfYesterday.setHours(23, 59, 59, 999); // End of yesterday

  // Promise for today's expenses
  const todayPromise = db.find({
    selector: {
      createdAt: {
        $gte: today.toISOString(),
        $lte: endOfDay.toISOString()
      },
      type: "expense",
      state: "Active"
    }
  });

  // Promise for yesterday's expenses
  const yesterdayPromise = db.find({
    selector: {
      createdAt: {
        $gte: yesterday.toISOString(),
        $lte: endOfYesterday.toISOString()
      },
      type: "expense",
      state: "Active"
    }
  });

  // Calculate total expenses from documents
  const calculateTotalExpenses = (docs) => {
    return Number(docs.reduce((total, expense) => 
      total + (Number(expense.amount) || 0), 0).toFixed(2));
  };

  // Execute both promises concurrently
  return Promise.all([todayPromise, yesterdayPromise])
    .then(([todayResult, yesterdayResult]) => {
      return {
        success: true,
        data: {
          today: {
            totalExpenses: calculateTotalExpenses(todayResult.docs)
          },
          yesterday: {
            totalExpenses: calculateTotalExpenses(yesterdayResult.docs)
          }
        }
      };
    })
    .catch(error => {
      console.error('Error getting expenses:', error);
      return { success: false, error: error.message };
    });
}

// Function to get hourly sales data for the line chart
function getHourlySalesData(db) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999); // End of today

  return db.find({
    selector: {
      createdAt: {
        $gte: today.toISOString(),
        $lte: endOfDay.toISOString()
      },
      type: "sale",
      state: "Active"
    }
  }).then(result => {
    // Initialize hourly sales data
    const hourlyData = [];
    for (let hour = 7; hour <= 22; hour++) {
      hourlyData.push({
        hour: hour < 12 ? `${hour}AM` : hour === 12 ? "12PM" : `${hour - 12}PM`,
        sales: 0
      });
    }

    // Aggregate sales by hour
    result.docs.forEach(sale => {
      const saleHour = new Date(sale.createdAt).getHours();
      // Find the corresponding hour index in our hourlyData array
      const hourIndex = hourlyData.findIndex(data => {
        const hour = parseInt(data.hour);
        if (data.hour.includes('PM') && hour !== 12) {
          return (hour + 12) === saleHour;
        } else if (data.hour.includes('AM') || hour === 12) {
          return hour === saleHour;
        }
        return false;
      });

      if (hourIndex !== -1) {
        hourlyData[hourIndex].sales += Number(sale.totalAmount) || 0;
      }
    });

    return {
      success: true,
      data: hourlyData
    };
  }).catch(error => {
    console.error('Error getting hourly sales data:', error);
    return { success: false, error: error.message };
  });
}

// Function to get transaction metrics including customer credits and supplier payments
function transactionMetrics(db) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999); 

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1); // Start of yesterday
  const endOfYesterday = new Date(yesterday);
  endOfYesterday.setHours(23, 59, 59, 999); // End of yesterday

  // Promise for today's transactions
  const todayPromise = db.find({
    selector: {
      createdAt: {
        $gte: today.toISOString(),
        $lte: endOfDay.toISOString()
      },
      type: "transaction", 
      state: "Active"
    }
  });

  // Promise for yesterday's transactions
  const yesterdayPromise = db.find({
    selector: {
      createdAt: {
        $gte: yesterday.toISOString(),
        $lte: endOfYesterday.toISOString()
      },
      type: "transaction",
      state: "Active"
    }
  });

  // Function to calculate transaction metrics from documents
  const calculateMetrics = (docs) => {
    let customerCredits = 0;
    let supplierPayments = 0;

    docs.forEach(transaction => {
      // Calculate customer credits
      if (transaction.source === 'customer') {
        customerCredits += Number(transaction.amount) || 0;
      }
      // Calculate supplier payments
      if (transaction.destination === 'supplier') {
        supplierPayments += Number(transaction.amount) || 0;
      }
    });

    return {
        customerCredits: Number(customerCredits.toFixed(2)),
        supplierPayments: Number(supplierPayments.toFixed(2))
    };
  };

  // Execute both promises concurrently
  return Promise.all([todayPromise, yesterdayPromise])
    .then(([todayResult, yesterdayResult]) => {
      return {
        success: true,
        data: {
          today: calculateMetrics(todayResult.docs),
          yesterday: calculateMetrics(yesterdayResult.docs)
}
      };
    })
    .catch(error => {
      console.error('Error getting transaction metrics:', error);
      return { success: false, error: error.message };
    });
}

module.exports = {
  getTodaysSalesMetrics,
  getTodaysExpenses,
  getHourlySalesData,
  transactionMetrics,
};
