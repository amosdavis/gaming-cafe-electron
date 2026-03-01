const fs   = require('fs')
const path = require('path')

// ── Steam ─────────────────────────────────────────────────────────────────────

function scanSteam() {
  const games = []
  const libraryFolders = _steamLibraryFolders()

  for (const libPath of libraryFolders) {
    const appsDir = path.join(libPath, 'steamapps')
    if (!fs.existsSync(appsDir)) continue

    for (const file of fs.readdirSync(appsDir)) {
      if (!file.startsWith('appmanifest_') || !file.endsWith('.acf')) continue
      try {
        const acf  = fs.readFileSync(path.join(appsDir, file), 'utf8')
        const id   = _acfValue(acf, 'appid')
        const name = _acfValue(acf, 'name')
        const installDir = _acfValue(acf, 'installdir')
        if (!id || !name) continue

        games.push({
          id:       id,
          name:     name,
          platform: 'steam',
          path:     path.join(appsDir, 'common', installDir),
          thumb:    `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900.jpg`,
          poster:   `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900.jpg`,
        })
      } catch { /* skip corrupt manifests */ }
    }
  }

  return games
}

function _steamLibraryFolders() {
  const defaults = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
  ]
  const paths = []

  for (const steam of defaults) {
    if (!fs.existsSync(steam)) continue
    paths.push(steam)

    // Read libraryfolders.vdf for additional libraries
    const vdf = path.join(steam, 'steamapps', 'libraryfolders.vdf')
    if (!fs.existsSync(vdf)) continue
    try {
      const content = fs.readFileSync(vdf, 'utf8')
      const matches = [...content.matchAll(/"path"\s+"([^"]+)"/g)]
      for (const m of matches) {
        const p = m[1].replace(/\\\\/g, '\\')
        if (fs.existsSync(p)) paths.push(p)
      }
    } catch { /* skip */ }
  }

  return [...new Set(paths)]
}

function _acfValue(content, key) {
  const m = content.match(new RegExp(`"${key}"\\s+"([^"]+)"`))
  return m ? m[1] : null
}

// ── Epic Games ────────────────────────────────────────────────────────────────

function scanEpic() {
  const games    = []
  const manifest = path.join(
    process.env.ProgramData ?? 'C:\\ProgramData',
    'Epic', 'EpicGamesLauncher', 'Data', 'Manifests'
  )
  if (!fs.existsSync(manifest)) return games

  for (const file of fs.readdirSync(manifest)) {
    if (!file.endsWith('.item')) continue
    try {
      const data = JSON.parse(fs.readFileSync(path.join(manifest, file), 'utf8'))

      // Filter out DLCs (only full applications with themselves as their main game)
      if (!data.bIsApplication) continue
      if (data.MainGameAppName && data.MainGameAppName !== data.AppName) continue

      const installPath = data.InstallLocation ? path.normalize(data.InstallLocation) : ''
      if (!installPath || !fs.existsSync(installPath)) continue

      // Look for a .ico in the install dir as artwork
      let thumb = null
      try {
        const ico = fs.readdirSync(installPath).find(f => f.endsWith('.ico'))
        if (ico) thumb = path.join(installPath, ico)
      } catch { /* skip */ }

      games.push({
        id:       data.AppName,
        name:     data.DisplayName ?? data.AppName,
        platform: 'epic',
        path:     installPath,
        thumb,
        poster:   thumb,
      })
    } catch { /* skip corrupt manifests */ }
  }

  return games
}

// ── GOG Galaxy ────────────────────────────────────────────────────────────────

function scanGog() {
  const games = []
  try {
    const { execSync } = require('child_process')
    // Read installed GOG games from registry
    const output = execSync(
      'reg query "HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games" /s /v "gameName" 2>nul',
      { encoding: 'utf8', timeout: 5000 }
    )
    const idBlocks = output.split(/\r?\n\r?\n/)
    for (const block of idBlocks) {
      const idMatch   = block.match(/\\Games\\(\d+)/)
      const nameMatch = block.match(/gameName\s+\w+\s+(.+)/)
      if (!idMatch || !nameMatch) continue
      const gameId = idMatch[1]
      const name   = nameMatch[1].trim()

      // Get install path
      let installPath = null
      try {
        const pathOut = execSync(
          `reg query "HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games\\${gameId}" /v "path" 2>nul`,
          { encoding: 'utf8', timeout: 3000 }
        )
        const pm = pathOut.match(/path\s+\w+\s+(.+)/)
        if (pm) installPath = pm[1].trim()
      } catch { /* skip */ }

      // Find .ico in install dir
      let thumb = null
      if (installPath && fs.existsSync(installPath)) {
        try {
          const ico = fs.readdirSync(installPath).find(f => f.endsWith('.ico'))
          if (ico) thumb = path.join(installPath, ico)
        } catch { /* skip */ }
      }

      games.push({ id: gameId, name, platform: 'gog', path: installPath, thumb, poster: thumb })
    }
  } catch { /* registry not available or GOG not installed */ }

  return games
}

// ── Combined ──────────────────────────────────────────────────────────────────

function scanAll() {
  return [...scanSteam(), ...scanEpic(), ...scanGog()]
}

function scanPlatform(platform) {
  switch (platform) {
    case 'steam': return scanSteam()
    case 'epic':  return scanEpic()
    case 'gog':   return scanGog()
    default:      return []
  }
}

module.exports = { scanAll, scanPlatform, scanSteam, scanEpic, scanGog }
