const { printReceipt } = require('./printerService');

// Create a sale
function createSale(db, saleData) {
  const sale = {
    _id: saleData._id,
    type: 'sale',
    customerId: saleData.customerId,
    items: saleData.items.map((item) => ({
     _id: item._id,
     productId: item.productId,
     name: item.name,
     buyPrice: item.buyPrice,
     unitPrice: item.unitPrice,
     quantity: item.quantity,
     subtotal: item.subtotal,
     discount: item.discount,
     conversionFactor: item.conversionFactor,
    })),
    totalAmount: saleData.totalAmount,
    totalItems: saleData.totalItems,
    totalDiscount: saleData.totalDiscount,
    servedBy: saleData.servedBy,
    amountPaid: saleData.amountPaid,
    change: saleData.change,
    note: saleData.note || '',
    paymentMethod: saleData.paymentMethod,
    saleType: saleData.saleType,
    fullfilmentType: saleData.fullfilmentType,
    confirmed: saleData.confirmed,
    storeNo: saleData.storeNo,
    state: 'Active',
    createdAt: saleData.createdAt,
    updatedAt: saleData.updatedAt,
  };

  // Function to update stock based on sale type
  const updateStock = (saleType, items) => {
    const updates = items.map(item => {
      return db.get(item.productId)
        .then(product => {
          let stockChange;
          if (saleType === 'NEW SALE') {
            stockChange = -(item.conversionFactor * item.quantity);
          } else if (saleType === 'RETURN SALE') {
            stockChange = (item.conversionFactor * item.quantity);
          }
          const updatedProduct = { ...product, stock: product.stock + stockChange };
          return db.put(updatedProduct);
        });
    });
    return Promise.all(updates);
  };

  // Function to update customer balance for credit sales
  const updateCustomerBalance = () => {
    if (saleData.paymentMethod === 'CREDIT' && saleData.customerId) {
      return db.get(saleData.customerId)
        .then(customer => {
          const updatedCustomer = {
            ...customer,
            balance: (customer.balance || 0) - saleData.totalAmount
          };
          return db.put(updatedCustomer);
        })
              .catch(error => {
          console.error('Error updating customer balance:', error);
          throw error;
              });
    }
    return Promise.resolve();
  };
  
  const UpdateAccountBalance = () => {
    return db
    .find({
      selector: { 
        type: "account",
        state: "Active"
      },
    })
    .then((response) => {
      // Filter the response to remain with Cash or Mpesa
      const filteredAccounts = response.docs.filter(account => account.name === saleData.paymentMethod);
      
      // If no matching account found, resolve without changes
      if (filteredAccounts.length === 0) {
        return Promise.resolve();
    }
      
      // Get the first (and should be only) matching account
      const matchingAccount = filteredAccounts[0];
      
      // Determine balance change based on sale type
      let balanceChange;
      if (saleData.saleType === 'NEW SALE') {
        balanceChange = saleData.totalAmount;
      } else if (saleData.saleType === 'RETURN SALE') {
        balanceChange = -saleData.totalAmount;
      } else {
        return Promise.resolve(); // If neither type, resolve without changes
      }
      // Update the account balance
      const updatedAccount = {
        ...matchingAccount,
        balance: (matchingAccount.balance || 0) + balanceChange
      };
      
      // Save the updated account back to the database
      return db.put(updatedAccount);
    })
    .catch(error => {
      console.error('Error updating account balance:', error);
      throw error;
    });
  };

  return db.put(sale)
    .then(response => {
      const createdSale = { _id: response.id, ...sale };

      // Chain all necessary updates
      return updateCustomerBalance()
        .then(() => UpdateAccountBalance()) // Added UpdateAccountBalance here
        .then(() => {
          // Update stock if it's a new sale or return
          if (saleData.saleType === 'NEW SALE' || saleData.saleType === 'RETURN SALE') {
            return updateStock(saleData.saleType, saleData.items)
              .then(() => {
                // Print receipt after successful updates
        return printReceipt(createdSale)
          .then(() => ({ success: true, sale: createdSale }))
          .catch(error => {
            console.error('Receipt printing failed:', error);
            return { success: true, sale: createdSale, receiptError: error.message };
          });
        })
              .catch(error => {
                console.error('Error updating stock:', error);
                return { success: true, sale: createdSale, stockUpdateError: error.message };
              });
          } else {
            // If no stock update is needed, just print the receipt
            return printReceipt(createdSale)
              .then(() => ({ success: true, sale: createdSale }))
              .catch(error => {
                console.error('Receipt printing failed:', error);
                return { success: true, sale: createdSale, receiptError: error.message };
              });
}
        })
        .catch(error => {
          console.error('Error processing sale:', error);
          return { success: false, error: error.message };
        });
    })
    .catch(error => ({ success: false, error: error.message }));
}
                                                                     
// Query all products in a specific sale                             
function getSaleProducts(db, saleId) {                               
  return db.get(saleId)                                              
    .then(sale => sale.products)                                     
    .catch(error => {                                                
      console.error('Error fetching sale products:', error);         
      return { success: false, error: error.message };               
    });                                                              
}                                                                    
                                                                     
// Function to get the number of sales grouped by payment methods fr date1 to date2                                                       
function getSalesByPaymentMethod(db, date1, date2) {                 
  return db.find({                                                   
    selector: { createdAt: { $gte: new Date(date1), $lte: new Date(date2) } }                                                    
  })                                                                 
    .then(result => {                                                
      const groupedSales = {                                         
        cash: { pmethod: "CASH", sales: 0, totalAmount: 0 },         
        credit: { pmethod: "CREDIT", sales: 0, totalAmount: 0 },     
        mpesa: { pmethod: "MPESA", sales: 0, totalAmount: 0 }        
      };                                                             
                                                                     
      result.docs.forEach(sale => {                                  
        const method = sale.paymentMethod.toLowerCase();             
        if (groupedSales[method]) {                                  
          groupedSales[method].sales++;                              
          groupedSales[method].totalAmount += sale.totalAmount;      
        }                                                            
      });                                                            
                                                                     
      return { success: true, data: Object.values(groupedSales) };   
    })                                                               
    .catch(error => {                                                
      console.error('Error getting sales by payment method:', error) 
      return { success: false, error: error.message };               
    });                                                              
}                                                                    
                                                                     
// Total sales for a given time period                               
function getTotalSales(db, startDate, endDate) {                     
  return db.find({                                                   
    selector: { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } }                                                    
  })                                                                 
    .then(result => {                                                
      const totalSales = result.docs.reduce((sum, sale) => sum + sale.totalAmount, 0);                                                
      return { success: true, data: totalSales };                    
    })                                                               
    .catch(error => {                                                
      console.error('Error getting total sales:', error);            
      return { success: false, error: error.message };               
    });                                                              
}                                                                    
                                                                     
// Average transaction value for a given time period                 
function getAverageTransactionValue(db, startDate, endDate) {        
  return db.find({                                                   
    selector: { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } }                                                    
  })                                                                 
    .then(result => {                                                
      const totalSales = result.docs.reduce((sum, sale) => sum + sale.totalAmount, 0);                                                
      const averageValue = totalSales / result.docs.length;          
      return { success: true, data: averageValue };                  
    })                                                               
    .catch(error => {                                                
      console.error('Error getting average transaction value:', error);                                                              
      return { success: false, error: error.message };               
    });                                                              
}                                                                    
                                                                     
// Sales by product category for a given time period                 
function getSalesByCategory(db, startDate, endDate) {                
  return db.find({                                                   
    selector: { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } }                                                    
  })                                                                 
    .then(result => {                                                
      const categoryTotals = {};                                     
                                                                     
      result.docs.forEach(sale => {                                  
        sale.items.forEach(item => {                                 
          const category = item.productVariant.product.category;     
          if (!categoryTotals[category]) {                           
            categoryTotals[category] = 0;                            
          }                                                          
          categoryTotals[category] += item.subtotal;                 
        });                                                          
      });                                                            
                                                                     
      return { success: true, data: categoryTotals };                
    })                                                               
    .catch(error => {                                                
      console.error('Error getting sales by category:', error);      
      return { success: false, error: error.message };               
    });                                                              
}                                                                    
                                                                     
// Top-selling items for a given time period                         
function getTopSellingItems(db, startDate, endDate, limit = 10) {    
  return db.find({                                                   
    selector: { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } }                                                    
  })                                                                 
    .then(result => {                                                
      const itemSales = {};                                          
                                                                     
      result.docs.forEach(sale => {                                  
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
    })                                                               
    .catch(error => {                                                
      console.error('Error getting top-selling items:', error);      
      return { success: false, error: error.message };               
    });                                                              
}                                                                    
                                                                     
// Gross profit margin for a given time period                       
function getGrossProfitMargin(db, startDate, endDate) {              
  return db.find({                                                   
    selector: { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } }                                                    
  })                                                                 
    .then(result => {                                                
      let totalRevenue = 0;                                          
      let totalCost = 0;                                             
                                                                     
      result.docs.forEach(sale => {                                  
        sale.items.forEach(item => {                                 
          totalRevenue += item.subtotal;                             
          totalCost += item.quantity * item.productVariant.product.buyPrice * item.productVariant.conversionFactor;                                
        });                                                          
      });                                                            
                                                                     
      const grossProfit = totalRevenue - totalCost;                  
      const grossProfitMargin = (grossProfit / totalRevenue) * 100;  
                                                                     
      return { success: true, data: grossProfitMargin };             
    })                                                               
    .catch(error => {                                                
      console.error('Error calculating gross profit margin:', error) 
      return { success: false, error: error.message };               
    });                                                              
}                                                                    
                                                                     
// Function to get total sales, revenue, and gross profit            
function getTotalSalesRevenueAndProfit(db, startDate, endDate) {     
  return db.find({                                                   
    selector: { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } }                                                    
  })                                                                 
    .then(result => {                                                
      let totalSales = 0;                                            
      let totalRevenue = 0;                                          
      let totalCost = 0;                                             
                                                                     
      result.docs.forEach(sale => {                                  
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
    })                                                               
    .catch(error => {                                                
      console.error('Error getting total sales, revenue, and profit: error');                                                              
      return { success: false, error: error.message };               
    });                                                              
}                                                                    
                                                                     
// Function to get top customers for a given time period             
function getTopCustomers(db, startDate, endDate, limit = 10) {       
  return db.find({                                                   
    selector: { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } }})                                                                 
    .then(result => {                                                
      const customerSales = {};                                      
                                                                     
      result.docs.forEach(sale => {                                  
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
    })                                                               
    .catch(error => {                                                
      console.error('Error getting top customers:', error);          
      return { success: false, error: error.message };               
    });                                                              
}                                                                    
                                                                     
// Function to get all sales between two dates                       
function getAllSalesBetweenDates(db, startDate, endDate) {           
  // Ensure the index exists
  return db.createIndex({
    index: {
      fields: ['createdAt', 'type', 'state']
    }
  }).then(() => {
    return db.find({                                                   
      selector: {
        createdAt: { $gte: new Date(startDate).toISOString(), $lte: new Date(endDate).toISOString() },
        type: "sale",
        state: "Active"
      },
      sort: [{ createdAt: 'desc' }]
    });
  }).then(result => {
    console.log('Query result:', result);
    if (result.docs.length === 0) {
      console.log('No sales found for the given date range');
    }
    return { success: true, data: result.docs };               
  }).catch(error => {                                                
    console.error('Error getting sales between dates:', error);    
    return { success: false, error: error.message };               
  });                                                              
}                                                                    
                                                                     
// Function to get a specific sale by ID                             
function getSaleById(db, saleId) {
  return db.get(saleId)
    .then(sale => {
      console.log(sale)
      return { success: true, data: sale };
    })
    .catch(error => ({ success: false, error: error.message }));
}

// Archive a sale
function archiveSale(db, saleId) {
  return db
    .get(saleId)
    .then((sale) => {
      // Update the state field to "Inactive"
      sale.state = "Inactive";
      return db.put(sale);
    })
    .then((response) => ({ success: true, sale: { _id: response.id, status: "Inactive" } }))
    .catch((error) => ({ success: false, error: error.message }));
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
  archiveSale,                                                     
};
