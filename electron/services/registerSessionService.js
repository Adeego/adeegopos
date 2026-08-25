const { v4: uuidv4 } = require('uuid');
const {
  buildActorReference,
  getSaleMetricSign,
  getSalePaymentBreakdown,
  getTransactionImpactRows,
  postTransaction,
  shouldIncludeSaleInMetrics,
  shouldIncludeTransactionInMetrics,
  toNumber,
} = require('./postingService');
const { ensureJournalEntryForTransaction } = require('./finance/journalService');
const { findAll } = require('./pouchQueryService');

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

  return {
    cashAccount,
    mpesaAccount,
    availableTransferAccounts: accounts
      .filter((account) => account.accountType === 'Admin')
      .map(toAccountSummary),
  };
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

function getSetupError(storeNo, cashAccount) {
  if (cashAccount) {
    return null;
  }

  return `Cash account ${storeNo}001 is required before you can open, save, or close the register.`;
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
    limit: 9999,
  });

  return result.docs || [];
}

function sessionSortValue(session = {}) {
  const date = toDateValue(session.closedAt || session.openedAt || session.createdAt || session.updatedAt);
  if (date) {
    return date.getTime();
  }

  const businessDate = toDateValue(session.businessDate);
  return businessDate ? businessDate.getTime() : 0;
}

async function getOpenSession(db, storeNo) {
  const result = await db.find({
    selector: {
      type: 'register-session',
      state: 'Active',
      storeNo,
      status: 'open',
    },
    limit: 9999,
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
    },
    limit: 9999,
  });

  return (result.docs || [])
    .sort((a, b) => sessionSortValue(b) - sessionSortValue(a))[0] || null;
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
  return toDateValue(doc.createdAt || doc.date || doc.updatedAt);
}

function isSessionMovement(doc = {}, session = {}) {
  const sessionId = session._id;
  if (!sessionId) {
    return false;
  }

  const docSessionId = doc.registerSessionId || doc.metadata?.registerSessionId || null;
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
  const [salesResult, transactionsResult, expensesResult] = await Promise.all([
    findAll(db, {
      selector: {
        type: 'sale',
        state: 'Active',
        storeNo,
      },
    }),
    findAll(db, {
      selector: {
        type: 'transaction',
        state: 'Active',
        storeNo,
      },
    }),
    db.find({
      selector: {
        type: 'expense',
        state: 'Active',
        storeNo,
      },
      limit: 9999,
    }),
  ]);

  let cash = 0;
  let mpesa = 0;

  for (const sale of salesResult.docs || []) {
    if (!isSessionMovement(sale, session)) {
      continue;
    }

    if (!shouldIncludeSaleInMetrics(sale)) {
      continue;
    }

    const sign = getSaleMetricSign(sale);
    for (const payment of getSalePaymentBreakdown(sale)) {
      const amount = roundCurrency(Math.abs(toNumber(payment.amount)) * sign);

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

async function loadRegisterContext(db, storeNoInput) {
  const storeNo = normalizeStoreNo(storeNoInput);
  if (!storeNo) {
    throw new Error('storeNo is required');
  }

  const accounts = await getActiveAccounts(db, storeNo);
  const linkedAccounts = getLinkedAccounts(accounts, storeNo);
  const previousClosedSession = await getPreviousClosedSession(db, storeNo);

  return {
    storeNo,
    accounts,
    linkedAccounts,
    previousClosedSession,
    openingDefaults: buildOpeningDefaults(previousClosedSession, linkedAccounts),
    setupError: getSetupError(storeNo, linkedAccounts.cashAccount),
  };
}

async function toSessionResponse(db, context, sessionDoc) {
  if (!sessionDoc) {
    return null;
  }

  const openingBalances = normalizeCountedBalances(sessionDoc.openingBalances, sessionDoc.openingBalances);
  const movements = sessionDoc.status === 'closed'
    ? {
        cash: roundCurrency((sessionDoc.expectedBalances?.cash || 0) - openingBalances.cash),
        mpesa: roundCurrency((sessionDoc.expectedBalances?.mpesa || 0) - openingBalances.mpesa),
        total: roundCurrency((sessionDoc.expectedBalances?.total || 0) - openingBalances.total),
      }
    : await getSessionAccountMovements(db, context.storeNo, sessionDoc, context.linkedAccounts);

  const expectedBalances = sessionDoc.status === 'closed'
    ? normalizeCountedBalances(sessionDoc.expectedBalances, sessionDoc.expectedBalances)
    : buildExpectedBalances(openingBalances, movements);
  const countedBalances = normalizeCountedBalances(sessionDoc.countedBalances, sessionDoc.countedBalances);
  const variances = sessionDoc.status === 'closed' && sessionDoc.variances
    ? normalizeCountedBalances(sessionDoc.variances, sessionDoc.variances)
    : buildVariances(countedBalances, expectedBalances);

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
    availableTransferAccounts: context.linkedAccounts.availableTransferAccounts,
    setupError: context.setupError,
    openingBalances,
    movements,
    expectedBalances,
    countedBalances,
    variances,
  };
}

async function buildRegisterStatus(db, context, activeSession, requestedSession = null) {
  const activeSessionResponse = await toSessionResponse(db, context, activeSession);
  const previousClosedSessionResponse = await toSessionResponse(db, context, context.previousClosedSession);
  const requestedSessionResponse = await toSessionResponse(db, context, requestedSession);

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

async function getRegisterSession(db, storeNoInput, requestedRef = null) {
  try {
    const context = await loadRegisterContext(db, storeNoInput);
    const [activeSession, requestedSession] = await Promise.all([
      getOpenSession(db, context.storeNo),
      getRequestedSession(db, context.storeNo, requestedRef),
    ]);

    return buildRegisterStatus(db, context, activeSession, requestedSession);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function openRegisterSession(db, payload = {}, actor = null) {
  try {
    const context = await loadRegisterContext(db, payload.storeNo);
    if (context.setupError) {
      return { success: false, error: context.setupError };
    }

    const existingOpenSession = await getOpenSession(db, context.storeNo);
    if (existingOpenSession) {
      return { success: false, error: 'A register session is already open for this store.' };
    }

    const openingBalances = normalizeCountedBalances(payload.openingBalances, context.openingDefaults);
    if (openingBalances.cash < 0 || openingBalances.mpesa < 0) {
      return { success: false, error: 'Opening balances cannot be negative.' };
    }

    const now = new Date().toISOString();
    const sessionDoc = {
      _id: `${context.storeNo}:register-session:${uuidv4()}`,
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

    const refreshedContext = await loadRegisterContext(db, context.storeNo);
    return buildRegisterStatus(db, refreshedContext, sessionDoc);
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

function normalizeCloseTransferInput(sourceInput = {}, defaultDescription) {
  return {
    destinationAccountId: sourceInput.destinationAccountId || null,
    amount: roundCurrency(sourceInput.amount ?? 0),
    transactionCost: roundCurrency(sourceInput.transactionCost ?? 0),
    description: sourceInput.description || defaultDescription,
  };
}

function normalizeCloseTransfers(transfer = {}, businessDate) {
  const defaultDescription = `Register close transfer for ${businessDate}`;
  const hasLegacyTransfer = transfer.amount !== undefined
    || transfer.transactionCost !== undefined
    || transfer.destinationAccountId;

  return {
    cash: normalizeCloseTransferInput(
      hasLegacyTransfer ? transfer : transfer.cash,
      transfer.cash?.description || transfer.description || defaultDescription,
    ),
    mpesa: normalizeCloseTransferInput(
      transfer.mpesa,
      transfer.mpesa?.description || defaultDescription,
    ),
  };
}

function validateCloseTransfer({ sourceLabel, transfer, countedBalance, sourceAccount, adminAccounts }) {
  if (transfer.amount < 0) {
    return `${sourceLabel} transfer amount cannot be negative.`;
  }

  if (transfer.transactionCost < 0) {
    return `${sourceLabel} transfer cost cannot be negative.`;
  }

  if (transfer.amount === 0 && transfer.transactionCost > 0) {
    return `${sourceLabel} transfer cost requires a transfer amount.`;
  }

  if (roundCurrency(transfer.amount + transfer.transactionCost) > countedBalance) {
    return `${sourceLabel} transfer amount plus transfer cost cannot exceed the counted ${sourceLabel.toLowerCase()} closing balance.`;
  }

  if (transfer.amount === 0) {
    return null;
  }

  if (!sourceAccount) {
    return `${sourceLabel} cashier account is required before closing with a ${sourceLabel} transfer.`;
  }

  const destinationAccount = adminAccounts.find((account) => account._id === transfer.destinationAccountId) || null;
  if (!destinationAccount) {
    return `Select an active Admin account for the ${sourceLabel} close transfer.`;
  }

  return null;
}

function buildCloseTransferRecord({ transfer, destinationAccount, sourceLabel, transactionId }) {
  return {
    source: sourceLabel.toLowerCase(),
    destinationAccountId: destinationAccount._id,
    destinationAccountName: destinationAccount.name || '',
    amount: transfer.amount,
    transactionCost: transfer.transactionCost,
    description: transfer.description,
    transactionId,
  };
}

async function postCloseTransfer(db, {
  activeSession,
  actor,
  context,
  destinationAccount,
  sourceAccount,
  sourceKey,
  sourceLabel,
  transfer,
  timestamp,
}) {
  if (transfer.amount <= 0) {
    return null;
  }

  const transferTransactionId = `${activeSession._id}:close-transfer:${sourceKey}`;
  const existingTransfer = await getIfExists(db, transferTransactionId);

  if (existingTransfer) {
    return buildCloseTransferRecord({
      transfer: {
        ...transfer,
        transactionCost: roundCurrency(existingTransfer.transactionCost),
      },
      destinationAccount,
      sourceLabel,
      transactionId: existingTransfer._id,
    });
  }

  const transactionResult = await postTransaction(db, {
    _id: transferTransactionId,
    description: transfer.description,
    transType: 'withdraw',
    source: 'account',
    destination: 'account',
    from: sourceAccount._id,
    to: destinationAccount._id,
    amount: transfer.amount,
    transactionCost: transfer.transactionCost,
    storeNo: context.storeNo,
    date: timestamp,
    metadata: {
      registerSessionId: activeSession._id,
      businessDate: activeSession.businessDate,
      registerClose: true,
      registerCloseSource: sourceKey,
      actor: buildActorReference(actor),
    },
  }, { direction: 1, skipRegisterSessionRequirement: true });

  if (!transactionResult.success) {
    return transactionResult;
  }

  const journalResult = await ensureJournalEntryForTransaction(db, transactionResult.transaction);
  if (!journalResult.success) {
    return journalResult;
  }

  return buildCloseTransferRecord({
    transfer,
    destinationAccount,
    sourceLabel,
    transactionId: transactionResult.transaction?._id || null,
  });
}

async function saveRegisterSession(db, draft = {}) {
  try {
    const context = await loadRegisterContext(db, draft.storeNo);
    if (context.setupError) {
      return { success: false, error: context.setupError };
    }

    const activeSession = await getOpenSession(db, context.storeNo);
    const activeSessionError = assertActiveSession(activeSession, draft.sessionId);
    if (activeSessionError) {
      return { success: false, error: activeSessionError };
    }

    const countedBalances = normalizeCountedBalances(draft.countedBalances, activeSession.countedBalances);
    if (countedBalances.cash < 0 || countedBalances.mpesa < 0) {
      return { success: false, error: 'Counted balances cannot be negative.' };
    }

    const movements = await getSessionAccountMovements(db, context.storeNo, activeSession, context.linkedAccounts);
    const expectedBalances = buildExpectedBalances(activeSession.openingBalances, movements);
    const updatedSession = {
      ...activeSession,
      linkedAccountIds: {
        cash: context.linkedAccounts.cashAccount?._id || null,
        mpesa: context.linkedAccounts.mpesaAccount?._id || null,
      },
      expectedBalances,
      countedBalances,
      variances: buildVariances(countedBalances, expectedBalances),
      notes: draft.notes ?? activeSession.notes ?? '',
      updatedAt: new Date().toISOString(),
    };

    const savedSession = await putSession(db, updatedSession);
    const refreshedContext = await loadRegisterContext(db, context.storeNo);
    return buildRegisterStatus(db, refreshedContext, savedSession);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function closeRegisterSession(db, payload = {}, actor = null) {
  try {
    const context = await loadRegisterContext(db, payload.storeNo);
    if (context.setupError) {
      return { success: false, error: context.setupError };
    }

    const activeSession = await getOpenSession(db, context.storeNo);
    const activeSessionError = assertActiveSession(activeSession, payload.sessionId);
    if (activeSessionError) {
      return { success: false, error: activeSessionError };
    }

    const countedBalances = normalizeCountedBalances(payload.countedBalances, activeSession.countedBalances);
    if (countedBalances.cash < 0 || countedBalances.mpesa < 0) {
      return { success: false, error: 'Counted balances cannot be negative.' };
    }

    const adminAccounts = context.accounts.filter((account) => account.accountType === 'Admin');
    const closeTransfers = normalizeCloseTransfers(payload.transfer || {}, activeSession.businessDate);
    const transferValidationError = validateCloseTransfer({
      sourceLabel: 'Cash',
      transfer: closeTransfers.cash,
      countedBalance: countedBalances.cash,
      sourceAccount: context.linkedAccounts.cashAccount,
      adminAccounts,
    }) || validateCloseTransfer({
      sourceLabel: 'M-Pesa',
      transfer: closeTransfers.mpesa,
      countedBalance: countedBalances.mpesa,
      sourceAccount: context.linkedAccounts.mpesaAccount,
      adminAccounts,
    });

    if (transferValidationError) {
      return { success: false, error: transferValidationError };
    }

    const movements = await getSessionAccountMovements(db, context.storeNo, activeSession, context.linkedAccounts);
    const expectedBalances = buildExpectedBalances(activeSession.openingBalances, movements);
    const variances = buildVariances(countedBalances, expectedBalances);
    const remainingDrawerCash = roundCurrency(
      countedBalances.cash - closeTransfers.cash.amount - closeTransfers.cash.transactionCost,
    );
    const remainingMpesa = roundCurrency(
      countedBalances.mpesa - closeTransfers.mpesa.amount - closeTransfers.mpesa.transactionCost,
    );
    const now = new Date().toISOString();

    const cashDestinationAccount = adminAccounts.find((account) => account._id === closeTransfers.cash.destinationAccountId) || null;
    const mpesaDestinationAccount = adminAccounts.find((account) => account._id === closeTransfers.mpesa.destinationAccountId) || null;
    const cashTransferRecord = await postCloseTransfer(db, {
      activeSession,
      actor,
      context,
      destinationAccount: cashDestinationAccount,
      sourceAccount: context.linkedAccounts.cashAccount,
      sourceKey: 'cash',
      sourceLabel: 'Cash',
      transfer: closeTransfers.cash,
      timestamp: now,
    });
    if (cashTransferRecord?.success === false) {
      return cashTransferRecord;
    }

    const mpesaTransferRecord = await postCloseTransfer(db, {
      activeSession,
      actor,
      context,
      destinationAccount: mpesaDestinationAccount,
      sourceAccount: context.linkedAccounts.mpesaAccount,
      sourceKey: 'mpesa',
      sourceLabel: 'M-Pesa',
      transfer: closeTransfers.mpesa,
      timestamp: now,
    });
    if (mpesaTransferRecord?.success === false) {
      return mpesaTransferRecord;
    }

    const updatedSession = {
      ...activeSession,
      status: 'closed',
      linkedAccountIds: {
        cash: context.linkedAccounts.cashAccount?._id || null,
        mpesa: context.linkedAccounts.mpesaAccount?._id || null,
      },
      expectedBalances,
      countedBalances,
      variances,
      transfer: {
        cash: cashTransferRecord,
        mpesa: mpesaTransferRecord,
      },
      closeSummary: {
        remainingDrawerCash,
        remainingMpesa,
      },
      notes: payload.notes ?? activeSession.notes ?? '',
      closedAt: now,
      closedBy: buildActorReference(actor),
      updatedAt: now,
    };

    const closedSession = await putSession(db, updatedSession);
    const refreshedContext = await loadRegisterContext(db, context.storeNo);
    const status = await buildRegisterStatus(db, refreshedContext, null, closedSession);

    return {
      ...status,
      activeSession: null,
      closedSession: status.session,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  closeRegisterSession,
  getRegisterSession,
  openRegisterSession,
  saveRegisterSession,
};
