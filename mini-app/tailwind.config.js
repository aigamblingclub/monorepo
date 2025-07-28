/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        poker: {
          green: '#0f5132',
          felt: '#1a5f3f',
          gold: '#ffd700',
          chip: {
            red: '#dc2626',
            blue: '#2563eb',
            green: '#16a34a',
            black: '#1f2937',
            white: '#f9fafb'
          }
        }
      },
      backgroundImage: {
        'felt-pattern': 'radial-gradient(circle at 50% 50%, #1a5f3f 0%, #0f5132 100%)',
        'card-back': 'linear-gradient(135deg, #1e40af 0%, #3730a3 100%)',
      },
      animation: {
        'deal-card': 'dealCard 0.5s ease-out forwards',
        'chip-stack': 'chipStack 0.3s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        dealCard: {
          '0%': { transform: 'scale(0) rotate(180deg)', opacity: '0' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        chipStack: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(255, 215, 0, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(255, 215, 0, 0.8)' },
        },
      },
      screens: {
        'xs': '375px',
      },
      scale: {
        '80': '0.8',
      }
    },
  },
  plugins: [],
} 