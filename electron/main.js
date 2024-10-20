const { app, BrowserWindow, protocol, ipcMain, net, Menu } = require("electron");
const path = require("path");
const { openPouchDB } = require("./pouchSync");
const setupIpcHandlers = require("./ipcHandlers");
const { autoUpdater } = require("electron-updater");

let serve;
let pouch;
let mainWindow;

// Disable hardware acceleration
app.disableHardwareAcceleration();

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
      mainWindow.webContents.reloadIgnoringCache();
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

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    sendStatusToWindow('Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    sendStatusToWindow('Update available.');
    mainWindow.webContents.send('update-available', info);
  });

  autoUpdater.on('update-not-available', (info) => {
    sendStatusToWindow('Update not available.');
    mainWindow.webContents.send('update-not-available', info);
  });

  autoUpdater.on('error', (err) => {
    sendStatusToWindow('Error in auto-updater. ' + err);
    mainWindow.webContents.send('update-error', err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    sendStatusToWindow(log_message);
    mainWindow.webContents.send('download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendStatusToWindow('Update downloaded');
    mainWindow.webContents.send('update-downloaded', info);
  });
}

function sendStatusToWindow(text) {
  console.log(text);
  mainWindow.webContents.send('update-message', text);
}

app.on("ready", async () => {
  try {
    createWindow();

    pouch = openPouchDB();
    console.log("PouchDB opened successfully");
    
    setupIpcHandlers(ipcMain, pouch);
    setupAutoUpdater();

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

app.on("before-quit", async (event) => {
  event.preventDefault();

  if (pouch && !pouch.isClosed) {
    console.log("Closing Realm...");
    pouch.close();
  }

  console.log("Pouch closed. Quitting app...");
  app.exit(0);
});

// IPC handlers for auto-update
ipcMain.handle('check-for-updates', () => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdates();
  }
});

ipcMain.handle('download-update', () => {
  autoUpdater.downloadUpdate();
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});
