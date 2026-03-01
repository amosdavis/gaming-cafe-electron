const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('kiosk', {
  // Auth
  login:             (username, pin)            => ipcRenderer.invoke('auth:login', username, pin),
  logout:            ()                          => ipcRenderer.invoke('auth:logout'),
  getOrStartSession: (userId)                    => ipcRenderer.invoke('auth:getOrStartSession', userId),
  currentUser:       ()                          => ipcRenderer.invoke('auth:currentUser'),

  // Session
  getActiveSession:  (userId)                    => ipcRenderer.invoke('session:getActive', userId),
  endSession:        ()                          => ipcRenderer.invoke('session:end'),
  sessionHistory:    ()                          => ipcRenderer.invoke('session:history'),

  // Credits
  getCredits:        (userId)                    => ipcRenderer.invoke('credits:get', userId),
  addCredits:        (userId, amount, note)       => ipcRenderer.invoke('credits:add', userId, amount, note),

  // Games
  scanGames:         ()                          => ipcRenderer.invoke('games:scan'),
  scanPlatform:      (platform)                  => ipcRenderer.invoke('games:platform', platform),
  launchGame:        (gameId, platform)          => ipcRenderer.invoke('games:launch', gameId, platform),

  // Cafe Library
  getCafeGames:      ()                          => ipcRenderer.invoke('cafe:getGames'),
  addCafeGame:       (gameId, platform, name)    => ipcRenderer.invoke('cafe:addGame', gameId, platform, name),
  removeCafeGame:    (gameId, platform)          => ipcRenderer.invoke('cafe:removeGame', gameId, platform),

  // Admin
  verifyAdmin:       (pin)                       => ipcRenderer.invoke('admin:verify', pin),
  listUsers:         ()                          => ipcRenderer.invoke('admin:users'),
  createUser:        (username, pin, display)    => ipcRenderer.invoke('admin:create', username, pin, display),
  openSettings:      ()                          => ipcRenderer.invoke('admin:openSettings'),
})
