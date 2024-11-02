// Function to get today's sales metrics including revenue, number of sales, and profit
function getTodaysSalesMetrics(db) {
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
    let totalRevenue = 0;
    let totalCost = 0;
    let customerCredit = 0;
    const numberOfSales = result.docs.length;

    result.docs.forEach(sale => {
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
      success: true,
      data: {
        revenue: Number(totalRevenue.toFixed(2)),
        numberOfSales,
        profit: Number(profit.toFixed(2)),
        customerCredit: Number(customerCredit.toFixed(2))
      }
    };
  }).catch(error => {
    console.error('Error getting today\'s sales metrics:', error);
    return { success: false, error: error.message };
  });
}

// Function to get today's total expenses
function getTodaysExpenses(db) {
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
      type: "expense",
      state: "Active"
    }
  }).then(result => {
    let totalExpenses = 0;

    result.docs.forEach(expense => {
      totalExpenses += Number(expense.amount) || 0;
    });

    return {
      success: true,
      data: {
        totalExpenses: Number(totalExpenses.toFixed(2))
      }
    };
  }).catch(error => {
    console.error('Error getting today\'s expenses:', error);
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

  return db.find({
    selector: {
      createdAt: {
        $gte: today.toISOString(),
        $lte: endOfDay.toISOString()
      },
      type: "transaction",
      state: "Active"
    }
  }).then(result => {
    let customerCredits = 0;
    let supplierPayments = 0;

    result.docs.forEach(transaction => {
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
      success: true,
      data: {
        customerCredits: Number(customerCredits.toFixed(2)),
        supplierPayments: Number(supplierPayments.toFixed(2))
      }
    };
  }).catch(error => {
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
