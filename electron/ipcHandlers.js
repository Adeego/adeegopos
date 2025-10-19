const { net } = require('electron');
const customerService = require('./services/customerService')
const productService = require('./services/productService')
const wholeSalerService = require('./services/wholeSalerService')
const staffService = require('./services/staffService')
const saleService = require('./services/saleService')
const supplierService = require('./services/supplierService')
const accountService = require('./services/finance/accountService')
const expenseService = require('./services/finance/expenseService')
const transactionService = require('./services/finance/transactionService')
const dashboardService = require('./services/dashboardService')
const financeReport = require('./services/finance/financeReportService')
const balanceSheet = require('./services/finance/balanceSheetServices')
const reportService = require('./services/reportService')
const stock = require('./services/stockManagement')
const message = require('./services/messageService')
const expenseType = require('./services/finance/expenseTypeService')
const aiAnalysis = require('./services/aiAnalysisService')
const printerService = require('./services/printerService')
const subscriptionService = require('./services/subscriptionService')
const growthService = require('./services/growthService')

function getSyncStatus(db) {
  return db.info()
    .then(info => ({ isSyncing: true, progress: info.update_seq }))
    .catch(error => ({ isSyncing: false, error: error.message }));
}

function checkNetworkConnection() {
  return new Promise((resolve) => {
    const request = net.request('https://www.google.com');
    request.on('response', () => {
      resolve(true);
    });
    request.on('error', () => {
      resolve(false);
    });
    request.end();
  });
}

function setupIpcHandlers(ipcMain, db, mainWindow) {
  ipcMain.handle('get-online-status', async () => {
    return checkNetworkConnection();
  });

  ipcMain.handle('get-sync-status', async () => {
    return getSyncStatus(db);
  });

  ipcMain.handle('sign-in-staff', async (event, storeNo, phoneNumber, passcode) => {
    return staffService.signInStaff(db, storeNo, phoneNumber, passcode);
  });

  ipcMain.handle('search-customers', async (event, name, storeNo) => {
    return customerService.searchCustomers(db, name, storeNo);
  });

  ipcMain.handle('search-products', async (event, storeNo, searchTerm) => {
    return productService.searchProducts(db, storeNo, searchTerm);
  });

  ipcMain.handle('search-variants', async (event, storeNo, searchTerm) => {
    return productService.searchVariants(db, storeNo, searchTerm);
  });

  ipcMain.handle('search-css', async (event, searchTerm, type) => {
    return transactionService.searchCSS(db, searchTerm, type);
  });

  ipcMain.handle('restock', async (event, task, ...args) => {
    switch (task) {
      case 'restockCheckup':
        return stock.getProductsToRestock(db, args[0]);
      case 'calculateRestock':
        return stock.calculateRestock(db, args[0], mainWindow);
      default:
        throw new Error(`Unknown restock task: ${task}`);
    }  
  });

  ipcMain.on('aiAnalysis-start', (event, metrics) => {
    aiAnalysis.aiAnalysis(event, metrics)
      .then(() => {
        event.reply('aiAnalysis-data', { done: true });
      })
      .catch(error => {
        event.reply('aiAnalysis-error', error);
      });
  });

  ipcMain.handle('message', async(event, sms, ...args) => {
    switch (sms) {
      case 'getAllMessages':
        return message.getAllMessages(db, args[0]);
      case 'updateMessage':
        return message.updateMessage(db, args[0])
      default:
        throw new Error(`Unknown message sms: ${sms}`);
    }
  });

  ipcMain.handle('realm-operation', async (event, operation, ...args) => {
    switch (operation) {
      case 'createCustomer':
        return customerService.createCustomer(db, args[0]);
      case 'updateCustomer':
        return customerService.updateCustomer(db, args[0]);
      case 'deleteCustomer':
        return customerService.deleteCustomer(db, args[0]);
      case 'getAllCustomers':
        return customerService.getAllCustomers(db, args[0]);
      case 'getCustomerById':
        return customerService.getCustomerById(db, args[0]);
      case 'getTodayCreditSales':
        return customerService.getTodayCreditSales(db, args[0]);
      case 'getTodayCustomerTransactions':
        return customerService.getTodayCustomerTransactions(db, args[0]);
      case 'getAllProducts':
        return productService.getAllProducts(db, args[0]);
      case 'getAllVariants':
        return productService.getAllVariants(db, args[0]);
      case 'getSaleItemsByProductId':
        return productService.getSaleItemsByProductId(db, args[0], args[1]);
      case 'getProductById':
        return productService.getProductById(db, args[0]);
      case 'updateProduct':
        return productService.updateProduct(db, args[0]);
      case 'addNewVariant':
        return productService.addNewVariant(db, args[0], args[1])
      case 'updateVariant':
        return productService.updateVariant(db, args[0], args[1], args[2])
      case 'removeVariant':
        return productService.removeVariant(db, args[0], args[1])
      case 'addNewProduct':
        return productService.addNewProduct(db, args[0]);
      case 'archiveProduct':
        return productService.archiveProduct(db, args[0]);
      case 'restockProducts':
        // Accept either an array of products or an object { products, storeNo }
        return productService.restockProducts(
          db,
          Array.isArray(args[0]) ? args[0] : (args[0] && args[0].products ? args[0].products : args[0])
        );
      case 'createSale':
        return saleService.createSale(db, args[0], mainWindow);
      case 'archiveSale':
        return saleService.archiveSale(db, args[0]);
      case 'createSupplier':
        return supplierService.createSupplier(db, args[0]);
      case 'createInvoice':
        return supplierService.createInvoice(db, args[0]);
      case 'getTodayInvoices':
        return supplierService.getTodayInvoices(db, args[0]);
      case 'getInvoiceById':
        return supplierService.getInvoiceById(db, args[0]);
      case 'getTodaySupplierTransactions':
        return supplierService.getTodaySupplierTransactions(db, args[0]);
      case 'getAllSuppliers':
        return supplierService.getAllSuppliers(db, args[0]);
      case 'getSupplierById':
        return supplierService.getSupplierById(db, args[0]);
      case 'updateSupplier':
        return supplierService.updateSupplier(db, args[0]);
      case 'archiveSupplier':
        return supplierService.archiveSupplier(db, args[0]);
      case 'createAccount':
        return accountService.createAccount(db, args[0]);
      case 'getAllAccounts':
        return accountService.getAllAccounts(db, args[0]);
      case 'getAccountById':
        return accountService.getAccountById(db, args[0]);
      case 'updateAccount':
        return accountService.updateAccount(db, args[0]);
      case 'archiveAccount':
        return accountService.archiveAccount(db, args[0]);
      case 'createExpense':
        return expenseService.createExpense(db, args[0]);
      case 'getAllExpenses':
        return expenseService.getAllExpenses(db, args[0]);
      case 'getExpenseById':
        return expenseService.getExpenseById(db, args[0]);
      case 'updateExpense':
        return expenseService.updateExpense(db, args[0]);
      case 'archiveExpense':
        return expenseService.archiveExpense(db, args[0]);
      case 'createTransaction':
        return transactionService.createTransaction(db, args[0]);
      case 'getAllTransactions':
        return transactionService.getAllTransactions(db, args[0]);
      case 'getTodayTransactions':
        return transactionService.getTodayTransactions(db, args[0]);
      case 'getTransactionById':
        return transactionService.getTransactionById(db, args[0]);
      case 'updateTransaction':
        return transactionService.updateTransaction(db, args[0]);
      case 'archiveTransaction':
        return transactionService.archiveTransaction(db, args[0]);
      case 'getCustomerSales':
        return customerService.getCustomerSales(db, args[0], args[1], args[2], args[3]);
      case 'getSaleProducts':
        return saleService.getSaleProducts(db, ...args).map(product => product.toJSON());
      case 'getSalesByPaymentMethod':
        return saleService.getSalesByPaymentMethod(db, args[0], args[1], args[2]);
      case 'getTotalSales':
        return saleService.getTotalSales(db, args[0], args[1], args[2]);
      case 'getAverageTransactionValue':
        return saleService.getAverageTransactionValue(db, args[0], args[1], args[2]);
      case 'getSalesByCategory':
        return saleService.getSalesByCategory(db, args[0], args[1], args[2]);
      case 'getTopSellingItems':
        return saleService.getTopSellingItems(db, args[0], args[1], args[2], args[3]);
      case 'getGrossProfitMargin':
        return saleService.getGrossProfitMargin(db, args[0], args[1], args[2]);
      case 'createWholeSaler':
        return wholeSalerService.createWholeSaler(db, args[0]);
      case 'updateWholeSaler':
        return wholeSalerService.updateWholeSaler(db, args[0]);
      case 'deleteWholeSaler':
        return wholeSalerService.deleteWholeSaler(db, args[0]);
      case 'getWholeSalerById':
        return wholeSalerService.getWholeSalerById(db, args[0]);
      case 'getAllWholeSalers':
        return wholeSalerService.getAllWholeSalers(db);
      case 'createStaff':
        return staffService.createStaff(db, args[0]);
      case 'updateStaff':
        return staffService.updateStaff(db, args[0]);
      case 'archiveStaff':
        return staffService.archiveStaff(db, args[0]);
      case 'getStaffById':
        return staffService.getStaffById(db, args[0]);
      case 'getAllStaff':
        return staffService.getAllStaff(db, args[0]);
      case 'getTotalSalesRevenueAndProfit':
        return saleService.getTotalSalesRevenueAndProfit(db, args[0], args[1], args[2]);
      case 'getTopCustomers':
        return saleService.getTopCustomers(db, args[0], args[1], args[2], args[3]);
      case 'getAllSalesBetweenDates':
        return saleService.getAllSalesBetweenDates(db, args[0], args[1], args[2]);
      case 'getSaleById':
        return saleService.getSaleById(db, args[0]);
      case 'getSalesMetricsReport':
        return reportService.getSalesMetricsReport(db, args[0], args[1]);
      case 'getExpensesReport':
        return reportService.getExpensesReport(db, args[0], args[1]);
      case 'getDailySalesReport':
        return reportService.getDailySalesReport(db, args[0], args[1]);
      case 'getTransactionMetricsReport':
        return reportService.getTransactionMetricsReport(db, args[0], args[1]);
      case 'getTodaysSalesMetrics':
        return dashboardService.getTodaysSalesMetrics(db, args[0]);
      case 'getTodaysExpenses':
        return dashboardService.getTodaysExpenses(db, args[0]);
      case 'getHourlySalesData':
        return dashboardService.getHourlySalesData(db, args[0]);
      case 'transactionMetrics':
        return dashboardService.transactionMetrics(db, args[0]);
      case 'incomeStatement':
        return financeReport.incomeStatement(db, args[0], args[1]);
      case 'getAccountStatement':
        return financeReport.getAccountStatement(db, args[0], args[1]);
      case 'getBalanceSheet':
        return financeReport.getBalanceSheet(db, args[0], args[1]);
      case 'getChartOfAccounts':
        return financeReport.getChartOfAccounts(db, args[0], args[1]);
      case 'getTrialBalance':
        return financeReport.getTrialBalance(db, args[0], args[1]);
      case 'createBalanceSheetEntry':
        return balanceSheet.createBalanceSheetEntry(db, args[0]);
      case 'getAllBalanceSheets':
        return balanceSheet.getAllBalanceSheets(db, args[0]);
      case 'getBalanceSheetById':
        return balanceSheet.getBalanceSheetById(db, args[0]);
      case 'archiveBalanceSheet':
        return balanceSheet.archiveBalanceSheet(db, args[0]);
      case 'updateBalanceSheet':
        return balanceSheet.updateBalanceSheet(db, args[0]);
      case 'createExpenseType':
        return expenseType.createExpenseType(db, args[0]);
      case 'getAllExpenseTypes':
        return expenseType.getAllExpenseTypes(db, args[0]);
      case 'getExpenseTypeById':
        return expenseType.getExpenseTypeById(db, args[0]);
      case 'updateExpenseType':
        return expenseType.updateExpenseType(db, args[0]);
      case 'archiveExpenseType':
        return expenseType.archiveExpenseType(db, args[0]);
      case 'printReceipt':
        // args[0] should be the sale object to print
        return printerService.printReceipt(args[0]);
      
      // Adeego Plus Subscription Operations
      case 'getAllSubscriptions':
        return subscriptionService.getAllSubscriptions(db, args[0]);
      case 'addSubscription':
        return subscriptionService.addSubscription(db, args[0]);
      case 'updateSubscription':
        return subscriptionService.updateSubscription(db, args[0]);
      case 'deleteSubscription':
        return subscriptionService.deleteSubscription(db, args[0]);
      case 'getTodayDeliveries':
        return subscriptionService.getTodayDeliveries(db, args[0], args[1]);
      case 'updateDeliveryStatus':
        return subscriptionService.updateDeliveryStatus(db, args[0]);
      case 'getSubscriptionById':
        return subscriptionService.getSubscriptionById(db, args[0]);
      case 'getCustomerSubscriptions':
        return subscriptionService.getCustomerSubscriptions(db, args[0], args[1]);
      case 'getDeliveryHistory':
        return subscriptionService.getDeliveryHistory(db, args[0]);
      case 'getSubscriptionStats':
        return subscriptionService.getSubscriptionStats(db, args[0]);
      case 'searchSubscriptions':
        return subscriptionService.searchSubscriptions(db, args[0], args[1]);
      case 'searchCustomers':
        return customerService.searchCustomers(db, args[0], args[1]);
      
      // Growth Analytics Operations
      case 'getMonthlySalesData':
        return growthService.getMonthlySalesData(db, args[0], args[1], args[2]);
      case 'getWeeklySalesGrowth':
        return growthService.getWeeklySalesGrowth(db, args[0], args[1], args[2]);
      case 'getAverageOrderValue':
        return growthService.getAverageOrderValue(db, args[0], args[1], args[2]);
      case 'getWeeklySalesBarData':
        return growthService.getWeeklySalesBarData(db, args[0], args[1], args[2]);
      case 'getTopPerformingProducts':
        return growthService.getTopPerformingProducts(db, args[0], args[1], args[2], args[3]);
      case 'getWeeklyGrossMargin':
        return growthService.getWeeklyGrossMargin(db, args[0], args[1], args[2]);
      case 'getGrowthMetrics':
        return growthService.getGrowthMetrics(db, args[0]);
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  });
}

module.exports = setupIpcHandlers
