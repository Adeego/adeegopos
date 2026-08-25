const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-find'));

const customerService = require('../electron/services/customerService');

test('customer detail queries only the selected customer and preserves reassigned sales', async () => {
  const db = new PouchDB(path.join(
    os.tmpdir(),
    `adeego-customer-activity-${Date.now()}-${Math.random().toString(16).slice(2)}`
  ));
  const customerA = 'S1:customer:a';
  const customerB = 'S1:customer:b';
  const createdAt = '2026-08-20T10:00:00.000Z';

  try {
    await db.bulkDocs([
      { _id: customerA, type: 'customer', state: 'Active', storeNo: 'S1', balance: -50 },
      { _id: customerB, type: 'customer', state: 'Active', storeNo: 'S1', balance: 0 },
      { _id: 'S1:sale:legacy-a', type: 'sale', state: 'Active', status: 'posted', storeNo: 'S1', customerId: customerA, createdAt, totalAmount: 50, paymentMethod: 'CREDIT', paymentBreakdown: [{ method: 'CREDIT', amount: 50 }], items: [] },
      { _id: 'S1:sale:moved-to-b', type: 'sale', state: 'Active', status: 'posted', storeNo: 'S1', customerId: customerA, currentCustomerId: customerB, createdAt, totalAmount: 75, paymentMethod: 'CREDIT', paymentBreakdown: [{ method: 'CREDIT', amount: 75 }], items: [] },
      { _id: 'S1:transaction:from-a', type: 'transaction', state: 'Active', status: 'posted', storeNo: 'S1', from: customerA, to: 'S1:account:cash', createdAt, date: createdAt, amount: 20, transType: 'deposit', source: 'customer', destination: 'account' },
      { _id: 'S1:transaction:to-a', type: 'transaction', state: 'Active', status: 'posted', storeNo: 'S1', from: 'S1:account:cash', to: customerA, createdAt, date: createdAt, amount: 5, transType: 'withdraw', source: 'account', destination: 'customer' },
    ]);

    const from = '2026-08-01T00:00:00.000Z';
    const to = '2026-08-31T23:59:59.999Z';
    const salesA = await customerService.getCustomerSales(db, customerA, from, to, 'S1');
    const salesB = await customerService.getCustomerSales(db, customerB, from, to, 'S1');
    const ledgerA = await customerService.getCustomerLedger(db, customerA, from, to, 'S1');

    assert.equal(salesA.success, true, salesA.error);
    assert.deepEqual(salesA.sales.map((sale) => sale._id), ['S1:sale:legacy-a']);
    assert.equal(salesB.success, true, salesB.error);
    assert.deepEqual(salesB.sales.map((sale) => sale._id), ['S1:sale:moved-to-b']);
    assert.equal(ledgerA.success, true, ledgerA.error);
    assert.deepEqual(
      new Set(ledgerA.ledger.map((row) => row.sourceDocId)),
      new Set(['S1:sale:legacy-a', 'S1:transaction:from-a', 'S1:transaction:to-a'])
    );
  } finally {
    await db.destroy();
  }
});
