'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ---------------------------------------------------------------------------
// Types matching the Convex schema
// ---------------------------------------------------------------------------

interface ExportCommand {
  input: string;
  result?: string;
  toolsUsed?: string[];
  status: 'pending' | 'running' | 'done' | 'error';
  errorMessage?: string;
  durationMs?: number;
  screenshotUrl?: string;
  createdAt: number;
}

interface ExportSessionData {
  title?: string;
  browserbaseSessionId: string;
  currentUrl?: string;
  status: 'active' | 'idle' | 'error';
  createdAt: number;
  commands: ExportCommand[];
}

type ExportFormat = 'markdown' | 'json';

// ---------------------------------------------------------------------------
// Markdown generation
// ---------------------------------------------------------------------------

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function generateMarkdown(session: ExportSessionData): string {
  const title = session.title || `Session ${session.browserbaseSessionId.slice(0, 8)}`;
  const lines: string[] = [];

  lines.push(`# F.R.I.D.A.Y. Session Export`);
  lines.push('');
  lines.push(`**Session:** ${title}`);
  lines.push(`**Created:** ${formatTimestamp(session.createdAt)}`);
  lines.push(`**Status:** ${session.status}`);
  if (session.currentUrl) {
    lines.push(`**Last URL:** ${session.currentUrl}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  if (session.commands.length === 0) {
    lines.push('_No commands recorded._');
  } else {
    lines.push(`## Commands (${session.commands.length})`);
    lines.push('');

    session.commands.forEach((cmd, i) => {
      lines.push(`### ${i + 1}. ${cmd.input}`);
      lines.push('');
      lines.push(`- **Status:** ${cmd.status}`);
      lines.push(`- **Time:** ${formatTimestamp(cmd.createdAt)}`);

      if (cmd.durationMs != null) {
        lines.push(`- **Duration:** ${formatDuration(cmd.durationMs)}`);
      }

      if (cmd.toolsUsed && cmd.toolsUsed.length > 0) {
        lines.push(`- **Tools:** ${cmd.toolsUsed.join(', ')}`);
      }

      if (cmd.result) {
        lines.push('');
        lines.push('**Response:**');
        lines.push('');
        lines.push('```');
        lines.push(cmd.result);
        lines.push('```');
      }

      if (cmd.errorMessage) {
        lines.push('');
        lines.push(`> Error: ${cmd.errorMessage}`);
      }

      if (cmd.screenshotUrl) {
        lines.push('');
        lines.push(`![Screenshot](${cmd.screenshotUrl})`);
      }

      lines.push('');
    });
  }

  lines.push('---');
  lines.push(`_Exported from F.R.I.D.A.Y. on ${formatTimestamp(Date.now())}_`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// ExportSession component
// ---------------------------------------------------------------------------

interface ExportSessionProps {
  /** Session data to export */
  session: ExportSessionData;
  /** Additional className */
  className?: string;
}

export function ExportSession({ session, className = '' }: ExportSessionProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleExport = useCallback(
    (format: ExportFormat) => {
      const slug = session.title
        ? session.title.toLowerCase().replace(/\s+/g, '-').slice(0, 30)
        : session.browserbaseSessionId.slice(0, 8);
      const timestamp = new Date().toISOString().slice(0, 10);

      if (format === 'markdown') {
        const md = generateMarkdown(session);
        downloadBlob(md, `friday-${slug}-${timestamp}.md`, 'text/markdown');
      } else {
        const json = JSON.stringify(session, null, 2);
        downloadBlob(json, `friday-${slug}-${timestamp}.json`, 'application/json');
      }

      setOpen(false);
    },
    [session],
  );

  // Close dropdown on outside click
  const handleBlur = useCallback(() => {
    // Small delay to allow click events on dropdown items to fire first
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setOpen(false);
      }
    }, 150);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`} onBlur={handleBlur}>
      {/* Export button */}
      <button
        onClick={() => setOpen((v: boolean) => !v)}
        className="flex items-center gap-1.5 text-friday-text-tertiary hover:text-friday-text-secondary transition-colors"
        aria-label="Export session transcript"
        aria-expanded={open}
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

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-full mt-2 w-44 py-1 rounded-lg bg-friday-secondary border border-friday-border shadow-md z-50"
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <button
              onClick={() => handleExport('markdown')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-friday-text-secondary hover:text-friday-text-primary hover:bg-friday-tertiary transition-colors text-left"
            >
              <svg
                className="w-4 h-4 text-friday-text-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" x2="8" y1="13" y2="13" />
                <line x1="16" x2="8" y1="17" y2="17" />
              </svg>
              Export as Markdown
            </button>
            <button
              onClick={() => handleExport('json')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-friday-text-secondary hover:text-friday-text-primary hover:bg-friday-tertiary transition-colors text-left"
            >
              <svg
                className="w-4 h-4 text-friday-text-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              Export as JSON
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
