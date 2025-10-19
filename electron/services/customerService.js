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
};
