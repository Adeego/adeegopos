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

const cashier = { _id: 'S1:staff:cashier', firstName: 'Asha', lastName: 'Cashier', role: 'admin', storeNo: 'S1' };
const otherCashier = { _id: 'S1:staff:other', firstName: 'Other', lastName: 'Cashier', role: 'admin', storeNo: 'S1' };
const manager = { _id: 'S1:staff:manager', firstName: 'Musa', lastName: 'Manager', role: 'admin', storeNo: 'S1' };

function dbName(name) { return path.join(os.tmpdir(), `adeego-register-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`); }
async function createDb(name) {
  const db = new PouchDB(dbName(name));
  await db.bulkDocs([
    { _id: 'S1:cash', type: 'account', state: 'Active', storeNo: 'S1', name: 'Cash Drawer', accountNumber: 'S1001', accountType: 'Cashier', balance: 75 },
    { _id: 'S1:mpesa', type: 'account', state: 'Active', storeNo: 'S1', name: 'M-Pesa Till', accountNumber: 'S1002', accountType: 'Cashier', balance: 10 },
    { _id: 'S1:bank', type: 'account', state: 'Active', storeNo: 'S1', name: 'Bank', accountNumber: 'S1003', accountType: 'Admin', balance: 0 },
    { _id: 'S1:customer:1', type: 'customer', state: 'Active', storeNo: 'S1', name: 'Credit Customer', balance: 0, credit: true },
    { _id: 'S1:expenseType:ops', type: 'expenseType', state: 'Active', storeNo: 'S1', name: 'Operations' },
    { _id: 'S1:product:tea', type: 'product', state: 'Active', storeNo: 'S1', name: 'Tea', stock: 100, restockThreshold: 0, batches: [{ batchId: 'b1', quantity: 100 }] },
  ]);
  return db;
}
function salePayload(overrides = {}) {
  const amount = overrides.amount ?? 50;
  return {
    _id: overrides._id || `S1:sale:${Math.random().toString(16).slice(2)}`, storeNo: 'S1',
    customerId: overrides.customerId || null, currentCustomerId: overrides.customerId || null,
    items: [{ _id: `${overrides._id || 'sale'}:line`, productId: 'S1:product:tea', name: 'Tea', buyPrice: 20, unitPrice: amount, quantity: 1, subtotal: amount, conversionFactor: 1 }],
    totalAmount: amount, totalItems: 1, paymentMethod: overrides.paymentMethod || 'Cash Drawer',
    paymentBreakdown: overrides.paymentBreakdown || [{ method: overrides.paymentMethod || 'Cash Drawer', accountId: overrides.accountId || 'S1:cash', amount }],
    saleType: overrides.saleType || 'NEW SALE', paid: overrides.paid ?? false,
    state: 'Active', status: 'posted', createdAt: overrides.createdAt || new Date().toISOString(),
  };
}

test('every sale and register-account movement requires an open shift', async () => {
  const db = await createDb('guards');
  try {
    assert.equal((await registerSessionService.getRegisterSession(db, 'S1')).activeSession, null);
    assert.match((await saleService.createSale(db, salePayload(), null, cashier)).error, /Open register first/);
    const credit = salePayload({ paymentMethod: 'CREDIT', customerId: 'S1:customer:1', paymentBreakdown: [{ method: 'CREDIT', amount: 50 }] });
    assert.match((await saleService.createSale(db, credit, null, cashier)).error, /Open register first/);
    const tx = await transactionService.createTransaction(db, { _id: 'S1:tx:no-shift', storeNo: 'S1', source: 'account', destination: 'account', from: 'S1:cash', to: 'S1:bank', transType: 'withdraw', amount: 1 });
    assert.match(tx.error, /Open register first/);
    await db.put({ _id: 'S2:cash', type: 'account', state: 'Active', storeNo: 'S2', name: 'Cash Drawer', accountNumber: 'S2001', accountType: 'Cashier', balance: 100 });
    const crossStore = await transactionService.createTransaction(db, { _id: 'S1:tx:cross-store', storeNo: 'S1', source: 'account', destination: 'account', from: 'S2:cash', to: 'S1:bank', transType: 'withdraw', amount: 1 }, cashier);
    assert.match(crossStore.error, /does not belong to your store/i);
  } finally { await db.destroy(); }
});

test('current shift remains discoverable when legacy sessions are still marked open', async () => {
  const db = await createDb('legacy-open-sessions');
  try {
    await db.bulkDocs(Array.from({ length: 6 }, (_, index) => ({
      _id: `S1:register-session:legacy-${index}`,
      type: 'register-session',
      state: 'Active',
      storeNo: 'S1',
      status: 'open',
      businessDate: `2026-0${index + 1}-01`,
    })));

    const opened = await registerSessionService.openRegisterSession(
      db,
      { storeNo: 'S1', openingBalances: { cash: 75, mpesa: 10 } },
      cashier
    );
    assert.equal(opened.success, true, opened.error);

    const status = await registerSessionService.getRegisterSession(db, 'S1', null, cashier);
    assert.equal(status.success, true, status.error);
    assert.equal(status.activeSession?._id, opened.activeSession._id);
    assert.equal(status.activeSession?.openedBy?.id, cashier._id);
  } finally { await db.destroy(); }
});

test('paid-only shift movements, hybrid legs, exception approval and carry-forward are enforced', async () => {
  const db = await createDb('lifecycle');
  try {
    const opened = await registerSessionService.openRegisterSession(db, { storeNo: 'S1', openingBalances: { cash: 100, mpesa: 20 } }, cashier);
    assert.equal(opened.success, true, opened.error);
    const sessionId = opened.activeSession._id;
    const cashierView = await registerSessionService.getRegisterSession(db, 'S1', null, cashier);
    assert.equal(cashierView.activeSession.expectedBalances, null);
    assert.equal(cashierView.activeSession.movements, null);
    assert.equal(cashierView.activeSession.linkedAccounts.cash.balance, null);
    assert.equal(cashierView.activeSession.linkedAccounts.mpesa.balance, null);
    assert.equal((await db.get('S1:cash')).balance, 100);
    assert.match((await saleService.createSale(db, salePayload({ _id: 'S1:sale:wrong' }), null, otherCashier)).error, /another cashier/i);

    const unpaid = await saleService.createSale(db, salePayload({ _id: 'S1:sale:unpaid' }), null, cashier);
    assert.equal(unpaid.success, true, unpaid.error);
    assert.equal((await db.get('S1:cash')).balance, 100);
    let status = await registerSessionService.getRegisterSession(db, 'S1');
    assert.equal(status.activeSession.expectedBalances.cash, 100);
    assert.deepEqual(status.activeSession.unpaidDeclarations.map((entry) => entry.saleId), ['S1:sale:unpaid']);
    assert.equal((await saleService.updateSalePaidStatus(db, { saleId: unpaid.sale._id, paidStatus: true }, cashier)).success, true);

    const hybrid = await saleService.createSale(db, salePayload({
      _id: 'S1:sale:hybrid', amount: 60, paymentMethod: 'HYBRID', paid: true, customerId: 'S1:customer:1',
      paymentBreakdown: [{ method: 'Cash Drawer', accountId: 'S1:cash', amount: 20 }, { method: 'M-Pesa Till', accountId: 'S1:mpesa', amount: 30 }, { method: 'CREDIT', amount: 10 }],
    }), null, cashier);
    assert.equal(hybrid.success, true, hybrid.error);
    const hybridPaid = await saleService.updateSalePaidStatus(db, { saleId: hybrid.sale._id, paidStatus: true, mpesaReference: 'HYBRID123' }, cashier);
    assert.equal(hybridPaid.success, true, hybridPaid.error);
    await expenseService.createExpense(db, { _id: 'S1:expense:cash', storeNo: 'S1', description: 'Ops', amount: 10, account: 'Cash Drawer', accountId: 'S1:cash', expenseType: 'Operations', expenseTypeId: 'S1:expenseType:ops' });
    await transactionService.createTransaction(db, { _id: 'S1:tx:mpesa-bank', storeNo: 'S1', description: 'Till transfer', source: 'account', destination: 'account', from: 'S1:mpesa', to: 'S1:bank', transType: 'withdraw', amount: 5, transactionCost: 1 });
    await saleService.createSale(db, salePayload({ _id: 'S1:sale:declared', amount: 25 }), null, cashier);
    status = await registerSessionService.getRegisterSession(db, 'S1');
    assert.equal(status.activeSession.expectedBalances.cash, 160);
    assert.equal(status.activeSession.expectedBalances.mpesa, 44);

    const declaration = [{ saleId: 'S1:sale:declared', reason: 'Customer left before payment confirmation' }];
    assert.match((await registerSessionService.closeRegisterSession(db, { storeNo: 'S1', sessionId, countedBalances: { cash: 158, mpesa: 44 } }, cashier, manager)).error, /declaration reason/i);
    assert.equal((await registerSessionService.closeRegisterSession(db, { storeNo: 'S1', sessionId, countedBalances: { cash: 158, mpesa: 44 }, unpaidDeclarations: declaration }, cashier)).approvalRequired, true);
    const closed = await registerSessionService.closeRegisterSession(db, { storeNo: 'S1', sessionId, countedBalances: { cash: 158, mpesa: 44 }, unpaidDeclarations: declaration }, cashier, manager);
    assert.equal(closed.success, true, closed.error);
    assert.equal(closed.closedSession.transfer, null);
    assert.equal((await db.get('S1:cash')).balance, 158);
    const next = await registerSessionService.openRegisterSession(db, { storeNo: 'S1', openingBalances: { cash: 999, mpesa: 999 } }, cashier);
    assert.equal(next.activeSession.openingBalances.cash, 158);
    assert.equal(next.activeSession.openingBalances.mpesa, 44);
  } finally { await db.destroy(); }
});

test('emergency takeover changes the assigned cashier and keeps an audit trail', async () => {
  const db = await createDb('takeover');
  try {
    const opened = await registerSessionService.openRegisterSession(db, { storeNo: 'S1', openingBalances: { cash: 75, mpesa: 10 } }, cashier);
    const result = await registerSessionService.takeOverRegisterSession(db, {
      storeNo: 'S1', sessionId: opened.activeSession._id, reason: 'Original cashier became unavailable',
    }, manager);
    assert.equal(result.success, true, result.error);
    assert.equal(result.activeSession.openedBy.id, manager._id);
    assert.equal(result.activeSession.originalOpenedBy.id, cashier._id);
    assert.equal(result.activeSession.takeoverHistory.length, 1);
    assert.equal(result.activeSession.expectedBalances, null);
    assert.match((await saleService.createSale(db, salePayload({ _id: 'S1:sale:former-owner' }), null, cashier)).error, /another cashier/i);
    assert.equal((await saleService.createSale(db, salePayload({ _id: 'S1:sale:new-owner' }), null, manager)).success, true);
  } finally { await db.destroy(); }
});

test('late M-Pesa payment belongs to the receiving shift and receipt references are unique', async () => {
  const db = await createDb('late-payment');
  try {
    const first = await registerSessionService.openRegisterSession(db, { storeNo: 'S1', openingBalances: { cash: 100, mpesa: 20 } }, cashier);
    const lateSale = await saleService.createSale(db, salePayload({ _id: 'S1:sale:late', amount: 40, paymentMethod: 'M-Pesa Till', accountId: 'S1:mpesa' }), null, cashier);
    const closed = await registerSessionService.closeRegisterSession(db, { storeNo: 'S1', sessionId: first.activeSession._id, countedBalances: { cash: 100, mpesa: 20 }, unpaidDeclarations: [{ saleId: lateSale.sale._id, reason: 'M-Pesa confirmation pending' }] }, cashier, manager);
    assert.equal(closed.success, true, closed.error);
    const second = await registerSessionService.openRegisterSession(db, { storeNo: 'S1' }, cashier);
    const paid = await saleService.updateSalePaidStatus(db, { saleId: lateSale.sale._id, paidStatus: true, mpesaReference: 'QWE123XYZ' }, cashier);
    assert.equal(paid.success, true, paid.error);
    assert.equal(paid.sale.paidRegisterSessionId, second.activeSession._id);
    const another = await saleService.createSale(db, salePayload({ _id: 'S1:sale:another', amount: 10, paymentMethod: 'M-Pesa Till', accountId: 'S1:mpesa' }), null, cashier);
    const duplicate = await saleService.updateSalePaidStatus(db, { saleId: another.sale._id, paidStatus: true, mpesaReference: 'qwe123xyz' }, cashier);
    assert.match(duplicate.error, /already been used/i);
    assert.equal((await registerSessionService.getRegisterSession(db, 'S1')).activeSession.expectedBalances.mpesa, 60);
  } finally { await db.destroy(); }
});
