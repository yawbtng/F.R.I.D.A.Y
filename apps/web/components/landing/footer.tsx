'use client';

// Browserbase-style footer: an oversized F.R.I.D.A.Y wordmark stamp up top, hairline-divided
// link columns beneath, and a mono bottom bar. Sits on bg-surface so it reads as a distinct
// slab against the page canvas. Everything token-driven — light + dark for free.

import Link from 'next/link';
import { BrandMark } from '@/components/landing/primitives';
import { BrowserbaseMark } from '@/components/landing/browserbase-logo';

/** Inline GitHub mark — lucide's Github is deprecated, so we draw it with currentColor. */
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.29 0 .32.22.7.83.58C20.56 22.29 24 17.8 24 12.5 24 5.87 18.63.5 12 .5Z" />
    </svg>
  );
}

const linkClass =
  'inline-flex items-center gap-2 text-text-muted transition-colors duration-150 ease-brand hover:text-text focus-ring';

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-6">
        {/* Oversized brand stamp + a nod to the namesake (Tony Stark's AI) */}
        <div className="py-14 sm:py-20">
          <div className="flex items-center gap-4">
            <BrandMark className="h-8 w-8 shrink-0 sm:h-11 sm:w-11" />
            <span className="font-display text-[clamp(2.5rem,11vw,7.5rem)] font-medium leading-none tracking-tight text-text">
              F.R.I.D.A.Y
            </span>
          </div>
          <p className="mt-6 font-mono text-sm tracking-wide text-text-muted">
            Tony Stark had one. Now you do.
          </p>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-8 border-t border-border py-10 sm:gap-16">
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
              Product
            </h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link href="/friday" className={linkClass}>
                  Try it
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/yawbtng/F.R.I.D.A.Y"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  <GitHubMark className="h-3.5 w-3.5" />
                  GitHub
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
              Built with
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-text-muted">
              <li>Browserbase</li>
              <li>Stagehand</li>
              <li>Vercel AI SDK</li>
              <li>Convex</li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-border py-6 sm:flex-row">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">
            MIT · Built for the Browserbase showcase
          </p>
          <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">
            <BrowserbaseMark className="h-4 w-4" />
            Built on Browserbase
          </div>
        </div>
      </div>
    </footer>
  );
}
