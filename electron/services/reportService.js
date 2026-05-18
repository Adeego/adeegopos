const {
  getSaleNetAmount,
  getSaleNetCost,
  getSalePaymentBreakdown,
  shouldIncludeSaleInMetrics,
  shouldIncludeTransactionInMetrics,
  toNumber,
} = require('./postingService');

// Function to get sales metrics for a specific date range
function getSalesMetricsReport(db, fromDate, toDate) {
  // Ensure dates are Date objects
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(23, 59, 59, 999);

  // Previous period for comparison
  const periodDuration = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - periodDuration);
  const prevEnd = new Date(end.getTime() - periodDuration);

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

  // Promise for current period's data
  const currentPeriodPromise = db.find({
    selector: {
      createdAt: { 
        $gte: start.toISOString(), 
        $lte: end.toISOString() 
      },
      type: "sale",
      state: "Active"
    },
    limit: 100000
  });

  // Promise for previous period's data
  const previousPeriodPromise = db.find({
    selector: {
      createdAt: { 
        $gte: prevStart.toISOString(), 
        $lte: prevEnd.toISOString() 
      },
      type: "sale",
      state: "Active"
    },
    limit: 100000
  });

  // Execute both promises concurrently
  return Promise.all([currentPeriodPromise, previousPeriodPromise])
    .then(([currentResult, previousResult]) => {
      return {
        success: true,
        data: {
          currentPeriod: calculateMetrics(currentResult.docs),
          previousPeriod: calculateMetrics(previousResult.docs)
        }
      };
    })
    .catch(error => {
      console.error('Error getting sales metrics:', error);
      return { success: false, error: error.message };
    });
}

// Function to get expenses for a specific date range
function getExpensesReport(db, fromDate, toDate) {
  // Ensure dates are Date objects
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(23, 59, 59, 999);

  // Previous period for comparison
  const periodDuration = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - periodDuration);
  const prevEnd = new Date(end.getTime() - periodDuration);

  // Promise for current period's expenses
  const currentPeriodPromise = db.find({
    selector: {
      createdAt: {
        $gte: start.toISOString(),
        $lte: end.toISOString()
      },
      type: "expense",
      state: "Active"
    },
    limit: 100000
  });

  // Promise for previous period's expenses
  const previousPeriodPromise = db.find({
    selector: {
      createdAt: {
        $gte: prevStart.toISOString(),
        $lte: prevEnd.toISOString()
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
  return Promise.all([currentPeriodPromise, previousPeriodPromise])
    .then(([currentResult, previousResult]) => {
      return {
        success: true,
        data: {
          currentPeriod: {
            totalExpenses: calculateTotalExpenses(currentResult.docs)
          },
          previousPeriod: {
            totalExpenses: calculateTotalExpenses(previousResult.docs)
          }
        }
      };
    })
    .catch(error => {
      console.error('Error getting expenses:', error);
      return { success: false, error: error.message };
    });
}

// Function to get daily sales data for a specific date range
function getDailySalesReport(db, fromDate, toDate) {
  // Ensure dates are Date objects
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(23, 59, 59, 999);

  return db.find({
    selector: {
      createdAt: {
        $gte: start.toISOString(),
        $lte: end.toISOString()
      },
      type: "sale",
      state: "Active"
    },
    limit: 100000
  }).then(result => {
    // Initialize daily sales data
    const dailyData = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      dailyData.push({
        date: currentDate.toISOString().split('T')[0], // YYYY-MM-DD format
        sales: 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Aggregate sales by day
    result.docs.forEach(sale => {
      if (!shouldIncludeSaleInMetrics(sale)) {
        return;
      }

      const saleDate = new Date(sale.createdAt).toISOString().split('T')[0];
      const dayIndex = dailyData.findIndex(data => data.date === saleDate);

      if (dayIndex !== -1) {
        dailyData[dayIndex].sales += getSaleNetAmount(sale);
      }
    });
    return {
      success: true,
      data: dailyData
    };
  }).catch(error => {
    console.error('Error getting daily sales data:', error);
    return { success: false, error: error.message };
  });
}

// Function to get transaction metrics for a specific date range
function getTransactionMetricsReport(db, fromDate, toDate) {
  // Ensure dates are Date objects
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(23, 59, 59, 999);

  // Previous period for comparison
  const periodDuration = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - periodDuration);
  const prevEnd = new Date(end.getTime() - periodDuration);

  // Promise for current period's transactions
  const currentPeriodPromise = db.find({
    selector: {
      createdAt: {
        $gte: start.toISOString(),
        $lte: end.toISOString()
      },
      type: "transaction", 
      state: "Active"
    },
    limit: 100000
  });

  // Promise for previous period's transactions
  const previousPeriodPromise = db.find({
    selector: {
      createdAt: {
        $gte: prevStart.toISOString(),
        $lte: prevEnd.toISOString()
      },
      type: "transaction",
      state: "Active"
    },
    limit: 100000
  });

  // Function to calculate transaction metrics from documents
  const calculateMetrics = (docs) => {
    let customerCredits = 0;
    let supplierPayments = 0;

    docs.forEach(transaction => {
      if (!shouldIncludeTransactionInMetrics(transaction)) {
        return;
      }

      // Calculate customer credits
      if (transaction.source === 'customer') {
        customerCredits += toNumber(transaction.amount);
      }
      // Calculate supplier payments
      if (transaction.destination === 'supplier') {
        supplierPayments += toNumber(transaction.amount);
      }
    });

    return {
        customerCredits: Number(customerCredits.toFixed(2)),
        supplierPayments: Number(supplierPayments.toFixed(2))
    };
  };

  // Execute both promises concurrently
  return Promise.all([currentPeriodPromise, previousPeriodPromise])
    .then(([currentResult, previousResult]) => {
      return {
        success: true,
        data: {
          currentPeriod: calculateMetrics(currentResult.docs),
          previousPeriod: calculateMetrics(previousResult.docs)
        }
      };
    })
    .catch(error => {
      console.error('Error getting transaction metrics:', error);
      return { success: false, error: error.message };
    });
}

module.exports = {
  getSalesMetricsReport,
  getExpensesReport,
  getDailySalesReport,
  getTransactionMetricsReport,
};
