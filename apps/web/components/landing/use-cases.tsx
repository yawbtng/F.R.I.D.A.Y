'use client';

// "WHERE IT PAYS OFF" — the use-case carousel that answers "why run ~20 cloud browsers at once?".
// Four cross-domain jobs share the same shape: one repetitive, deterministic web task repeated
// across many targets — unbearably slow one tab at a time. An auto-rotating panel pairs the copy
// (left) with a VIDEO-READY browser frame (right). Today the right visual is a deterministic mock;
// each case can later swap in a real product clip in one line (see the VIDEO SLOT comment below).
// Every animation is index-derived (never Math.random) so SSR and the first client render agree.

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { Eyebrow, Highlighter, TrafficLights } from '@/components/landing/primitives';
import { riseAndFade, staggerContainer, inView } from '@/components/landing/animations';

type UseCase = {
  domain: string;
  task: string;
  byHand: string;
  payoff: string;
  host: string;
};

const USE_CASES: UseCase[] = [
  {
    domain: 'Compliance / KYB',
    task: 'Verify 40 vendors are real, registered businesses.',
    byHand: 'Each Secretary-of-State site, checked one by one.',
    payoff: 'Forty registries, one command.',
    host: 'sos.state.__.us',
  },
  {
    domain: 'E-commerce',
    task: 'Track one product across 30 storefronts.',
    byHand: 'Thirty tabs, thirty manual price checks.',
    payoff: 'Every retailer, side by side, live.',
    host: 'shop.example.com',
  },
  {
    domain: 'Market research',
    task: 'Pull the same field from 100 company sites.',
    byHand: 'A copy-paste marathon nobody wants.',
    payoff: 'Extracted in parallel, on a schema.',
    host: 'company.example.io',
  },
  {
    domain: 'Monitoring',
    task: 'Check status or availability across dozens of portals.',
    byHand: 'Refresh, read, repeat, forever.',
    payoff: 'Fan out once, get one report back.',
    host: 'status.example.net',
  },
];

const ROTATE_MS = 4500; // auto-advance cadence
const TILE_MS = 420; // mock tick
const TILE_COUNT = 6;
const LINE_WIDTHS = ['w-full', 'w-4/5', 'w-2/3', 'w-1/2'] as const;
// Mutable arrays (never `as const`) — framer-motion's animate/ease props reject readonly tuples.
const SHIMMER = { opacity: [0.35, 0.8, 0.35] };
const CROSSFADE_EASE = [0.16, 1, 0.3, 1];

type Status = 'connecting' | 'running' | 'verified';

// Index-derived lifecycle: tile i starts running at tick 1+i, settles two ticks later. Saturates
// at 'verified' so a paused (hovered) case holds steady instead of looping forever.
function tileStatus(i: number, t: number): Status {
  const runStart = 1 + i;
  if (t >= runStart + 2) return 'verified';
  if (t >= runStart) return 'running';
  return 'connecting';
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
  return <span className={`h-2 w-2 rounded-full ${status === 'verified' ? 'bg-success' : 'bg-neutral'}`} />;
}

// The mock that fills the video slot. Remounts per case (keyed by active index) → its tick resets
// to 0 and the swarm replays. A compact 3×2 grid of mini browser tiles resolving in parallel.
function CaseVisual({ host }: { host: string }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TILE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="grid h-full grid-cols-3 grid-rows-2 gap-2.5 p-3.5 sm:gap-3 sm:p-4">
      {Array.from({ length: TILE_COUNT }).map((_, i) => {
        const status = tileStatus(i, tick);
        const label = status === 'verified' ? 'Done' : status === 'running' ? 'Running' : 'Queued';
        const labelColor =
          status === 'verified'
            ? 'text-success-fg'
            : status === 'running'
              ? 'text-accent-text'
              : 'text-text-muted';
        const border = status === 'running' ? 'border-border-accent' : 'border-border';
        return (
          <div
            key={i}
            className={`flex flex-col overflow-hidden rounded-md border bg-surface transition-colors duration-500 ease-brand ${border}`}
          >
            {/* mini chrome row */}
            <div className="flex items-center gap-1.5 border-b border-border bg-surface-2 px-2 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-border-strong" />
              <span className="h-1.5 w-1.5 rounded-full bg-border-strong" />
              <span className="truncate font-mono text-[10px] text-text-muted">
                {String(i + 1).padStart(2, '0')} {host}
              </span>
            </div>
            {/* viewport — shimmer skeleton lines */}
            <div className="flex-1 space-y-1.5 px-2 py-2.5">
              {[0, 1].map((line) => (
                <motion.span
                  key={line}
                  aria-hidden
                  className={`block h-1.5 rounded-sm bg-surface-2 ${LINE_WIDTHS[(i + line * 2) % LINE_WIDTHS.length]}`}
                  animate={SHIMMER}
                  transition={{ duration: 1.6, delay: line * 0.2 + i * 0.08, repeat: Infinity, ease: 'easeInOut' }}
                />
              ))}
            </div>
            {/* footer — status */}
            <div className="flex items-center gap-1.5 border-t border-border px-2 py-1.5">
              <StatusDot status={status} />
              <span className={`font-mono text-[10px] uppercase tracking-[0.08em] ${labelColor}`}>{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function UseCases() {
  const [active, setActive] = useState(0);

  // Auto-advance forever on a steady cadence — it moves section to section on its own, hover or
  // not. One interval on mount + a functional update: no stale closures, no re-subscribe churn.
  // Client-only, initial index 0 → SSR-safe, no hydration mismatch.
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % USE_CASES.length), ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  const current = USE_CASES[active];
  const tabBase =
    'flex items-center rounded-md border-l-2 px-3 py-2 text-left font-mono text-sm transition-colors duration-200 ease-brand focus-ring';

  return (
    <section id="use-cases" className="bg-bg py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        {/* header */}
        <motion.div initial="hidden" whileInView="visible" viewport={inView} variants={staggerContainer} className="max-w-2xl">
          <motion.div variants={riseAndFade}>
            <Eyebrow>Where it pays off</Eyebrow>
          </motion.div>
          <motion.h2
            variants={riseAndFade}
            className="mt-4 font-display text-[clamp(2rem,5vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.015em] text-text"
          >
            Any task you&rsquo;d do <Highlighter>a hundred times.</Highlighter>
          </motion.h2>
          <motion.p variants={riseAndFade} className="mt-4 max-w-xl text-lg leading-relaxed text-text-muted">
            The jobs that beg for twenty browsers at once — same steps, many targets, painfully slow one tab at a time.
          </motion.p>
        </motion.div>

        {/* auto-rotating showcase — advances on its own, continuously */}
        <div className="mt-12 grid items-center gap-8 lg:grid-cols-2">
          {/* LEFT — copy for the active case + tab selector */}
          <div>
            <div className="min-h-[9rem]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4, ease: CROSSFADE_EASE }}
                >
                  <Eyebrow>{current.domain}</Eyebrow>
                  <h3 className="mt-3 font-display text-2xl font-medium leading-tight tracking-[-0.015em] text-text sm:text-3xl">
                    {current.task}
                  </h3>
                  <p className="mt-4 text-sm text-text-muted">By hand: {current.byHand}</p>
                  <p className="mt-2 flex items-start gap-2 text-text">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-accent" aria-hidden />
                    {current.payoff}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* tab selector */}
            <div className="mt-8 flex flex-col gap-1">
              {USE_CASES.map((uc, i) => (
                <button
                  key={uc.domain}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-pressed={i === active}
                  className={`${tabBase} ${
                    i === active
                      ? 'border-border-accent bg-surface-2 text-text'
                      : 'border-transparent text-text-muted hover:text-text'
                  }`}
                >
                  {uc.domain}
                </button>
              ))}
            </div>

            {/* progress indicator */}
            <div className="mt-4 flex gap-1.5">
              {USE_CASES.map((uc, i) => (
                <span
                  key={uc.domain}
                  className={`h-1 rounded-pill transition-all duration-300 ease-brand ${
                    i === active ? 'w-8 bg-accent' : 'w-4 bg-border'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* RIGHT — video-ready browser frame */}
          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-inset-top">
            {/* chrome bar */}
            <div className="flex h-10 items-center gap-3 border-b border-border bg-surface-2 px-4">
              <TrafficLights />
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex min-w-0 items-center gap-3"
                >
                  <span className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[11px] text-text-muted">
                    {current.host}
                  </span>
                  <span className="hidden truncate font-mono text-[11px] text-text-muted md:inline">{current.task}</span>
                </motion.div>
              </AnimatePresence>
              <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-border bg-surface px-2.5 py-0.5 font-mono text-[11px] text-text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />6 in parallel
              </span>
            </div>

            {/* video-ready body */}
            <div className="aspect-video bg-surface-sunken">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.4, ease: CROSSFADE_EASE }}
                  className="h-full w-full"
                >
                  {/*
                    VIDEO SLOT: replace this mock with a <video> per use case later.
                    Swap the line below for:
                      <video src={current.clip} className="h-full w-full object-cover" autoPlay muted loop playsInline />
                    The frame, chrome bar, and crossfade all stay exactly as-is.
                  */}
                  <CaseVisual host={current.host} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
