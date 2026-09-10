const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ACCESS_VERSION,
  ACCESS_PRESETS,
  MODULE_IDS,
  can,
  canAccessRoute,
  canPerformOperation,
  getUiSections,
  hasModuleLevel,
  normalizeStaff,
} = require('../lib/rbac');

function staff(moduleAccess, extra = {}) {
  return normalizeStaff({
    _id: 'S1:staff:1',
    type: 'staff',
    state: 'Active',
    storeNo: 'S1',
    accessVersion: ACCESS_VERSION,
    accessPreset: 'custom',
    moduleAccess,
    ...extra,
  });
}

test('access levels enforce view, operate, and manage boundaries', () => {
  const seller = staff({ pos: 'operate' });
  assert.equal(hasModuleLevel(seller, MODULE_IDS.POS, 'view'), true);
  assert.equal(canPerformOperation(seller, 'createSale'), true);
  assert.equal(canPerformOperation(seller, 'getSalePaymentAccounts'), true);
  assert.equal(canPerformOperation(seller, 'getAllAccounts'), false);
  assert.equal(canPerformOperation(seller, 'updateSalePaidStatus'), false);
  assert.equal(canAccessRoute(seller, '/'), true);
  assert.equal(canAccessRoute(seller, '/cashier/sales'), false);

  const cashier = staff({ pos: 'manage' });
  assert.equal(canPerformOperation(cashier, 'updateSalePaidStatus'), true);
  assert.equal(canPerformOperation(cashier, 'closeRegisterSession'), true);

  const approver = staff({ bookkeeping: 'manage' });
  assert.equal(canAccessRoute(approver, '/cashier/sales'), true);
  assert.equal(canPerformOperation(approver, 'openRegisterSession'), false);

  const stockOperator = staff({ inventory: 'operate' });
  assert.equal(canPerformOperation(stockOperator, 'printAuditSheets'), true);
  assert.equal(canPerformOperation(stockOperator, 'approveAudit'), false);
  const stockManager = staff({ inventory: 'manage' });
  assert.equal(canPerformOperation(stockManager, 'approveAudit'), true);
  assert.equal(canPerformOperation(stockManager, 'rejectAudit'), true);
});

test('embedded dependencies permit lookup but not module navigation or mutation', () => {
  const seller = staff({ pos: 'operate' });
  assert.equal(can(seller, 'product:read'), true);
  assert.equal(can(seller, 'customer:read'), true);
  assert.equal(canAccessRoute(seller, '/product'), false);
  assert.equal(canAccessRoute(seller, '/customers'), false);
  assert.equal(canPerformOperation(seller, 'addNewProduct'), false);
  assert.equal(canPerformOperation(seller, 'createCustomer'), false);
});

test('reports is read-only and unknown routes and operations fail closed', () => {
  const analyst = staff({ reports: 'view' });
  assert.equal(canAccessRoute(analyst, '/dashboard'), true);
  assert.equal(canPerformOperation(analyst, 'getSalesMetricsReport'), true);
  assert.equal(canPerformOperation(analyst, 'createExpense'), false);
  assert.equal(canAccessRoute(analyst, '/future-unregistered-page'), false);
  assert.equal(canPerformOperation(analyst, 'futureUnknownOperation'), false);
});

test('owner receives every module and protected settings regardless of stored grants', () => {
  const owner = staff({}, { isOwner: true, accessPreset: 'owner' });
  assert.equal(getUiSections(owner).length, 8);
  assert.equal(canAccessRoute(owner, '/productStore'), true);
  assert.equal(canPerformOperation(owner, 'updateWholeSaler'), true);
  assert.deepEqual(owner.moduleAccess, ACCESS_PRESETS.owner.moduleAccess);
});

test('legacy roles receive conservative effective access during migration compatibility', () => {
  const legacy = normalizeStaff({ _id: 'legacy', state: 'Active', roles: ['seller', 'bookkeeper'] });
  assert.equal(hasModuleLevel(legacy, MODULE_IDS.POS, 'operate'), true);
  assert.equal(hasModuleLevel(legacy, MODULE_IDS.BOOKKEEPING, 'manage'), true);
  assert.equal(hasModuleLevel(legacy, MODULE_IDS.REPORTS, 'view'), true);
  assert.equal(canPerformOperation(legacy, 'approveReconciliationCase'), true);
});
