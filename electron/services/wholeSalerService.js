const PouchDB = require('pouchdb');
const db = new PouchDB('wholeSalers');

function createWholeSaler(wholeSalerData) {
  return db.post(wholeSalerData)
    .then(response => ({ success: true, wholeSaler: { ...wholeSalerData, _id: response.id, _rev: response.rev } }))
    .catch(error => {
      console.error('Error creating wholeSaler:', error);
      return { success: false, error: error.message };
    });
}

function updateWholeSaler(wholeSalerData) {
  return db.put(wholeSalerData)
    .then(response => ({ success: true, wholeSaler: { ...wholeSalerData, _rev: response.rev } }))
    .catch(error => {
      console.error('Error updating wholeSaler:', error);
      return { success: false, error: error.message };
    });
}

function deleteWholeSaler(wholeSalerId, rev) {
  return db.remove(wholeSalerId, rev)
    .then(() => ({ success: true }))
    .catch(error => {
      console.error('Error deleting wholeSaler:', error);
      return { success: false, error: error.message };
    });
}

function getWholeSalerById(wholeSalerId) {
  return db.get(wholeSalerId)
    .then(wholeSaler => ({ success: true, wholeSaler }))
    .catch(error => {
      console.error('Error fetching wholeSaler:', error);
      return { success: false, error: error.message };
    });
}

function getAllWholeSalers() {
  return db.allDocs({ include_docs: true })
    .then(result => ({ success: true, wholeSalers: result.rows.map(row => row.doc) }))
    .catch(error => {
      console.error('Error fetching wholeSalers:', error);
      return { success: false, error: error.message };
    });
}

module.exports = {
  createWholeSaler,
  updateWholeSaler,
  deleteWholeSaler,
  getWholeSalerById,
  getAllWholeSalers,
};
