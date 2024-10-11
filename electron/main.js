const { app, BrowserWindow, protocol, ipcMain, net } = require("electron");
const path = require("path");
const { openPouchDB } = require("./pouchSync");
const setupIpcHandlers = require("./ipcHandlers");

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
    fullscreen: false, // Set to false to enable title bar
    frame: true, // Show the title bar and window controls
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      // nodeIntegration: true,   // Important for using Node.js modules like PouchDB
    },
  });

  // Optionally, you can set the window to be maximized to use all available screen space
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

app.on("ready", async () => {
  try {
    createWindow();

    // Initialize PouchDB without storeNo
    pouch = openPouchDB();  // Pass null initially
    console.log("PouchDB opened successfully");
    
    // Set up IPC handlers after PouchDB is initialized
    setupIpcHandlers(ipcMain, pouch);

    // Start checking online status only after IPC handlers are set up
    checkOnlineStatus(); // Initial check
    setInterval(checkOnlineStatus, 60000);

    // Add these lines to check status on network change
    require("electron").powerMonitor.on("suspend", checkOnlineStatus);
    require("electron").powerMonitor.on("resume", checkOnlineStatus);
  } catch (error) {
    console.error("Failed to open PouchDB:", error);
    app.quit();
  }
});

app.on("before-quit", async (event) => {
  event.preventDefault(); // Prevent the app from quitting immediately

  if (pouch && !pouch.isClosed) {
    console.log("Closing Realm...");
    pouch.close();
  }

  console.log("Pouch closed. Quitting app...");
  app.exit(0); // Force quit the app
});
