const Database = require('better-sqlite3')
const path      = require('path')
const crypto    = require('crypto')
const os        = require('os')
const fs        = require('fs')

const DB_DIR  = process.env.KIOSK_TEST_DB_DIR || path.join(os.homedir(), 'AppData', 'Roaming', 'gaming-cafe-electron')
const DB_PATH = path.join(DB_DIR, 'gamingcafe.db')

let _db = null

function getDb() {
  if (_db) return _db
  fs.mkdirSync(DB_DIR, { recursive: true })
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  initSchema(_db)

  // F-46: scheduled backup every 30 minutes even if no session ends
  setInterval(backupDb, 30 * 60 * 1000)

  return _db
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      username     TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      pin_hash     TEXT    NOT NULL,
      display_name TEXT    NOT NULL DEFAULT '',
      created_at   TEXT    NOT NULL,
      active       INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS pending_credits (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id  INTEGER REFERENCES users(id),
      amount   INTEGER NOT NULL CHECK(amount > 0),
      added_at TEXT    NOT NULL,
      note     TEXT    NOT NULL DEFAULT '',
      consumed INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER REFERENCES users(id),
      start_time    TEXT    NOT NULL,
      end_time      TEXT,
      credits_used  INTEGER NOT NULL DEFAULT 0,
      total_seconds INTEGER NOT NULL DEFAULT 0,
      status        TEXT    NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS game_launches (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   INTEGER NOT NULL REFERENCES sessions(id),
      game_name    TEXT    NOT NULL,
      platform     TEXT    NOT NULL,
      launch_time  TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS credits_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER REFERENCES sessions(id),
      delta      INTEGER NOT NULL,
      timestamp  TEXT    NOT NULL,
      note       TEXT    NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS cafe_games (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id   TEXT NOT NULL,
      platform  TEXT NOT NULL,
      game_name TEXT NOT NULL,
      added_at  TEXT NOT NULL,
      UNIQUE(game_id, platform)
    );

    CREATE TABLE IF NOT EXISTS kiosk_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      username     TEXT NOT NULL COLLATE NOCASE,
      attempted_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS featured_games (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id  TEXT NOT NULL,
      platform TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      added_at TEXT NOT NULL,
      UNIQUE(game_id, platform)
    );
  `)

  // F-58: Age restriction columns (idempotent via try/catch)
  ;[
    "ALTER TABLE users ADD COLUMN under_18 INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE cafe_games ADD COLUMN age_rating TEXT NOT NULL DEFAULT 'E'",
  ].forEach(sql => { try { db.prepare(sql).run() } catch { /* already exists */ } })

  // Seed default admin PIN if not set (SHA-256 of "1234")
  const existing = db.prepare("SELECT value FROM settings WHERE key='admin_pin_hash'").get()
  if (!existing) {
    const hash = crypto.createHash('sha256').update('1234').digest('hex')
    db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('admin_pin_hash',?)").run(hash)
    db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('minutes_per_credit','30')").run()
  }
}

const utcnow = () => new Date().toISOString()

// ── Auth ─────────────────────────────────────────────────────────────────────

function login(username, pin) {
  const db   = getDb()
  const lock = checkLoginLock(username)
  if (lock.locked) return { locked: true, retry_after_secs: lock.retry_after_secs }

  const hash = crypto.createHash('sha256').update(pin).digest('hex')
  const user = db.prepare(
    'SELECT id, username, display_name FROM users WHERE username=? COLLATE NOCASE AND pin_hash=? AND active=1'
  ).get(username, hash)

  if (!user) {
    recordLoginAttempt(username)
    return null
  }
  // Clear attempts on success
  db.prepare('DELETE FROM login_attempts WHERE username=?').run(username)
  return user
}

function recordLoginAttempt(username) {
  getDb().prepare('INSERT INTO login_attempts (username, attempted_at) VALUES (?,?)').run(username, utcnow())
}

function checkLoginLock(username) {
  const db = getDb()
  const windowMs = 10 * 60 * 1000  // 10 minutes
  const cutoff   = new Date(Date.now() - windowMs).toISOString()
  const count = db.prepare(
    'SELECT COUNT(*) as c FROM login_attempts WHERE username=? AND attempted_at > ?'
  ).get(username, cutoff)?.c ?? 0
  if (count < 5) return { locked: false, attempts: count }
  // Find oldest attempt in window to compute unlock time
  const oldest = db.prepare(
    'SELECT attempted_at FROM login_attempts WHERE username=? AND attempted_at > ? ORDER BY attempted_at ASC LIMIT 1'
  ).get(username, cutoff)
  const unlockAt = new Date(new Date(oldest.attempted_at).getTime() + windowMs)
  const retrySecs = Math.max(0, Math.ceil((unlockAt - Date.now()) / 1000))
  return { locked: true, retry_after_secs: retrySecs }
}

function createUser(username, pin, displayName = '') {
  const db   = getDb()
  const hash = crypto.createHash('sha256').update(pin).digest('hex')
  try {
    const info = db.prepare(
      'INSERT INTO users (username, pin_hash, display_name, created_at) VALUES (?,?,?,?)'
    ).run(username, hash, displayName, utcnow())
    return db.prepare('SELECT id, username, display_name FROM users WHERE id=?').get(info.lastInsertRowid)
  } catch { return null }
}

function listUsers() {
  const db = getDb()
  const users = db.prepare('SELECT id, username, display_name, active, under_18 FROM users ORDER BY username').all()
  return users.map(u => ({
    ...u,
    credits: getPendingCredits(u.id)
  }))
}

function getCurrentUser() {
  const db  = getDb()
  const row = db.prepare("SELECT value FROM kiosk_state WHERE key='current_user_id'").get()
  if (!row?.value) return null
  return db.prepare('SELECT id, username, display_name FROM users WHERE id=?').get(Number(row.value))
}

function setCurrentUser(userId) {
  getDb().prepare("INSERT OR REPLACE INTO kiosk_state (key,value) VALUES ('current_user_id',?)").run(String(userId))
}

function clearCurrentUser() {
  getDb().prepare("DELETE FROM kiosk_state WHERE key='current_user_id'").run()
}

// ── Credits ──────────────────────────────────────────────────────────────────

function getPendingCredits(userId) {
  const row = getDb().prepare(
    'SELECT COALESCE(SUM(amount),0) as total FROM pending_credits WHERE user_id=? AND consumed=0'
  ).get(userId)
  return row?.total ?? 0
}

function addCredits(userId, amount, note = '') {
  const db = getDb()
  const now = utcnow()
  db.prepare('INSERT INTO pending_credits (user_id,amount,added_at,note) VALUES (?,?,?,?)').run(userId, amount, now, note)
  db.prepare('INSERT INTO credits_log (delta,timestamp,note) VALUES (?,?,?)').run(amount, now, note)
}

// ── Sessions ─────────────────────────────────────────────────────────────────

const MINUTES_PER_CREDIT = () => {
  const row = getDb().prepare("SELECT value FROM settings WHERE key='minutes_per_credit'").get()
  return parseInt(row?.value ?? '30', 10)
}

function getActiveSession(userId) {
  const raw = getDb().prepare(
    "SELECT * FROM sessions WHERE user_id=? AND status='active' ORDER BY start_time DESC LIMIT 1"
  ).get(userId)
  if (!raw) return null
  return enrichSession(raw)
}

function enrichSession(raw) {
  const mpc        = MINUTES_PER_CREDIT()
  const totalSecs  = raw.credits_used * mpc * 60
  const startMs    = new Date(raw.start_time).getTime()
  const elapsedSec = Math.floor((Date.now() - startMs) / 1000)
  const remSec     = Math.max(0, totalSecs - elapsedSec)

  const fmt = (s) => {
    if (s >= 3600) return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`
    return `${Math.floor(s/60)}m ${s%60}s`
  }

  return {
    ...raw,
    remaining_secs:    remSec,
    remaining_display: fmt(remSec),
    is_expired:        remSec <= 0,
  }
}

function startSession(userId) {
  const db      = getDb()
  const credits = getPendingCredits(userId)
  if (credits <= 0) return null

  // Consume all pending credits
  const rows = db.prepare(
    'SELECT id, amount FROM pending_credits WHERE user_id=? AND consumed=0 ORDER BY added_at'
  ).all(userId)

  const txn = db.transaction(() => {
    for (const r of rows) {
      db.prepare('UPDATE pending_credits SET consumed=1 WHERE id=?').run(r.id)
    }
    const info = db.prepare(
      'INSERT INTO sessions (user_id,start_time,credits_used,status) VALUES (?,?,?,?)'
    ).run(userId, utcnow(), credits, 'active')
    return info.lastInsertRowid
  })

  const sessionId = txn()
  return enrichSession(db.prepare('SELECT * FROM sessions WHERE id=?').get(sessionId))
}

function endSession(sessionId) {
  const db  = getDb()
  const now = utcnow()
  const s   = db.prepare('SELECT * FROM sessions WHERE id=?').get(sessionId)
  if (!s) return
  const startMs = new Date(s.start_time).getTime()
  const secs    = Math.floor((Date.now() - startMs) / 1000)
  db.prepare("UPDATE sessions SET status='ended', end_time=?, total_seconds=? WHERE id=?").run(now, secs, sessionId)
  backupDb()
}

function backupDb() {
  try {
    const b1 = DB_PATH + '.bak'
    const b2 = DB_PATH + '.bak2'
    const b3 = DB_PATH + '.bak3'
    if (fs.existsSync(b2)) fs.copyFileSync(b2, b3)
    if (fs.existsSync(b1)) fs.copyFileSync(b1, b2)
    fs.copyFileSync(DB_PATH, b1)
  } catch { /* best-effort */ }
}

function sessionHistory(limit = 20) {
  return getDb().prepare(`
    SELECT s.*, u.username, s.total_seconds as duration_secs
    FROM sessions s LEFT JOIN users u ON s.user_id=u.id
    ORDER BY s.start_time DESC LIMIT ?
  `).all(limit).map(s => ({
    ...s,
    duration_display: (() => {
      const sec = s.duration_secs ?? 0
      if (sec >= 3600) return `${Math.floor(sec/3600)}h ${Math.floor((sec%3600)/60)}m`
      return `${Math.floor(sec/60)}m ${sec%60}s`
    })()
  }))
}

// ── Cafe games ───────────────────────────────────────────────────────────────

function getCafeGames() {
  return getDb().prepare('SELECT game_id, platform, game_name FROM cafe_games ORDER BY game_name COLLATE NOCASE').all()
}

function addCafeGame(gameId, platform, gameName) {
  try {
    getDb().prepare('INSERT OR IGNORE INTO cafe_games (game_id,platform,game_name,added_at) VALUES (?,?,?,?)').run(gameId, platform, gameName, utcnow())
    return true
  } catch { return false }
}

function removeCafeGame(gameId, platform) {
  getDb().prepare('DELETE FROM cafe_games WHERE game_id=? AND platform=?').run(gameId, platform)
}

function getFeaturedGames() {
  return getDb().prepare(
    'SELECT game_id, platform, position FROM featured_games ORDER BY position ASC'
  ).all()
}

function setFeaturedGame(gameId, platform, position) {
  try {
    getDb().prepare(
      'INSERT OR REPLACE INTO featured_games (game_id,platform,position,added_at) VALUES (?,?,?,?)'
    ).run(gameId, platform, position, utcnow())
    return true
  } catch { return false }
}

function removeFeaturedGame(gameId, platform) {
  getDb().prepare('DELETE FROM featured_games WHERE game_id=? AND platform=?').run(gameId, platform)
}

// ── Admin ────────────────────────────────────────────────────────────────────

function verifyAdmin(pin) {
  const db   = getDb()
  const row  = db.prepare("SELECT value FROM settings WHERE key='admin_pin_hash'").get()
  if (!row) return false
  const hash = crypto.createHash('sha256').update(pin).digest('hex')
  return hash === row.value
}

function setUserAgeRestriction(userId, under18) {
  getDb().prepare('UPDATE users SET under_18=? WHERE id=?').run(under18 ? 1 : 0, userId)
}

function setCafeGameRating(gameId, platform, rating) {
  getDb().prepare("UPDATE cafe_games SET age_rating=? WHERE game_id=? AND platform=?").run(rating, gameId, platform)
}

function getCafeGamesWithRatings() {
  return getDb().prepare('SELECT game_id, platform, game_name, age_rating FROM cafe_games ORDER BY game_name COLLATE NOCASE').all()
}

function logGameLaunch(sessionId, gameName, platform) {
  getDb().prepare('INSERT INTO game_launches (session_id,game_name,platform,launch_time) VALUES (?,?,?,?)').run(sessionId, gameName, platform, utcnow())
}

module.exports = {
  getDb, login, createUser, listUsers,
  getCurrentUser, setCurrentUser, clearCurrentUser,
  getPendingCredits, addCredits,
  getActiveSession, startSession, endSession, sessionHistory, enrichSession,
  getCafeGames, addCafeGame, removeCafeGame,
  getFeaturedGames, setFeaturedGame, removeFeaturedGame,
  verifyAdmin, logGameLaunch,
  setUserAgeRestriction, setCafeGameRating, getCafeGamesWithRatings,
  backupDb, checkLoginLock,
}
