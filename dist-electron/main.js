import { app as t, BrowserWindow as c, nativeImage as m, Tray as f, Menu as u } from "electron";
import { fileURLToPath as h } from "node:url";
import o from "node:path";
const r = o.dirname(h(import.meta.url));
process.env.APP_ROOT = o.join(r, "..");
const i = process.env.VITE_DEV_SERVER_URL, T = o.join(process.env.APP_ROOT, "dist-electron"), l = o.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = i ? o.join(process.env.APP_ROOT, "public") : l;
let e, n = null;
function a() {
  e = new c({
    icon: o.join(process.env.VITE_PUBLIC, "icons", "icon-256x256.png"),
    webPreferences: {
      preload: o.join(r, "preload.mjs")
    }
  }), e.setFullScreen(!0), e.on("minimize", (s) => {
    s.preventDefault(), e == null || e.hide();
  }), e.on("close", (s) => {
    process.platform === "win32" && (s.preventDefault(), e == null || e.hide());
  }), e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), i ? e.loadURL(i) : e.loadFile(o.join(l, "index.html"));
}
t.on("window-all-closed", () => {
  process.platform !== "darwin" && (t.quit(), e = null);
});
t.on("activate", () => {
  c.getAllWindows().length === 0 && a();
});
t.whenReady().then(() => {
  a();
  const s = o.join(process.env.VITE_PUBLIC, "icons", "icon-256x256.png"), p = m.createFromPath(s);
  n = new f(p), n.setToolTip("Wasla Choice");
  const d = u.buildFromTemplate([
    { label: "Afficher", click: () => {
      e == null || e.show(), e == null || e.focus();
    } },
    { label: "Quitter", click: () => {
      n == null || n.destroy(), t.quit();
    } }
  ]);
  n.setContextMenu(d), n.on("click", () => {
    e == null || e.show(), e == null || e.focus();
  }), process.platform === "win32" && t.setLoginItemSettings({
    openAtLogin: !0,
    path: process.execPath,
    args: []
  });
});
export {
  T as MAIN_DIST,
  l as RENDERER_DIST,
  i as VITE_DEV_SERVER_URL
};
