const { app, BrowserWindow, protocol, ipcMain, net } = require("electron");
const path = require("path");
const { openRealmWithSync } = require('./realmSync');
const setupIpcHandlers = require('./ipcHandlers');

let serve;
let realm
let mainWindow;

if (app.isPackaged) {
  (async () => {
    const { default: serveFunc } = await import("electron-serve");
    serve = serveFunc({
      directory: path.join(__dirname, "../out")
    });

    protocol.registerSchemesAsPrivileged([
      { scheme: 'app', privileges: { secure: true, standard: true } }
    ]);
  })();
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  if (app.isPackaged) {
    serve(mainWindow).then(() => {
      mainWindow.loadURL("app://-");
    }).catch(console.error);
  } else {
    mainWindow.loadURL("http://localhost:3333");
    mainWindow.webContents.openDevTools();
    mainWindow.webContents.on("did-fail-load", () => {
      mainWindow.webContents.reloadIgnoringCache();
    });
    checkOnlineStatus();
  }  
}

function checkNetworkConnection() {
  return new Promise((resolve) => {
    const request = net.request('https://www.google.com');
    request.on('response', () => {
      resolve(true);
    });
    request.on('error', () => {
      resolve(false);
    });
    request.end();
  });
}

async function checkOnlineStatus() {
  const online = await checkNetworkConnection();
  mainWindow.webContents.send('online-status-changed', online);
}

app.on("ready", async () => {
  try {
    // Import schemas dynamically
    // const { CustomerSchema, ProductSchema, ProductVariantSchema, SupplierSchema, SaleSchema, StaffSchema } = require('./database/schemas');
    realm = await openRealmWithSync();
    console.log("Realm opened with sync successfully");
    setupIpcHandlers(ipcMain, realm);
    createWindow();

    setInterval(checkOnlineStatus, 60000);

    // Add these lines to check status on network change
    require('electron').powerMonitor.on('suspend', checkOnlineStatus);
    require('electron').powerMonitor.on('resume', checkOnlineStatus);
  } catch (error) {
    console.error("Failed to open Realm with sync:", error);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  event.preventDefault(); // Prevent the app from quitting immediately
  
  if (realm && !realm.isClosed) {
    console.log("Closing Realm...");
    realm.close();
  }
  
  console.log("Realm closed. Quitting app...");
  app.exit(0); // Force quit the app
});