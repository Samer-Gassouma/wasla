import { app, BrowserWindow, Tray, Menu, nativeImage, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let tray: Tray | null = null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC!, 'icons', 'icon-256x256.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allow connections to local network IPs
    },
  })

  // Start fullscreen
  win.setFullScreen(true)

  // Minimize to tray behavior on close/minimize (Windows)
  win.on('minimize', (event: Electron.Event) => {
    event.preventDefault()
    win?.hide()
  })
  win.on('close', (event: Electron.Event) => {
    if (process.platform === 'win32') {
      event.preventDefault()
      win?.hide()
    }
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  // Disable web security for local network connections
  app.commandLine.appendSwitch('disable-web-security')
  app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor')
  
  createWindow()

  // Create tray icon
  const iconPath = path.join(process.env.VITE_PUBLIC!, 'icons', 'icon-256x256.png')
  const trayIcon = nativeImage.createFromPath(iconPath)
  tray = new Tray(trayIcon)
  tray.setToolTip('Wasla Choice')
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Afficher', click: () => { win?.show(); win?.focus(); } },
    { label: 'Quitter', click: () => { tray?.destroy(); app.quit(); } }
  ])
  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    win?.show()
    win?.focus()
  })

  // Auto-launch on Windows
  if (process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath,
      args: []
    })
  }

  // Auto-update: GitHub provider already configured by electron-builder
  try {
    autoUpdater.autoDownload = true
    autoUpdater.checkForUpdatesAndNotify()

    autoUpdater.on('update-available', () => {
      console.log('Update available')
    })
    autoUpdater.on('update-not-available', () => {
      console.log('No update available')
    })
    autoUpdater.on('error', (err: unknown) => {
      console.error('AutoUpdater error:', err)
    })
    autoUpdater.on('download-progress', (p: { percent: number }) => {
      console.log(`Download progress: ${Math.round(p.percent)}%`)
    })
    autoUpdater.on('update-downloaded', async () => {
      const res = await dialog.showMessageBox({
        type: 'question',
        buttons: ['Redémarrer maintenant', 'Plus tard'],
        defaultId: 0,
        cancelId: 1,
        message: 'Une mise à jour a été téléchargée. Redémarrer pour appliquer ?'
      })
      if (res.response === 0) {
        autoUpdater.quitAndInstall()
      }
    })
  } catch (e) {
    console.error('Failed to init autoUpdater', e)
  }
})
