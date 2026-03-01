import { useState, useEffect } from 'react'
import SessionBar from '../components/SessionBar'

const PLATFORM_LABEL = { steam: 'Steam', epic: 'Epic Games', gog: 'GOG Galaxy' }

export default function Browse({ user, session, onLogout, navigate, platform }) {
  const [games,  setGames]  = useState([])
  const [busy,   setBusy]   = useState(true)
  const [error,  setError]  = useState('')
  const [launching, setLaunching] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setBusy(true)
    window.kiosk.scanGames()
      .then(all => {
        setGames(all.filter(g => g.platform === platform)
                    .sort((a, b) => a.name.localeCompare(b.name)))
      })
      .catch(e => setError(e.message))
      .finally(() => setBusy(false))
  }, [platform])

  const launch = async (game) => {
    setLaunching(game.id)
    try {
      await window.kiosk.launchGame(game.id, platform)
    } catch (e) {
      setError('Launch failed: ' + e.message)
    } finally {
      setLaunching(null)
    }
  }

  const label = PLATFORM_LABEL[platform] ?? platform.toUpperCase()

  return (
    <div className="w-full h-full flex flex-col">
      <SessionBar
        user={user}
        session={session}
        onLogout={async () => { await window.kiosk.logout(); onLogout() }}
        onAdmin={() => navigate('admin')}
      />

      {/* Header */}
      <div className="flex items-center gap-4 px-8 py-5 border-b border-steam-border shrink-0">
        <button
          className="text-steam-muted hover:text-steam-blue transition-colors text-xl"
          onClick={() => navigate('home')}
        >
          ← Back
        </button>
        <h2 className="text-2xl font-bold text-steam-text">{label}</h2>
        {!busy && (
          <span className="text-steam-muted text-sm ml-2">
            {games.length} game{games.length !== 1 ? 's' : ''} installed
          </span>
        )}
      </div>

      {/* Search bar */}
      {!busy && games.length > 0 && (
        <div className="px-6 pt-4 shrink-0">
          <input
            className="input-field w-full"
            placeholder={`Search ${label} games…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>
      )}

      {/* Game list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 animate-fade-in">
        {busy && (
          <div className="flex items-center justify-center h-full text-steam-muted animate-pulse">
            Scanning games…
          </div>
        )}

        {!busy && error && (
          <div className="text-steam-red text-center mt-8">{error}</div>
        )}

        {!busy && !error && games.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-steam-muted">
            <span className="text-5xl">🎮</span>
            <p className="text-xl">No {label} games installed</p>
            <p className="text-sm">Install games through the {label} client first.</p>
          </div>
        )}

        {!busy && (() => {
          const filtered = search.trim()
            ? games.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
            : games
          return filtered.length === 0 && search.trim() ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-steam-muted">
              <p>No games matching <span className="text-steam-text">"{search}"</span></p>
            </div>
          ) : filtered.map(game => (
            <div
              key={game.id}
              className={`game-row ${launching === game.id ? 'opacity-60 pointer-events-none' : ''}`}
              onClick={() => launch(game)}
            >
              <div className="w-10 h-10 rounded bg-steam-card border border-steam-border flex items-center justify-center text-steam-muted text-lg shrink-0">
                🎮
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-steam-text truncate">{game.name}</p>
                <p className="text-xs text-steam-muted">{label}</p>
              </div>
              {launching === game.id
                ? <span className="text-steam-muted text-sm animate-pulse">Launching…</span>
                : <span className="text-steam-blue text-sm opacity-0 group-hover:opacity-100">▶ Play</span>
              }
            </div>
          ))
        })()}
      </div>
    </div>
  )
}
