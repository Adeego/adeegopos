// Create a new transaction
function createTransaction(db, transactionData) {
    const transaction = {
      _id: transactionData._id,
      description: transactionData.description,
      amount: transactionData.amount,
      date: transactionData.date,
      storeNo: transactionData.storeNo,
      createdAt: transactionData.createdAt,
      updatedAt: transactionData.updatedAt,
      type: "transaction",
      state: "Active"
    };
    return db
      .put(transaction)
      .then((response) => ({
        success: true,
        transaction: { _id: response.id, ...transaction },
      }))
      .catch((error) => ({ success: false, error: error.message }));
  }
  
  // Get all transactions
  function getAllTransactions(db) {
    return db
      .find({
        selector: { 
          type: "transaction",
          state: "Active"
        },
      })
      .then((result) => ({ success: true, transactions: result.docs }))
      .catch((error) => ({ success: false, error: error.message }));
  }
  
  // Get a transaction by ID
  function getTransactionById(db, transactionId) {
    return db
      .get(transactionId)
      .then((transaction) => ({ success: true, transaction }))
      .catch((error) => ({ success: false, error: error.message }));
  }
  
  // Update an existing transaction
  function updateTransaction(db, transactionData) {
    const transaction = {
      _id: transactionData._id,
      type: "transaction",
      state: "Active",
      ...transactionData,
    };
    return db
      .put(transaction)
      .then((response) => ({
        success: true,
        transaction: { _id: response.id, ...transaction },
      }))
      .catch((error) => ({ success: false, error: error.message }));
  }
  
  // Delete a transaction
  function archiveTransaction(db, transactionId) {
    return db
      .get(transactionId)
      .then((transaction) => {
        // Update the state field to "Inactive"
        transaction.state = "Inactive";
        return db.put(transaction);
      })
      .then(() => ({ success: true }))
      .catch((error) => ({ success: false, error: error.message }));
  }
  
  module.exports = {
    createTransaction,
    getAllTransactions,
    getTransactionById,
    updateTransaction,
    archiveTransaction,
  };