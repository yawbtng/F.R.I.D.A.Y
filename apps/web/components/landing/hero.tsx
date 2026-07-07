'use client';

// The owned hero: a two-beat headline with the orange highlighter over a live "swarm field" —
// a deterministic scatter of browser-tile nodes, most dim, a handful pulsing orange (the ones
// "working"). Positions are computed from the index (not Math.random) so SSR and client agree —
// no hydration mismatch. Canvas is `surface-accent` (periwinkle on light, warm-dark on dark).

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Eyebrow, Highlighter, ctaPrimary, ctaSecondary } from '@/components/landing/primitives';
import { BrowserbaseMark } from '@/components/landing/browserbase-logo';
import { riseAndFade, staggerContainer } from '@/components/landing/animations';

const COLS = 9;
const ROWS = 6;

// Deterministic jittered grid of swarm nodes. `active` ones pulse orange.
const NODES = Array.from({ length: COLS * ROWS }, (_, i) => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const jx = (((i * 37) % 100) / 100 - 0.5) * 0.72;
  const jy = (((i * 61) % 100) / 100 - 0.5) * 0.72;
  return {
    x: ((col + 0.5) / COLS) * 100 + jx * (100 / COLS),
    y: ((row + 0.5) / ROWS) * 100 + jy * (100 / ROWS),
    active: i % 8 === 3,
    delay: (i % 6) * 0.4,
  };
});

function SwarmField() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {NODES.map((n, i) =>
        n.active ? (
          <motion.span
            key={i}
            className="absolute h-2 w-2 rounded-[3px] bg-accent"
            style={{ left: `${n.x}%`, top: `${n.y}%`, boxShadow: '0 0 12px var(--accent-glow)' }}
            animate={{ opacity: [0.35, 1, 0.35], scale: [1, 1.3, 1] }}
            transition={{ duration: 2.6, delay: n.delay, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : (
          <span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-[2px] bg-border-strong"
            style={{ left: `${n.x}%`, top: `${n.y}%`, opacity: 0.5 }}
          />
        ),
      )}
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-surface-accent">
      {/* dot-grid + swarm field + accent glow, blended into the next section at the bottom */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      <SwarmField />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[38%] h-[520px] w-[740px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70"
        style={{ background: 'radial-gradient(ellipse at center, var(--accent-glow) 0%, transparent 68%)' }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-bg" />

      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="relative z-10 mx-auto flex min-h-[86vh] max-w-4xl flex-col items-center justify-center px-6 py-24 text-center"
      >
        <motion.div variants={riseAndFade}>
          <Eyebrow live>Voice-driven browser swarm</Eyebrow>
        </motion.div>

        <motion.h1
          variants={riseAndFade}
          className="mt-6 font-display text-[clamp(2.75rem,7vw,5.5rem)] font-medium leading-[1.02] tracking-[-0.02em] text-text"
        >
          One command.
          <br />
          <Highlighter>The whole list.</Highlighter>
        </motion.h1>

        <motion.p
          variants={riseAndFade}
          className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-text-muted"
        >
          Verifying vendors, checking records, pulling the same field from dozens of sites —
          repetitive browser work that scales badly by hand. FRIDAY fans it out across cloud
          browsers running in parallel, and you watch and steer the whole batch by voice.
        </motion.p>

        <motion.div
          variants={riseAndFade}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Link href="/friday" className={ctaPrimary}>
            Start a swarm →
          </Link>
          <a href="#demo" className={ctaSecondary}>
            Watch it run
          </a>
        </motion.div>

        <motion.div
          variants={riseAndFade}
          className="mt-10 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted"
        >
          <BrowserbaseMark className="h-3.5 w-3.5" />
          Built on Browserbase
        </motion.div>
      </motion.div>
    </section>
  );
}
