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

  // Check for updates after window is created
  autoUpdater.checkForUpdatesAndNotify();
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

// Auto-updater events
autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update_available');
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update_downloaded');
});

// Create a menu template with a "Check for Updates" item
const createMenu = () => {
  const template = [
    {
      label: 'App',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => {
            autoUpdater.checkForUpdatesAndNotify();
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

app.on("ready", async () => {
  try {
    createWindow();
    createMenu();

    pouch = openPouchDB();
    console.log("PouchDB opened successfully");
    
    setupIpcHandlers(ipcMain, pouch);

    checkOnlineStatus();
    setInterval(checkOnlineStatus, 60000);

    require("electron").powerMonitor.on("suspend", checkOnlineStatus);
    require("electron").powerMonitor.on("resume", checkOnlineStatus);
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
ipcMain.on('restart_app', () => {
  autoUpdater.quitAndInstall();
});
