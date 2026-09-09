const crypto = require('crypto');
const {
  ACCESS_VERSION,
  MODULE_IDS,
  normalizeRoles,
  getPrimaryRole,
  getRoleLabel,
  normalizeStaff,
  normalizeModuleAccess,
} = require('../../lib/rbac');
const {
  getPresetAccess,
  inferPresetFromLegacyRoles,
  mapLegacyRolesToAccess,
} = require('../../lib/modules');

function buildStaffRoles(staffData) {
  const roles = normalizeRoles(staffData.roles);
  return roles.length > 0 ? roles : normalizeRoles(staffData.role);
}

function withRoleFields(staffData) {
  const roles = buildStaffRoles(staffData);
  const primaryRole = getPrimaryRole(roles);
  return { roles, role: primaryRole ? getRoleLabel(primaryRole) : (staffData.role || '') };
}

function compareCreatedAt(a, b) {
  const aTime = Number.isFinite(new Date(a.createdAt).getTime()) ? new Date(a.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = Number.isFinite(new Date(b.createdAt).getTime()) ? new Date(b.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
  return aTime - bTime || String(a._id).localeCompare(String(b._id));
}

function normalizeCredentialPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return `0${digits.slice(3)}`;
  return digits;
}

function pickOwner(staffDocs) {
  const active = staffDocs.filter((staff) => staff.state === 'Active');
  const existingOwners = active.filter((staff) => staff.isOwner).sort(compareCreatedAt);
  if (existingOwners.length > 0) return existingOwners[0];
  return active.filter((staff) => buildStaffRoles(staff).includes('admin')).sort(compareCreatedAt)[0] || null;
}

async function migrateStoreStaffAccess(db, storeNo) {
  if (!storeNo) return { success: false, error: 'Store number is required for staff access migration' };
  try {
    const result = await db.find({ selector: { type: 'staff', storeNo }, limit: 10000 });
    if (result.docs.length === 0) return { success: true, migrated: 0, ownerId: null, reviewRequired: false };

    const owner = pickOwner(result.docs);
    let migrated = 0;
    const updates = result.docs.flatMap((staff) => {
      const shouldBeOwner = Boolean(owner && staff._id === owner._id);
      const currentAccess = normalizeModuleAccess(staff.moduleAccess);
      const alreadyCurrent = Number(staff.accessVersion) >= ACCESS_VERSION
        && staff.isOwner === shouldBeOwner
        && Object.keys(currentAccess).length > 0;
      if (alreadyCurrent) return [];

      const roles = buildStaffRoles(staff);
      const accessPreset = shouldBeOwner ? 'owner' : (staff.accessPreset || inferPresetFromLegacyRoles(roles));
      const moduleAccess = shouldBeOwner
        ? getPresetAccess('owner')
        : (Object.keys(currentAccess).length > 0 ? currentAccess : mapLegacyRolesToAccess(roles));
      migrated += 1;
      return [{
        ...staff,
        ...withRoleFields(staff),
        accessVersion: ACCESS_VERSION,
        isOwner: shouldBeOwner,
        accessPreset,
        moduleAccess,
        accessReviewRequired: true,
        accessMigratedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }];
    });

    if (updates.length > 0) {
      const response = await db.bulkDocs(updates);
      const failed = response.find((entry) => entry.error);
      if (failed) throw new Error(failed.reason || failed.message || 'Staff migration failed');
    }
    return { success: true, migrated, ownerId: owner?._id || null, reviewRequired: migrated > 0 };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function buildAccessFields(staffData, current = null, actor = null) {
  const actorIsOwner = Boolean(actor?.isOwner);
  const targetIsOwner = Boolean(current?.isOwner || staffData.isOwner);
  let moduleAccess = normalizeModuleAccess(staffData.moduleAccess);

  if (targetIsOwner) moduleAccess = getPresetAccess('owner');
  if (!targetIsOwner && moduleAccess[MODULE_IDS.STAFF_ADMIN] === 'manage') moduleAccess[MODULE_IDS.STAFF_ADMIN] = 'operate';
  if (!actorIsOwner && !targetIsOwner) {
    const existingAdminLevel = current?.moduleAccess?.[MODULE_IDS.STAFF_ADMIN];
    if (existingAdminLevel) moduleAccess[MODULE_IDS.STAFF_ADMIN] = existingAdminLevel;
    else delete moduleAccess[MODULE_IDS.STAFF_ADMIN];
  }

  return {
    accessVersion: ACCESS_VERSION,
    isOwner: targetIsOwner,
    accessPreset: targetIsOwner ? 'owner' : (staffData.accessPreset || 'custom'),
    moduleAccess,
    accessReviewRequired: false,
  };
}

async function writeAccessAudit(db, { action, actor, target, before = null, after = null }) {
  const storeNo = target?.storeNo || actor?.storeNo || '';
  const now = new Date().toISOString();
  const audit = {
    _id: `${storeNo}:access-audit:${crypto.randomUUID()}`,
    type: 'accessAudit',
    state: 'Active',
    storeNo,
    action,
    actor: actor ? { _id: actor._id, name: `${actor.firstName || ''} ${actor.lastName || ''}`.trim(), isOwner: Boolean(actor.isOwner) } : null,
    target: target ? { _id: target._id, name: `${target.firstName || ''} ${target.lastName || ''}`.trim() } : null,
    before: before ? { accessPreset: before.accessPreset, moduleAccess: before.moduleAccess, isOwner: Boolean(before.isOwner), state: before.state } : null,
    after: after ? { accessPreset: after.accessPreset, moduleAccess: after.moduleAccess, isOwner: Boolean(after.isOwner), state: after.state } : null,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await db.put(audit);
  } catch (error) {
    console.error('[AccessAudit] Failed to record staff access change:', error);
  }
}

async function createStaff(db, staffData, actor = null) {
  try {
    if (actor && String(actor.storeNo) !== String(staffData.storeNo)) throw new Error('Cannot create staff in another store');
    if (staffData.isOwner) {
      const existing = await db.find({ selector: { type: 'staff', state: 'Active', storeNo: staffData.storeNo }, limit: 1 });
      if (existing.docs.length > 0) throw new Error('This store already has an owner; sign in to create additional staff');
    }
    const roleFields = withRoleFields(staffData);
    const accessFields = buildAccessFields(staffData, null, actor);
    const now = new Date().toISOString();
    const staff = {
      _id: staffData._id,
      firstName: staffData.firstName,
      lastName: staffData.lastName,
      phone: staffData.phoneNumber || staffData.phone,
      balance: staffData.balance,
      passcode: staffData.passcode,
      salary: staffData.salary,
      ...roleFields,
      ...accessFields,
      storeNo: staffData.storeNo,
      createdAt: staffData.createdAt || now,
      updatedAt: now,
      type: 'staff',
      state: 'Active',
    };
    const response = await db.put(staff);
    const saved = normalizeStaff({ ...staff, _id: response.id, _rev: response.rev });
    await writeAccessAudit(db, { action: 'staff_created', actor, target: saved, after: saved });
    return { success: true, staff: saved };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getAllStaff(db, storeNo) {
  const migration = await migrateStoreStaffAccess(db, storeNo);
  if (!migration.success) return migration;
  try {
    const result = await db.find({ selector: { type: 'staff', state: 'Active', storeNo }, limit: 10000 });
    return { success: true, staff: result.docs.map(normalizeStaff), migration };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getStaffById(db, staffId, storeNo = null) {
  try {
    const staff = await db.get(staffId);
    if (storeNo && String(staff.storeNo) !== String(storeNo)) throw new Error('Cannot access staff from another store');
    return { success: true, staff: normalizeStaff(staff) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function updateStaff(db, staffData, actor = null, options = {}) {
  try {
    const current = await db.get(staffData._id);
    if (current.type !== 'staff') throw new Error('Selected record is not a staff account');
    if (actor && String(actor.storeNo) !== String(current.storeNo)) throw new Error('Cannot update staff from another store');
    if (!current.isOwner && staffData.isOwner) throw new Error('Owner transfer is not supported from staff editing');
    if (current.isOwner && actor?._id !== current._id && !actor?.isOwner) throw new Error('The owner account can only be updated by the owner');

    const roleFields = options.profileOnly ? withRoleFields(current) : withRoleFields(staffData);
    const accessFields = options.profileOnly ? buildAccessFields(current, current, actor) : buildAccessFields(staffData, current, actor);
    const staff = {
      ...current,
      ...staffData,
      _id: current._id,
      _rev: current._rev,
      type: 'staff',
      state: current.state,
      storeNo: current.storeNo,
      ...roleFields,
      ...accessFields,
      updatedAt: new Date().toISOString(),
    };
    if (options.profileOnly) {
      staff.moduleAccess = current.moduleAccess;
      staff.accessPreset = current.accessPreset;
      staff.accessVersion = current.accessVersion;
      staff.isOwner = current.isOwner;
    }
    const response = await db.put(staff);
    const saved = normalizeStaff({ ...staff, _rev: response.rev });
    await writeAccessAudit(db, { action: options.profileOnly ? 'staff_profile_updated' : 'staff_access_updated', actor, target: saved, before: current, after: saved });
    return { success: true, staff: saved };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function archiveStaff(db, staffId, actor = null) {
  const id = typeof staffId === 'object' && staffId !== null ? staffId.id : staffId;
  try {
    const staff = await db.get(id);
    if (actor && String(actor.storeNo) !== String(staff.storeNo)) return { success: false, error: 'Cannot archive staff from another store' };
    if (staff.isOwner) return { success: false, error: 'The store owner cannot be archived' };
    const before = { ...staff };
    staff.state = 'Inactive';
    staff.updatedAt = new Date().toISOString();
    await db.put(staff);
    await writeAccessAudit(db, { action: 'staff_archived', actor, target: staff, before, after: staff });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getActiveStaffById(db, staffId, storeNo) {
  try {
    const staff = await db.get(staffId);
    if (staff.type !== 'staff' || staff.state !== 'Active' || String(staff.storeNo) !== String(storeNo)) {
      return { success: false, error: 'Staff session is no longer valid' };
    }
    return { success: true, staff: normalizeStaff(staff) };
  } catch (error) {
    return { success: false, error: 'Staff session is no longer valid' };
  }
}

async function recoverMatchingHistoricalPasscode(db, staff, requestedPasscode) {
  if (!staff?._id || staff.passcode !== undefined && staff.passcode !== null) return null;
  try {
    const metadata = await db.get(staff._id, { revs_info: true, conflicts: true });
    const revisions = [
      ...(metadata._revs_info || []).filter((entry) => entry.status === 'available').map((entry) => entry.rev),
      ...(metadata._conflicts || []),
    ];
    for (const revision of [...new Set(revisions)]) {
      const historical = await db.get(staff._id, { rev: revision }).catch(() => null);
      if (historical?.passcode !== undefined && historical?.passcode !== null
        && String(historical.passcode) === requestedPasscode) {
        return historical.passcode;
      }
    }
  } catch (error) {
    // No retained credential revision is a normal condition for newer records.
  }
  return null;
}

async function signInStaff(db, phoneNumber, passcode, storeNo) {
  try {
    const requestedPhone = normalizeCredentialPhone(phoneNumber);
    const requestedPasscode = String(passcode ?? '');
    const requestedStoreNo = String(storeNo ?? '').trim();
    if (!requestedPhone || !requestedPasscode || !requestedStoreNo) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Legacy staff records may contain numeric phone, passcode, or store values.
    // Mango equality is type-sensitive, so fetch the small local staff set and
    // compare normalized credential values before migrating the matched store.
    const result = await db.find({
      selector: { type: 'staff', state: 'Active' },
      limit: 10000,
    });
    const candidates = result.docs.filter((staff) => {
      const storedPhone = normalizeCredentialPhone(staff.phone ?? staff.phoneNumber);
      return String(staff.storeNo ?? '').trim() === requestedStoreNo
        && storedPhone === requestedPhone;
    });
    let matched = candidates.find((staff) => staff.passcode !== undefined
      && staff.passcode !== null
      && String(staff.passcode) === requestedPasscode);
    let recoveredPasscode = null;
    if (!matched) {
      for (const candidate of candidates) {
        recoveredPasscode = await recoverMatchingHistoricalPasscode(db, candidate, requestedPasscode);
        if (recoveredPasscode !== null) {
          matched = candidate;
          break;
        }
      }
    }
    if (!matched) return { success: false, error: 'Invalid credentials' };

    if (recoveredPasscode !== null) {
      const current = await db.get(matched._id);
      const response = await db.put({
        ...current,
        passcode: recoveredPasscode,
        credentialRecoveredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      matched = { ...current, passcode: recoveredPasscode, _rev: response.rev };
    }

    const migration = await migrateStoreStaffAccess(db, matched.storeNo);
    if (!migration.success) return migration;
    const refreshed = await getActiveStaffById(db, matched._id, matched.storeNo);
    return refreshed.success
      ? { success: true, staff: refreshed.staff, migration }
      : refreshed;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function restoreMissingStaffPasscode(db, staffId, storeNo, passcode) {
  try {
    const current = await db.get(staffId);
    if (current.type !== 'staff' || current.state !== 'Active'
      || String(current.storeNo) !== String(storeNo)) {
      return { success: false, error: 'Staff session is no longer valid' };
    }
    if (current.passcode !== undefined && current.passcode !== null) {
      return { success: false, error: 'The current staff credential cannot be replaced during recovery.' };
    }
    const now = new Date().toISOString();
    await db.put({ ...current, passcode: String(passcode), credentialRecoveredAt: now, updatedAt: now });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  createStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  archiveStaff,
  signInStaff,
  getActiveStaffById,
  migrateStoreStaffAccess,
  restoreMissingStaffPasscode,
  writeAccessAudit,
};
