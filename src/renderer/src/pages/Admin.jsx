import { useState, useEffect } from 'react'
import PinPad from '../components/PinPad'

export default function Admin({ user, session, onClose, onLogout }) {
  const [authed,  setAuthed]  = useState(false)
  const [tab,     setTab]     = useState('credits')
  const [error,   setError]   = useState('')
  const [message, setMessage] = useState('')

  // Credit form
  const [users,        setUsers]        = useState([])
  const [selectedUser, setSelectedUser] = useState('')
  const [creditAmt,    setCreditAmt]    = useState('1')

  // Cafe library
  const [cafeGames,  setCafeGames]  = useState([])
  const [allGames,   setAllGames]   = useState([])

  // History
  const [history, setHistory] = useState([])

  const verifyPin = async (pin) => {
    const ok = await window.kiosk.verifyAdmin(pin)
    if (ok) {
      setAuthed(true)
      loadData()
    } else {
      setError('Incorrect admin PIN.')
    }
  }

  const loadData = async () => {
    const [u, c, a, h] = await Promise.all([
      window.kiosk.listUsers(),
      window.kiosk.getCafeGames(),
      window.kiosk.scanGames(),
      window.kiosk.sessionHistory(),
    ])
    setUsers(u)
    setCafeGames(c)
    setAllGames(a)
    setHistory(h)
    if (u.length > 0) setSelectedUser(String(u[0].id))
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

  const TABS = [
    { id: 'credits',  label: '💰 Credits'       },
    { id: 'library',  label: '📚 Cafe Library'  },
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
      <div className="bg-steam-panel border border-steam-border rounded-2xl w-[860px] max-h-[90vh] flex flex-col overflow-hidden">

        {/* Title bar */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-steam-border shrink-0">
          <h2 className="text-xl font-bold text-steam-text">⚙ Admin Panel</h2>
          <button className="text-steam-muted hover:text-steam-text transition-colors text-2xl" onClick={onClose}>✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar tabs */}
          <div className="w-48 border-r border-steam-border flex flex-col gap-1 p-3 shrink-0">
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
                <select
                  className="input-field"
                  value={selectedUser}
                  onChange={e => setSelectedUser(e.target.value)}
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id} className="bg-steam-panel">
                      {u.username}{u.display_name ? ` (${u.display_name})` : ''} — {u.credits} credit{u.credits !== 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
                <div className="flex gap-3">
                  {[1,5,10,20,50].map(n => (
                    <button
                      key={n}
                      className={`flex-1 py-3 rounded-lg font-bold border transition-colors
                        ${creditAmt === String(n)
                          ? 'bg-steam-blue/20 border-steam-blue text-steam-blue'
                          : 'border-steam-border text-steam-muted hover:border-steam-blue hover:text-steam-blue'}`}
                      onClick={() => setCreditAmt(String(n))}
                    >
                      +{n}
                    </button>
                  ))}
                </div>
                <input
                  className="input-field"
                  type="number"
                  min="1"
                  value={creditAmt}
                  onChange={e => setCreditAmt(e.target.value)}
                  placeholder="Custom amount"
                />
                <button className="btn-primary" onClick={addCredits}>Add Credits</button>
              </div>
            )}

            {/* Cafe Library tab */}
            {tab === 'library' && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <h3 className="font-bold text-steam-text">Cafe Library</h3>
                {cafeGames.length === 0 && (
                  <p className="text-steam-muted text-sm">No games added yet.</p>
                )}
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

            {/* Users tab */}
            {tab === 'users' && (
              <div className="flex flex-col gap-3 animate-fade-in">
                <h3 className="font-bold text-steam-text">User Accounts</h3>
                {users.map(u => (
                  <div key={u.id} className="flex items-center justify-between px-4 py-3 bg-steam-card rounded-lg">
                    <div>
                      <p className="font-semibold text-steam-text">{u.username}</p>
                      {u.display_name && <p className="text-xs text-steam-muted">{u.display_name}</p>}
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
                      <span className={`font-mono text-xs px-2 py-0.5 rounded ${s.status === 'active' ? 'bg-steam-green/20 text-steam-green' : 'bg-steam-muted/20 text-steam-muted'}`}>
                        {s.status}
                      </span>
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
                <button className="btn-danger text-left" onClick={endSession}>
                  ⏹ End Current Session &amp; Log Out
                </button>
                <button className="btn-secondary text-left" onClick={() => window.kiosk.openSettings()}>
                  ⚙ Open Settings
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
