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
          bg: 'var(--bg-primary)',
          surface: 'var(--bg-surface)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
          elevated: 'var(--bg-elevated)',
          border: 'var(--border-default)',
          'border-hover': 'var(--border-hover)',
          'border-active': 'var(--border-active)',
          'border-subtle': 'var(--border-subtle)',
          accent: 'var(--accent-primary)',
          'accent-hover': 'var(--accent-hover)',
          'accent-glow': 'var(--accent-glow)',
          'text-primary': 'var(--text-primary)',
          'text-secondary': 'var(--text-secondary)',
          'text-muted': 'var(--text-muted)',
          'text-tertiary': 'var(--text-muted)',
          'text-accent': 'var(--text-accent)',
          active: 'var(--status-success)',
          error: 'var(--status-error)',
          pending: 'var(--status-warning)',
          info: 'var(--status-info)',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        glow: 'var(--shadow-glow)',
      },
      spacing: {
        'fri-1': 'var(--space-1)',
        'fri-2': 'var(--space-2)',
        'fri-3': 'var(--space-3)',
        'fri-4': 'var(--space-4)',
        'fri-6': 'var(--space-6)',
        'fri-8': 'var(--space-8)',
        'fri-12': 'var(--space-12)',
      },
    },
  },
  plugins: [],
};

export default config;
