import { useState, useEffect } from 'react'

const KEYS = [
  ['1','2','3'],
  ['4','5','6'],
  ['7','8','9'],
  ['⌫','0','✓'],
]

/** Numeric PIN pad — fires onSubmit(pin) when ✓ pressed, or onCancel when Escape. */
export default function PinPad({ onSubmit, onCancel, maxLen = 8 }) {
  const [digits, setDigits] = useState('')

  const press = (key) => {
    if (key === '⌫') {
      setDigits(d => d.slice(0, -1))
    } else if (key === '✓') {
      if (digits.length > 0) onSubmit(digits)
    } else {
      setDigits(d => d.length < maxLen ? d + key : d)
    }
  }

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        press(e.key)
      } else if (e.key === 'Backspace') {
        press('⌫')
      } else if (e.key === 'Enter') {
        press('✓')
      } else if (e.key === 'Escape' && onCancel) {
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  // press changes every render; list only the stable deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits, onSubmit, onCancel, maxLen])

  return (
    <div className="flex flex-col items-center gap-4 animate-slide-up">
      {/* dots display */}
      <div className="flex gap-3 h-8 items-center">
        {Array.from({ length: maxLen }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full border-2 transition-all duration-150
              ${i < digits.length
                ? 'bg-steam-blue border-steam-blue shadow-glow'
                : 'bg-transparent border-steam-border'}`}
          />
        ))}
      </div>

      {/* keypad */}
      <div className="grid grid-cols-3 gap-3">
        {KEYS.flat().map(key => (
          <button
            key={key}
            className={`pin-btn ${key === '✓' ? 'text-steam-green border-steam-green/50 hover:border-steam-green hover:text-steam-green' : ''}
                        ${key === '⌫' ? 'text-steam-muted' : ''}`}
            onClick={() => press(key)}
          >
            {key}
          </button>
        ))}
      </div>

      {onCancel && (
        <button className="btn-secondary text-sm mt-1" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  )
}
