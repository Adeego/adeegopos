const test = require('node:test');
const assert = require('node:assert/strict');

const stockAudit = require('../electron/services/stockAuditService');
const { renderAuditSheet } = require('../electron/services/printerService');
const { applyStockDeltaToProduct } = require('../electron/services/postingService');

const clone = (value) => JSON.parse(JSON.stringify(value));

class MemoryDb {
  constructor(docs = []) {
    this.docs = new Map();
    docs.forEach((doc) => this.seed(doc));
  }

  seed(doc) {
    this.docs.set(doc._id, clone({ ...doc, _rev: doc._rev || '1-seed' }));
  }

  async get(id) {
    if (!this.docs.has(id)) {
      const error = new Error('missing');
      error.status = 404;
      error.name = 'not_found';
      throw error;
    }
    return clone(this.docs.get(id));
  }

  async put(doc) {
    if (this.failStockMovement && doc.type === 'stock-movement') throw new Error('simulated movement failure');
    const current = this.docs.get(doc._id);
    if (current && doc._rev !== current._rev) {
      const error = new Error('conflict');
      error.status = 409;
      throw error;
    }
    const generation = current ? Number(current._rev.split('-')[0]) + 1 : 1;
    const rev = `${generation}-memory`;
    this.docs.set(doc._id, clone({ ...doc, _rev: rev }));
    return { ok: true, id: doc._id, rev };
  }

  async find({ selector = {}, limit = 9999, skip = 0 }) {
    const docs = [...this.docs.values()].filter((doc) => Object.entries(selector).every(([key, value]) => doc[key] === value));
    return { docs: clone(docs.slice(skip, skip + limit)) };
  }
}

const operator = { _id: 'S1:staff:operator', firstName: 'Opal', lastName: 'Counter', storeNo: 'S1', role: 'Stock Manager' };
const manager = { _id: 'S1:staff:manager', firstName: 'Manny', lastName: 'Manager', storeNo: 'S1', role: 'Manager' };
const localDate = (year, month, day, hour = 12) => new Date(year, month - 1, day, hour, 0, 0, 0);

function product(overrides = {}) {
  return {
    _id: 'S1:product:milk', type: 'product', state: 'Active', storeNo: 'S1', name: 'Milk',
    stock: 20, buyPrice: 50, restockThreshold: 5,
    batches: [{ batchId: 'batch-1', quantity: 20, expiryDate: '2026-12-01' }],
    ...overrides,
  };
}

function sale(id, date, saleType, quantity, conversionFactor = 1, overrides = {}) {
  return {
    _id: id, type: 'sale', state: 'Active', status: 'posted', storeNo: 'S1', saleType,
    createdAt: date.toISOString(),
    items: [{ _id: `${id}:line`, productId: 'S1:product:milk', name: 'Milk', quantity, conversionFactor, subtotal: 100 }],
    ...overrides,
  };
}

test('daily audit aggregates net base units from yesterday and resumes deterministically', async () => {
  const now = localDate(2026, 9, 8, 9);
  const db = new MemoryDb([
    product(),
    sale('sale-1', localDate(2026, 9, 7, 10), 'NEW SALE', 2, 6),
    sale('sale-2', localDate(2026, 9, 7, 18), 'NEW SALE', 3),
    sale('return-1', localDate(2026, 9, 7, 20), 'RETURN SALE', 1),
    sale('damaged-return', localDate(2026, 9, 7, 20), 'RETURN SALE', 4, 1, { items: [{ _id: 'damaged-line', productId: 'S1:product:milk', quantity: 4, conversionFactor: 1, condition: 'damaged' }] }),
    sale('failed', localDate(2026, 9, 7, 15), 'NEW SALE', 99, 1, { state: 'Inactive', status: 'failed' }),
    sale('today', localDate(2026, 9, 8, 8), 'NEW SALE', 99),
  ]);

  const first = await stockAudit.createAudit(db, 'S1', operator, now);
  assert.equal(first.success, true);
  assert.equal(first.audit._id, 'S1:stock-audit:2026-09-07');
  assert.equal(first.audit.items.length, 1);
  assert.equal(first.audit.items[0].netSoldQuantity, 14);
  assert.equal(first.audit.items[0].systemStock, 20);

  const second = await stockAudit.createAudit(db, 'S1', operator, now);
  assert.equal(second.success, true);
  assert.equal(second.resumed, true);
  assert.equal(second.audit._id, first.audit._id);
});

test('no-sales day creates an empty auditable record', async () => {
  const db = new MemoryDb([product()]);
  const result = await stockAudit.createAudit(db, 'S1', operator, localDate(2026, 9, 8, 9));
  assert.equal(result.success, true);
  assert.deepEqual(result.audit.items, []);
});

test('submission records only discrepancies and does not change stock', async () => {
  const now = localDate(2026, 9, 8, 9);
  const db = new MemoryDb([product(), sale('sale-1', localDate(2026, 9, 7, 10), 'NEW SALE', 1)]);
  const created = await stockAudit.createAudit(db, 'S1', operator, now);

  const missingNotes = await stockAudit.submitAudit(db, created.audit._id, {
    discrepancies: [{ productId: 'S1:product:milk', physicalCount: 18 }],
  }, operator);
  assert.equal(missingNotes.success, false);
  assert.match(missingNotes.error, /reason and resolution/i);

  const submitted = await stockAudit.submitAudit(db, created.audit._id, {
    discrepancies: [{ productId: 'S1:product:milk', physicalCount: 18, reason: 'Two damaged', resolution: 'Removed damaged units' }],
  }, operator);
  assert.equal(submitted.success, true);
  assert.equal(submitted.audit.status, 'pending_approval');
  assert.equal(submitted.audit.items[0].variance, 2);
  assert.equal(submitted.audit.items[0].adjustmentDelta, -2);
  assert.equal((await db.get('S1:product:milk')).stock, 20);
});

test('approval requires a separate reviewer and applies delta to current stock', async () => {
  const now = localDate(2026, 9, 8, 9);
  const db = new MemoryDb([product(), sale('sale-1', localDate(2026, 9, 7, 10), 'NEW SALE', 1)]);
  const created = await stockAudit.createAudit(db, 'S1', operator, now);
  await stockAudit.submitAudit(db, created.audit._id, {
    discrepancies: [{ productId: 'S1:product:milk', physicalCount: 18, reason: 'Damage', resolution: 'Written off' }],
  }, operator);

  const selfApproval = await stockAudit.approveAudit(db, created.audit._id, operator);
  assert.equal(selfApproval.success, false);
  assert.match(selfApproval.error, /different Inventory Manager/i);

  const afterRestock = await db.get('S1:product:milk');
  afterRestock.stock = 25;
  afterRestock.batches[0].quantity = 25;
  await db.put(afterRestock);

  const approved = await stockAudit.approveAudit(db, created.audit._id, manager);
  assert.equal(approved.success, true);
  assert.equal(approved.audit.status, 'completed');
  assert.equal((await db.get('S1:product:milk')).stock, 23);
  assert.ok(approved.audit.items[0].stockMovementId);

  const repeated = await stockAudit.approveAudit(db, created.audit._id, manager);
  assert.equal(repeated.success, true);
  assert.equal(repeated.alreadyCompleted, true);
  assert.equal((await db.get('S1:product:milk')).stock, 23);
});

test('submission rebases the count against live stock after sales made since printing', async () => {
  const now = localDate(2026, 9, 8, 9);
  const db = new MemoryDb([product(), sale('sale-1', localDate(2026, 9, 7, 10), 'NEW SALE', 1)]);
  const created = await stockAudit.createAudit(db, 'S1', operator, now);
  const current = await db.get('S1:product:milk');
  current.stock = 15;
  current.batches[0].quantity = 15;
  await db.put(current);

  const submitted = await stockAudit.submitAudit(db, created.audit._id, {
    discrepancies: [{ productId: 'S1:product:milk', physicalCount: 15, reason: 'Printed sheet was stale', resolution: 'Compared with live stock' }],
  }, operator);
  assert.equal(submitted.success, true);
  assert.equal(submitted.audit.items[0].systemStock, 20);
  assert.equal(submitted.audit.items[0].submissionStock, 15);
  assert.equal(submitted.audit.items[0].variance, 0);
  assert.equal(submitted.audit.items[0].adjustmentDelta, 0);

  const approved = await stockAudit.approveAudit(db, created.audit._id, manager);
  assert.equal(approved.success, true);
  assert.equal((await db.get('S1:product:milk')).stock, 15);
});

test('approval safely rebases pending audits created before submission snapshots existed', async () => {
  const db = new MemoryDb([product({ stock: 2, batches: [{ batchId: 'batch-1', quantity: 36 }] }), {
    _id: 'S1:stock-audit:2026-09-10', type: 'stock-audit', version: 2, storeNo: 'S1', auditDate: '2026-09-10',
    status: 'pending_approval', createdAt: '2026-09-11T05:28:01.573Z', submittedAt: '2026-09-11T14:46:19.404Z',
    submittedBy: { id: operator._id, name: 'Opal Counter' }, reviewHistory: [],
    items: [{ productId: 'S1:product:milk', productName: 'Milk', systemStock: 7, physicalCount: 2, variance: 5, adjustmentDelta: -5, buyPrice: 50, reason: 'Counted later', resolution: 'Reviewed' }],
    summary: { totalProducts: 1, discrepancyCount: 1, totalShrinkageUnits: 5, totalShrinkageValue: 250, shrinkageRate: 100, accuracyRate: 0 },
  }]);

  const approved = await stockAudit.approveAudit(db, 'S1:stock-audit:2026-09-10', manager);
  assert.equal(approved.success, true);
  const updatedProduct = await db.get('S1:product:milk');
  assert.equal(updatedProduct.stock, 2);
  assert.equal(updatedProduct.batches.reduce((sum, batch) => sum + batch.quantity, 0), 2);
  assert.equal(approved.audit.items[0].submissionStock, 2);
  assert.equal(approved.audit.items[0].adjustmentDelta, 0);
  assert.equal(approved.audit.summary.discrepancyCount, 0);
});

test('stock updates trim legacy batch totals to the canonical product stock', () => {
  const result = applyStockDeltaToProduct(product({ stock: 2, batches: [{ batchId: 'old', quantity: 36 }] }), -1);
  assert.equal(result.updatedProduct.stock, 1);
  assert.equal(result.updatedProduct.batches.reduce((sum, batch) => sum + batch.quantity, 0), 1);
});

test('rejection requires a reason, preserves review history, and reopens the same audit', async () => {
  const now = localDate(2026, 9, 8, 9);
  const db = new MemoryDb([product(), sale('sale-1', localDate(2026, 9, 7, 10), 'NEW SALE', 1)]);
  const created = await stockAudit.createAudit(db, 'S1', operator, now);
  await stockAudit.submitAudit(db, created.audit._id, { discrepancies: [] }, operator);

  const withoutReason = await stockAudit.rejectAudit(db, created.audit._id, '', manager);
  assert.equal(withoutReason.success, false);
  const rejected = await stockAudit.rejectAudit(db, created.audit._id, 'Please recount shelf stock', manager);
  assert.equal(rejected.success, true);
  assert.equal(rejected.audit.status, 'in_progress');
  assert.equal(rejected.audit.reviewHistory[0].action, 'rejected');
  assert.equal(rejected.audit.reviewHistory[0].reason, 'Please recount shelf stock');
  assert.equal((await db.get('S1:product:milk')).stock, 20);
});

test('approval rolls product changes back if movement recording fails', async () => {
  const now = localDate(2026, 9, 8, 9);
  const db = new MemoryDb([product(), sale('sale-1', localDate(2026, 9, 7, 10), 'NEW SALE', 1)]);
  const created = await stockAudit.createAudit(db, 'S1', operator, now);
  await stockAudit.submitAudit(db, created.audit._id, {
    discrepancies: [{ productId: 'S1:product:milk', physicalCount: 18, reason: 'Damage', resolution: 'Written off' }],
  }, operator);
  db.failStockMovement = true;

  const result = await stockAudit.approveAudit(db, created.audit._id, manager);
  assert.equal(result.success, false);
  assert.equal((await db.get('S1:product:milk')).stock, 20);
  const audit = await db.get(created.audit._id);
  assert.equal(audit.status, 'pending_approval');
  assert.equal(audit.approvalLock, null);
});

test('cross-store actors cannot create, submit, approve, or reject audits', async () => {
  const outsider = { ...manager, _id: 'S2:manager', storeNo: 'S2' };
  const now = localDate(2026, 9, 8, 9);
  const db = new MemoryDb([product(), sale('sale-1', localDate(2026, 9, 7, 10), 'NEW SALE', 1)]);
  assert.equal((await stockAudit.createAudit(db, 'S1', outsider, now)).success, false);
  const created = await stockAudit.createAudit(db, 'S1', operator, now);
  assert.equal((await stockAudit.submitAudit(db, created.audit._id, { discrepancies: [] }, outsider)).success, false);
  await stockAudit.submitAudit(db, created.audit._id, { discrepancies: [] }, operator);
  assert.equal((await stockAudit.approveAudit(db, created.audit._id, outsider)).success, false);
  assert.equal((await stockAudit.rejectAudit(db, created.audit._id, 'No', outsider)).success, false);
});

test('thermal audit sheets include sold quantities, app stock, blank actual stock, and a cut', () => {
  const calls = [];
  const printer = new Proxy({}, {
    get(target, property) {
      if (!target[property]) target[property] = (...args) => { calls.push([property, ...args]); return printer; };
      return target[property];
    },
  });
  const audit = {
    _id: 'S1:stock-audit:2026-09-07', type: 'stock-audit', storeNo: 'S1', auditDate: '2026-09-07',
    items: [{ productName: 'A very long milk product name', netSoldQuantity: 2.5, systemStock: 18 }],
  };

  renderAuditSheet(printer, audit, 'system');
  assert.ok(calls.some((call) => call[0] === 'text' && call[1] === 'SYSTEM STOCK SHEET'));
  assert.ok(calls.some((call) => call[0] === 'tableCustom' && call[1].some((cell) => cell.text === '18')));
  assert.equal(calls.filter((call) => call[0] === 'cut').length, 1);

  calls.length = 0;
  renderAuditSheet(printer, audit, 'physical');
  assert.ok(calls.some((call) => call[0] === 'text' && call[1] === 'PHYSICAL COUNT SHEET'));
  assert.ok(calls.some((call) => call[0] === 'tableCustom' && call[1].some((cell) => cell.text === '________')));
  assert.ok(calls.some((call) => call[0] === 'tableCustom' && call[1].some((cell) => cell.text === 'A very long milk product name')));
  assert.equal(calls.filter((call) => call[0] === 'cut').length, 1);
});
