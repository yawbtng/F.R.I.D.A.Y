'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { AudioOrb } from '@/components/audio-orb';
import { fadeUp, scaleIn, staggerContainer } from '@/components/landing/animations';

interface BentoCardItem {
  title: string;
  description: string;
  spanClass: string;
  visual: ReactNode;
}

function BrowseVisual() {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
      <div className="mb-3 flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-friday-error/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-friday-pending/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-friday-active/70" />
      </div>
      <div className="mb-3 h-6 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1 font-mono text-xs text-friday-text-muted">
        https://news.ycombinator.com
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4].map((line) => (
          <motion.div
            key={line}
            className="h-2 rounded bg-white/[0.06]"
            initial={{ width: `${45 + line * 10}%`, opacity: 0.35 }}
            animate={{ opacity: [0.35, 0.65, 0.35] }}
            transition={{ duration: 1.9, delay: line * 0.18, repeat: Infinity }}
          />
        ))}
      </div>
    </div>
  );
}

function SearchVisual() {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
      <div className="flex h-10 items-center rounded-md border border-white/[0.08] bg-white/[0.03] px-3 font-mono text-xs text-friday-text-secondary">
        friday browser agent live demo
        <motion.span
          className="ml-1 inline-block h-4 w-[1px] bg-friday-text-accent"
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.1, repeat: Infinity }}
        />
      </div>
    </div>
  );
}

function ExtractVisual() {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4 font-mono text-xs">
      <p className="text-friday-text-muted">&#123;</p>
      <p className="pl-3 text-blue-300">"title": <span className="text-emerald-300">"Top Story"</span>,</p>
      <p className="pl-3 text-blue-300">"points": <span className="text-orange-300">241</span></p>
      <p className="text-friday-text-muted">&#125;</p>
    </div>
  );
}

function ConverseVisual() {
  return (
    <div className="flex items-center justify-center rounded-xl border border-white/[0.08] bg-black/20 py-6">
      <AudioOrb state="idle" className="scale-90" />
    </div>
  );
}

function BrowserbaseVisual() {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
      <div className="flex items-center gap-2 text-sm text-friday-text-secondary">
        <span className="h-2.5 w-2.5 rounded-full bg-friday-active animate-pulse" />
        Browserbase session active
      </div>
      <p className="mt-3 font-mono text-xs text-friday-text-muted">session: bb_sess_9h2a... keepAlive: true</p>
    </div>
  );
}

const CARDS: BentoCardItem[] = [
  {
    title: 'Go anywhere',
    description:
      'Any URL, any page. Click buttons, scroll feeds, fill forms - all from a voice command. No browser extensions. No screen sharing. Just say where.',
    spanClass: 'md:col-span-4 md:row-span-2',
    visual: <BrowseVisual />,
  },
  {
    title: 'Search the web',
    description:
      'Google or DuckDuckGo, hands-free. Friday searches, reads the results, and tells you what it found.',
    spanClass: 'md:col-span-2',
    visual: <SearchVisual />,
  },
  {
    title: 'Pull data out',
    description:
      'Prices, headlines, tables - Friday grabs structured data from any page and hands you clean JSON. No scrapers.',
    spanClass: 'md:col-span-2',
    visual: <ExtractVisual />,
  },
  {
    title: 'Just talk',
    description:
      'Real-time voice, not a chatbox. Interrupt mid-sentence - Friday keeps up. Under a second from your mouth to its response.',
    spanClass: 'md:col-span-3',
    visual: <ConverseVisual />,
  },
  {
    title: 'A real browser',
    description:
      'Not headless. Not simulated. A full Chromium instance on Browserbase handles every command. It persists between requests.',
    spanClass: 'md:col-span-3',
    visual: <BrowserbaseVisual />,
  },
];

export function BentoFeatures() {
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
          Built for real web work.
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-4 max-w-2xl text-lg text-friday-text-secondary"
        >
          Friday doesn&apos;t fake the browser. It runs commands in a persistent cloud Chromium session.
        </motion.p>

        <motion.div
          variants={staggerContainer}
          className="mt-12 grid grid-cols-1 gap-4 md:auto-rows-[220px] md:grid-cols-6"
        >
          {CARDS.map((card) => (
            <motion.div key={card.title} variants={scaleIn} className={`group ${card.spanClass}`}>
              <article className="bento-shine relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-xl sm:p-8">
                <div
                  className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full opacity-70"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(59,130,246,0.14) 0%, rgba(59,130,246,0.03) 45%, transparent 75%)',
                  }}
                />

                <div className="relative z-10">
                  <h3 className="text-2xl font-semibold text-friday-text-primary">{card.title}</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-friday-text-secondary sm:text-base">
                    {card.description}
                  </p>
                </div>

                <div className="relative z-10 mt-5 flex-1">{card.visual}</div>
              </article>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
