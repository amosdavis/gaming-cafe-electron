import { useState, useEffect } from 'react'
import PinPad from '../components/PinPad'

export default function Login({ onLogin }) {
  const [step,      setStep]      = useState('username') // 'username' | 'pin' | 'setup'
  const [username,  setUsername]  = useState('')
  const [error,     setError]     = useState('')
  const [busy,      setBusy]      = useState(false)
  const [firstRun,  setFirstRun]  = useState(false)

  // Detect first-run (no users in DB)
  useEffect(() => {
    window.kiosk.listUsers().then(users => {
      if (users.length === 0) setFirstRun(true)
    }).catch(() => {})
  }, [])

  // First-run: show setup step
  const [setupUser, setSetupUser] = useState('')
  const [setupStep, setSetupStep] = useState('name') // 'name' | 'pin' | 'confirm'
  const [setupPin,  setSetupPin]  = useState('')

  const submitSetupName = () => {
    if (!setupUser.trim()) { setError('Enter a username.'); return }
    setError('')
    setSetupStep('pin')
  }

  const submitSetupPin = (pin) => {
    setSetupPin(pin)
    setSetupStep('confirm')
  }

  const confirmSetupPin = async (pin) => {
    if (pin !== setupPin) { setError('PINs did not match. Try again.'); setSetupStep('pin'); return }
    setBusy(true)
    try {
      const user = await window.kiosk.createUser(setupUser.trim(), pin, '')
      if (!user) { setError('Could not create user. Try a different username.'); setSetupStep('name'); return }
      await window.kiosk.addCredits(user.id, 10, 'Welcome credits')
      // Log straight in
      const loginResult = await window.kiosk.login(setupUser.trim(), pin)
      if (loginResult.ok) {
        const sessResult = await window.kiosk.getOrStartSession(loginResult.user.id)
        if (sessResult.ok) { onLogin(loginResult.user, sessResult.session); return }
      }
      setFirstRun(false)
      setStep('username')
      setUsername(setupUser.trim())
    } finally {
      setBusy(false)
    }
  }

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
      <div className="absolute inset-0 bg-gradient-radial from-steam-blue/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-8 animate-slide-up">
        <div className="text-center">
          <h1 className="text-5xl font-black text-steam-text tracking-tight">
            Gaming<span className="text-steam-blue"> Cafe</span>
          </h1>
          <p className="text-steam-muted mt-2 text-lg">
            {firstRun ? 'First-time setup — create your admin account' : 'Sign in to start playing'}
          </p>
        </div>

        {error && (
          <div className="px-6 py-3 bg-steam-red/20 border border-steam-red/50 rounded-lg text-steam-red text-sm animate-fade-in">
            {error}
          </div>
        )}

        {/* ── First-run setup ── */}
        {firstRun && setupStep === 'name' && (
          <div className="flex flex-col items-center gap-4 w-80 animate-slide-up">
            <div className="px-5 py-3 bg-steam-gold/10 border border-steam-gold/40 rounded-lg text-steam-gold text-sm text-center">
              No accounts found. Create the first admin account.
            </div>
            <input
              autoFocus
              className="input-field text-center text-xl"
              placeholder="Admin username"
              value={setupUser}
              onChange={e => setSetupUser(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitSetupName()}
            />
            <button className="btn-primary w-full text-lg" onClick={submitSetupName}>
              Set PIN →
            </button>
          </div>
        )}
        {firstRun && setupStep === 'pin' && (
          <div className="flex flex-col items-center gap-4 animate-slide-up">
            <p className="text-steam-muted">Choose a PIN for <span className="text-steam-blue font-bold">{setupUser}</span></p>
            <PinPad onSubmit={submitSetupPin} onCancel={() => setSetupStep('name')} />
          </div>
        )}
        {firstRun && setupStep === 'confirm' && (
          <div className="flex flex-col items-center gap-4 animate-slide-up">
            <p className="text-steam-muted">Confirm your PIN</p>
            <PinPad onSubmit={confirmSetupPin} onCancel={() => setSetupStep('pin')} />
          </div>
        )}

        {/* ── Normal login ── */}
        {!firstRun && step === 'username' && (
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

        {!firstRun && step === 'pin' && (
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
          <div className="text-steam-muted text-sm animate-pulse">
            {firstRun ? 'Creating account…' : 'Signing in…'}
          </div>
        )}
      </div>
    </div>
  )
}
