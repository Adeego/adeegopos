// pouchSync.js

const PouchDB = require("pouchdb");
const { ipcMain } = require('electron');
PouchDB.plugin(require("pouchdb-find"));

const COUCHDB_URL = "http://admin:Adeego2025@64.227.129.110:5984//adeegopos";

let localDB;
let currentStoreNo = null;
let syncHandler;

function openPouchDB() {
  localDB = new PouchDB("adeegopos");
  setupStoreNoListener();
  return localDB;
}

function setupIndexes() {
  // Define the index fields for products
  const productIndexFields = ['name', 'state', 'type'];
  // Define the index fields for customers
  const customerIndexFields = ['name', 'phoneNumber', 'state', 'type', 'createdAt'];
  // Define the index fields for general use
  const generalIndexFields = ['createdAt', 'type', 'state'];

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

  // Check if the general index already exists
  localDB.getIndexes().then((result) => {
    const generalIndexExists = result.indexes.some(index => 
      index.def && index.def.fields && index.def.fields.length === generalIndexFields.length &&
      index.def.fields.every((field, i) => field === generalIndexFields[i])
    );

    if (!generalIndexExists) {
      // Create the general index if it does not exist
      return localDB.createIndex({
        index: {
          fields: generalIndexFields
        }
      }).then(() => {
        console.log('General index created successfully');
      }).catch((error) => {
        console.error('Error creating general index:', error);
      });
    } else {
      console.log('General index already exists');
    }
  }).catch((error) => {
    console.error('Error checking general indexes:', error);
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
        // Setup indexes
        await setupIndexes();
        console.log("Indexes set up successfully");

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
