const {
  postTransaction,
  shouldIncludeTransactionInMetrics,
  toNumber,
} = require('../postingService');
const { ensureJournalEntryForTransaction } = require('./journalService');
const { findAll } = require('../pouchQueryService');

function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function toDateValue(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function decorateTransaction(transaction = {}) {
  return {
    ...transaction,
    status: transaction.status || 'posted',
  };
}

const TRANSACTION_HISTORY_INDEX = 'transaction-history-index';
const TRANSACTION_HISTORY_DDOC = 'transaction-history';
const indexedDatabases = new WeakSet();

async function ensureTransactionHistoryIndex(db) {
  if (indexedDatabases.has(db)) {
    return;
  }

  await db.createIndex({
    index: {
      fields: ['storeNo', 'type', 'state', 'createdAt'],
    },
    ddoc: TRANSACTION_HISTORY_DDOC,
    name: TRANSACTION_HISTORY_INDEX,
  });
  indexedDatabases.add(db);
}

async function getStoreTransactions(db, storeNo, options = {}) {
  const fromDate = toDateValue(options.startDate);
  const toDate = toDateValue(options.endDate);
  const selector = {
    type: 'transaction',
    state: 'Active',
    ...(storeNo ? { storeNo } : {}),
  };
  const canUseHistoryIndex = Boolean(storeNo);

  if (canUseHistoryIndex) {
    await ensureTransactionHistoryIndex(db);
    selector.createdAt = {
      $gte: fromDate ? fromDate.toISOString() : '',
      ...(toDate ? { $lte: toDate.toISOString() } : {}),
    };
  }

  const result = await findAll(db, {
    selector,
    ...(canUseHistoryIndex ? {
      sort: [
        { storeNo: 'asc' },
        { type: 'asc' },
        { state: 'asc' },
        { createdAt: 'asc' },
      ],
      use_index: [TRANSACTION_HISTORY_DDOC, TRANSACTION_HISTORY_INDEX],
    } : {}),
  });

  return result.docs
    .map(decorateTransaction)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function createTransaction(db, transactionData) {
  try {
    if (!transactionData.from || !transactionData.to || !transactionData.amount) {
      throw new Error('Missing required fields');
    }

    const result = await postTransaction(db, transactionData, { direction: 1 });
    if (!result.success) {
      return result;
    }

    const journalResult = await ensureJournalEntryForTransaction(db, result.transaction);
    if (!journalResult.success) {
      return journalResult;
    }

    return {
      success: true,
      transaction: decorateTransaction(result.transaction),
      ledgerEntries: result.ledgerEntries,
      journalEntry: journalResult.journalEntry,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getAllTransactions(db, storeNo) {
  try {
    const transactions = await getStoreTransactions(db, storeNo);
    return { success: true, transactions, data: transactions };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getTodayTransactions(db, storeNo) {
  try {
    const fromDate = startOfDay();
    const toDate = endOfDay();
    const transactions = (await getStoreTransactions(db, storeNo, {
      startDate: fromDate,
      endDate: toDate,
    })).filter((transaction) => {
      const createdAt = toDateValue(transaction.createdAt);
      return createdAt && createdAt >= fromDate && createdAt <= toDate && transaction.destination === 'supplier';
    });

    return { success: true, transactions };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getTransactionById(db, transactionId) {
  return db.get(transactionId)
    .then((transaction) => ({ success: true, transaction: decorateTransaction(transaction) }))
    .catch((error) => ({ success: false, error: error.message }));
}

async function updateTransaction(db, transactionData) {
  try {
    const existingTransaction = await db.get(transactionData._id);

    if (existingTransaction.locked !== false) {
      return { success: false, error: 'Posted transactions are locked. Use reconciliation instead.' };
    }

    const transaction = {
      ...existingTransaction,
      ...transactionData,
      updatedAt: new Date().toISOString(),
    };

    const response = await db.put(transaction);
    return {
      success: true,
      transaction: { _id: response.id, ...decorateTransaction(transaction) },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function archiveTransaction(db, transactionId) {
  try {
    const transaction = await db.get(transactionId);

    if ((transaction.status || 'posted') === 'posted' || transaction.reversalOfId || transaction.replacementOfId || transaction.locked !== false) {
      return { success: false, error: 'Posted transactions can no longer be deleted. Use reconciliation instead.' };
    }

    transaction.state = 'Inactive';
    transaction.updatedAt = new Date().toISOString();
    await db.put(transaction);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function searchCSS(db, searchTerm, type, storeNo) {
  try {
    const result = await db.find({
      selector: {
        $or: [
          { name: { $regex: new RegExp(searchTerm || '', 'i') } },
          { phoneNumber: { $regex: new RegExp(searchTerm || '', 'i') } },
        ],
        state: 'Active',
        type,
        ...(storeNo ? { storeNo } : {}),
      },
      limit: 100,
    });

    return { success: true, result: result.docs };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  createTransaction,
  getAllTransactions,
  getTransactionById,
  updateTransaction,
  archiveTransaction,
  searchCSS,
  getTodayTransactions,
  shouldIncludeTransactionInMetrics,
  toNumber,
};
