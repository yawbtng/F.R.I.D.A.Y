'use client';

import { useQuery } from 'convex/react';
import { motion } from 'framer-motion';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';

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

const statusColors: Record<string, string> = {
  active: 'bg-success',
  idle: 'bg-warning',
  error: 'bg-error',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SessionSidebarProps {
  collapsed: boolean;
  activeSessionId?: string;
  onSelectSession?: (sessionId: string) => void;
  onNewSession?: () => void;
}

export function SessionSidebar({
  collapsed,
  activeSessionId,
  onSelectSession,
  onNewSession,
}: SessionSidebarProps) {
  const sessions = useQuery(api.sessions.list);

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

      {/* Session list */}
      <motion.div
        className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5"
        variants={listVariants}
        initial="hidden"
        animate="visible"
      >
        {sessions === undefined ? (
          /* Loading skeleton */
          <div className="space-y-2 mt-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 rounded-md bg-neutral-tint animate-pulse"
              />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          /* Empty state */
          !collapsed && (
            <motion.p
              variants={cardVariants}
              className="text-xs text-text-muted font-mono text-center mt-8"
            >
              No sessions yet.{'\n'}Start one above.
            </motion.p>
          )
        ) : (
          /* Session cards */
          sessions.map((session) => {
            const isActive = activeSessionId === session._id;
            return (
              <motion.button
                key={session._id}
                variants={cardVariants}
                onClick={() => onSelectSession?.(session._id)}
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
                  /* Collapsed: just status dot */
                  <div className="flex justify-center">
                    <span
                      className={`w-2 h-2 rounded-full ${statusColors[session.status] ?? 'bg-neutral'}`}
                    />
                  </div>
                ) : (
                  /* Expanded card */
                  <div className="flex items-start gap-2.5">
                    {/* Status dot */}
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${statusColors[session.status] ?? 'bg-neutral'}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {session.title || 'Untitled Session'}
                      </p>
                      <p className="font-mono text-xs text-text-muted mt-0.5">
                        {relativeTime(session.lastActiveAt)}
                      </p>
                    </div>
                  </div>
                )}
              </motion.button>
            );
          })
        )}
      </motion.div>
    </div>
  );
}
