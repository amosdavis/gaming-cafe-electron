const { execFile, exec, spawn } = require('child_process')
const path               = require('path')
const fs                 = require('fs')

const STEAM_EXE = [
  'C:\\Program Files (x86)\\Steam\\steam.exe',
  'C:\\Program Files\\Steam\\steam.exe',
].find(fs.existsSync) ?? null

const EPIC_EXE = [
  'C:\\Program Files (x86)\\Epic Games\\Launcher\\Portal\\Binaries\\Win64\\EpicGamesLauncher.exe',
  'C:\\Program Files\\Epic Games\\Launcher\\Portal\\Binaries\\Win64\\EpicGamesLauncher.exe',
].find(fs.existsSync) ?? null

const GOG_EXE = [
  'C:\\Program Files (x86)\\GOG Galaxy\\GalaxyClient.exe',
  'C:\\Program Files\\GOG Galaxy\\GalaxyClient.exe',
].find(fs.existsSync) ?? null

/**
 * Launch a platform client and return the child process (for exit monitoring).
 * Steam's bootstrapper re-launches itself, so we spawn it and watch its exit.
 */
function launchPlatformWithChild(platform) {
  return new Promise((resolve, reject) => {
    switch (platform) {
      case 'steam': {
        if (!STEAM_EXE) { reject(new Error('Steam is not installed.')); return }
        const child = spawn(STEAM_EXE, ['-bigpicture'], {
          detached: true,
          stdio:    'ignore',
          windowsHide: false,
        })
        child.unref()
        // Steam relaunches itself; the spawned pid exits quickly.
        // We still return it — the exit event fires and restores the window.
        resolve(child)
        break
      }
      case 'epic': {
        if (!EPIC_EXE) { reject(new Error('Epic Games Launcher is not installed.')); return }
        const child = spawn(EPIC_EXE, [], {
          detached: true,
          stdio:    'ignore',
          windowsHide: false,
        })
        child.unref()
        resolve(child)
        break
      }
      case 'gog': {
        if (!GOG_EXE) { reject(new Error('GOG Galaxy is not installed.')); return }
        const child = spawn(GOG_EXE, [], {
          detached: true,
          stdio:    'ignore',
          windowsHide: false,
        })
        child.unref()
        resolve(child)
        break
      }
      default:
        reject(new Error(`Unknown platform: ${platform}`))
    }
  })
}

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
  if (!STEAM_EXE) { reject(new Error('Steam not found.')); return }
  execFile(STEAM_EXE, [`steam://run/${appId}`], { detached: true, windowsHide: false }, (err) => {
    if (err && err.code !== 0 && err.code !== null) reject(err)
    else resolve()
  })
  resolve()
}

function _launchEpic(appId, resolve, reject) {
  const url = `com.epicgames.launcher://apps/${appId}?action=launch&silent=true`
  exec(`start "" "${url}"`, { shell: true }, (err) => {
    if (err) reject(err)
    else resolve()
  })
}

function _launchGog(appId, resolve, reject) {
  exec(`start "" "goggalaxy://openGame/${appId}"`, { shell: true }, (err) => {
    if (err) reject(err)
    else resolve()
  })
}

module.exports = { launchGame, launchPlatformWithChild }
