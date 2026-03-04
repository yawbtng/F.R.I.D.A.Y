'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { fadeUp, staggerContainer } from '@/components/landing/animations';

export function CTASection() {
  return (
    <section className="relative px-6 py-32 sm:py-40">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.03) 38%, transparent 72%)',
        }}
        aria-hidden="true"
      />

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        variants={staggerContainer}
        className="relative z-10 mx-auto max-w-4xl text-center"
      >
        <motion.h2
          variants={fadeUp}
          className="text-4xl font-semibold leading-tight text-friday-text-primary sm:text-5xl"
        >
          See what your voice can do.
        </motion.h2>
        <motion.p variants={fadeUp} className="mx-auto mt-5 max-w-2xl text-lg text-friday-text-secondary">
          Open source. MIT licensed. Built for the Browserbase internship showcase.
        </motion.p>

        <motion.div variants={fadeUp} className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/workspace"
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
            View source on GitHub
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
