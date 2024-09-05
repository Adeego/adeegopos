function createWholeSaler(realm, wholeSalerData) {
  try {
    let newWholeSaler;
    realm.write(() => {
      newWholeSaler = realm.create('WholeSaler', wholeSalerData);
    });
    return { success: true, wholeSaler: newWholeSaler.toJSON() };
  } catch (error) {
    console.error('Error creating wholeSaler:', error);
    return { success: false, error: error.message };
  }
}

function updateWholeSaler(realm, wholeSalerData) {
  try {
    let updatedWholeSaler;
    realm.write(() => {
      updatedWholeSaler = realm.create('WholeSaler', wholeSalerData, 'modified');
    });
    return { success: true, wholeSaler: updatedWholeSaler.toJSON() };
  } catch (error) {
    console.error('Error updating wholeSaler:', error);
    return { success: false, error: error.message };
  }
}

function deleteWholeSaler(realm, wholeSalerId) {
  try {
    realm.write(() => {
      const wholeSalerToDelete = realm.objectForPrimaryKey('WholeSaler', wholeSalerId);
      if (wholeSalerToDelete) {
        realm.delete(wholeSalerToDelete);
      }
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting wholeSaler:', error);
    return { success: false, error: error.message };
  }
}

function getWholeSalerById(realm, wholeSalerId) {
  try {
    const wholeSaler = realm.objectForPrimaryKey('WholeSaler', wholeSalerId);
    return wholeSaler ? { success: true, wholeSaler: wholeSaler.toJSON() } : { success: false, error: 'WholeSaler not found' };
  } catch (error) {
    console.error('Error fetching wholeSaler:', error);
    return { success: false, error: error.message };
  }
}

function getAllWholeSalers(realm) {
  try {
    const wholeSalers = realm.objects('WholeSaler');
    return { success: true, wholeSalers: wholeSalers.map(wholeSaler => wholeSaler.toJSON()) };
  } catch (error) {
    console.error('Error fetching wholeSalers:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  createWholeSaler,
  updateWholeSaler,
  deleteWholeSaler,
  getWholeSalerById,
  getAllWholeSalers,
};
