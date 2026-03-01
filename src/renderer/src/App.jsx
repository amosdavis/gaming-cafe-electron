import { useState, useCallback, useEffect, useRef } from 'react'
import Login        from './pages/Login'
import Home         from './pages/Home'
import Browse       from './pages/Browse'
import CafeLibrary  from './pages/CafeLibrary'
import Admin        from './pages/Admin'

export default function App() {
  const [page,    setPage]    = useState('login')
  const [params,  setParams]  = useState({})
  const [user,    setUser]    = useState(null)
  const [session, setSession] = useState(null)
  const timerRef = useRef(null)

  const navigate = useCallback((to, p = {}) => {
    setPage(to)
    setParams(p)
  }, [])

  const onLogin = useCallback((u, s) => {
    setUser(u)
    setSession(s)
    navigate('home')
  }, [navigate])

  const onLogout = useCallback(() => {
    setUser(null)
    setSession(null)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    navigate('login')
  }, [navigate])

  const onSessionUpdate = useCallback((s) => setSession(s), [])

  // F-22 + F-02: Live session timer — refresh every 30s, auto-logout on expiry
  useEffect(() => {
    if (!user || !session) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      return
    }
    timerRef.current = setInterval(async () => {
      try {
        const updated = await window.kiosk.refreshSession(user.id)
        if (!updated) return
        setSession(updated)
        if (updated.is_expired) {
          await window.kiosk.logout()
          onLogout()
        }
      } catch { /* ignore network errors */ }
    }, 30_000)
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }
  }, [user?.id, session?.id, onLogout])

  const commonProps = { user, session, onSessionUpdate, navigate, onLogout }

  return (
    <div className="w-screen h-screen overflow-hidden bg-steam-bg animate-fade-in">
      {page === 'login'   && <Login   onLogin={onLogin} />}
      {page === 'home'    && <Home    {...commonProps} />}
      {page === 'browse'  && <Browse  {...commonProps} platform={params.platform} />}
      {page === 'library' && <CafeLibrary {...commonProps} />}
      {page === 'admin'   && <Admin   {...commonProps} onClose={() => navigate('home')} />}
    </div>
  )
}
