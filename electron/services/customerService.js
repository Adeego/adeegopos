// Create a new customer
function createCustomer(db, customerData) {
  return db.put({
    _id: customerData._id,
    ...customerData,
    sales: []
  }).then(response => ({ success: true, customer: { _id: response.id, ...customerData } }))
    .catch(error => ({ success: false, data: customerData, error: error.message }));
}

// Get all customers
function getAllCustomers(db) {
  return db.allDocs({ include_docs: true })
    .then(result => ({ success: true, customers: result.rows.map(row => row.doc) }))
    .catch(error => ({ success: false, error: error.message }));
}

// Get a customer by ID
function getCustomerById(db, customerId) {
  return db.get(customerId)
    .then(customer => ({ success: true, customer }))
    .catch(error => ({ success: false, error: error.message }));
}

// Added a new function for customer search
function searchCustomers(db, name) {
  return db.find({
    selector: {
      $or: [
        { name: { $regex: name, $options: 'i' } },
        { phoneNumber: { $regex: name, $options: 'i' } },
        { address: { $regex: name, $options: 'i' } }
      ]
    }
  }).then(result => ({ success: true, customers: result.docs }))
    .catch(error => ({ success: false, error: error.message }));
}

// Update an existing customer
function updateCustomer(db, customerData) {
  return db.put(customerData)
    .then(response => ({ success: true, customer: { _id: response.id, ...customerData } }))
    .catch(error => ({ success: false, error: error.message }));
}

// Delete a customer
function deleteCustomer(db, customerId) {
  return db.get(customerId)
    .then(doc => db.remove(doc))
    .then(() => ({ success: true }))
    .catch(error => ({ success: false, error: error.message }));
}

// Query all sales for a specific customer
function getCustomerSales(db, customerId) {
  return db.find({
    selector: {
      customerId: customerId
    }
  }).then(result => result.docs)
    .catch(error => {
      console.error('Error fetching customer sales:', error);
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
    getCustomerSales
};
