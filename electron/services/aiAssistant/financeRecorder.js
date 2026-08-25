const { v4: uuidv4 } = require('uuid');

const customerService = require('../customerService');
const supplierService = require('../supplierService');
const transactionService = require('../finance/transactionService');
const expenseService = require('../finance/expenseService');
const expenseTypeService = require('../finance/expenseTypeService');
const accountService = require('../finance/accountService');

const pendingDrafts = new Map();
const DRAFT_TTL_MS = 30 * 60 * 1000;

function roundMoney(value) {
  const parsed = Number(value);
  return Number(Number.isFinite(parsed) ? parsed : 0).toFixed(2);
}

function toMoney(value) {
  return Number(roundMoney(value));
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeDate(value) {
  if (!value) {
    return { iso: new Date().toISOString(), warning: null };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { iso: null, warning: `Could not read date "${value}". Ask the user for a clearer date.` };
  }

  return { iso: parsed.toISOString(), warning: null };
}

function sameBusinessDate(left, right) {
  if (!left || !right) {
    return false;
  }

  return String(left).slice(0, 10) === String(right).slice(0, 10);
}

function compactDoc(doc = {}) {
  return {
    id: doc._id,
    type: doc.type,
    name: doc.name || doc.description || doc._id,
    amount: doc.amount || doc.totalAmount || null,
    balance: doc.balance,
    phoneNumber: doc.phoneNumber || '',
    accountNumber: doc.accountNumber || '',
    accountType: doc.accountType || '',
    date: doc.date || doc.createdAt || null,
    description: doc.description || '',
  };
}

function candidateList(docs = []) {
  return docs.slice(0, 8).map((doc) => ({
    id: doc._id,
    name: doc.name,
    phoneNumber: doc.phoneNumber || '',
    balance: doc.balance,
  }));
}

function cleanupDrafts() {
  const now = Date.now();
  for (const [token, draft] of pendingDrafts.entries()) {
    if (now - draft.createdAtMs > DRAFT_TTL_MS) {
      pendingDrafts.delete(token);
    }
  }
}

async function getDocs(db, selector, limit = 9999) {
  const result = await db.find({ selector, limit });
  return result.docs || [];
}

async function resolveFromCollection(db, { type, storeNo, id, name, label }) {
  if (id) {
    const doc = await db.get(id).catch(() => null);
    if (doc && doc.type === type && doc.state === 'Active' && (!storeNo || doc.storeNo === storeNo)) {
      return { doc };
    }

    return { error: `${label} ID "${id}" was not found in this store.` };
  }

  const docs = await getDocs(db, {
    type,
    state: 'Active',
    ...(storeNo ? { storeNo } : {}),
  });

  const term = normalizeText(name);
  if (!term) {
    return {
      error: `${label} is required.`,
      candidates: candidateList(docs),
    };
  }

  const exact = docs.filter((doc) => normalizeText(doc.name) === term);
  if (exact.length === 1) {
    return { doc: exact[0] };
  }

  const partial = docs.filter((doc) => normalizeText(doc.name).includes(term));
  if (partial.length === 1) {
    return { doc: partial[0] };
  }

  return {
    error: exact.length > 1 || partial.length > 1
      ? `${label} "${name}" is ambiguous. Ask the user to choose one.`
      : `${label} "${name}" was not found.`,
    candidates: candidateList(exact.length > 1 ? exact : partial.length > 1 ? partial : docs),
  };
}

async function resolveAccount(db, storeNo, args) {
  return resolveFromCollection(db, {
    type: 'account',
    storeNo,
    id: args.accountId,
    name: args.accountName || args.account,
    label: 'Account',
  });
}

async function resolveCustomer(db, storeNo, args) {
  return resolveFromCollection(db, {
    type: 'customer',
    storeNo,
    id: args.customerId,
    name: args.customerName || args.customer,
    label: 'Customer',
  });
}

async function resolveSupplier(db, storeNo, args) {
  return resolveFromCollection(db, {
    type: 'supplier',
    storeNo,
    id: args.supplierId,
    name: args.supplierName || args.supplier,
    label: 'Supplier',
  });
}

async function resolveExpenseType(db, storeNo, args) {
  return resolveFromCollection(db, {
    type: 'expenseType',
    storeNo,
    id: args.expenseTypeId,
    name: args.expenseTypeName || args.expenseType,
    label: 'Expense type',
  });
}

function transactionShape(recordType, account, entity, args, storeNo, isoDate) {
  const amount = toMoney(args.amount);
  const transactionCost = toMoney(args.transactionCost || 0);
  const description = args.description || defaultDescription(recordType, entity, amount);

  const base = {
    _id: `${storeNo}:transaction:${uuidv4()}`,
    storeNo,
    description,
    amount,
    transactionCost,
    date: isoDate,
    metadata: {
      recordedBy: 'aiAssistant',
      recordType,
    },
  };

  if (recordType === 'customer_payment') {
    return {
      ...base,
      transType: 'deposit',
      source: 'customer',
      destination: 'account',
      from: entity._id,
      to: account._id,
    };
  }

  if (recordType === 'customer_refund') {
    return {
      ...base,
      transType: 'withdraw',
      source: 'account',
      destination: 'customer',
      from: account._id,
      to: entity._id,
    };
  }

  if (recordType === 'supplier_payment') {
    return {
      ...base,
      transType: 'withdraw',
      source: 'account',
      destination: 'supplier',
      from: account._id,
      to: entity._id,
    };
  }

  return {
    ...base,
    transType: 'deposit',
    source: 'supplier',
    destination: 'account',
    from: entity._id,
    to: account._id,
  };
}

function defaultDescription(recordType, entity, amount) {
  const name = entity?.name || 'unknown';
  if (recordType === 'customer_payment') return `Customer payment from ${name} - KES ${amount}`;
  if (recordType === 'customer_refund') return `Customer refund to ${name} - KES ${amount}`;
  if (recordType === 'supplier_payment') return `Supplier payment to ${name} - KES ${amount}`;
  if (recordType === 'supplier_refund') return `Supplier refund from ${name} - KES ${amount}`;
  return `AI recorded ${recordType}`;
}

async function findDuplicateExpenses(db, storeNo, payload) {
  const docs = await getDocs(db, {
    type: 'expense',
    state: 'Active',
    storeNo,
  });

  return docs.filter((doc) =>
    sameBusinessDate(doc.date || doc.createdAt, payload.date) &&
    toMoney(doc.amount) === toMoney(payload.amount) &&
    doc.accountId === payload.accountId &&
    doc.expenseTypeId === payload.expenseTypeId
  ).map(compactDoc);
}

async function findDuplicateTransactions(db, storeNo, payload) {
  const docs = await getDocs(db, {
    type: 'transaction',
    state: 'Active',
    storeNo,
  });

  return docs.filter((doc) =>
    sameBusinessDate(doc.date || doc.createdAt, payload.date) &&
    toMoney(doc.amount) === toMoney(payload.amount) &&
    doc.source === payload.source &&
    doc.destination === payload.destination &&
    doc.from === payload.from &&
    doc.to === payload.to &&
    doc.transType === payload.transType
  ).map(compactDoc);
}

async function findDuplicateInvoices(db, storeNo, payload) {
  const docs = await getDocs(db, {
    type: 'invoice',
    state: 'Active',
    $or: [{ storeNo }, { store: storeNo }],
  });

  return docs.filter((doc) =>
    sameBusinessDate(doc.createdAt || doc.date, payload.createdAt) &&
    toMoney(doc.totalAmount) === toMoney(payload.totalAmount) &&
    doc.supplierId === payload.supplierId
  ).map(compactDoc);
}

function normalizeInvoiceItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const quantity = toMoney(item.quantity || 1);
      const buyPrice = toMoney(item.buyPrice || item.unitPrice || 0);
      const subtotal = item.subtotal !== undefined
        ? toMoney(item.subtotal)
        : toMoney(quantity * buyPrice);

      return {
        productId: item.productId || null,
        productName: item.productName || item.name || 'Invoice item',
        buyPrice,
        quantity,
        subtotal,
      };
    })
    .filter((item) => item.subtotal > 0);
}

async function buildExpenseDraft(db, storeNo, args, isoDate) {
  const [accountResult, typeResult] = await Promise.all([
    resolveAccount(db, storeNo, args),
    resolveExpenseType(db, storeNo, args),
  ]);

  const errors = [accountResult.error, typeResult.error].filter(Boolean);
  if (errors.length > 0) {
    return { errors, candidates: { accounts: accountResult.candidates, expenseTypes: typeResult.candidates } };
  }

  const payload = {
    _id: `${storeNo}:expense:${uuidv4()}`,
    storeNo,
    description: args.description,
    amount: toMoney(args.amount),
    transactionCost: toMoney(args.transactionCost || 0),
    date: isoDate,
    account: accountResult.doc.name,
    accountId: accountResult.doc._id,
    expenseType: typeResult.doc.name,
    expenseTypeId: typeResult.doc._id,
  };

  return {
    payload,
    summary: {
      type: 'Expense',
      amount: payload.amount,
      transactionCost: payload.transactionCost,
      description: payload.description,
      account: accountResult.doc.name,
      expenseType: typeResult.doc.name,
      date: payload.date,
    },
    duplicates: await findDuplicateExpenses(db, storeNo, payload),
  };
}

async function buildTransactionDraft(db, storeNo, args, isoDate) {
  const recordType = args.recordType;
  const entityResolver = recordType.startsWith('customer') ? resolveCustomer : resolveSupplier;
  const [accountResult, entityResult] = await Promise.all([
    resolveAccount(db, storeNo, args),
    entityResolver(db, storeNo, args),
  ]);

  const errors = [accountResult.error, entityResult.error].filter(Boolean);
  if (errors.length > 0) {
    return {
      errors,
      candidates: {
        accounts: accountResult.candidates,
        customers: recordType.startsWith('customer') ? entityResult.candidates : undefined,
        suppliers: recordType.startsWith('supplier') ? entityResult.candidates : undefined,
      },
    };
  }

  const payload = transactionShape(recordType, accountResult.doc, entityResult.doc, args, storeNo, isoDate);
  return {
    payload,
    summary: {
      type: recordType,
      amount: payload.amount,
      transactionCost: payload.transactionCost,
      description: payload.description,
      account: accountResult.doc.name,
      entity: entityResult.doc.name,
      direction: `${payload.source} -> ${payload.destination}`,
      date: payload.date,
    },
    duplicates: await findDuplicateTransactions(db, storeNo, payload),
  };
}

async function buildInvoiceDraft(db, storeNo, args, isoDate) {
  const supplierResult = await resolveSupplier(db, storeNo, args);
  if (supplierResult.error) {
    return { errors: [supplierResult.error], candidates: { suppliers: supplierResult.candidates } };
  }

  const items = normalizeInvoiceItems(args.items || args.invoiceItems || []);
  const itemTotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const totalAmount = toMoney(args.amount || args.totalAmount || itemTotal);
  if (totalAmount <= 0) {
    return { errors: ['Invoice amount must be greater than zero.'] };
  }

  const payload = {
    _id: `${storeNo}:invoice:${uuidv4()}`,
    storeNo,
    store: storeNo,
    supplierId: supplierResult.doc._id,
    description: args.description || `Supplier invoice from ${supplierResult.doc.name}`,
    totalAmount,
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    items,
    createdAt: isoDate,
    updatedAt: isoDate,
    metadata: {
      recordedBy: 'aiAssistant',
      reference: args.reference || null,
    },
  };

  return {
    payload,
    summary: {
      type: 'Supplier invoice',
      supplier: supplierResult.doc.name,
      amount: payload.totalAmount,
      itemCount: payload.items.length,
      description: payload.description,
      date: payload.createdAt,
    },
    duplicates: await findDuplicateInvoices(db, storeNo, payload),
  };
}

async function draftFinanceRecord(db, args = {}, storeNo) {
  cleanupDrafts();
  if (!storeNo) {
    return { success: false, error: 'storeNo is required.' };
  }

  const recordType = args.recordType;
  const validTypes = ['expense', 'customer_payment', 'customer_refund', 'supplier_payment', 'supplier_refund', 'supplier_invoice'];
  if (!validTypes.includes(recordType)) {
    return { success: false, error: `recordType must be one of: ${validTypes.join(', ')}` };
  }

  const amount = toMoney(args.amount || args.totalAmount);
  if (recordType !== 'supplier_invoice' && amount <= 0) {
    return { success: false, error: 'Amount must be greater than zero.' };
  }

  const parsedDate = normalizeDate(args.date);
  if (!parsedDate.iso) {
    return { success: false, error: parsedDate.warning };
  }

  let draftResult;
  if (recordType === 'expense') {
    draftResult = await buildExpenseDraft(db, storeNo, args, parsedDate.iso);
  } else if (recordType === 'supplier_invoice') {
    draftResult = await buildInvoiceDraft(db, storeNo, args, parsedDate.iso);
  } else {
    draftResult = await buildTransactionDraft(db, storeNo, { ...args, amount }, parsedDate.iso);
  }

  if (draftResult.errors?.length) {
    return {
      success: false,
      error: draftResult.errors.join(' '),
      candidates: draftResult.candidates || null,
    };
  }

  const token = `ai-finance-draft:${uuidv4()}`;
  pendingDrafts.set(token, {
    token,
    recordType,
    payload: draftResult.payload,
    summary: draftResult.summary,
    duplicateMatches: draftResult.duplicates || [],
    createdAtMs: Date.now(),
    storeNo,
  });

  const warnings = [];
  if (parsedDate.warning) warnings.push(parsedDate.warning);
  if ((draftResult.duplicates || []).length > 0) {
    warnings.push('Possible duplicate found. Confirm with the user before committing.');
  }

  return {
    success: true,
    storeNo,
    confirmationRequired: true,
    confirmationToken: token,
    summary: draftResult.summary,
    warnings,
    duplicateMatches: draftResult.duplicates || [],
    instruction: 'Show this summary to the user and ask for explicit confirmation. Commit only after the user confirms.',
  };
}

async function commitFinanceRecord(db, args = {}, storeNo) {
  cleanupDrafts();
  const token = args.confirmationToken;
  const draft = pendingDrafts.get(token);
  if (!draft) {
    return {
      success: false,
      error: 'Draft not found or expired. Create a fresh draft before recording.',
    };
  }

  if (storeNo && draft.storeNo !== storeNo) {
    return { success: false, error: 'Draft belongs to another store.' };
  }

  let result;
  if (draft.recordType === 'expense') {
    result = await expenseService.createExpense(db, draft.payload);
  } else if (draft.recordType === 'supplier_invoice') {
    result = await supplierService.createInvoice(db, draft.payload);
  } else {
    result = await transactionService.createTransaction(db, draft.payload);
  }

  if (result.success) {
    pendingDrafts.delete(token);
  }

  return {
    ...result,
    storeNo: draft.storeNo,
    recordType: draft.recordType,
    summary: draft.summary,
    duplicateMatches: draft.duplicateMatches,
  };
}

async function getRecordingReferenceData(db, args = {}, storeNo) {
  const include = Array.isArray(args.include) && args.include.length > 0
    ? args.include
    : ['accounts', 'expenseTypes', 'customers', 'suppliers'];

  const response = { success: true, storeNo };

  if (include.includes('accounts')) {
    const result = await accountService.getAllAccounts(db, storeNo);
    response.accounts = result.success ? result.accounts.map(compactDoc) : [];
  }

  if (include.includes('expenseTypes')) {
    const result = await expenseTypeService.getAllExpenseTypes(db, storeNo);
    response.expenseTypes = result.success ? result.expenseTypes.map(compactDoc) : [];
  }

  if (include.includes('customers')) {
    const result = await customerService.getAllCustomers(db, storeNo);
    response.customers = result.success ? result.customers.map(compactDoc) : [];
  }

  if (include.includes('suppliers')) {
    const result = await supplierService.getAllSuppliers(db, storeNo);
    response.suppliers = result.success ? result.suppliers.map(compactDoc) : [];
  }

  return response;
}

module.exports = {
  draftFinanceRecord,
  commitFinanceRecord,
  getRecordingReferenceData,
};
