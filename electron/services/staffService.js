function createStaff(db, staffData) {
  const staff = {
    _id: staffData._id,
    type: 'staff',
    ...staffData
  };
  return db.put(staff)
    .then(response => ({ success: true, staff: { _id: response.id, ...staff } }))
    .catch(error => ({ success: false, error: error.message }));
}
                                                                     
function updateStaff(db, staffData) {
  const staff = {
    _id: `staff_${staffData._id}`,
    type: 'staff',
    ...staffData
  };
  return db.put(staff)
    .then(response => ({ success: true, staff: { _id: response.id, ...staff } }))
    .catch(error => ({ success: false, error: error.message }));
}
                                                                     
function deleteStaff(db, staffId) {
  return db.get(`staff_${staffId}`)
    .then(doc => db.remove(doc))
    .then(() => ({ success: true }))
    .catch(error => ({ success: false, error: error.message }));
}
                                                                     
function getStaffById(db, staffId) {
  return db.get(`staff_${staffId}`)
    .then(staff => ({ success: true, staff }))
    .catch(error => ({ success: false, error: error.message }));
}
                                                                     
function getAllStaff(db) {
  return db.find({
    selector: { type: 'staff' }
  }).then(result => ({ success: true, staff: result.docs }))
    .catch(error => ({ success: false, error: error.message }));
}
                                                                     
function signInStaff(db, phoneNumber, passcode) {                    
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
