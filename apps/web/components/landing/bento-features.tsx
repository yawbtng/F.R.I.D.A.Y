'use client';

// Capability bento, Browserbase-editorial: mono eyebrow + highlighted headline over a flat
// hairline grid. Four browser primitives plus a featured wide cell for the cloud that runs them.
// Each card is a color-blocked surface with a line icon, a mono micro-label, and a display title.
// Everything reads from semantic tokens → light/dark aware with zero conditional code.

import { motion } from 'framer-motion';
import { Globe, Search, ScanText, AudioLines, type LucideIcon } from 'lucide-react';
import { Eyebrow, Highlighter, BrandMark } from '@/components/landing/primitives';
import { riseAndFade, staggerContainer, inView } from '@/components/landing/animations';

interface Feature {
  label: string;
  title: string;
  body: string;
  icon?: LucideIcon;
  featured?: boolean;
  span?: string;
}

const FEATURES: Feature[] = [
  {
    label: 'Act',
    title: 'Browse',
    body: 'Navigate any site, click, type, scroll — like a person.',
    icon: Globe,
  },
  {
    label: 'Find',
    title: 'Search',
    body: 'Find the right page across the open web.',
    icon: Search,
  },
  {
    label: 'Parse',
    title: 'Extract',
    body: 'Pull structured data back out, on a schema.',
    icon: ScanText,
  },
  {
    label: 'Voice',
    title: 'Converse',
    body: 'Talk to it mid-run. Redirect a stuck browser or ask what it found.',
    icon: AudioLines,
  },
  {
    label: 'Infra',
    title: 'Runs on Browserbase',
    body: 'Stealth cloud browsers, live-viewable, spun up on demand — many at once.',
    featured: true,
    span: 'col-span-2',
  },
];

export function BentoFeatures() {
  return (
    <section className="py-24 sm:py-32">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={inView}
        variants={staggerContainer}
        className="mx-auto max-w-6xl px-6"
      >
        <motion.div variants={riseAndFade}>
          <Eyebrow>What it does</Eyebrow>
        </motion.div>

        <motion.h2
          variants={riseAndFade}
          className="mt-4 max-w-3xl font-display text-4xl font-medium leading-[1.05] tracking-[-0.015em] text-text sm:text-5xl"
        >
          Everything an agent needs on <Highlighter>the open web</Highlighter>.
        </motion.h2>

        <motion.p variants={riseAndFade} className="mt-4 max-w-xl text-lg text-text-muted">
          Four browser primitives, plus the cloud that runs them.
        </motion.p>

        <motion.div
          variants={staggerContainer}
          className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-3"
        >
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <motion.article
                key={f.title}
                variants={riseAndFade}
                className={`group bento-shine flex h-full flex-col rounded-lg border border-border p-6 shadow-inset-top transition-colors duration-200 ease-brand hover:border-border-strong ${
                  f.featured ? 'bg-surface-accent' : 'bg-surface'
                } ${f.span ?? ''} ${f.featured ? 'lg:col-span-2' : ''}`}
              >
                {f.featured ? (
                  <BrandMark className="h-10 w-10" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-2">
                    {Icon ? <Icon className="h-5 w-5 text-accent" aria-hidden /> : null}
                  </div>
                )}

                <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
                  {f.label}
                </p>
                <h3 className="mt-1 font-display text-lg font-medium tracking-[-0.015em] text-text">
                  {f.title}
                </h3>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-muted">{f.body}</p>
              </motion.article>
            );
          })}
        </motion.div>
      </motion.div>
    </section>
  );
}
