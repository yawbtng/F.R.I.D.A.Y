export function Footer() {
  return (
    <footer className="border-t border-white/[0.08] px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-sm text-friday-text-muted sm:flex-row">
        <p>Open source | MIT License | Built for the Browserbase internship showcase</p>
        <a
          href="https://github.com/yawbtng/F.R.I.D.A.Y"
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring rounded-md px-2 py-1 transition-colors hover:text-friday-text-secondary"
        >
          GitHub repository
        </a>
      </div>
    </footer>
  );
}
