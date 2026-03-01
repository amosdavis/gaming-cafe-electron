import { useState, useEffect } from 'react'
import SessionBar from '../components/SessionBar'
import Tile        from '../components/Tile'

// Resolved at runtime by Electron's protocol handler (resources/images/)
const PLATFORM_IMG = {
  steam:        'kiosk-resource://images/steam.png',
  epic:         'kiosk-resource://images/epic.png',
  gog:          'kiosk-resource://images/gog.png',
  cafe_library: 'kiosk-resource://images/cafe_library.png',
}

const PLATFORMS = [
  { id: 'steam', label: 'Steam',        sublabel: 'Click to open Steam',        img: PLATFORM_IMG.steam },
  { id: 'epic',  label: 'Epic Games',   sublabel: 'Click to open Epic Launcher', img: PLATFORM_IMG.epic  },
  { id: 'gog',   label: 'GOG Galaxy',   sublabel: 'Click to open GOG Galaxy',   img: PLATFORM_IMG.gog   },
]

export default function Home({ user, session, onLogout, onSessionUpdate, navigate }) {
  const [launching,      setLaunching]      = useState(null)
  const [error,          setError]          = useState('')
  const [featuredGames,  setFeaturedGames]  = useState([])
  const [gameMap,        setGameMap]        = useState({})

  useEffect(() => {
    Promise.all([window.kiosk.getFeaturedGames(), window.kiosk.scanGames()])
      .then(([featured, all]) => {
        setFeaturedGames(featured)
        const map = {}
        all.forEach(g => { map[`${g.id}::${g.platform}`] = g })
        setGameMap(map)
      })
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    await window.kiosk.logout()
    onLogout()
  }

  const handleLaunchPlatform = async (platformId) => {
    setLaunching(platformId)
    setError('')
    try {
      const result = await window.kiosk.launchPlatform(platformId)
      if (!result.ok) setError(result.error ?? 'Could not launch.')
    } catch (e) {
      setError(e.message)
    } finally {
      setLaunching(null)
    }
  }

  const handleLaunchFeatured = async (entry) => {
    const key = `${entry.game_id}::${entry.platform}`
    setLaunching(key)
    setError('')
    try {
      const result = await window.kiosk.launchGame(entry.game_id, entry.platform)
      if (result && !result.ok) setError(result.error ?? 'Could not launch game.')
    } catch (e) {
      setError(e.message)
    } finally {
      setLaunching(null)
    }
  }

  return (
    <div className="w-full h-full flex flex-col">
      <SessionBar
        user={user}
        session={session}
        onLogout={handleLogout}
        onAdmin={() => navigate('admin')}
      />

      <div className="flex-1 flex flex-col items-center justify-center gap-10 px-8 py-6 overflow-y-auto animate-fade-in">

        {error && (
          <div className="px-6 py-3 bg-steam-red/20 border border-steam-red/50 rounded-lg text-steam-red text-sm">
            {error}
          </div>
        )}

        {/* F-52: Featured games hero section */}
        {featuredGames.length > 0 && (
          <div className="w-full max-w-4xl">
            <h2 className="text-sm font-bold text-steam-muted tracking-widest uppercase mb-3">⭐ Featured</h2>
            <div className="flex gap-4 flex-wrap justify-start">
              {featuredGames.map(f => {
                const game = gameMap[`${f.game_id}::${f.platform}`]
                const key  = `${f.game_id}::${f.platform}`
                return (
                  <div
                    key={key}
                    className={`tile w-48 h-64 ${launching === key ? 'opacity-60 pointer-events-none' : ''}`}
                    onClick={() => handleLaunchFeatured({ game_id: f.game_id, platform: f.platform })}
                  >
                    <img
                      src={game?.thumb || game?.poster || 'kiosk-resource://images/no_artwork.png'}
                      alt={game?.name ?? f.game_id}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={e => { e.currentTarget.src = 'kiosk-resource://images/no_artwork.png'; e.currentTarget.onerror = null }}
                    />
                    <div className="tile-label relative z-10">
                      <p className="font-bold leading-tight truncate text-sm">{game?.name ?? f.game_id}</p>
                      <p className="text-xs text-steam-muted capitalize">{f.platform}</p>
                    </div>
                    {launching === key && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-steam-blue text-sm animate-pulse">
                        Launching…
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <h2 className="text-2xl font-bold text-steam-muted tracking-widest uppercase text-center">
          Choose a Platform
        </h2>

        {/* Platform tiles row */}
        <div className="flex gap-6 flex-wrap justify-center">
          {PLATFORMS.map(p => (
            <div
              key={p.id}
              className={`tile w-72 h-48 ${launching === p.id ? 'opacity-60 pointer-events-none' : ''}`}
              onClick={() => handleLaunchPlatform(p.id)}
            >
              <img src={p.img} alt={p.label} className="absolute inset-0 w-full h-full object-cover" />
              <div className="tile-label relative z-10">
                <p className="text-lg font-bold leading-tight">
                  {launching === p.id ? '⏳ Launching…' : p.label}
                </p>
                <p className="text-xs text-steam-muted mt-0.5">{p.sublabel}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Cafe Library tile — gold accent */}
        <div
          className="tile w-full max-w-sm h-32 cursor-pointer"
          onClick={() => navigate('library')}
          style={{ boxShadow: '0 0 24px rgba(240,160,75,0.35)' }}
        >
          <img
            src={PLATFORM_IMG.cafe_library}
            alt="Cafe Library"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="tile-label relative z-10">
            <p className="text-lg font-bold">★ Cafe Library</p>
            <p className="text-xs text-steam-muted">Games available to all cafe accounts</p>
          </div>
        </div>
      </div>
    </div>
  )
}
