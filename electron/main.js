const { app, BrowserWindow, protocol, ipcMain, net, dialog } = require("electron");
const path = require("path");
const { openPouchDB } = require("./pouchSync");
const setupIpcHandlers = require("./ipcHandlers");
const { autoUpdater } = require("electron-updater");
const log = require('electron-log');

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
      // Consider adding a save prompt or autosave feature here
      autoUpdater.quitAndInstall();
    }
  } catch (error) {
    log.error('Error showing update dialog:', error);
  }
});

app.on("ready", async () => {
  try {
    createWindow();

    pouch = openPouchDB();
    console.log("PouchDB opened successfully");
    
    setupIpcHandlers(ipcMain, pouch);

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
