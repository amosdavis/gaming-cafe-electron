import { useState, useEffect } from 'react'
import SessionBar from '../components/SessionBar'
import Tile       from '../components/Tile'

const PLATFORM_LABEL = { steam: 'Steam', epic: 'Epic Games', gog: 'GOG Galaxy' }

export default function CafeLibrary({ user, session, onLogout, navigate }) {
  const [entries,   setEntries]   = useState([])
  const [gameMap,   setGameMap]   = useState({})
  const [busy,      setBusy]      = useState(true)
  const [launching, setLaunching] = useState(null)

  useEffect(() => {
    Promise.all([window.kiosk.getCafeGames(), window.kiosk.scanGames()])
      .then(([cafe, all]) => {
        setEntries(cafe)
        const map = {}
        all.forEach(g => { map[`${g.id}::${g.platform}`] = g })
        setGameMap(map)
      })
      .finally(() => setBusy(false))
  }, [])

  const launch = async (entry) => {
    setLaunching(`${entry.game_id}::${entry.platform}`)
    try {
      await window.kiosk.launchGame(entry.game_id, entry.platform)
    } finally {
      setLaunching(null)
    }
  }

  const getArt = (entry) => {
    const game = gameMap[`${entry.game_id}::${entry.platform}`]
    return game?.thumb || game?.poster || null
  }

  return (
    <div className="w-full h-full flex flex-col">
      <SessionBar
        user={user}
        session={session}
        onLogout={async () => { await window.kiosk.logout(); onLogout() }}
        onAdmin={() => navigate('admin')}
      />

      <div className="flex items-center gap-4 px-8 py-5 border-b border-steam-border shrink-0">
        <button
          className="text-steam-muted hover:text-steam-blue transition-colors text-xl"
          onClick={() => navigate('home')}
        >
          ← Back
        </button>
        <h2 className="text-2xl font-bold text-steam-gold">★ Cafe Library</h2>
        {!busy && (
          <span className="text-steam-muted text-sm ml-2">
            {entries.length} title{entries.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {busy && (
          <div className="flex items-center justify-center h-full text-steam-muted animate-pulse">
            Loading library…
          </div>
        )}

        {!busy && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-steam-muted">
            <span className="text-5xl">📚</span>
            <p className="text-xl">No cafe games yet</p>
            <p className="text-sm">Ask an admin to add games to the Cafe Library.</p>
          </div>
        )}

        {!busy && entries.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 animate-fade-in">
            {entries.map(entry => {
              const key = `${entry.game_id}::${entry.platform}`
              const art = getArt(entry)
              const plat = PLATFORM_LABEL[entry.platform] ?? entry.platform.toUpperCase()
              return (
                <div
                  key={key}
                  className={`tile h-64 ${launching === key ? 'opacity-60 pointer-events-none' : ''}`}
                  onClick={() => launch(entry)}
                >
                  {art
                    ? <img src={art} alt={entry.game_name} className="absolute inset-0 w-full h-full object-cover" />
                    : <div className="absolute inset-0 flex items-center justify-center text-5xl">🎮</div>
                  }
                  <div className="tile-label relative z-10">
                    <p className="font-bold leading-tight truncate">{entry.game_name}</p>
                    <p className="text-xs text-steam-muted">{plat}</p>
                  </div>
                  {launching === key && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-steam-blue animate-pulse">
                      Launching…
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
