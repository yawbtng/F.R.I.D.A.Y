'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useSessionScreenshot } from '@/hooks/use-session-screenshot';
import {
  SessionExpiredError,
  NavigationError,
  AgentDisconnectedError,
  GenericError,
} from './error-states';
import { ExportSession } from './export-session';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Error to display in the mission log */
interface ShellError {
  type: 'session-expired' | 'navigation' | 'agent-disconnected' | 'generic';
  message: string;
  suggestion?: string;
  retryInSeconds?: number;
}

/** Session data for export functionality */
interface ExportSessionData {
  title?: string;
  browserbaseSessionId: string;
  currentUrl?: string;
  status: 'active' | 'idle' | 'error';
  createdAt: number;
  commands: Array<{
    input: string;
    result?: string;
    toolsUsed?: string[];
    status: 'pending' | 'running' | 'done' | 'error';
    errorMessage?: string;
    durationMs?: number;
    screenshotUrl?: string;
    createdAt: number;
  }>;
}

type CommandStatus = 'pending' | 'running' | 'done' | 'error';

interface Command {
  _id: Id<'commands'>;
  sessionId: Id<'sessions'>;
  input: string;
  result?: string;
  screenshotId?: Id<'_storage'>;
  toolsUsed?: string[];
  status: CommandStatus;
  errorMessage?: string;
  durationMs?: number;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: CommandStatus }) {
  switch (status) {
    case 'pending':
    case 'running':
      return (
        <svg
          className="w-3.5 h-3.5 text-friday-pending animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path d="M12 2v4" />
          <path d="M12 18v4" />
          <path d="M4.93 4.93l2.83 2.83" />
          <path d="M16.24 16.24l2.83 2.83" />
          <path d="M2 12h4" />
          <path d="M18 12h4" />
          <path d="M4.93 19.07l2.83-2.83" />
          <path d="M16.24 7.76l2.83-2.83" />
        </svg>
      );
    case 'done':
      return (
        <svg
          className="w-3.5 h-3.5 text-friday-active"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case 'error':
      return (
        <svg
          className="w-3.5 h-3.5 text-friday-error"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
  }
}

function ToolBadge({ name }: { name: string }) {
  return (
    <span className="inline-block text-[10px] font-mono px-1.5 py-0.5 rounded glass-subtle text-friday-text-accent">
      {name}
    </span>
  );
}

function ScreenshotThumbnail({
  storageId,
}: {
  storageId: Id<'_storage'>;
}) {
  const url = useSessionScreenshot(storageId);
  if (!url) return null;

  return (
    <div className="mt-1.5 rounded-md overflow-hidden border border-white/[0.08] max-w-[200px]">
      <img
        src={url}
        alt="Screenshot"
        className="w-full h-auto object-cover"
        loading="lazy"
      />
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const entryVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
};

// ---------------------------------------------------------------------------
// Command entry
// ---------------------------------------------------------------------------

function CommandEntry({ command }: { command: Command }) {
  return (
    <motion.div
      variants={entryVariants}
      initial="hidden"
      animate="visible"
      className="space-y-2"
    >
      {/* User input — right aligned */}
      <div className="flex justify-end">
        <div className="max-w-[85%] px-3 py-2 rounded-lg glass text-xs text-friday-text-primary">
          {command.input}
        </div>
      </div>

      {/* Friday response — left aligned */}
      <div className="flex items-start gap-2">
        <StatusIcon status={command.status} />
        <div className="max-w-[85%] space-y-1">
          <p className="text-[10px] font-semibold text-friday-text-accent uppercase tracking-wider">
            F.R.I.D.A.Y.
          </p>

          {command.result && (
            <p className="text-xs text-friday-text-secondary font-mono leading-relaxed whitespace-pre-wrap">
              {command.result}
            </p>
          )}

          {command.status === 'error' && command.errorMessage && (
            <p className="text-xs text-friday-error font-mono">
              {command.errorMessage}
            </p>
          )}

          {(command.status === 'pending' || command.status === 'running') &&
            !command.result && (
              <p className="text-xs text-friday-text-tertiary font-mono italic">
                Processing...
              </p>
            )}

          {/* Screenshot thumbnail */}
          {command.screenshotId && (
            <ScreenshotThumbnail storageId={command.screenshotId} />
          )}

          {/* Tools used + duration */}
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {command.toolsUsed?.map((tool) => (
              <ToolBadge key={tool} name={tool} />
            ))}
            {command.status === 'done' && command.durationMs != null && (
              <span className="text-[10px] text-friday-text-tertiary font-mono">
                {formatDuration(command.durationMs)}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface MissionLogProps {
  sessionId?: string;
  /** Current error to display */
  error?: ShellError | null;
  /** Called to retry/dismiss errors */
  onErrorRetry?: () => void;
  /** Session data for export functionality */
  exportData?: ExportSessionData | null;
}

export function MissionLog({ sessionId, error, onErrorRetry, exportData }: MissionLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Only query if sessionId looks like a Convex document ID (not a Browserbase UUID).
  // Convex IDs are short alphanumeric strings; Browserbase IDs are UUIDs with dashes.
  const isConvexId = sessionId && !sessionId.includes('-');

  const rawCommands = useQuery(
    api.commands.listBySession,
    isConvexId ? { sessionId: sessionId as Id<'sessions'> } : 'skip',
  );

  const commands = useMemo(
    () => (rawCommands ? [...rawCommands].reverse() : undefined),
    [rawCommands],
  );

  // Auto-scroll to latest entry
  useEffect(() => {
    if (commands && commands.length > 0 && scrollRef.current) {
      const el = scrollRef.current;
      // Only auto-scroll if user is near the bottom already
      const isNearBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      if (isNearBottom) {
        requestAnimationFrame(() => {
          el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        });
      }
    }
  }, [commands]);

  return (
    <div className="h-full flex flex-col glass border-l border-white/[0.06]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.06]">
        <span className="text-sm font-semibold text-friday-text-primary tracking-wide uppercase">
          Mission Log
        </span>
        {/* Export button — functional when session data is available */}
        {exportData ? (
          <ExportSession session={exportData} />
        ) : (
          <button
            className="text-friday-text-tertiary opacity-30 cursor-not-allowed"
            aria-label="Export transcript (no session)"
            disabled
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
          </button>
        )}
      </div>

      {/* Transcript area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-4"
      >
        {/* Error states */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="mb-3"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
            >
              {error.type === 'session-expired' && (
                <SessionExpiredError onRetry={onErrorRetry} />
              )}
              {error.type === 'navigation' && (
                <NavigationError
                  message={error.message}
                  suggestion={error.suggestion}
                  onRetry={onErrorRetry}
                />
              )}
              {error.type === 'agent-disconnected' && (
                <AgentDisconnectedError
                  retryInSeconds={error.retryInSeconds}
                  onRetry={onErrorRetry}
                />
              )}
              {error.type === 'generic' && (
                <GenericError
                  message={error.message}
                  actionLabel="Dismiss"
                  onAction={onErrorRetry}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!sessionId ? (
          <p className="text-xs text-friday-text-tertiary font-mono text-center mt-8">
            Select a session to view commands.
          </p>
        ) : commands === undefined ? (
          /* Loading */
          <div className="space-y-3 mt-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-10 rounded-md glass-subtle animate-pulse"
              />
            ))}
          </div>
        ) : commands.length === 0 ? (
          <p className="text-xs text-friday-text-tertiary font-mono text-center mt-8">
            Waiting for commands...
          </p>
        ) : (
          commands.map((cmd) => (
            <CommandEntry key={cmd._id} command={cmd as Command} />
          ))
        )}
      </div>

      {/* Example commands */}
      <div className="flex-shrink-0 border-t border-white/[0.06] px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-friday-text-tertiary mb-2 font-semibold">
          Try saying
        </p>
        <div className="space-y-1.5">
          {[
            'Go to Hacker News',
            'Click the top story',
            'What does this page say?',
          ].map((cmd) => (
            <div
              key={cmd}
              className="text-xs text-friday-text-secondary font-mono px-2.5 py-1.5 glass-subtle rounded-md hover:bg-white/[0.06] transition-all duration-150"
            >
              &ldquo;{cmd}&rdquo;
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
