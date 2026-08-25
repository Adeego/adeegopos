// pouchSync.js

const PouchDB = require("pouchdb");
const { ipcMain, app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
PouchDB.plugin(require("pouchdb-find"));

let localDB;
let currentStoreNo = null;
let syncHandler;
let syncStatus = {
  state: 'idle',
  isSyncing: false,
  storeNo: null,
  direction: null,
  lastChangeAt: null,
  lastSuccessAt: null,
  error: null,
};

function getCouchDbUrl() {
  const configuredUrl = process.env.ADEEGO_COUCHDB_URL || process.env.COUCHDB_URL || '';
  return configuredUrl.trim().replace(/\/+$/, '');
}

function getSyncStatus() {
  return { ...syncStatus };
}

function publishSyncStatus(patch = {}) {
  syncStatus = {
    ...syncStatus,
    ...patch,
    storeNo: currentStoreNo,
  };

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('sync-status-changed', getSyncStatus());
    }
  }
}

function getChangedDocs(info = {}) {
  return Array.isArray(info.change?.docs) ? info.change.docs : [];
}

function openPouchDB() {
  const dbPath = path.join(app.getPath('userData'), 'database', 'adeegopos');
  
  // Ensure the database directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('Created database directory:', dbDir);
  }
  
  localDB = new PouchDB(dbPath, { auto_compaction: true });
  setupStoreNoListener();
  return localDB;
}

function setupIndexes() {
  // Define the index fields for products - Optimized for store-first filtering
  const productIndexFields = ['storeNo', 'type', 'state', 'name'];
  // Define the index fields for customers
  const customerIndexFields = ['name', 'phoneNumber', 'state', 'type', 'createdAt', 'storeNo'];
  // Define the index fields for general use
  const generalIndexFields = ['createdAt', 'type', 'state', 'storeNo'];

  const specificIdIndexFields = ['type', 'state', '_id', 'createdAt', 'storeNo'];
  const salesHistoryIndexFields = ['storeNo', 'type', 'state', 'createdAt'];
  const transactionHistoryIndexFields = ['storeNo', 'type', 'state', 'createdAt'];
  const customerActivityIndexes = [
    ['customer-sales-original', 'customer-sales-original-index', ['storeNo', 'type', 'state', 'customerId', 'createdAt']],
    ['customer-sales-current', 'customer-sales-current-index', ['storeNo', 'type', 'state', 'currentCustomerId', 'createdAt']],
    ['customer-transactions-from', 'customer-transactions-from-index', ['storeNo', 'type', 'state', 'from', 'createdAt']],
    ['customer-transactions-to', 'customer-transactions-to-index', ['storeNo', 'type', 'state', 'to', 'createdAt']],
    ['customer-ledger', 'customer-ledger-index', ['storeNo', 'type', 'state', 'entityType', 'entityId', 'bucket', 'createdAt']],
  ];

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

  // Check if the specific ID index already exists
  localDB.getIndexes().then((result) => {
    const specificIdIndexExists = result.indexes.some(index => 
      index.def && index.def.fields && index.def.fields.length === specificIdIndexFields.length &&
      index.def.fields.every((field, i) => field === specificIdIndexFields[i])
    );

    if (!specificIdIndexExists) {
      // Create the specific ID index if it does not exist
      return localDB.createIndex({
        index: {
          fields: specificIdIndexFields
        }
      }).then(() => {
        console.log('Specific ID index created successfully');
      }).catch((error) => {
        console.error('Error creating specific ID index:', error);
      });
    } else {
      console.log('Specific ID index already exists');
    }
  }).catch((error) => {
    console.error('Error checking specific ID indexes:', error);
  });

  localDB.getIndexes().then((result) => {
    const salesHistoryIndexExists = result.indexes.some(index => index.name === 'sales-history-index');

    if (!salesHistoryIndexExists) {
      return localDB.createIndex({
        index: { fields: salesHistoryIndexFields },
        ddoc: 'sales-history',
        name: 'sales-history-index',
      }).then(() => {
        console.log('Sales history index created successfully');
      }).catch((error) => {
        console.error('Error creating sales history index:', error);
      });
    }

    console.log('Sales history index already exists');
  }).catch((error) => {
    console.error('Error checking sales history indexes:', error);
  });

  localDB.getIndexes().then((result) => {
    const transactionHistoryIndexExists = result.indexes.some(index => index.name === 'transaction-history-index');

    if (!transactionHistoryIndexExists) {
      return localDB.createIndex({
        index: { fields: transactionHistoryIndexFields },
        ddoc: 'transaction-history',
        name: 'transaction-history-index',
      }).then(() => {
        console.log('Transaction history index created successfully');
      }).catch((error) => {
        console.error('Error creating transaction history index:', error);
      });
    }

    console.log('Transaction history index already exists');
  }).catch((error) => {
    console.error('Error checking transaction history indexes:', error);
  });

  localDB.getIndexes().then((result) => Promise.all(customerActivityIndexes.map(([ddoc, name, fields]) => {
    if (result.indexes.some((index) => index.name === name)) {
      return null;
    }

    return localDB.createIndex({
      index: { fields },
      ddoc,
      name,
    });
  }))).then(() => {
    console.log('Customer activity indexes ready');
  }).catch((error) => {
    console.error('Error setting up customer activity indexes:', error);
  });
}

function setupSync() {
  if (!currentStoreNo) {
    console.log("No storeNo provided, sync not started");
    publishSyncStatus({ state: 'idle', isSyncing: false, error: null });
    return;
  }

  if (syncHandler) {
    syncHandler.cancel();
    syncHandler = null;
  }

  const couchDbUrl = getCouchDbUrl();
  if (!couchDbUrl) {
    const error = 'ADEEGO_COUCHDB_URL is not configured; remote synchronization is disabled.';
    console.error(error);
    publishSyncStatus({ state: 'error', isSyncing: false, error });
    return;
  }

  const storePrefix = `${currentStoreNo}:`;
  publishSyncStatus({
    state: 'connecting',
    isSyncing: true,
    direction: null,
    error: null,
  });

  syncHandler = localDB.sync(couchDbUrl, {
    live: true,
    retry: true,
    selector: {
      _id: {
        $gte: storePrefix,
        $lt: `${storePrefix}\ufff0`,
      },
    },
  })
    .on('active', () => {
      publishSyncStatus({ state: 'active', isSyncing: true, error: null, salesChanged: false });
    })
    .on('paused', (error) => {
      if (error) {
        publishSyncStatus({
          state: 'error',
          isSyncing: false,
          error: error.message || String(error),
        });
        return;
      }

      publishSyncStatus({
        state: 'up-to-date',
        isSyncing: false,
        lastSuccessAt: new Date().toISOString(),
        error: null,
        salesChanged: false,
      });
    })
    .on('change', (info) => {
      const changedDocs = getChangedDocs(info);
      const pulledSalesChanged = info.direction === 'pull'
        && changedDocs.some((doc) => doc.type === 'sale');

      console.log(`Sync ${info.direction || 'change'}: ${changedDocs.length} document(s)`);
      publishSyncStatus({
        state: 'active',
        isSyncing: true,
        direction: info.direction || null,
        lastChangeAt: new Date().toISOString(),
        lastSuccessAt: new Date().toISOString(),
        error: null,
        salesChanged: pulledSalesChanged,
        docsChanged: changedDocs.length,
      });
    })
    .on('denied', (error) => {
      console.error('Sync denied:', error);
      publishSyncStatus({
        state: 'denied',
        isSyncing: false,
        error: error?.message || error?.reason || String(error),
      });
    })
    .on('error', (error) => {
      console.error('Sync error:', error);
      publishSyncStatus({
        state: 'error',
        isSyncing: false,
        error: error.message || String(error),
      });
    });
}

function setupStoreNoListener() {
  ipcMain.on("send-storeNo", async (event, newStoreNo) => {
    if (currentStoreNo !== newStoreNo) {
      console.log("Received new storeNo:", newStoreNo);
      currentStoreNo = newStoreNo;

      try {
        // Setup indexes
        setupIndexes();
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
  getCurrentStoreNo: () => currentStoreNo,
  getSyncStatus,
};
