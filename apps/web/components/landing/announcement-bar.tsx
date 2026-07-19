// Thin mono announcement strip at the very top — static, fast, developer-direct.
// Links straight into the live product. Theme-aware via tokens.

import Link from 'next/link';

export function AnnouncementBar() {
  return (
    <Link
      href="/friday"
      className="group block border-b border-border bg-surface-2 focus-ring"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-6 py-2 text-center font-mono text-[11px] tracking-wide text-text-muted">
        <span className="hidden sm:inline">
          F.R.I.D.A.Y — repetitive web work, run in parallel and driven by voice
        </span>
        <span className="sm:hidden">Parallel browser automation, by voice</span>
        <span aria-hidden className="text-border-strong">·</span>
        <span className="font-medium text-text transition-colors duration-150 ease-brand group-hover:text-accent-text">
          Try the demo →
        </span>
      </div>
    </Link>
  );
}
