// Create a new supplier
function createSupplier(db, supplierData) {
  const supplier = {
    _id: supplierData._id,
    name: supplierData.name,
    phoneNumber: supplierData.phoneNumber,
    address: supplierData.address || '',
    balance: supplierData.balance,
    storeNo: supplierData.storeNo,
    createdAt: supplierData.createdAt,
    updatedAt: supplierData.updatedAt,
    type: "supplier",
    state: "Active"
  };
  return db
    .put(supplier)
    .then((response) => ({
      success: true,
      supplier: { _id: response.id, ...supplier },
    }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Get all suppliers
function getAllSuppliers(db) {
  return db
    .find({
      selector: { 
        type: "supplier",
        state: "Active"
      },
    })
    .then((result) => ({ success: true, suppliers: result.docs }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Get a supplier by ID
function getSupplierById(db, supplierId) {
  return db
    .get(supplierId)
    .then((supplier) => ({ success: true, supplier }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Update an existing supplier
function updateSupplier(db, supplierData) {
  const customer = {
    _id: supplierData._id,
    type: "customer",
    state: "Active",
    ...supplierData,
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
function archiveSupplier(db, supplierId) {
  return db
    .get(supplierId)
    .then((supplier) => {
      // Update the state field to "Inactive"
      supplier.state = "Inactive";
      return db.put(supplier);
    })
    .then(() => ({ success: true }))
    .catch((error) => ({ success: false, error: error.message }));
}
                                                                     
module.exports = {                                                   
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  archiveSupplier,
};                                                                   