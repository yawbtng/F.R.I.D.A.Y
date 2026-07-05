'use client';

// Wraps next-themes so the app can toggle light/dark. Dark is the default (Browserbase is
// dark-first for the app); light is a fully-designed alternate. `attribute="class"` adds
// `class="light"`/`"dark"` on <html> — our globals.css puts dark on :root and overrides in
// `.light`. next-themes injects a blocking pre-hydration script → no flash of wrong theme.

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
