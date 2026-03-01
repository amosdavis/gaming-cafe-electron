/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{jsx,js,html}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        steam: {
          bg:      '#0d1117',
          panel:   '#161b22',
          card:    '#1b2838',
          hover:   '#2a475e',
          border:  '#30363d',
          blue:    '#66c0f4',
          bluedim: '#4c7a8c',
          text:    '#c6d4df',
          muted:   '#8899a6',
          green:   '#a3cf6f',
          gold:    '#f0a04b',
          red:     '#e74c3c',
        }
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glow:     '0 0 20px rgba(102,192,244,0.45)',
        'glow-lg':'0 0 40px rgba(102,192,244,0.6)',
        gold:     '0 0 20px rgba(240,160,75,0.5)',
        green:    '0 0 20px rgba(163,207,111,0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-up':   'slideUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      }
    }
  },
  plugins: []
}
