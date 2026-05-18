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

function getBusinessDateRange(businessDate) {
  const start = parseBusinessDate(businessDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function inBusinessDate(value, businessDate) {
  const date = toDateValue(value);
  if (!date) {
    return false;
  }

  const { start, end } = getBusinessDateRange(businessDate);
  return date >= start && date <= end;
}

function buildRegisterSessionId(storeNo, businessDate) {
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
  const findBySuffix = (suffix) => {
    const exactNumber = `${storeNo}${suffix}`;
    return (
      accounts.find((account) => account.accountNumber === exactNumber) ||
      accounts.find((account) => String(account.accountNumber || '').endsWith(suffix)) ||
      null
    );
  };

  const cashAccount = findBySuffix('001');
  const mpesaAccount = findBySuffix('002');

  return {
    cashAccount,
    mpesaAccount,
    availableTransferAccounts: accounts
      .filter((account) => account._id !== cashAccount?._id)
      .map(toAccountSummary),
  };
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

async function getPreviousClosedSession(db, storeNo, businessDate) {
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
    .filter((session) => String(session.businessDate || '') < businessDate)
    .sort((a, b) => String(b.businessDate || '').localeCompare(String(a.businessDate || '')))[0] || null;
}

async function getDailyAccountMovements(db, storeNo, businessDate, cashAccount, mpesaAccount) {
  const [salesResult, transactionsResult, expensesResult] = await Promise.all([
    db.find({
      selector: {
        type: 'sale',
        state: 'Active',
        storeNo,
      },
      limit: 9999,
    }),
    db.find({
      selector: {
        type: 'transaction',
        state: 'Active',
        storeNo,
      },
      limit: 9999,
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
    if (!inBusinessDate(sale.createdAt, businessDate) || !shouldIncludeSaleInMetrics(sale)) {
      continue;
    }

    const sign = getSaleMetricSign(sale);
    if (!sign) {
      continue;
    }

    const salePayments = getSalePaymentBreakdown(sale);

    for (const payment of salePayments) {
      const amount = roundCurrency(Math.abs(toNumber(payment.amount)) * sign);
      const paymentMethod = String(payment.method || '').toUpperCase();

      if (paymentMethod === 'CASH' && cashAccount?._id) {
        cash = roundCurrency(cash + amount);
      }

      if (paymentMethod === 'MPESA' && mpesaAccount?._id) {
        mpesa = roundCurrency(mpesa + amount);
      }
    }
  }

  for (const transaction of transactionsResult.docs || []) {
    if (!inBusinessDate(transaction.date || transaction.createdAt, businessDate) || !shouldIncludeTransactionInMetrics(transaction)) {
      continue;
    }

    const rows = getTransactionImpactRows(transaction, { direction: 1 });
    for (const row of rows) {
      if (row.entityType !== 'account' || !row.entityId) {
        continue;
      }

      if (row.entityId === cashAccount?._id) {
        cash = roundCurrency(cash + row.delta);
      }

      if (row.entityId === mpesaAccount?._id) {
        mpesa = roundCurrency(mpesa + row.delta);
      }
    }
  }

  for (const expense of expensesResult.docs || []) {
    if (!inBusinessDate(expense.date || expense.createdAt, businessDate)) {
      continue;
    }

    const amount = Math.abs(toNumber(expense.amount));
    if (matchesExpenseAccount(expense, cashAccount)) {
      cash = roundCurrency(cash - amount);
    }

    if (matchesExpenseAccount(expense, mpesaAccount)) {
      mpesa = roundCurrency(mpesa - amount);
    }
  }

  return {
    cash: roundCurrency(cash),
    mpesa: roundCurrency(mpesa),
    total: roundCurrency(cash + mpesa),
  };
}

function buildExpectedBalances(openingBalances, dailyMovements) {
  const cash = roundCurrency((openingBalances?.cash || 0) + (dailyMovements?.cash || 0));
  const mpesa = roundCurrency((openingBalances?.mpesa || 0) + (dailyMovements?.mpesa || 0));

  return {
    cash,
    mpesa,
    total: roundCurrency(cash + mpesa),
  };
}

function getSetupError(storeNo, cashAccount) {
  if (cashAccount) {
    return null;
  }

  return `Cash account ${storeNo}001 is required before you can save or close the register.`;
}

async function buildDefaultSession(db, storeNo, businessDate, linkedAccounts) {
  const previousClosedSession = await getPreviousClosedSession(db, storeNo, businessDate);
  const dailyMovements = await getDailyAccountMovements(
    db,
    storeNo,
    businessDate,
    linkedAccounts.cashAccount,
    linkedAccounts.mpesaAccount
  );

  const openingBalances = previousClosedSession
    ? {
        cash: roundCurrency(
          previousClosedSession.closeSummary?.remainingDrawerCash ?? previousClosedSession.countedBalances?.cash ?? 0
        ),
        mpesa: roundCurrency(previousClosedSession.countedBalances?.mpesa ?? 0),
      }
    : {
        // Bootstrap the first session from current finance balances so expected totals align immediately.
        cash: roundCurrency(toNumber(linkedAccounts.cashAccount?.balance) - dailyMovements.cash),
        mpesa: roundCurrency(toNumber(linkedAccounts.mpesaAccount?.balance) - dailyMovements.mpesa),
      };

  const expectedBalances = buildExpectedBalances(openingBalances, dailyMovements);
  const countedBalances = normalizeCountedBalances();
  const now = new Date().toISOString();

  return {
    _id: buildRegisterSessionId(storeNo, businessDate),
    type: 'register-session',
    state: 'Active',
    storeNo,
    businessDate,
    status: 'open',
    linkedAccountIds: {
      cash: linkedAccounts.cashAccount?._id || null,
      mpesa: linkedAccounts.mpesaAccount?._id || null,
    },
    openingBalances,
    expectedBalances,
    countedBalances,
    variances: buildVariances(countedBalances, expectedBalances),
    transfer: null,
    closeSummary: null,
    notes: '',
    createdAt: now,
    updatedAt: now,
    closedAt: null,
    closedBy: null,
  };
}

async function ensureSessionDoc(db, storeNo, businessDate, linkedAccounts) {
  const docId = buildRegisterSessionId(storeNo, businessDate);
  const existing = await getIfExists(db, docId);
  if (existing) {
    return existing;
  }

  const defaultSession = await buildDefaultSession(db, storeNo, businessDate, linkedAccounts);

  try {
    await db.put(defaultSession);
    return defaultSession;
  } catch (error) {
    if (error?.status === 409) {
      return getIfExists(db, docId);
    }
    throw error;
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

async function loadSessionContext(db, storeNoInput, businessDateInput) {
  const storeNo = normalizeStoreNo(storeNoInput);
  if (!storeNo) {
    throw new Error('storeNo is required');
  }

  const businessDate = toBusinessDateString(businessDateInput || new Date());
  const accounts = await getActiveAccounts(db, storeNo);
  const linkedAccounts = getLinkedAccounts(accounts, storeNo);
  const sessionDoc = await ensureSessionDoc(db, storeNo, businessDate, linkedAccounts);
  const dailyMovements = await getDailyAccountMovements(
    db,
    storeNo,
    businessDate,
    linkedAccounts.cashAccount,
    linkedAccounts.mpesaAccount
  );

  return {
    storeNo,
    businessDate,
    accounts,
    linkedAccounts,
    sessionDoc,
    dailyMovements,
    setupError: getSetupError(storeNo, linkedAccounts.cashAccount),
  };
}

function toSessionResponse(context, sessionDocOverride = null) {
  const sessionDoc = sessionDocOverride || context.sessionDoc;
  const openingBalances = {
    cash: roundCurrency(sessionDoc.openingBalances?.cash),
    mpesa: roundCurrency(sessionDoc.openingBalances?.mpesa),
  };

  const expectedBalances = sessionDoc.status === 'closed'
    ? {
        cash: roundCurrency(sessionDoc.expectedBalances?.cash),
        mpesa: roundCurrency(sessionDoc.expectedBalances?.mpesa),
        total: roundCurrency(sessionDoc.expectedBalances?.total),
      }
    : buildExpectedBalances(openingBalances, context.dailyMovements);

  const countedBalances = normalizeCountedBalances(sessionDoc.countedBalances, sessionDoc.countedBalances);
  const variances = sessionDoc.status === 'closed' && sessionDoc.variances
    ? {
        cash: roundCurrency(sessionDoc.variances.cash),
        mpesa: roundCurrency(sessionDoc.variances.mpesa),
        total: roundCurrency(sessionDoc.variances.total),
      }
    : buildVariances(countedBalances, expectedBalances);

  return {
    ...sessionDoc,
    businessDate: context.businessDate,
    linkedAccountIds: {
      cash: context.linkedAccounts.cashAccount?._id || null,
      mpesa: context.linkedAccounts.mpesaAccount?._id || null,
    },
    linkedAccounts: {
      cash: toAccountSummary(context.linkedAccounts.cashAccount),
      mpesa: toAccountSummary(context.linkedAccounts.mpesaAccount),
    },
    availableTransferAccounts: context.linkedAccounts.availableTransferAccounts,
    setupError: context.setupError,
    openingBalances,
    expectedBalances,
    countedBalances,
    variances,
  };
}

async function getRegisterSession(db, storeNoInput, businessDateInput) {
  try {
    const context = await loadSessionContext(db, storeNoInput, businessDateInput);
    return {
      success: true,
      session: toSessionResponse(context),
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function saveRegisterSession(db, draft = {}) {
  try {
    const context = await loadSessionContext(db, draft.storeNo, draft.businessDate);
    if (context.setupError) {
      return { success: false, error: context.setupError };
    }

    if (context.sessionDoc.status === 'closed') {
      return { success: false, error: 'This register session is already closed.' };
    }

    const countedBalances = normalizeCountedBalances(draft.countedBalances, context.sessionDoc.countedBalances);
    if (countedBalances.cash < 0 || countedBalances.mpesa < 0) {
      return { success: false, error: 'Counted balances cannot be negative.' };
    }

    const expectedBalances = buildExpectedBalances(context.sessionDoc.openingBalances, context.dailyMovements);
    const updatedSession = {
      ...context.sessionDoc,
      status: 'open',
      linkedAccountIds: {
        cash: context.linkedAccounts.cashAccount?._id || null,
        mpesa: context.linkedAccounts.mpesaAccount?._id || null,
      },
      expectedBalances,
      countedBalances,
      variances: buildVariances(countedBalances, expectedBalances),
      notes: draft.notes ?? context.sessionDoc.notes ?? '',
      updatedAt: new Date().toISOString(),
    };

    await putSession(db, updatedSession);

    return getRegisterSession(db, context.storeNo, context.businessDate);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function closeRegisterSession(db, payload = {}, actor = null) {
  try {
    const context = await loadSessionContext(db, payload.storeNo, payload.businessDate);
    if (context.setupError) {
      return { success: false, error: context.setupError };
    }

    if (context.sessionDoc.status === 'closed') {
      return { success: false, error: 'This register session is already closed.' };
    }

    const countedBalances = normalizeCountedBalances(payload.countedBalances, context.sessionDoc.countedBalances);
    if (countedBalances.cash < 0 || countedBalances.mpesa < 0) {
      return { success: false, error: 'Counted balances cannot be negative.' };
    }

    const transferAmount = roundCurrency(payload.transfer?.amount);
    const transferTransactionCost = roundCurrency(payload.transfer?.transactionCost);
    if (transferAmount < 0) {
      return { success: false, error: 'Transfer amount cannot be negative.' };
    }

    if (transferTransactionCost < 0) {
      return { success: false, error: 'Transfer cost cannot be negative.' };
    }

    if (transferAmount === 0 && transferTransactionCost > 0) {
      return { success: false, error: 'Transfer cost requires a transfer amount.' };
    }

    if ((transferAmount + transferTransactionCost) > countedBalances.cash) {
      return { success: false, error: 'Transfer amount plus transfer cost cannot exceed the counted cash closing balance.' };
    }

    const destinationAccountId = payload.transfer?.destinationAccountId || null;
    const destinationAccount = context.accounts.find((account) => account._id === destinationAccountId) || null;

    if (transferAmount > 0 && !destinationAccount) {
      return { success: false, error: 'Select a valid destination account for the cash transfer.' };
    }

    if (transferAmount > 0 && destinationAccount?._id === context.linkedAccounts.cashAccount?._id) {
      return { success: false, error: 'Cash can only be transferred to a different account.' };
    }

    const expectedBalances = buildExpectedBalances(context.sessionDoc.openingBalances, context.dailyMovements);
    const variances = buildVariances(countedBalances, expectedBalances);
    const remainingDrawerCash = roundCurrency(countedBalances.cash - transferAmount - transferTransactionCost);
    const now = new Date().toISOString();
    let transferRecord = null;

    if (transferAmount > 0) {
      const transferTransactionId = `${context.sessionDoc._id}:close-transfer`;
      const existingTransfer = await getIfExists(db, transferTransactionId);

      if (existingTransfer) {
        transferRecord = {
          destinationAccountId: destinationAccount._id,
          destinationAccountName: destinationAccount.name || '',
          amount: transferAmount,
          transactionCost: roundCurrency(existingTransfer.transactionCost),
          description: payload.transfer?.description || `Register close transfer for ${context.businessDate}`,
          transactionId: existingTransfer._id,
        };
      } else {
        const transactionResult = await postTransaction(db, {
          _id: transferTransactionId,
          description: payload.transfer?.description || `Register close transfer for ${context.businessDate}`,
          transType: 'withdraw',
          source: 'account',
        destination: 'account',
        from: context.linkedAccounts.cashAccount._id,
        to: destinationAccount._id,
        amount: transferAmount,
        transactionCost: transferTransactionCost,
        storeNo: context.storeNo,
        date: now,
          metadata: {
            registerSessionId: context.sessionDoc._id,
            businessDate: context.businessDate,
            registerClose: true,
            actor: buildActorReference(actor),
          },
        }, { direction: 1 });

        if (!transactionResult.success) {
          return transactionResult;
        }

        transferRecord = {
          destinationAccountId: destinationAccount._id,
          destinationAccountName: destinationAccount.name || '',
          amount: transferAmount,
          transactionCost: transferTransactionCost,
          description: payload.transfer?.description || `Register close transfer for ${context.businessDate}`,
          transactionId: transactionResult.transaction?._id || null,
        };
      }
    }

    const updatedSession = {
      ...context.sessionDoc,
      status: 'closed',
      linkedAccountIds: {
        cash: context.linkedAccounts.cashAccount?._id || null,
        mpesa: context.linkedAccounts.mpesaAccount?._id || null,
      },
      expectedBalances,
      countedBalances,
      variances,
      transfer: transferRecord,
      closeSummary: {
        remainingDrawerCash,
      },
      closedAt: now,
      closedBy: buildActorReference(actor),
      updatedAt: now,
    };

    await putSession(db, updatedSession);

    return getRegisterSession(db, context.storeNo, context.businessDate);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  closeRegisterSession,
  getRegisterSession,
  saveRegisterSession,
};
