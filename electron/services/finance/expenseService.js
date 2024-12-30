const { getAccountById, updateAccount } = require('./accountService');

// Create a new expense
function createExpense(db, expenseData) {
  const expense = {
    _id: expenseData._id,
    description: expenseData.description,
    amount: expenseData.amount,
    date: expenseData.date,
    storeNo: expenseData.storeNo,
    account: expenseData.account,
    expenseType: expenseData.expenseType,
    expenseTypeId: expenseData.expenseTypeId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    type: "expense",
    state: "Active"
  };
  
  return db
    .put(expense)
    .then((response) => {
      // If an account ID is provided, update the account balance
      if (expenseData.accountId) {
        return getAccountById(db, expenseData.accountId)
          .then((accountResult) => {
            if (accountResult.success) {
              const updatedAccount = {
                ...accountResult.account,
                balance: accountResult.account.balance - expenseData.amount
              };
              
              return updateAccount(db, updatedAccount)
                .then(() => ({
                  success: true,
                  expense: { _id: response.id, ...expense }
                }));
            }
            return { success: true, expense: { _id: response.id, ...expense } };
          });
      }
      return { success: true, expense: { _id: response.id, ...expense } };
    })
    .catch((error) => ({ success: false, error: error.message }));
}

// Get all expenses
function getAllExpenses(db) {
  return db
    .find({
      selector: { 
        type: "expense",
        state: "Active"
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
function updateExpense(db, expenseData) {
  const expense = {
    _id: expenseData._id,
    type: "expense",
    state: "Active",
    ...expenseData,
  };
  return db
    .put(expense)
    .then((response) => ({
      success: true,
      expense: { _id: response.id, ...expense },
    }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Delete an expense
function archiveExpense(db, expenseId) {
  return db
    .get(expenseId)
    .then((expense) => {
      // Update the state field to "Inactive"
      expense.state = "Inactive";
      return db.put(expense);
    })
    .then(() => ({ success: true }))
    .catch((error) => ({ success: false, error: error.message }));
}

module.exports = {
  createExpense,
  getAllExpenses,
  getExpenseById,
  updateExpense,
  archiveExpense,
};
