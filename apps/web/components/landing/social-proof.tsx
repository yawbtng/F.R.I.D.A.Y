'use client';

import { motion } from 'framer-motion';
import { fadeUp } from '@/components/landing/animations';

const STACK = ['Browserbase', 'Stagehand', 'LiveKit', 'Convex', 'Deepgram', 'Cartesia'];

export function SocialProof() {
  return (
    <section className="px-6 py-10 sm:py-14">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        variants={fadeUp}
        className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-y-3 text-sm text-friday-text-muted"
      >
        <span className="mr-2">Built with</span>
        {STACK.map((item, index) => (
          <span key={item} className="inline-flex items-center">
            <span className="transition-colors duration-200 hover:text-friday-text-secondary">
              {item}
            </span>
            {index < STACK.length - 1 ? <span className="mx-2 text-friday-text-muted">&middot;</span> : null}
          </span>
        ))}
      </motion.div>
    </section>
  );
}
