const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-find'));

const saleService = require('../electron/services/saleService');
const expenseService = require('../electron/services/finance/expenseService');
const transactionService = require('../electron/services/finance/transactionService');
const registerSessionService = require('../electron/services/registerSessionService');

function dbName(name) {
  return path.join(os.tmpdir(), `adeego-register-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
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
      balance: 100,
    },
    {
      _id: 'S1:mpesa',
      type: 'account',
      state: 'Active',
      storeNo: 'S1',
      name: 'M-Pesa Till',
      accountNumber: 'S1002',
      accountType: 'Cashier',
      balance: 20,
    },
    {
      _id: 'S1:bank',
      type: 'account',
      state: 'Active',
      storeNo: 'S1',
      name: 'Bank',
      accountNumber: 'S1003',
      accountType: 'Bank',
      balance: 0,
    },
    {
      _id: 'S1:admin:cash',
      type: 'account',
      state: 'Active',
      storeNo: 'S1',
      name: 'Admin Cash',
      accountNumber: 'S1901',
      accountType: 'Admin',
      balance: 0,
    },
    {
      _id: 'S1:admin:mpesa',
      type: 'account',
      state: 'Active',
      storeNo: 'S1',
      name: 'Admin M-Pesa',
      accountNumber: 'S1902',
      accountType: 'Admin',
      balance: 0,
    },
    {
      _id: 'S1:customer:1',
      type: 'customer',
      state: 'Active',
      storeNo: 'S1',
      name: 'Credit Customer',
      balance: 0,
      credit: true,
    },
    {
      _id: 'S1:expenseType:ops',
      type: 'expenseType',
      state: 'Active',
      storeNo: 'S1',
      name: 'Operations',
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
    },
  ]);
  return db;
}

function salePayload(overrides = {}) {
  const amount = overrides.amount ?? 50;
  return {
    _id: overrides._id || `S1:sale:${Math.random().toString(16).slice(2)}`,
    storeNo: 'S1',
    customerId: overrides.customerId || null,
    currentCustomerId: overrides.currentCustomerId || overrides.customerId || null,
    items: [{
      _id: `${overrides._id || 'S1:sale'}:line:1`,
      productId: 'S1:product:tea',
      name: 'Tea',
      buyPrice: 20,
      unitPrice: amount,
      quantity: 1,
      subtotal: amount,
      conversionFactor: 1,
    }],
    totalAmount: amount,
    totalItems: 1,
    paymentMethod: overrides.paymentMethod || 'CASH',
    paymentBreakdown: overrides.paymentBreakdown,
    saleType: overrides.saleType || 'NEW SALE',
    paid: overrides.paid ?? true,
    state: 'Active',
    status: 'posted',
    createdAt: overrides.createdAt || '2026-05-25T10:00:00.000Z',
  };
}

test('register status does not auto-create a session and blocks cashier movements until opened', async () => {
  const db = await createDb('guards');
  try {
    const status = await registerSessionService.getRegisterSession(db, 'S1');
    assert.equal(status.success, true, status.error);
    assert.equal(status.activeSession, null);
    assert.equal(status.openingDefaults.cash, 100);
    assert.equal(status.openingDefaults.mpesa, 20);

    const sessions = await db.find({ selector: { type: 'register-session' }, limit: 10 });
    assert.equal(sessions.docs.length, 0);

    const blockedSale = await saleService.createSale(db, salePayload({ _id: 'S1:sale:blocked-cash' }), null);
    assert.equal(blockedSale.success, false);
    assert.match(blockedSale.error, /Open register first/);

    const blockedExpense = await expenseService.createExpense(db, {
      _id: 'S1:expense:blocked',
      storeNo: 'S1',
      description: 'Cash expense',
      amount: 10,
      account: 'Cash Drawer',
      accountId: 'S1:cash',
      expenseType: 'Operations',
      expenseTypeId: 'S1:expenseType:ops',
      date: '2026-05-25T10:05:00.000Z',
    });
    assert.equal(blockedExpense.success, false);
    assert.match(blockedExpense.error, /Open register first/);

    const blockedTransaction = await transactionService.createTransaction(db, {
      _id: 'S1:transaction:blocked',
      storeNo: 'S1',
      description: 'Cash to bank',
      transType: 'withdraw',
      source: 'account',
      destination: 'account',
      from: 'S1:cash',
      to: 'S1:bank',
      amount: 5,
      transactionCost: 0,
      date: '2026-05-25T10:10:00.000Z',
    });
    assert.equal(blockedTransaction.success, false);
    assert.match(blockedTransaction.error, /Open register first/);

    const creditSale = await saleService.createSale(db, salePayload({
      _id: 'S1:sale:credit',
      amount: 25,
      customerId: 'S1:customer:1',
      paymentMethod: 'CREDIT',
      paymentBreakdown: [{ method: 'CREDIT', amount: 25 }],
    }), null);
    assert.equal(creditSale.success, true, creditSale.error);
    assert.equal(creditSale.sale.registerSessionId, null);
  } finally {
    await db.destroy();
  }
});

test('open session tags movements, closes immutable snapshot, and carries opening defaults forward', async () => {
  const db = await createDb('lifecycle');
  try {
    const opened = await registerSessionService.openRegisterSession(db, {
      storeNo: 'S1',
      openingBalances: { cash: 100, mpesa: 20 },
    }, { _id: 'staff:1', firstName: 'Asha', lastName: 'Cashier', role: 'cashier' });
    assert.equal(opened.success, true, opened.error);
    const sessionId = opened.activeSession._id;

    const duplicate = await registerSessionService.openRegisterSession(db, {
      storeNo: 'S1',
      openingBalances: { cash: 100, mpesa: 20 },
    });
    assert.equal(duplicate.success, false);
    assert.match(duplicate.error, /already open/);

    const cashSale = await saleService.createSale(db, salePayload({
      _id: 'S1:sale:cash',
      amount: 50,
      paymentMethod: 'CASH',
    }), null);
    assert.equal(cashSale.success, true, cashSale.error);
    assert.equal(cashSale.sale.registerSessionId, sessionId);

    const mpesaSale = await saleService.createSale(db, salePayload({
      _id: 'S1:sale:mpesa',
      amount: 40,
      paymentMethod: 'MPESA',
      paymentBreakdown: [{ method: 'MPESA', accountId: 'S1:mpesa', amount: 40 }],
    }), null);
    assert.equal(mpesaSale.success, true, mpesaSale.error);
    assert.equal(mpesaSale.sale.registerSessionId, sessionId);

    const expense = await expenseService.createExpense(db, {
      _id: 'S1:expense:cash',
      storeNo: 'S1',
      description: 'Cash expense',
      amount: 10,
      transactionCost: 2,
      account: 'Cash Drawer',
      accountId: 'S1:cash',
      expenseType: 'Operations',
      expenseTypeId: 'S1:expenseType:ops',
      date: '2026-05-25T10:30:00.000Z',
    });
    assert.equal(expense.success, true, expense.error);
    assert.equal(expense.expense.registerSessionId, sessionId);

    const transfer = await transactionService.createTransaction(db, {
      _id: 'S1:transaction:cash-bank',
      storeNo: 'S1',
      description: 'Cash to bank',
      transType: 'withdraw',
      source: 'account',
      destination: 'account',
      from: 'S1:cash',
      to: 'S1:bank',
      amount: 5,
      transactionCost: 1,
      date: '2026-05-25T10:40:00.000Z',
    });
    assert.equal(transfer.success, true, transfer.error);
    assert.equal(transfer.transaction.registerSessionId, sessionId);

    const liveStatus = await registerSessionService.getRegisterSession(db, 'S1');
    assert.equal(liveStatus.success, true, liveStatus.error);
    assert.equal(liveStatus.activeSession.expectedBalances.cash, 132);
    assert.equal(liveStatus.activeSession.expectedBalances.mpesa, 60);
    assert.deepEqual(
      liveStatus.activeSession.availableTransferAccounts.map((account) => account._id).sort(),
      ['S1:admin:cash', 'S1:admin:mpesa'],
    );

    const closed = await registerSessionService.closeRegisterSession(db, {
      storeNo: 'S1',
      sessionId,
      countedBalances: { cash: 132, mpesa: 60 },
      transfer: {
        cash: {
          destinationAccountId: 'S1:admin:cash',
          amount: 100,
          transactionCost: 0,
          description: 'Deposit drawer cash',
        },
        mpesa: {
          destinationAccountId: 'S1:admin:mpesa',
          amount: 50,
          transactionCost: 2,
          description: 'Sweep till balance',
        },
      },
    }, { _id: 'staff:1', firstName: 'Asha', lastName: 'Cashier', role: 'cashier' });
    assert.equal(closed.success, true, closed.error);
    assert.equal(closed.session.status, 'closed');
    assert.equal(closed.session.expectedBalances.cash, 132);
    assert.equal(closed.session.closeSummary.remainingDrawerCash, 32);
    assert.equal(closed.session.closeSummary.remainingMpesa, 8);
    assert.equal(closed.session.transfer.cash.destinationAccountId, 'S1:admin:cash');
    assert.equal(closed.session.transfer.mpesa.destinationAccountId, 'S1:admin:mpesa');

    const cashCloseTransfer = await db.get(`${sessionId}:close-transfer:cash`);
    assert.equal(cashCloseTransfer.from, 'S1:cash');
    assert.equal(cashCloseTransfer.to, 'S1:admin:cash');
    assert.equal(cashCloseTransfer.metadata.registerSessionId, sessionId);
    assert.equal(cashCloseTransfer.metadata.registerCloseSource, 'cash');

    const mpesaCloseTransfer = await db.get(`${sessionId}:close-transfer:mpesa`);
    assert.equal(mpesaCloseTransfer.from, 'S1:mpesa');
    assert.equal(mpesaCloseTransfer.to, 'S1:admin:mpesa');
    assert.equal(mpesaCloseTransfer.transactionCost, 2);
    assert.equal(mpesaCloseTransfer.metadata.registerSessionId, sessionId);
    assert.equal(mpesaCloseTransfer.metadata.registerCloseSource, 'mpesa');

    const afterClose = await registerSessionService.getRegisterSession(db, 'S1');
    assert.equal(afterClose.activeSession, null);
    assert.equal(afterClose.previousClosedSession._id, sessionId);
    assert.equal(afterClose.openingDefaults.cash, 32);
    assert.equal(afterClose.openingDefaults.mpesa, 8);

    const nextOpened = await registerSessionService.openRegisterSession(db, { storeNo: 'S1' });
    assert.equal(nextOpened.success, true, nextOpened.error);
    assert.equal(nextOpened.activeSession.openingBalances.cash, 32);
    assert.equal(nextOpened.activeSession.openingBalances.mpesa, 8);
  } finally {
    await db.destroy();
  }
});

test('register close transfers require Admin destinations and enforce each source balance', async () => {
  const db = await createDb('close-transfer-validation');
  try {
    const opened = await registerSessionService.openRegisterSession(db, {
      storeNo: 'S1',
      openingBalances: { cash: 100, mpesa: 20 },
    });
    assert.equal(opened.success, true, opened.error);
    const sessionId = opened.activeSession._id;

    const nonAdminDestination = await registerSessionService.closeRegisterSession(db, {
      storeNo: 'S1',
      sessionId,
      countedBalances: { cash: 100, mpesa: 20 },
      transfer: {
        cash: {
          destinationAccountId: 'S1:bank',
          amount: 10,
          transactionCost: 0,
        },
      },
    });
    assert.equal(nonAdminDestination.success, false);
    assert.match(nonAdminDestination.error, /Admin account/);

    const cashOverLimit = await registerSessionService.closeRegisterSession(db, {
      storeNo: 'S1',
      sessionId,
      countedBalances: { cash: 100, mpesa: 20 },
      transfer: {
        cash: {
          destinationAccountId: 'S1:admin:cash',
          amount: 99,
          transactionCost: 2,
        },
      },
    });
    assert.equal(cashOverLimit.success, false);
    assert.match(cashOverLimit.error, /counted cash closing balance/);

    const mpesaOverLimit = await registerSessionService.closeRegisterSession(db, {
      storeNo: 'S1',
      sessionId,
      countedBalances: { cash: 100, mpesa: 20 },
      transfer: {
        mpesa: {
          destinationAccountId: 'S1:admin:mpesa',
          amount: 20,
          transactionCost: 1,
        },
      },
    });
    assert.equal(mpesaOverLimit.success, false);
    assert.match(mpesaOverLimit.error, /counted m-pesa closing balance/i);

    const stillOpen = await registerSessionService.getRegisterSession(db, 'S1');
    assert.equal(stillOpen.activeSession._id, sessionId);
  } finally {
    await db.destroy();
  }
});

test('active register includes untagged cashier sales created after the session opened', async () => {
  const db = await createDb('untagged-sale-fallback');
  try {
    const opened = await registerSessionService.openRegisterSession(db, {
      storeNo: 'S1',
      openingBalances: { cash: 100, mpesa: 20 },
    });
    assert.equal(opened.success, true, opened.error);

    const openedAt = new Date(opened.activeSession.openedAt).getTime();
    await db.bulkDocs([
      {
        ...salePayload({
          _id: 'S1:sale:untagged-before-open',
          amount: 25,
          paymentMethod: 'Cash Drawer',
          paymentBreakdown: [{ method: 'Cash Drawer', accountId: 'S1:cash', amount: 25 }],
          createdAt: new Date(openedAt - 1000).toISOString(),
        }),
        type: 'sale',
        registerSessionId: null,
      },
      {
        ...salePayload({
          _id: 'S1:sale:untagged-after-open',
          amount: 30,
          paymentMethod: 'Cash Drawer',
          paymentBreakdown: [{ method: 'Cash Drawer', accountId: 'S1:cash', amount: 30 }],
          createdAt: new Date(openedAt + 1000).toISOString(),
        }),
        type: 'sale',
        registerSessionId: null,
      },
      {
        ...salePayload({
          _id: 'S1:sale:untagged-mpesa-after-open',
          amount: 15,
          paymentMethod: 'M-Pesa Till',
          paymentBreakdown: [{ method: 'M-Pesa Till', accountId: 'S1:mpesa', amount: 15 }],
          createdAt: new Date(openedAt + 2000).toISOString(),
        }),
        type: 'sale',
        registerSessionId: null,
      },
    ]);

    const status = await registerSessionService.getRegisterSession(db, 'S1');
    assert.equal(status.success, true, status.error);
    assert.equal(status.activeSession.expectedBalances.cash, 130);
    assert.equal(status.activeSession.expectedBalances.mpesa, 35);
  } finally {
    await db.destroy();
  }
});

test('register links M-Pesa cashier accounts by name when account number is not store suffix 002', async () => {
  const db = await createDb('mpesa-name-link');
  try {
    const mpesaAccount = await db.get('S1:mpesa');
    await db.put({
      ...mpesaAccount,
      accountNumber: '247247',
    });

    const status = await registerSessionService.getRegisterSession(db, 'S1');
    assert.equal(status.success, true, status.error);
    assert.equal(status.openingDefaults.mpesa, 20);

    const opened = await registerSessionService.openRegisterSession(db, {
      storeNo: 'S1',
      openingBalances: { cash: 100, mpesa: 20 },
    });
    assert.equal(opened.success, true, opened.error);
    assert.equal(opened.activeSession.linkedAccounts.mpesa._id, 'S1:mpesa');
    assert.equal(opened.activeSession.linkedAccountIds.mpesa, 'S1:mpesa');

    const mpesaSale = await saleService.createSale(db, salePayload({
      _id: 'S1:sale:mpesa-real-number',
      amount: 35,
      paymentMethod: 'M-Pesa Till',
      paymentBreakdown: [{ method: 'M-Pesa Till', accountId: 'S1:mpesa', amount: 35 }],
    }), null);
    assert.equal(mpesaSale.success, true, mpesaSale.error);

    const liveStatus = await registerSessionService.getRegisterSession(db, 'S1');
    assert.equal(liveStatus.activeSession.linkedAccounts.mpesa._id, 'S1:mpesa');
    assert.equal(liveStatus.activeSession.expectedBalances.mpesa, 55);
  } finally {
    await db.destroy();
  }
});

test('legacy daily open sessions remain readable but do not block explicit sessions', async () => {
  const db = await createDb('legacy');
  try {
    await db.put({
      _id: 'S1:register-session:2026-05-25',
      type: 'register-session',
      state: 'Active',
      storeNo: 'S1',
      businessDate: '2026-05-25',
      status: 'open',
      openingBalances: { cash: 100, mpesa: 20, total: 120 },
      expectedBalances: { cash: 100, mpesa: 20, total: 120 },
      countedBalances: { cash: 0, mpesa: 0, total: 0 },
      variances: { cash: -100, mpesa: -20, total: -120 },
      createdAt: '2026-05-25T00:00:00.000Z',
      updatedAt: '2026-05-25T00:00:00.000Z',
    });

    const status = await registerSessionService.getRegisterSession(db, 'S1', '2026-05-25');
    assert.equal(status.success, true, status.error);
    assert.equal(status.activeSession, null);
    assert.equal(status.session._id, 'S1:register-session:2026-05-25');

    const opened = await registerSessionService.openRegisterSession(db, {
      storeNo: 'S1',
      openingBalances: { cash: 100, mpesa: 20 },
    });
    assert.equal(opened.success, true, opened.error);
    assert.notEqual(opened.activeSession._id, 'S1:register-session:2026-05-25');
  } finally {
    await db.destroy();
  }
});
