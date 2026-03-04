'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type ViewMode = 'live' | 'screenshot';

interface BrowserPreviewProps {
  /** URL of the latest screenshot image */
  screenshotUrl?: string;
  /** Browserbase debug iframe URL (live view) */
  iframeSrc?: string;
  /** Current page URL displayed in the address bar */
  currentUrl?: string;
  /** Active session ID */
  sessionId?: string;
  /** Whether the browser is currently loading/executing */
  isLoading?: boolean;
}

export function BrowserPreview({
  screenshotUrl,
  iframeSrc,
  currentUrl,
  sessionId,
  isLoading = false,
}: BrowserPreviewProps) {
  const [mode, setMode] = useState<ViewMode>(iframeSrc ? 'live' : 'screenshot');

  const displayUrl = currentUrl || 'about:blank';
  const hasLive = !!iframeSrc;
  const hasScreenshot = !!screenshotUrl;

  return (
    <div className="flex flex-col gap-3">
      {/* Browser Window */}
      <motion.div
        className="rounded-xl border border-friday-border overflow-hidden bg-friday-surface"
        animate={
          isLoading
            ? {
                boxShadow: [
                  '0 0 10px var(--accent-glow), 0 0 20px var(--accent-glow)',
                  '0 0 20px var(--accent-glow), 0 0 40px var(--accent-glow)',
                  '0 0 10px var(--accent-glow), 0 0 20px var(--accent-glow)',
                ],
              }
            : { boxShadow: 'var(--shadow-md)' }
        }
        transition={
          isLoading
            ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.3 }
        }
      >
        {/* Title Bar — macOS-style chrome */}
        <div className="flex items-center gap-3 px-4 py-3 bg-friday-secondary border-b border-friday-border">
          {/* Traffic lights */}
          <div className="flex items-center gap-[6px] shrink-0">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>

          {/* URL bar */}
          <div className="flex-1 min-w-0 mx-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-friday-bg/60 rounded-md border border-friday-border">
              {/* Lock icon */}
              <svg
                className="w-3.5 h-3.5 text-friday-text-tertiary shrink-0"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M8 1a4 4 0 0 0-4 4v2H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1V5a4 4 0 0 0-4-4zm2.5 6H5.5V5a2.5 2.5 0 1 1 5 0v2z" />
              </svg>
              <span className="text-xs font-mono text-friday-text-secondary truncate">
                {displayUrl}
              </span>
            </div>
          </div>

          {/* Reload indicator */}
          <div className="shrink-0">
            {isLoading ? (
              <svg
                className="w-4 h-4 text-friday-accent animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg
                className="w-4 h-4 text-friday-text-tertiary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M1 4v6h6" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            )}
          </div>
        </div>

        {/* Viewport */}
        <div className="relative w-full bg-friday-bg" style={{ aspectRatio: '16 / 10' }}>
          {/* Live iframe */}
          {mode === 'live' && hasLive && (
            <iframe
              src={iframeSrc}
              title="Browserbase live view"
              className="absolute inset-0 w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
            />
          )}

          {/* Screenshot with crossfade */}
          {mode === 'screenshot' && (
            <AnimatePresence mode="wait">
              {hasScreenshot ? (
                <motion.img
                  key={screenshotUrl}
                  src={screenshotUrl}
                  alt="Browser screenshot"
                  className="absolute inset-0 w-full h-full object-contain"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              ) : (
                <motion.div
                  key="empty"
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  <p className="text-friday-text-tertiary text-sm font-mono">
                    No screenshot yet
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Live mode but no iframe URL */}
          {mode === 'live' && !hasLive && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-friday-text-tertiary text-sm font-mono">
                No live view available
              </p>
            </div>
          )}

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-friday-bg/30 flex items-center justify-center pointer-events-none">
              <div className="w-8 h-8 border-2 border-friday-accent/30 border-t-friday-accent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </motion.div>

      {/* Controls bar */}
      <div className="flex items-center justify-between px-1">
        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-friday-secondary rounded-lg p-1 border border-friday-border">
          <button
            onClick={() => setMode('live')}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
              ${mode === 'live'
                ? 'bg-friday-accent/15 text-friday-accent'
                : 'text-friday-text-secondary hover:text-friday-text-primary'
              }
            `}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                mode === 'live' && hasLive ? 'bg-friday-active' : 'bg-friday-text-tertiary'
              }`}
            />
            Live
          </button>
          <button
            onClick={() => setMode('screenshot')}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
              ${mode === 'screenshot'
                ? 'bg-friday-accent/15 text-friday-accent'
                : 'text-friday-text-secondary hover:text-friday-text-primary'
              }
            `}
          >
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <rect x="1" y="1" width="10" height="10" rx="1.5" />
            </svg>
            Screenshot
          </button>
        </div>

        {/* Session ID */}
        {sessionId && (
          <div className="flex items-center gap-1.5 text-xs text-friday-text-tertiary font-mono">
            <span className="w-2 h-2 rounded-full bg-friday-active/60" />
            Session: {sessionId.slice(0, 8)}
          </div>
        )}
      </div>
    </div>
  );
}
