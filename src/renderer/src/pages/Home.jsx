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
  { id: 'steam', label: 'Steam',        img: PLATFORM_IMG.steam },
  { id: 'epic',  label: 'Epic Games',   img: PLATFORM_IMG.epic  },
  { id: 'gog',   label: 'GOG Galaxy',   img: PLATFORM_IMG.gog   },
]

export default function Home({ user, session, onLogout, onSessionUpdate, navigate }) {
  const handleLogout = async () => {
    await window.kiosk.logout()
    onLogout()
  }

  const handleAdmin = () => navigate('admin')

  return (
    <div className="w-full h-full flex flex-col">
      <SessionBar
        user={user}
        session={session}
        onLogout={handleLogout}
        onAdmin={handleAdmin}
      />

      <div className="flex-1 flex flex-col items-center justify-center gap-12 px-8 animate-fade-in">
        <h2 className="text-2xl font-bold text-steam-muted tracking-widest uppercase text-center">
          Choose a Platform
        </h2>

        {/* Platform tiles row */}
        <div className="flex gap-6 flex-wrap justify-center">
          {PLATFORMS.map(p => (
            <Tile
              key={p.id}
              label={p.label}
              image={p.img}
              onClick={() => navigate('browse', { platform: p.id })}
            />
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
