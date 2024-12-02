// Create a new staff member
function createStaff(db, staffData) {
  const staff = {
    _id: staffData._id,
    firstName: staffData.firstName,
    lastName: staffData.lastName,
    phoneNumber: staffData.phoneNumber,
    balance: staffData.balance,
    passcode: staffData.passcode,
    salary: staffData.salary,
    role: staffData.role,
    createdAt: staffData.createdAt,
    updatedAt: staffData.updatedAt,
    type: "staff",
    state: "Active"
  };
  return db
    .put(staff)
    .then(response => ({
      success: true,
      staff: { _id: response.id, ...staff }
    }))
    .catch(error => ({ success: false, error: error.message }));
}

// Get all active staff members
function getAllStaff(db) {
  return db
    .find({
      selector: {
        type: "staff",
        state: "Active"
      }
    })
    .then(result => ({ success: true, staff: result.docs }))
    .catch(error => ({ success: false, error: error.message }));
}

// Get a staff member by ID
function getStaffById(db, staffId) {
  return db
    .get(staffId)
    .then(staff => ({ success: true, staff }))
    .catch(error => ({ success: false, error: error.message }));
}

// Update an existing staff member
function updateStaff(db, staffData) {
  const staff = {
    _id: staffData._id,
    type: "staff",
    state: "Active",
    ...staffData
  };
  return db
    .put(staff)
    .then(response => ({
      success: true,
      staff: { _id: response.id, ...staff }
    }))
    .catch(error => ({ success: false, error: error.message }));
}

// Archive a staff member (soft delete)
function archiveStaff(db, staffId) {
  return db
    .get(staffId)
    .then(staff => {
      // Update the state field to "Inactive"
      staff.state = "Inactive";
      return db.put(staff);
    })
    .then(() => ({ success: true }))
    .catch(error => ({ success: false, error: error.message }));
}

// Sign in a staff member
function signInStaff(db, phoneNumber, passcode) {
  return db
    .find({
      selector: {
        type: "staff",
        state: "Active",
        phoneNumber: phoneNumber,
        passcode: passcode
      }
    })
    .then(result => {
      if (result.docs.length > 0) {
        return { success: true, staff: result.docs[0] };
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
