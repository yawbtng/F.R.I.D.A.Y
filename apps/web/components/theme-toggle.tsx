'use client';

// Light/dark toggle for the shell header. Uses a mounted guard so the first client paint
// matches the server (avoids a hydration mismatch); the real icon appears after mount.

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={mounted ? (isDark ? 'Switch to light mode' : 'Switch to dark mode') : 'Toggle theme'}
      title={mounted ? (isDark ? 'Light mode' : 'Dark mode') : 'Toggle theme'}
      className="flex items-center justify-center w-8 h-8 rounded-md text-friday-text-secondary hover:text-friday-text-primary hover:bg-friday-tertiary transition-colors duration-150 ease-out focus-ring"
    >
      {/* Before mount, render a stable icon; after mount, show the one for the CURRENT theme. */}
      {mounted && !isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
    </button>
  );
}
