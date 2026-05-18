const {
  getSaleNetAmount,
  getSaleNetCost,
  getSalePaymentBreakdown,
  shouldIncludeSaleInMetrics,
  shouldIncludeTransactionInMetrics,
  toNumber,
} = require('./postingService');

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
    let numberOfSales = 0;

    docs.forEach(sale => {
      if (!shouldIncludeSaleInMetrics(sale)) {
        return;
      }

      numberOfSales += 1;

      // Calculate revenue
      totalRevenue += getSaleNetAmount(sale);

      // Calculate customer credit (total revenue from credit sales)
      const sign = getSaleNetAmount(sale) < 0 ? -1 : 1;
      getSalePaymentBreakdown(sale).forEach((payment) => {
        if (payment.method === 'CREDIT') {
          customerCredit += (Math.abs(toNumber(payment.amount)) * sign);
        }
      });

      // Calculate total cost of products
      totalCost += getSaleNetCost(sale);
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
    },
    limit: 100000
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
    },
    limit: 100000
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
    },
    limit: 100000
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
    },
    limit: 100000
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
    },
    limit: 100000
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
      if (!shouldIncludeSaleInMetrics(sale)) {
        return;
      }

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
        hourlyData[hourIndex].sales += getSaleNetAmount(sale);
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

const getAccountMethod = (account) => {
  const accountNumber = account?.accountNumber || '';
  if (accountNumber.endsWith('001')) {
    return 'cash';
  }
  if (accountNumber.endsWith('002')) {
    return 'mpesa';
  }
  return null;
};

// Function to get transaction metrics including customer credits and supplier payments
function transactionMetrics(db, storeNo) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999); 

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1); // Start of yesterday
  const endOfYesterday = new Date(yesterday);
  endOfYesterday.setHours(23, 59, 59, 999); // End of yesterday

  const transactionSelector = {
    type: "transaction",
    state: "Active"
  };

  if (storeNo) {
    transactionSelector.storeNo = storeNo;
  }

  const accountSelector = {
    type: "account",
    state: "Active"
  };

  if (storeNo) {
    accountSelector.storeNo = storeNo;
  }

  // Promise for today's transactions
  const todayPromise = db.find({
    selector: {
      ...transactionSelector,
      createdAt: {
        $gte: today.toISOString(),
        $lte: endOfDay.toISOString()
      }
    },
    limit: 100000
  });

  // Promise for yesterday's transactions
  const yesterdayPromise = db.find({
    selector: {
      ...transactionSelector,
      createdAt: {
        $gte: yesterday.toISOString(),
        $lte: endOfYesterday.toISOString()
      }
    },
    limit: 100000
  });

  const accountsPromise = db.find({
    selector: accountSelector,
    limit: 9999
  });

  // Function to calculate transaction metrics from documents
  const calculateMetrics = (docs, accountsById) => {
    let customerCredits = 0;
    let customerCreditsCash = 0;
    let customerCreditsMpesa = 0;
    let customerCreditsNet = 0;
    let customerCreditsCashNet = 0;
    let customerCreditsMpesaNet = 0;
    let supplierPayments = 0;
    let transactionCostsCash = 0;
    let transactionCostsMpesa = 0;
    let transactionCostsTotal = 0;

    docs.forEach(transaction => {
      if (!shouldIncludeTransactionInMetrics(transaction)) {
        return;
      }

      const amount = toNumber(transaction.amount);
      const transactionCost = toNumber(transaction.transactionCost);
      const destinationMethod = transaction.destination === 'account'
        ? getAccountMethod(accountsById[transaction.to])
        : null;

      // Calculate customer credits
      if (transaction.source === 'customer') {
        customerCredits += amount;

        const netAmount = amount - transactionCost;
        customerCreditsNet += netAmount;

        if (destinationMethod === 'cash') {
          customerCreditsCash += amount;
          customerCreditsCashNet += netAmount;
          transactionCostsCash += transactionCost;
        } else if (destinationMethod === 'mpesa') {
          customerCreditsMpesa += amount;
          customerCreditsMpesaNet += netAmount;
          transactionCostsMpesa += transactionCost;
        } else {
          // Default to cash if unknown
          customerCreditsCash += amount;
          customerCreditsCashNet += netAmount;
          transactionCostsCash += transactionCost;
        }

        transactionCostsTotal += transactionCost;
      }
      // Calculate supplier payments
      if (transaction.destination === 'supplier') {
        supplierPayments += amount;
      }
    });

    return {
        customerCredits: Number(customerCredits.toFixed(2)),
        customerCreditsCash: Number(customerCreditsCash.toFixed(2)),
        customerCreditsMpesa: Number(customerCreditsMpesa.toFixed(2)),
        customerCreditsNet: Number(customerCreditsNet.toFixed(2)),
        customerCreditsCashNet: Number(customerCreditsCashNet.toFixed(2)),
        customerCreditsMpesaNet: Number(customerCreditsMpesaNet.toFixed(2)),
        supplierPayments: Number(supplierPayments.toFixed(2)),
        transactionCostsCash: Number(transactionCostsCash.toFixed(2)),
        transactionCostsMpesa: Number(transactionCostsMpesa.toFixed(2)),
        transactionCostsTotal: Number(transactionCostsTotal.toFixed(2))
    };
  };

  // Execute both promises concurrently
  return Promise.all([todayPromise, yesterdayPromise, accountsPromise])
    .then(([todayResult, yesterdayResult, accountsResult]) => {
      const accountsById = (accountsResult.docs || []).reduce((acc, account) => {
        acc[account._id] = account;
        return acc;
      }, {});

      return {
        success: true,
        data: {
          today: calculateMetrics(todayResult.docs, accountsById),
          yesterday: calculateMetrics(yesterdayResult.docs, accountsById)
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
