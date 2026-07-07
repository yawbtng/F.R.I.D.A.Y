// The official Browserbase brand mark — exact paths lifted from browserbase-logo.svg (the mark
// occupies the 0 0 200 200 region of the full lockup). Brand colors are fixed (#FF4500 + white);
// a logo must not theme. Order matters: white base rect → two orange notch bars → the orange
// square whose evenodd B-cutout reveals the white beneath. Used for "Built on Browserbase"
// attributions. The full lockup (mark + wordmark) lives at /public/browserbase-logo.svg.

export function BrowserbaseMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Browserbase">
      <rect x="30" y="36" width="134" height="124" fill="#FFFFFF" />
      <path d="M111.168 116.901H83.168V109.901H111.168V116.901Z" fill="#FF4500" />
      <path d="M111.168 86.208H83.168V79.208H111.168V86.208Z" fill="#FF4500" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M200 200H0V0H200V200ZM55.4453 147.815H128.678L145.259 131.234V111.891L131.441 98.0723L142.495 87.0186V69.0557L125.914 52.4756H55.4453V147.815Z"
        fill="#FF4500"
      />
    </svg>
  );
}

// Full lockup (mark + "Browserbase" wordmark) — just render the official SVG from /public.
export function BrowserbaseLogo({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/browserbase-logo.svg" alt="Browserbase" className={className} />;
}
