const { app, BrowserWindow, protocol } = require("electron");
const path = require("path");

let serve;
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
  const win = new BrowserWindow({
    width: 1200,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  if (app.isPackaged) {
    serve(win).then(() => {
      win.loadURL("app://-");
    }).catch(console.error);
  } else {
    win.loadURL("http://localhost:3000");
    win.webContents.openDevTools();
    win.webContents.on("did-fail-load", (e, code, desc) => {
      win.webContents.reloadIgnoringCache();
    });
  }
}

app.on("ready", () => {
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
