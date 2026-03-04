'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type OrbState = 'idle' | 'listening' | 'speaking';

interface AudioOrbProps {
  state: OrbState;
  /** Audio level from 0 to 1 for reactive sizing */
  audioLevel?: number;
  /** Waveform frequency data (8-12 values, each 0 to 1) */
  waveformData?: number[];
  /** Whether a browser session is active (adds overlap styling) */
  sessionActive?: boolean;
  /** Additional className for positioning overrides */
  className?: string;
}

const ORB_SIZE = 96;
const BAR_COUNT = 12;
const BAR_WIDTH = 3;

/** Generate default waveform data from a single audio level */
function generateWaveform(audioLevel: number, count: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    // Create variation around the audio level for a natural feel
    const phase = (i / count) * Math.PI * 2;
    const variation = Math.sin(phase * 2.5 + Date.now() * 0.003) * 0.3 + 0.7;
    result.push(Math.max(0.05, Math.min(1, audioLevel * variation)));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Sub-components for each state layer
// ---------------------------------------------------------------------------

/** Subtle breathing glow that persists across all states */
function CoreOrb({ state, audioLevel = 0 }: { state: OrbState; audioLevel: number }) {
  const scale = state === 'speaking' ? 1 + audioLevel * 0.06 : 1;

  return (
    <motion.div
      className="absolute inset-0 rounded-full"
      style={{
        background:
          'radial-gradient(circle at 40% 38%, var(--accent-primary), rgba(59,130,246,0.25) 70%, transparent 100%)',
        boxShadow: '0 0 30px var(--visualizer-glow), inset 0 0 20px rgba(59,130,246,0.15)',
      }}
      animate={{
        scale: [scale, scale + 0.02, scale],
        opacity: [0.85, 1, 0.85],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

/** Inner bright core — the "arc reactor" center dot */
function ReactorCore() {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: 18,
        height: 18,
        top: '50%',
        left: '50%',
        x: '-50%',
        y: '-50%',
        background:
          'radial-gradient(circle, #93c5fd 0%, var(--accent-primary) 60%, transparent 100%)',
        boxShadow: '0 0 12px rgba(147,197,253,0.6), 0 0 24px var(--visualizer-glow)',
      }}
      animate={{
        scale: [1, 1.15, 1],
        opacity: [0.9, 1, 0.9],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

/** Listening state — outer pulsing ring */
function ListeningRing() {
  return (
    <motion.div
      className="absolute inset-0 rounded-full"
      style={{
        border: '2px solid var(--accent-primary)',
        boxShadow: '0 0 24px var(--visualizer-glow), 0 0 48px var(--friday-pulse)',
      }}
      initial={{ scale: 1, opacity: 0 }}
      animate={{
        scale: [1, 1.25, 1.5],
        opacity: [0.6, 0.3, 0],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  );
}

/** Second pulse ring, offset timing for depth */
function ListeningRingSecondary() {
  return (
    <motion.div
      className="absolute inset-0 rounded-full"
      style={{
        border: '1px solid var(--accent-primary)',
      }}
      initial={{ scale: 1, opacity: 0 }}
      animate={{
        scale: [1, 1.35, 1.6],
        opacity: [0.4, 0.2, 0],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeOut',
        delay: 0.8,
      }}
    />
  );
}

/** Speaking state — waveform bars radiating outward */
function WaveformBars({ data }: { data: number[] }) {
  const angleStep = 360 / data.length;

  return (
    <>
      {data.map((amplitude, i) => {
        const angle = i * angleStep;
        const barHeight = 8 + amplitude * 22;

        return (
          <motion.div
            key={i}
            className="absolute"
            style={{
              width: BAR_WIDTH,
              height: barHeight,
              borderRadius: BAR_WIDTH / 2,
              background: 'var(--accent-primary)',
              boxShadow: `0 0 ${4 + amplitude * 8}px var(--visualizer-glow)`,
              top: '50%',
              left: '50%',
              transformOrigin: `${BAR_WIDTH / 2}px ${-(ORB_SIZE / 2 - 4)}px`,
              rotate: `${angle}deg`,
              x: -(BAR_WIDTH / 2),
              y: 0,
            }}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{
              scaleY: 1,
              opacity: 0.5 + amplitude * 0.5,
            }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 15,
              mass: 0.5,
            }}
          />
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AudioOrb({
  state,
  audioLevel = 0,
  waveformData,
  sessionActive = false,
  className = '',
}: AudioOrbProps) {
  const bars = useMemo(() => {
    if (state !== 'speaking') return [];
    return waveformData && waveformData.length >= BAR_COUNT
      ? waveformData.slice(0, BAR_COUNT)
      : generateWaveform(audioLevel, BAR_COUNT);
  }, [state, audioLevel, waveformData]);

  return (
    <div
      className={`relative flex items-center justify-center ${
        sessionActive ? '-mt-3' : ''
      } ${className}`}
      style={{
        width: ORB_SIZE + 64, // extra space for waveform bars + pulse rings
        height: ORB_SIZE + 64,
        ['--accent-primary' as string]: '#3b82f6',
        ['--visualizer-glow' as string]: 'rgba(59, 130, 246, 0.4)',
        ['--friday-pulse' as string]: 'rgba(59, 130, 246, 0.08)',
      }}
    >
      {/* Ambient background glow */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: ORB_SIZE + 40,
          height: ORB_SIZE + 40,
          background: 'radial-gradient(circle, var(--friday-pulse) 0%, transparent 70%)',
        }}
        animate={{
          scale: state === 'listening' ? [1, 1.1, 1] : state === 'speaking' ? [1, 1.05, 1] : 1,
          opacity: state === 'idle' ? 0.5 : 0.8,
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Orb container — fixed size circle */}
      <div
        className="relative rounded-full"
        style={{ width: ORB_SIZE, height: ORB_SIZE }}
      >
        {/* Base orb with breathing animation */}
        <CoreOrb state={state} audioLevel={audioLevel} />

        {/* Arc reactor center */}
        <ReactorCore />

        {/* Listening rings */}
        <AnimatePresence>
          {state === 'listening' && (
            <motion.div
              key="listening-rings"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ListeningRing />
              <ListeningRingSecondary />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Speaking waveform bars */}
        <AnimatePresence>
          {state === 'speaking' && bars.length > 0 && (
            <motion.div
              key="waveform"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <WaveformBars data={bars} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Glassy overlay for depth */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%, rgba(0,0,0,0.15) 100%)',
          }}
        />
      </div>
    </div>
  );
}
