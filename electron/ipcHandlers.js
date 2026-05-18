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
const restockScheduler = require('./services/restockScheduler')
const stockAiAgent = require('./services/stockAiAgentService')
const message = require('./services/messageService')
const expenseType = require('./services/finance/expenseTypeService')
const aiAnalysis = require('./services/aiAnalysisService')
const aiAssistant = require('./services/aiAssistant')
const { updateTelegramBotStoreNo, sendAlert } = require('./services/aiAssistant/telegramBot')
const printerService = require('./services/printerService')
const subscriptionService = require('./services/subscriptionService')
const growthService = require('./services/growthService')
const stockAuditService = require('./services/stockAuditService')
const reconciliationService = require('./services/reconciliationService')
const registerSessionService = require('./services/registerSessionService')
const openaiAuth = require('./services/openaiAuth')
const reminderService = require('./services/reminderService')
const {
  can,
  normalizeStaff,
  getStaffRoles,
  isOperationAllowed,
  isRestockTaskAllowed,
  isMessageTaskAllowed,
} = require('../lib/rbac')

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
  let authenticatedStaff = null;

  const unauthorized = (scope) => ({
    success: false,
    error: `Unauthorized: your role does not allow ${scope}.`
  });

  const canUpdateOwnProfile = async (nextStaff) => {
    if (!authenticatedStaff || !nextStaff || nextStaff._id !== authenticatedStaff._id) {
      return false;
    }

    try {
      const current = await db.get(nextStaff._id);
      const currentRoles = getStaffRoles(current).join(',');
      const nextRoles = getStaffRoles(nextStaff).join(',');

      return currentRoles === nextRoles
        && Number(current.salary || 0) === Number(nextStaff.salary || 0);
    } catch (error) {
      return false;
    }
  };

  ipcMain.handle('get-online-status', async () => {
    return checkNetworkConnection();
  });

  ipcMain.handle('get-sync-status', async () => {
    return getSyncStatus(db);
  });

  ipcMain.handle('openai-auth-status', async () => {
    return openaiAuth.getOpenAIAuthStatus();
  });

  ipcMain.handle('openai-auth-login', async () => {
    return openaiAuth.loginWithOpenAIOAuth();
  });

  ipcMain.handle('openai-auth-logout', async () => {
    openaiAuth.logoutOpenAI();
    return openaiAuth.getOpenAIAuthStatus();
  });

  ipcMain.handle('set-authenticated-staff', async (event, staff) => {
    authenticatedStaff = staff && staff._id ? normalizeStaff(staff) : null;
    return { success: true };
  });

  ipcMain.handle('sign-in-staff', async (event, phoneNumber, passcode, storeNo) => {
    return staffService.signInStaff(db, phoneNumber, passcode, storeNo);
  });

  ipcMain.handle('search-customers', async (event, name, storeNo) => {
    if (!can(authenticatedStaff, 'customer:read')) {
      return unauthorized('customer search');
    }
    return customerService.searchCustomers(db, name, storeNo);
  });

  ipcMain.handle('search-products', async (event, searchTerm, storeNo) => {
    if (!can(authenticatedStaff, 'product:read')) {
      return unauthorized('product search');
    }
    return productService.searchProducts(db, searchTerm, storeNo);
  });

  ipcMain.handle('search-variants', async (event, searchTerm, storeNo) => {
    if (!can(authenticatedStaff, 'product:read')) {
      return unauthorized('variant search');
    }
    return productService.searchVariants(db, searchTerm, storeNo);
  });

  ipcMain.handle('search-css', async (event, searchTerm, type, storeNo) => {
    if (!can(authenticatedStaff, 'finance:read') && !can(authenticatedStaff, 'customer:read')) {
      return unauthorized('finance/customer search');
    }
    return transactionService.searchCSS(db, searchTerm, type, storeNo);
  });

  ipcMain.handle('restock', async (event, task, ...args) => {
    if (!isRestockTaskAllowed(authenticatedStaff, task)) {
      return unauthorized(`restock task "${task}"`);
    }
    switch (task) {
      case 'restockCheckup':
        return stock.getProductsToRestock(db, args[0]);
      case 'calculateRestock':
        return stock.calculateRestock(db, args[0], mainWindow);
      // Restock list management
      case 'getRestockList':
        return restockScheduler.getRestockList(db, args[0], args[1]);
      case 'addToRestockList':
        return restockScheduler.addToRestockList(db, args[0], args[1]);
      case 'removeFromRestockList':
        // args: storeNo, category, productId -> function expects: db, productId, category, storeNo
        return restockScheduler.removeFromRestockList(db, args[2], args[1], args[0]);
      case 'clearRestockList':
        return restockScheduler.clearRestockList(db, args[0], args[1]);
      case 'checkLowStock':
        return restockScheduler.checkAndAddLowStockProducts(db, args[0]);
      // Stock AI command center
      case 'generateStockAiPlan':
        return stockAiAgent.generateStockAiPlan(db, args[0], mainWindow, sendAlert);
      case 'getLatestStockAiPlan':
        return stockAiAgent.getLatestStockAiPlan(db, args[0]);
      case 'approveStockAiRecommendation':
        return stockAiAgent.approveStockAiRecommendation(db, args[0], args[1], args[2]);
      case 'dismissStockAiRecommendation':
        return stockAiAgent.dismissStockAiRecommendation(db, args[0], args[1], args[2], args[3]);
      // Manual trigger for scheduled calculations
      case 'runMorningRestock':
        return restockScheduler.runScheduledRestockCalculation(db, args[0], mainWindow, 'morning');
      case 'runEveningRestock':
        return restockScheduler.runScheduledRestockCalculation(db, args[0], mainWindow, 'evening');
      // Scheduler control
      case 'startScheduler':
        return restockScheduler.startRestockScheduler(db, args[0], mainWindow);
      case 'stopScheduler':
        return restockScheduler.stopRestockScheduler();
      default:
        throw new Error(`Unknown restock task: ${task}`);
    }  
  });

  ipcMain.on('aiAnalysis-start', (event, metrics) => {
    aiAnalysis.aiAnalysis(event, metrics, db)
      .then(() => {
        event.reply('aiAnalysis-data', { done: true });
      })
      .catch(error => {
        event.reply('aiAnalysis-error', error);
      });
  });

  // AI Assistant chat
  ipcMain.on('ai-assistant-chat', (event, { sessionId, message, storeNo }) => {
    aiAssistant.chat(sessionId, message, db, storeNo, 'in-app', {
      onChunk: (chunk) => event.reply('ai-assistant-chunk', { chunk }),
      onToolCall: (toolName) => event.reply('ai-assistant-tool', { toolName }),
      onComplete: () => event.reply('ai-assistant-done', { done: true }),
      onError: (error) => event.reply('ai-assistant-error', { error }),
    }).catch(error => {
      event.reply('ai-assistant-error', { error: error.message });
    });
  });

  ipcMain.handle('ai-assistant-clear', (event, sessionId) => {
    return aiAssistant.clearConversation(sessionId);
  });

  // Forward storeNo changes to Telegram bot
  ipcMain.on('send-storeNo', (event, storeNo) => {
    updateTelegramBotStoreNo(storeNo);
  });

  ipcMain.handle('message', async(event, sms, ...args) => {
    if (!isMessageTaskAllowed(authenticatedStaff, sms)) {
      return unauthorized(`message task "${sms}"`);
    }
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
    console.log(`[IPC] realm-operation called: ${operation}`);
    const isBootstrapOperation = !authenticatedStaff && (
      operation === 'createWholeSaler'
      || (operation === 'createStaff' && getStaffRoles(args[0]).includes('admin'))
    );

    if (!isBootstrapOperation && !isOperationAllowed(authenticatedStaff, operation)) {
      if (!(operation === 'updateStaff' && await canUpdateOwnProfile(args[0]))) {
        return unauthorized(`operation "${operation}"`);
      }
    }
    switch (operation) {
      case 'createCustomer':
        return customerService.createCustomer(db, args[0]);
      case 'updateCustomer':
        return customerService.updateCustomer(db, args[0]);
      case 'deleteCustomer':
        return customerService.deleteCustomer(db, args[0]);
      case 'getAllCustomers':
        return customerService.getAllCustomers(db, args[0]);
      case 'getCustomerCreditOverview':
        return customerService.getCustomerCreditOverview(db, args[0]);
      case 'getCustomerById':
        return customerService.getCustomerById(db, args[0]);
      case 'getTodayCreditSales':
        return customerService.getTodayCreditSales(db, args[0]);
      case 'getTodayCustomerTransactions':
        return customerService.getTodayCustomerTransactions(db, args[0]);
      case 'getCustomerLedger':
        return customerService.getCustomerLedger(db, args[0], args[1], args[2], args[3]);
      case 'getCustomerAging':
        return customerService.getCustomerAging(db, args[0], args[1]);
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
      case 'getExpiringProducts':
        return productService.getExpiringProducts(db, args[0], args[1]);
      case 'removeBatch':
        return productService.removeBatch(db, args[0], args[1]);
      case 'restockProducts':
        // Accept either an array of products or an object { products, storeNo }
        return productService.restockProducts(
          db,
          Array.isArray(args[0]) ? args[0] : (args[0] && args[0].products ? args[0].products : args[0])
        );
      case 'createSale':
        return saleService.createSale(db, args[0], mainWindow);
      case 'previewReconciliation':
        return reconciliationService.previewReconciliation(db, args[0]);
      case 'createReconciliationCase':
        return reconciliationService.createReconciliationCase(db, args[0]);
      case 'approveReconciliationCase':
        return reconciliationService.approveReconciliationCase(db, args[0], args[1], mainWindow);
      case 'rejectReconciliationCase':
        return reconciliationService.rejectReconciliationCase(db, args[0], args[1], args[2]);
      case 'getReconciliationCases':
        return reconciliationService.getReconciliationCases(db, args[0], args[1]);
      case 'getReconciliationBySource':
        return reconciliationService.getReconciliationBySource(db, args[0], args[1], args[2]);
      case 'archiveSale':
        return saleService.archiveSale(db, args[0]);
      case 'getCashierSales':
        return saleService.getCashierSales(db, args[0].storeNo, args[0].staffId);
      case 'getTodaySalesByPaidStatus':
        return saleService.getTodaySalesByPaidStatus(db, args[0].storeNo, args[0].paidStatus);
      case 'getUnpaidSalesBeforeToday':
        return saleService.getUnpaidSalesBeforeToday(db, args[0]);
      case 'updateSalePaidStatus':
        return saleService.updateSalePaidStatus(db, args[0].saleId, args[0].paidStatus);
      case 'createSupplier':
        return supplierService.createSupplier(db, args[0]);
      case 'createInvoice':
        return supplierService.createInvoice(db, args[0]);
      case 'getInvoices':
        return supplierService.getInvoices(db, args[0]);
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
      case 'getSupplierStatement':
        return supplierService.getSupplierStatement(db, args[0], args[1]);
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
      case 'getRegisterSession':
        return registerSessionService.getRegisterSession(db, args[0], args[1]);
      case 'saveRegisterSession':
        return registerSessionService.saveRegisterSession(db, args[0]);
      case 'closeRegisterSession':
        return registerSessionService.closeRegisterSession(db, args[0], args[1]);
      case 'incomeStatement':
        return financeReport.incomeStatement(db, args[0], args[1]);
      case 'getMonthlyProfitLoss':
        return financeReport.getMonthlyProfitLoss(db, args[0]);
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
      case 'getWeeklyStockoutRate':
        return growthService.getWeeklyStockoutRate(db, args[0]);
      case 'getMonthlyStockoutRate':
        return growthService.getMonthlyStockoutRate(db, args[0]);

      // Stock Audit Operations
      case 'createAudit':
        return stockAuditService.createAudit(db, args[0]);
      case 'submitAudit':
        return stockAuditService.submitAudit(db, args[0], args[1]);
      case 'getAudit':
        return stockAuditService.getAudit(db, args[0]);
      case 'getAuditHistory':
        return stockAuditService.getAuditHistory(db, args[0], args[1]);
      case 'getAuditSummary':
        return stockAuditService.getAuditSummary(db, args[0]);

      // Personal Reminder Operations
      case 'createReminder':
        return reminderService.createReminder(db, args[0]);
      case 'getMyReminders':
        return reminderService.getMyReminders(db, args[0]);
      case 'updateReminder':
        return reminderService.updateReminder(db, args[0]);
      case 'completeReminder':
        return reminderService.completeReminder(db, args[0]);
      case 'archiveReminder':
        return reminderService.archiveReminder(db, args[0]);
      case 'snoozeReminder':
        return reminderService.snoozeReminder(db, args[0]);
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  });
}

module.exports = setupIpcHandlers
