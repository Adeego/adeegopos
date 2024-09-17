 // Create a sale                                                     
 function createSale(db, saleData) {
   const sale = {
     _id: `sale_${saleData._id}`,
     type: 'sale',
     ...saleData
   };
   return db.put(sale)
     .then(response => ({ success: true, sale: { _id: response.id, ...sale } }))
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
     selector: { createdAt: { $gte: new Date(date1), $lte: new        
 Date(date2) } }                                                      
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
     selector: { createdAt: { $gte: new Date(startDate), $lte: new    
 Date(endDate) } }                                                    
   })                                                                 
     .then(result => {                                                
       const totalSales = result.docs.reduce((sum, sale) => sum +     
 sale.totalAmount, 0);                                                
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
     selector: { createdAt: { $gte: new Date(startDate), $lte: new    
 Date(endDate) } }                                                    
   })                                                                 
     .then(result => {                                                
       const totalSales = result.docs.reduce((sum, sale) => sum +     
 sale.totalAmount, 0);                                                
       const averageValue = totalSales / result.docs.length;          
       return { success: true, data: averageValue };                  
     })                                                               
     .catch(error => {                                                
       console.error('Error getting average transaction value:',      
 error);                                                              
       return { success: false, error: error.message };               
     });                                                              
 }                                                                    
                                                                      
 // Sales by product category for a given time period                 
 function getSalesByCategory(db, startDate, endDate) {                
   return db.find({                                                   
     selector: { createdAt: { $gte: new Date(startDate), $lte: new    
 Date(endDate) } }                                                    
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
     selector: { createdAt: { $gte: new Date(startDate), $lte: new    
 Date(endDate) } }                                                    
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
                                                                      
       const sortedItems = Object.values(itemSales).sort((a, b) =>    
 b.totalSales - a.totalSales).slice(0, limit);                        
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
     selector: { createdAt: { $gte: new Date(startDate), $lte: new    
 Date(endDate) } }                                                    
   })                                                                 
     .then(result => {                                                
       let totalRevenue = 0;                                          
       let totalCost = 0;                                             
                                                                      
       result.docs.forEach(sale => {                                  
         sale.items.forEach(item => {                                 
           totalRevenue += item.subtotal;                             
           totalCost += item.quantity *                               
 item.productVariant.product.buyPrice *                               
 item.productVariant.conversionFactor;                                
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
     selector: { createdAt: { $gte: new Date(startDate), $lte: new    
 Date(endDate) } }                                                    
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
           const buyPrice =                                           
 Number(item.productVariant.product.buyPrice) || 0;                   
           const conversionFactor =                                   
 Number(item.productVariant.conversionFactor) || 1;                   
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
     selector: { createdAt: { $gte: new Date(startDate), $lte: new    
 Date(endDate) } }                                                    
   })                                                                 
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
   return db.find({                                                   
     selector: { createdAt: { $gte: new Date(startDate), $lte: new    
 Date(endDate) } }                                                    
   })                                                                 
     .then(result => {                                                
       const serializedSales = result.docs.map(sale => ({             
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
     })                                                               
     .catch(error => {                                                
       console.error('Error getting sales between dates:', error);    
       return { success: false, error: error.message };               
     });                                                              
 }                                                                    
                                                                      
 // Function to get a specific sale by ID                             
 function getSaleById(db, saleId) {
   return db.get(`sale_${saleId}`)
     .then(sale => {
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
     })
     .catch(error => ({ success: false, error: error.message }));
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
