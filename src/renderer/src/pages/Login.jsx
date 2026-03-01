import { useState } from 'react'
import PinPad from '../components/PinPad'

export default function Login({ onLogin }) {
  const [step,     setStep]     = useState('username') // 'username' | 'pin'
  const [username, setUsername] = useState('')
  const [error,    setError]    = useState('')
  const [busy,     setBusy]     = useState(false)

  const submitUsername = () => {
    const name = username.trim()
    if (!name) { setError('Please enter a username.'); return }
    setError('')
    setStep('pin')
  }

  const submitPin = async (pin) => {
    setBusy(true)
    setError('')
    try {
      const result = await window.kiosk.login(username.trim(), pin)
      if (!result.ok) {
        setError(result.error ?? 'Incorrect username or PIN.')
        setStep('pin')
        return
      }
      // Start or resume session
      const sessionResult = await window.kiosk.getOrStartSession(result.user.id)
      if (!sessionResult.ok) {
        setError(sessionResult.error ?? 'Could not start session.')
        return
      }
      onLogin(result.user, sessionResult.session)
    } catch (e) {
      setError('Login error: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-steam-bg">
      {/* Background gradient glow */}
      <div className="absolute inset-0 bg-gradient-radial from-steam-blue/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-8 animate-slide-up">
        {/* Logo / title */}
        <div className="text-center">
          <h1 className="text-5xl font-black text-steam-text tracking-tight">
            Gaming<span className="text-steam-blue"> Cafe</span>
          </h1>
          <p className="text-steam-muted mt-2 text-lg">Sign in to start playing</p>
        </div>

        {error && (
          <div className="px-6 py-3 bg-steam-red/20 border border-steam-red/50 rounded-lg text-steam-red text-sm animate-fade-in">
            {error}
          </div>
        )}

        {step === 'username' && (
          <div className="flex flex-col items-center gap-4 w-80 animate-slide-up">
            <input
              autoFocus
              className="input-field text-center text-xl"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitUsername()}
            />
            <button className="btn-primary w-full text-lg" onClick={submitUsername}>
              Continue →
            </button>
          </div>
        )}

        {step === 'pin' && (
          <div className="flex flex-col items-center gap-4 animate-slide-up">
            <p className="text-steam-muted">
              PIN for <span className="text-steam-blue font-bold">{username}</span>
            </p>
            <PinPad
              onSubmit={submitPin}
              onCancel={() => { setStep('username'); setError('') }}
            />
          </div>
        )}

        {busy && (
          <div className="text-steam-muted text-sm animate-pulse">Signing in…</div>
        )}
      </div>
    </div>
  )
}
