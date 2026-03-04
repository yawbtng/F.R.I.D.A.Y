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
    <nav className="fixed top-0 left-0 right-0 z-50 glass glass-highlight">
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
            className="text-sm font-medium px-4 py-1.5 rounded-full bg-friday-accent/90 backdrop-blur-sm text-white hover:bg-friday-accent-hover transition-all duration-200 shadow-glow hover:shadow-[0_0_30px_var(--accent-glow)] focus-ring"
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
      {/* WebGL shader background — fills hero, fades on scroll */}
      <ShaderBackground />

      <HeroOrb />

      {/* Glass card containing all hero content */}
      <motion.div
        className="relative z-10 mx-6 max-w-4xl w-full rounded-2xl glass-heavy glass-highlight glass-noise px-8 py-14 sm:px-14 sm:py-20"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        <div className="text-center">
          {/* Badge */}
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full glass text-sm text-friday-text-secondary mb-10"
          >
            <span className="w-2 h-2 rounded-full bg-friday-accent animate-pulse" />
            Powered by Browserbase + Stagehand
          </motion.div>

          {/* Headline — larger */}
          <motion.h1
            variants={fadeUp}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="text-5xl sm:text-7xl md:text-8xl font-bold tracking-tight text-friday-text-primary leading-[1.05]"
          >
            Your AI co-pilot
            <br />
            <span className="bg-gradient-to-r from-friday-accent to-blue-400 bg-clip-text text-transparent">
              for the web.
            </span>
          </motion.h1>

          {/* Subheadline — larger */}
          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="mt-8 text-xl sm:text-2xl text-friday-text-secondary max-w-2xl mx-auto leading-relaxed"
          >
            Speak a command. Watch a cloud browser execute it. Hear the result.
          </motion.p>

          {/* CTAs — larger */}
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/workspace"
              className="px-10 py-4 rounded-full bg-friday-accent/90 backdrop-blur-sm text-white font-semibold text-base hover:bg-friday-accent-hover transition-all duration-200 shadow-glow hover:shadow-[0_0_30px_var(--accent-glow)] hover:scale-[1.02] focus-ring"
            >
              Try Friday &rarr;
            </Link>
            <a
              href="https://github.com/yawbtng/F.R.I.D.A.Y"
              target="_blank"
              rel="noopener noreferrer"
              className="px-10 py-4 rounded-full glass glass-hover text-friday-text-secondary font-medium text-base hover:text-friday-text-primary transition-all duration-200 focus-ring"
            >
              View on GitHub
            </a>
          </motion.div>
        </div>
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
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 20%, rgba(59,130,246,0.25) 50%, rgba(255,255,255,0.06) 80%, transparent 100%)',
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
          className="text-4xl sm:text-5xl md:text-6xl font-bold text-friday-text-primary mb-6"
        >
          See it in action
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.08 }}
          className="text-lg sm:text-xl text-friday-text-secondary mb-16 max-w-lg mx-auto"
        >
          Watch Friday navigate, search, and extract data from the web.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
        >
          <motion.div
            className="relative rounded-xl glass-heavy glass-highlight overflow-hidden"
            animate={inView ? { y: [0, -6, 0] } : {}}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.8,
            }}
          >
            {/* Browser chrome mockup */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.03] backdrop-blur-xl">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-friday-error/60" />
                <div className="w-3 h-3 rounded-full bg-friday-pending/60" />
                <div className="w-3 h-3 rounded-full bg-friday-active/60" />
              </div>
              <div className="flex-1 mx-4">
                <div className="h-6 rounded-md bg-white/[0.04] border border-white/[0.06] flex items-center px-3">
                  <span className="text-xs text-friday-text-muted font-mono">
                    news.ycombinator.com
                  </span>
                </div>
              </div>
            </div>
            {/* Content area placeholder */}
            <div className="aspect-video bg-friday-bg/60 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-12 h-12 rounded-full glass flex items-center justify-center mx-auto">
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
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="text-4xl sm:text-5xl md:text-6xl font-bold text-friday-text-primary text-center mb-6"
        >
          Four capabilities. One voice.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
          className="text-lg sm:text-xl text-friday-text-secondary text-center mb-20 max-w-2xl mx-auto"
        >
          Everything you need to control a browser, without touching a keyboard.
        </motion.p>

        {/* Bento grid — first two cards are tall, last two side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {capabilities.map((cap, i) => (
            <motion.div
              key={cap.title}
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{
                duration: 0.5,
                ease: [0.25, 0.1, 0.25, 1],
                delay: 0.15 + i * 0.1,
              }}
              className={`group relative rounded-2xl glass glass-hover glass-highlight glass-noise overflow-hidden transition-all duration-300 hover:scale-[1.02] ${
                i < 2 ? 'p-8 sm:p-10' : 'p-8'
              }`}
            >
              {/* Ambient glow blob behind card content */}
              <div
                className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
                }}
              />

              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-friday-accent/10 border border-friday-accent/20 flex items-center justify-center text-friday-accent mb-6 group-hover:bg-friday-accent/15 group-hover:border-friday-accent/30 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.25)] transition-all duration-300">
                  {cap.icon}
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold text-friday-text-primary mb-3">
                  {cap.title}
                </h3>
                <p className="text-base text-friday-text-secondary leading-relaxed">
                  {cap.description}
                </p>
              </div>
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
        <p className="text-sm uppercase tracking-[0.2em] text-friday-text-muted mb-10 font-medium">
          Powered by
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
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
              className="text-base font-medium tracking-wide transition-all duration-200 cursor-default px-5 py-2.5 rounded-full glass-subtle hover:scale-105"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e: React.MouseEvent<HTMLSpanElement>) => {
                const el = e.target as HTMLElement;
                el.style.color = brand.color;
                el.style.boxShadow = `0 0 20px ${brand.color}33, 0 0 40px ${brand.color}11`;
                el.style.borderColor = `${brand.color}44`;
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLSpanElement>) => {
                const el = e.target as HTMLElement;
                el.style.color = 'var(--text-muted)';
                el.style.boxShadow = '';
                el.style.borderColor = '';
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
    <footer className="py-12 px-6 glass-subtle glass-highlight">
      <div className="max-w-4xl mx-auto text-center space-y-4">
        <p className="text-base text-friday-text-secondary">
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
