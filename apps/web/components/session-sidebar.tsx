'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { loadRuns, RUNS_EVENT, type RunRecord } from '@/lib/run-history';
import { RESOLVED_STATUSES } from '@/lib/report';

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const cardVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
};

const listVariants = {
  visible: {
    transition: { staggerChildren: 0.05 },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** A run's headline stat: how many targets settled with a useful answer, and whether any
 *  errored — this drives the status dot (all-good / mixed / all-failed). */
function runStats(run: RunRecord): { resolved: number; total: number; errored: number } {
  const total = run.tiles.length;
  let resolved = 0;
  let errored = 0;
  for (const t of run.tiles) {
    if (RESOLVED_STATUSES.has(t.status)) resolved++;
    if (t.status === 'error') errored++;
  }
  return { resolved, total, errored };
}

function dotColor(resolved: number, total: number): string {
  if (total === 0) return 'bg-neutral';
  if (resolved === total) return 'bg-success';
  if (resolved === 0) return 'bg-error';
  return 'bg-warning';
}

/** Read the run history and keep it fresh: on mount, whenever a run is saved/patched in this
 *  tab (RUNS_EVENT), on cross-tab writes (storage), and when the tab regains focus. */
function useRunHistory(): RunRecord[] {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const refresh = useCallback(() => setRuns(loadRuns()), []);

  useEffect(() => {
    refresh();
    window.addEventListener(RUNS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener(RUNS_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  return runs;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SessionSidebarProps {
  collapsed: boolean;
  /** The run record currently open in the report modal, if any. */
  activeSessionId?: string;
  /** Called with a run record id when the user picks a past run. */
  onSelectSession?: (runId: string) => void;
  onNewSession?: () => void;
}

export function SessionSidebar({
  collapsed,
  activeSessionId,
  onSelectSession,
  onNewSession,
}: SessionSidebarProps) {
  const runs = useRunHistory();

  return (
    <div className="h-full flex flex-col bg-surface border-r border-border">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
        {!collapsed && (
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-text-muted">
            Sessions
          </span>
        )}
        {collapsed && (
          <svg
            className="w-5 h-5 text-text-muted mx-auto"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18" />
          </svg>
        )}
      </div>

      {/* New session button */}
      {!collapsed && (
        <div className="px-3 pt-3">
          <button
            onClick={onNewSession}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-pill bg-accent text-accent-fg-strong text-xs font-semibold tracking-wide shadow-inset-top transition-[background-color,border-radius,transform] duration-200 ease-brand hover:bg-accent-hover hover:rounded-lg active:scale-[0.98] focus-ring"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Session
          </button>
        </div>
      )}

      {/* Run list */}
      <motion.div
        className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5"
        variants={listVariants}
        initial="hidden"
        animate="visible"
      >
        {runs.length === 0
          ? /* Empty state */
            !collapsed && (
              <motion.p
                variants={cardVariants}
                className="text-xs text-text-muted font-mono text-center mt-8 whitespace-pre-line"
              >
                {'No runs yet.\nStart one above.'}
              </motion.p>
            )
          : /* Run cards */
            runs.map((run) => {
              const isActive = activeSessionId === run.id;
              const { resolved, total, errored } = runStats(run);
              return (
                <motion.button
                  key={run.id}
                  variants={cardVariants}
                  onClick={() => onSelectSession?.(run.id)}
                  className={`
                  w-full text-left rounded-md px-3 py-2 text-sm transition-all duration-200 border-l-2
                  ${
                    isActive
                      ? 'bg-surface-2 text-text border-border-accent'
                      : 'text-text-muted border-transparent hover:bg-surface-2'
                  }
                `}
                >
                  {collapsed ? (
                    /* Collapsed: just the status dot */
                    <div className="flex justify-center">
                      <span className={`w-2 h-2 rounded-full ${dotColor(resolved, total)}`} />
                    </div>
                  ) : (
                    /* Expanded card */
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${dotColor(resolved, total)}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate text-text" title={run.task}>
                          {run.task || 'Untitled run'}
                        </p>
                        <p className="font-mono text-xs text-text-muted mt-0.5">
                          {relativeTime(run.ts)} · {resolved}/{total}
                          {errored ? ` · ${errored} err` : ''}
                        </p>
                      </div>
                    </div>
                  )}
                </motion.button>
              );
            })}
      </motion.div>
    </div>
  );
}
