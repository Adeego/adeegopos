// Create a new customer
function createCustomer(realm, customerData) {
  try {
    let newCustomer;
    realm.write(() => {
      newCustomer = realm.create('Customer', {
        ...customerData,
        sales: []
      });
    });
    return { success: true, customer: newCustomer.toJSON() };
  } catch (error) {
    console.error('Error creating customer:', error);
    return { success: false, data: customerData, error: error.message };
  }
}

// Get all customers
function getAllCustomers(realm) {
  try {
    const customers = realm.objects('Customer');
    return { success: true, customers: customers.map(customer => customer.toJSON()) };
  } catch (error) {
    console.error('Error fetching customers:', error);
    return { success: false, error: error.message };
  }
}

// Get a customer by ID
function getCustomerById(realm, customerId) {
  try {
    const customer = realm.objectForPrimaryKey('Customer', customerId);
    return customer ? { success: true, customer: customer.toJSON() } : { success: false, error: 'Customer not found' };
  } catch (error) {
    console.error('Error fetching customer:', error);
    return { success: false, error: error.message };
  }
}

// Added a new function for customer search
function searchCustomers(realm, name) {
  try {
    const customers = realm.objects('Customer');
    const searchResults = customers.filtered('name CONTAINS[c] $0 OR phoneNumber CONTAINS[c] $0 OR address CONTAINS[c] $0', name);
    return { 
      success: true, 
      customers: searchResults.map(customer => customer.toJSON())
    };
  } catch (error) {
    console.error('Error searching customers:', error);
    return { success: false, error: error.message };
  }
}

// Update an existing customer
function updateCustomer(realm, customerData) {
  try {
    let updatedCustomer;
    realm.write(() => {
      updatedCustomer = realm.create('Customer', customerData, 'modified');
    });
    return { success: true, customer: updatedCustomer.toJSON() };
  } catch (error) {
    console.error('Error updating customer:', error);
    return { success: false, error: error.message };
  }
}

// Delete a customer
function deleteCustomer(realm, customerId) {
  try {
    let result;
    realm.write(() => {
      const customerToDelete = realm.objectForPrimaryKey('Customer', customerId);

      if (customerToDelete) {
        realm.delete(customerToDelete);
        console.log(`Customer with ID ${customerId} has been successfully deleted.`);
        result = { success: true };
      } else {
        console.warn(`Customer with ID ${customerId} not found.`);
        result = { success: false, error: 'Customer not found' };
      }
    });
    return result; // Return the result object
  } catch (error) {
    console.error('Error deleting customer:', error);
    return { success: false, error: error.message };
  }
}

// Query all sales for a specific customer
function getCustomerSales(realm, customerId) {
  const customer = realm.objectForPrimaryKey('Customer', customerId);
  return customer.sales;
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