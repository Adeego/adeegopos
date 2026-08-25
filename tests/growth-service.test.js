const test = require('node:test');
const assert = require('node:assert/strict');

const growthService = require('../electron/services/growthService');

function createDb(docs) {
  return {
    find() {
      return Promise.resolve({ docs });
    },
  };
}

function sale(overrides = {}) {
  return {
    _id: overrides._id || 'S1:sale:1',
    type: 'sale',
    state: 'Active',
    storeNo: 'S1',
    status: overrides.status || 'posted',
    saleType: overrides.saleType || 'NEW SALE',
    reconciliationCaseType: overrides.reconciliationCaseType || null,
    totalAmount: overrides.totalAmount ?? 100,
    createdAt: overrides.createdAt || '2026-05-16T10:00:00.000Z',
    items: overrides.items || [{
      _id: `${overrides._id || 'S1:sale:1'}:line:1`,
      productId: 'S1:product:tea',
      name: 'Tea',
      quantity: 1,
      buyPrice: 60,
      subtotal: overrides.totalAmount ?? 100,
    }],
  };
}

test('weekly gross margin excludes voids and reverses return costs', async () => {
  const db = createDb([
    sale({ _id: 'S1:sale:good', totalAmount: 100 }),
    sale({
      _id: 'S1:sale:voided',
      status: 'voided',
      totalAmount: 500,
      items: [{ quantity: 1, buyPrice: 450, subtotal: 500 }],
    }),
    sale({
      _id: 'S1:sale:void-return',
      saleType: 'RETURN SALE',
      reconciliationCaseType: 'sale_void',
      totalAmount: -500,
      items: [{ quantity: 1, buyPrice: 450, subtotal: -500 }],
    }),
    sale({
      _id: 'S1:sale:exchange-return',
      saleType: 'RETURN SALE',
      reconciliationCaseType: 'item_exchange',
      totalAmount: -40,
      items: [{ quantity: 1, buyPrice: 20, subtotal: -40 }],
    }),
  ]);

  const result = await growthService.getWeeklyGrossMargin(
    db,
    'S1',
    '2026-05-16',
    '2026-05-22'
  );

  assert.equal(result.success, true);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].week, '2026-W20');
  assert.equal(result.data[0].totalRevenue, 60);
  assert.equal(result.data[0].totalCost, 40);
  assert.equal(result.data[0].grossMargin, 20);
  assert.equal(Math.round(result.data[0].marginPercentage * 100) / 100, 33.33);
});
