'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShaderBackground } from '@/components/shader-background';
import { fadeUp, staggerContainer } from '@/components/landing/animations';

function HeroOrb() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-[34%] -z-10 flex -translate-x-1/2 items-center justify-center">
      <motion.div
        className="absolute h-[420px] w-[420px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.02) 56%, transparent 76%)',
        }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute h-24 w-24 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 40% 38%, var(--accent-primary), rgba(59,130,246,0.25) 70%, transparent 100%)',
          boxShadow: '0 0 70px var(--accent-glow), 0 0 120px rgba(59,130,246,0.15)',
        }}
        animate={{ scale: [1, 1.05, 1], opacity: [0.75, 1, 0.75] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute h-5 w-5 rounded-full"
        style={{
          background:
            'radial-gradient(circle, #93c5fd 0%, var(--accent-primary) 60%, transparent 100%)',
          boxShadow: '0 0 14px rgba(147,197,253,0.65)',
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.92, 1, 0.92] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center px-6 pb-24 pt-20 sm:pt-24">
      <ShaderBackground />

      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(9,9,11,0.08) 0%, rgba(9,9,11,0.35) 58%, rgba(9,9,11,0.72) 100%)',
        }}
      />

      <HeroOrb />

      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="relative z-10 mx-auto w-full max-w-4xl rounded-2xl border border-white/[0.14] bg-[rgba(12,14,20,0.72)] px-8 py-14 backdrop-blur-[30px] shadow-[0_20px_80px_rgba(0,0,0,0.55)] glass-highlight glass-noise sm:px-14 sm:py-20"
      >
        <div className="text-center">
          <motion.div
            variants={fadeUp}
            className="mb-10 inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-black/35 px-5 py-2 text-sm text-friday-text-secondary"
          >
            <span className="h-2 w-2 rounded-full bg-friday-accent animate-pulse" />
            Powered by Browserbase + Stagehand
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-5xl font-bold leading-[1.05] tracking-tight text-friday-text-primary sm:text-7xl md:text-8xl"
          >
            Your AI co-pilot
            <br />
            <span className="animate-gradient-text">for the web.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-8 max-w-2xl text-xl leading-relaxed text-friday-text-secondary sm:text-2xl"
          >
            Speak a command. Watch a cloud browser execute it. Hear the result.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link
              href="/friday"
              className="focus-ring rounded-full bg-friday-accent/90 px-10 py-4 text-base font-semibold text-white shadow-glow transition-all duration-200 hover:bg-friday-accent-hover hover:shadow-[0_0_30px_var(--accent-glow)]"
            >
              Try Friday &rarr;
            </Link>
            <a
              href="https://github.com/yawbtng/F.R.I.D.A.Y"
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring rounded-full border border-white/[0.12] bg-white/[0.03] px-10 py-4 text-base font-medium text-friday-text-secondary backdrop-blur-lg transition-all duration-200 hover:border-white/[0.2] hover:text-friday-text-primary"
            >
              View on GitHub
            </a>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
