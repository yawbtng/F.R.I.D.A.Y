'use client';

// Honest product telemetry — the swarm's real numbers, not vanity metrics. Three stats
// count up when scrolled into view. To dodge hydration mismatch + layout shift, the FINAL
// value renders in the server markup; the count only runs client-side after mount + in-view.
// The "~30s" stat animates just the numeric 30, keeping ~ and s as static text around it.

import { useEffect, useRef, useState } from 'react';
import { animate, motion, useInView } from 'framer-motion';
import { Eyebrow, BrandMark } from '@/components/landing/primitives';
import { riseAndFade, staggerContainer, inView, EASE_OUT_EXPO } from '@/components/landing/animations';

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

type Stat = {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  sub: string;
};

const STATS: Stat[] = [
  { value: 1, label: 'voice command', sub: 'kicks off the whole batch' },
  { value: 20, suffix: '×', label: 'in parallel', sub: 'browsers at once, not one-by-one' },
  { value: 30, prefix: '~', suffix: 's', label: 'to an answer', sub: 'instead of an afternoon of tabs' },
];

/** Tabular-nums figure that counts 0 → value once, after mount + in-view. SSR shows the final value. */
function CountUp({ value, prefix, suffix }: { value: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, margin: '-80px' });
  const [mounted, setMounted] = useState(false);
  const [display, setDisplay] = useState(value);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || !seen) return;
    const controls = animate(0, value, {
      duration: 1.4,
      ease: EASE_OUT_EXPO,
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [mounted, seen, value]);

  return (
    <span
      ref={ref}
      className="font-mono text-[clamp(2.75rem,6vw,4rem)] font-medium leading-none tracking-tight tabular-nums text-text"
    >
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

export function Telemetry() {
  return (
    <section className="relative bg-bg px-6 py-24 sm:py-28">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={inView}
        variants={staggerContainer}
        className="mx-auto max-w-5xl"
      >
        <motion.div variants={riseAndFade} className="mb-12 text-center sm:mb-16">
          <Eyebrow>By the numbers</Eyebrow>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              variants={riseAndFade}
              className={cx(
                'flex flex-col items-center gap-3 px-6 py-10 text-center',
                i > 0 && 'border-t border-border sm:border-l sm:border-t-0',
              )}
            >
              <CountUp value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-text-muted">
                {stat.label}
              </span>
              <span className="text-sm text-text-muted">{stat.sub}</span>
            </motion.div>
          ))}
        </div>

        <motion.div variants={riseAndFade} className="mt-14 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">
            <BrandMark className="h-4 w-4" />
            Built on Browserbase
          </span>
        </motion.div>
      </motion.div>
    </section>
  );
}
