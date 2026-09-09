const {
  getSalePaymentBreakdown,
  getTransactionImpactRows,
  toNumber,
} = require('../postingService');

const CHART = {
  CASH: { code: '1110', name: 'Cash' },
  MPESA: { code: '1120', name: 'M-Pesa' },
  AR: { code: '1130', name: 'Accounts Receivable' },
  INVENTORY: { code: '1140', name: 'Inventory' },
  PREPAID: { code: '1150', name: 'Prepaid Expenses' },
  UNCONFIRMED_TENDER: { code: '1160', name: 'Unconfirmed Tender' },
  OTHER_CURRENT_ASSET: { code: '1190', name: 'Other Current Assets' },
  PPE: { code: '1200', name: 'Property & Equipment' },
  ACCUM_DEPRECIATION: { code: '1240', name: 'Accumulated Depreciation' },
  AP: { code: '2110', name: 'Accounts Payable' },
  SHORT_TERM_LOANS: { code: '2120', name: 'Short-Term Loans' },
  OTHER_CURRENT_LIABILITY: { code: '2190', name: 'Other Current Liabilities' },
  LONG_TERM_LOANS: { code: '2210', name: 'Long-Term Loans' },
  OWNER_CAPITAL: { code: '3100', name: "Owner's Capital" },
  RETAINED_EARNINGS: { code: '3200', name: 'Retained Earnings' },
  OPENING_EQUITY: { code: '3999', name: 'Opening Balance Equity' },
  SALES: { code: '4110', name: 'Sales Revenue' },
  COGS: { code: '5110', name: 'Cost of Goods Sold' },
  UNCATEGORIZED_EXPENSE: { code: '5199', name: 'Uncategorized Expense' },
  TRANSACTION_FEES: { code: '5290', name: 'Transaction Fees' },
};

const BALANCE_SHEET_CATEGORY_CODES = {
  'Cash and Bank Balances': CHART.CASH,
  Cash: CHART.CASH,
  'Bank Account': CHART.MPESA,
  'Accounts Receivable': CHART.AR,
  Inventory: CHART.INVENTORY,
  'Prepaid Expenses': CHART.PREPAID,
  'Other Current Assets': CHART.OTHER_CURRENT_ASSET,
  'Property & Equipment': CHART.PPE,
  Equipment: CHART.PPE,
  'Real Estate': CHART.PPE,
  Investments: CHART.OTHER_CURRENT_ASSET,
  'Accumulated Depreciation': CHART.ACCUM_DEPRECIATION,
  'Accounts Payable': CHART.AP,
  'Short-Term Loans': CHART.SHORT_TERM_LOANS,
  'Bank Loans': CHART.SHORT_TERM_LOANS,
  'Credit Card Debt': CHART.OTHER_CURRENT_LIABILITY,
  'Taxes Payable': CHART.OTHER_CURRENT_LIABILITY,
  'Salaries Payable': CHART.OTHER_CURRENT_LIABILITY,
  'Lease Obligations': CHART.LONG_TERM_LOANS,
  'Other Current Liabilities': CHART.OTHER_CURRENT_LIABILITY,
  'Long-Term Loans': CHART.LONG_TERM_LOANS,
  "Owner's Capital": CHART.OWNER_CAPITAL,
  'Retained Earnings': CHART.RETAINED_EARNINGS,
  'Common Stock': CHART.OWNER_CAPITAL,
  'Preferred Stock': CHART.OWNER_CAPITAL,
  'Additional Paid-in Capital': CHART.OWNER_CAPITAL,
};

function roundMoney(value) {
  return Number(toNumber(value).toFixed(2));
}

function absMoney(value) {
  return roundMoney(Math.abs(toNumber(value)));
}

function parseDate(value, fallback = new Date()) {
  const parsed = value ? new Date(value) : fallback;
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function normalizeDateRange(fromDate, toDateValue) {
  const from = parseDate(fromDate, new Date(0));
  from.setHours(0, 0, 0, 0);
  const to = parseDate(toDateValue, new Date());
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function getStoreNo(doc = {}) {
  return doc.storeNo || doc.store || '';
}

function sourceKey(sourceDocType, sourceDocId, entryKind = 'posted') {
  return `${sourceDocType}:${entryKind}:${sourceDocId}`;
}

function journalEntryId(storeNo, sourceDocType, sourceDocId, entryKind = 'posted') {
  return `${storeNo}:journal-entry:${sourceKey(sourceDocType, sourceDocId, entryKind)}`;
}

function addLine(lines, line) {
  const debit = absMoney(line.debit);
  const credit = absMoney(line.credit);
  if (!debit && !credit) return;
  if (debit && credit) {
    throw new Error(`Journal line cannot have both debit and credit: ${line.accountCode}`);
  }

  lines.push({
    accountCode: line.accountCode,
    accountName: line.accountName,
    debit,
    credit,
    entityType: line.entityType || null,
    entityId: line.entityId || null,
    description: line.description || '',
    metadata: line.metadata || null,
  });
}

function debit(lines, account, amount, extra = {}) {
  addLine(lines, {
    accountCode: account.code,
    accountName: account.name,
    debit: amount,
    credit: 0,
    ...extra,
  });
}

function credit(lines, account, amount, extra = {}) {
  addLine(lines, {
    accountCode: account.code,
    accountName: account.name,
    debit: 0,
    credit: amount,
    ...extra,
  });
}

function normalizePaymentMethod(value) {
  const method = String(value || 'CASH').trim().toUpperCase();
  if (method === 'M-PESA' || method === 'PHONE') return 'MPESA';
  return method;
}

function accountCodeFromDoc(account = {}, fallbackIndex = 0) {
  if (account.glAccountCode) {
    return {
      code: account.glAccountCode,
      name: account.glAccountName || account.name || `Account ${account.glAccountCode}`,
    };
  }

  const accountNumber = String(account.accountNumber || '');
  const name = String(account.name || '').toLowerCase();
  if (accountNumber.endsWith('001') || name.includes('cash')) {
    return { ...CHART.CASH, name: account.name || CHART.CASH.name };
  }
  if (accountNumber.endsWith('002') || name.includes('mpesa') || name.includes('m-pesa')) {
    return { ...CHART.MPESA, name: account.name || CHART.MPESA.name };
  }

  const offset = Math.max(0, Number(fallbackIndex) || 0);
  return {
    code: String(1160 + offset).padStart(4, '0'),
    name: account.name || `Cash/Bank Account ${offset + 1}`,
  };
}

async function getActiveDocs(db, selector, limit = 100000) {
  const result = await db.find({ selector, limit });
  return result.docs || [];
}

async function getAccounts(db, storeNo) {
  return getActiveDocs(db, {
    type: 'account',
    state: 'Active',
    ...(storeNo ? { storeNo } : {}),
  });
}

async function getExpenseTypes(db, storeNo) {
  return getActiveDocs(db, {
    type: 'expenseType',
    state: 'Active',
    ...(storeNo ? { storeNo } : {}),
  });
}

async function persistAccountCode(db, account, glAccount) {
  if (!account?._id || account.glAccountCode === glAccount.code) return account;
  const updated = {
    ...account,
    glAccountCode: glAccount.code,
    glAccountName: glAccount.name,
    updatedAt: new Date().toISOString(),
  };
  await db.put(updated);
  return updated;
}

async function persistExpenseTypeCode(db, expenseType, account) {
  if (!expenseType?._id || expenseType.accountCode === account.code) return expenseType;
  const updated = {
    ...expenseType,
    accountCode: account.code,
    accountName: account.name,
    updatedAt: new Date().toISOString(),
  };
  await db.put(updated);
  return updated;
}

async function getAccountCodeMap(db, storeNo, options = {}) {
  const accounts = (await getAccounts(db, storeNo))
    .sort((a, b) => String(a.accountNumber || a.name || a._id).localeCompare(String(b.accountNumber || b.name || b._id)));
  const map = new Map();

  for (let index = 0; index < accounts.length; index += 1) {
    const accountDoc = accounts[index];
    const account = accountCodeFromDoc(accountDoc, index);
    map.set(accountDoc._id, account);
    if (options.persist) {
      await persistAccountCode(db, accountDoc, account);
    }
  }

  return map;
}

async function getExpenseTypeAccountMap(db, storeNo, options = {}) {
  const expenseTypes = (await getExpenseTypes(db, storeNo))
    .sort((a, b) => String(a.name || a._id).localeCompare(String(b.name || b._id)));
  const mapById = new Map();
  const mapByName = new Map();

  for (let index = 0; index < expenseTypes.length; index += 1) {
    const type = expenseTypes[index];
    const account = {
      code: type.accountCode || `51${String(index + 20).padStart(2, '0')}`,
      name: type.accountName || type.name || `Expense ${index + 1}`,
    };
    if (type._id) mapById.set(type._id, account);
    if (type.name) mapByName.set(String(type.name).toLowerCase(), account);
    if (options.persist) {
      await persistExpenseTypeCode(db, type, account);
    }
  }

  return { mapById, mapByName };
}

async function findPaymentAccount(db, storeNo, payment = {}) {
  if (payment.accountId) {
    const account = await db.get(payment.accountId).catch(() => null);
    if (account?.type === 'account') return account;
  }

  const method = normalizePaymentMethod(payment.method || payment.paymentMethod);
  const suffix = method === 'MPESA' ? '002' : method === 'CASH' ? '001' : null;
  if (!suffix || !storeNo) return null;

  const accounts = await getActiveDocs(db, {
    type: 'account',
    state: 'Active',
    storeNo,
    accountNumber: `${storeNo}${suffix}`,
  }, 1);
  return accounts[0] || null;
}

function createJournalDoc(spec) {
  const lines = spec.lines || [];
  const totalDebits = roundMoney(lines.reduce((sum, line) => sum + toNumber(line.debit), 0));
  const totalCredits = roundMoney(lines.reduce((sum, line) => sum + toNumber(line.credit), 0));

  if (lines.length < 2) {
    throw new Error(`Journal entry ${spec.sourceDocType}:${spec.sourceDocId} must have at least two lines`);
  }
  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    throw new Error(`Journal entry ${spec.sourceDocType}:${spec.sourceDocId} is not balanced`);
  }

  const now = new Date().toISOString();
  const storeNo = spec.storeNo;
  const entryKind = spec.entryKind || 'posted';
  return {
    _id: spec._id || journalEntryId(storeNo, spec.sourceDocType, spec.sourceDocId, entryKind),
    type: 'journal-entry',
    state: 'Active',
    status: spec.status || 'posted',
    storeNo,
    sourceDocType: spec.sourceDocType,
    sourceDocId: spec.sourceDocId,
    sourceKey: sourceKey(spec.sourceDocType, spec.sourceDocId, entryKind),
    entryKind,
    description: spec.description || '',
    date: parseDate(spec.date || spec.createdAt || now).toISOString(),
    lines,
    totalDebits,
    totalCredits,
    metadata: spec.metadata || null,
    createdAt: spec.createdAt || now,
    updatedAt: spec.updatedAt || spec.createdAt || now,
  };
}

async function putJournalEntry(db, spec, options = {}) {
  const doc = createJournalDoc(spec);
  if (options.skipExisting !== false) {
    const existing = await db.get(doc._id).catch(() => null);
    if (existing) {
      return { success: true, created: false, journalEntry: existing };
    }
  }

  await db.put(doc);
  return { success: true, created: true, journalEntry: doc };
}

function getSaleCost(sale = {}) {
  return roundMoney((sale.items || []).reduce((sum, item) => {
    return sum + (Math.abs(toNumber(item.quantity)) * toNumber(item.buyPrice));
  }, 0));
}

async function buildSaleJournalSpec(db, sale = {}, options = {}) {
  const storeNo = getStoreNo(sale);
  if (!storeNo || !sale._id) throw new Error('Sale journal requires storeNo and _id');
  if (sale.state && sale.state !== 'Active') return null;
  if (sale.status === 'voided') return null;

  const lines = [];
  const accountMap = await getAccountCodeMap(db, storeNo, options);
  const isReturn = sale.saleType === 'RETURN SALE' || toNumber(sale.totalAmount) < 0;

  for (const payment of getSalePaymentBreakdown(sale)) {
    const amount = absMoney(payment.amount);
    if (!amount) continue;
    const method = normalizePaymentMethod(payment.method || sale.paymentMethod);
    const lineMeta = {
      role: 'payment',
      paymentMethod: method,
      sourceDocType: 'sale',
      sourceDocId: sale._id,
    };

    if (method === 'CREDIT') {
      const extra = {
        entityType: 'customer',
        entityId: sale.currentCustomerId || sale.customerId || null,
        metadata: lineMeta,
      };
      if (isReturn) credit(lines, CHART.AR, amount, extra);
      else debit(lines, CHART.AR, amount, extra);
      continue;
    }

    const paymentAccountDoc = await findPaymentAccount(db, storeNo, payment);
    const paymentAccount = sale.paid === true
      ? (paymentAccountDoc?._id
          ? (accountMap.get(paymentAccountDoc._id) || accountCodeFromDoc(paymentAccountDoc))
          : (method === 'MPESA' ? CHART.MPESA : CHART.CASH))
      : CHART.UNCONFIRMED_TENDER;
    const extra = {
      entityType: 'account',
      entityId: paymentAccountDoc?._id || null,
      metadata: lineMeta,
    };
    if (isReturn) credit(lines, paymentAccount, amount, extra);
    else debit(lines, paymentAccount, amount, extra);
  }

  const revenue = absMoney(sale.totalAmount || lines.reduce((sum, line) => sum + toNumber(line.debit), 0));
  if (revenue > 0) {
    const extra = { metadata: { role: 'revenue', saleType: sale.saleType || 'NEW SALE' } };
    if (isReturn) debit(lines, CHART.SALES, revenue, extra);
    else credit(lines, CHART.SALES, revenue, extra);
  }

  const cogs = getSaleCost(sale);
  if (cogs > 0) {
    if (isReturn) {
      debit(lines, CHART.INVENTORY, cogs, { metadata: { role: 'inventory_return' } });
      credit(lines, CHART.COGS, cogs, { metadata: { role: 'cogs_return' } });
    } else {
      debit(lines, CHART.COGS, cogs, { metadata: { role: 'cogs' } });
      credit(lines, CHART.INVENTORY, cogs, { metadata: { role: 'inventory_out' } });
    }
  }

  return {
    storeNo,
    sourceDocType: 'sale',
    sourceDocId: sale._id,
    entryKind: sale.reversalOfId ? 'reversal' : 'posted',
    description: sale.note || `Sale ${sale._id}`,
    date: sale.createdAt || sale.date,
    lines,
    metadata: {
      saleType: sale.saleType || 'NEW SALE',
      status: sale.status || 'posted',
      reconciliationCaseType: sale.reconciliationCaseType || null,
    },
  };
}

async function ensureJournalEntryForSalePayment(db, confirmation = {}) {
  const storeNo = getStoreNo(confirmation);
  const lines = [];
  const accountMap = await getAccountCodeMap(db, storeNo, { persist: true });
  for (const payment of confirmation.paymentBreakdown || []) {
    const amount = absMoney(payment.amount);
    const fee = absMoney(payment.transactionCost);
    if (!amount) continue;
    const accountDoc = await findPaymentAccount(db, storeNo, payment);
    const account = accountDoc?._id
      ? (accountMap.get(accountDoc._id) || accountCodeFromDoc(accountDoc))
      : (normalizePaymentMethod(payment.method) === 'MPESA' ? CHART.MPESA : CHART.CASH);
    const extra = {
      entityType: 'account',
      entityId: accountDoc?._id || payment.accountId || null,
      metadata: { role: 'confirmed_tender', paymentMethod: normalizePaymentMethod(payment.method) },
    };
    const clearingExtra = { metadata: { role: 'clear_unconfirmed_tender', saleId: confirmation.saleId } };
    if (confirmation.saleType === 'RETURN SALE') {
      debit(lines, CHART.UNCONFIRMED_TENDER, amount, clearingExtra);
      if (fee) debit(lines, CHART.TRANSACTION_FEES, fee, { metadata: { role: 'fee' } });
      credit(lines, account, amount + fee, extra);
    } else {
      debit(lines, account, Math.max(0, amount - fee), extra);
      if (fee) debit(lines, CHART.TRANSACTION_FEES, fee, { metadata: { role: 'fee' } });
      credit(lines, CHART.UNCONFIRMED_TENDER, amount, clearingExtra);
    }
  }
  if (lines.length === 0) return { success: true, created: false, skipped: true };
  return putJournalEntry(db, {
    storeNo,
    sourceDocType: 'sale-payment',
    sourceDocId: confirmation._id,
    description: `Payment confirmed for sale ${confirmation.saleId}`,
    date: confirmation.confirmedAt || confirmation.createdAt,
    lines,
    metadata: {
      saleId: confirmation.saleId,
      registerSessionId: confirmation.registerSessionId,
      confirmedBy: confirmation.confirmedBy,
    },
  });
}

function addEntityDeltaLine(lines, row, account) {
  const amount = absMoney(row.delta);
  if (!amount) return;

  if (row.entityType === 'customer') {
    if (toNumber(row.delta) > 0) credit(lines, CHART.AR, amount, account);
    else debit(lines, CHART.AR, amount, account);
    return;
  }

  if (row.entityType === 'supplier') {
    if (toNumber(row.delta) > 0) credit(lines, CHART.AP, amount, account);
    else debit(lines, CHART.AP, amount, account);
    return;
  }

  if (toNumber(row.delta) > 0) debit(lines, account.account, amount, account);
  else credit(lines, account.account, amount, account);
}

async function buildTransactionJournalSpec(db, transaction = {}, options = {}) {
  const storeNo = getStoreNo(transaction);
  if (!storeNo || !transaction._id) throw new Error('Transaction journal requires storeNo and _id');
  if (transaction.state && transaction.state !== 'Active') return null;
  if (transaction.status === 'reversed' && !transaction.reversalOfId) return null;

  const direction = options.direction || (transaction.reversalOfId ? -1 : 1);
  const rows = getTransactionImpactRows(transaction, { direction });
  const accountMap = await getAccountCodeMap(db, storeNo, options);
  const lines = [];

  for (const row of rows) {
    if (!row.entityType || !row.entityId || !row.delta) continue;
    let account = CHART.OTHER_CURRENT_ASSET;
    if (row.entityType === 'account') {
      account = accountMap.get(row.entityId) || CHART.CASH;
    }
    addEntityDeltaLine(lines, row, {
      account,
      entityType: row.entityType,
      entityId: row.entityId,
      metadata: {
        source: transaction.source,
        destination: transaction.destination,
        transType: transaction.transType,
      },
    });
  }

  const fee = absMoney(transaction.transactionCost);
  if (fee > 0) {
    if (direction === -1) credit(lines, CHART.TRANSACTION_FEES, fee, { metadata: { role: 'fee_reversal' } });
    else debit(lines, CHART.TRANSACTION_FEES, fee, { metadata: { role: 'fee' } });
  }

  return {
    storeNo,
    sourceDocType: 'transaction',
    sourceDocId: transaction._id,
    entryKind: transaction.reversalOfId ? 'reversal' : 'posted',
    description: transaction.description || `Transaction ${transaction._id}`,
    date: transaction.date || transaction.createdAt,
    lines,
    metadata: {
      transType: transaction.transType,
      source: transaction.source,
      destination: transaction.destination,
      reversalOfId: transaction.reversalOfId || null,
      replacementOfId: transaction.replacementOfId || null,
    },
  };
}

async function buildExpenseJournalSpec(db, expense = {}, options = {}) {
  const storeNo = getStoreNo(expense);
  if (!storeNo || !expense._id) throw new Error('Expense journal requires storeNo and _id');
  if (expense.state && expense.state !== 'Active' && !options.reversal) return null;

  const accountMap = await getAccountCodeMap(db, storeNo, options);
  const expenseMap = await getExpenseTypeAccountMap(db, storeNo, options);
  const account = accountMap.get(expense.accountId) || CHART.CASH;
  const expenseAccount =
    (expense.expenseTypeId && expenseMap.mapById.get(expense.expenseTypeId)) ||
    (expense.expenseType && expenseMap.mapByName.get(String(expense.expenseType).toLowerCase())) ||
    { ...CHART.UNCATEGORIZED_EXPENSE, name: expense.expenseType || CHART.UNCATEGORIZED_EXPENSE.name };
  const amount = absMoney(expense.amount);
  const fee = absMoney(expense.transactionCost);
  const lines = [];

  if (options.reversal) {
    debit(lines, account, amount + fee, { entityType: 'account', entityId: expense.accountId || null });
    credit(lines, expenseAccount, amount, { metadata: { expenseType: expense.expenseType || null, role: 'expense_reversal' } });
    if (fee > 0) credit(lines, CHART.TRANSACTION_FEES, fee, { metadata: { role: 'fee_reversal' } });
  } else {
    debit(lines, expenseAccount, amount, { metadata: { expenseType: expense.expenseType || null, role: 'expense' } });
    if (fee > 0) debit(lines, CHART.TRANSACTION_FEES, fee, { metadata: { role: 'fee' } });
    credit(lines, account, amount + fee, { entityType: 'account', entityId: expense.accountId || null });
  }

  return {
    storeNo,
    sourceDocType: 'expense',
    sourceDocId: expense._id,
    entryKind: options.reversal ? (options.entryKind || 'reversal') : 'posted',
    description: options.reversal
      ? `Reversal: ${expense.description || expense._id}`
      : (expense.description || `Expense ${expense._id}`),
    date: options.date || expense.date || expense.createdAt,
    lines,
    metadata: {
      expenseType: expense.expenseType || null,
      reversalOfId: options.reversal ? expense._id : null,
    },
  };
}

function getInvoiceTotal(invoice = {}) {
  const explicit = absMoney(invoice.totalAmount);
  if (explicit) return explicit;
  return roundMoney((invoice.items || []).reduce((sum, item) => {
    const subtotal = Number(item.subtotal);
    if (Number.isFinite(subtotal)) return sum + Math.abs(subtotal);
    return sum + (Math.abs(toNumber(item.quantity)) * Math.abs(toNumber(item.buyPrice)));
  }, 0));
}

async function buildInvoiceJournalSpec(db, invoice = {}, options = {}) {
  const storeNo = getStoreNo(invoice);
  if (!storeNo || !invoice._id) throw new Error('Invoice journal requires storeNo and _id');
  if (invoice.state && invoice.state !== 'Active') return null;
  if (invoice.status === 'voided' && !options.reversal) return null;
  const amount = getInvoiceTotal(invoice);
  if (!amount) return null;

  const lines = [];
  if (options.reversal) {
    debit(lines, CHART.AP, amount, { entityType: 'supplier', entityId: invoice.supplierId || null });
    credit(lines, CHART.INVENTORY, amount);
  } else {
    debit(lines, CHART.INVENTORY, amount);
    credit(lines, CHART.AP, amount, { entityType: 'supplier', entityId: invoice.supplierId || null });
  }

  return {
    storeNo,
    sourceDocType: 'invoice',
    sourceDocId: invoice._id,
    entryKind: options.reversal ? (options.entryKind || 'reversal') : 'posted',
    description: invoice.description || `Supplier invoice ${invoice._id}`,
    date: invoice.createdAt || invoice.date,
    lines,
    metadata: {
      supplierId: invoice.supplierId || null,
      reversalOfId: options.reversal ? invoice._id : null,
    },
  };
}

function buildManualAdjustmentSpec(entry = {}) {
  const storeNo = getStoreNo(entry);
  if (!storeNo || !entry._id) throw new Error('Manual adjustment requires storeNo and _id');
  if (entry.state && entry.state !== 'Active') return null;

  const amount = absMoney(entry.amount);
  if (!amount) return null;

  const account = BALANCE_SHEET_CATEGORY_CODES[entry.category] || CHART.OTHER_CURRENT_ASSET;
  const lines = [];
  if (entry.type === 'asset') {
    if (account.code === CHART.ACCUM_DEPRECIATION.code) {
      debit(lines, CHART.OPENING_EQUITY, amount);
      credit(lines, account, amount);
    } else {
      debit(lines, account, amount);
      credit(lines, CHART.OPENING_EQUITY, amount);
    }
  } else if (entry.type === 'liability' || entry.type === 'equity') {
    debit(lines, CHART.OPENING_EQUITY, amount);
    credit(lines, account, amount);
  } else {
    return null;
  }

  return {
    storeNo,
    sourceDocType: 'manual-adjustment',
    sourceDocId: entry._id,
    entryKind: 'posted',
    description: entry.description || `${entry.category} adjustment`,
    date: entry.createdAt || entry.date,
    lines,
    metadata: {
      category: entry.category,
      manualType: entry.type,
    },
  };
}

function buildOpeningAdjustmentSpec({ storeNo, sourceDocId, description, account, diff, entityType = null, entityId = null }) {
  const amount = absMoney(diff);
  if (!amount) return null;
  const lines = [];
  const accountExtra = {
    entityType,
    entityId,
    metadata: { role: 'opening_balance_adjustment' },
  };

  if (diff > 0) {
    debit(lines, account, amount, accountExtra);
    credit(lines, CHART.OPENING_EQUITY, amount);
  } else {
    debit(lines, CHART.OPENING_EQUITY, amount);
    credit(lines, account, amount, accountExtra);
  }

  return {
    storeNo,
    sourceDocType: 'backfill-adjustment',
    sourceDocId,
    entryKind: 'opening-balance',
    description,
    date: new Date().toISOString(),
    lines,
    metadata: {
      diff: roundMoney(diff),
      accountCode: account.code,
    },
  };
}

async function ensureJournalEntryForSale(db, sale, options = {}) {
  const spec = await buildSaleJournalSpec(db, sale, { ...options, persist: true });
  if (!spec) return { success: true, created: false, skipped: true };
  return putJournalEntry(db, spec);
}

async function ensureJournalEntryForTransaction(db, transaction, options = {}) {
  const spec = await buildTransactionJournalSpec(db, transaction, { ...options, persist: true });
  if (!spec) return { success: true, created: false, skipped: true };
  return putJournalEntry(db, spec);
}

async function ensureJournalEntryForExpense(db, expense, options = {}) {
  const spec = await buildExpenseJournalSpec(db, expense, { ...options, persist: true });
  if (!spec) return { success: true, created: false, skipped: true };
  return putJournalEntry(db, spec);
}

async function ensureJournalEntryForInvoice(db, invoice, options = {}) {
  const spec = await buildInvoiceJournalSpec(db, invoice, { ...options, persist: true });
  if (!spec) return { success: true, created: false, skipped: true };
  return putJournalEntry(db, spec);
}

async function ensureJournalEntryForManualAdjustment(db, entry) {
  const spec = buildManualAdjustmentSpec(entry);
  if (!spec) return { success: true, created: false, skipped: true };
  return putJournalEntry(db, spec);
}

async function getJournalEntries(db, options = {}) {
  const { storeNo, fromDate, toDate, accountCode } = options;
  if (!storeNo) return [];
  const selector = {
    type: 'journal-entry',
    state: 'Active',
    storeNo,
  };
  if (fromDate || toDate) {
    const { from, to } = normalizeDateRange(fromDate, toDate);
    selector.date = { $gte: from.toISOString(), $lte: to.toISOString() };
  }

  const entries = await getActiveDocs(db, selector);
  const filtered = accountCode
    ? entries.filter((entry) => (entry.lines || []).some((line) => line.accountCode === accountCode))
    : entries;
  return filtered.sort((a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt));
}

function flattenLines(entries = []) {
  return entries.flatMap((entry) => (entry.lines || []).map((line) => ({
    ...line,
    journalEntryId: entry._id,
    sourceDocType: entry.sourceDocType,
    sourceDocId: entry.sourceDocId,
    description: line.description || entry.description,
    date: entry.date,
    entryKind: entry.entryKind,
  })));
}

function balanceByCode(entries = []) {
  const balances = {};
  for (const line of flattenLines(entries)) {
    const current = balances[line.accountCode] || {
      accountCode: line.accountCode,
      accountName: line.accountName,
      debit: 0,
      credit: 0,
      net: 0,
    };
    current.debit = roundMoney(current.debit + toNumber(line.debit));
    current.credit = roundMoney(current.credit + toNumber(line.credit));
    current.net = roundMoney(current.debit - current.credit);
    balances[line.accountCode] = current;
  }
  return balances;
}

function getCreditBalance(balances, code) {
  const row = balances[code] || {};
  return roundMoney(toNumber(row.credit) - toNumber(row.debit));
}

function getDebitBalance(balances, code) {
  const row = balances[code] || {};
  return roundMoney(toNumber(row.debit) - toNumber(row.credit));
}

function buildIncomeStatementFromEntries(entries = []) {
  const sales = { cashSales: 0, mpesaSales: 0, creditSales: 0, totalSales: 0 };
  const expensesByType = {};
  let cogs = 0;
  let operatingExpenses = 0;

  for (const line of flattenLines(entries)) {
    const netCredit = roundMoney(toNumber(line.credit) - toNumber(line.debit));
    const netDebit = roundMoney(toNumber(line.debit) - toNumber(line.credit));
    if (line.accountCode === CHART.SALES.code) {
      sales.totalSales = roundMoney(sales.totalSales + netCredit);
    }
    if (line.metadata?.role === 'payment') {
      const method = normalizePaymentMethod(line.metadata.paymentMethod);
      const amount = roundMoney(toNumber(line.debit) - toNumber(line.credit));
      if (method === 'MPESA') sales.mpesaSales = roundMoney(sales.mpesaSales + amount);
      else if (method === 'CREDIT') sales.creditSales = roundMoney(sales.creditSales + amount);
      else sales.cashSales = roundMoney(sales.cashSales + amount);
    }
    if (line.accountCode === CHART.COGS.code) {
      cogs = roundMoney(cogs + netDebit);
    }
    if (String(line.accountCode).startsWith('5') && line.accountCode !== CHART.COGS.code) {
      operatingExpenses = roundMoney(operatingExpenses + netDebit);
      const label = line.metadata?.expenseType || line.accountName || 'Expense';
      expensesByType[label] = roundMoney((expensesByType[label] || 0) + netDebit);
    }
  }

  const byType = Object.entries(expensesByType)
    .filter(([, amount]) => Math.abs(amount) > 0.001)
    .map(([expenseType, amount]) => ({ expenseType, amount: roundMoney(amount) }))
    .sort((a, b) => a.expenseType.localeCompare(b.expenseType));
  const grossProfit = roundMoney(sales.totalSales - cogs);
  const netProfit = roundMoney(grossProfit - operatingExpenses);

  return {
    sales,
    cogs: roundMoney(cogs),
    grossProfit,
    expenses: {
      byType,
      totalExpenses: roundMoney(operatingExpenses),
    },
    netProfit,
  };
}

async function incomeStatement(db, fromDate, toDate, storeNo) {
  if (!storeNo) return { success: false, error: 'storeNo is required' };
  const entries = await getJournalEntries(db, { storeNo, fromDate, toDate });
  return { success: true, data: buildIncomeStatementFromEntries(entries) };
}

async function getMonthlyProfitLoss(db, options = {}) {
  const { storeNo } = options;
  if (!storeNo) return { success: false, error: 'storeNo is required' };
  const now = new Date();
  const fromDate = options.fromDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const toDate = options.toDate || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
  const result = await incomeStatement(db, fromDate, toDate, storeNo);
  if (!result.success) return result;
  return {
    success: true,
    data: {
      period: {
        fromDate: parseDate(fromDate).toISOString(),
        toDate: parseDate(toDate).toISOString(),
      },
      ...result.data,
    },
  };
}

async function getBalanceSheet(db, toDateValue, storeNo) {
  if (!storeNo) return { success: false, error: 'storeNo is required' };
  const to = parseDate(toDateValue);
  const entries = await getJournalEntries(db, { storeNo, toDate: to.toISOString() });
  const balances = balanceByCode(entries);
  const income = buildIncomeStatementFromEntries(entries);

  const assets = {
    cashAndBankBalances: roundMoney(
      getDebitBalance(balances, CHART.CASH.code) +
      getDebitBalance(balances, CHART.MPESA.code) +
      Object.values(balances)
        .filter((row) => /^116\d$/.test(row.accountCode))
        .reduce((sum, row) => sum + toNumber(row.net), 0)
    ),
    accountsReceivable: getDebitBalance(balances, CHART.AR.code),
    inventory: getDebitBalance(balances, CHART.INVENTORY.code),
    prepaidExpenses: getDebitBalance(balances, CHART.PREPAID.code),
    otherCurrentAssets: getDebitBalance(balances, CHART.OTHER_CURRENT_ASSET.code),
    fixedAssets: roundMoney(
      getDebitBalance(balances, CHART.PPE.code) - getCreditBalance(balances, CHART.ACCUM_DEPRECIATION.code)
    ),
    totalCurrentAssets: 0,
    totalAssets: 0,
  };
  assets.totalCurrentAssets = roundMoney(
    assets.cashAndBankBalances + assets.accountsReceivable + assets.inventory +
    assets.prepaidExpenses + assets.otherCurrentAssets
  );
  assets.totalAssets = roundMoney(assets.totalCurrentAssets + assets.fixedAssets);

  const liabilities = {
    accountsPayable: getCreditBalance(balances, CHART.AP.code),
    shortTermLoans: getCreditBalance(balances, CHART.SHORT_TERM_LOANS.code),
    otherCurrentLiabilities: getCreditBalance(balances, CHART.OTHER_CURRENT_LIABILITY.code),
    longTermLoans: getCreditBalance(balances, CHART.LONG_TERM_LOANS.code),
    totalCurrentLiabilities: 0,
    totalLiabilities: 0,
  };
  liabilities.totalCurrentLiabilities = roundMoney(
    liabilities.accountsPayable + liabilities.shortTermLoans + liabilities.otherCurrentLiabilities
  );
  liabilities.totalLiabilities = roundMoney(liabilities.totalCurrentLiabilities + liabilities.longTermLoans);

  const equity = {
    ownerCapital: getCreditBalance(balances, CHART.OWNER_CAPITAL.code),
    retainedEarnings: roundMoney(
      getCreditBalance(balances, CHART.RETAINED_EARNINGS.code) +
      getCreditBalance(balances, CHART.OPENING_EQUITY.code) +
      income.netProfit
    ),
    totalEquity: 0,
  };
  equity.totalEquity = roundMoney(equity.ownerCapital + equity.retainedEarnings);

  return {
    success: true,
    data: { assets, liabilities, equity },
  };
}

async function getTrialBalance(db, fromDate, toDateValue, storeNo) {
  if (!storeNo) return { success: false, error: 'storeNo is required' };
  const entries = await getJournalEntries(db, { storeNo, fromDate, toDate: toDateValue });
  const rows = Object.values(balanceByCode(entries))
    .map((row) => {
      const net = roundMoney(row.debit - row.credit);
      return {
        code: row.accountCode,
        name: row.accountName,
        debit: net >= 0 ? net : 0,
        credit: net < 0 ? absMoney(net) : 0,
      };
    })
    .filter((row) => row.debit || row.credit)
    .sort((a, b) => a.code.localeCompare(b.code));

  return {
    success: true,
    data: {
      accounts: rows,
      totalDebits: roundMoney(rows.reduce((sum, row) => sum + row.debit, 0)),
      totalCredits: roundMoney(rows.reduce((sum, row) => sum + row.credit, 0)),
    },
  };
}

async function getChartOfAccounts(db, storeNo) {
  const accounts = storeNo ? await getAccounts(db, storeNo) : [];
  const accountMap = new Map();
  accounts
    .sort((a, b) => String(a.accountNumber || a.name || a._id).localeCompare(String(b.accountNumber || b.name || b._id)))
    .forEach((account, index) => accountMap.set(account._id, accountCodeFromDoc(account, index)));
  const expenseMap = storeNo ? await getExpenseTypeAccountMap(db, storeNo) : { mapByName: new Map() };
  const dynamicAccounts = Object.fromEntries([...accountMap.values()].map((account) => [
    account.code,
    { code: account.code, name: account.name },
  ]));
  const dynamicExpenses = Object.fromEntries([...expenseMap.mapByName.values()].map((account) => [
    account.code,
    { code: account.code, name: account.name },
  ]));

  return {
    success: true,
    data: {
      assets: {
        currentAssets: {
          code: '1100',
          accounts: {
            cash: CHART.CASH,
            mpesa: CHART.MPESA,
            ...dynamicAccounts,
            accountsReceivable: CHART.AR,
            inventory: CHART.INVENTORY,
            prepaidExpenses: CHART.PREPAID,
          },
        },
        fixedAssets: {
          code: '1200',
          accounts: {
            propertyEquipment: CHART.PPE,
            accumulatedDepreciation: CHART.ACCUM_DEPRECIATION,
          },
        },
      },
      liabilities: {
        currentLiabilities: {
          code: '2100',
          accounts: {
            accountsPayable: CHART.AP,
            shortTermLoans: CHART.SHORT_TERM_LOANS,
            otherCurrentLiabilities: CHART.OTHER_CURRENT_LIABILITY,
          },
        },
        longTermLiabilities: {
          code: '2200',
          accounts: { longTermLoans: CHART.LONG_TERM_LOANS },
        },
      },
      equity: {
        openingAndCapital: {
          code: '3000',
          accounts: {
            ownerCapital: CHART.OWNER_CAPITAL,
            retainedEarnings: CHART.RETAINED_EARNINGS,
            openingBalanceEquity: CHART.OPENING_EQUITY,
          },
        },
      },
      revenue: {
        operatingRevenue: {
          code: '4100',
          accounts: { sales: CHART.SALES },
        },
      },
      expenses: {
        operatingExpenses: {
          code: '5100',
          accounts: {
            costOfGoodsSold: CHART.COGS,
            ...dynamicExpenses,
            uncategorizedExpense: CHART.UNCATEGORIZED_EXPENSE,
            transactionFees: CHART.TRANSACTION_FEES,
          },
        },
      },
    },
  };
}

async function getGeneralLedger(db, options = {}) {
  const { storeNo, fromDate, toDate, accountCode } = options;
  if (!storeNo) return { success: false, error: 'storeNo is required' };
  const entries = await getJournalEntries(db, { storeNo, fromDate, toDate, accountCode });
  const rows = flattenLines(entries)
    .filter((line) => !accountCode || line.accountCode === accountCode)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  return { success: true, rows, data: rows };
}

async function getAccountStatement(db, fromDate, toDateValue, storeNo) {
  const result = await getGeneralLedger(db, { storeNo, fromDate, toDate: toDateValue });
  if (!result.success) return result;
  const totalAmount = roundMoney(result.rows.reduce((sum, row) => sum + toNumber(row.debit) - toNumber(row.credit), 0));
  return { success: true, transactions: result.rows, totalAmount };
}

async function existingJournalIds(db, storeNo) {
  const entries = await getJournalEntries(db, { storeNo });
  return new Set(entries.map((entry) => entry._id));
}

async function buildBackfillSpecs(db, storeNo, options = {}) {
  const warnings = [];
  const specs = [];
  const [
    sales,
    transactions,
    expenses,
    invoices,
    manualEntries,
  ] = await Promise.all([
    getActiveDocs(db, { type: 'sale', state: 'Active', storeNo }),
    getActiveDocs(db, { type: 'transaction', state: 'Active', storeNo }),
    getActiveDocs(db, { type: 'expense', state: 'Active', storeNo }),
    getActiveDocs(db, {
      type: 'invoice',
      state: 'Active',
      $or: [{ storeNo }, { store: storeNo }],
    }),
    getActiveDocs(db, {
      type: { $in: ['asset', 'liability', 'equity'] },
      state: 'Active',
      storeNo,
    }),
  ]);

  const addSpec = async (doc, builder, label) => {
    try {
      const spec = await builder(doc);
      if (spec) specs.push(spec);
    } catch (error) {
      warnings.push({
        sourceDocType: label,
        sourceDocId: doc?._id || null,
        message: error.message,
      });
    }
  };

  for (const sale of sales) await addSpec(sale, (doc) => buildSaleJournalSpec(db, doc, options), 'sale');
  for (const transaction of transactions) await addSpec(transaction, (doc) => buildTransactionJournalSpec(db, doc, options), 'transaction');
  for (const expense of expenses) await addSpec(expense, (doc) => buildExpenseJournalSpec(db, doc, options), 'expense');
  for (const invoice of invoices) await addSpec(invoice, (doc) => buildInvoiceJournalSpec(db, doc, options), 'invoice');
  for (const entry of manualEntries) await addSpec(entry, buildManualAdjustmentSpec, 'manual-adjustment');

  const existingEntries = await getJournalEntries(db, { storeNo });
  const existingIds = new Set(existingEntries.map((entry) => entry._id));
  const missingSpecs = specs.filter((spec) => !existingIds.has(journalEntryId(spec.storeNo, spec.sourceDocType, spec.sourceDocId, spec.entryKind)));
  const projectedEntries = [
    ...existingEntries,
    ...missingSpecs.map((spec) => createJournalDoc(spec)),
  ];
  const projectedBalances = balanceByCode(projectedEntries);
  const accountMap = await getAccountCodeMap(db, storeNo, options);
  const accounts = await getAccounts(db, storeNo);

  for (const accountDoc of accounts) {
    const account = accountMap.get(accountDoc._id) || accountCodeFromDoc(accountDoc);
    const projected = getDebitBalance(projectedBalances, account.code);
    const actual = roundMoney(accountDoc.balance);
    const diff = roundMoney(actual - projected);
    if (Math.abs(diff) > 0.01) {
      specs.push(buildOpeningAdjustmentSpec({
        storeNo,
        sourceDocId: `account:${accountDoc._id}`,
        description: `Opening balance adjustment for ${accountDoc.name || accountDoc._id}`,
        account,
        diff,
        entityType: 'account',
        entityId: accountDoc._id,
      }));
    }
  }

  const customers = await getActiveDocs(db, { type: 'customer', state: 'Active', storeNo });
  const actualReceivables = roundMoney(customers.reduce((sum, customer) => {
    const balance = toNumber(customer.balance);
    return balance < 0 ? sum + Math.abs(balance) : sum;
  }, 0));
  const projectedReceivables = getDebitBalance(projectedBalances, CHART.AR.code);
  const arDiff = roundMoney(actualReceivables - projectedReceivables);
  if (Math.abs(arDiff) > 0.01) {
    specs.push(buildOpeningAdjustmentSpec({
      storeNo,
      sourceDocId: 'control:accounts-receivable',
      description: 'Opening balance adjustment for accounts receivable control',
      account: CHART.AR,
      diff: arDiff,
      entityType: 'customer-control',
      entityId: storeNo,
    }));
  }

  const suppliers = await getActiveDocs(db, { type: 'supplier', state: 'Active', storeNo });
  const actualPayables = roundMoney(suppliers.reduce((sum, supplier) => {
    const balance = toNumber(supplier.balance);
    return balance > 0 ? sum + balance : sum;
  }, 0));
  if (actualPayables > 0) {
    const projectedPayables = getCreditBalance(projectedBalances, CHART.AP.code);
    const apDiff = roundMoney(actualPayables - projectedPayables);
    if (Math.abs(apDiff) > 0.01) {
      specs.push(buildOpeningAdjustmentSpec({
        storeNo,
        sourceDocId: 'control:accounts-payable',
        description: 'Opening balance adjustment for accounts payable control',
        account: CHART.AP,
        diff: -apDiff,
        entityType: 'supplier-control',
        entityId: storeNo,
      }));
    }
  }

  return { specs, warnings };
}

async function previewFinanceLedgerBackfill(db, input = {}) {
  const storeNo = typeof input === 'string' ? input : input.storeNo;
  if (!storeNo) return { success: false, error: 'storeNo is required' };
  const ids = await existingJournalIds(db, storeNo);
  const { specs, warnings } = await buildBackfillSpecs(db, storeNo, { persist: false });
  const missing = specs.filter((spec) => !ids.has(journalEntryId(spec.storeNo, spec.sourceDocType, spec.sourceDocId, spec.entryKind)));
  return {
    success: true,
    preview: {
      storeNo,
      totalSourceEntries: specs.length,
      existingJournalEntries: specs.length - missing.length,
      missingJournalEntries: missing.length,
      warnings,
      missingByType: missing.reduce((acc, spec) => {
        acc[spec.sourceDocType] = (acc[spec.sourceDocType] || 0) + 1;
        return acc;
      }, {}),
    },
  };
}

async function runFinanceLedgerBackfill(db, input = {}) {
  const storeNo = typeof input === 'string' ? input : input.storeNo;
  if (!storeNo) return { success: false, error: 'storeNo is required' };
  await getAccountCodeMap(db, storeNo, { persist: true });
  await getExpenseTypeAccountMap(db, storeNo, { persist: true });
  const { specs, warnings } = await buildBackfillSpecs(db, storeNo, { persist: true });
  let created = 0;
  let skipped = 0;

  for (const spec of specs) {
    const result = await putJournalEntry(db, spec);
    if (result.created) created += 1;
    else skipped += 1;
  }

  return {
    success: true,
    result: {
      storeNo,
      createdJournalEntries: created,
      skippedExistingJournalEntries: skipped,
      warnings,
    },
  };
}

async function getFinanceLedgerHealth(db, input = {}) {
  const storeNo = typeof input === 'string' ? input : input.storeNo;
  if (!storeNo) return { success: false, error: 'storeNo is required' };
  const preview = await previewFinanceLedgerBackfill(db, { storeNo });
  const entries = await getJournalEntries(db, { storeNo });
  const unbalanced = entries.filter((entry) => Math.abs(toNumber(entry.totalDebits) - toNumber(entry.totalCredits)) > 0.01);
  const trial = await getTrialBalance(db, null, new Date().toISOString(), storeNo);
  const trialDifference = trial.success ? roundMoney(trial.data.totalDebits - trial.data.totalCredits) : 0;

  return {
    success: true,
    health: {
      storeNo,
      journalEntries: entries.length,
      unbalancedJournalEntries: unbalanced.length,
      trialDifference,
      missingJournalEntries: preview.preview?.missingJournalEntries || 0,
      warnings: preview.preview?.warnings || [],
      isHealthy: unbalanced.length === 0 && Math.abs(trialDifference) <= 0.01 && (preview.preview?.missingJournalEntries || 0) === 0,
    },
  };
}

module.exports = {
  CHART,
  buildExpenseJournalSpec,
  buildInvoiceJournalSpec,
  buildSaleJournalSpec,
  buildTransactionJournalSpec,
  ensureJournalEntryForExpense,
  ensureJournalEntryForInvoice,
  ensureJournalEntryForManualAdjustment,
  ensureJournalEntryForSale,
  ensureJournalEntryForSalePayment,
  ensureJournalEntryForTransaction,
  getAccountStatement,
  getBalanceSheet,
  getChartOfAccounts,
  getFinanceLedgerHealth,
  getGeneralLedger,
  getJournalEntries,
  getMonthlyProfitLoss,
  getTrialBalance,
  incomeStatement,
  previewFinanceLedgerBackfill,
  putJournalEntry,
  runFinanceLedgerBackfill,
};
