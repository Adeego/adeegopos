// Create a sale
function createSale(realm, saleData) {
  try {
    let newSale;
    realm.write(() => {
      const customer = realm.objectForPrimaryKey('Customer', saleData.customerId);
      newSale = realm.create('Sale', {
        _id: saleData._id,
        customer: customer,
        items: [],
        totalAmount: saleData.totalAmount,
        totalItems: saleData.totalItems,
        paymentMethod: saleData.paymentMethod,
        type: saleData.type,
        paid: saleData.paid,
        createdAt: saleData.createdAt,
        updatedAt: saleData.updatedAt,
      });

      saleData.items.forEach(itemData => {
        const productVariant = realm.objectForPrimaryKey('ProductVariant', itemData.productVariantId);
        const saleItem = realm.create('SaleItem', {
          _id: itemData._id,
          sale: newSale,
          productVariant: productVariant,
          quantity: itemData.quantity,
          unitPrice: itemData.unitPrice,
          subtotal: itemData.subtotal,
          discount: itemData.discount,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        newSale.items.push(saleItem);

        // Update product stock
        const stockReduction = productVariant.conversionFactor * itemData.quantity;
        productVariant.product.stock -= stockReduction;
      });

      // Update customer balance if applicable
      if (!saleData.paid) {
        customer.balance += saleData.totalAmount;
      }

      // Add the sale to the customer's sales list
      customer.sales.push(newSale);
    });

    return { success: true, sale: newSale.toJSON() };
  } catch (error) {
    console.error('Error creating sale:', error);
    return { success: false, error: error.message };
  }
}

// Query all products in a specific sale
function getSaleProducts(realm, saleId) {
  const sale = realm.objectForPrimaryKey('Sale', saleId);
  return sale.products;
}

// Function to get the number of sales grouped by payment methods from date1 to date2
function getSalesByPaymentMethod(realm, date1, date2) {
  try {
    const sales = realm.objects('Sale').filtered('createdAt >= $0 && createdAt <= $1', new Date(date1), new Date(date2));

    const groupedSales = {
      cash: { pmethod: "CASH", sales: 0, totalAmount: 0 },
      credit: { pmethod: "CREDIT", sales: 0, totalAmount: 0 },
      mpesa: { pmethod: "MPESA", sales: 0, totalAmount: 0 }
    };

    sales.forEach(sale => {
      const method = sale.paymentMethod.toLowerCase();
      if (groupedSales[method]) {
        groupedSales[method].sales++;
        groupedSales[method].totalAmount += sale.totalAmount;
      }
    });

    // Convert the object to an array
    const result = Object.values(groupedSales);

    return { success: true, data: result };
  } catch (error) {
    console.error('Error getting sales by payment method:', error);
    return { success: false, error: error.message };
  }
}

// Total sales for a given time period
function getTotalSales(realm, startDate, endDate) {
  try {
    const sales = realm.objects('Sale').filtered('createdAt >= $0 && createdAt <= $1', new Date(startDate), new Date(endDate));
    const totalSales = sales.sum('totalAmount');
    return { success: true, data: totalSales };
  } catch (error) {
    console.error('Error getting total sales:', error);
    return { success: false, error: error.message };
  }
}

// Average transaction value for a given time period
function getAverageTransactionValue(realm, startDate, endDate) {
  try {
    const sales = realm.objects('Sale').filtered('createdAt >= $0 && createdAt <= $1', new Date(startDate), new Date(endDate));
    const totalSales = sales.sum('totalAmount');
    const averageValue = totalSales / sales.length;
    return { success: true, data: averageValue };
  } catch (error) {
    console.error('Error getting average transaction value:', error);
    return { success: false, error: error.message };
  }
}

// Sales by product category for a given time period
function getSalesByCategory(realm, startDate, endDate) {
  try {
    const sales = realm.objects('Sale').filtered('createdAt >= $0 && createdAt <= $1', new Date(startDate), new Date(endDate));
    const categoryTotals = {};

    sales.forEach(sale => {
      sale.items.forEach(item => {
        const category = item.productVariant.product.category;
        if (!categoryTotals[category]) {
          categoryTotals[category] = 0;
        }
        categoryTotals[category] += item.subtotal;
      });
    });

    return { success: true, data: categoryTotals };
  } catch (error) {
    console.error('Error getting sales by category:', error);
    return { success: false, error: error.message };
  }
}

// Top-selling items for a given time period
function getTopSellingItems(realm, startDate, endDate, limit = 10) {
  try {
    const sales = realm.objects('Sale').filtered('createdAt >= $0 && createdAt <= $1', new Date(startDate), new Date(endDate));
    const itemSales = {};

    sales.forEach(sale => {
      sale.items.forEach(item => {
        const productId = item.productVariant.product._id;
        if (!itemSales[productId]) {
          itemSales[productId] = { 
            productName: item.productVariant.product.name, 
            quantity: 0, 
            totalSales: 0 
          };
        }
        itemSales[productId].quantity += item.quantity;
        itemSales[productId].totalSales += item.subtotal;
      });
    });

    const sortedItems = Object.values(itemSales).sort((a, b) => b.totalSales - a.totalSales).slice(0, limit);
    return { success: true, data: sortedItems };
  } catch (error) {
    console.error('Error getting top-selling items:', error);
    return { success: false, error: error.message };
  }
}

// Gross profit margin for a given time period
function getGrossProfitMargin(realm, startDate, endDate) {
  try {
    const sales = realm.objects('Sale').filtered('createdAt >= $0 && createdAt <= $1', new Date(startDate), new Date(endDate));
    let totalRevenue = 0;
    let totalCost = 0;

    sales.forEach(sale => {
      sale.items.forEach(item => {
        totalRevenue += item.subtotal;
        totalCost += item.quantity * item.productVariant.product.buyPrice * item.productVariant.conversionFactor;
      });
    });

    const grossProfit = totalRevenue - totalCost;
    const grossProfitMargin = (grossProfit / totalRevenue) * 100;

    return { success: true, data: grossProfitMargin };
  } catch (error) {
    console.error('Error calculating gross profit margin:', error);
    return { success: false, error: error.message };
  }
}

// Function to get total sales, revenue, and gross profit
function getTotalSalesRevenueAndProfit(realm, startDate, endDate) {
  try {
    // Ensure startDate and endDate are valid Date objects
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date range');
    }

    const sales = realm.objects('Sale').filtered('createdAt >= $0 && createdAt <= $1', start, end);
    let totalSales = 0;
    let totalRevenue = 0;
    let totalCost = 0;

    sales.forEach(sale => {
      totalSales++;
      totalRevenue += Number(sale.totalAmount) || 0;
      sale.items.forEach(item => {
        const quantity = Number(item.quantity) || 0;
        const buyPrice = Number(item.productVariant.product.buyPrice) || 0;
        const conversionFactor = Number(item.productVariant.conversionFactor) || 1;
        totalCost += quantity * buyPrice * conversionFactor;
      });
    });

    const grossProfit = totalRevenue - totalCost;

    return {
      success: true,
      data: {
        totalSales,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        grossProfit: Number(grossProfit.toFixed(2))
      }
    };
  } catch (error) {
    console.error('Error getting total sales, revenue, and profit:', error);
    return { success: false, error: error.message };
  }
}

// Function to get top customers for a given time period
function getTopCustomers(realm, startDate, endDate, limit = 10) {
  try {
    const sales = realm.objects('Sale').filtered('createdAt >= $0 && createdAt <= $1', new Date(startDate), new Date(endDate));
    const customerSales = {};

    sales.forEach(sale => {
      const customerId = sale.customer._id;
      if (!customerSales[customerId]) {
        customerSales[customerId] = { 
          customerName: sale.customer.name, 
          totalSales: 0,
          totalAmount: 0
        };
      }
      customerSales[customerId].totalSales++;
      customerSales[customerId].totalAmount += sale.totalAmount;
    });

    const sortedCustomers = Object.values(customerSales)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, limit);

    return { success: true, data: sortedCustomers };
  } catch (error) {
    console.error('Error getting top customers:', error);
    return { success: false, error: error.message };
  }
}

// Function to get all sales between two dates
function getAllSalesBetweenDates(realm, startDate, endDate) {
  try {
    const sales = realm.objects('Sale')
      .filtered('createdAt >= $0 && createdAt <= $1', new Date(startDate), new Date(endDate))
      .sorted('createdAt', true);

    const serializedSales = sales.map(sale => ({
      _id: sale._id,
      customerName: sale.customer.name,
      totalAmount: sale.totalAmount,
      totalItems: sale.totalItems,
      paymentMethod: sale.paymentMethod,
      type: sale.type,
      paid: sale.paid,
      createdAt: sale.createdAt,
    }));

    return { success: true, data: serializedSales };
  } catch (error) {
    console.error('Error getting sales between dates:', error);
    return { success: false, error: error.message };
  }
}

// Function to get a specific sale by ID
function getSaleById(realm, saleId) {
  try {
    const sale = realm.objectForPrimaryKey('Sale', saleId);
    if (!sale) {
      return { success: false, error: 'Sale not found' };
    }
    
    const serializedSale = {
      _id: sale._id,
      customerName: sale.customer.name,
      totalAmount: sale.totalAmount,
      totalItems: sale.totalItems,
      paymentMethod: sale.paymentMethod,
      type: sale.type,
      paid: sale.paid,
      createdAt: sale.createdAt,
      items: sale.items.map(item => ({
        _id: item._id,
        productName: item.productVariant.product.name,
        variantName: item.productVariant.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        discount: item.discount,
      }))
    };

    return { success: true, data: serializedSale };
  } catch (error) {
    console.error('Error getting sale by ID:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
    createSale,
    getSaleProducts,
    getSalesByPaymentMethod,
    getTotalSales,
    getAverageTransactionValue,
    getSalesByCategory,
    getTopSellingItems,
    getGrossProfitMargin,
    getTotalSalesRevenueAndProfit,
    getTopCustomers,
    getAllSalesBetweenDates,
    getSaleById,
};
