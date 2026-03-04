'use client';

import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { ShaderBackground } from '@/components/shader-background';

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

// ---------------------------------------------------------------------------
// Nav — glass-morphism with backdrop blur
// ---------------------------------------------------------------------------

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-friday-border/40 bg-friday-bg/60 backdrop-blur-xl supports-[backdrop-filter]:bg-friday-bg/40">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-14">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-friday-accent shadow-glow" />
          <span className="text-sm font-semibold text-friday-text-primary tracking-wide">
            F.R.I.D.A.Y.
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/yawbtng/F.R.I.D.A.Y"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-friday-text-secondary hover:text-friday-text-primary transition-colors duration-150 focus-ring rounded-md px-2 py-1 -mx-2 -my-1"
          >
            GitHub
          </a>
          <Link
            href="/workspace"
            className="text-sm font-medium px-4 py-1.5 rounded-full bg-friday-accent text-white hover:bg-friday-accent-hover transition-colors duration-150 shadow-glow focus-ring"
          >
            Try Friday &rarr;
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Hero Orb (simplified CSS-only version for landing page)
// ---------------------------------------------------------------------------

function HeroOrb() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
      {/* Outer ambient glow */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.02) 50%, transparent 70%)',
        }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Core orb */}
      <motion.div
        className="absolute w-24 h-24 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 40% 38%, var(--accent-primary), rgba(59,130,246,0.25) 70%, transparent 100%)',
          boxShadow: '0 0 60px var(--accent-glow), 0 0 120px rgba(59,130,246,0.15)',
        }}
        animate={{ scale: [1, 1.04, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Reactor center */}
      <motion.div
        className="absolute w-5 h-5 rounded-full"
        style={{
          background:
            'radial-gradient(circle, #93c5fd 0%, var(--accent-primary) 60%, transparent 100%)',
          boxShadow: '0 0 12px rgba(147,197,253,0.6)',
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.9, 1, 0.9] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-14">
      {/* Shader ripple background — fades on scroll */}
      <ShaderBackground />

      <HeroOrb />
      <motion.div
        className="relative z-10 text-center px-6 max-w-3xl mx-auto"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        {/* Badge */}
        <motion.div
          variants={fadeUp}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-friday-border/60 bg-friday-secondary/40 backdrop-blur-sm text-xs text-friday-text-secondary mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-friday-accent" />
          Powered by Browserbase + Stagehand
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={fadeUp}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-friday-text-primary leading-[1.1]"
        >
          Your AI co-pilot
          <br />
          for the web.
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          variants={fadeUp}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mt-6 text-lg sm:text-xl text-friday-text-secondary max-w-xl mx-auto leading-relaxed"
        >
          Speak. Browse. Extract. All by voice.
        </motion.p>

        {/* CTAs */}
        <motion.div
          variants={fadeUp}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/workspace"
            className="px-8 py-3 rounded-full bg-friday-accent text-white font-medium text-sm hover:bg-friday-accent-hover transition-colors duration-150 shadow-glow focus-ring"
          >
            Try Friday &rarr;
          </Link>
          <a
            href="https://github.com/yawbtng/F.R.I.D.A.Y"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3 rounded-full border border-friday-border text-friday-text-secondary text-sm font-medium hover:border-friday-border-hover hover:text-friday-text-primary transition-colors duration-150 focus-ring"
          >
            View on GitHub
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Gradient separator between sections
// ---------------------------------------------------------------------------

function GradientDivider() {
  return (
    <div className="relative h-px mx-auto max-w-4xl">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.2) 30%, rgba(59,130,246,0.3) 50%, rgba(59,130,246,0.2) 70%, transparent 100%)',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Demo section
// ---------------------------------------------------------------------------

function Demo() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="relative py-32 px-6">
      <div className="max-w-5xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="text-3xl sm:text-4xl font-bold text-friday-text-primary mb-4"
        >
          See it in action
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.08 }}
          className="text-friday-text-secondary mb-16 max-w-md mx-auto"
        >
          Watch Friday navigate, search, and extract data from the web.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
        >
          <motion.div
            className="relative rounded-xl border border-friday-border bg-friday-secondary overflow-hidden shadow-md"
            animate={inView ? { y: [0, -6, 0] } : {}}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.8,
            }}
          >
            {/* Browser chrome mockup */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-friday-border bg-friday-surface">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-friday-error/60" />
                <div className="w-3 h-3 rounded-full bg-friday-pending/60" />
                <div className="w-3 h-3 rounded-full bg-friday-active/60" />
              </div>
              <div className="flex-1 mx-4">
                <div className="h-6 rounded-md bg-friday-tertiary border border-friday-border flex items-center px-3">
                  <span className="text-xs text-friday-text-muted font-mono">
                    news.ycombinator.com
                  </span>
                </div>
              </div>
            </div>
            {/* Content area placeholder */}
            <div className="aspect-video bg-friday-bg flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-friday-accent/10 border border-friday-accent/20 flex items-center justify-center mx-auto">
                  <svg
                    className="w-5 h-5 text-friday-accent"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
                <p className="text-sm text-friday-text-muted">
                  Demo video coming soon
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

const capabilities = [
  {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    title: 'Browse',
    description: 'Navigate to any URL, click elements, fill forms — all through natural voice commands.',
  },
  {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
    title: 'Search',
    description: 'Search the web with Google or DuckDuckGo and browse through results hands-free.',
  },
  {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
    ),
    title: 'Converse',
    description: 'Real-time voice interaction powered by LiveKit, Deepgram, and Cartesia TTS.',
  },
  {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" x2="8" y1="13" y2="13" />
        <line x1="16" x2="8" y1="17" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    title: 'Extract',
    description: 'Pull structured data from any page — prices, articles, tables — returned as clean JSON.',
  },
];

function Capabilities() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="py-32 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="text-3xl sm:text-4xl font-bold text-friday-text-primary text-center mb-4"
        >
          Four capabilities. One voice.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
          className="text-friday-text-secondary text-center mb-16 max-w-lg mx-auto"
        >
          Everything you need to control a browser, without touching a keyboard.
        </motion.p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {capabilities.map((cap, i) => (
            <motion.div
              key={cap.title}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.4,
                ease: 'easeOut',
                delay: 0.15 + i * 0.1,
              }}
              className="group rounded-xl border border-friday-border bg-friday-secondary/40 p-6 hover:border-friday-border-hover hover:bg-friday-secondary/60 transition-all duration-150"
            >
              <div className="w-10 h-10 rounded-lg bg-friday-accent/10 border border-friday-accent/20 flex items-center justify-center text-friday-accent mb-4 group-hover:bg-friday-accent/15 group-hover:border-friday-accent/30 transition-colors duration-150">
                {cap.icon}
              </div>
              <h3 className="text-lg font-semibold text-friday-text-primary mb-2">
                {cap.title}
              </h3>
              <p className="text-sm text-friday-text-secondary leading-relaxed">
                {cap.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Powered By — enhanced with brand colors + better spacing
// ---------------------------------------------------------------------------

const poweredBy = [
  { name: 'Browserbase', color: '#f97316' },  // orange
  { name: 'Stagehand', color: '#a855f7' },    // purple
  { name: 'LiveKit', color: '#22c55e' },       // green
  { name: 'Convex', color: '#f43f5e' },        // rose
  { name: 'Cartesia', color: '#3b82f6' },      // blue
];

function PoweredBy() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section ref={ref} className="py-24 px-6">
      <GradientDivider />
      <motion.div
        className="max-w-4xl mx-auto text-center pt-24"
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-friday-text-muted mb-10 font-medium">
          Powered by
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {poweredBy.map((brand, i) => (
            <motion.span
              key={brand.name}
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.3,
                ease: 'easeOut',
                delay: 0.1 + i * 0.08,
              }}
              className="text-sm font-medium tracking-wide transition-colors duration-150 cursor-default"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e: React.MouseEvent<HTMLSpanElement>) => {
                (e.target as HTMLElement).style.color = brand.color;
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLSpanElement>) => {
                (e.target as HTMLElement).style.color = 'var(--text-muted)';
              }}
            >
              {brand.name}
            </motion.span>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-friday-border/30">
      <div className="max-w-4xl mx-auto text-center space-y-4">
        <p className="text-sm text-friday-text-secondary">
          Built with obsessive attention to detail. Open source.
        </p>
        <a
          href="https://github.com/yawbtng/F.R.I.D.A.Y"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs text-friday-text-muted hover:text-friday-text-secondary transition-colors duration-150 focus-ring rounded-md px-2 py-1 -mx-2 -my-1"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          yawbtng/F.R.I.D.A.Y
        </a>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-friday-bg">
      <Nav />
      <Hero />
      <GradientDivider />
      <Demo />
      <Capabilities />
      <PoweredBy />
      <Footer />
    </main>
  );
}
