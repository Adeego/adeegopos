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
