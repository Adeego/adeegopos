const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-find'));

const saleService = require('../electron/services/saleService');
const supplierService = require('../electron/services/supplierService');
const transactionService = require('../electron/services/finance/transactionService');
const expenseService = require('../electron/services/finance/expenseService');
const journalService = require('../electron/services/finance/journalService');
const registerSessionService = require('../electron/services/registerSessionService');
const financeRecorder = require('../electron/services/aiAssistant/financeRecorder');

function dbName(name) {
  return path.join(os.tmpdir(), `adeego-finance-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

async function createDb(name) {
  const db = new PouchDB(dbName(name));
  await db.bulkDocs([
    {
      _id: 'S1:cash',
      type: 'account',
      state: 'Active',
      storeNo: 'S1',
      name: 'Cash Drawer',
      accountNumber: 'S1001',
      accountType: 'Cashier',
      balance: 1000,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      _id: 'S1:mpesa',
      type: 'account',
      state: 'Active',
      storeNo: 'S1',
      name: 'M-Pesa Till',
      accountNumber: 'S1002',
      accountType: 'Cashier',
      balance: 1000,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      _id: 'S2:cash',
      type: 'account',
      state: 'Active',
      storeNo: 'S2',
      name: 'Cash Drawer',
      accountNumber: 'S2001',
      accountType: 'Cashier',
      balance: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      _id: 'S1:customer:1',
      type: 'customer',
      state: 'Active',
      storeNo: 'S1',
      name: 'Credit Customer',
      balance: 0,
      credit: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      _id: 'S1:supplier:1',
      type: 'supplier',
      state: 'Active',
      storeNo: 'S1',
      name: 'Main Supplier',
      balance: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      _id: 'S1:expenseType:rent',
      type: 'expenseType',
      state: 'Active',
      storeNo: 'S1',
      name: 'Rent',
      description: 'Rent',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      _id: 'S1:product:tea',
      type: 'product',
      state: 'Active',
      storeNo: 'S1',
      name: 'Tea',
      stock: 100,
      restockThreshold: 0,
      batches: [{ batchId: 'b1', quantity: 100 }],
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      _id: 'S2:product:tea',
      type: 'product',
      state: 'Active',
      storeNo: 'S2',
      name: 'Tea',
      stock: 100,
      restockThreshold: 0,
      batches: [{ batchId: 'b1', quantity: 100 }],
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ]);
  return db;
}

function salePayload(overrides = {}) {
  return {
    _id: overrides._id || 'S1:sale:cash',
    type: 'sale',
    storeNo: overrides.storeNo || 'S1',
    customerId: overrides.customerId || null,
    currentCustomerId: overrides.currentCustomerId || overrides.customerId || null,
    items: [{
      _id: `${overrides._id || 'S1:sale:cash'}:line:1`,
      productId: overrides.productId || `${overrides.storeNo || 'S1'}:product:tea`,
      name: 'Tea',
      buyPrice: 40,
      unitPrice: 100,
      quantity: 1,
      subtotal: 100,
      conversionFactor: 1,
    }],
    totalAmount: 100,
    totalItems: 1,
    paymentMethod: overrides.paymentMethod || 'CASH',
    paymentBreakdown: overrides.paymentBreakdown,
    saleType: overrides.saleType || 'NEW SALE',
    paid: overrides.paid || false,
    state: 'Active',
    status: 'posted',
    createdAt: overrides.createdAt || '2026-02-01T10:00:00.000Z',
  };
}

test('journal-backed reports handle sales, expenses, invoices, transfers, and store isolation', async () => {
  const db = await createDb('core');
  try {
    const register = await registerSessionService.openRegisterSession(db, {
      storeNo: 'S1',
      openingBalances: { cash: 1000, mpesa: 1000 },
    }, { firstName: 'Test', lastName: 'Cashier', role: 'cashier' });
    assert.equal(register.success, true, register.error);

    const cashSale = await saleService.createSale(db, salePayload(), null);
    assert.equal(cashSale.success, true, cashSale.error);
    assert.ok(cashSale.journalEntry);

    const creditSale = await saleService.createSale(db, salePayload({
      _id: 'S1:sale:credit',
      customerId: 'S1:customer:1',
      paymentMethod: 'CREDIT',
      paymentBreakdown: [{ method: 'CREDIT', amount: 100 }],
      createdAt: '2026-02-02T10:00:00.000Z',
    }), null);
    assert.equal(creditSale.success, true, creditSale.error);

    const expense = await expenseService.createExpense(db, {
      _id: 'S1:expense:rent',
      storeNo: 'S1',
      description: 'Rent',
      amount: 10,
      transactionCost: 1,
      account: 'Cash Drawer',
      accountId: 'S1:cash',
      expenseType: 'Rent',
      expenseTypeId: 'S1:expenseType:rent',
      date: '2026-02-03T10:00:00.000Z',
    });
    assert.equal(expense.success, true, expense.error);

    const invoice = await supplierService.createInvoice(db, {
      _id: 'S1:invoice:1',
      storeNo: 'S1',
      supplierId: 'S1:supplier:1',
      totalAmount: 250,
      items: [{ productId: 'S1:product:tea', quantity: 5, buyPrice: 50, subtotal: 250 }],
      createdAt: '2026-02-04T10:00:00.000Z',
    });
    assert.equal(invoice.success, true, invoice.error);

    const supplierPayment = await transactionService.createTransaction(db, {
      _id: 'S1:transaction:supplier-payment',
      storeNo: 'S1',
      description: 'Supplier payment',
      transType: 'withdraw',
      source: 'account',
      destination: 'supplier',
      from: 'S1:cash',
      to: 'S1:supplier:1',
      amount: 50,
      transactionCost: 5,
      date: '2026-02-05T10:00:00.000Z',
    });
    assert.equal(supplierPayment.success, true, supplierPayment.error);

    const s2Register = await registerSessionService.openRegisterSession(db, {
      storeNo: 'S2',
      openingBalances: { cash: 0, mpesa: 0 },
    }, { firstName: 'Test', lastName: 'Cashier', role: 'cashier' });
    assert.equal(s2Register.success, true, s2Register.error);

    const s2Sale = await saleService.createSale(db, salePayload({
      _id: 'S2:sale:cash',
      storeNo: 'S2',
      createdAt: '2026-02-01T10:00:00.000Z',
    }), null);
    assert.equal(s2Sale.success, true, s2Sale.error);

    const income = await journalService.incomeStatement(db, '2026-02-01', '2026-02-28', 'S1');
    assert.equal(income.success, true);
    assert.equal(income.data.sales.totalSales, 200);
    assert.equal(income.data.sales.cashSales, 100);
    assert.equal(income.data.sales.creditSales, 100);
    assert.equal(income.data.cogs, 80);
    assert.equal(income.data.expenses.totalExpenses, 16);
    assert.equal(income.data.netProfit, 104);

    const s2Income = await journalService.incomeStatement(db, '2026-02-01', '2026-02-28', 'S2');
    assert.equal(s2Income.data.sales.totalSales, 100);

    const trial = await journalService.getTrialBalance(db, '2026-02-01', '2026-02-28', 'S1');
    assert.equal(trial.success, true);
    assert.equal(trial.data.totalDebits, trial.data.totalCredits);

    const balanceSheet = await journalService.getBalanceSheet(db, '2026-02-28', 'S1');
    assert.equal(balanceSheet.success, true);
    assert.equal(balanceSheet.data.assets.accountsReceivable, 100);
    assert.equal(balanceSheet.data.liabilities.accountsPayable, 200);
    assert.equal(balanceSheet.data.assets.inventory, 170);

    const cash = await db.get('S1:cash');
    assert.equal(cash.balance, 1034);
  } finally {
    await db.destroy();
  }
});

test('ai finance recorder drafts, commits, and flags duplicate records', async () => {
  const db = await createDb('ai-recorder');
  try {
    const register = await registerSessionService.openRegisterSession(db, {
      storeNo: 'S1',
      openingBalances: { cash: 1000, mpesa: 1000 },
    }, { firstName: 'AI', lastName: 'Recorder', role: 'cashier' });
    assert.equal(register.success, true, register.error);

    const customerDraft = await financeRecorder.draftFinanceRecord(db, {
      recordType: 'customer_payment',
      customerName: 'Credit Customer',
      accountName: 'Cash Drawer',
      amount: 75,
      description: 'Customer paid account',
      date: '2026-02-10T09:00:00.000Z',
    }, 'S1');
    assert.equal(customerDraft.success, true, customerDraft.error);
    assert.equal(customerDraft.confirmationRequired, true);

    const beforeCommit = await transactionService.getAllTransactions(db, 'S1');
    assert.equal(beforeCommit.transactions.length, 0);

    const customerCommit = await financeRecorder.commitFinanceRecord(db, {
      confirmationToken: customerDraft.confirmationToken,
    }, 'S1');
    assert.equal(customerCommit.success, true, customerCommit.error);
    assert.equal(customerCommit.recordType, 'customer_payment');

    const duplicateDraft = await financeRecorder.draftFinanceRecord(db, {
      recordType: 'customer_payment',
      customerName: 'Credit Customer',
      accountName: 'Cash Drawer',
      amount: 75,
      description: 'Customer paid account',
      date: '2026-02-10T12:00:00.000Z',
    }, 'S1');
    assert.equal(duplicateDraft.success, true, duplicateDraft.error);
    assert.equal(duplicateDraft.duplicateMatches.length, 1);

    const expenseDraft = await financeRecorder.draftFinanceRecord(db, {
      recordType: 'expense',
      expenseTypeName: 'Rent',
      accountName: 'Cash Drawer',
      amount: 10,
      description: 'Office rent',
      date: '2026-02-10T10:00:00.000Z',
    }, 'S1');
    assert.equal(expenseDraft.success, true, expenseDraft.error);

    const expenseCommit = await financeRecorder.commitFinanceRecord(db, {
      confirmationToken: expenseDraft.confirmationToken,
    }, 'S1');
    assert.equal(expenseCommit.success, true, expenseCommit.error);
    assert.equal(expenseCommit.recordType, 'expense');

    const invoiceDraft = await financeRecorder.draftFinanceRecord(db, {
      recordType: 'supplier_invoice',
      supplierName: 'Main Supplier',
      amount: 250,
      description: 'Tea restock invoice',
      date: '2026-02-11T10:00:00.000Z',
    }, 'S1');
    assert.equal(invoiceDraft.success, true, invoiceDraft.error);

    const invoiceCommit = await financeRecorder.commitFinanceRecord(db, {
      confirmationToken: invoiceDraft.confirmationToken,
    }, 'S1');
    assert.equal(invoiceCommit.success, true, invoiceCommit.error);
    assert.equal(invoiceCommit.recordType, 'supplier_invoice');
    assert.equal(invoiceCommit.invoices.length, 1);
  } finally {
    await db.destroy();
  }
});

test('sale creation succeeds when post-write journal creation fails', async () => {
  const db = await createDb('sale-journal-warning');
  try {
    const result = await saleService.createSale(db, {
      _id: 'S1:sale:journal-warning',
      storeNo: 'S1',
      customerId: null,
      currentCustomerId: null,
      items: [{
        _id: 'S1:sale:journal-warning:line:1',
        productId: 'S1:product:tea',
        name: 'Zero Sale Tea',
        buyPrice: 0,
        unitPrice: 0,
        quantity: 0,
        subtotal: 0,
        conversionFactor: 1,
      }],
      totalAmount: 0,
      totalItems: 1,
      paymentMethod: 'CASH',
      paymentBreakdown: [],
      saleType: 'NEW SALE',
      paid: true,
      state: 'Active',
      status: 'posted',
      createdAt: '2026-02-06T10:00:00.000Z',
    }, null);

    assert.equal(result.success, true, result.error);
    assert.equal(result.sale._id, 'S1:sale:journal-warning');
    assert.match(result.journalError, /must have at least two lines/);
    assert.ok(result.warnings.length >= 1);

    const persistedSale = await db.get('S1:sale:journal-warning');
    assert.equal(persistedSale._id, 'S1:sale:journal-warning');
  } finally {
    await db.destroy();
  }
});

test('sale creation deducts stock for legacy products without batches', async () => {
  const db = await createDb('legacy-stock-batches');
  try {
    const register = await registerSessionService.openRegisterSession(db, {
      storeNo: 'S1',
      openingBalances: { cash: 1000, mpesa: 1000 },
    }, { firstName: 'Test', lastName: 'Cashier', role: 'cashier' });
    assert.equal(register.success, true, register.error);

    const product = await db.get('S1:product:tea');
    await db.put({
      ...product,
      stock: 10,
      batches: [],
    });

    const result = await saleService.createSale(db, salePayload({
      _id: 'S1:sale:legacy-stock',
      createdAt: '2026-02-07T10:00:00.000Z',
    }), null);

    assert.equal(result.success, true, result.error);

    const updatedProduct = await db.get('S1:product:tea');
    assert.equal(updatedProduct.stock, 9);
    assert.equal(updatedProduct.batches.length, 1);
    assert.equal(updatedProduct.batches[0].quantity, 9);
    assert.equal(updatedProduct.batches[0].source, 'legacy-stock-balance');

    const movements = await db.find({
      selector: {
        type: 'stock-movement',
        sourceDocId: 'S1:sale:legacy-stock',
      },
      limit: 10,
    });
    assert.equal(movements.docs.length, 1);
    assert.equal(movements.docs[0].quantityDelta, -1);
  } finally {
    await db.destroy();
  }
});

test('sale creation rolls back stock and deactivates sale when stock movement recording fails', async () => {
  const db = await createDb('sale-stock-rollback');
  const originalPut = db.put.bind(db);

  try {
    const register = await registerSessionService.openRegisterSession(db, {
      storeNo: 'S1',
      openingBalances: { cash: 1000, mpesa: 1000 },
    }, { firstName: 'Test', lastName: 'Cashier', role: 'cashier' });
    assert.equal(register.success, true, register.error);

    db.put = async (doc, ...args) => {
      if (doc.type === 'stock-movement') {
        throw new Error('simulated stock movement write failure');
      }
      return originalPut(doc, ...args);
    };

    const result = await saleService.createSale(db, salePayload({
      _id: 'S1:sale:movement-failure',
      createdAt: '2026-02-08T10:00:00.000Z',
    }), null);

    assert.equal(result.success, false);
    assert.match(result.error, /simulated stock movement write failure/);

    const updatedProduct = await db.get('S1:product:tea');
    assert.equal(updatedProduct.stock, 100);
    assert.equal(updatedProduct.batches[0].quantity, 100);

    const failedSale = await db.get('S1:sale:movement-failure');
    assert.equal(failedSale.state, 'Inactive');
    assert.equal(failedSale.status, 'failed');

    const postedHistory = await saleService.getAllSalesBetweenDates(
      db,
      'S1',
      '2026-02-08T00:00:00.000Z',
      '2026-02-08T23:59:59.999Z'
    );
    assert.equal(postedHistory.success, true);
    assert.equal(postedHistory.data.length, 0);

    const failedHistory = await saleService.getFailedSalesBetweenDates(
      db,
      'S1',
      '2026-02-08T00:00:00.000Z',
      '2026-02-08T23:59:59.999Z'
    );
    assert.equal(failedHistory.success, true);
    assert.equal(failedHistory.data.length, 1);
    assert.equal(failedHistory.data[0]._id, 'S1:sale:movement-failure');
    assert.match(failedHistory.data[0].postingError, /simulated stock movement write failure/);
  } finally {
    db.put = originalPut;
    await db.destroy();
  }
});

test('expense update and archive create accounting-safe reversal entries', async () => {
  const db = await createDb('expense');
  try {
    const register = await registerSessionService.openRegisterSession(db, {
      storeNo: 'S1',
      openingBalances: { cash: 1000, mpesa: 1000 },
    }, { firstName: 'Test', lastName: 'Cashier', role: 'cashier' });
    assert.equal(register.success, true, register.error);

    const created = await expenseService.createExpense(db, {
      _id: 'S1:expense:editable',
      storeNo: 'S1',
      description: 'Rent',
      amount: 20,
      account: 'Cash Drawer',
      accountId: 'S1:cash',
      expenseType: 'Rent',
      expenseTypeId: 'S1:expenseType:rent',
      date: '2026-03-01T10:00:00.000Z',
    });
    assert.equal(created.success, true, created.error);

    const updated = await expenseService.updateExpense(db, {
      _id: 'S1:expense:editable',
      description: 'Rent corrected',
      amount: 30,
      transactionCost: 0,
      account: 'Cash Drawer',
      accountId: 'S1:cash',
      expenseType: 'Rent',
      expenseTypeId: 'S1:expenseType:rent',
      date: '2026-03-02T10:00:00.000Z',
      storeNo: 'S1',
    });
    assert.equal(updated.success, true, updated.error);
    assert.notEqual(updated.expense._id, 'S1:expense:editable');

    const archived = await expenseService.archiveExpense(db, updated.expense._id);
    assert.equal(archived.success, true, archived.error);

    const income = await journalService.incomeStatement(db, '2026-03-01', '2026-12-31', 'S1');
    assert.equal(income.data.expenses.totalExpenses, 0);
  } finally {
    await db.destroy();
  }
});

test('ledger backfill is idempotent for legacy source records', async () => {
  const db = await createDb('backfill');
  try {
    await db.put(salePayload({
      _id: 'S1:sale:legacy',
      createdAt: '2026-04-01T10:00:00.000Z',
    }));

    const preview = await journalService.previewFinanceLedgerBackfill(db, { storeNo: 'S1' });
    assert.equal(preview.success, true);
    assert.equal(preview.preview.missingByType.sale, 1);
    assert.ok(preview.preview.missingJournalEntries >= 1);

    const firstRun = await journalService.runFinanceLedgerBackfill(db, { storeNo: 'S1' });
    assert.equal(firstRun.success, true);
    assert.equal(firstRun.result.createdJournalEntries, preview.preview.missingJournalEntries);

    const secondRun = await journalService.runFinanceLedgerBackfill(db, { storeNo: 'S1' });
    assert.equal(secondRun.success, true);
    assert.equal(secondRun.result.createdJournalEntries, 0);
    assert.ok(secondRun.result.skippedExistingJournalEntries >= 1);
  } finally {
    await db.destroy();
  }
});
