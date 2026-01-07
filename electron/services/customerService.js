// Create a new customer
function createCustomer(db, customerData) {
  const customer = {
    _id: customerData._id,
    name: customerData.name,
    phoneNumber: customerData.phoneNumber,
    address: customerData.address,
    balance: customerData.balance,
    credit: customerData.credit,
    status: customerData.status,
    storeNo: customerData.storeNo,
    createdAt: customerData.createdAt,
    updatedAt: customerData.updatedAt,
    type: "customer",
    state: "Active"
  };
  return db
    .put(customer)
    .then((response) => ({
      success: true,
      customer: { _id: response.id, ...customer },
    }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Get all customers
function getAllCustomers(db, storeNo) {
  return db
    .find({
      selector: { 
        type: "customer",
        state: "Active",
        storeNo: storeNo
      },
      limit: 9999
    })
    .then((result) => ({ success: true, customers: result.docs }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Get a customer by ID
function getCustomerById(db, customerId) {
  return db
    .get(customerId)
    .then((customer) => ({ success: true, customer }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Added a new function for customer search
async function searchCustomers(db, searchTerm, storeNo, state = "Active", type = "customer") {
  try {
    const result = await db.find({
      selector: {
        $or: [
          { name: { $regex: new RegExp(searchTerm, 'i') } },
          { phoneNumber: { $regex: new RegExp(searchTerm, 'i') } }
        ],
        state: state,
        type: type,
        storeNo: storeNo
      },
      limit: 9999
    });
    return { success: true, customers: result.docs };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Update an existing customer with revision handling
async function updateCustomer(db, customerData) {
  try {
    // First, get the latest revision of the document
    const existingCustomer = await db.get(customerData._id);

    // Prepare the updated customer object with the latest revision
    const customer = {
      _id: customerData._id,
      _rev: existingCustomer._rev, // Include the latest revision
      type: "customer",
      state: "Active",
      ...customerData,
    };

    // Perform the update with the latest revision
    const response = await db.put(customer);
    
    return {
      success: true,
      customer: { _id: response.id, ...customer },
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Delete a customer
function deleteCustomer(db, customerId) {
  return db
    .get(customerId)
    .then((product) => {
      // Update the state field to "Inactive"
      product.state = "Inactive";
      return db.put(product);
    })
    .then(() => ({ success: true }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Query all sales for a specific customer
function getCustomerSales(db, customerId, fromDate, toDate, storeNo) {
  return db
    .find({
      selector: {
        customerId: customerId,
        type: "sale",
        storeNo: storeNo,
        createdAt: {
          $gte: fromDate || '',
          $lte: toDate || new Date().toISOString()
        }
      }
    })
    .then((result) => ({
      success: true,
      sales: result.docs
    }))
    .catch((error) => ({
      success: false,
      error: error.message,
      sales: []
    }));
}

// Get today's credit sales
function getTodayCreditSales(db, storeNo) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return db.find({
    selector: {
      type: "sale",
      state: "Active",
      storeNo: storeNo,
      createdAt: {
        $gte: today.toISOString(),
        $lt: tomorrow.toISOString()
      }
    }
  })
  .then((result) => ({
    success: true,
    sales: result.docs.filter(sale => sale.paymentMethod === "CREDIT")
  }))
  .catch((error) => ({
    success: false,
    error: error.message,
    sales: []
  }));
}

// Get today's transactions where source is customer
async function getTodayCustomerTransactions(db, storeNo) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    // First, find all today's transactions from customers
    const transactionsResult = await db.find({
    selector: {
      type: "transaction",
      state: "Active",
      createdAt: {
        $gte: today.toISOString(),
        $lt: tomorrow.toISOString()
      },
      source: "customer",
      storeNo: storeNo
    }
    });

    // Now, fetch customer details for each transaction
    const transactionsWithCustomerDetails = await Promise.all(
      transactionsResult.docs.map(async (transaction) => {
        try {
          const customerDetails = await db.get(transaction.from);
          return {
            ...transaction,
            customerDetails
          };
        } catch (error) {
          console.error(`Could not fetch customer details for transaction ${transaction._id}:`, error);
          return {
            ...transaction,
            customerDetails: null
          };
        }
  })
    );

    return {
    success: true,
      transactions: transactionsWithCustomerDetails
    };
  } catch (error) {
    return {
    success: false,
    error: error.message,
    transactions: []
    };
}
}


// Get customer ledger (sales and transactions)
async function getCustomerLedger(db, customerId, fromDate, toDate, storeNo) {
  try {
    // Fetch Credit Sales
    const salesResult = await db.find({
      selector: {
        customerId: customerId,
        type: "sale",
        paymentMethod: "CREDIT",
        storeNo: storeNo,
        createdAt: {
          $gte: fromDate || '',
          $lte: toDate || new Date().toISOString()
        }
      },
      limit: 9999
    });

    // Fetch Transactions involving the customer
    const transactionsResult = await db.find({
      selector: {
        $or: [
          { from: customerId },
          { to: customerId }
        ],
        type: "transaction",
        state: "Active",
        storeNo: storeNo,
        date: {
          $gte: fromDate || '',
          $lte: toDate || new Date().toISOString()
       }
      },
      limit: 9999
    });

    const sales = salesResult.docs.map(sale => ({
      ...sale,
      date: sale.createdAt,
      description: "Credit Sale",
      entryType: "DEBIT", // Reduces balance
      amount: sale.totalAmount,
      ref: sale._id
    }));

    const transactions = transactionsResult.docs.map(trans => {
      // specific logic based on createTransaction
      // Deposit -> Increase Balance -> CREDIT
      // Withdraw -> Decrease Balance -> DEBIT
      const isDeposit = trans.transType === 'deposit';
      
      return {
        ...trans,
        description: trans.description || (isDeposit ? "Payment/Deposit" : "Withdrawal"),
        entryType: isDeposit ? "CREDIT" : "DEBIT",
        ref: trans._id
      };
    });

    // Combine and Sort
    const ledger = [...sales, ...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return { success: true, ledger };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get customer aging analysis
async function getCustomerAging(db, customerId, storeNo) {
  console.log(`[getCustomerAging] Starting for customerId: ${customerId}, storeNo: ${storeNo}`);
  try {
    const customer = await db.get(customerId);
    let balance = customer.balance;
    console.log(`[getCustomerAging] Customer balance: ${balance}`);

    // In this system, debt is stored as a negative balance (balance = balance - saleAmount).
    // So if balance is negative, it means the customer owes money.
    // If balance is positive, it means they have store credit (overpaid).
    
    let outstandingDebt = 0;
    if (balance < 0) {
      outstandingDebt = Math.abs(balance);
    } else {
      console.log(`[getCustomerAging] Balance is positive or zero (${balance}). No debt to age.`);
      return { success: true, aging: { "0-30": 0, "30-60": 0, "60+": 0 } };
    }

    console.log(`[getCustomerAging] Outstanding Debt: ${outstandingDebt}`);

    // Fetch all credit sales (DEBITS) - These increase debt (make balance more negative)
    const salesResult = await db.find({
      selector: {
        customerId: customerId,
        type: "sale",
        paymentMethod: "CREDIT",
        storeNo: storeNo
      },
      limit: 9999
    });
    console.log(`[getCustomerAging] Found ${salesResult.docs.length} credit sales.`);

    // Fetch Transactions involving the customer
    const transactionsResult = await db.find({
      selector: {
        $or: [
          { from: customerId },
          { to: customerId }
        ],
        type: "transaction",
        state: "Active",
        storeNo: storeNo
      },
      limit: 9999
    });
    console.log(`[getCustomerAging] Found ${transactionsResult.docs.length} transactions.`);
    
    const debits = [];
    
    salesResult.docs.forEach(sale => {
      debits.push({
        date: new Date(sale.createdAt),
        amount: sale.totalAmount
      });
    });

    // For transactions:
    // If it's a Withdrawal (transType != deposit), it reduces balance (increases debt).
    // If it's a Deposit, it increases balance (reduces debt).
    // We are looking for things that INCREASED DEBT (Debits).
    
    transactionsResult.docs.forEach(trans => {
       const isDeposit = trans.transType === 'deposit';
       if (!isDeposit) { // Withdrawal/Charge -> Increases Debt
          debits.push({
             date: new Date(trans.date),
             amount: trans.amount
          });
       }
    });
    console.log(`[getCustomerAging] Total debits to process: ${debits.length}`);

    // Sort by Date DESC (Newest first)
    debits.sort((a, b) => b.date - a.date);

    let aging = {
      "0-30": 0,
      "30-60": 0,
      "60+": 0
    };

    let remainingDebt = outstandingDebt;
    const now = new Date();
    const day30 = 30 * 24 * 60 * 60 * 1000;
    const day60 = 60 * 24 * 60 * 60 * 1000;

    for (const debit of debits) {
      if (remainingDebt <= 0) break;

      const amountToApply = Math.min(remainingDebt, debit.amount);
      const diffTime = Math.abs(now - debit.date);
      
      if (diffTime <= day30) {
        aging["0-30"] += amountToApply;
      } else if (diffTime <= day60) {
        aging["30-60"] += amountToApply;
      } else {
        aging["60+"] += amountToApply;
      }

      remainingDebt -= amountToApply;
    }

    // If there is still remaining debt (e.g. initial balance migration or unaccounted debits), put it in 60+
    if (remainingDebt > 0) {
      console.log(`[getCustomerAging] Remaining debt ${remainingDebt} assigned to 60+ bucket.`);
      aging["60+"] += remainingDebt;
    }

    console.log("Customer aging calculation:", { customerId, balance, outstandingDebt, aging });

    return { success: true, aging };

  } catch (error) {
    console.error(`[getCustomerAging] Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

module.exports = {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  searchCustomers,
  updateCustomer,
  deleteCustomer,
  getCustomerSales,
  getTodayCreditSales,
  getTodayCustomerTransactions,
  getCustomerLedger,
  getCustomerAging,
};
