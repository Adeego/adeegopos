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

function createInvoice(db, invoices) {
  // Validate input
  if (!Array.isArray(invoices) || invoices.length === 0) {
    return Promise.resolve({ success: false, error: "No invoices provided" });
  }

  // Add type and state to invoices
  const processedInvoices = invoices.map(invoice => ({
    ...invoice,
    type: "invoice",
    state: "Active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));

  // Bulk put invoices
  return Promise.all(
    processedInvoices.map(invoice => 
      db.put(invoice)
        .then((response) => ({ 
          success: true, 
          invoice: { _id: response.id, ...invoice } 
        }))
        .catch((error) => ({ 
          success: false, 
          error: error.message, 
          invoiceId: invoice._id 
        }))
    )
  )
  .then(results => {
    // Check if all invoices were created successfully
    const failedInvoices = results.filter(result => !result.success);
    
    if (failedInvoices.length > 0) {
      return { 
        success: false, 
        error: "Some invoices failed to create", 
        failedInvoices 
      };
    }
    
    return { 
      success: true, 
      invoices: results.map(result => result.invoice) 
    };
  });
}

// Get today's invoices
function getTodayInvoices(db) {
  // Get today's date in ISO format (just the date part)
  const today = new Date().toISOString().split('T')[0];
  
  return db
    .find({
      selector: { 
        type: "invoice",
        state: "Active",
        createdAt: { $regex: `^${today}` }
      },
    })
    .then((result) => {
      // Create an array of unique supplier IDs from the invoices
      const supplierIds = [...new Set(result.docs.map(invoice => invoice.supplierId))];
      
      // Fetch suppliers for these invoices
      return Promise.all([
        Promise.resolve(result.docs), 
        Promise.all(supplierIds.map(supplierId => 
          db.get(supplierId)
            .catch(error => ({ supplierId, error: error.message }))
        ))
      ]);
    })
    .then(([invoices, suppliers]) => {
      // Create a map of suppliers for easy lookup
      const suppliersMap = suppliers.reduce((acc, supplier) => {
        // Handle cases where supplier fetch might have failed
        if (supplier._id) {
          acc[supplier._id] = supplier;
}
        return acc;
      }, {});

      // Attach supplier information to each invoice
      const invoicesWithSuppliers = invoices.map(invoice => ({
        ...invoice,
        supplier: suppliersMap[invoice.supplierId] || null
      }));

      return { 
        success: true, 
        invoices: invoicesWithSuppliers 
      };
    })
    .catch((error) => ({ success: false, error: error.message }));
}

function getInvoiceById(db, invoiceId) {
  return db
    .get(invoiceId)
    .then((invoice) => {
      // If the invoice has a supplierId, fetch the supplier
      if (invoice.supplierId) {
        return Promise.all([
          Promise.resolve(invoice),
          db.get(invoice.supplierId)
        ]);
      }
      // If no supplierId, return just the invoice
      return [invoice, null];
    })
    .then(([invoice, supplier]) => ({
      success: true,
      invoice,
      supplier: supplier || null
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
  createInvoice,
  getTodayInvoices,
  getInvoiceById,
};
