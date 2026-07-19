// Landing design primitives — the Browserbase editorial vocabulary in one place so every
// section inherits the same look: mono uppercase eyebrows, the orange highlighter marker,
// macOS traffic-light chrome, the brand mark, and the two CTA styles (with the pill
// radius-morph on hover). All read from semantic tokens → work in light + dark automatically.

import type { ReactNode } from 'react';

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

/** Mono uppercase section label. `live` adds a pinging orange dot ("something is running"). */
export function Eyebrow({
  children,
  live,
  className,
}: {
  children: ReactNode;
  live?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-text-muted',
        className,
      )}
    >
      {live && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
        </span>
      )}
      {children}
    </span>
  );
}

/** The orange highlighter marker — dark ink on an orange block, faintly tilted (Browserbase move). */
export function Highlighter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx('relative inline-block', className)}>
      <span
        aria-hidden
        className="absolute inset-x-[-0.18em] inset-y-[0.08em] -z-0 -rotate-[0.7deg] rounded-[4px] bg-accent"
      />
      <span className="relative z-10 text-accent-fg-strong">{children}</span>
    </span>
  );
}

/** macOS traffic-light dots — the universal "this is a real browser session" frame. */
export function TrafficLights({ className }: { className?: string }) {
  return (
    <div className={cx('flex items-center gap-1.5', className)}>
      <span className="h-3 w-3 rounded-full bg-wc-red" />
      <span className="h-3 w-3 rounded-full bg-wc-yellow" />
      <span className="h-3 w-3 rounded-full bg-wc-green" />
    </div>
  );
}

/** The orange brand square (echoes Browserbase's mark). Size via className, e.g. `h-5 w-5`. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx('inline-block rounded-[5px] bg-accent shadow-inset-top', className)}
    />
  );
}

// Reusable CTA class strings so any <Link>/<a> can be a branded button. The pill→lg
// radius-morph on hover is the signature tactile detail (§3.9).
export const ctaPrimary =
  'group inline-flex items-center justify-center gap-2 rounded-pill bg-accent px-6 py-3 text-sm font-semibold text-accent-fg-strong shadow-inset-top transition-[background-color,border-radius,transform] duration-200 ease-brand hover:bg-accent-hover hover:rounded-lg active:scale-[0.98] focus-ring';

export const ctaSecondary =
  'inline-flex items-center justify-center gap-2 rounded-pill border border-border bg-surface px-6 py-3 text-sm font-medium text-text transition-[background-color,border-color,border-radius,transform] duration-200 ease-brand hover:bg-surface-2 hover:border-border-strong hover:rounded-lg active:scale-[0.98] focus-ring';
