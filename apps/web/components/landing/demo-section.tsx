'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { fadeUp, staggerContainer } from '@/components/landing/animations';

const URLS = ['news.ycombinator.com', 'github.com', 'stripe.com'];
const COMMANDS = ['Extracting top stories...', 'Reading star counts...', 'Parsing pricing table...'];

export function DemoSection() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % URLS.length);
    }, 2200);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="px-6 py-32 sm:py-40">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        variants={staggerContainer}
        className="mx-auto max-w-6xl"
      >
        <motion.h2 variants={fadeUp} className="text-4xl font-semibold text-friday-text-primary sm:text-5xl">
          Live demo feel, no video required
        </motion.h2>
        <motion.p variants={fadeUp} className="mt-4 max-w-2xl text-lg text-friday-text-secondary">
          The browser mockup animates itself so the product motion is clear even before a live session starts.
        </motion.p>

        <motion.div
          variants={fadeUp}
          className="mt-12 overflow-hidden rounded-2xl border border-white/[0.1] bg-black/30 shadow-[0_30px_90px_rgba(0,0,0,0.4)] backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 border-b border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-friday-error/70" />
            <span className="h-3 w-3 rounded-full bg-friday-pending/70" />
            <span className="h-3 w-3 rounded-full bg-friday-active/70" />
            <div className="ml-3 flex-1 rounded-md border border-white/[0.08] bg-black/25 px-3 py-1.5 font-mono text-xs text-friday-text-muted">
              <AnimatePresence mode="wait">
                <motion.span
                  key={URLS[index]}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="block"
                >
                  {URLS[index]}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>

          <div className="relative aspect-[16/9] bg-gradient-to-b from-friday-bg to-black/80 p-8">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((line) => (
                <motion.div
                  key={line}
                  className="h-3 rounded-md bg-white/[0.08]"
                  style={{ width: `${85 - line * 11}%` }}
                  animate={{ opacity: [0.2, 0.8, 0.2] }}
                  transition={{ duration: 1.7, delay: line * 0.15, repeat: Infinity }}
                />
              ))}
            </div>

            <div className="pointer-events-none absolute bottom-6 right-6">
              <div className="rounded-full border border-white/[0.12] bg-black/55 px-4 py-2 font-mono text-xs text-friday-text-accent backdrop-blur-md">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={COMMANDS[index]}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                    className="block"
                  >
                    {COMMANDS[index]}
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
