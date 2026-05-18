const { v4: uuidv4 } = require('uuid');
const {
  getTransactionImpactRows,
  shouldIncludeTransactionInMetrics,
  toNumber,
} = require('./postingService');

function isInvoiceVoided(invoice = {}) {
  return invoice.status === 'voided';
}

function toDateValue(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getRowDate(row = {}) {
  return row.date || row.createdAt || row.updatedAt || null;
}

function compareRowsByDateAsc(a = {}, b = {}) {
  const diff = (toDateValue(getRowDate(a))?.getTime() || 0) - (toDateValue(getRowDate(b))?.getTime() || 0);
  if (diff !== 0) {
    return diff;
  }

  return String(a._id || a.ref || '').localeCompare(String(b._id || b.ref || ''));
}

function compareRowsByDateDesc(a = {}, b = {}) {
  return compareRowsByDateAsc(b, a);
}

function attachRunningBalances(rows = [], currentBalance) {
  const sortedRows = [...rows].sort(compareRowsByDateDesc);
  let balance = Number(toNumber(currentBalance).toFixed(2));

  return sortedRows
    .map((row) => {
      const nextRow = {
        ...row,
        runningBalance: Number(balance.toFixed(2)),
      };

      balance = Number((balance - toNumber(row.delta)).toFixed(2));
      return nextRow;
    })
    .sort(compareRowsByDateAsc);
}

function buildSupplierInvoiceLedgerRow(invoice = {}) {
  if (isInvoiceVoided(invoice)) {
    return null;
  }

  const amount = Math.abs(toNumber(invoice.totalAmount));
  if (!amount) {
    return null;
  }

  return {
    ...invoice,
    _id: `supplier-invoice:${invoice._id}`,
    ref: invoice._id,
    date: invoice.createdAt,
    delta: Number(amount.toFixed(2)),
    amount: Number(amount.toFixed(2)),
    kind: 'invoice',
    description: invoice.description || 'Supplier invoice posted',
    sourceDocType: 'invoice',
    sourceDocId: invoice._id,
  };
}

function buildSupplierTransactionLedgerRow(transaction = {}, supplierId) {
  const impactRow = getTransactionImpactRows(transaction, { direction: 1 }).find(
    (row) => row.entityType === 'supplier' && row.entityId === supplierId
  );

  if (!impactRow || !impactRow.delta) {
    return null;
  }

  const delta = Number(toNumber(impactRow.delta).toFixed(2));

  return {
    ...transaction,
    _id: `supplier-transaction:${transaction._id}`,
    ref: transaction._id,
    date: transaction.date || transaction.createdAt,
    delta,
    amount: Number(Math.abs(delta).toFixed(2)),
    kind: delta < 0 ? 'payment' : 'adjustment',
    description: transaction.description || (delta < 0 ? 'Supplier payment posted' : 'Supplier adjustment posted'),
    sourceDocType: 'transaction',
    sourceDocId: transaction._id,
  };
}

async function enrichTransactionsWithEntities(db, transactions) {
  const entityIds = [...new Set(
    transactions
      .flatMap((transaction) => [transaction.from, transaction.to])
      .filter(Boolean)
  )];

  const entities = await Promise.all(
    entityIds.map((entityId) => db.get(entityId).catch(() => null))
  );

  const entitiesMap = entities.reduce((acc, entity) => {
    if (entity?._id) {
      acc[entity._id] = entity;
    }
    return acc;
  }, {});

  return transactions.map((transaction) => ({
    ...transaction,
    fromEntity: entitiesMap[transaction.from] || null,
    toEntity: entitiesMap[transaction.to] || null,
    supplier:
      (transaction.destination === 'supplier' ? entitiesMap[transaction.to] : null) ||
      (transaction.source === 'supplier' ? entitiesMap[transaction.from] : null) ||
      null,
  }));
}

async function getSupplierInvoicesForStatement(db, supplierId, storeNo) {
  const result = await db.find({
    selector: {
      type: "invoice",
      state: "Active",
      supplierId,
      $or: [
        { storeNo },
        { store: storeNo }
      ]
    },
    limit: 9999,
  });

  return (result.docs || []).filter((invoice) => !isInvoiceVoided(invoice)).sort(compareRowsByDateDesc);
}

async function getSupplierTransactionsForStatement(db, supplierId, storeNo) {
  const result = await db.find({
    selector: {
      type: "transaction",
      state: "Active",
      storeNo,
      $or: [
        { from: supplierId },
        { to: supplierId }
      ]
    },
    limit: 9999,
  });

  const transactions = (result.docs || []).sort(compareRowsByDateDesc);
  return enrichTransactionsWithEntities(db, transactions);
}

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
  const invoiceList = Array.isArray(invoices) ? invoices : [invoices].filter(Boolean);

  // Validate input
  if (invoiceList.length === 0) {
    return Promise.resolve({ success: false, error: "No invoices provided" });
  }

  // Add type and state to invoices
  const processedInvoices = invoiceList.map(invoice => {
    const storeNo = invoice.storeNo || invoice.store || '';
    return {
      ...invoice,
      storeNo,
      store: invoice.store || invoice.storeNo || '',
      items: (invoice.items || []).map((item, index) => ({
        ...item,
        _id: item._id || item.lineId || `${storeNo || 'store'}:invoice-line:${uuidv4()}`,
        lineIndex: index,
      })),
      type: "invoice",
      state: "Active",
      status: invoice.status || "posted",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });

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

async function enrichInvoicesWithSuppliers(db, invoices) {
  const supplierIds = [...new Set(
    invoices
      .map(invoice => invoice.supplierId)
      .filter(Boolean)
  )];

  const suppliers = await Promise.all(
    supplierIds.map(supplierId =>
      db.get(supplierId).catch(error => ({ supplierId, error: error.message }))
    )
  );

  const suppliersMap = suppliers.reduce((acc, supplier) => {
    if (supplier && supplier._id) {
      acc[supplier._id] = supplier;
    }
    return acc;
  }, {});

  return invoices.map(invoice => ({
    ...invoice,
    supplier: suppliersMap[invoice.supplierId] || null
  }));
}

async function getInvoices(db, options = {}) {
  const storeNo = typeof options === 'string' ? options : options.storeNo;
  const period = typeof options === 'object' && options.period ? options.period : 'all';

  if (!storeNo) {
    return { success: false, error: "storeNo is required" };
  }

  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.slice(0, 7);

  try {
    const result = await db.find({
      selector: {
        type: "invoice",
        state: "Active",
        $or: [
          { storeNo },
          { store: storeNo }
        ]
      },
      limit: 9999,
    });

    const filteredInvoices = (result.docs || []).filter(invoice => {
      if (period === 'today') {
        return invoice.createdAt?.startsWith(today);
      }

      if (period === 'monthly') {
        return invoice.createdAt?.startsWith(currentMonth);
      }

      return true;
    });

    const sortedInvoices = filteredInvoices.sort((a, b) => {
      const aDate = new Date(a.createdAt || 0).getTime();
      const bDate = new Date(b.createdAt || 0).getTime();
      return bDate - aDate;
    });

    const invoicesWithSuppliers = await enrichInvoicesWithSuppliers(db, sortedInvoices);

    return {
      success: true,
      data: invoicesWithSuppliers
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get today's invoices
function getTodayInvoices(db, storeNo) {
  return getInvoices(db, { storeNo, period: 'today' })
    .then((result) => {
      if (!result.success) {
        return result;
      }

      return {
        success: true,
        invoices: result.data
      };
    });
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
function getAllSuppliers(db, storeNo) {
  return db
    .find({
      selector: {
        type: "supplier",
        state: "Active",
        ...(storeNo ? { storeNo } : {})
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

async function getSupplierStatement(db, supplierId, storeNo) {
  if (!supplierId) {
    return { success: false, error: "supplierId is required" };
  }

  if (!storeNo) {
    return { success: false, error: "storeNo is required" };
  }

  try {
    const supplier = await db.get(supplierId);
    const [invoiceDocs, transactionDocs] = await Promise.all([
      getSupplierInvoicesForStatement(db, supplierId, storeNo),
      getSupplierTransactionsForStatement(db, supplierId, storeNo),
    ]);

    const invoices = invoiceDocs.map((invoice) => ({
      ...invoice,
      supplier,
    }));

    const payments = transactionDocs.filter(shouldIncludeTransactionInMetrics);
    const ledgerRows = [
      ...invoices.map(buildSupplierInvoiceLedgerRow).filter(Boolean),
      ...payments.map((transaction) => buildSupplierTransactionLedgerRow(transaction, supplierId)).filter(Boolean),
    ].sort(compareRowsByDateAsc);

    const ledger = attachRunningBalances(ledgerRows, supplier.balance);
    const totalInvoiced = Number(
      invoices.reduce((sum, invoice) => sum + Math.abs(toNumber(invoice.totalAmount)), 0).toFixed(2)
    );
    const totalPaid = Number(
      payments.reduce((sum, transaction) => {
        const row = buildSupplierTransactionLedgerRow(transaction, supplierId);
        return sum + (row && row.delta < 0 ? Math.abs(row.delta) : 0);
      }, 0).toFixed(2)
    );
    const totalAdjustments = Number(
      payments.reduce((sum, transaction) => {
        const row = buildSupplierTransactionLedgerRow(transaction, supplierId);
        return sum + (row && row.delta > 0 ? row.delta : 0);
      }, 0).toFixed(2)
    );

    return {
      success: true,
      supplier,
      invoices,
      payments,
      ledger,
      summary: {
        currentBalance: Number(toNumber(supplier.balance).toFixed(2)),
        totalInvoiced,
        totalPaid,
        totalAdjustments,
        invoiceCount: invoices.length,
        paymentCount: payments.length,
        averageInvoiceValue: invoices.length ? Number((totalInvoiced / invoices.length).toFixed(2)) : 0,
        settledRatio: totalInvoiced > 0 ? Number(Math.min(100, (totalPaid / totalInvoiced) * 100).toFixed(2)) : 0,
        lastInvoiceAt: invoices[0]?.createdAt || null,
        lastPaymentAt: payments[0]?.date || payments[0]?.createdAt || null,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Update an existing supplier
function updateSupplier(db, supplierData) {
  const supplier = {
    _id: supplierData._id,
    type: "supplier",
    state: "Active",
    ...supplierData,
  };
  return db
    .put(supplier)
    .then((response) => ({
      success: true,
      supplier: { _id: response.id, ...supplier },
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
                                                                     
// Get today's supplier transactions
function getTodaySupplierTransactions(db, storeNo) {
  // Get today's date in ISO format (just the date part)
  const today = new Date().toISOString().split('T')[0];
  
  return db
    .find({
      selector: { 
        type: "transaction",
        state: "Active",
        storeNo: storeNo,
        destination: "supplier", // Added filter for supplier destination
        createdAt: { $regex: `^${today}` }
      },
    })
    .then((result) => {
      // Create an array of unique supplier IDs from the transactions
      const supplierIds = [...new Set(result.docs.map(transaction => transaction.to))];
      
      // Fetch suppliers for these transactions
      return Promise.all([
        Promise.resolve(result.docs), 
        Promise.all(supplierIds.map(supplierId => 
          db.get(supplierId)
            .catch(error => ({ supplierId, error: error.message }))
        ))
      ]);
    })
    .then(([transactions, suppliers]) => {
      // Create a map of suppliers for easy lookup
      const suppliersMap = suppliers.reduce((acc, supplier) => {
        // Handle cases where supplier fetch might have failed
        if (supplier._id) {
          acc[supplier._id] = supplier;
        }
        return acc;
      }, {});

      // Attach supplier information to each transaction
      const transactionsWithSuppliers = transactions.map(transaction => ({
        ...transaction,
        supplier: suppliersMap[transaction.to] || null
      }));

      return { 
        success: true, 
        transactions: transactionsWithSuppliers 
      };
    })
    .catch((error) => ({ success: false, error: error.message }));
}

module.exports = {                                                   
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  getSupplierStatement,
  updateSupplier,
  archiveSupplier,
  createInvoice,
  getInvoices,
  getTodayInvoices,
  getInvoiceById,
  getTodaySupplierTransactions,
};
