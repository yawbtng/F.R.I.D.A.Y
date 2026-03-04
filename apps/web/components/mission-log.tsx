'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { motion } from 'framer-motion';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useSessionScreenshot } from '@/hooks/use-session-screenshot';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
    <span className="inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-friday-tertiary text-friday-text-accent border border-friday-border">
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
    <div className="mt-1.5 rounded-md overflow-hidden border border-friday-border max-w-[200px]">
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
        <div className="max-w-[85%] px-3 py-2 rounded-lg bg-friday-tertiary text-xs text-friday-text-primary">
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
}

export function MissionLog({ sessionId }: MissionLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Query commands (returns desc, we reverse for chronological order)
  const rawCommands = useQuery(
    api.commands.listBySession,
    sessionId ? { sessionId: sessionId as Id<'sessions'> } : 'skip',
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
    <div className="h-full flex flex-col bg-friday-surface border-l border-friday-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-friday-border">
        <span className="text-sm font-semibold text-friday-text-primary tracking-wide uppercase">
          Mission Log
        </span>
        {/* Export placeholder */}
        <button
          className="text-friday-text-tertiary hover:text-friday-text-secondary transition-colors"
          aria-label="Export transcript"
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
      </div>

      {/* Transcript area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-4"
      >
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
                className="h-10 rounded-md bg-friday-tertiary/40 animate-pulse"
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
      <div className="flex-shrink-0 border-t border-friday-border px-4 py-3">
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
              className="text-xs text-friday-text-secondary font-mono px-2.5 py-1.5 bg-friday-tertiary rounded-md border border-friday-border"
            >
              &ldquo;{cmd}&rdquo;
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
