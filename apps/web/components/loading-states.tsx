'use client';

import { motion } from 'framer-motion';

// ---------------------------------------------------------------------------
// BrowserSkeleton — shimmer placeholder for the browser preview viewport
// ---------------------------------------------------------------------------

export function BrowserSkeleton() {
  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-border bg-surface-sunken"
      style={{ aspectRatio: '16 / 10' }}
    >
      {/* Shimmer sweep */}
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, var(--highlight) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Skeleton content lines */}
      <div className="absolute inset-0 flex flex-col gap-3 p-6 pt-8">
        <div className="h-4 w-3/4 rounded bg-surface-2" />
        <div className="h-4 w-1/2 rounded bg-surface-2" />
        <div className="h-4 w-5/6 rounded bg-surface-2" />
        <div className="h-4 w-2/3 rounded bg-surface-2" />
        <div className="mt-4 h-24 w-full rounded bg-surface-2" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommandSpinner — small inline spinner for pending/running commands
// ---------------------------------------------------------------------------

interface CommandSpinnerProps {
  /** Size in pixels (default 16) */
  size?: number;
}

export function CommandSpinner({ size = 16 }: CommandSpinnerProps) {
  return (
    <svg
      className="animate-spin text-accent-text"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-80"
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// SessionLoading — pulsing dots with "Creating session..." text
// ---------------------------------------------------------------------------

interface SessionLoadingProps {
  /** Custom message (default "Creating session...") */
  message?: string;
}

export function SessionLoading({ message = 'Creating session...' }: SessionLoadingProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-text-muted font-mono">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block w-1.5 h-1.5 rounded-full bg-accent"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
      <span>{message}</span>
    </div>
  );
}
