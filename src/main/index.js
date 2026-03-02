const { app, BrowserWindow, protocol, net, globalShortcut } = require('electron')
const path = require('path')
const url  = require('url')
const registerIpc = require('./ipc')
const logger = require('./logger')

// F-49: redirect console.* to rotating log file before anything else
logger.init()

// Prevent multiple instances in kiosk mode
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) { app.quit(); process.exit(0) }

let mainWindow  = null
let appQuitting = false   // true only when explicitly quitting (not when platform steals screen)

function getMainWindow() { return mainWindow }

function createWindow() {
  mainWindow = new BrowserWindow({
    kiosk:           process.env.KIOSK_E2E_TEST !== '1',   // F-09/F-25/F-26: OS-level fullscreen kiosk; blocks Alt+Tab, Win+D, task switcher
    frame:           false,
    backgroundColor: '#0d1117',
    webPreferences: {
      preload:          path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
  })

  // Suppress in-window navigation / opening new windows
  mainWindow.webContents.on('will-navigate', (e, targetUrl) => {
    if (!targetUrl.startsWith('file://') && !targetUrl.startsWith('http://localhost')) {
      e.preventDefault()
    }
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  // Prevent the window from closing unless we initiated the quit.
  // This stops Steam/Epic fullscreen from killing the kiosk process.
  mainWindow.on('close', (e) => {
    if (!appQuitting) {
      e.preventDefault()
      mainWindow.minimize()
    }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    if (process.env.KIOSK_E2E_TEST !== '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Register kiosk-resource:// protocol to serve bundled images
  protocol.handle('kiosk-resource', (request) => {
    const filePath = request.url.replace('kiosk-resource://', '')
    const absPath  = path.join(
      app.isPackaged ? process.resourcesPath : path.join(app.getAppPath(), 'resources'),
      filePath
    )
    return net.fetch(url.pathToFileURL(absPath).toString())
  })

  // T-21: register as Windows startup item (packaged mode only)
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: true, name: 'Gaming Cafe Kiosk' })
  }

  registerIpc()
  createWindow()

  // F-09/F-25: block Task Manager and Win+D as a second layer even in kiosk mode
  // Skipped in test mode (Linux runners don't have these keys anyway)
  if (process.env.KIOSK_E2E_TEST !== '1') {
    app.on('browser-window-focus', () => {
      try {
        globalShortcut.registerAll(
          ['Control+Shift+Escape', 'Super+D', 'Super+KeyD'],
          () => {}
        )
      } catch { /* ignore: some platforms reject unknown accelerators */ }
    })
    app.on('browser-window-blur', () => {
      globalShortcut.unregisterAll()
    })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  appQuitting = true
  // T-08: always end active session on quit so DB is not left with orphaned session
  try {
    const db   = require('./db')
    const user = db.getCurrentUser()
    if (user) {
      const sess = db.getActiveSession(user.id)
      if (sess) db.endSession(sess.id)
      db.clearCurrentUser()
    }
  } catch { /* best-effort */ }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Re-focus if a second instance tries to open
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

module.exports = { getMainWindow }

