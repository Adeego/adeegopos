// Create a new customer
function createCustomer(db, customerData) {
  const customer = {
    _id: `${customerData.storeNo}_${customerData._id}`,
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
      selector: { type: "customer" },
    })
    .then((result) => ({ success: true, customers: result.docs }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Get a customer by ID
function getCustomerById(db, customerId) {
  return db
    .get(`customer_${customerId}`)
    .then((customer) => ({ success: true, customer }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Added a new function for customer search
function searchCustomers(db, name) {
  return db
    .find({
      selector: {
        type: "customer",
        $or: [
          { name: { $regex: name, $options: "i" } },
          { phoneNumber: { $regex: name, $options: "i" } },
          { address: { $regex: name, $options: "i" } },
        ],
      },
    })
    .then((result) => ({ success: true, customers: result.docs }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Update an existing customer
function updateCustomer(db, customerData) {
  const customer = {
    _id: `customer_${customerData._id}`,
    type: "customer",
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
    .get(`customer_${customerId}`)
    .then((doc) => db.remove(doc))
    .then(() => ({ success: true }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Query all sales for a specific customer
function getCustomerSales(db, customerId) {
  return db
    .find({
      selector: {
        customerId: customerId,
      },
    })
    .then((result) => result.docs)
    .catch((error) => {
      console.error("Error fetching customer sales:", error);
      return [];
    });
}

module.exports = {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  searchCustomers,
  updateCustomer,
  deleteCustomer,
  getCustomerSales,
};
