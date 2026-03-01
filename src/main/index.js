const { app, BrowserWindow, protocol, net } = require('electron')
const path = require('path')
const url  = require('url')
const registerIpc = require('./ipc')

// Prevent multiple instances in kiosk mode
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) { app.quit(); process.exit(0) }

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    fullscreen:      true,
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

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools({ mode: 'detach' })
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

  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
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
