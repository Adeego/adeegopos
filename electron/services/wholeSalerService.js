function createWholeSaler(db, wholeSalerData) {
  const wholeSaler = {
    _id: `wholeSaler_${wholeSalerData._id}`,
    type: "wholeSaler",
    name: wholeSalerData.name || "",
    phone: wholeSalerData.phone || "",
    location: wholeSalerData.location || "",
    subscription: wholeSalerData.subscription || 0,
    plan: wholeSalerData.plan || "",
    ends: wholeSalerData.ends || new Date(),
    createdAt: wholeSalerData.createdAt || new Date(),
    updatedAt: wholeSalerData.updatedAt || new Date(),
    storeNo: wholeSalerData.storeNo || "",
  };
  return db
    .put(wholeSaler)
    .then((response) => ({
      success: true,
      wholeSaler: { _id: response.id, ...wholeSaler },
    }))
    .catch((error) => ({ success: false, error: error.message }));
}

function updateWholeSaler(db, wholeSalerData) {
  const wholeSaler = {
    _id: `wholeSaler_${wholeSalerData._id}`,
    type: "wholeSaler",
    ...wholeSalerData,
  };
  return db
    .put(wholeSaler)
    .then((response) => ({
      success: true,
      wholeSaler: { _id: response.id, ...wholeSaler },
    }))
    .catch((error) => ({ success: false, error: error.message }));
}

function deleteWholeSaler(db, wholeSalerId) {
  return db
    .get(`wholeSaler_${wholeSalerId}`)
    .then((doc) => db.remove(doc))
    .then(() => ({ success: true }))
    .catch((error) => ({ success: false, error: error.message }));
}

function getWholeSalerById(db, wholeSalerId) {
  return db
    .get(`wholeSaler_${wholeSalerId}`)
    .then((wholeSaler) => ({ success: true, wholeSaler }))
    .catch((error) => ({ success: false, error: error.message }));
}

function getAllWholeSalers(db) {
  return db
    .find({
      selector: { type: "wholeSaler" },
    })
    .then((result) => ({ success: true, wholeSalers: result.docs }))
    .catch((error) => ({ success: false, error: error.message }));
}

module.exports = {
  createWholeSaler,
  updateWholeSaler,
  deleteWholeSaler,
  getWholeSalerById,
  getAllWholeSalers,
};
