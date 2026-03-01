import { useState, useCallback } from 'react'
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
    navigate('login')
  }, [navigate])

  const onSessionUpdate = useCallback((s) => setSession(s), [])

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
