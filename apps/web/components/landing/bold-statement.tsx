'use client';

// A single full-width manifesto line — the quiet beat between louder sections. One highlighter
// mark, tight display type, nothing else. Restraint is the point. Rise-and-fade on scroll.

import { motion } from 'framer-motion';
import { Highlighter } from '@/components/landing/primitives';
import { riseAndFade, inView } from '@/components/landing/animations';

export function BoldStatement() {
  return (
    <section className="bg-bg px-6 py-24 sm:py-32">
      <motion.p
        initial="hidden"
        whileInView="visible"
        viewport={inView}
        variants={riseAndFade}
        className="mx-auto max-w-4xl text-center font-display text-[clamp(2.25rem,6vw,4.5rem)] font-medium leading-[1.05] tracking-[-0.015em] text-text"
      >
        Say it once. <Highlighter>Run it everywhere.</Highlighter>
      </motion.p>
    </section>
  );
}
