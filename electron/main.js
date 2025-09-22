const { app, BrowserWindow, protocol, ipcMain, net, dialog } = require("electron");
const path = require("path");
const dotenv = require('dotenv');

// Load environment variables
if (app.isPackaged) {
  dotenv.config({ path: path.join(process.resourcesPath, '.env') });
} else {
  dotenv.config();
}
const { openPouchDB } = require("./pouchSync");
const setupIpcHandlers = require("./ipcHandlers");
const { autoUpdater } = require("electron-updater");
const fs = require('fs');
const { execSync } = require('child_process');
const escpos = require('escpos');
escpos.Network = require('escpos-network');
const Evilscan = require('evilscan');

let serve;
let pouch;
let mainWindow;
let printer; // Store printer connection

// Disable hardware acceleration
app.disableHardwareAcceleration();

let device;
const PRINTER_PORT = 9100;

async function findAndConnectPrinter() {
  return new Promise((resolve, reject) => {
    const options = {
      target: '192.168.8.0/24', // Assuming a common subnet, adjust if necessary
      port: String(PRINTER_PORT),
      status: 'O', // Look for open ports
    };

    const scanner = new Evilscan(options);
    let found = false;

    scanner.on('result', (data) => {
      if (data.status === 'open' && !found) {
        found = true; // Prevent multiple connections from the same scan
        console.log(`Found printer at ${data.ip}:${data.port}`);
        device = new escpos.Network(data.ip, data.port);
        const printerOptions = { encoding: "GB18030" };
        printer = new escpos.Printer(device, printerOptions);
        global.printer = { printer, device };
        console.log('Printer connected successfully');
        scanner.abort(); // Stop scanning once found
        resolve();
      }
    });

    scanner.on('error', (err) => {
      reject(new Error(`Network scan error: ${err.toString()}`));
    });

    scanner.on('done', () => {
      if (!found) {
        reject(new Error('No open printer port found on the network.'));
      }
    });

    console.log('Scanning for network printer...');
    scanner.run();
  });
}

async function connectPrinterWithRetry(retries = 3, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      await findAndConnectPrinter();
      return; // Success
    } catch (error) {
      console.error(`Printer connection attempt ${i + 1} failed:`, error.message);
      if (i < retries - 1) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise(res => setTimeout(res, delay));
      } else {
        console.error('All printer connection attempts failed.');
        if (mainWindow) {
          mainWindow.webContents.send('printer-status', { connected: false, error: 'All connection attempts failed' });
        }
      }
    }
  }
}

if (app.isPackaged) {
  (async () => {
    const { default: serveFunc } = await import("electron-serve");
    serve = serveFunc({
      directory: path.join(__dirname, "../out"),
    });

    protocol.registerSchemesAsPrivileged([
      { scheme: "app", privileges: { secure: true, standard: true } },
    ]);
  })();
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    fullscreen: false,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.maximize();

  mainWindow.once("ready-to-show", () => {
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools();
    }
  });

  if (app.isPackaged) {
    serve(mainWindow)
      .then(() => {
        mainWindow.loadURL("app://-");
      })
      .catch(console.error);
  } else {
    mainWindow.loadURL("http://localhost:3333");
    mainWindow.webContents.on("did-fail-load", () => {
      console.log('Failed to load dev server, retrying in 1 second...');
      setTimeout(() => {
        mainWindow.webContents.reloadIgnoringCache();
      }, 1000);
    });
    checkOnlineStatus();
  }
};

function checkNetworkConnection() {
  return new Promise((resolve) => {
    const request = net.request("https://www.google.com");
    request.on("response", () => {
      resolve(true);
    });
    request.on("error", () => {
      resolve(false);
    });
    request.end();
  });
}

async function checkOnlineStatus() {
  const online = await checkNetworkConnection();
  mainWindow.webContents.send("online-status-changed", online);
}

autoUpdater.on("update-available", (_event, releaseNotes, releaseName) => {
  const dialogOpts = {
     type: 'info',
     buttons: ['Ok'],
     title: 'Update Available',
     message: process.platform === 'win32' ? releaseNotes : releaseName,
     detail: 'A new version download started. The app will be restarted to install the update.'
  };
  dialog.showMessageBox(dialogOpts);
});

autoUpdater.on("update-downloaded", async (_event, releaseNotes, releaseName) => {
  const dialogOpts = {
    type: 'info',
    buttons: ['Restart', 'Later'],
    title: 'Application Update',
    message: process.platform === 'win32' ? releaseNotes : releaseName,
    detail: 'A new version has been downloaded. Restart the application to apply the updates.'
  };
  try {
    const returnValue = await dialog.showMessageBox(dialogOpts);
    if (returnValue.response === 0) {
      // Prepare for update
      prepareForUpdate();
    }
  } catch (error) {
    autoUpdater.logger.error('Error showing update dialog:', error);
  }
});

autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'debug';

// Ensure proper permissions for auto-updater
function ensureAutoUpdaterPermissions() {
  const appUpdateDir = path.join(app.getPath('userData'), 'update');
  try {
    if (!fs.existsSync(appUpdateDir)) {
      fs.mkdirSync(appUpdateDir, { recursive: true });
    }
    fs.accessSync(appUpdateDir, fs.constants.W_OK);
    
    // Grant full control to Users group
    if (process.platform === 'win32') {
      execSync(`icacls "${appUpdateDir}" /grant Users:F /T`);
    }
  } catch (err) {
    autoUpdater.logger.error('Error ensuring auto-updater permissions:', err);
    dialog.showErrorBox('Update Error', 'Unable to access the update directory. Please run the application as an administrator.');
  }
}

function prepareForUpdate() {
  // Close all windows
  BrowserWindow.getAllWindows().forEach(window => {
    window.close();
  });

  // Close PouchDB
  if (pouch && !pouch.isClosed) {
    console.log("Closing PouchDB...");
    pouch.close();
  }

  // Close printer connection
  if (printer) {
    try {
      device.close();
      console.log("Printer connection closed");
    } catch (error) {
      console.error("Error closing printer connection:", error);
    }
  }

  // Set a flag to prevent the app from restarting
  app.isQuitting = true;

  // Wait a bit to ensure everything is closed, then quit and install
  setTimeout(() => {
    app.quit();
    autoUpdater.quitAndInstall(false, true);
  }, 2000);
}

app.on("ready", async () => {
  try {
    ensureAutoUpdaterPermissions();
    createWindow();

    pouch = openPouchDB();
    console.log("PouchDB opened successfully");

    setupIpcHandlers(ipcMain, pouch, mainWindow);

    // Connect to printer with retry logic
    await connectPrinterWithRetry();

    checkOnlineStatus();
    setInterval(checkOnlineStatus, 60000);

    require("electron").powerMonitor.on("suspend", checkOnlineStatus);
    require("electron").powerMonitor.on("resume", checkOnlineStatus);

    // Check for updates on app start
    if (app.isPackaged) {
      autoUpdater.checkForUpdates();
    }
  } catch (error) {
    console.error("Failed to open PouchDB:", error);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !app.isQuitting) {
    app.quit();
  }
});

app.on("before-quit", async (event) => {
  if (!app.isQuitting) {
    event.preventDefault();

    // Close printer connection
    if (printer) {
      try {
        device.close();
        console.log("Printer connection closed");
      } catch (error) {
        console.error("Error closing printer connection:", error);
      }
    }

    if (pouch && !pouch.isClosed) {
      console.log("Closing PouchDB...");
      pouch.close();
    }

    console.log("PouchDB closed. Quitting app...");
    app.exit(0);
  }
});
