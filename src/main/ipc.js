const { ipcMain, BrowserWindow } = require('electron')
const db          = require('./db')
const scanner     = require('./scanner')
const launcher    = require('./launcher')

function getWin() {
  const wins = BrowserWindow.getAllWindows()
  return wins.length ? wins[0] : null
}

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

let platformLaunching = false

module.exports = function registerIpc() {

  // ── Auth ──────────────────────────────────────────────────────────────────

  handle('auth:login', (_, username, pin) => {
    const user = db.login(username, pin)
    if (!user) return { ok: false, error: 'Incorrect username or PIN.' }
    if (user.locked) return { ok: false, locked: true, retry_after_secs: user.retry_after_secs }
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
  handle('session:history',     () => db.sessionHistory())
  handle('session:historyFull', () => db.sessionHistory(1000))
  handle('session:refresh', (_, userId) => db.getActiveSession(userId))

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

    // F-58: age gate — block M/AO rated cafe games for under-18 users
    if (user) {
      const fullUser = db.getDb().prepare('SELECT under_18 FROM users WHERE id=?').get(user.id)
      if (fullUser?.under_18) {
        const cafeGame = db.getDb().prepare(
          "SELECT age_rating FROM cafe_games WHERE game_id=? AND platform=?"
        ).get(gameId, platform)
        if (cafeGame && ['M','AO','18+','R18+'].includes(cafeGame.age_rating)) {
          return { ok: false, error: 'This game is age-restricted.' }
        }
      }
    }

    await launcher.launchGame(gameId, platform)
    db.logGameLaunch(sess.id, gameId, platform)
    return { ok: true }
  })

  handle('games:launchPlatform', async (_, platform) => {
    const user = db.getCurrentUser()
    const sess = user ? db.getActiveSession(user.id) : null
    if (!sess || sess.is_expired) return { ok: false, error: 'No active session.' }
    if (platformLaunching) return { ok: false, error: 'A platform is already launching. Please wait.' }

    platformLaunching = true
    const win = getWin()
    if (win) win.minimize()

    // F-35: watchdog — restore window after 4 hours if client never exits
    const watchdog = setTimeout(() => {
      platformLaunching = false
      const w = getWin()
      if (w && w.isMinimized()) { w.restore(); w.focus() }
    }, 4 * 60 * 60 * 1000)

    try {
      const child = await launcher.launchPlatformWithChild(platform)
      if (child) {
        child.on('exit', () => {
          clearTimeout(watchdog)
          platformLaunching = false
          const w = getWin()
          if (w) { w.restore(); w.focus() }
        })
      } else {
        clearTimeout(watchdog)
        platformLaunching = false
      }
    } catch (err) {
      clearTimeout(watchdog)
      platformLaunching = false
      if (win) { win.restore(); win.focus() }
      return { ok: false, error: err.message }
    }
    return { ok: true }
  })

  handle('games:checkPath', (_, gamePath) => {
    if (!gamePath) return false
    const fs = require('fs')
    return fs.existsSync(gamePath)
  })

  // ── Cafe Library ──────────────────────────────────────────────────────────

  handle('cafe:getGames',   () => db.getCafeGames())
  handle('cafe:addGame',    (_, gameId, platform, name) => { db.addCafeGame(gameId, platform, name); return { ok: true } })
  handle('cafe:removeGame', (_, gameId, platform)       => { db.removeCafeGame(gameId, platform);    return { ok: true } })

  // ── Featured Games ────────────────────────────────────────────────────────

  handle('featured:get',    ()                            => db.getFeaturedGames())
  handle('featured:set',    (_, gameId, platform, pos)    => { db.setFeaturedGame(gameId, platform, pos); return { ok: true } })
  handle('featured:remove', (_, gameId, platform)         => { db.removeFeaturedGame(gameId, platform);   return { ok: true } })

  // ── Age restrictions ──────────────────────────────────────────────────────

  handle('admin:setUserAgeRestriction', (_, userId, under18) => {
    db.setUserAgeRestriction(userId, under18)
    return { ok: true }
  })
  handle('admin:setCafeGameRating', (_, gameId, platform, rating) => {
    db.setCafeGameRating(gameId, platform, rating)
    return { ok: true }
  })
  handle('admin:cafeGamesWithRatings', () => db.getCafeGamesWithRatings())

  // ── Admin ─────────────────────────────────────────────────────────────────

  handle('admin:verify', (_, pin)                    => db.verifyAdmin(pin))
  handle('admin:users',  ()                          => db.listUsers())
  handle('admin:create', (_, username, pin, display) => db.createUser(username, pin, display))
  handle('admin:backup', () => { db.backupDb(); return { ok: true } })

  // ── Admin escape hatches ──────────────────────────────────────────────────
  // Exit kiosk mode, spawn the requested process, and auto-restore kiosk when
  // that process exits. This lets admins reach the desktop or a terminal
  // without permanently leaving kiosk mode.

  const spawnAdminEscape = (exe, args) => {
    const { spawn } = require('child_process')
    const win = getWin()
    if (win) { win.setKiosk(false); win.minimize() }
    const child = spawn(exe, args, { detached: false, windowsHide: false, shell: false })
    child.on('exit', () => {
      const w = getWin()
      if (w) { w.restore(); w.setKiosk(true); w.focus() }
    })
    return { ok: true }
  }

  handle('admin:launchDesktop',  () => spawnAdminEscape('explorer.exe', ['C:\\']))
  handle('admin:launchTerminal', () => spawnAdminEscape('powershell.exe', ['-NoExit', '-NoProfile']))
}
