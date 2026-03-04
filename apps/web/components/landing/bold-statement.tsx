'use client';

import { motion } from 'framer-motion';
import { fadeUp } from '@/components/landing/animations';

export function BoldStatement() {
  return (
    <section className="px-6 py-32 sm:py-40">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        variants={fadeUp}
        className="mx-auto max-w-4xl"
      >
        <p className="text-pretty text-3xl font-normal leading-[1.2] text-friday-text-secondary sm:text-4xl md:text-5xl">
          <span className="font-semibold text-friday-text-primary">You talk. Friday browses. </span>
          Every command runs on a real Chromium browser in the cloud - not a simulator, not a
          headless script. Navigate any site, search the web, pull data, fill out forms. All by
          voice.
        </p>
      </motion.div>
    </section>
  );
}
