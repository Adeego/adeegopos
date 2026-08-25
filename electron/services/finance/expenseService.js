const { v4: uuidv4 } = require('uuid');
const { getAccountById, updateAccount } = require('./accountService');
const {
  ensureJournalEntryForExpense,
} = require('./journalService');
const {
  attachOpenRegisterSessionForAccount,
  recordLedgerEntry,
  toNumber,
} = require('../postingService');

function roundMoney(value) {
  return Number(toNumber(value).toFixed(2));
}

function normalizeExpense(expenseData, overrides = {}) {
  const createdAt = expenseData.createdAt || new Date().toISOString();
  return {
    _id: expenseData._id,
    description: expenseData.description,
    amount: roundMoney(expenseData.amount),
    transactionCost: roundMoney(expenseData.transactionCost || 0),
    date: expenseData.date || createdAt,
    storeNo: expenseData.storeNo,
    account: expenseData.account,
    accountId: expenseData.accountId || null,
    expenseType: expenseData.expenseType,
    expenseTypeId: expenseData.expenseTypeId,
    createdAt,
    updatedAt: expenseData.updatedAt || createdAt,
    type: "expense",
    state: expenseData.state || "Active",
    status: expenseData.status || "posted",
    registerSessionId: expenseData.registerSessionId || null,
    locked: expenseData.locked !== undefined ? expenseData.locked : true,
    replacementOfId: expenseData.replacementOfId || null,
    reversalOfId: expenseData.reversalOfId || null,
    voidedAt: expenseData.voidedAt || null,
    ...overrides,
  };
}

async function applyExpenseAccountDelta(db, expense, direction) {
  const amount = roundMoney((toNumber(expense.amount) + toNumber(expense.transactionCost)) * direction);
  if (!expense.accountId || !amount) {
    return null;
  }

  const accountResult = await getAccountById(db, expense.accountId);
  if (!accountResult.success) {
    throw new Error(accountResult.error || 'Expense account not found');
  }

  const updatedAccount = {
    ...accountResult.account,
    balance: roundMoney(toNumber(accountResult.account.balance) + amount),
    updatedAt: new Date().toISOString(),
  };
  const updateResult = await updateAccount(db, updatedAccount);
  if (!updateResult.success) {
    throw new Error(updateResult.error || 'Failed to update expense account');
  }

  await recordLedgerEntry(db, {
    storeNo: expense.storeNo,
    entityType: 'account',
    entityId: expense.accountId,
    bucket: 'account_balance',
    delta: amount,
    description: direction < 0
      ? (expense.description || 'Expense posted')
      : `Reversal: ${expense.description || 'Expense'}`,
    sourceDocType: 'expense',
    sourceDocId: expense._id,
    date: expense.date || expense.createdAt,
    metadata: {
      expenseType: expense.expenseType,
      direction: direction < 0 ? 'posted' : 'reversal',
    },
  });

  return updatedAccount;
}

// Create a new expense
async function createExpense(db, expenseData) {
  try {
    const expense = await attachOpenRegisterSessionForAccount(
      db,
      normalizeExpense(expenseData),
      expenseData.accountId
    );
    await db.put(expense);
    await applyExpenseAccountDelta(db, expense, -1);
    const journalResult = await ensureJournalEntryForExpense(db, expense);
    if (!journalResult.success) {
      return journalResult;
    }

    return {
      success: true,
      expense,
      journalEntry: journalResult.journalEntry,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get all expenses
function getAllExpenses(db, storeNo) {
  if (!storeNo) {
    return Promise.resolve({ success: false, error: "storeNo is required" });
  }
  return db
    .find({
      selector: { 
        type: "expense",
        state: "Active",
        storeNo: storeNo
      },
    })
    .then((result) => ({ success: true, expenses: result.docs }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Get an expense by ID
function getExpenseById(db, expenseId) {
  return db
    .get(expenseId)
    .then((expense) => ({ success: true, expense }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Update an existing expense
async function updateExpense(db, expenseData) {
  try {
    const existingExpense = await db.get(expenseData._id);
    if ((existingExpense.status || 'posted') !== 'posted' || existingExpense.locked === false) {
      const directExpense = await attachOpenRegisterSessionForAccount(db, normalizeExpense({ ...existingExpense, ...expenseData }, {
        updatedAt: new Date().toISOString(),
      }), expenseData.accountId || existingExpense.accountId);
      await db.put(directExpense);
      return { success: true, expense: directExpense };
    }

    const now = new Date().toISOString();
    const updatedExisting = {
      ...existingExpense,
      status: 'replaced',
      updatedAt: now,
    };
    await db.put(updatedExisting);
    await applyExpenseAccountDelta(db, existingExpense, 1);
    await ensureJournalEntryForExpense(db, existingExpense, {
      reversal: true,
      entryKind: 'reversal:update',
      date: now,
    });

    const replacement = await attachOpenRegisterSessionForAccount(db, normalizeExpense({
      ...existingExpense,
      ...expenseData,
      _id: `${existingExpense.storeNo}:expense:${uuidv4()}`,
      replacementOfId: existingExpense._id,
      createdAt: now,
      updatedAt: now,
      status: 'posted',
      state: 'Active',
      locked: true,
      registerSessionId: expenseData.registerSessionId || null,
    }), expenseData.accountId || existingExpense.accountId);

    await db.put(replacement);
    await applyExpenseAccountDelta(db, replacement, -1);
    const journalResult = await ensureJournalEntryForExpense(db, replacement);
    if (!journalResult.success) {
      return journalResult;
    }

    return {
      success: true,
      expense: replacement,
      replacedExpense: updatedExisting,
      journalEntry: journalResult.journalEntry,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Delete an expense
async function archiveExpense(db, expenseId) {
  try {
    const expense = await db.get(expenseId);
    if ((expense.status || 'posted') === 'posted') {
      await applyExpenseAccountDelta(db, expense, 1);
      await ensureJournalEntryForExpense(db, expense, {
        reversal: true,
        entryKind: 'reversal:void',
        date: new Date().toISOString(),
      });
    }

    expense.state = "Inactive";
    expense.status = "voided";
    expense.voidedAt = new Date().toISOString();
    expense.updatedAt = new Date().toISOString();
    await db.put(expense);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  createExpense,
  getAllExpenses,
  getExpenseById,
  updateExpense,
  archiveExpense,
};
