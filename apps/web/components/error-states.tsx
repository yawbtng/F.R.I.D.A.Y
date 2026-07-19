'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// ---------------------------------------------------------------------------
// Shared icon components
// ---------------------------------------------------------------------------

function ErrorIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`w-5 h-5 text-error-fg ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}

function RefreshIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`w-4 h-4 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 4v6h6" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

function WifiOffIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`w-5 h-5 text-error-fg ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="2" x2="22" y1="2" y2="22" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0" />
      <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
      <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" />
      <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" />
      <path d="M5 12.86a10 10 0 0 1 5.17-2.89" />
      <line x1="12" x2="12.01" y1="20" y2="20" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Shared wrapper for consistent error styling
// ---------------------------------------------------------------------------

function ErrorWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface border border-border shadow-inset-top"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// SessionExpiredError
// ---------------------------------------------------------------------------

interface SessionExpiredErrorProps {
  /** Called when the auto-retry fires or user clicks retry */
  onRetry?: () => void;
}

export function SessionExpiredError({ onRetry }: SessionExpiredErrorProps) {
  return (
    <ErrorWrapper>
      <RefreshIcon className="text-accent-text animate-spin" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text font-medium">
          Session expired
        </p>
        <p className="text-xs text-text-muted">
          Creating a new session...
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs text-accent-text hover:text-accent-hover transition-colors font-medium"
        >
          Retry now
        </button>
      )}
    </ErrorWrapper>
  );
}

// ---------------------------------------------------------------------------
// NavigationError
// ---------------------------------------------------------------------------

interface NavigationErrorProps {
  /** What went wrong */
  message: string;
  /** Suggestion for the user */
  suggestion?: string;
  /** Retry callback */
  onRetry?: () => void;
}

export function NavigationError({ message, suggestion, onRetry }: NavigationErrorProps) {
  return (
    <ErrorWrapper>
      <ErrorIcon />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text font-medium truncate">
          {message}
        </p>
        {suggestion && (
          <p className="text-xs text-text-muted mt-0.5">
            {suggestion}
          </p>
        )}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-accent-text border border-border-accent hover:bg-[var(--accent-pulse)] transition-all duration-200"
        >
          <RefreshIcon className="text-accent-text" />
          Try again
        </button>
      )}
    </ErrorWrapper>
  );
}

// ---------------------------------------------------------------------------
// AgentDisconnectedError
// ---------------------------------------------------------------------------

interface AgentDisconnectedErrorProps {
  /** Seconds until next auto-retry (if provided, shows countdown) */
  retryInSeconds?: number;
  /** Retry callback */
  onRetry?: () => void;
}

export function AgentDisconnectedError({
  retryInSeconds,
  onRetry,
}: AgentDisconnectedErrorProps) {
  const [countdown, setCountdown] = useState(retryInSeconds ?? 0);

  useEffect(() => {
    if (retryInSeconds == null || retryInSeconds <= 0) return;
    setCountdown(retryInSeconds);

    const interval = setInterval(() => {
      setCountdown((prev: number) => {
        if (prev <= 1) {
          clearInterval(interval);
          onRetry?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [retryInSeconds, onRetry]);

  return (
    <ErrorWrapper>
      <WifiOffIcon />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text font-medium">
          Agent disconnected
        </p>
        <div className="flex items-center gap-1 text-xs text-text-muted mt-0.5">
          <span>Reconnecting</span>
          <AnimatedDots />
          {countdown > 0 && (
            <span className="ml-1 text-text-muted">
              ({countdown}s)
            </span>
          )}
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs text-accent-text hover:text-accent-hover transition-colors font-medium"
        >
          Retry now
        </button>
      )}
    </ErrorWrapper>
  );
}

// ---------------------------------------------------------------------------
// GenericError
// ---------------------------------------------------------------------------

interface GenericErrorProps {
  /** Error message to display */
  message: string;
  /** Optional action button label */
  actionLabel?: string;
  /** Optional action callback */
  onAction?: () => void;
}

export function GenericError({ message, actionLabel, onAction }: GenericErrorProps) {
  return (
    <ErrorWrapper>
      <ErrorIcon />
      <p className="flex-1 min-w-0 text-sm text-text-muted truncate">
        {message}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-accent-text border border-border-accent hover:bg-[var(--accent-pulse)] transition-all duration-200 whitespace-nowrap"
        >
          {actionLabel}
        </button>
      )}
    </ErrorWrapper>
  );
}

// ---------------------------------------------------------------------------
// AnimatedDots — "..." that cycle opacity
// ---------------------------------------------------------------------------

function AnimatedDots() {
  return (
    <span className="inline-flex gap-px">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="text-text-muted"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.3,
          }}
        >
          .
        </motion.span>
      ))}
    </span>
  );
}
