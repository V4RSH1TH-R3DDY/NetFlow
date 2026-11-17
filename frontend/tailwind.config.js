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
        brand: {
          blue: '#2563eb',
          cyan: '#06b6d4',
          emerald: '#10b981',
          rose: '#f43f5e',
          amber: '#f59e0b',
        },
        neon: {
          cyan: '#06b6d4',
          green: '#10b981',
          red: '#f43f5e',
          yellow: '#f59e0b',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
