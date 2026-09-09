const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-find'));

const staffService = require('../electron/services/staffService');

function dbName() {
  return path.join(os.tmpdir(), `adeego-staff-access-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

test('migration selects one oldest active admin and merges multi-role presets idempotently', async () => {
  const db = new PouchDB(dbName());
  try {
    await db.bulkDocs([
      { _id: 'S1:admin:new', type: 'staff', state: 'Active', storeNo: 'S1', role: 'Admin', createdAt: '2025-02-01T00:00:00.000Z' },
      { _id: 'S1:admin:old', type: 'staff', state: 'Active', storeNo: 'S1', role: 'Admin', createdAt: '2025-01-01T00:00:00.000Z' },
      { _id: 'S1:mixed', type: 'staff', state: 'Active', storeNo: 'S1', roles: ['seller', 'bookkeeper'], createdAt: '2025-03-01T00:00:00.000Z' },
      { _id: 'S1:inactive', type: 'staff', state: 'Inactive', storeNo: 'S1', role: 'Admin', createdAt: '2024-01-01T00:00:00.000Z' },
    ]);

    const first = await staffService.migrateStoreStaffAccess(db, 'S1');
    assert.equal(first.success, true, first.error);
    assert.equal(first.ownerId, 'S1:admin:old');
    assert.equal(first.migrated, 4);

    const oldAdmin = await db.get('S1:admin:old');
    const newAdmin = await db.get('S1:admin:new');
    const mixed = await db.get('S1:mixed');
    assert.equal(oldAdmin.isOwner, true);
    assert.equal(oldAdmin.moduleAccess.staff_admin, 'manage');
    assert.equal(newAdmin.isOwner, false);
    assert.equal(newAdmin.moduleAccess.staff_admin, 'operate');
    assert.equal(mixed.moduleAccess.pos, 'operate');
    assert.equal(mixed.moduleAccess.bookkeeping, 'manage');
    assert.equal(mixed.moduleAccess.reports, 'view');

    const second = await staffService.migrateStoreStaffAccess(db, 'S1');
    assert.equal(second.success, true, second.error);
    assert.equal(second.migrated, 0);
    assert.equal(second.ownerId, 'S1:admin:old');
  } finally {
    await db.destroy();
  }
});

test('owner cannot be archived and delegated managers cannot grant Staff/Admin', async () => {
  const db = new PouchDB(dbName());
  try {
    const owner = {
      _id: 'S1:owner', type: 'staff', state: 'Active', storeNo: 'S1', firstName: 'Store', lastName: 'Owner',
      role: 'Admin', roles: ['admin'], accessVersion: 2, accessPreset: 'owner', isOwner: true,
      moduleAccess: { staff_admin: 'manage' }, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
    };
    const manager = {
      _id: 'S1:manager', type: 'staff', state: 'Active', storeNo: 'S1', firstName: 'Team', lastName: 'Manager',
      role: 'Operator', roles: ['operator'], accessVersion: 2, accessPreset: 'manager', isOwner: false,
      moduleAccess: { staff_admin: 'operate' }, createdAt: '2025-02-01T00:00:00.000Z', updatedAt: '2025-02-01T00:00:00.000Z',
    };
    await db.bulkDocs([owner, manager]);

    const crossStoreSession = await staffService.getActiveStaffById(db, owner._id, 'S2');
    assert.equal(crossStoreSession.success, false);

    const archive = await staffService.archiveStaff(db, owner._id, owner);
    assert.equal(archive.success, false);

    const duplicateOwner = await staffService.createStaff(db, {
      _id: 'S1:owner:duplicate', firstName: 'Other', lastName: 'Owner', storeNo: 'S1', isOwner: true,
      role: 'Admin', roles: ['admin'], moduleAccess: { staff_admin: 'manage' },
    });
    assert.equal(duplicateOwner.success, false);

    const created = await staffService.createStaff(db, {
      _id: 'S1:new', firstName: 'New', lastName: 'Staff', phone: '1', passcode: '1', salary: 0, balance: 0,
      storeNo: 'S1', role: 'Operator', roles: ['operator'], accessPreset: 'custom', moduleAccess: { pos: 'operate', staff_admin: 'manage' },
    }, manager);
    assert.equal(created.success, true, created.error);
    assert.equal(created.staff.moduleAccess.pos, 'operate');
    assert.equal(created.staff.moduleAccess.staff_admin, undefined);

    const audits = await db.find({ selector: { type: 'accessAudit', storeNo: 'S1' }, limit: 100 });
    assert.ok(audits.docs.some((entry) => entry.action === 'staff_created' && entry.target._id === 'S1:new'));
  } finally {
    await db.destroy();
  }
});

test('local owner login accepts legacy numeric credential fields and restores owner access', async () => {
  const db = new PouchDB(dbName());
  try {
    await db.put({
      _id: 'legacy-owner', type: 'staff', state: 'Active', storeNo: 101,
      firstName: 'Legacy', lastName: 'Owner', phone: 254700000001,
      passcode: 1234, role: 'Admin', createdAt: '2024-01-01T00:00:00.000Z',
    });

    const result = await staffService.signInStaff(db, '254700000001', '1234', '101');
    assert.equal(result.success, true, result.error);
    assert.equal(result.staff.isOwner, true);
    assert.equal(result.staff.accessPreset, 'owner');
    assert.equal(result.staff.moduleAccess.staff_admin, 'manage');
  } finally {
    await db.destroy();
  }
});

test('local owner login securely recovers a passcode lost from the current revision', async () => {
  const db = new PouchDB(dbName());
  try {
    const created = await db.put({
      _id: 'S1:owner-with-history', type: 'staff', state: 'Active', storeNo: 'S1',
      firstName: 'Store', lastName: 'Owner', phone: '0700000000', passcode: '4321',
      role: 'Admin', createdAt: '2024-01-01T00:00:00.000Z',
    });
    const current = await db.get(created.id);
    delete current.passcode;
    await db.put({ ...current, updatedAt: '2025-01-01T00:00:00.000Z' });

    const result = await staffService.signInStaff(db, '0700000000', '4321', 'S1');
    assert.equal(result.success, true, result.error);
    assert.equal(result.staff.isOwner, true);
    const repaired = await db.get(created.id);
    assert.equal(repaired.passcode, '4321');
    assert.ok(repaired.credentialRecoveredAt);
  } finally {
    await db.destroy();
  }
});

test('centrally verified recovery only restores a missing local credential', async () => {
  const db = new PouchDB(dbName());
  try {
    await db.bulkDocs([
      { _id: 'S1:missing', type: 'staff', state: 'Active', storeNo: 'S1', phone: '0700000001' },
      { _id: 'S1:existing', type: 'staff', state: 'Active', storeNo: 'S1', phone: '0700000002', passcode: 'old' },
    ]);
    const restored = await staffService.restoreMissingStaffPasscode(db, 'S1:missing', 'S1', 'new-secret');
    assert.equal(restored.success, true, restored.error);
    assert.equal((await db.get('S1:missing')).passcode, 'new-secret');

    const refused = await staffService.restoreMissingStaffPasscode(db, 'S1:existing', 'S1', 'replacement');
    assert.equal(refused.success, false);
    assert.equal((await db.get('S1:existing')).passcode, 'old');
  } finally {
    await db.destroy();
  }
});
