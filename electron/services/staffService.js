const PouchDB = require('pouchdb');
const db = new PouchDB('staff');

function createStaff(staffData) {
  return db.post(staffData)
    .then(response => ({ success: true, staff: { ...staffData, _id: response.id, _rev: response.rev } }))
    .catch(error => {
      console.error('Error creating staff:', error);
      return { success: false, error: error.message };
    });
}

function updateStaff(staffData) {
  return db.put(staffData)
    .then(response => ({ success: true, staff: { ...staffData, _rev: response.rev } }))
    .catch(error => {
      console.error('Error updating staff:', error);
      return { success: false, error: error.message };
    });
}

function deleteStaff(staffId, rev) {
  return db.remove(staffId, rev)
    .then(() => ({ success: true }))
    .catch(error => {
      console.error('Error deleting staff:', error);
      return { success: false, error: error.message };
    });
}

function getStaffById(staffId) {
  return db.get(staffId)
    .then(staff => ({ success: true, staff }))
    .catch(error => {
      console.error('Error fetching staff:', error);
      return { success: false, error: error.message };
    });
}

function getAllStaff() {
  return db.allDocs({ include_docs: true })
    .then(result => ({ success: true, staff: result.rows.map(row => row.doc) }))
    .catch(error => {
      console.error('Error fetching all staff:', error);
      return { success: false, error: error.message };
    });
}

function signInStaff(phoneNumber, passcode) {
  return db.find({
    selector: { phone: phoneNumber, passcode: passcode }
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
  updateStaff,
  deleteStaff,
  getStaffById,
  getAllStaff,
  signInStaff,
};
