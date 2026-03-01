import { useState } from 'react'
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
  const [launching, setLaunching] = useState(null)
  const [error,     setError]     = useState('')

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

  return (
    <div className="w-full h-full flex flex-col">
      <SessionBar
        user={user}
        session={session}
        onLogout={handleLogout}
        onAdmin={() => navigate('admin')}
      />

      <div className="flex-1 flex flex-col items-center justify-center gap-12 px-8 animate-fade-in">
        <h2 className="text-2xl font-bold text-steam-muted tracking-widest uppercase text-center">
          Choose a Platform
        </h2>

        {error && (
          <div className="px-6 py-3 bg-steam-red/20 border border-steam-red/50 rounded-lg text-steam-red text-sm">
            {error}
          </div>
        )}

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
