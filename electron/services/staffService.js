const { normalizeRoles, getPrimaryRole, getRoleLabel, normalizeStaff } = require('../../lib/rbac');

function buildStaffRoles(staffData) {
  const roles = normalizeRoles(staffData.roles);
  if (roles.length > 0) {
    return roles;
  }

  return normalizeRoles(staffData.role);
}

function withRoleFields(staffData) {
  const roles = buildStaffRoles(staffData);
  const primaryRole = getPrimaryRole(roles);

  return {
    ...staffData,
    roles,
    role: primaryRole ? getRoleLabel(primaryRole) : (staffData.role || ''),
  };
}

// Create a new staff member
function createStaff(db, staffData) {
  const roleFields = withRoleFields(staffData);
  const staff = {
    _id: staffData._id,
    firstName: staffData.firstName,
    lastName: staffData.lastName,
    phone: staffData.phoneNumber || staffData.phone,
    balance: staffData.balance,
    passcode: staffData.passcode,
    salary: staffData.salary,
    role: roleFields.role,
    roles: roleFields.roles,
    storeNo: staffData.storeNo,
    createdAt: staffData.createdAt,
    updatedAt: staffData.updatedAt,
    type: "staff",
    state: "Active"
  };
  return db
    .put(staff)
    .then(response => ({
      success: true,
      staff: normalizeStaff({ _id: response.id, ...staff })
    }))
    .catch(error => ({ success: false, error: error.message }));
}

// Get all active staff members
function getAllStaff(db, storeNo) {
  return db
    .find({
      selector: {
        type: "staff",
        state: "Active",
        storeNo: storeNo
      }
    })
    .then(result => ({ success: true, staff: result.docs.map(normalizeStaff) }))
    .catch(error => ({ success: false, error: error.message }));
}

// Get a staff member by ID
function getStaffById(db, staffId) {
  return db
    .get(staffId)
    .then(staff => ({ success: true, staff: normalizeStaff(staff) }))
    .catch(error => ({ success: false, error: error.message }));
}

// Update an existing staff member
function updateStaff(db, staffData) {
  const roleFields = withRoleFields(staffData);
  const staff = {
    _id: staffData._id,
    type: "staff",
    state: "Active",
    ...staffData,
    role: roleFields.role,
    roles: roleFields.roles
  };
  return db
    .put(staff)
    .then(response => ({
      success: true,
      staff: normalizeStaff({ _id: response.id, ...staff })
    }))
    .catch(error => ({ success: false, error: error.message }));
}

// Archive a staff member (soft delete)
function archiveStaff(db, staffId) {
  const id = typeof staffId === 'object' && staffId !== null ? staffId.id : staffId;
  return db
    .get(id)
    .then(staff => {
      // Update the state field to "Inactive"
      staff.state = "Inactive";
      return db.put(staff);
    })
    .then(() => ({ success: true }))
    .catch(error => ({ success: false, error: error.message }));
}

// Sign in a staff member
function signInStaff(db, phoneNumber, passcode, storeNo) {
  return db
    .find({
      selector: {
        type: "staff",
        state: "Active",
        $or: [
          { phone: phoneNumber },
          { phoneNumber: phoneNumber }
        ],
        passcode: passcode,
        storeNo: storeNo
      }
    })
    .then(result => {
      if (result.docs.length > 0) {
        return { success: true, staff: normalizeStaff(result.docs[0]) };
      } else {
        return { success: false, error: 'Invalid credentials' };
      }
    })
    .catch(error => {
      console.error('Error signing in staff:', error);
      return { success: false, error: error.message };
    });
}

module.exports = {
  createStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  archiveStaff,
  signInStaff
};
