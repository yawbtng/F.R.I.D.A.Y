'use client';

// Narrated planning loader: surfaces the two-pass planner's thinking (draft -> adversarial
// critique -> refine) while /api/swarm/plan is in flight. Cycles the steps on a timer and
// holds on the last one — the real call resolves and moves the page to the review gate.
// Same spirit as artifact-modal's SynthLoader, but rendered as a settling checklist.

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const PLAN_STEPS = [
  'Understanding the task…',
  'Drafting targets…',
  'Adversarially reviewing the plan…',
  'Tightening goals & queries…',
];

export function PlanningLoader() {
  const [i, setI] = useState(0);
  useEffect(() => {
    // Advance ~every 1.4s, clamping at the last step so it never loops past the real resolve.
    const id = setInterval(() => setI((x) => Math.min(x + 1, PLAN_STEPS.length - 1)), 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="glass-heavy rounded-xl p-5 max-w-md"
    >
      <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-friday-text-tertiary">
        <span className="text-friday-accent">✦</span> Planning your swarm
      </div>
      <ol className="space-y-2.5">
        {PLAN_STEPS.map((step, idx) => {
          const done = idx < i;
          const active = idx === i;
          return (
            <li key={step} className="flex items-center gap-2.5 text-sm">
              {/* Marker: spinner on the live step, check once passed, dim dot for what's ahead. */}
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {active ? (
                  <span className="h-4 w-4 rounded-full border-2 border-friday-accent/30 border-t-friday-accent animate-spin" />
                ) : done ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-friday-accent/20 text-[9px] text-friday-accent ring-1 ring-friday-accent/40">
                    ✓
                  </span>
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
                )}
              </span>
              <span
                className={
                  active
                    ? 'font-medium text-friday-text-primary'
                    : done
                      ? 'text-friday-text-secondary'
                      : 'text-friday-text-tertiary'
                }
              >
                {step}
              </span>
            </li>
          );
        })}
      </ol>
    </motion.div>
  );
}
