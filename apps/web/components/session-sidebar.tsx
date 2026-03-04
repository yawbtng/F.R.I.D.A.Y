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
  active: 'bg-friday-active',
  idle: 'bg-friday-pending',
  error: 'bg-friday-error',
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
    <div className="h-full flex flex-col bg-friday-surface border-r border-friday-border">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-friday-border">
        {!collapsed && (
          <span className="text-sm font-semibold text-friday-text-primary tracking-wide uppercase">
            Sessions
          </span>
        )}
        {collapsed && (
          <svg
            className="w-5 h-5 text-friday-text-secondary mx-auto"
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
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-full bg-friday-accent text-white text-xs font-semibold tracking-wide hover:bg-friday-accent-hover transition-colors shadow-glow"
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
                className="h-14 rounded-md bg-friday-tertiary/40 animate-pulse"
              />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          /* Empty state */
          !collapsed && (
            <motion.p
              variants={cardVariants}
              className="text-xs text-friday-text-tertiary font-mono text-center mt-8"
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
                  w-full text-left rounded-md px-3 py-2.5 transition-colors
                  border border-transparent
                  ${
                    isActive
                      ? 'bg-friday-tertiary border-friday-border-active'
                      : 'hover:bg-friday-tertiary/60'
                  }
                `}
              >
                {collapsed ? (
                  /* Collapsed: just status dot */
                  <div className="flex justify-center">
                    <span
                      className={`w-2 h-2 rounded-full ${statusColors[session.status] ?? 'bg-friday-text-muted'}`}
                    />
                  </div>
                ) : (
                  /* Expanded card */
                  <div className="flex items-start gap-2.5">
                    {/* Status dot */}
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${statusColors[session.status] ?? 'bg-friday-text-muted'}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-friday-text-primary truncate">
                        {session.title || 'Untitled Session'}
                      </p>
                      <p className="text-[10px] text-friday-text-tertiary font-mono mt-0.5">
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
