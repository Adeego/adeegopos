// Create a new transaction
async function createTransaction(db, transactionData) {
  try {
    // Validate transaction data
    if (!transactionData.from || !transactionData.to || !transactionData.amount) {
      throw new Error('Missing required fields');
    }

    // Get source and destination documents
    let sourceDoc, destDoc;
    
    if (transactionData.source === 'account') {
      sourceDoc = await db.get(transactionData.from);
    } else {
      const sourceResult = await db.find({
        selector: {
          _id: transactionData.from,
          type: transactionData.source
        }
      });
      sourceDoc = sourceResult.docs[0];
    }

    if (transactionData.destination === 'account') {
      destDoc = await db.get(transactionData.to);
    } else {
      const destResult = await db.find({
        selector: {
          _id: transactionData.to,
          type: transactionData.destination
        }
      });
      destDoc = destResult.docs[0];
    }

    if (!sourceDoc || !destDoc) {
      throw new Error('Source or destination not found');
    }

    // Validate balance for withdrawals
    if (transactionData.transType === 'withdraw' && sourceDoc.balance < transactionData.amount) {
      throw new Error('Insufficient balance in source account');
    }

    // Update balances
    if (transactionData.transType === 'deposit') {
      if (sourceDoc.balance !== undefined) {
        sourceDoc.balance += transactionData.amount;
      }
      destDoc.balance += transactionData.amount;
    } else { // WITHDRAW
      sourceDoc.balance -= transactionData.amount;
      if (destDoc.balance !== undefined) {
        destDoc.balance -= transactionData.amount;
      }
    }

    // Create transaction record
    const transaction = {
      _id: transactionData._id,
      from: transactionData.from,
      to: transactionData.to,
      source: transactionData.source,
      destination: transactionData.destination,
      description: transactionData.description,
      amount: transactionData.amount,
      date: transactionData.date,
      transType: transactionData.transType,
      type: "transaction",
      state: "Active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Update documents in database
    await db.put(sourceDoc);
    await db.put(destDoc);
    await db.put(transaction);

    return {
      success: true,
      transaction: { _id: transaction._id, ...transaction }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
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
    updatedAt: new Date().toISOString()
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
      transaction.state = "Inactive";
      transaction.updatedAt = new Date().toISOString();
      return db.put(transaction);
    })
    .then(() => ({ success: true }))
    .catch((error) => ({ success: false, error: error.message }));
}

async function searchCSS(db, searchTerm, type) {
  try {
    const searchResult = await db.find({
      selector: {
        $or: [
          { name: { $regex: new RegExp(searchTerm, 'i') } },
          { phoneNumber: { $regex: new RegExp(searchTerm, 'i') } }
        ],
        state: "Active",
        type: type
      }
    });
    return { success: true, result: searchResult.docs };
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
};
