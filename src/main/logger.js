/**
 * Rotating file logger — F-49 mitigation.
 * Caps each log file at MAX_BYTES, keeps LOG_COUNT rotations.
 * Replaces console.log / console.error in the main process after init().
 */

const fs   = require('fs')
const path = require('path')
const os   = require('os')

const LOG_DIR   = path.join(os.homedir(), 'AppData', 'Roaming', 'gaming-cafe-electron')
const LOG_PATH  = path.join(LOG_DIR, 'gamingcafe.log')
const MAX_BYTES = 2 * 1024 * 1024  // 2 MB per file
const LOG_COUNT = 3                 // gamingcafe.log, .log.1, .log.2

let _stream = null

function _openStream() {
  fs.mkdirSync(LOG_DIR, { recursive: true })
  _stream = fs.createWriteStream(LOG_PATH, { flags: 'a' })
}

function _rotate() {
  if (_stream) { _stream.end(); _stream = null }
  // Shift existing rotations: .log.2 is overwritten, .log.1 → .log.2, .log → .log.1
  for (let i = LOG_COUNT - 2; i >= 1; i--) {
    const from = `${LOG_PATH}.${i}`
    const to   = `${LOG_PATH}.${i + 1}`
    try { if (fs.existsSync(from)) fs.renameSync(from, to) } catch { /* best-effort */ }
  }
  try { if (fs.existsSync(LOG_PATH)) fs.renameSync(LOG_PATH, `${LOG_PATH}.1`) } catch { /* best-effort */ }
  _openStream()
}

function _write(level, args) {
  const line = `[${new Date().toISOString()}] [${level}] ${args.map(a =>
    typeof a === 'string' ? a : JSON.stringify(a)
  ).join(' ')}\n`

  try {
    if (!_stream) _openStream()
    // Check size before writing; rotate if needed
    try {
      const stat = fs.statSync(LOG_PATH)
      if (stat.size >= MAX_BYTES) _rotate()
    } catch { /* file may not exist yet */ }
    _stream.write(line)
  } catch { /* never crash the main process over logging */ }
}

/**
 * Call once at app startup. Redirects console.log and console.error
 * to the rotating log file while also forwarding to the original handlers.
 */
function init() {
  _openStream()

  const origLog   = console.log.bind(console)
  const origError = console.error.bind(console)
  const origWarn  = console.warn.bind(console)

  console.log = (...args) => { _write('INFO',  args); origLog(...args)   }
  console.error = (...args) => { _write('ERROR', args); origError(...args) }
  console.warn  = (...args) => { _write('WARN',  args); origWarn(...args)  }
}

module.exports = { init }
