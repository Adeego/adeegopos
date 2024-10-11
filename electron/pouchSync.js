// pouchSync.js

const PouchDB = require("pouchdb");
const { ipcMain } = require('electron');
PouchDB.plugin(require("pouchdb-find"));

const COUCHDB_URL = "http://admin:Adeego2025@127.0.0.1:5984/adeegopos";

let localDB;
let currentStoreNo = null;
let syncHandler; // New line added as suggested

function openPouchDB(initialStoreNo = null) {
  localDB = new PouchDB("adeegopos");
  currentStoreNo = initialStoreNo;

  setupIndexes();
  setupSync();
  setupStoreNoListener();
  return localDB;
}

function setupIndexes() {
  // Define the index fields for products
  const productIndexFields = ['name', 'state', 'type'];
  // Define the index fields for customers
  const customerIndexFields = ['name', 'phoneNumber', 'state', 'type', 'createdAt'];

  // Check if the product index already exists
  localDB.getIndexes().then((result) => {
    const productIndexExists = result.indexes.some(index => 
      index.def && index.def.fields && index.def.fields.length === productIndexFields.length &&
      index.def.fields.every((field, i) => field === productIndexFields[i])
    );

    if (!productIndexExists) {
      // Create the product index if it does not exist
      return localDB.createIndex({
        index: {
          fields: productIndexFields
        }
      }).then(() => {
        console.log('Product index created successfully');
      }).catch((error) => {
        console.error('Error creating product index:', error);
      });
    } else {
      console.log('Product index already exists');
    }
  }).catch((error) => {
    console.error('Error checking product indexes:', error);
  });

  // Check if the customer index already exists
  localDB.getIndexes().then((result) => {
    const customerIndexExists = result.indexes.some(index => 
      index.def && index.def.fields && index.def.fields.length === customerIndexFields.length &&
      index.def.fields.every((field, i) => field === customerIndexFields[i])
    );

    if (!customerIndexExists) {
      // Create the customer index if it does not exist
      return localDB.createIndex({
        index: {
          fields: customerIndexFields
        }
      }).then(() => {
        console.log('Customer index created successfully');
      }).catch((error) => {
        console.error('Error creating customer index:', error);
      });
    } else {
      console.log('Customer index already exists');
    }
  }).catch((error) => {
    console.error('Error checking customer indexes:', error);
  });
}

function setupSync() {
  if (currentStoreNo) {
    // Cancel existing sync if it exists
    if (syncHandler) {
      syncHandler.cancel();
    }

    // Start new sync
    syncHandler = localDB.sync(`${COUCHDB_URL}?partition=${currentStoreNo}`, {
        live: true,
        retry: true,
        filter: function (doc) {
          return doc._id.startsWith(`${currentStoreNo}:`);
        }
      })
      .on("change", function (info) {
        console.log("Sync change:", info);
      })
      .on("error", function (err) {
        console.error("Sync error:", err);
      });
  } else {
    console.log("No storeNo provided, sync not started");
  }
}

function setupStoreNoListener() {
  ipcMain.on("send-storeNo", async (event, newStoreNo) => {
    if (currentStoreNo !== newStoreNo) {
      console.log("Received new storeNo:", newStoreNo);
      currentStoreNo = newStoreNo;

      try {
        // Setup new sync with new storeNo
        setupSync();

        console.log("Database updated with new storeNo");
        event.reply("storeNo-update-status", { success: true });
      } catch (error) {
        console.error("Error updating storeNo in database:", error);
        event.reply("storeNo-update-status", { success: false, error: error.message });
      }
    } else {
      console.log("Received same storeNo, no update needed");
      event.reply("storeNo-update-status", { success: true, noChange: true });
    }
  });
}

module.exports = {
  openPouchDB,
};
