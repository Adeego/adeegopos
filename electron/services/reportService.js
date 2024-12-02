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

  // Promise for current period's data
  const currentPeriodPromise = db.find({
    selector: {
      createdAt: { 
        $gte: start.toISOString(), 
        $lte: end.toISOString() 
      },
      type: "sale",
      state: "Active"
    }
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
    }
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
    }
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
    }
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
    }
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
      const saleDate = new Date(sale.createdAt).toISOString().split('T')[0];
      const dayIndex = dailyData.findIndex(data => data.date === saleDate);

      if (dayIndex !== -1) {
        dailyData[dayIndex].sales += Number(sale.totalAmount) || 0;
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
    }
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
