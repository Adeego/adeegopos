const FINANCIAL_ACCOUNT_TYPES = require('../../../lib/financialAccountTypes.json');

function validateAccountType(accountType) {
  if (!FINANCIAL_ACCOUNT_TYPES.includes(accountType)) {
    return `Account type must be one of: ${FINANCIAL_ACCOUNT_TYPES.join(', ')}`;
  }
  return null;
}

function normalizeStoreNo(storeNoOrPayload) {
  return typeof storeNoOrPayload === 'object' && storeNoOrPayload !== null
    ? storeNoOrPayload.storeNo
    : storeNoOrPayload;
}

// Create a new account
function createAccount(db, accountData) {
  const accountTypeError = validateAccountType(accountData.accountType);
  if (accountTypeError) {
    return Promise.resolve({ success: false, error: accountTypeError });
  }

  const now = new Date().toISOString();
  const account = {
    _id: accountData._id,
    name: accountData.name,
    accountNumber: accountData.accountNumber,
    accountType: accountData.accountType,
    balance: accountData.balance,
    storeNo: accountData.storeNo,
    createdAt: accountData.createdAt || now,
    updatedAt: accountData.updatedAt || now,
    type: "account",
    state: "Active"
  };
  return db
    .put(account)
    .then((response) => ({
      success: true,
      account: { _id: response.id, ...account },
    }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Get all accounts
function getAllAccounts(db, storeNoOrPayload) {
  const storeNo = normalizeStoreNo(storeNoOrPayload);
  if (!storeNo) {
    return Promise.resolve({ success: false, error: "storeNo is required" });
  }
  return db
    .find({
      selector: { 
        type: "account",
        state: "Active",
        storeNo: storeNo
      },
    })
    .then((result) => ({ success: true, accounts: result.docs }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Get an account by ID
function getAccountById(db, accountId) {
  return db
    .get(accountId)
    .then((account) => ({ success: true, account }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Update an existing account
function updateAccount(db, accountData) {
  const accountTypeError = validateAccountType(accountData.accountType);
  if (accountTypeError) {
    return Promise.resolve({ success: false, error: accountTypeError });
  }

  const account = {
    _id: accountData._id,
    type: "account",
    state: "Active",
    ...accountData,
  };
  return db
    .put(account)
    .then((response) => ({
      success: true,
      account: { _id: response.id, ...account },
    }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Delete an account
function archiveAccount(db, accountId) {
  return db
    .get(accountId)
    .then((account) => {
      // Update the state field to "Inactive"
      account.state = "Inactive";
      return db.put(account);
    })
    .then(() => ({ success: true }))
    .catch((error) => ({ success: false, error: error.message }));
}

module.exports = {                                                    
  createAccount,
  getAllAccounts,
  getAccountById,
  updateAccount,
  archiveAccount,
};
