import { app, BrowserWindow, nativeImage, Tray, Menu } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
let tray = null;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "icons", "icon-256x256.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs")
    }
  });
  win.setFullScreen(true);
  win.on("minimize", (event) => {
    event.preventDefault();
    win == null ? void 0 : win.hide();
  });
  win.on("close", (event) => {
    if (process.platform === "win32") {
      event.preventDefault();
      win == null ? void 0 : win.hide();
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  createWindow();
  const iconPath = path.join(process.env.VITE_PUBLIC, "icons", "icon-256x256.png");
  const trayIcon = nativeImage.createFromPath(iconPath);
  tray = new Tray(trayIcon);
  tray.setToolTip("Wasla Choice");
  const contextMenu = Menu.buildFromTemplate([
    { label: "Afficher", click: () => {
      win == null ? void 0 : win.show();
      win == null ? void 0 : win.focus();
    } },
    { label: "Quitter", click: () => {
      tray == null ? void 0 : tray.destroy();
      app.quit();
    } }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    win == null ? void 0 : win.show();
    win == null ? void 0 : win.focus();
  });
  if (process.platform === "win32") {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath,
      args: []
    });
  }
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
