'use client';

import { motion } from 'framer-motion';
import { fadeUp, scaleIn, staggerContainer } from '@/components/landing/animations';

interface Step {
  number: '01' | '02' | '03';
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    number: '01',
    title: 'Say what you need',
    body: 'Talk to Friday like you\'d talk to a person. Your voice travels over WebRTC, and Deepgram turns it into text before you finish the sentence.',
  },
  {
    number: '02',
    title: 'Friday takes over',
    body: 'Claude figures out what you meant and picks the right move. Stagehand runs it in a real browser - clicking, typing, scrolling - whatever the page needs.',
  },
  {
    number: '03',
    title: 'Get the answer back',
    body: 'Friday reads you the result out loud. A screenshot shows up so you can see exactly what happened. Ask a follow-up or give it the next task.',
  },
];

function VoiceVisual() {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-7 backdrop-blur-xl">
      <div className="flex items-end justify-center gap-2">
        {[28, 44, 36, 52, 24, 40, 34].map((height, index) => (
          <motion.span
            key={height}
            className="w-2 rounded-full bg-friday-accent/80"
            style={{ height }}
            animate={{ scaleY: [0.55, 1, 0.55] }}
            transition={{ duration: 1.3, delay: index * 0.08, repeat: Infinity }}
          />
        ))}
      </div>
      <p className="mt-5 text-center font-mono text-xs text-friday-text-muted">Listening for command...</p>
    </div>
  );
}

function ExecuteVisual() {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-friday-error/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-friday-pending/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-friday-active/70" />
      </div>
      <motion.div
        className="mb-3 h-8 rounded-md border border-white/[0.08] bg-black/30"
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      />
      <div className="space-y-2">
        {[1, 2, 3].map((line) => (
          <motion.div
            key={line}
            className="h-2 rounded bg-white/[0.08]"
            animate={{ width: ['35%', '78%', '35%'] }}
            transition={{ duration: 1.9, delay: line * 0.2, repeat: Infinity }}
          />
        ))}
      </div>
    </div>
  );
}

function AnswerVisual() {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-xl">
      <div className="rounded-lg border border-white/[0.08] bg-black/25 p-3">
        <div className="h-24 rounded-md bg-gradient-to-br from-blue-500/12 via-transparent to-blue-300/6" />
      </div>
      <div className="mt-4 flex items-center justify-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-friday-accent animate-pulse" />
        <span className="font-mono text-xs text-friday-text-muted">Speaking result...</span>
      </div>
    </div>
  );
}

function StepVisual({ index }: { index: number }) {
  if (index === 0) return <VoiceVisual />;
  if (index === 1) return <ExecuteVisual />;
  return <AnswerVisual />;
}

export function HowItWorks() {
  return (
    <section className="px-6 py-32 sm:py-40">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        variants={staggerContainer}
        className="mx-auto max-w-6xl"
      >
        <motion.h2
          variants={fadeUp}
          className="text-center text-4xl font-semibold text-friday-text-primary sm:text-5xl"
        >
          How it works
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mx-auto mt-4 max-w-2xl text-center text-lg text-friday-text-secondary"
        >
          Voice in, browser action in the cloud, spoken answer out.
        </motion.p>

        <div className="mx-auto mt-14 max-w-5xl space-y-6">
          {STEPS.map((step, index) => (
            <motion.article
              key={step.number}
              variants={scaleIn}
              className="grid grid-cols-1 items-center gap-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-7 backdrop-blur-xl md:grid-cols-2 md:p-10"
            >
              <div>
                <p className="font-mono text-xs tracking-widest text-friday-text-muted">{step.number}</p>
                <h3 className="mt-3 text-3xl font-semibold leading-tight text-friday-text-primary sm:text-4xl">
                  {step.title}
                </h3>
                <p className="mt-5 text-lg leading-relaxed text-friday-text-secondary">{step.body}</p>
              </div>
              <div>
                <StepVisual index={index} />
              </div>
            </motion.article>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
