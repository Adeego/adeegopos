function createStaff(realm, staffData) {
  try {
    let newStaff;
    realm.write(() => {
      newStaff = realm.create('Staff', staffData);
    });
    return { success: true, staff: newStaff.toJSON() };
  } catch (error) {
    console.error('Error creating staff:', error);
    return { success: false, error: error.message };
  }
}

function updateStaff(realm, staffData) {
  try {
    let updatedStaff;
    realm.write(() => {
      updatedStaff = realm.create('Staff', staffData, 'modified');
    });
    return { success: true, staff: updatedStaff.toJSON() };
  } catch (error) {
    console.error('Error updating staff:', error);
    return { success: false, error: error.message };
  }
}

function deleteStaff(realm, staffId) {
  try {
    realm.write(() => {
      const staffToDelete = realm.objectForPrimaryKey('Staff', staffId);
      if (staffToDelete) {
        realm.delete(staffToDelete);
      }
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting staff:', error);
    return { success: false, error: error.message };
  }
}

function getStaffById(realm, staffId) {
  try {
    const staff = realm.objectForPrimaryKey('Staff', staffId);
    return staff ? { success: true, staff: staff.toJSON() } : { success: false, error: 'Staff not found' };
  } catch (error) {
    console.error('Error fetching staff:', error);
    return { success: false, error: error.message };
  }
}

function getAllStaff(realm) {
  try {
    const staff = realm.objects('Staff');
    return { success: true, staff: staff.map(s => s.toJSON()) };
  } catch (error) {
    console.error('Error fetching all staff:', error);
    return { success: false, error: error.message };
  }
}

function signInStaff(realm, phoneNumber, passcode) {
  try {
    const staff = realm.objects('Staff').filtered('phone == $0 AND passcode == $1', phoneNumber, passcode)[0];
    if (staff) {
      return { success: true, staff: staff.toJSON() };
    } else {
      return { success: false, error: 'Invalid credentials' };
    }
  } catch (error) {
    console.error('Error signing in staff:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  createStaff,
  updateStaff,
  deleteStaff,
  getStaffById,
  getAllStaff,
  signInStaff,
};
