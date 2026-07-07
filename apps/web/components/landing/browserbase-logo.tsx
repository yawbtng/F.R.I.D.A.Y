// The Browserbase brand mark — the orange square + white "B" — recreated as an inline SVG so
// "Built on Browserbase" attributions carry the real logo, not our generic F.R.I.D.A.Y square.
// Brand colors are fixed (a logo shouldn't theme): orange #FF4500 + white. If you have the
// official SVG/PNG, drop it in apps/web/public/ and swap this for an <img>/next Image.

export function BrowserbaseMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Browserbase">
      <rect width="100" height="100" rx="22" fill="#FF4500" />
      {/* white B: left spine + two stacked bowls with square counters */}
      <g fill="#FFFFFF">
        <rect x="30" y="26" width="15" height="48" rx="2" />
        <rect x="30" y="26" width="33" height="20" rx="10" />
        <rect x="30" y="54" width="39" height="20" rx="10" />
      </g>
      <g fill="#FF4500">
        <rect x="42" y="31" width="12" height="10" rx="3" />
        <rect x="42" y="59" width="18" height="10" rx="3" />
      </g>
    </svg>
  );
}

// Full lockup: mark + "Browserbase" wordmark. `Browserbase` renders in the mono face
// (closest to the logo's geometric wordmark). Text color inherits (theme-aware).
export function BrowserbaseLogo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <BrowserbaseMark className="h-5 w-5" />
      <span className="font-mono text-base font-semibold tracking-tight">Browserbase</span>
    </span>
  );
}
