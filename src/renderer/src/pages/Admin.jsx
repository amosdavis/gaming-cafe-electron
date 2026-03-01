import { useState, useEffect } from 'react'
import PinPad from '../components/PinPad'

const ESRB_RATINGS = ['E', 'E10+', 'T', 'M', 'AO', '18+', 'R18+']

export default function Admin({ user, session, onClose, onLogout }) {
  const [authed,  setAuthed]  = useState(false)
  const [tab,     setTab]     = useState('credits')
  const [error,   setError]   = useState('')
  const [message, setMessage] = useState('')

  // Credits tab
  const [users,        setUsers]        = useState([])
  const [selectedUser, setSelectedUser] = useState('')
  const [creditAmt,    setCreditAmt]    = useState('1')

  // Library tab
  const [cafeGames,  setCafeGames]  = useState([])
  const [allGames,   setAllGames]   = useState([])

  // Featured tab
  const [featured,    setFeatured]    = useState([])

  // Age gate tab
  const [ratedGames, setRatedGames] = useState([])

  // History tab
  const [history, setHistory] = useState([])

  // System tab
  const [hostname, setHostname] = useState('—')

  const verifyPin = async (pin) => {
    const ok = await window.kiosk.verifyAdmin(pin)
    if (ok) { setAuthed(true); loadData() }
    else     setError('Incorrect admin PIN.')
  }

  const loadData = async () => {
    const [u, c, a, h, f, rg] = await Promise.all([
      window.kiosk.listUsers(),
      window.kiosk.getCafeGames(),
      window.kiosk.scanGames(),
      window.kiosk.sessionHistory(),
      window.kiosk.getFeaturedGames(),
      window.kiosk.getCafeGamesWithRatings(),
    ])
    setUsers(u)
    setCafeGames(c)
    setAllGames(a)
    setHistory(h)
    setFeatured(f)
    setRatedGames(rg)
    if (u.length > 0) setSelectedUser(String(u[0].id))
    // System: get hostname via navigator
    setHostname(window.location.hostname || 'localhost')
  }

  const addCredits = async () => {
    const amt = parseInt(creditAmt, 10)
    if (!selectedUser || isNaN(amt) || amt <= 0) { setError('Select a user and enter a valid amount.'); return }
    await window.kiosk.addCredits(parseInt(selectedUser), amt, 'Admin top-up')
    setMessage(`Added ${amt} credit${amt !== 1 ? 's' : ''}!`)
    setError('')
    loadData()
  }

  const addToLibrary = async (game) => {
    await window.kiosk.addCafeGame(game.id, game.platform, game.name)
    loadData()
  }

  const removeFromLibrary = async (entry) => {
    await window.kiosk.removeCafeGame(entry.game_id, entry.platform)
    loadData()
  }

  const endSession = async () => {
    await window.kiosk.endSession()
    onLogout()
  }

  const toggleFeatured = async (game) => {
    const isAlreadyFeatured = featured.some(f => f.game_id === game.id && f.platform === game.platform)
    if (isAlreadyFeatured) {
      await window.kiosk.removeFeaturedGame(game.id, game.platform)
    } else if (featured.length >= 6) {
      setError('Maximum 6 featured games allowed.')
      return
    } else {
      await window.kiosk.setFeaturedGame(game.id, game.platform, featured.length)
    }
    setError('')
    loadData()
  }

  const setRating = async (entry, rating) => {
    await window.kiosk.setCafeGameRating(entry.game_id, entry.platform, rating)
    loadData()
  }

  const toggleUnder18 = async (u) => {
    await window.kiosk.setUserAgeRestriction(u.id, !u.under_18)
    loadData()
  }

  const backupDb = async () => {
    const result = await window.kiosk.backupDb()
    if (result?.ok) setMessage('Database backed up successfully.')
    else setError('Backup failed.')
  }

  const TABS = [
    { id: 'credits',  label: '💰 Credits'       },
    { id: 'library',  label: '📚 Cafe Library'  },
    { id: 'featured', label: '⭐ Featured'       },
    { id: 'agegate',  label: '🔞 Age Gate'       },
    { id: 'users',    label: '👤 Users'          },
    { id: 'history',  label: '📋 History'        },
    { id: 'system',   label: '⚙ System'          },
  ]

  if (!authed) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
        <div className="bg-steam-panel border border-steam-border rounded-2xl p-10 flex flex-col items-center gap-6 w-96">
          <h2 className="text-2xl font-bold text-steam-text">Admin Access</h2>
          <p className="text-steam-muted text-sm">Enter admin PIN to continue</p>
          {error && <p className="text-steam-red text-sm">{error}</p>}
          <PinPad onSubmit={verifyPin} onCancel={onClose} />
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-steam-panel border border-steam-border rounded-2xl w-[900px] max-h-[90vh] flex flex-col overflow-hidden">

        {/* Title bar */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-steam-border shrink-0">
          <h2 className="text-xl font-bold text-steam-text">⚙ Admin Panel</h2>
          <button className="text-steam-muted hover:text-steam-text transition-colors text-2xl" onClick={onClose}>✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar tabs */}
          <div className="w-48 border-r border-steam-border flex flex-col gap-1 p-3 shrink-0 overflow-y-auto">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors
                  ${tab === t.id
                    ? 'bg-steam-blue/20 text-steam-blue border border-steam-blue/30'
                    : 'text-steam-muted hover:text-steam-text hover:bg-steam-card'}`}
                onClick={() => { setTab(t.id); setError(''); setMessage('') }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {error   && <div className="mb-4 px-4 py-2 bg-steam-red/20 border border-steam-red/50 rounded-lg text-steam-red text-sm">{error}</div>}
            {message && <div className="mb-4 px-4 py-2 bg-steam-green/20 border border-steam-green/50 rounded-lg text-steam-green text-sm">{message}</div>}

            {/* Credits tab */}
            {tab === 'credits' && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <h3 className="font-bold text-steam-text">Add Credits to User</h3>
                <select className="input-field" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
                  {users.map(u => (
                    <option key={u.id} value={u.id} className="bg-steam-panel">
                      {u.username}{u.display_name ? ` (${u.display_name})` : ''} — {u.credits} credit{u.credits !== 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
                <div className="flex gap-3">
                  {[1,5,10,20,50].map(n => (
                    <button key={n}
                      className={`flex-1 py-3 rounded-lg font-bold border transition-colors ${creditAmt === String(n) ? 'bg-steam-blue/20 border-steam-blue text-steam-blue' : 'border-steam-border text-steam-muted hover:border-steam-blue hover:text-steam-blue'}`}
                      onClick={() => setCreditAmt(String(n))}
                    >+{n}</button>
                  ))}
                </div>
                <input className="input-field" type="number" min="1" value={creditAmt} onChange={e => setCreditAmt(e.target.value)} placeholder="Custom amount" />
                <button className="btn-primary" onClick={addCredits}>Add Credits</button>
              </div>
            )}

            {/* Library tab */}
            {tab === 'library' && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <h3 className="font-bold text-steam-text">Cafe Library</h3>
                {cafeGames.length === 0 && <p className="text-steam-muted text-sm">No games added yet.</p>}
                {cafeGames.map(cg => (
                  <div key={`${cg.game_id}::${cg.platform}`} className="flex items-center justify-between px-4 py-3 bg-steam-card rounded-lg">
                    <span className="text-steam-text font-medium">{cg.game_name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-steam-muted uppercase">{cg.platform}</span>
                      <button className="text-steam-red hover:text-steam-red/80 text-sm" onClick={() => removeFromLibrary(cg)}>Remove</button>
                    </div>
                  </div>
                ))}
                {allGames.length > 0 && (
                  <>
                    <h4 className="font-semibold text-steam-muted mt-2 text-sm">Add from installed games:</h4>
                    {allGames
                      .filter(g => !cafeGames.some(cg => cg.game_id === g.id && cg.platform === g.platform))
                      .map(g => (
                        <div key={`${g.id}::${g.platform}`} className="flex items-center justify-between px-4 py-3 bg-steam-bg rounded-lg border border-steam-border">
                          <div>
                            <span className="text-steam-text font-medium">{g.name}</span>
                            <span className="text-xs text-steam-muted ml-2 uppercase">{g.platform}</span>
                          </div>
                          <button className="btn-secondary text-sm py-1.5 px-4" onClick={() => addToLibrary(g)}>+ Add</button>
                        </div>
                      ))}
                  </>
                )}
              </div>
            )}

            {/* Featured tab */}
            {tab === 'featured' && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <h3 className="font-bold text-steam-text">Featured Games <span className="text-steam-muted font-normal text-sm">({featured.length}/6)</span></h3>
                <p className="text-steam-muted text-sm">Featured games appear as hero tiles on the home screen.</p>
                {allGames.map(g => {
                  const isFeatured = featured.some(f => f.game_id === g.id && f.platform === g.platform)
                  return (
                    <div key={`${g.id}::${g.platform}`} className={`flex items-center justify-between px-4 py-3 rounded-lg border ${isFeatured ? 'border-steam-gold/50 bg-steam-gold/5' : 'border-steam-border bg-steam-bg'}`}>
                      <div>
                        <span className="text-steam-text font-medium">{g.name}</span>
                        <span className="text-xs text-steam-muted ml-2 uppercase">{g.platform}</span>
                      </div>
                      <button
                        className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors ${isFeatured ? 'text-steam-gold border border-steam-gold/50 hover:bg-steam-gold/10' : 'btn-secondary'}`}
                        onClick={() => toggleFeatured(g)}
                      >
                        {isFeatured ? '★ Remove' : '☆ Feature'}
                      </button>
                    </div>
                  )
                })}
                {allGames.length === 0 && <p className="text-steam-muted text-sm">No installed games found. Scan first.</p>}
              </div>
            )}

            {/* Age Gate tab */}
            {tab === 'agegate' && (
              <div className="flex flex-col gap-6 animate-fade-in">
                <div>
                  <h3 className="font-bold text-steam-text mb-3">User Age Restrictions</h3>
                  <p className="text-steam-muted text-sm mb-4">Mark users as under-18 to block M/AO/18+ rated games.</p>
                  {users.map(u => (
                    <div key={u.id} className="flex items-center justify-between px-4 py-3 bg-steam-card rounded-lg mb-2">
                      <div>
                        <span className="text-steam-text font-medium">{u.username}</span>
                        {u.under_18 ? <span className="ml-2 text-xs text-steam-gold bg-steam-gold/10 border border-steam-gold/30 px-2 py-0.5 rounded">Under 18</span> : null}
                      </div>
                      <button
                        className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors ${u.under_18 ? 'text-steam-gold border border-steam-gold/50 hover:bg-steam-gold/10' : 'btn-secondary'}`}
                        onClick={() => toggleUnder18(u)}
                      >
                        {u.under_18 ? 'Remove Restriction' : 'Mark Under 18'}
                      </button>
                    </div>
                  ))}
                </div>

                <div>
                  <h3 className="font-bold text-steam-text mb-3">Cafe Game Ratings</h3>
                  <p className="text-steam-muted text-sm mb-4">Set ESRB/age ratings for games in the Cafe Library.</p>
                  {ratedGames.map(g => (
                    <div key={`${g.game_id}::${g.platform}`} className="flex items-center justify-between px-4 py-3 bg-steam-card rounded-lg mb-2">
                      <div>
                        <span className="text-steam-text font-medium">{g.game_name}</span>
                        <span className="text-xs text-steam-muted ml-2 uppercase">{g.platform}</span>
                      </div>
                      <select
                        className="input-field w-28 text-sm py-1"
                        value={g.age_rating ?? 'E'}
                        onChange={e => setRating(g, e.target.value)}
                      >
                        {ESRB_RATINGS.map(r => <option key={r} value={r} className="bg-steam-panel">{r}</option>)}
                      </select>
                    </div>
                  ))}
                  {ratedGames.length === 0 && <p className="text-steam-muted text-sm">No games in cafe library yet.</p>}
                </div>
              </div>
            )}

            {/* Users tab */}
            {tab === 'users' && (
              <div className="flex flex-col gap-3 animate-fade-in">
                <h3 className="font-bold text-steam-text">User Accounts</h3>
                {users.map(u => (
                  <div key={u.id} className="flex items-center justify-between px-4 py-3 bg-steam-card rounded-lg">
                    <div>
                      <p className="font-semibold text-steam-text">{u.username}</p>
                      {u.display_name && <p className="text-xs text-steam-muted">{u.display_name}</p>}
                      {u.under_18 ? <p className="text-xs text-steam-gold">Under 18 restriction active</p> : null}
                    </div>
                    <span className="text-steam-blue font-mono">{u.credits} credit{u.credits !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            )}

            {/* History tab */}
            {tab === 'history' && (
              <div className="flex flex-col gap-2 animate-fade-in">
                <h3 className="font-bold text-steam-text mb-2">Recent Sessions</h3>
                {history.map(s => (
                  <div key={s.id} className="px-4 py-3 bg-steam-card rounded-lg text-sm">
                    <div className="flex justify-between">
                      <span className="text-steam-text font-medium">{s.username ?? 'Unknown'}</span>
                      <span className={`font-mono text-xs px-2 py-0.5 rounded ${s.status === 'active' ? 'bg-steam-green/20 text-steam-green' : 'bg-steam-muted/20 text-steam-muted'}`}>{s.status}</span>
                    </div>
                    <div className="flex gap-4 mt-1 text-steam-muted">
                      <span>{(s.start_time ?? '').slice(0,16).replace('T',' ')}</span>
                      <span>{s.credits_used} credit{s.credits_used !== 1 ? 's' : ''}</span>
                      <span>{s.duration_display}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* System tab */}
            {tab === 'system' && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <h3 className="font-bold text-steam-text">System</h3>

                {/* F-56: Stations info (Phase 1 — this PC only) */}
                <div className="px-4 py-4 bg-steam-card rounded-lg border border-steam-border">
                  <p className="text-xs text-steam-muted uppercase font-semibold mb-3 tracking-wider">This Station</p>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-steam-muted">Host</span>
                    <span className="text-steam-text font-mono">{hostname}</span>
                    <span className="text-steam-muted">Active User</span>
                    <span className="text-steam-text">{user?.username ?? '—'}</span>
                    <span className="text-steam-muted">Session Time Left</span>
                    <span className={`font-mono ${session?.remaining_secs < 300 ? 'text-steam-gold' : 'text-steam-blue'}`}>
                      {session?.remaining_display ?? '—'}
                    </span>
                    <span className="text-steam-muted">Credits Used</span>
                    <span className="text-steam-text">{session?.credits_used ?? '—'}</span>
                  </div>
                </div>

                {/* F-46: Backup button */}
                <button className="btn-secondary text-left" onClick={backupDb}>
                  💾 Backup Database
                </button>

                <button className="btn-danger text-left" onClick={endSession}>
                  ⏹ End Current Session &amp; Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
