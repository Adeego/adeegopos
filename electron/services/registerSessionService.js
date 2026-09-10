const { v4: uuidv4 } = require('uuid');
const {
  buildActorReference,
  applyEntityBalanceDelta,
  getSaleMetricSign,
  getSalePaymentBreakdown,
  getTransactionImpactRows,
  recordLedgerEntry,
  shouldIncludeSaleInMetrics,
  shouldIncludeTransactionInMetrics,
  toNumber,
} = require('./postingService');
const { putJournalEntry } = require('./finance/journalService');
const { findAll } = require('./pouchQueryService');
const { can } = require('../../lib/rbac');

const REGISTER_ACCOUNTS_INDEX = ['register-accounts', 'register-accounts-index'];
const REGISTER_SESSIONS_INDEX = ['register-sessions', 'register-sessions-index'];
const REGISTER_SALES_INDEX = ['register-sales', 'register-sales-index'];
const REGISTER_PAID_SALES_INDEX = ['register-paid-sales', 'register-paid-sales-index'];
const REGISTER_DATED_SESSIONS_INDEX = ['register-closed-sessions', 'register-closed-sessions-index'];
const registerIndexPromises = new WeakMap();

function ensureRegisterIndexes(db) {
  if (!registerIndexPromises.has(db)) {
    registerIndexPromises.set(db, Promise.all([
      db.createIndex({ index: { fields: ['storeNo', 'type', 'state', 'accountType'] }, ddoc: REGISTER_ACCOUNTS_INDEX[0], name: REGISTER_ACCOUNTS_INDEX[1] }),
      db.createIndex({ index: { fields: ['storeNo', 'type', 'state', 'status'] }, ddoc: REGISTER_SESSIONS_INDEX[0], name: REGISTER_SESSIONS_INDEX[1] }),
      db.createIndex({ index: { fields: ['storeNo', 'type', 'state', 'status', 'openedAt'] }, ddoc: REGISTER_DATED_SESSIONS_INDEX[0], name: REGISTER_DATED_SESSIONS_INDEX[1] }),
      db.createIndex({ index: { fields: ['storeNo', 'type', 'state', 'registerSessionId'] }, ddoc: REGISTER_SALES_INDEX[0], name: REGISTER_SALES_INDEX[1] }),
      db.createIndex({ index: { fields: ['storeNo', 'type', 'state', 'paidRegisterSessionId'] }, ddoc: REGISTER_PAID_SALES_INDEX[0], name: REGISTER_PAID_SALES_INDEX[1] }),
    ]).catch((error) => {
      registerIndexPromises.delete(db);
      throw error;
    }));
  }
  return registerIndexPromises.get(db);
}

function roundCurrency(value) {
  return Number(toNumber(value).toFixed(2));
}

function normalizeStoreNo(input) {
  if (typeof input === 'string') {
    return input;
  }

  if (input && typeof input === 'object') {
    return input.storeNo || '';
  }

  return '';
}

function toDateValue(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseBusinessDate(value) {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const parsed = raw ? new Date(raw) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function toBusinessDateString(value) {
  const date = parseBusinessDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildLegacyRegisterSessionId(storeNo, businessDate) {
  return `${storeNo}:register-session:${businessDate}`;
}

function normalizeCountedBalances(input = {}, fallback = {}) {
  const cash = roundCurrency(input.cash ?? fallback.cash ?? 0);
  const mpesa = roundCurrency(input.mpesa ?? fallback.mpesa ?? 0);

  return {
    cash,
    mpesa,
    total: roundCurrency(cash + mpesa),
  };
}

function buildVariances(countedBalances, expectedBalances) {
  return {
    cash: roundCurrency(countedBalances.cash - expectedBalances.cash),
    mpesa: roundCurrency(countedBalances.mpesa - expectedBalances.mpesa),
    total: roundCurrency(countedBalances.total - expectedBalances.total),
  };
}

function buildExpectedBalances(openingBalances, movements) {
  const cash = roundCurrency((openingBalances?.cash || 0) + (movements?.cash || 0));
  const mpesa = roundCurrency((openingBalances?.mpesa || 0) + (movements?.mpesa || 0));

  return {
    cash,
    mpesa,
    total: roundCurrency(cash + mpesa),
  };
}

function toAccountSummary(account) {
  if (!account) {
    return null;
  }

  return {
    _id: account._id,
    name: account.name || '',
    accountNumber: account.accountNumber || '',
    accountType: account.accountType || '',
    balance: roundCurrency(account.balance),
    bank: account.bank || '',
  };
}

function getLinkedAccounts(accounts = [], storeNo) {
  const normalizeAccountText = (value) => String(value || '').trim().toLowerCase();
  const isCashierAccount = (account) => account?.accountType === 'Cashier';
  const looksLikeCash = (account) => {
    const text = `${account?.name || ''} ${account?.accountNumber || ''}`.toLowerCase();
    return isCashierAccount(account) && (text.includes('cash') || text.includes('drawer'));
  };
  const looksLikeMpesa = (account) => {
    const text = normalizeAccountText(`${account?.name || ''} ${account?.accountNumber || ''}`);
    return isCashierAccount(account) && (
      text.includes('mpesa') ||
      text.includes('m-pesa') ||
      text.includes('m pesa') ||
      text.includes('till')
    );
  };
  const findBySuffix = (suffix, fallbackMatcher) => {
    const exactNumber = `${storeNo}${suffix}`;
    return (
      accounts.find((account) => account.accountNumber === exactNumber) ||
      accounts.find((account) => String(account.accountNumber || '').endsWith(suffix)) ||
      accounts.find(fallbackMatcher) ||
      null
    );
  };

  const cashAccount = findBySuffix('001', looksLikeCash);
  const mpesaAccount = findBySuffix('002', looksLikeMpesa);

  return { cashAccount, mpesaAccount };
}

function normalizePaymentMethodLabel(value) {
  const method = String(value || '').trim();
  const upperMethod = method.toUpperCase();
  if (upperMethod === 'M-PESA' || upperMethod === 'PHONE') {
    return 'MPESA';
  }
  return upperMethod;
}

function paymentMatchesAccount(payment = {}, account) {
  if (!account) {
    return false;
  }

  if (payment.accountId && payment.accountId === account._id) {
    return true;
  }

  const method = String(payment.method || payment.paymentMethod || '').trim();
  if (method && method.toLowerCase() === String(account.name || '').trim().toLowerCase()) {
    return true;
  }

  const normalizedMethod = normalizePaymentMethodLabel(method);
  const accountNumber = String(account.accountNumber || '');
  return (
    (normalizedMethod === 'CASH' && accountNumber.endsWith('001')) ||
    (normalizedMethod === 'MPESA' && accountNumber.endsWith('002'))
  );
}

function matchesExpenseAccount(expense = {}, account) {
  if (!account) {
    return false;
  }

  if (expense.accountId && expense.accountId === account._id) {
    return true;
  }

  return String(expense.account || '').trim().toLowerCase() === String(account.name || '').trim().toLowerCase();
}

function isPostedExpense(expense = {}) {
  return expense.state === 'Active' && (expense.status || 'posted') === 'posted' && !expense.reversalOfId;
}

function getSetupError(storeNo, cashAccount, mpesaAccount) {
  if (!cashAccount) return `Cash account ${storeNo}001 is required before you can open or close a shift.`;
  if (!mpesaAccount) return `M-Pesa account ${storeNo}002 is required before you can open or close a shift.`;
  return null;
}

async function getIfExists(db, docId) {
  try {
    return await db.get(docId);
  } catch (error) {
    if (error?.status === 404 || error?.name === 'not_found') {
      return null;
    }
    throw error;
  }
}

async function getActiveAccounts(db, storeNo) {
  const result = await db.find({
    selector: {
      type: 'account',
      state: 'Active',
      storeNo,
    },
    use_index: REGISTER_ACCOUNTS_INDEX,
    limit: 9999,
  });

  return result.docs || [];
}

async function getOpenSession(db, storeNo) {
  const result = await db.find({
    selector: {
      type: 'register-session',
      state: 'Active',
      storeNo,
      status: 'open',
      openedAt: { $gte: '' },
    },
    use_index: REGISTER_DATED_SESSIONS_INDEX,
    limit: 2,
  });

  const openSessions = (result.docs || []).filter((session) => session.openedAt);
  if (openSessions.length > 1) {
    throw new Error('Multiple open register sessions were found. Close one before continuing.');
  }

  return openSessions[0] || null;
}

async function getPreviousClosedSession(db, storeNo) {
  const result = await db.find({
    selector: {
      type: 'register-session',
      state: 'Active',
      storeNo,
      status: 'closed',
      openedAt: { $gte: '' },
    },
    sort: [
      { storeNo: 'desc' },
      { type: 'desc' },
      { state: 'desc' },
      { status: 'desc' },
      { openedAt: 'desc' },
    ],
    use_index: REGISTER_DATED_SESSIONS_INDEX,
    limit: 1,
  });

  return result.docs?.[0] || null;
}

async function getRequestedSession(db, storeNo, ref) {
  if (!ref) {
    return null;
  }

  const rawRef = String(ref);
  const direct = await getIfExists(db, rawRef);
  if (direct?.type === 'register-session' && direct.storeNo === storeNo) {
    return direct;
  }

  const legacy = await getIfExists(db, buildLegacyRegisterSessionId(storeNo, toBusinessDateString(rawRef)));
  return legacy?.type === 'register-session' ? legacy : null;
}

function buildOpeningDefaults(previousClosedSession, linkedAccounts) {
  if (previousClosedSession) {
    const cash = previousClosedSession.closeSummary?.remainingDrawerCash
      ?? previousClosedSession.countedBalances?.cash
      ?? 0;
    const mpesa = previousClosedSession.closeSummary?.remainingMpesa
      ?? previousClosedSession.countedBalances?.mpesa
      ?? 0;

    return {
      cash: roundCurrency(cash),
      mpesa: roundCurrency(mpesa),
      total: roundCurrency(roundCurrency(cash) + roundCurrency(mpesa)),
    };
  }

  const cash = roundCurrency(linkedAccounts.cashAccount?.balance || 0);
  const mpesa = roundCurrency(linkedAccounts.mpesaAccount?.balance || 0);
  return {
    cash,
    mpesa,
    total: roundCurrency(cash + mpesa),
  };
}

function getMovementTimestamp(doc = {}) {
  return toDateValue(doc.paidAt || doc.createdAt || doc.date || doc.updatedAt);
}

function isSessionMovement(doc = {}, session = {}) {
  const sessionId = session._id;
  if (!sessionId) {
    return false;
  }

  const docSessionId = doc.paidRegisterSessionId || doc.registerSessionId || doc.metadata?.registerSessionId || null;
  if (docSessionId) {
    return docSessionId === sessionId;
  }

  const openedAt = toDateValue(session.openedAt || session.createdAt);
  if (!openedAt) {
    return false;
  }

  const movementAt = getMovementTimestamp(doc);
  if (!movementAt || movementAt < openedAt) {
    return false;
  }

  const closedAt = toDateValue(session.closedAt);
  if (closedAt && movementAt > closedAt) {
    return false;
  }

  return true;
}

async function getSessionAccountMovements(db, storeNo, session, linkedAccounts) {
  const sessionSelector = { storeNo, state: 'Active', registerSessionId: session._id };
  const [sessionSalesResult, receivedSalesResult, transactionsResult, expensesResult] = await Promise.all([
    findAll(db, {
      selector: { ...sessionSelector, type: 'sale' },
      use_index: REGISTER_SALES_INDEX,
    }),
    findAll(db, {
      selector: { type: 'sale', state: 'Active', storeNo, paidRegisterSessionId: session._id },
      use_index: REGISTER_PAID_SALES_INDEX,
    }),
    findAll(db, {
      selector: { ...sessionSelector, type: 'transaction' },
      use_index: REGISTER_SALES_INDEX,
    }),
    findAll(db, {
      selector: { ...sessionSelector, type: 'expense' },
      use_index: REGISTER_SALES_INDEX,
    }),
  ]);
  const sales = [...new Map([
    ...(sessionSalesResult.docs || []),
    ...(receivedSalesResult.docs || []),
  ].map((sale) => [sale._id, sale])).values()];

  let cash = 0;
  let mpesa = 0;

  for (const sale of sales) {
    if (!isSessionMovement(sale, session)) {
      continue;
    }

    if (!shouldIncludeSaleInMetrics(sale) || sale.paid !== true) {
      continue;
    }

    const sign = getSaleMetricSign(sale);
    for (const payment of getSalePaymentBreakdown(sale)) {
      const gross = Math.abs(toNumber(payment.amount));
      const fee = Math.abs(toNumber(payment.transactionCost));
      const amount = roundCurrency(sign < 0 ? -(gross + fee) : (gross - fee));

      if (paymentMatchesAccount(payment, linkedAccounts.cashAccount)) {
        cash = roundCurrency(cash + amount);
      }

      if (paymentMatchesAccount(payment, linkedAccounts.mpesaAccount)) {
        mpesa = roundCurrency(mpesa + amount);
      }
    }
  }

  for (const transaction of transactionsResult.docs || []) {
    if (!isSessionMovement(transaction, session)) {
      continue;
    }

    if (transaction.metadata?.registerClose || !shouldIncludeTransactionInMetrics(transaction)) {
      continue;
    }

    const rows = getTransactionImpactRows(transaction, { direction: 1 });
    for (const row of rows) {
      if (row.entityType !== 'account' || !row.entityId) {
        continue;
      }

      if (row.entityId === linkedAccounts.cashAccount?._id) {
        cash = roundCurrency(cash + row.delta);
      }

      if (row.entityId === linkedAccounts.mpesaAccount?._id) {
        mpesa = roundCurrency(mpesa + row.delta);
      }
    }
  }

  for (const expense of expensesResult.docs || []) {
    if (!isSessionMovement(expense, session)) {
      continue;
    }

    if (!isPostedExpense(expense)) {
      continue;
    }

    const amount = roundCurrency(Math.abs(toNumber(expense.amount)) + Math.abs(toNumber(expense.transactionCost)));
    if (matchesExpenseAccount(expense, linkedAccounts.cashAccount)) {
      cash = roundCurrency(cash - amount);
    }

    if (matchesExpenseAccount(expense, linkedAccounts.mpesaAccount)) {
      mpesa = roundCurrency(mpesa - amount);
    }
  }

  return {
    cash: roundCurrency(cash),
    mpesa: roundCurrency(mpesa),
    total: roundCurrency(cash + mpesa),
  };
}

async function getUnpaidDeclarations(db, storeNo, session) {
  const result = await findAll(db, {
    selector: { type: 'sale', state: 'Active', storeNo, registerSessionId: session._id },
    use_index: REGISTER_SALES_INDEX,
  });
  return (result.docs || [])
    .filter((sale) => {
      if (sale.paid === true || !isSessionMovement(sale, session) || !shouldIncludeSaleInMetrics(sale)) return false;
      return getSalePaymentBreakdown(sale).some((payment) => normalizePaymentMethodLabel(payment.method) !== 'CREDIT');
    })
    .map((sale) => ({
      saleId: sale._id,
      createdAt: sale.createdAt,
      customerId: sale.currentCustomerId || sale.customerId || null,
      servedBy: sale.servedBy || '',
      totalAmount: roundCurrency(Math.abs(toNumber(sale.totalAmount))),
      paymentMethod: sale.paymentMethod,
      paymentBreakdown: getSalePaymentBreakdown(sale),
    }))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

async function loadRegisterContext(db, storeNoInput) {
  const storeNo = normalizeStoreNo(storeNoInput);
  if (!storeNo) {
    throw new Error('storeNo is required');
  }

  const [accounts, previousClosedSession] = await Promise.all([
    getActiveAccounts(db, storeNo),
    getPreviousClosedSession(db, storeNo),
  ]);
  const linkedAccounts = getLinkedAccounts(accounts, storeNo);

  return {
    storeNo,
    accounts,
    linkedAccounts,
    previousClosedSession,
    openingDefaults: buildOpeningDefaults(previousClosedSession, linkedAccounts),
    setupError: getSetupError(storeNo, linkedAccounts.cashAccount, linkedAccounts.mpesaAccount),
  };
}

async function toSessionResponse(db, context, sessionDoc, options = {}) {
  if (!sessionDoc) {
    return null;
  }

  const blindActive = Boolean(options.blindActive && sessionDoc.status === 'open');
  const openingBalances = normalizeCountedBalances(sessionDoc.openingBalances, sessionDoc.openingBalances);
  const movements = blindActive
    ? null
    : sessionDoc.status === 'closed'
    ? {
        cash: roundCurrency((sessionDoc.expectedBalances?.cash || 0) - openingBalances.cash),
        mpesa: roundCurrency((sessionDoc.expectedBalances?.mpesa || 0) - openingBalances.mpesa),
        total: roundCurrency((sessionDoc.expectedBalances?.total || 0) - openingBalances.total),
      }
    : await getSessionAccountMovements(db, context.storeNo, sessionDoc, context.linkedAccounts);

  const expectedBalances = blindActive
    ? null
    : sessionDoc.status === 'closed'
    ? normalizeCountedBalances(sessionDoc.expectedBalances, sessionDoc.expectedBalances)
    : buildExpectedBalances(openingBalances, movements);
  const countedBalances = normalizeCountedBalances(sessionDoc.countedBalances, sessionDoc.countedBalances);
  const variances = blindActive
    ? null
    : sessionDoc.status === 'closed' && sessionDoc.variances
    ? normalizeCountedBalances(sessionDoc.variances, sessionDoc.variances)
    : buildVariances(countedBalances, expectedBalances);
  const unpaidDeclarations = sessionDoc.status === 'closed'
    ? (sessionDoc.unpaidDeclarations || [])
    : await getUnpaidDeclarations(db, context.storeNo, sessionDoc);

  return {
    ...sessionDoc,
    businessDate: sessionDoc.businessDate || toBusinessDateString(sessionDoc.openedAt || sessionDoc.createdAt),
    linkedAccountIds: {
      cash: sessionDoc.linkedAccountIds?.cash || context.linkedAccounts.cashAccount?._id || null,
      mpesa: sessionDoc.linkedAccountIds?.mpesa || context.linkedAccounts.mpesaAccount?._id || null,
    },
    linkedAccounts: {
      cash: toAccountSummary(context.linkedAccounts.cashAccount),
      mpesa: toAccountSummary(context.linkedAccounts.mpesaAccount),
    },
    setupError: context.setupError,
    openingBalances,
    movements,
    expectedBalances,
    countedBalances,
    variances,
    unpaidDeclarations,
  };
}

function redactLiveBalances(session, actor) {
  if (!session || !actor) return session;
  return {
    ...session,
    movements: null,
    expectedBalances: null,
    variances: null,
    linkedAccounts: {
      cash: session.linkedAccounts?.cash ? { ...session.linkedAccounts.cash, balance: null } : null,
      mpesa: session.linkedAccounts?.mpesa ? { ...session.linkedAccounts.mpesa, balance: null } : null,
    },
  };
}

async function buildRegisterStatus(db, context, activeSession, requestedSession = null, actor = null) {
  const responseOptions = { blindActive: Boolean(actor) };
  const [activeResponse, previousClosedSessionResponse, requestedResponse] = await Promise.all([
    toSessionResponse(db, context, activeSession, responseOptions),
    toSessionResponse(db, context, context.previousClosedSession),
    requestedSession && requestedSession._id !== activeSession?._id
      ? toSessionResponse(db, context, requestedSession, responseOptions)
      : Promise.resolve(null),
  ]);
  const activeSessionResponse = redactLiveBalances(activeResponse, actor);
  const requestedSessionResponse = requestedSession?._id === activeSession?._id
    ? activeSessionResponse
    : redactLiveBalances(requestedResponse, actor);

  return {
    success: true,
    activeSession: activeSessionResponse,
    session: requestedSessionResponse || activeSessionResponse,
    requestedSession: requestedSessionResponse,
    previousClosedSession: previousClosedSessionResponse,
    openingDefaults: context.openingDefaults,
    setupError: context.setupError,
  };
}

async function getRegisterSession(db, storeNoInput, requestedRef = null, actor = null) {
  try {
    await ensureRegisterIndexes(db);
    const storeNo = normalizeStoreNo(storeNoInput);
    if (!storeNo) throw new Error('storeNo is required');
    const [context, activeSession, requestedSession] = await Promise.all([
      loadRegisterContext(db, storeNo),
      getOpenSession(db, storeNo),
      getRequestedSession(db, storeNo, requestedRef),
    ]);

    return buildRegisterStatus(db, context, activeSession, requestedSession, actor);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function setInitialRegisterBalance(db, { account, balance, sessionId, sourceKey, storeNo, actor, now }) {
  const delta = roundCurrency(balance - toNumber(account.balance));
  if (!delta) return null;
  const doc = {
    _id: `${sessionId}:initial-balance:${sourceKey}`,
    type: 'register-adjustment', state: 'Active', status: 'posted', storeNo,
    registerSessionId: sessionId, accountId: account._id, source: sourceKey,
    previousBalance: roundCurrency(account.balance), actualBalance: balance, delta,
    reason: 'Initial register balance established by manager', createdBy: buildActorReference(actor),
    createdAt: now, updatedAt: now,
  };
  await db.put(doc);
  await applyEntityBalanceDelta(db, 'account', account._id, delta);
  await recordLedgerEntry(db, {
    _id: `${doc._id}:ledger`, storeNo, entityType: 'account', entityId: account._id,
    bucket: 'account_balance', delta, description: doc.reason,
    sourceDocType: 'register-adjustment', sourceDocId: doc._id, date: now,
    metadata: { registerSessionId: sessionId, createdBy: doc.createdBy },
  });
  const amount = Math.abs(delta);
  await putJournalEntry(db, {
    storeNo, sourceDocType: 'register-adjustment', sourceDocId: doc._id, description: doc.reason, date: now,
    lines: [
      { accountCode: sourceKey === 'cash' ? '1110' : '1120', accountName: sourceKey === 'cash' ? 'Cash' : 'M-Pesa', debit: delta > 0 ? amount : 0, credit: delta < 0 ? amount : 0, entityType: 'account', entityId: account._id },
      { accountCode: '3999', accountName: 'Opening Balance Equity', debit: delta < 0 ? amount : 0, credit: delta > 0 ? amount : 0 },
    ],
  });
  return doc;
}

async function openRegisterSession(db, payload = {}, actor = null) {
  try {
    await ensureRegisterIndexes(db);
    const context = await loadRegisterContext(db, payload.storeNo);
    if (context.setupError) {
      return { success: false, error: context.setupError };
    }

    const existingOpenSession = await getOpenSession(db, context.storeNo);
    if (existingOpenSession) {
      return { success: false, error: 'A register session is already open for this store.' };
    }

    if (!actor?._id) {
      return { success: false, error: 'An authenticated cashier is required to open a shift.' };
    }

    if (!context.previousClosedSession && !can(actor, 'cashier:manage')) {
      return { success: false, error: 'A POS manager must establish the first shift opening balances.' };
    }
    const openingBalances = context.previousClosedSession
      ? normalizeCountedBalances(context.openingDefaults)
      : normalizeCountedBalances(payload.openingBalances);
    if (openingBalances.cash < 0 || openingBalances.mpesa < 0) {
      return { success: false, error: 'Opening balances cannot be negative.' };
    }

    const now = new Date().toISOString();
    const sessionId = payload.sessionId || `${context.storeNo}:register-session:${uuidv4()}`;
    if (!context.previousClosedSession) {
      await Promise.all([
        setInitialRegisterBalance(db, { account: context.linkedAccounts.cashAccount, balance: openingBalances.cash, sessionId, sourceKey: 'cash', storeNo: context.storeNo, actor, now }),
        setInitialRegisterBalance(db, { account: context.linkedAccounts.mpesaAccount, balance: openingBalances.mpesa, sessionId, sourceKey: 'mpesa', storeNo: context.storeNo, actor, now }),
      ]);
    }
    const sessionDoc = {
      _id: sessionId,
      type: 'register-session',
      state: 'Active',
      storeNo: context.storeNo,
      businessDate: toBusinessDateString(now),
      status: 'open',
      linkedAccountIds: {
        cash: context.linkedAccounts.cashAccount?._id || null,
        mpesa: context.linkedAccounts.mpesaAccount?._id || null,
      },
      openingBalances,
      expectedBalances: openingBalances,
      countedBalances: normalizeCountedBalances(),
      variances: buildVariances(normalizeCountedBalances(), openingBalances),
      transfer: null,
      closeSummary: null,
      notes: payload.notes || '',
      openedAt: now,
      openedBy: buildActorReference(actor),
      createdAt: now,
      updatedAt: now,
      closedAt: null,
      closedBy: null,
    };

    await db.put(sessionDoc);

    return buildRegisterStatus(db, context, sessionDoc, null, actor);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function putSession(db, sessionDoc) {
  const current = await getIfExists(db, sessionDoc._id);
  const response = await db.put({
    ...sessionDoc,
    ...(current?._rev ? { _rev: current._rev } : {}),
  });

  return {
    ...sessionDoc,
    _rev: response.rev,
  };
}

function assertActiveSession(activeSession, requestedSessionId) {
  if (!activeSession) {
    return 'Open register first before saving or closing the register.';
  }

  if (requestedSessionId && requestedSessionId !== activeSession._id) {
    return 'This register session is no longer open. Refresh and try again.';
  }

  return null;
}

function getActorId(actor = {}) {
  return actor?._id || actor?.id || null;
}

async function reconcileRegisterAccount(db, { account, actualBalance, session, actor, approvedBy, sourceKey, now }) {
  const delta = roundCurrency(actualBalance - toNumber(account.balance));
  if (!delta) return null;
  const adjustment = {
    _id: `${session._id}:balance-adjustment:${sourceKey}`,
    type: 'register-adjustment', state: 'Active', status: 'posted', storeNo: session.storeNo,
    registerSessionId: session._id, accountId: account._id, source: sourceKey,
    previousBalance: roundCurrency(account.balance), actualBalance, delta,
    reason: 'Approved shift closing variance reconciliation',
    createdBy: buildActorReference(actor), approvedBy: buildActorReference(approvedBy),
    createdAt: now, updatedAt: now,
  };
  await db.put(adjustment);
  await applyEntityBalanceDelta(db, 'account', account._id, delta);
  await recordLedgerEntry(db, {
    _id: `${adjustment._id}:ledger`, storeNo: session.storeNo,
    entityType: 'account', entityId: account._id, bucket: 'account_balance', delta,
    description: adjustment.reason, sourceDocType: 'register-adjustment', sourceDocId: adjustment._id,
    date: now, metadata: { registerSessionId: session._id, approvedBy: adjustment.approvedBy },
  });
  const accountCode = sourceKey === 'cash' ? '1110' : '1120';
  const accountName = sourceKey === 'cash' ? 'Cash' : 'M-Pesa';
  const offset = { accountCode: '5295', accountName: 'Cash Over/Short' };
  const accountLine = { accountCode, accountName, debit: delta > 0 ? Math.abs(delta) : 0, credit: delta < 0 ? Math.abs(delta) : 0, entityType: 'account', entityId: account._id };
  const offsetLine = { ...offset, debit: delta < 0 ? Math.abs(delta) : 0, credit: delta > 0 ? Math.abs(delta) : 0 };
  await putJournalEntry(db, {
    storeNo: session.storeNo, sourceDocType: 'register-adjustment', sourceDocId: adjustment._id,
    description: adjustment.reason, date: now, lines: [accountLine, offsetLine],
    metadata: { registerSessionId: session._id, approvedBy: adjustment.approvedBy },
  });
  return adjustment;
}

async function closeRegisterSession(db, payload = {}, actor = null, approvalActor = null) {
  try {
    await ensureRegisterIndexes(db);
    const context = await loadRegisterContext(db, payload.storeNo);
    if (context.setupError) return { success: false, error: context.setupError };
    const activeSession = await getOpenSession(db, context.storeNo);
    const activeSessionError = assertActiveSession(activeSession, payload.sessionId);
    if (activeSessionError) return { success: false, error: activeSessionError };
    if (!actor || getActorId(actor) !== getActorId(activeSession.openedBy)) {
      return { success: false, error: 'Only the assigned cashier can close this shift.' };
    }

    const countedBalances = normalizeCountedBalances(payload.countedBalances, activeSession.countedBalances);
    if (countedBalances.cash < 0 || countedBalances.mpesa < 0) return { success: false, error: 'Closing balances cannot be negative.' };
    const [movements, unresolved] = await Promise.all([
      getSessionAccountMovements(db, context.storeNo, activeSession, context.linkedAccounts),
      getUnpaidDeclarations(db, context.storeNo, activeSession),
    ]);
    const expectedBalances = buildExpectedBalances(activeSession.openingBalances, movements);
    const variances = buildVariances(countedBalances, expectedBalances);
    const declarationsById = new Map((payload.unpaidDeclarations || []).map((entry) => [entry.saleId, String(entry.reason || '').trim()]));
    const unpaidDeclarations = unresolved.map((sale) => ({ ...sale, reason: declarationsById.get(sale.saleId) || '' }));
    if (unpaidDeclarations.some((entry) => !entry.reason)) {
      return { success: false, error: 'Every unpaid non-credit sale requires a closing declaration reason.' };
    }

    const hasVariance = Math.abs(variances.cash) > 0.009 || Math.abs(variances.mpesa) > 0.009;
    const needsApproval = hasVariance || unpaidDeclarations.length > 0;
    if (needsApproval) {
      if (!approvalActor || !can(approvalActor, 'cashier:manage') || getActorId(approvalActor) === getActorId(actor) || String(approvalActor.storeNo) !== String(context.storeNo)) {
        return { success: false, approvalRequired: true, error: 'A different POS manager must approve shortages, overages, or unpaid declarations.' };
      }
    }

    const now = new Date().toISOString();
    let adjustments = [];
    if (hasVariance) {
      adjustments = await Promise.all([
        reconcileRegisterAccount(db, { account: context.linkedAccounts.cashAccount, actualBalance: countedBalances.cash, session: activeSession, actor, approvedBy: approvalActor, sourceKey: 'cash', now }),
        reconcileRegisterAccount(db, { account: context.linkedAccounts.mpesaAccount, actualBalance: countedBalances.mpesa, session: activeSession, actor, approvedBy: approvalActor, sourceKey: 'mpesa', now }),
      ]);
    }
    const updatedSession = {
      ...activeSession, status: 'closed', expectedBalances, countedBalances, variances,
      unpaidDeclarations, exceptionApprovedBy: needsApproval ? buildActorReference(approvalActor) : null,
      transfer: null, adjustments: adjustments.filter(Boolean),
      closeSummary: { remainingDrawerCash: countedBalances.cash, remainingMpesa: countedBalances.mpesa },
      notes: payload.notes ?? activeSession.notes ?? '', closedAt: now,
      closedBy: buildActorReference(actor), updatedAt: now,
    };
    const closedSession = await putSession(db, updatedSession);
    const closedContext = {
      ...context,
      previousClosedSession: closedSession,
      openingDefaults: buildOpeningDefaults(closedSession, context.linkedAccounts),
    };
    const status = await buildRegisterStatus(db, closedContext, null, closedSession);
    return { ...status, activeSession: null, closedSession: status.session };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function takeOverRegisterSession(db, payload = {}, actor = null) {
  try {
    await ensureRegisterIndexes(db);
    const reason = String(payload.reason || '').trim();
    if (!reason) return { success: false, error: 'An emergency takeover reason is required.' };
    if (!actor || !can(actor, 'cashier:manage') || String(actor.storeNo) !== String(payload.storeNo)) {
      return { success: false, error: 'POS Manage access is required for an emergency takeover.' };
    }
    const activeSession = await getOpenSession(db, payload.storeNo);
    const activeSessionError = assertActiveSession(activeSession, payload.sessionId);
    if (activeSessionError) return { success: false, error: activeSessionError };
    if (getActorId(actor) === getActorId(activeSession.openedBy)) return { success: false, error: 'You already own this shift.' };
    const now = new Date().toISOString();
    const takeover = { from: activeSession.openedBy, to: buildActorReference(actor), reason, at: now };
    const updated = await putSession(db, {
      ...activeSession,
      originalOpenedBy: activeSession.originalOpenedBy || activeSession.openedBy,
      openedBy: takeover.to,
      takeoverHistory: [...(activeSession.takeoverHistory || []), takeover],
      updatedAt: now,
    });
    const context = await loadRegisterContext(db, payload.storeNo);
    return buildRegisterStatus(db, context, updated, null, actor);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  closeRegisterSession,
  getRegisterSession,
  openRegisterSession,
  takeOverRegisterSession,
};
