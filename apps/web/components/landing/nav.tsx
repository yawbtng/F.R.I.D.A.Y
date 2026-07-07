'use client';

// Browserbase-style infra bar: flat, hairline, mono wordmark left, actions + theme toggle right.
// Transparent over the hero, then a glass scrim once you scroll. Fully theme-aware — the scrim
// reads the --scrim token (translucent per theme) so there's no light/dark conditional.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BrandMark } from '@/components/landing/primitives';
import { ThemeToggle } from '@/components/theme-toggle';

// Inline GitHub mark — lucide's brand icons are deprecated, so we own it locally.
function GithubMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.22-3.37-1.22-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.36 9.36 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.59.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-300 ease-brand ${
        scrolled
          ? 'border-border bg-[var(--scrim)] shadow-sm backdrop-blur-xl'
          : 'border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5 focus-ring">
          <BrandMark className="h-[18px] w-[18px]" />
          <span className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-text">
            F.R.I.D.A.Y
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          <a
            href="https://github.com/yawbtng/F.R.I.D.A.Y"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View F.R.I.D.A.Y on GitHub"
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors duration-150 ease-brand hover:bg-surface-2 hover:text-text focus-ring"
          >
            <GithubMark className="h-4 w-4" />
          </a>
          <ThemeToggle />
          <Link
            href="/friday"
            className="ml-1.5 inline-flex items-center gap-1.5 rounded-pill bg-accent px-4 py-1.5 text-sm font-semibold text-accent-fg-strong shadow-inset-top transition-[background-color,border-radius,transform] duration-200 ease-brand hover:rounded-lg hover:bg-accent-hover active:scale-[0.98] focus-ring"
          >
            Try Friday →
          </Link>
        </div>
      </div>
    </nav>
  );
}
