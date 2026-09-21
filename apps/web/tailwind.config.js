/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#080808',
          subtle: '#0d0d0d',
          panel: '#111111',
          hover: '#181818',
          active: '#222222',
        },
        border: {
          subtle: '#1f1f1f',
          DEFAULT: '#262626',
          strong: '#3a3a3a',
        },
        // Strict Accent Colors: Green, Red, Blue only
        accent: {
          green: '#22c55e',
          'green-subtle': 'rgba(34, 197, 94, 0.12)',
          red: '#ef4444',
          'red-subtle': 'rgba(239, 68, 68, 0.12)',
          blue: '#3b82f6',
          'blue-subtle': 'rgba(59, 130, 246, 0.12)',
        },
        fg: {
          DEFAULT: '#ededed',
          muted: '#888888',
          subtle: '#555555',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        none: '0',
        sm: '2px',
        DEFAULT: '4px',
        md: '6px',
        lg: '8px',
      },
    },
  },
  plugins: [],
};
