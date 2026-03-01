/** Top session bar — shows user, time remaining, and action buttons.
 *  Session is refreshed by App.jsx via setInterval (F-22).
 *  This is a pure display component.
 */
export default function SessionBar({ user, session, onLogout, onAdmin }) {
  const remaining = session?.remaining_display ?? '—'
  const credits   = session?.credits_used      ?? 0
  const isLow     = session?.remaining_secs != null && session.remaining_secs > 0 && session.remaining_secs < 300
  const isCritical = session?.remaining_secs != null && session.remaining_secs > 0 && session.remaining_secs < 60

  return (
    <div className="session-bar-glow flex items-center justify-between px-8 py-3 shrink-0">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-steam-blue/20 border border-steam-blue/50 flex items-center justify-center text-steam-blue font-bold text-sm">
          {(user?.username?.[0] ?? '?').toUpperCase()}
        </div>
        <span className="text-steam-text font-semibold">{user?.username}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border transition-colors
          ${isCritical
            ? 'border-steam-red/60 text-steam-red bg-steam-red/10 animate-pulse'
            : isLow
              ? 'border-steam-gold/60 text-steam-gold bg-steam-gold/10'
              : 'border-steam-blue/40 text-steam-blue bg-steam-blue/10'}`}>
          <span className="text-xs">⏱</span>
          <span className="font-mono font-bold text-sm">{remaining}</span>
          <span className="text-xs text-steam-muted">({credits} credit{credits !== 1 ? 's' : ''})</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {onAdmin && (
          <button
            className="text-steam-muted hover:text-steam-blue transition-colors text-sm font-semibold px-4 py-2 rounded-lg hover:bg-steam-card"
            onClick={onAdmin}
          >
            ⚙ Admin
          </button>
        )}
        <button
          className="text-steam-muted hover:text-steam-red transition-colors text-sm font-semibold px-4 py-2 rounded-lg hover:bg-steam-red/10"
          onClick={onLogout}
        >
          ⏏ Log Out
        </button>
      </div>
    </div>
  )
}
