const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-find'));

const saleService = require('../electron/services/saleService');
const transactionService = require('../electron/services/finance/transactionService');

test('pending sales are divided into current and previous calendar months', async () => {
  const db = new PouchDB(path.join(
    os.tmpdir(),
    `adeego-pending-sales-${Date.now()}-${Math.random().toString(16).slice(2)}`
  ));

  try {
    await db.bulkDocs([
      { _id: 'S1:sale:september-pending', type: 'sale', state: 'Active', status: 'posted', storeNo: 'S1', paid: false, totalAmount: 100, items: [], createdAt: '2026-09-05T12:00:00.000Z' },
      { _id: 'S1:sale:august-pending', type: 'sale', state: 'Active', status: 'posted', storeNo: 'S1', paid: false, totalAmount: 200, items: [], createdAt: '2026-08-20T12:00:00.000Z' },
      { _id: 'S1:sale:july-pending', type: 'sale', state: 'Active', status: 'posted', storeNo: 'S1', paid: false, totalAmount: 300, items: [], createdAt: '2026-07-31T12:00:00.000Z' },
      { _id: 'S1:sale:august-paid', type: 'sale', state: 'Active', status: 'posted', storeNo: 'S1', paid: true, totalAmount: 400, items: [], createdAt: '2026-08-10T12:00:00.000Z' },
    ]);

    const result = await saleService.getPendingSalesByMonth(db, 'S1', '2026-09-11T12:00:00.000Z');

    assert.equal(result.success, true, result.error);
    assert.deepEqual(result.data.currentMonth.map((sale) => sale._id), ['S1:sale:september-pending']);
    assert.deepEqual(result.data.lastMonth.map((sale) => sale._id), ['S1:sale:august-pending']);
  } finally {
    await db.destroy();
  }
});

test('shift sales only returns sales assigned to the requested register session', async () => {
  const db = new PouchDB(path.join(
    os.tmpdir(),
    `adeego-shift-sales-${Date.now()}-${Math.random().toString(16).slice(2)}`
  ));

  try {
    await db.bulkDocs([
      { _id: 'S1:sale:first-shift', type: 'sale', state: 'Active', status: 'posted', storeNo: 'S1', registerSessionId: 'S1:shift:1', totalAmount: 100, items: [], createdAt: '2026-09-10T23:55:00.000Z' },
      { _id: 'S1:sale:second-shift', type: 'sale', state: 'Active', status: 'posted', storeNo: 'S1', registerSessionId: 'S1:shift:2', totalAmount: 200, items: [], createdAt: '2026-09-11T00:05:00.000Z' },
      { _id: 'S1:sale:inactive', type: 'sale', state: 'Inactive', status: 'failed', storeNo: 'S1', registerSessionId: 'S1:shift:1', totalAmount: 300, items: [], createdAt: '2026-09-11T00:10:00.000Z' },
      { _id: 'S2:sale:other-store', type: 'sale', state: 'Active', status: 'posted', storeNo: 'S2', registerSessionId: 'S1:shift:1', totalAmount: 400, items: [], createdAt: '2026-09-11T00:15:00.000Z' },
    ]);

    const result = await saleService.getShiftSales(db, 'S1', 'S1:shift:1');

    assert.equal(result.success, true, result.error);
    assert.deepEqual(result.data.map((sale) => sale._id), ['S1:sale:first-shift']);
  } finally {
    await db.destroy();
  }
});

test('sales history returns matching receipts after a store exceeds 9,999 active sales', async () => {
  const db = new PouchDB(path.join(
    os.tmpdir(),
    `adeego-sales-history-${Date.now()}-${Math.random().toString(16).slice(2)}`
  ));
  const targetId = 'S1:f0c79748-1532-4416-83c9-8f1ef593aa71';

  try {
    const sales = Array.from({ length: 10020 }, (_, index) => ({
      _id: index === 10000 ? targetId : `S1:sale:${String(index).padStart(5, '0')}`,
      type: 'sale',
      state: 'Active',
      status: 'posted',
      storeNo: 'S1',
      totalAmount: index === 10000 ? 1980 : index + 1,
      items: [],
      createdAt: new Date(Date.UTC(2026, 7, 4, 0, 0, index)).toISOString(),
    }));

    for (let offset = 0; offset < sales.length; offset += 1000) {
      await db.bulkDocs(sales.slice(offset, offset + 1000));
    }

    const result = await saleService.getAllSalesBetweenDates(
      db,
      'S1',
      '2026-08-04T00:00:00.000Z',
      '2026-08-04T23:59:59.999Z'
    );

    assert.equal(result.success, true, result.error);
    assert.equal(result.data.length, sales.length);
    assert.ok(result.data.some((sale) => sale._id === targetId));
    assert.equal(result.data.find((sale) => sale._id === targetId).totalAmount, 1980);
    assert.ok(new Date(result.data[0].createdAt) >= new Date(result.data.at(-1).createdAt));
  } finally {
    await db.destroy();
  }
});

test('transaction history returns records beyond the previous 9,999 result cap', async () => {
  const db = new PouchDB(path.join(
    os.tmpdir(),
    `adeego-transaction-history-${Date.now()}-${Math.random().toString(16).slice(2)}`
  ));
  const targetId = 'S1:transaction:beyond-old-limit';

  try {
    const transactions = Array.from({ length: 10020 }, (_, index) => ({
      _id: index === 10000 ? targetId : `S1:transaction:${String(index).padStart(5, '0')}`,
      type: 'transaction',
      state: 'Active',
      status: 'posted',
      storeNo: 'S1',
      amount: index + 1,
      createdAt: new Date(Date.UTC(2026, 7, 4, 0, 0, index)).toISOString(),
    }));

    for (let offset = 0; offset < transactions.length; offset += 1000) {
      await db.bulkDocs(transactions.slice(offset, offset + 1000));
    }

    const result = await transactionService.getAllTransactions(db, 'S1');

    assert.equal(result.success, true, result.error);
    assert.equal(result.transactions.length, transactions.length);
    assert.ok(result.transactions.some((transaction) => transaction._id === targetId));
    assert.equal(result.transactions.find((transaction) => transaction._id === targetId).amount, 10001);
    assert.ok(new Date(result.transactions[0].createdAt) >= new Date(result.transactions.at(-1).createdAt));
  } finally {
    await db.destroy();
  }
});
