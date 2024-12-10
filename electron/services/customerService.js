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
function getAllCustomers(db) {
  return db
    .find({
      selector: { 
        type: "customer",
        state: "Active"
      },
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
async function searchCustomers(db, searchTerm, state = "Active", type = "customer") {
  try {
    const result = await db.find({
      selector: {
        $or: [
          { name: { $regex: new RegExp(searchTerm, 'i') } },
          { phoneNumber: { $regex: new RegExp(searchTerm, 'i') } }
        ],
        state: state,
        type: type
      }
    });
    return { success: true, customers: result.docs };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Update an existing customer
function updateCustomer(db, customerData) {
  const customer = {
    _id: customerData._id,
    type: "customer",
    state: "Active",
    ...customerData,
  };
  return db
    .put(customer)
    .then((response) => ({
      success: true,
      customer: { _id: response.id, ...customer },
    }))
    .catch((error) => ({ success: false, error: error.message }));
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
function getCustomerSales(db, customerId, fromDate, toDate) {
  return db
    .find({
      selector: {
        customerId: customerId,
        type: "sale",
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
function getTodayCreditSales(db) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return db.find({
    selector: {
      type: "sale",
      state: "Active",
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
function getTodayCustomerTransactions(db) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return db.find({
    selector: {
      type: "transaction",
      state: "Active",
      createdAt: {
        $gte: today.toISOString(),
        $lt: tomorrow.toISOString()
      }
    }
  })
  .then((result) => ({
    success: true,
    transactions: result.docs.filter(trans => trans.source === "customer")
  }))
  .catch((error) => ({
    success: false,
    error: error.message,
    transactions: []
  }));
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
