/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: 'rgb(var(--color-dark-bg) / <alpha-value>)',
          panel: 'rgb(var(--color-dark-panel) / <alpha-value>)',
          border: 'rgb(var(--color-dark-border) / <alpha-value>)',
          surface: 'rgb(var(--color-dark-surface) / <alpha-value>)',
        },
        neon: {
          cyan: '#00f7ff',
          green: '#39ff14',
          red: '#ff003c',
          yellow: '#f4e04d',
        },
      },
      boxShadow: {
        'skeuo-flat': '8px 8px 16px #030303, -2px -2px 4px rgba(255,255,255,0.02)',
        'skeuo-pressed': 'inset 4px 4px 8px #030303, inset -1px -1px 2px rgba(255,255,255,0.02)',
        'skeuo-beveled': '2px 2px 4px rgba(0,0,0,0.5), -1px -1px 2px rgba(255,255,255,0.05)',
        'neon-glow-cyan': '0 0 10px rgba(0, 247, 255, 0.4), 0 0 20px rgba(0, 247, 255, 0.2)',
        'neon-glow-green': '0 0 10px rgba(57, 255, 20, 0.4), 0 0 20px rgba(57, 255, 20, 0.2)',
        'neon-glow-red': '0 0 10px rgba(255, 0, 60, 0.4), 0 0 20px rgba(255, 0, 60, 0.2)',
      },
      backgroundImage: {
        'metallic-gradient': 'linear-gradient(145deg, #1a1a1a, #0a0a0a)',
      },
      animation: {
        'led-blink': 'blink 1.5s infinite',
        'pulse-glow': 'pulse-glow 2s infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: 1, filter: 'brightness(1.2)' },
          '50%': { opacity: 0.4, filter: 'brightness(0.8)' },
        },
        'pulse-glow': {
          '0%, 100%': { transform: 'scale(1)', opacity: 0.8 },
          '50%': { transform: 'scale(1.05)', opacity: 1 },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        }
      },
    },
  },
  plugins: [],
}
