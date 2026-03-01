const { execFile, exec } = require('child_process')
const path               = require('path')
const fs                 = require('fs')

/**
 * Launch a game by platform and game ID.
 * Returns a promise that resolves once the launcher process has started.
 */
function launchGame(gameId, platform) {
  return new Promise((resolve, reject) => {
    try {
      switch (platform) {
        case 'steam':
          _launchSteam(gameId, resolve, reject)
          break
        case 'epic':
          _launchEpic(gameId, resolve, reject)
          break
        case 'gog':
          _launchGog(gameId, resolve, reject)
          break
        default:
          reject(new Error(`Unknown platform: ${platform}`))
      }
    } catch (err) {
      reject(err)
    }
  })
}

function _launchSteam(appId, resolve, reject) {
  // steam://run/<appid> protocol — works even when Steam is already running
  const steamExe = _findSteam()
  if (!steamExe) {
    reject(new Error('Steam not found. Ensure Steam is installed.'))
    return
  }
  execFile(steamExe, [`steam://run/${appId}`], { detached: true, windowsHide: false }, (err) => {
    // Steam may exit quickly after launching; that is normal
    if (err && err.code !== 0 && err.code !== null) reject(err)
    else resolve()
  })
  resolve() // resolve immediately — steam:// runs asynchronously
}

function _launchEpic(appId, resolve, reject) {
  // com.epicgames.launcher://apps/<appId>?action=launch
  const url = `com.epicgames.launcher://apps/${appId}?action=launch&silent=true`
  exec(`start "" "${url}"`, { shell: true }, (err) => {
    if (err) reject(err)
    else resolve()
  })
}

function _launchGog(appId, resolve, reject) {
  // goggalaxy://openGame/<productId>
  exec(`start "" "goggalaxy://openGame/${appId}"`, { shell: true }, (err) => {
    if (err) reject(err)
    else resolve()
  })
}

function _findSteam() {
  const candidates = [
    'C:\\Program Files (x86)\\Steam\\steam.exe',
    'C:\\Program Files\\Steam\\steam.exe',
  ]
  return candidates.find(fs.existsSync) ?? null
}

module.exports = { launchGame }
