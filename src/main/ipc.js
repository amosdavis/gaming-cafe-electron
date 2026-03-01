const { ipcMain } = require('electron')
const db          = require('./db')
const scanner     = require('./scanner')
const launcher    = require('./launcher')

// T-09: wrap every handler so errors return { ok:false } instead of crashing renderer
const handle = (channel, fn) => {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      const result = await fn(event, ...args)
      return result
    } catch (err) {
      console.error(`[IPC] ${channel} failed:`, err)
      return { ok: false, error: err?.message ?? String(err) }
    }
  })
}

module.exports = function registerIpc() {

  // ── Auth ──────────────────────────────────────────────────────────────────

  handle('auth:login', (_, username, pin) => {
    const user = db.login(username, pin)
    if (!user) return { ok: false, error: 'Incorrect username or PIN.' }
    db.setCurrentUser(user.id)
    return { ok: true, user }
  })

  handle('auth:getOrStartSession', (_, userId) => {
    let session = db.getActiveSession(userId)
    if (!session) session = db.startSession(userId)
    if (!session) return { ok: false, error: 'No credits available. Please see staff.' }
    return { ok: true, session }
  })

  handle('auth:logout', () => {
    const user = db.getCurrentUser()
    if (user) {
      const session = db.getActiveSession(user.id)
      if (session) db.endSession(session.id)
    }
    db.clearCurrentUser()
    return { ok: true }
  })

  handle('auth:currentUser', () => db.getCurrentUser())

  // ── Session ───────────────────────────────────────────────────────────────

  handle('session:getActive', (_, userId) => db.getActiveSession(userId))
  handle('session:end', () => {
    const user = db.getCurrentUser()
    if (user) {
      const s = db.getActiveSession(user.id)
      if (s) db.endSession(s.id)
    }
    db.clearCurrentUser()
    return { ok: true }
  })
  handle('session:history', () => db.sessionHistory())

  // ── Credits ───────────────────────────────────────────────────────────────

  handle('credits:get', (_, userId) => db.getPendingCredits(userId))
  handle('credits:add', (_, userId, amount, note) => {
    db.addCredits(userId, amount, note)
    return { ok: true }
  })

  // ── Games ─────────────────────────────────────────────────────────────────

  handle('games:scan',     () => scanner.scanAll())
  handle('games:platform', (_, platform) => scanner.scanPlatform(platform))
  handle('games:launch',   async (_, gameId, platform) => {
    const user = db.getCurrentUser()
    const sess = user ? db.getActiveSession(user.id) : null
    if (!sess || sess.is_expired) return { ok: false, error: 'No active session.' }
    await launcher.launchGame(gameId, platform)
    db.logGameLaunch(sess.id, gameId, platform)
    return { ok: true }
  })

  handle('games:launchPlatform', async (_, platform) => {
    const user = db.getCurrentUser()
    const sess = user ? db.getActiveSession(user.id) : null
    if (!sess || sess.is_expired) return { ok: false, error: 'No active session.' }
    await launcher.launchPlatform(platform)
    return { ok: true }
  })

  // ── Cafe Library ──────────────────────────────────────────────────────────

  handle('cafe:getGames',   () => db.getCafeGames())
  handle('cafe:addGame',    (_, gameId, platform, name) => { db.addCafeGame(gameId, platform, name); return { ok: true } })
  handle('cafe:removeGame', (_, gameId, platform)       => { db.removeCafeGame(gameId, platform);    return { ok: true } })

  // ── Admin ─────────────────────────────────────────────────────────────────

  handle('admin:verify', (_, pin)                    => db.verifyAdmin(pin))
  handle('admin:users',  ()                          => db.listUsers())
  handle('admin:create', (_, username, pin, display) => db.createUser(username, pin, display))
}
