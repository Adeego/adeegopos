// Growth Analytics Service
// Tracking period starts from 13/9/2025

const TRACKING_START_DATE = new Date('2025-09-13T00:00:00');

// Get daily sales data for current month with 7-day projections
function getMonthlySalesData(db, storeNo, startDate, endDate) {
  return db.find({
    selector: { 
      type: 'sale',
      state: 'Active',
      storeNo: storeNo, 
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
    },
    limit: 9999
  })
    .then(result => {
      const dailyData = {};
      
      result.docs.forEach(sale => {
        const date = new Date(sale.createdAt);
        const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        if (!dailyData[dayKey]) {
          dailyData[dayKey] = {
            date: dayKey,
            sales: 0,
            revenue: 0,
            numberOfSales: 0,
            isProjected: false
          };
        }
        
        dailyData[dayKey].sales += sale.totalAmount;
        dailyData[dayKey].revenue += sale.totalAmount;
        dailyData[dayKey].numberOfSales += 1;
      });
      
      // Sort by date
      const sortedData = Object.values(dailyData).sort((a, b) => 
        a.date.localeCompare(b.date)
      );
      
      // Calculate 7-day projection using linear regression
      if (sortedData.length >= 2) {
        const projectionData = calculateDailyProjections(sortedData, 7);
        sortedData.push(...projectionData);
      }
      
      return { success: true, data: sortedData };
    })
    .catch(error => {
      console.error('Error getting monthly sales data:', error);
      return { success: false, error: error.message };
    });
}

// Get weekly sales growth with projections
function getWeeklySalesGrowth(db, storeNo, startDate, endDate) {
  return db.find({
    selector: { 
      type: 'sale',
      state: 'Active',
      storeNo: storeNo, 
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
    },
    limit: 9999
  })
    .then(result => {
      const weeklyData = {};
      
      result.docs.forEach(sale => {
        const date = new Date(sale.createdAt);
        const weekKey = getWeekKey(date);
        
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = {
            week: weekKey,
            numberOfSales: 0,
            revenue: 0,
            growth: 0
          };
        }
        
        weeklyData[weekKey].numberOfSales += 1;
        weeklyData[weekKey].revenue += sale.totalAmount;
      });
      
      // Sort by week
      const sortedData = Object.values(weeklyData).sort((a, b) => 
        a.week.localeCompare(b.week)
      );
      
      // Calculate growth percentage
      sortedData.forEach((week, index) => {
        if (index > 0) {
          const previousWeek = sortedData[index - 1];
          week.growth = previousWeek.numberOfSales > 0 
            ? ((week.numberOfSales - previousWeek.numberOfSales) / previousWeek.numberOfSales) * 100 
            : 0;
        }
      });
      
      // Calculate projection for next week
      const projection = calculateProjection(sortedData, 'numberOfSales');
      
      return { success: true, data: sortedData, projection };
    })
    .catch(error => {
      console.error('Error getting weekly sales growth:', error);
      return { success: false, error: error.message };
    });
}

// Get average order value over time
function getAverageOrderValue(db, storeNo, startDate, endDate) {
  return db.find({
    selector: { 
      type: 'sale',
      state: 'Active',
      storeNo: storeNo, 
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
    },
    limit: 9999
  })
    .then(result => {
      const weeklyAOV = {};
      
      result.docs.forEach(sale => {
        const date = new Date(sale.createdAt);
        const weekKey = getWeekKey(date);
        
        if (!weeklyAOV[weekKey]) {
          weeklyAOV[weekKey] = {
            week: weekKey,
            totalRevenue: 0,
            numberOfSales: 0,
            averageOrderValue: 0
          };
        }
        
        weeklyAOV[weekKey].totalRevenue += sale.totalAmount;
        weeklyAOV[weekKey].numberOfSales += 1;
      });
      
      // Calculate average order value
      Object.values(weeklyAOV).forEach(week => {
        week.averageOrderValue = week.numberOfSales > 0 
          ? week.totalRevenue / week.numberOfSales 
          : 0;
      });
      
      // Sort by week
      const sortedData = Object.values(weeklyAOV).sort((a, b) => 
        a.week.localeCompare(b.week)
      );
      
      return { success: true, data: sortedData };
    })
    .catch(error => {
      console.error('Error getting average order value:', error);
      return { success: false, error: error.message };
    });
}

// Get weekly sales bar graph data
function getWeeklySalesBarData(db, storeNo, startDate, endDate) {
  return db.find({
    selector: { 
      type: 'sale',
      state: 'Active',
      storeNo: storeNo, 
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
    },
    limit: 9999
  })
    .then(result => {
      const weeklyData = {};
      
      result.docs.forEach(sale => {
        const date = new Date(sale.createdAt);
        const weekKey = getWeekKey(date);
        
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = {
            week: weekKey,
            sales: 0,
            numberOfSales: 0
          };
        }
        
        weeklyData[weekKey].sales += sale.totalAmount;
        weeklyData[weekKey].numberOfSales += 1;
      });
      
      // Sort by week
      const sortedData = Object.values(weeklyData).sort((a, b) => 
        a.week.localeCompare(b.week)
      );
      
      return { success: true, data: sortedData };
    })
    .catch(error => {
      console.error('Error getting weekly sales bar data:', error);
      return { success: false, error: error.message };
    });
}

// Get top 50 performing products
function getTopPerformingProducts(db, storeNo, startDate, endDate, limit = 50) {
  return db.find({
    selector: { 
      type: 'sale',
      state: 'Active',
      storeNo: storeNo, 
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
    },
    limit: 9999
  })
    .then(result => {
      const productSales = {};
      
      result.docs.forEach(sale => {
        sale.items.forEach(item => {
          const productId = item.productVariant?.product?._id || item.productId;
          const productName = item.productVariant?.product?.name || item.name;
          
          if (!productSales[productId]) {
            productSales[productId] = {
              productId,
              productName,
              quantitySold: 0,
              totalRevenue: 0,
              numberOfSales: 0
            };
          }
          
          productSales[productId].quantitySold += item.quantity;
          productSales[productId].totalRevenue += item.subtotal;
          productSales[productId].numberOfSales += 1;
        });
      });
      
      // Sort by total revenue and get top performers
      const sortedProducts = Object.values(productSales)
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, limit);
      
      return { success: true, data: sortedProducts };
    })
    .catch(error => {
      console.error('Error getting top performing products:', error);
      return { success: false, error: error.message };
    });
}

// Get weekly average gross margin
function getWeeklyGrossMargin(db, storeNo, startDate, endDate) {
  return db.find({
    selector: { 
      type: 'sale',
      state: 'Active',
      storeNo: storeNo, 
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
    },
    limit: 9999
  })
    .then(result => {
      const weeklyMargin = {};
      
      result.docs.forEach(sale => {
        const date = new Date(sale.createdAt);
        const weekKey = getWeekKey(date);
        
        if (!weeklyMargin[weekKey]) {
          weeklyMargin[weekKey] = {
            week: weekKey,
            totalRevenue: 0,
            totalCost: 0,
            grossMargin: 0,
            marginPercentage: 0
          };
        }
        
        sale.items.forEach(item => {
          const revenue = item.subtotal;
          const cost = item.quantity * (item.buyPrice || 0) * (item.productVariant?.conversionFactor || 1);
          
          weeklyMargin[weekKey].totalRevenue += revenue;
          weeklyMargin[weekKey].totalCost += cost;
        });
      });
      
      // Calculate gross margin and percentage
      Object.values(weeklyMargin).forEach(week => {
        week.grossMargin = week.totalRevenue - week.totalCost;
        week.marginPercentage = week.totalRevenue > 0 
          ? (week.grossMargin / week.totalRevenue) * 100 
          : 0;
      });
      
      // Sort by week
      const sortedData = Object.values(weeklyMargin).sort((a, b) => 
        a.week.localeCompare(b.week)
      );
      
      return { success: true, data: sortedData };
    })
    .catch(error => {
      console.error('Error getting weekly gross margin:', error);
      return { success: false, error: error.message };
    });
}

// Helper function to get week key (year-week format) - Week starts on Saturday
function getWeekKey(date) {
  const year = date.getFullYear();
  const weekNumber = getWeekNumber(date);
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

// Helper function to get week number (Saturday-Friday weeks)
function getWeekNumber(date) {
  // Clone the date to avoid modifying the original
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  // Get day of week (0 = Sunday, 6 = Saturday)
  const dayOfWeek = d.getDay();
  
  // Calculate days since last Saturday
  // If today is Saturday (6), daysSinceSaturday = 0
  // If today is Sunday (0), daysSinceSaturday = 1
  // If today is Friday (5), daysSinceSaturday = 6
  const daysSinceSaturday = (dayOfWeek + 1) % 7;
  
  // Get the Saturday of this week
  const saturday = new Date(d);
  saturday.setDate(d.getDate() - daysSinceSaturday);
  
  // Get the first Saturday of the year
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const firstSaturday = new Date(yearStart);
  const daysUntilSaturday = (6 - yearStart.getDay() + 7) % 7;
  firstSaturday.setDate(yearStart.getDate() + daysUntilSaturday);
  
  // If current date is before first Saturday, it belongs to previous year's last week
  if (saturday < firstSaturday) {
    return getWeekNumber(new Date(d.getFullYear() - 1, 11, 31));
  }
  
  // Calculate week number
  const weekNo = Math.floor((saturday - firstSaturday) / (7 * 24 * 60 * 60 * 1000)) + 1;
  
  return weekNo;
}

// Helper function to calculate projection using simple linear regression
function calculateProjection(data, key) {
  if (data.length < 2) {
    return null;
  }
  
  const n = data.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  
  data.forEach((item, index) => {
    sumX += index;
    sumY += item[key];
    sumXY += index * item[key];
    sumX2 += index * index;
  });
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Project next value
  const nextValue = slope * n + intercept;
  
  return {
    projectedValue: Math.max(0, nextValue),
    trend: slope > 0 ? 'up' : slope < 0 ? 'down' : 'stable',
    growthRate: data.length > 1 ? ((data[data.length - 1][key] - data[0][key]) / data[0][key]) * 100 : 0
  };
}

// Helper function to calculate daily projections for the next N days
function calculateDailyProjections(data, days) {
  if (data.length < 2) {
    return [];
  }
  
  const n = data.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  
  data.forEach((item, index) => {
    sumX += index;
    sumY += item.sales;
    sumXY += index * item.sales;
    sumX2 += index * index;
  });
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Generate projections for next N days
  const projections = [];
  const lastDate = new Date(data[data.length - 1].date);
  
  for (let i = 1; i <= days; i++) {
    const projectedValue = Math.max(0, slope * (n + i - 1) + intercept);
    const nextDate = new Date(lastDate);
    nextDate.setDate(lastDate.getDate() + i);
    
    projections.push({
      date: `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`,
      sales: projectedValue,
      revenue: projectedValue,
      numberOfSales: Math.round(projectedValue / (data.reduce((sum, d) => sum + d.sales, 0) / data.reduce((sum, d) => sum + d.numberOfSales, 0))),
      isProjected: true
    });
  }
  
  return projections;
}

// Get comprehensive growth metrics
function getGrowthMetrics(db, storeNo) {
  const endDate = new Date();
  const startDate = new Date(Math.max(TRACKING_START_DATE.getTime(), endDate.getTime() - 90 * 24 * 60 * 60 * 1000)); // Last 90 days or tracking start
  
  return Promise.all([
    getMonthlySalesData(db, storeNo, startDate, endDate),
    getWeeklySalesGrowth(db, storeNo, startDate, endDate),
    getAverageOrderValue(db, storeNo, startDate, endDate),
    getWeeklySalesBarData(db, storeNo, startDate, endDate),
    getTopPerformingProducts(db, storeNo, startDate, endDate),
    getWeeklyGrossMargin(db, storeNo, startDate, endDate)
  ])
    .then(([monthly, weekly, aov, weeklySales, topProducts, margin]) => {
      return {
        success: true,
        data: {
          dailySales: monthly.data || [],
          weeklySalesGrowth: weekly.data || [],
          weeklyProjection: weekly.projection,
          averageOrderValue: aov.data || [],
          weeklySales: weeklySales.data || [],
          topProducts: topProducts.data || [],
          weeklyGrossMargin: margin.data || []
        }
      };
    })
    .catch(error => {
      console.error('Error getting growth metrics:', error);
      return { success: false, error: error.message };
    });
}

module.exports = {
  getMonthlySalesData,
  getWeeklySalesGrowth,
  getAverageOrderValue,
  getWeeklySalesBarData,
  getTopPerformingProducts,
  getWeeklyGrossMargin,
  getGrowthMetrics
};
