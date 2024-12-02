// Balance Sheet CRUD Operations

// Create a new balance sheet entry
function createBalanceSheetEntry(db, balanceSheetData) {
  const balanceEntry = {
    _id: balanceSheetData._id,
    category: balanceSheetData.category,
    amount: balanceSheetData.amount,
    description: balanceSheetData.description,
    storeNo: balanceSheetData.storeNo,
    createdAt: balanceSheetData.createdAt,
    updatedAt: balanceSheetData.updatedAt,
    type: balanceSheetData.type,
    state: "Active"
  };
  return db
    .put(balanceEntry)
    .then((response) => ({
      success: true,
      balanceEntry: { _id: response.id, ...balanceEntry },
    }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Get all balance sheet entries
function getAllBalanceSheets(db) {
  const types = ["asset", "liability", "equity"];
  
  return Promise.all(
    types.map(type =>
      db.find({
      selector: { 
          type: type,
        state: "Active"
}
      })
    )
  )
    .then(results => {
      // Combine all docs from different types into a single array
      const combinedDocs = results.reduce((acc, result) => {
        return [...acc, ...result.docs];
      }, []);
      
      return {
        success: true,
        balanceSheets: combinedDocs
      };
    })
    .catch(error => ({
      success: false,
      error: error.message
    }));
}

// Get a balance sheet entry by ID
function getBalanceSheetById(db, balanceSheetId) {
  return db
    .get(balanceSheetId)
    .then((balanceSheet) => ({ success: true, balanceSheet }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Update an existing balance sheet entry
function updateBalanceSheet(db, balanceSheetData) {
  const balanceSheet = {
    _id: balanceSheetData._id,
    type: "balanceSheet",
    state: "Active",
    ...balanceSheetData,
    updatedAt: new Date().toISOString()
  };

  return db
    .put(balanceSheet)
    .then((response) => ({
      success: true,
      balanceSheet: { _id: response.id, ...balanceSheet },
    }))
    .catch((error) => ({ success: false, error: error.message }));
}

// Archive a balance sheet entry (soft delete)
function archiveBalanceSheet(db, balanceSheetId) {
  return db
    .get(balanceSheetId)
    .then((balanceSheet) => {
      // Update the state field to "Inactive"
      balanceSheet.state = "Inactive";
      return db.put(balanceSheet);
    })
    .then(() => ({ success: true }))
    .catch((error) => ({ success: false, error: error.message }));
}

module.exports = {
  createBalanceSheetEntry,
  getAllBalanceSheets,
  getBalanceSheetById,
  updateBalanceSheet,
  archiveBalanceSheet,
};
