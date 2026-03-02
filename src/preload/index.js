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
  sessionHistoryFull: ()                         => ipcRenderer.invoke('session:historyFull'),
  refreshSession:    (userId)                    => ipcRenderer.invoke('session:refresh', userId),

  // Credits
  getCredits:        (userId)                    => ipcRenderer.invoke('credits:get', userId),
  addCredits:        (userId, amount, note)       => ipcRenderer.invoke('credits:add', userId, amount, note),

  // Games
  scanGames:         ()                          => ipcRenderer.invoke('games:scan'),
  scanPlatform:      (platform)                  => ipcRenderer.invoke('games:platform', platform),
  launchGame:        (gameId, platform)          => ipcRenderer.invoke('games:launch', gameId, platform),
  launchPlatform:    (platform)                  => ipcRenderer.invoke('games:launchPlatform', platform),
  checkGamePath:     (gamePath)                  => ipcRenderer.invoke('games:checkPath', gamePath),

  // Cafe Library
  getCafeGames:      ()                          => ipcRenderer.invoke('cafe:getGames'),
  addCafeGame:       (gameId, platform, name)    => ipcRenderer.invoke('cafe:addGame', gameId, platform, name),
  removeCafeGame:    (gameId, platform)          => ipcRenderer.invoke('cafe:removeGame', gameId, platform),
  // Featured games
  getFeaturedGames:   ()                          => ipcRenderer.invoke('featured:get'),
  setFeaturedGame:    (gameId, platform, pos)     => ipcRenderer.invoke('featured:set', gameId, platform, pos),
  removeFeaturedGame: (gameId, platform)          => ipcRenderer.invoke('featured:remove', gameId, platform),
  // Age restrictions
  setUserAgeRestriction: (userId, under18)        => ipcRenderer.invoke('admin:setUserAgeRestriction', userId, under18),
  setCafeGameRating:  (gameId, platform, rating)  => ipcRenderer.invoke('admin:setCafeGameRating', gameId, platform, rating),
  getCafeGamesWithRatings: ()                     => ipcRenderer.invoke('admin:cafeGamesWithRatings'),

  // Admin
  verifyAdmin:       (pin)                       => ipcRenderer.invoke('admin:verify', pin),
  listUsers:         ()                          => ipcRenderer.invoke('admin:users'),
  createUser:        (username, pin, display)    => ipcRenderer.invoke('admin:create', username, pin, display),
  openSettings:      ()                          => ipcRenderer.invoke('admin:openSettings'),
  backupDb:          ()                          => ipcRenderer.invoke('admin:backup'),
  launchDesktop:     ()                          => ipcRenderer.invoke('admin:launchDesktop'),
  launchTerminal:    ()                          => ipcRenderer.invoke('admin:launchTerminal'),
})
