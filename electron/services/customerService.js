const {
  getCurrentCustomerId,
  getSaleNetAmount,
  getSalePaymentBreakdown,
  getTransactionImpactRows,
  shouldIncludeSaleInMetrics,
  shouldIncludeTransactionInMetrics,
  toNumber,
} = require('./postingService');
const { findAll } = require('./pouchQueryService');

const CUSTOMER_SALES_INDEXES = [
  {
    ddoc: 'customer-sales-original',
    name: 'customer-sales-original-index',
    field: 'customerId',
  },
  {
    ddoc: 'customer-sales-current',
    name: 'customer-sales-current-index',
    field: 'currentCustomerId',
  },
];
const CUSTOMER_TRANSACTION_INDEXES = [
  {
    ddoc: 'customer-transactions-from',
    name: 'customer-transactions-from-index',
    field: 'from',
  },
  {
    ddoc: 'customer-transactions-to',
    name: 'customer-transactions-to-index',
    field: 'to',
  },
];
const CUSTOMER_LEDGER_INDEX = {
  ddoc: 'customer-ledger',
  name: 'customer-ledger-index',
};
const indexPromises = new WeakMap();

function ensureCustomerActivityIndexes(db) {
  if (indexPromises.has(db)) {
    return indexPromises.get(db);
  }

  const setupPromise = Promise.all([
    ...[...CUSTOMER_SALES_INDEXES, ...CUSTOMER_TRANSACTION_INDEXES].map((index) =>
      db.createIndex({
        index: {
          fields: ['storeNo', 'type', 'state', index.field, 'createdAt'],
        },
        ddoc: index.ddoc,
        name: index.name,
      })
    ),
    db.createIndex({
      index: {
        fields: ['storeNo', 'type', 'state', 'entityType', 'entityId', 'bucket', 'createdAt'],
      },
      ddoc: CUSTOMER_LEDGER_INDEX.ddoc,
      name: CUSTOMER_LEDGER_INDEX.name,
    }),
  ]).then(() => undefined).catch((error) => {
    indexPromises.delete(db);
    throw error;
  });
  indexPromises.set(db, setupPromise);
  return setupPromise;
}

function toDateValue(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(value) {
  const date = toDateValue(value);
  if (!date) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value) {
  const date = toDateValue(value);
  if (!date) {
    return null;
  }

  date.setHours(23, 59, 59, 999);
  return date;
}

function normalizeDateRange(fromDate, toDate) {
  return {
    start: startOfDay(fromDate),
    end: endOfDay(toDate),
  };
}

function normalizeStoreQuery(input, fallbackStoreNo) {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return {
      storeNo: input.storeNo || fallbackStoreNo,
      fromDate: input.fromDate,
      toDate: input.toDate,
    };
  }

  return {
    storeNo: input || fallbackStoreNo,
    fromDate: null,
    toDate: null,
  };
}

function normalizeActivityRange(options = {}) {
  const today = new Date();

  return normalizeDateRange(
    options.fromDate || today,
    options.toDate || options.fromDate || today
  );
}

function inDateRange(value, fromDate, toDate) {
  const date = toDateValue(value);
  if (!date) {
    return false;
  }

  if (fromDate && date < fromDate) {
    return false;
  }

  if (toDate && date > toDate) {
    return false;
  }

  return true;
}

function decorateSale(sale = {}) {
  return {
    ...sale,
    currentCustomerId: getCurrentCustomerId(sale),
    netTotalAmount: getSaleNetAmount(sale),
    status: sale.status || 'posted',
  };
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

function createLedgerRowBase(row = {}) {
  const delta = Number(toNumber(row.delta).toFixed(2));
  const date = getRowDate(row) || new Date().toISOString();

  return {
    ...row,
    _id: row._id || row.ref || `${row.sourceDocType || 'ledger'}:${row.sourceDocId || Date.now()}`,
    date,
    delta,
    description: row.description || 'Ledger entry',
    entryType: row.entryType || (delta >= 0 ? 'CREDIT' : 'DEBIT'),
    amount: Number(Math.abs(delta).toFixed(2)),
    ref: row.ref || row.sourceDocId || row._id,
  };
}

function buildLedgerRowFromEntry(entry = {}) {
  return createLedgerRowBase({
    ...entry,
    date: entry.date || entry.createdAt,
    ref: entry.sourceDocId || entry._id,
  });
}

function buildLegacySaleLedgerRow(sale = {}) {
  const amount = getSalePaymentBreakdown(sale)
    .filter((payment) => payment.method === 'CREDIT')
    .reduce((sum, payment) => sum + Math.abs(toNumber(payment.amount)), 0);
  if (!amount) {
    return null;
  }

  return createLedgerRowBase({
    ...sale,
    _id: `legacy:sale:${sale._id}`,
    sourceDocType: 'sale',
    sourceDocId: sale._id,
    date: sale.createdAt,
    delta: sale.saleType === 'RETURN SALE' ? amount : -amount,
    description: sale.saleType === 'RETURN SALE' ? 'Credit sale return' : 'Credit sale',
    metadata: {
      saleType: sale.saleType,
      paymentMethod: sale.paymentMethod,
      legacySynthesized: true,
    },
  });
}

function buildLegacyTransactionLedgerRow(transaction = {}, customerId) {
  const impactRow = getTransactionImpactRows(transaction, { direction: 1 }).find(
    (row) => row.entityType === 'customer' && row.entityId === customerId
  );

  if (!impactRow || !impactRow.delta) {
    return null;
  }

  return createLedgerRowBase({
    ...transaction,
    _id: `legacy:transaction:${transaction._id}`,
    sourceDocType: 'transaction',
    sourceDocId: transaction._id,
    date: transaction.date || transaction.createdAt,
    delta: impactRow.delta,
    description: transaction.description || (impactRow.delta >= 0 ? 'Payment/Deposit' : 'Customer debit'),
    metadata: {
      source: transaction.source,
      destination: transaction.destination,
      transType: transaction.transType,
      legacySynthesized: true,
    },
  });
}

function buildCustomerCreditRow(customer = {}) {
  const balance = Number(toNumber(customer.balance).toFixed(2));
  const amountOwed = balance < 0 ? Number(Math.abs(balance).toFixed(2)) : 0;
  const storeCredit = balance > 0 ? balance : 0;

  return {
    _id: customer._id,
    name: customer.name || 'Unknown customer',
    phoneNumber: customer.phoneNumber || '',
    address: customer.address || '',
    status: customer.status || '',
    balance,
    amountOwed,
    storeCredit,
    creditApproved: Boolean(customer.credit),
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    storeNo: customer.storeNo,
  };
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

function mergeUniqueDocs(results = []) {
  return [...new Map(results
    .flatMap((result) => result.docs || [])
    .map((doc) => [doc._id, doc])).values()];
}

function buildCreatedAtSelector(fromDate, toDate) {
  return {
    $gte: fromDate ? fromDate.toISOString() : '',
    ...(toDate ? { $lte: toDate.toISOString() } : {}),
  };
}

async function findCustomerSales(db, customerId, storeNo, fromDate, toDate) {
  await ensureCustomerActivityIndexes(db);
  const createdAt = buildCreatedAtSelector(fromDate, toDate);
  const results = await Promise.all(CUSTOMER_SALES_INDEXES.map((index) => findAll(db, {
    selector: {
      storeNo,
      type: 'sale',
      state: 'Active',
      [index.field]: customerId,
      createdAt,
    },
    use_index: [index.ddoc, index.name],
  })));

  return mergeUniqueDocs(results)
    .map(decorateSale)
    .filter((sale) => getCurrentCustomerId(sale) === customerId);
}

async function findCustomerTransactions(db, customerId, storeNo) {
  await ensureCustomerActivityIndexes(db);
  const results = await Promise.all(CUSTOMER_TRANSACTION_INDEXES.map((index) => findAll(db, {
    selector: {
      storeNo,
      type: 'transaction',
      state: 'Active',
      [index.field]: customerId,
      createdAt: { $gte: '' },
    },
    use_index: [index.ddoc, index.name],
  })));

  return mergeUniqueDocs(results);
}

async function getAllCustomerLedgerRows(db, customerId, storeNo) {
  const [ledgerResult, salesResult, transactionsResult] = await Promise.all([
    findAll(db, {
      selector: {
        storeNo,
        type: 'ledger-entry',
        state: 'Active',
        entityType: 'customer',
        entityId: customerId,
        bucket: 'customer_balance',
        createdAt: { $gte: '' },
      },
      use_index: [CUSTOMER_LEDGER_INDEX.ddoc, CUSTOMER_LEDGER_INDEX.name],
    }),
    findCustomerSales(db, customerId, storeNo),
    findCustomerTransactions(db, customerId, storeNo),
  ]);

  const ledgerRows = (ledgerResult.docs || []).map(buildLedgerRowFromEntry);
  const representedSaleIds = new Set(
    ledgerRows
      .filter((row) => row.sourceDocType === 'sale' && row.sourceDocId)
      .map((row) => row.sourceDocId)
  );
  const representedTransactionIds = new Set(
    ledgerRows
      .filter((row) => row.sourceDocType === 'transaction' && row.sourceDocId)
      .map((row) => row.sourceDocId)
  );

  const legacySales = salesResult
    .filter((sale) =>
      getCurrentCustomerId(sale) === customerId &&
      getSalePaymentBreakdown(sale).some((payment) => payment.method === 'CREDIT') &&
      shouldIncludeSaleInMetrics(sale) &&
      !representedSaleIds.has(sale._id)
    )
    .map(buildLegacySaleLedgerRow)
    .filter(Boolean);

  const legacyTransactions = transactionsResult
    .filter((transaction) =>
      shouldIncludeTransactionInMetrics(transaction) &&
      !representedTransactionIds.has(transaction._id)
    )
    .map((transaction) => buildLegacyTransactionLedgerRow(transaction, customerId))
    .filter(Boolean);

  return [...ledgerRows, ...legacySales, ...legacyTransactions].sort(compareRowsByDateAsc);
}

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

async function getCustomerCreditOverview(db, input) {
  const { storeNo } = normalizeStoreQuery(input);

  try {
    const result = await db.find({
      selector: {
        type: 'customer',
        state: 'Active',
        storeNo,
      },
      limit: 9999,
    });

    const customers = (result.docs || [])
      .map(buildCustomerCreditRow)
      .sort((a, b) => b.amountOwed - a.amountOwed || a.name.localeCompare(b.name));

    const summary = customers.reduce((acc, customer) => {
      acc.totalOutstanding = Number((acc.totalOutstanding + customer.amountOwed).toFixed(2));
      acc.totalStoreCredit = Number((acc.totalStoreCredit + customer.storeCredit).toFixed(2));
      acc.debtorsCount += customer.amountOwed > 0 ? 1 : 0;
      acc.creditApprovedCount += customer.creditApproved ? 1 : 0;
      return acc;
    }, {
      totalOutstanding: 0,
      totalStoreCredit: 0,
      debtorsCount: 0,
      creditApprovedCount: 0,
    });

    return { success: true, customers, summary };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      customers: [],
      summary: {
        totalOutstanding: 0,
        totalStoreCredit: 0,
        debtorsCount: 0,
        creditApprovedCount: 0,
      },
    };
  }
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
async function getCustomerSales(db, customerId, fromDate, toDate, storeNo) {
  try {
    const { start, end } = normalizeDateRange(fromDate, toDate);
    const sales = (await findCustomerSales(db, customerId, storeNo, start, end))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return { success: true, sales };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      sales: [],
    };
  }
}

// Get today's credit sales
async function getTodayCreditSales(db, input) {
  const options = normalizeStoreQuery(input);
  const { start, end } = normalizeActivityRange(options);

  try {
    const [salesResult, customersResult] = await Promise.all([
      findAll(db, {
        selector: {
          type: 'sale',
          state: 'Active',
          storeNo: options.storeNo,
        },
      }),
      db.find({
        selector: {
          type: 'customer',
          state: 'Active',
          storeNo: options.storeNo,
        },
        limit: 9999,
      }),
    ]);

    const customersById = new Map((customersResult.docs || []).map((customer) => [customer._id, customer]));
    const sales = (salesResult.docs || [])
      .map(decorateSale)
      .filter((sale) =>
        getSalePaymentBreakdown(sale).some((payment) => payment.method === 'CREDIT') &&
        shouldIncludeSaleInMetrics(sale) &&
        inDateRange(sale.createdAt, start, end)
      )
      .map((sale) => {
        const customerId = getCurrentCustomerId(sale);
        const customerDetails = customerId ? customersById.get(customerId) : null;
        return {
          ...sale,
          customerDetails: customerDetails ? buildCustomerCreditRow(customerDetails) : null,
        };
      });

    return { success: true, sales };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      sales: [],
    };
  }
}

// Get today's transactions where source is customer
async function getTodayCustomerTransactions(db, input) {
  const options = normalizeStoreQuery(input);
  const { start, end } = normalizeActivityRange(options);

  try {
    // First, find all today's transactions from customers
    const transactionsResult = await findAll(db, {
    selector: {
      type: "transaction",
      state: "Active",
      source: "customer",
      storeNo: options.storeNo
    },
    });

    // Now, fetch customer details for each transaction
    const transactionsWithCustomerDetails = await Promise.all(
      transactionsResult.docs
        .filter((transaction) =>
          shouldIncludeTransactionInMetrics(transaction) &&
          inDateRange(transaction.date || transaction.createdAt, start, end)
        )
        .map(async (transaction) => {
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
    const customer = await db.get(customerId);
    const { start, end } = normalizeDateRange(fromDate, toDate);
    const ledger = attachRunningBalances(
      await getAllCustomerLedgerRows(db, customerId, storeNo),
      customer.balance
    ).filter((entry) => inDateRange(entry.date, start, end));

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
    let balance = toNumber(customer.balance);
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

    const ledgerRows = await getAllCustomerLedgerRows(db, customerId, storeNo);
    console.log(`[getCustomerAging] Found ${ledgerRows.length} customer ledger rows.`);
    
    const debits = [];

    ledgerRows.forEach((entry) => {
      const delta = toNumber(entry.delta);
      if (delta < 0) {
        debits.push({
          date: new Date(entry.date || entry.createdAt),
          amount: Math.abs(delta),
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
  getCustomerCreditOverview,
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
