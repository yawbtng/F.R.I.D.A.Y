'use client';

// Planning loader: the "assembling the swarm" moment while /api/swarm/plan is in flight (draft ->
// adversarial critique -> refine). A radar core with orbiting nodes (the fleet forming) + sonar
// pings, under a shimmering status line that cycles the planner's passes and holds on the last one
// until the real call resolves and the page moves to the review gate.

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PLAN_STEPS = [
  'Understanding the task',
  'Drafting targets',
  'Adversarially reviewing the plan',
  'Tightening goals & queries',
];

const NODES = [0, 1, 2, 3, 4, 5, 6, 7];

export function PlanningLoader() {
  const [i, setI] = useState(0);
  useEffect(() => {
    // Advance ~every 1.4s, clamping at the last step so it never loops past the real resolve.
    const id = setInterval(() => setI((x) => Math.min(x + 1, PLAN_STEPS.length - 1)), 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex h-full flex-col items-center justify-center gap-8 py-10 text-center"
    >
      {/* Radar / orbit — the fleet forming */}
      <div className="relative h-44 w-44">
        {/* sonar pings */}
        {[0, 1, 2].map((r) => (
          <motion.span
            key={r}
            className="absolute inset-0 rounded-full border border-friday-accent/40"
            initial={{ scale: 0.25, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 0 }}
            transition={{ duration: 2.6, repeat: Infinity, delay: r * 0.85, ease: 'easeOut' }}
          />
        ))}

        {/* faint static orbits */}
        <div className="absolute inset-3 rounded-full border border-white/[0.08]" />
        <div className="absolute inset-12 rounded-full border border-white/[0.05]" />

        {/* revolving ring of nodes */}
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
        >
          {NODES.map((n) => (
            <div
              key={n}
              className="absolute inset-0"
              style={{ transform: `rotate(${(n / NODES.length) * 360}deg)` }}
            >
              <motion.span
                className="absolute left-1/2 top-1 h-2 w-2 -translate-x-1/2 rounded-full bg-friday-accent shadow-glow"
                animate={{ opacity: [0.2, 1, 0.2], scale: [0.7, 1.3, 0.7] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: n * 0.18, ease: 'easeInOut' }}
              />
            </div>
          ))}
        </motion.div>

        {/* pulsing core */}
        <motion.div
          className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-friday-accent"
          style={{ boxShadow: '0 0 20px 4px rgba(59,130,246,0.6)' }}
          animate={{ scale: [1, 1.6, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Cycling status + shimmer */}
      <div className="space-y-3.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-friday-text-tertiary">
          Assembling the swarm
        </div>

        <div className="relative flex h-6 items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <span className="shimmer text-base font-medium">{PLAN_STEPS[i]}</span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* progress dots — current one stretches into a bar */}
        <div className="flex items-center justify-center gap-1.5">
          {PLAN_STEPS.map((step, idx) => (
            <motion.span
              key={step}
              className="h-1.5 rounded-full"
              animate={{
                width: idx === i ? 22 : 6,
                backgroundColor: idx <= i ? 'rgba(59,130,246,0.9)' : 'rgba(255,255,255,0.14)',
              }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        .shimmer {
          background: linear-gradient(
            90deg,
            rgba(148, 163, 184, 0.55) 0%,
            #f1f5f9 50%,
            rgba(148, 163, 184, 0.55) 100%
          );
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: shimmer 2.4s linear infinite;
        }
        @keyframes shimmer {
          from {
            background-position: 200% 0;
          }
          to {
            background-position: 0% 0;
          }
        }
      `}</style>
    </motion.div>
  );
}
