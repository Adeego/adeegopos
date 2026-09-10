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
const message = require('./services/messageService')
const expenseType = require('./services/finance/expenseTypeService')
const aiAnalysis = require('./services/aiAnalysisService')
const aiAssistant = require('./services/aiAssistant')
const { updateTelegramBotStoreNo } = require('./services/aiAssistant/telegramBot')
const printerService = require('./services/printerService')
const subscriptionService = require('./services/subscriptionService')
const growthService = require('./services/growthService')
const stockAuditService = require('./services/stockAuditService')
const reconciliationService = require('./services/reconciliationService')
const registerSessionService = require('./services/registerSessionService')
const openaiAuth = require('./services/openaiAuth')
const reminderService = require('./services/reminderService')
const { acquireRegisterShift, assertRegisterShiftLock, getRegisterShiftControl, getSyncStatus, releaseRegisterShift, syncRegisterSessionFromCentral, takeOverRegisterShift, verifyRetainedStaffCredential } = require('./pouchSync')
const {
  can,
  getStaffRoles,
  isOperationAllowed,
  isMessageTaskAllowed,
} = require('../lib/rbac')

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

async function signInStaffOnline(phoneNumber, passcode, storeNo) {
  try {
    const response = await net.fetch('https://adeego.store/signin/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: String(phoneNumber || '').trim(),
        passcode: String(passcode || ''),
        storeNo: String(storeNo || '').trim(),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.staff) {
      const detail = String(data.detail || data.message || 'Invalid credentials')
        .replace(/^An error occurred:\s*(?:401:\s*)?/i, '');
      return { success: false, error: detail || 'Invalid credentials' };
    }
    return { success: true, staff: data.staff };
  } catch (error) {
    return { success: false, error: 'Unable to contact the staff authentication service.' };
  }
}

function setupIpcHandlers(ipcMain, db, mainWindow) {
  let authContext = null;

  const unauthorized = (scope) => ({
    success: false,
    error: `Unauthorized: your module access does not allow ${scope}.`
  });

  const getAuthenticatedStaff = async () => {
    if (!authContext?.staffId || !authContext?.storeNo) return null;
    const result = await staffService.getActiveStaffById(db, authContext.staffId, authContext.storeNo);
    if (!result.success) {
      authContext = null;
      return null;
    }
    return result.staff;
  };

  const canUseStore = (staff, storeNo) => Boolean(staff && String(staff.storeNo) === String(storeNo));

  const canUpdateOwnProfile = async (authenticatedStaff, nextStaff) => {
    if (!authenticatedStaff || !nextStaff || nextStaff._id !== authenticatedStaff._id) {
      return false;
    }

    try {
      const current = await db.get(nextStaff._id);
      const currentRoles = getStaffRoles(current).join(',');
      const nextRoles = getStaffRoles(nextStaff).join(',');
      const currentAccess = JSON.stringify(current.moduleAccess || {});
      const nextAccess = JSON.stringify(nextStaff.moduleAccess || {});

      return currentRoles === nextRoles
        && currentAccess === nextAccess
        && current.accessPreset === nextStaff.accessPreset
        && Boolean(current.isOwner) === Boolean(nextStaff.isOwner)
        && Number(current.salary || 0) === Number(nextStaff.salary || 0);
    } catch (error) {
      return false;
    }
  };

  ipcMain.handle('get-online-status', async () => {
    return checkNetworkConnection();
  });

  ipcMain.handle('get-sync-status', async () => {
    return getSyncStatus();
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

  ipcMain.handle('set-authenticated-staff', async (event, staffOrId, requestedStoreNo) => {
    if (!staffOrId) {
      authContext = null;
      return { success: true };
    }
    const staffId = typeof staffOrId === 'string' ? staffOrId : staffOrId._id;
    const storeNo = requestedStoreNo || (typeof staffOrId === 'object' ? staffOrId.storeNo : '');
    if (!authContext || authContext.staffId !== staffId || String(authContext.storeNo) !== String(storeNo)) {
      return { success: false, error: 'Sign in is required to establish a staff session' };
    }
    const migration = await staffService.migrateStoreStaffAccess(db, storeNo);
    if (!migration.success) return migration;
    const result = await staffService.getActiveStaffById(db, staffId, storeNo);
    if (!result.success) {
      authContext = null;
      return result;
    }
    authContext = { staffId: result.staff._id, storeNo: result.staff.storeNo };
    return { success: true, staff: result.staff };
  });

  ipcMain.handle('sign-in-staff', async (event, phoneNumber, passcode, storeNo) => {
    let result = await staffService.signInStaff(db, phoneNumber, passcode, storeNo);
    if (!result.success) {
      const online = await signInStaffOnline(phoneNumber, passcode, storeNo);
      if (online.success) {
        const remoteStoreNo = online.staff.storeNo || String(online.staff._id || '').split(':')[0];
        if (String(remoteStoreNo) !== String(storeNo)) {
          return { success: false, error: 'This staff account belongs to another store.' };
        }
        const migration = await staffService.migrateStoreStaffAccess(db, storeNo);
        if (!migration.success) return migration;
        const local = await staffService.getActiveStaffById(db, online.staff._id, storeNo);
        if (!local.success) {
          return { success: false, error: 'Login succeeded, but this staff account has not synced to this device yet.' };
        }
        result = { success: true, staff: local.staff, migration };
      } else {
        const retained = await verifyRetainedStaffCredential(storeNo, phoneNumber, passcode).catch(() => ({ success: false }));
        if (retained.success) {
          const restored = await staffService.restoreMissingStaffPasscode(db, retained.staffId, storeNo, passcode);
          result = restored.success
            ? await staffService.signInStaff(db, phoneNumber, passcode, storeNo)
            : restored;
        } else {
          result = online;
        }
      }
    }
    if (result.success && result.staff) {
      authContext = { staffId: result.staff._id, storeNo: result.staff.storeNo };
    }
    return result;
  });

  ipcMain.handle('search-customers', async (event, name, storeNo) => {
    const authenticatedStaff = await getAuthenticatedStaff();
    if (!canUseStore(authenticatedStaff, storeNo) || !can(authenticatedStaff, 'customer:read')) {
      return unauthorized('customer search');
    }
    return customerService.searchCustomers(db, name, storeNo);
  });

  ipcMain.handle('search-products', async (event, searchTerm, storeNo) => {
    const authenticatedStaff = await getAuthenticatedStaff();
    if (!canUseStore(authenticatedStaff, storeNo) || !can(authenticatedStaff, 'product:read')) {
      return unauthorized('product search');
    }
    return productService.searchProducts(db, searchTerm, storeNo);
  });

  ipcMain.handle('search-variants', async (event, searchTerm, storeNo) => {
    const authenticatedStaff = await getAuthenticatedStaff();
    if (!canUseStore(authenticatedStaff, storeNo) || !can(authenticatedStaff, 'product:read')) {
      return unauthorized('variant search');
    }
    return productService.searchVariants(db, searchTerm, storeNo);
  });

  ipcMain.handle('search-css', async (event, searchTerm, type, storeNo) => {
    const authenticatedStaff = await getAuthenticatedStaff();
    if (!canUseStore(authenticatedStaff, storeNo) || (!can(authenticatedStaff, 'finance:read') && !can(authenticatedStaff, 'customer:read'))) {
      return unauthorized('finance/customer search');
    }
    return transactionService.searchCSS(db, searchTerm, type, storeNo);
  });

  ipcMain.on('aiAnalysis-start', async (event, metrics) => {
    const authenticatedStaff = await getAuthenticatedStaff();
    if (!can(authenticatedStaff, 'report:read')) {
      event.reply('aiAnalysis-error', { error: 'Reports access is required for AI analysis' });
      return;
    }
    aiAnalysis.aiAnalysis(event, metrics, db)
      .then(() => {
        event.reply('aiAnalysis-data', { done: true });
      })
      .catch(error => {
        event.reply('aiAnalysis-error', error);
      });
  });

  // AI Assistant chat
  ipcMain.on('ai-assistant-chat', async (event, { sessionId, message, storeContext }) => {
    const authenticatedStaff = await getAuthenticatedStaff();
    if (!can(authenticatedStaff, 'assistant:use')) {
      event.reply('ai-assistant-error', { error: 'Your module access does not include the AI assistant' });
      return;
    }
    const effectiveStoreNo = authenticatedStaff.storeNo;
    aiAssistant.chat(sessionId, message, db, effectiveStoreNo, 'in-app', {
      onChunk: (chunk) => event.reply('ai-assistant-chunk', { chunk }),
      onToolCall: (toolName) => event.reply('ai-assistant-tool', { toolName }),
      onComplete: () => event.reply('ai-assistant-done', { done: true }),
      onError: (error) => event.reply('ai-assistant-error', { error }),
    }, { ...(storeContext || {}), storeNo: effectiveStoreNo }).catch(error => {
      event.reply('ai-assistant-error', { error: error.message });
    });
  });

  ipcMain.handle('ai-assistant-clear', async (event, sessionId) => {
    const authenticatedStaff = await getAuthenticatedStaff();
    if (!can(authenticatedStaff, 'assistant:use')) return unauthorized('AI assistant');
    return aiAssistant.clearConversation(sessionId);
  });

  // Forward storeNo changes to Telegram bot
  ipcMain.on('send-storeNo', (event, storeNo) => {
    updateTelegramBotStoreNo(storeNo);
  });

  ipcMain.handle('message', async(event, sms, ...args) => {
    const authenticatedStaff = await getAuthenticatedStaff();
    const requestedStoreNo = sms === 'getAllMessages' ? args[0] : args[0]?.storeNo;
    if ((requestedStoreNo && !canUseStore(authenticatedStaff, requestedStoreNo)) || !isMessageTaskAllowed(authenticatedStaff, sms)) {
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
    const authenticatedStaff = await getAuthenticatedStaff();
    const isBootstrapOperation = !authenticatedStaff && (
      operation === 'createWholeSaler'
      || (operation === 'createStaff' && getStaffRoles(args[0]).includes('admin'))
    );

    if (!isBootstrapOperation && !isOperationAllowed(authenticatedStaff, operation)) {
      if (!(operation === 'updateStaff' && await canUpdateOwnProfile(authenticatedStaff, args[0]))) {
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
        {
          const payload = Array.isArray(args[0]) ? { products: args[0], storeNo: authenticatedStaff.storeNo } : args[0];
          if (!payload || String(payload.storeNo || authenticatedStaff.storeNo) !== String(authenticatedStaff.storeNo)) {
            return unauthorized('restocking products for another store');
          }
          return productService.restockProducts(db, payload.products || []);
        }
      case 'createSale':
        if (!canUseStore(authenticatedStaff, args[0]?.storeNo)) return unauthorized('creating a sale for another store');
        return saleService.createSale(db, args[0], mainWindow, authenticatedStaff);
      case 'previewReconciliation':
        return reconciliationService.previewReconciliation(db, args[0]);
      case 'createReconciliationCase':
        return reconciliationService.createReconciliationCase(db, { ...args[0], initiatedBy: authenticatedStaff });
      case 'approveReconciliationCase':
        return reconciliationService.approveReconciliationCase(db, args[0], authenticatedStaff, mainWindow);
      case 'rejectReconciliationCase':
        return reconciliationService.rejectReconciliationCase(db, args[0], authenticatedStaff, args[2] || args[1]);
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
        return saleService.updateSalePaidStatus(db, args[0], authenticatedStaff);
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
      case 'getSalePaymentAccounts':
        if (!canUseStore(authenticatedStaff, args[0]?.storeNo)) return unauthorized('viewing payment methods for another store');
        return accountService.getSalePaymentAccounts(db, args[0]);
      case 'getAccountById':
        return accountService.getAccountById(db, args[0]);
      case 'updateAccount':
        return accountService.updateAccount(db, args[0]);
      case 'archiveAccount':
        return accountService.archiveAccount(db, args[0]);
      case 'createExpense':
        return expenseService.createExpense(db, { ...(args[0] || {}), storeNo: authenticatedStaff.storeNo }, authenticatedStaff);
      case 'getAllExpenses':
        return expenseService.getAllExpenses(db, args[0]);
      case 'getExpenseById':
        return expenseService.getExpenseById(db, args[0]);
      case 'updateExpense':
        return expenseService.updateExpense(db, args[0]);
      case 'archiveExpense':
        return expenseService.archiveExpense(db, args[0]);
      case 'createTransaction':
        return transactionService.createTransaction(db, { ...(args[0] || {}), storeNo: authenticatedStaff.storeNo }, authenticatedStaff);
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
        {
          const result = await staffService.createStaff(
            db,
            isBootstrapOperation ? { ...args[0], isOwner: true, accessPreset: 'owner' } : args[0],
            authenticatedStaff
          );
          if (isBootstrapOperation && result.success) authContext = { staffId: result.staff._id, storeNo: result.staff.storeNo };
          return result;
        }
      case 'updateStaff':
        return staffService.updateStaff(db, args[0], authenticatedStaff);
      case 'archiveStaff':
        return staffService.archiveStaff(db, args[0], authenticatedStaff);
      case 'getStaffById':
        return staffService.getStaffById(db, args[0], authenticatedStaff.storeNo);
      case 'getAllStaff':
        return staffService.getAllStaff(db, authenticatedStaff.storeNo);
      case 'getTotalSalesRevenueAndProfit':
        return saleService.getTotalSalesRevenueAndProfit(db, args[0], args[1], args[2]);
      case 'getTopCustomers':
        return saleService.getTopCustomers(db, args[0], args[1], args[2], args[3]);
      case 'getAllSalesBetweenDates':
        return saleService.getAllSalesBetweenDates(db, args[0], args[1], args[2]);
      case 'getFailedSalesBetweenDates':
        return saleService.getFailedSalesBetweenDates(db, args[0], args[1], args[2]);
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
        {
          if (!canUseStore(authenticatedStaff, args[0])) return unauthorized('viewing a register shift for another store');
          let status = await registerSessionService.getRegisterSession(db, args[0], args[1], authenticatedStaff);
          if (!status.success || status.activeSession) return status;

          const centralControl = await getRegisterShiftControl(args[0]).catch(() => null);
          if (centralControl?.status !== 'open') return status;

          await syncRegisterSessionFromCentral(db, centralControl.sessionId).catch(() => null);
          status = await registerSessionService.getRegisterSession(db, args[0], args[1], authenticatedStaff);
          return { ...status, centralControl };
        }
      case 'openRegisterSession':
        {
          const payload = args[0] || {};
          if (!canUseStore(authenticatedStaff, payload.storeNo)) return unauthorized('opening a shift for another store');
          let lock;
          try {
            lock = await acquireRegisterShift(payload.storeNo, {
              id: authenticatedStaff._id,
              name: `${authenticatedStaff.firstName || ''} ${authenticatedStaff.lastName || ''}`.trim(),
            });
          } catch (error) {
            return { success: false, error: error.message };
          }
          if (!lock.success && lock.control?.sessionId) {
            let localSession = await db.get(lock.control.sessionId).catch(() => null);
            if (localSession?.status === 'closed') {
              await releaseRegisterShift(payload.storeNo, lock.control.sessionId, localSession.countedBalances).catch(() => null);
              lock = await acquireRegisterShift(payload.storeNo, { id: authenticatedStaff._id, name: `${authenticatedStaff.firstName || ''} ${authenticatedStaff.lastName || ''}`.trim() }).catch((error) => ({ success: false, error: error.message }));
            } else if (lock.control.cashier?.id === authenticatedStaff._id) {
              if (!localSession) {
                await syncRegisterSessionFromCentral(db, lock.control.sessionId).catch(() => null);
                localSession = await db.get(lock.control.sessionId).catch(() => null);
              }
              if (localSession?.status === 'open') {
                return registerSessionService.getRegisterSession(db, payload.storeNo, null, authenticatedStaff);
              }
              if (!localSession) {
                return registerSessionService.openRegisterSession(db, { ...payload, sessionId: lock.control.sessionId }, authenticatedStaff);
              }
            }
          }
          if (!lock.success) return lock;
          const opened = await registerSessionService.openRegisterSession(db, { ...payload, sessionId: lock.sessionId }, authenticatedStaff);
          if (!opened.success) {
            await releaseRegisterShift(payload.storeNo, lock.sessionId, null).catch(() => null);
          }
          return opened;
        }
      case 'takeOverRegisterSession':
        {
          const payload = args[0] || {};
          if (!canUseStore(authenticatedStaff, payload.storeNo)) return unauthorized('taking over a shift for another store');
          const reason = String(payload.reason || '').trim();
          if (!reason) return { success: false, error: 'An emergency takeover reason is required.' };
          try {
            await takeOverRegisterShift(payload.storeNo, payload.sessionId, {
              id: authenticatedStaff._id,
              name: `${authenticatedStaff.firstName || ''} ${authenticatedStaff.lastName || ''}`.trim(),
            }, reason);
          } catch (error) {
            return { success: false, error: error.message };
          }
          return registerSessionService.takeOverRegisterSession(db, payload, authenticatedStaff);
        }
      case 'closeRegisterSession':
        {
          const payload = args[0] || {};
          if (!canUseStore(authenticatedStaff, payload.storeNo)) return unauthorized('closing a shift for another store');
          try {
            await assertRegisterShiftLock(payload.storeNo, payload.sessionId, authenticatedStaff._id);
          } catch (error) {
            const localSession = await db.get(payload.sessionId).catch(() => null);
            if (localSession?.status !== 'open' || (localSession.openedBy?.id && localSession.openedBy.id !== authenticatedStaff._id)) {
              return { success: false, error: error.message };
            }
            const claimed = await acquireRegisterShift(payload.storeNo, {
              id: authenticatedStaff._id,
              name: `${authenticatedStaff.firstName || ''} ${authenticatedStaff.lastName || ''}`.trim(),
            }, payload.sessionId).catch((claimError) => ({ success: false, error: claimError.message }));
            if (!claimed.success) return claimed;
          }
          let approvalActor = null;
          if (payload.managerPhone || payload.managerPasscode) {
            const approval = await staffService.signInStaff(db, payload.managerPhone, payload.managerPasscode, payload.storeNo);
            if (!approval.success) return { success: false, error: 'Invalid manager approval credentials.' };
            approvalActor = approval.staff;
          }
          const closed = await registerSessionService.closeRegisterSession(db, payload, authenticatedStaff, approvalActor);
          if (closed.success) {
            try {
              await releaseRegisterShift(payload.storeNo, payload.sessionId, closed.closedSession?.countedBalances);
            } catch (error) {
              closed.warning = `Shift closed locally, but the central lock still needs recovery: ${error.message}`;
            }
          }
          return closed;
        }
      case 'incomeStatement':
        return financeReport.incomeStatement(db, args[0], args[1], args[2]);
      case 'getMonthlyProfitLoss':
        return financeReport.getMonthlyProfitLoss(db, args[0]);
      case 'getAccountStatement':
        return financeReport.getAccountStatement(db, args[0], args[1], args[2]);
      case 'getBalanceSheet':
        return financeReport.getBalanceSheet(db, args[0], args[1]);
      case 'getChartOfAccounts':
        return financeReport.getChartOfAccounts(db, args[0], args[1]);
      case 'getTrialBalance':
        return financeReport.getTrialBalance(db, args[0], args[1], args[2]);
      case 'getGeneralLedger':
        return financeReport.getGeneralLedger(db, args[0]);
      case 'getFinanceLedgerHealth':
        return financeReport.getFinanceLedgerHealth(db, args[0]);
      case 'previewFinanceLedgerBackfill':
        return financeReport.previewFinanceLedgerBackfill(db, args[0]);
      case 'runFinanceLedgerBackfill':
        return financeReport.runFinanceLedgerBackfill(db, args[0]);
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
        return stockAuditService.createAudit(db, args[0], authenticatedStaff);
      case 'getDailyAudit':
        if (!canUseStore(authenticatedStaff, args[0])) return unauthorized('viewing an audit for another store');
        return stockAuditService.getDailyAudit(db, args[0]);
      case 'printAuditSheets':
        {
          const auditResult = await stockAuditService.getAudit(db, args[0]);
          if (!auditResult.success) return auditResult;
          if (String(auditResult.audit.storeNo) !== String(authenticatedStaff.storeNo)) {
            return unauthorized('printing an audit for another store');
          }
          const printResult = await printerService.printAuditSheets(auditResult.audit);
          if (!printResult.success) return printResult;
          const marked = await stockAuditService.markAuditPrinted(db, args[0]);
          return marked.success
            ? { ...printResult, audit: marked.audit }
            : { ...printResult, audit: auditResult.audit, warning: `Sheets printed, but print history was not updated: ${marked.error}` };
        }
      case 'submitAudit':
        return stockAuditService.submitAudit(db, args[0], args[1], authenticatedStaff);
      case 'approveAudit':
        return stockAuditService.approveAudit(db, args[0], authenticatedStaff);
      case 'rejectAudit':
        return stockAuditService.rejectAudit(db, args[0], args[1], authenticatedStaff);
      case 'getAudit':
        {
          const result = await stockAuditService.getAudit(db, args[0]);
          if (result.success && !canUseStore(authenticatedStaff, result.audit.storeNo)) return unauthorized('viewing an audit for another store');
          return result;
        }
      case 'getAuditHistory':
        if (!canUseStore(authenticatedStaff, args[0])) return unauthorized('viewing audit history for another store');
        return stockAuditService.getAuditHistory(db, args[0], args[1]);
      case 'getAuditSummary':
        if (!canUseStore(authenticatedStaff, args[0])) return unauthorized('viewing audit summaries for another store');
        return stockAuditService.getAuditSummary(db, args[0]);
      case 'getOpenAudits':
        if (!canUseStore(authenticatedStaff, args[0])) return unauthorized('viewing audits for another store');
        return stockAuditService.getOpenAudits(db, args[0]);

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
