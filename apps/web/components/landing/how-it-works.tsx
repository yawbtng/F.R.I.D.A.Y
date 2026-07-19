'use client';

// Three-step explainer, Browserbase-editorial: mono eyebrow, a headline with the orange
// highlighter, then three flat hairline cards that rise-and-fade in sequence. Each card carries
// a mono numeral, a line icon, a one-liner, and a tiny mock visual that previews the step.
// All colors read from semantic tokens, so it re-themes light/dark with zero conditional code.

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Mic, LayoutGrid, FileCheck, type LucideIcon } from 'lucide-react';
import { Eyebrow, Highlighter } from '@/components/landing/primitives';
import { riseAndFade, staggerContainer, inView } from '@/components/landing/animations';

// --- tiny per-step mock visuals (geometry only; color from tokens) ---

/** 01 — a few stacked mono waveform bars, a couple lit orange. */
function WaveVisual() {
  const bars = [10, 20, 13, 24, 15, 22, 12];
  return (
    <div aria-hidden className="flex items-end gap-1">
      {bars.map((h, i) => (
        <span
          key={i}
          className={`w-1 rounded-full ${i % 3 === 1 ? 'bg-accent' : 'bg-border-strong'}`}
          style={{ height: h }}
        />
      ))}
    </div>
  );
}

/** 02 — a mini 3x2 grid of tiles, one of them working (orange). */
function GridVisual() {
  return (
    <div aria-hidden className="grid w-24 grid-cols-3 gap-1.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <span
          key={i}
          className={`aspect-square rounded-sm ${i === 2 ? 'bg-accent' : 'bg-surface-2'}`}
        />
      ))}
    </div>
  );
}

/** 03 — three findings rows, each a success dot + a skeleton line. */
function ReportVisual() {
  const widths = ['w-20', 'w-14', 'w-24'];
  return (
    <div aria-hidden className="space-y-2">
      {widths.map((w, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <span className={`h-1.5 rounded-full bg-border ${w}`} />
        </div>
      ))}
    </div>
  );
}

interface Step {
  number: string;
  title: string;
  body: string;
  icon: LucideIcon;
  visual: ReactNode;
}

const STEPS: Step[] = [
  {
    number: '01',
    title: 'Speak',
    body: 'Say what to check. FRIDAY plans the targets.',
    icon: Mic,
    visual: <WaveVisual />,
  },
  {
    number: '02',
    title: 'Swarm',
    body: 'Every target gets its own cloud browser, all working side by side.',
    icon: LayoutGrid,
    visual: <GridVisual />,
  },
  {
    number: '03',
    title: 'Report',
    body: 'Findings collapse into one shareable report.',
    icon: FileCheck,
    visual: <ReportVisual />,
  },
];

export function HowItWorks() {
  return (
    <section className="py-24 sm:py-32">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={inView}
        variants={staggerContainer}
        className="mx-auto max-w-6xl px-6"
      >
        <motion.div variants={riseAndFade}>
          <Eyebrow>How it works</Eyebrow>
        </motion.div>

        <motion.h2
          variants={riseAndFade}
          className="mt-4 max-w-2xl font-display text-4xl font-medium leading-[1.05] tracking-[-0.015em] text-text sm:text-5xl"
        >
          Three steps to a <Highlighter>verified answer</Highlighter>.
        </motion.h2>

        <motion.p variants={riseAndFade} className="mt-4 max-w-xl text-lg text-text-muted">
          Voice in. Every target checked at once. One answer back.
        </motion.p>

        <motion.div
          variants={staggerContainer}
          className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <motion.article
                key={step.number}
                variants={riseAndFade}
                className="flex h-full flex-col rounded-lg border border-border bg-surface p-6 shadow-inset-top transition-colors duration-200 ease-brand hover:border-border-strong"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-accent">{step.number}</span>
                  <Icon className="h-5 w-5 text-accent" aria-hidden />
                </div>

                <h3 className="mt-5 font-display text-xl font-medium tracking-[-0.015em] text-text">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{step.body}</p>

                <div className="mt-auto flex items-end pt-8">{step.visual}</div>
              </motion.article>
            );
          })}
        </motion.div>
      </motion.div>
    </section>
  );
}
