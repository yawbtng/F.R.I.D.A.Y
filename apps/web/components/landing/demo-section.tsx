'use client';

// The "SEE IT WORK" proof beat: a self-animating MOCK of a fifty-browser run distilled to a
// 9-tile grid. No iframes, no network — the swarm lifecycle (connecting → running → verified)
// is driven by a single ticking counter, and every tile's schedule is derived from its index
// (never Math.random) so SSR and the first client render agree — no hydration mismatch. The
// loop gently resets so the frame always looks alive. Colors/opacity/transform animate only.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Terminal } from 'lucide-react';
import { Eyebrow, Highlighter, TrafficLights, ctaPrimary } from '@/components/landing/primitives';
import { riseAndFade, blurScaleIn, staggerContainer, inView } from '@/components/landing/animations';

// Deterministic swarm — 9 registries the mock "verifies". Order is fixed → stable across renders.
const HOSTS = [
  'sos.state.de.us',
  'opencorporates.com',
  'bizfile.sos.ca.gov',
  'sec.report',
  'sos.wa.gov',
  'sunbiz.org',
  'dos.ny.gov',
  'sos.state.tx.us',
  'sos.state.il.us',
] as const;

const LINE_WIDTHS = ['w-full', 'w-5/6', 'w-3/4', 'w-2/3', 'w-1/2'] as const;
const CYCLE = 15; // ticks per full loop; a short all-verified pause, then it resets
const TICK_MS = 480;
// Stable animate target (module const) so re-renders every tick never restart the shimmer loop.
// Not `as const` — framer-motion's animate prop needs a mutable keyframe array.
const SHIMMER = { opacity: [0.4, 0.85, 0.4] };

type Status = 'connecting' | 'running' | 'verified';

function tileStatus(i: number, t: number): Status {
  const runStart = 1 + i; // staggered start: 1..9
  const verifyStart = runStart + 2; // running lasts ~2 ticks, then settles
  if (t >= verifyStart) return 'verified';
  if (t >= runStart) return 'running';
  return 'connecting';
}

function tileTimer(i: number, t: number, status: Status): string {
  const verifyStart = 1 + i + 2;
  const shown = status === 'verified' ? verifyStart : t;
  return `${(shown * 0.7).toFixed(1)}s`;
}

function StatusDot({ status }: { status: Status }) {
  if (status === 'running') {
    return (
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
      </span>
    );
  }
  return (
    <span
      className={`h-2 w-2 rounded-full ${status === 'verified' ? 'bg-success' : 'bg-neutral'}`}
    />
  );
}

function MiniTile({
  host,
  status,
  timer,
  index,
}: {
  host: string;
  status: Status;
  timer: string;
  index: number;
}) {
  const label =
    status === 'verified' ? 'Verified' : status === 'running' ? 'Running' : 'Connecting';
  const labelColor =
    status === 'verified'
      ? 'text-success-fg'
      : status === 'running'
        ? 'text-accent-text'
        : 'text-text-muted';
  const borderColor = status === 'running' ? 'border-border-accent' : 'border-border';

  return (
    <div
      className={`overflow-hidden rounded-md border bg-surface transition-colors duration-500 ease-brand ${borderColor}`}
    >
      {/* mini chrome row */}
      <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-2.5 py-1.5">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-border-strong" />
          <span className="h-1.5 w-1.5 rounded-full bg-border-strong" />
          <span className="h-1.5 w-1.5 rounded-full bg-border-strong" />
        </span>
        <span className="truncate font-mono text-[10px] text-text-muted">{host}</span>
      </div>

      {/* viewport — shimmer skeleton lines */}
      <div className="space-y-1.5 px-2.5 py-3">
        {[0, 1, 2, 3].map((line) => (
          <motion.span
            key={line}
            aria-hidden
            className={`block h-1.5 rounded-sm bg-surface-2 ${LINE_WIDTHS[(index * 2 + line * 3) % LINE_WIDTHS.length]}`}
            animate={SHIMMER}
            transition={{
              duration: 1.6,
              delay: line * 0.18 + index * 0.08,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* footer — status + timer */}
      <div className="flex items-center justify-between border-t border-border px-2.5 py-1.5">
        <span className="flex items-center gap-1.5">
          <StatusDot status={status} />
          <span className={`font-mono text-[10px] uppercase tracking-[0.08em] ${labelColor}`}>
            {label}
          </span>
        </span>
        <span className="font-mono text-[10px] tabular-nums text-text-muted">{timer}</span>
      </div>
    </div>
  );
}

export function DemoSection() {
  // One ticking counter drives the whole swarm. SSR/first render is step 0 (all connecting) →
  // deterministic, no hydration mismatch. The interval only runs client-side.
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => s + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const t = step % CYCLE;
  const tiles = HOSTS.map((host, i) => {
    const status = tileStatus(i, t);
    return { host, status, timer: tileTimer(i, t, status) };
  });
  const verifiedCount = tiles.filter((tile) => tile.status === 'verified').length;

  return (
    <section id="demo" className="bg-bg py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        {/* header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inView}
          variants={staggerContainer}
          className="max-w-2xl"
        >
          <motion.div variants={riseAndFade}>
            <Eyebrow live>See it work</Eyebrow>
          </motion.div>
          <motion.h2
            variants={riseAndFade}
            className="mt-4 font-display text-[clamp(2rem,5vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.015em] text-text"
          >
            One pass, <Highlighter>not one at a time.</Highlighter>
          </motion.h2>
          <motion.p variants={riseAndFade} className="mt-4 text-lg leading-relaxed text-text-muted">
            One command fans out across every target on your list — each in its own cloud browser,
            side by side — and you watch them resolve live.
          </motion.p>
        </motion.div>

        {/* browser frame */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inView}
          variants={riseAndFade}
          className="mt-12 overflow-hidden rounded-lg border border-border bg-surface shadow-inset-top"
        >
          {/* chrome bar */}
          <div className="flex h-10 items-center gap-3 border-b border-border bg-surface-2 px-4">
            <TrafficLights />
            <span className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[11px] text-text-muted">
              friday.sh/swarm
            </span>
            <span className="hidden items-center gap-1.5 font-mono text-[11px] text-text-muted sm:inline-flex">
              <Terminal className="h-3 w-3" aria-hidden />
              verify 9 businesses are registered
            </span>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-2.5 py-0.5 font-mono text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              <span className="text-text-muted">
                <span className="tabular-nums text-text">{verifiedCount}</span> / 9 verified
              </span>
            </span>
          </div>

          {/* swarm grid */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={inView}
            variants={staggerContainer}
            className="grid grid-cols-2 gap-3 bg-surface-sunken p-4 sm:grid-cols-3"
          >
            {tiles.map((tile, i) => (
              <motion.div key={tile.host} variants={blurScaleIn}>
                <MiniTile host={tile.host} status={tile.status} timer={tile.timer} index={i} />
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* caption + CTA */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inView}
          variants={staggerContainer}
          className="mt-8 flex flex-col items-center gap-4 text-center"
        >
          <motion.p variants={riseAndFade} className="text-sm text-text-muted">
            A trimmed preview — a real run streams every live browser to your screen as it works.
          </motion.p>
          <motion.div variants={riseAndFade}>
            <Link href="/friday" className={ctaPrimary}>
              Try it live →
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
