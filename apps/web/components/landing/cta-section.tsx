'use client';

// The closing band: orange-forward, centered, a soft radial accent glow bleeding out from
// behind the headline. One editorial line with the highlighter over "a swarm", then the two
// canonical CTAs — the primary swarm launch and a secondary GitHub link. All token-driven.

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Eyebrow, Highlighter, ctaPrimary, ctaSecondary } from '@/components/landing/primitives';
import { riseAndFade, staggerContainer, inView } from '@/components/landing/animations';

/** Inline GitHub mark — lucide's Github is deprecated, so we draw it with currentColor. */
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.29 0 .32.22.7.83.58C20.56 22.29 24 17.8 24 12.5 24 5.87 18.63.5 12 .5Z" />
    </svg>
  );
}

export function CTASection() {
  return (
    <section className="relative overflow-hidden bg-bg px-6 py-28 sm:py-36">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, var(--accent-glow) 0%, transparent 70%)' }}
      />

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={inView}
        variants={staggerContainer}
        className="relative z-10 mx-auto max-w-3xl text-center"
      >
        <motion.div variants={riseAndFade}>
          <Eyebrow>Ready when you are</Eyebrow>
        </motion.div>

        <motion.h2
          variants={riseAndFade}
          className="mt-6 font-display text-[clamp(2.25rem,5.5vw,3.75rem)] font-medium leading-[1.05] tracking-tight text-text"
        >
          Give your voice <Highlighter>a swarm.</Highlighter>
        </motion.h2>

        <motion.p
          variants={riseAndFade}
          className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-text-muted"
        >
          Speak once. Fifty cloud browsers move at the same time. Hear the answer in seconds.
        </motion.p>

        <motion.div
          variants={riseAndFade}
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link href="/friday" className={ctaPrimary}>
            Start a swarm →
          </Link>
          <a
            href="https://github.com/yawbtng/F.R.I.D.A.Y"
            target="_blank"
            rel="noopener noreferrer"
            className={ctaSecondary}
          >
            <GitHubMark className="h-4 w-4" />
            GitHub
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
