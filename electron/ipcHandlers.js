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

function setupIpcHandlers(ipcMain, db) {
  ipcMain.handle('get-online-status', async () => {
    return checkNetworkConnection();
  });

  ipcMain.handle('get-sync-status', async () => {
    return getSyncStatus(db);
  });

  ipcMain.handle('sign-in-staff', async (event, phoneNumber, passcode) => {
    return staffService.signInStaff(db, phoneNumber, passcode);
  });

  ipcMain.handle('search-customers', async (event, name) => {
    return customerService.searchCustomers(db, name);
  });

  ipcMain.handle('search-products', async (event, searchTerm) => {
    return productService.searchProducts(db, searchTerm);
  });

  ipcMain.handle('search-variants', async (event, searchTerm) => {
    return productService.searchVariants(db, searchTerm);
  });

  ipcMain.handle('search-css', async (event, searchTerm, type) => {
    return transactionService.searchCSS(db, searchTerm, type);
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
        return customerService.getAllCustomers(db);
      case 'getCustomerById':
        return customerService.getCustomerById(db, args[0]);
      case 'getAllProducts':
        return productService.getAllProducts(db);
      case 'getAllVariants':
        return productService.getAllVariants(db);
      case 'getSaleItemsByProductId':
        return productService.getSaleItemsByProductId(db, args[0], args[1], args[2]);
      case 'getProductById':
        return productService.getProductById(db, args[0]);
      case 'updateProduct':
        return productService.updateProduct(db, args[0]);
      case 'addNewVariant':
        return productService.addNewVariant(db, args[0], args[1])
      case 'removeVariant':
        return productService.removeVariant(db, args[0], args[1])
      case 'addNewProduct':
        return productService.addNewProduct(db, args[0]);
      case 'archiveProduct':
        return productService.archiveProduct(db, args[0]);
      case 'restockProducts':
        return productService.restockProducts(db, args[0]);
      case 'createSale':
        return saleService.createSale(db, ...args);
      case 'archiveSale':
        return saleService.archiveSale(db, args[0]);
      case 'createSupplier':
        return supplierService.createSupplier(db, args[0]);
      case 'getAllSuppliers':
        return supplierService.getAllSuppliers(db);
      case 'getSupplierById':
        return supplierService.getSupplierById(db, args[0]);
      case 'updateSupplier':
        return supplierService.updateSupplier(db, args[0]);
      case 'archiveSupplier':
        return supplierService.archiveSupplier(db, args[0]);
      case 'createAccount':
        return accountService.createAccount(db, args[0]);
      case 'getAllAccounts':
        return accountService.getAllAccounts(db);
      case 'getAccountById':
        return accountService.getAccountById(db, args[0]);
      case 'updateAccount':
        return accountService.updateAccount(db, args[0]);
      case 'archiveAccount':
        return accountService.archiveAccount(db, args[0]);
      case 'createExpense':
        return expenseService.createExpense(db, args[0]);
      case 'getAllExpenses':
        return expenseService.getAllExpenses(db);
      case 'getExpenseById':
        return expenseService.getExpenseById(db, args[0]);
      case 'updateExpense':
        return expenseService.updateExpense(db, args[0]);
      case 'archiveExpense':
        return expenseService.archiveExpense(db, args[0]);
      case 'createTransaction':
        return transactionService.createTransaction(db, args[0]);
      case 'getAllTransactions':
        return transactionService.getAllTransactions(db);
      case 'getTransactionById':
        return transactionService.getTransactionById(db, args[0]);
      case 'updateTransaction':
        return transactionService.updateTransaction(db, args[0]);
      case 'archiveTransaction':
        return transactionService.archiveTransaction(db, args[0]);
      case 'getCustomerSales':
        return customerService.getCustomerSales(db, args[0], args[1], args[2]);
      case 'getSaleProducts':
        return saleService.getSaleProducts(db, ...args).map(product => product.toJSON());
      case 'getSalesByPaymentMethod':
        return saleService.getSalesByPaymentMethod(db, args[0], args[1]);
      case 'getTotalSales':
        return saleService.getTotalSales(db, args[0], args[1]);
      case 'getAverageTransactionValue':
        return saleService.getAverageTransactionValue(db, args[0], args[1]);
      case 'getSalesByCategory':
        return saleService.getSalesByCategory(db, args[0], args[1]);
      case 'getTopSellingItems':
        return saleService.getTopSellingItems(db, args[0], args[1], args[2]);
      case 'getGrossProfitMargin':
        return saleService.getGrossProfitMargin(db, args[0], args[1]);
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
        return staffService.getAllStaff(db);
      case 'getTotalSalesRevenueAndProfit':
        return saleService.getTotalSalesRevenueAndProfit(db, args[0], args[1]);
      case 'getTopCustomers':
        return saleService.getTopCustomers(db, args[0], args[1], args[2]);
      case 'getAllSalesBetweenDates':
        return saleService.getAllSalesBetweenDates(db, args[0], args[1]);
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
        return dashboardService.getTodaysSalesMetrics(db);
      case 'getTodaysExpenses':
        return dashboardService.getTodaysExpenses(db);
      case 'getHourlySalesData':
        return dashboardService.getHourlySalesData(db);
      case 'transactionMetrics':
        return dashboardService.transactionMetrics(db);
      case 'incomeStatement':
        return financeReport.incomeStatement(db, args[0], args[1]);
      case 'getAccountStatement':
        return financeReport.getAccountStatement(db, args[0], args[1]);
      case 'getBalanceSheet':
        return financeReport.getBalanceSheet(db, args[0], args[1]);
      case 'createBalanceSheetEntry':
        return balanceSheet.createBalanceSheetEntry(db, args[0]);
      case 'getAllBalanceSheets':
        return balanceSheet.getAllBalanceSheets(db);
      case 'getBalanceSheetById':
        return balanceSheet.getBalanceSheetById(db, args[0]);
      case 'archiveBalanceSheet':
        return balanceSheet.archiveBalanceSheet(db, args[0]);
      case 'updateBalanceSheet':
        return balanceSheet.updateBalanceSheet(db, args[0]);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  });
}

module.exports = setupIpcHandlers
