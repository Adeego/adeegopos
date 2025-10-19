// Create a new expense type
function createExpenseType(db, expenseTypeData) {
  const expenseType = {
    _id: expenseTypeData._id,
    name: expenseTypeData.name,
    description: expenseTypeData.description,
    storeNo: expenseTypeData.storeNo,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    type: "expenseType",
    state: "Active"
  };
  return db
    .put(expenseType)
    .then((response) => ({
      success: true,
      expenseType: { _id: response.id, ...expenseType },
    }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Get all expense types
function getAllExpenseTypes(db, storeNo) {
  if (!storeNo) {
    return Promise.resolve({ success: false, error: "storeNo is required" });
  }
  return db
    .find({
      selector: { 
        type: "expenseType",
        state: "Active",
        storeNo: storeNo
      },
    })
    .then((result) => ({ success: true, expenseTypes: result.docs }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Get an expense type by ID
function getExpenseTypeById(db, expenseTypeId) {
  return db
    .get(expenseTypeId)
    .then((expenseType) => ({ success: true, expenseType }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Update an existing expense type
function updateExpenseType(db, expenseTypeData) {
  return db
    .get(expenseTypeData._id)
    .then((existingExpenseType) => {
      // Merge new data with existing document
      const updatedExpenseType = {
        ...existingExpenseType,
        ...expenseTypeData,
        updatedAt: new Date().toISOString(),
        type: "expenseType",
        state: "Active"
      };

      // Use the existing _rev to prevent update conflicts
      return db.put(updatedExpenseType);
    })
    .then((response) => ({
      success: true,
      expenseType: { _id: response.id },
    }))
    .catch((error) => ({ 
      success: false, 
      error: error.message 
    }));
}

// Delete an expense type
function archiveExpenseType(db, expenseTypeId) {
  return db
    .get(expenseTypeId)
    .then((expenseType) => {
      // Update the state field to "Inactive"
      expenseType.state = "Inactive";
      return db.put(expenseType);
    })
    .then(() => ({ success: true }))
    .catch((error) => ({ success: false, error: error.message }));
}

module.exports = {
  createExpenseType,
  getAllExpenseTypes,
  getExpenseTypeById,
  updateExpenseType,
  archiveExpenseType,
};
