import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        friday: {
          bg: '#0a0a0a',
          surface: '#0d0d0d',
          secondary: '#111111',
          tertiary: '#1a1a1a',
          border: '#222222',
          'border-hover': '#333333',
          accent: '#3b82f6',
          'accent-hover': '#60a5fa',
          'accent-glow': 'rgba(59, 130, 246, 0.15)',
          'text-primary': '#ededed',
          'text-secondary': '#888888',
          'text-tertiary': '#555555',
          active: '#22c55e',
          error: '#ef4444',
          pending: '#f59e0b',
        },
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
        md: '0 4px 12px rgba(0, 0, 0, 0.5)',
        glow: '0 0 20px rgba(59, 130, 246, 0.15)',
      },
    },
  },
  plugins: [],
};

export default config;
