'use client';

// The live Mission Log for the Phase B swarm. Unlike the Convex-backed MissionLog (which reads a
// saved session), this renders the CURRENT run straight from in-memory state: the voice
// conversation as it happens, plus a live progress header. It's client-only — persistence
// (save-to-Sessions + Convex) is a follow-up; this just makes the panel alive during a run.

import { useEffect, useRef } from 'react';
import type { UIMessage } from 'ai';
import type { Tile } from './swarm-grid';

/** Flatten a v7 UIMessage to plain text — joins its text parts, ignores the rest. */
function textOf(m: UIMessage): string {
  if (!Array.isArray(m.parts)) return '';
  return m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('').trim();
}

// Statuses that count as a settled answer for the progress tally (mirrors the page/header).
const SETTLED = ['active', 'inactive', 'notfound', 'done'];

const EXAMPLES = [
  'Verify these are real businesses: Tesla, Apple, Stripe',
  'Are these 12 vendors actually registered?',
  'Check if these companies are active',
];

export function LiveRunPanel({
  messages,
  tiles,
  phase,
  elapsed,
  title,
}: {
  messages: UIMessage[];
  tiles: Tile[];
  phase: string;
  elapsed: number;
  title?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Real conversation turns — drop empties and the injected [status] progress pings (those drive
  // narration but shouldn't clutter the log; FRIDAY's spoken narration of them still shows).
  const turns = messages
    .map((m) => ({ id: m.id, role: m.role, text: textOf(m) }))
    .filter((t) => t.text && !t.text.startsWith('[status]'));

  const settled = tiles.filter((t) => SETTLED.includes(t.status)).length;
  const errored = tiles.filter((t) => t.status === 'error').length;
  const running = phase === 'running' || phase === 'spawning';

  // Follow the feed as turns/tiles come in.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [turns.length, settled]);

  return (
    <div className="h-full flex flex-col bg-surface border-l border-border">
      {/* Header + live progress */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-text-muted">
          Mission Log
        </span>
        {phase !== 'idle' && (
          <span className="font-mono text-[11px] text-text-muted">
            {settled}/{tiles.length} · {elapsed.toFixed(0)}s{errored ? ` · ${errored} err` : ''}
          </span>
        )}
      </div>

      {/* Conversation feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {title && phase !== 'idle' && (
          <div className="rounded-md border border-border bg-info-tint p-3 font-mono text-[11px] uppercase tracking-wider text-text">
            {title}
          </div>
        )}

        {turns.length === 0 ? (
          <p className="text-xs text-text-muted font-mono text-center mt-8">
            {running ? 'Working…' : 'Tap the mic or type a task to begin.'}
          </p>
        ) : (
          turns.map((t) =>
            t.role === 'user' ? (
              <div key={t.id} className="flex justify-end">
                <div className="max-w-[85%] px-3 py-2 rounded-lg bg-surface-2 border border-border text-xs text-text">
                  {t.text}
                </div>
              </div>
            ) : (
              <div key={t.id} className="space-y-1">
                <p className="text-[10px] font-semibold text-accent-text uppercase tracking-wider">
                  F.R.I.D.A.Y.
                </p>
                <p className="text-xs text-text-muted leading-relaxed">{t.text}</p>
              </div>
            ),
          )
        )}
      </div>

      {/* Try saying — only before a run, when there's no conversation yet */}
      {phase === 'idle' && turns.length === 0 && (
        <div className="flex-shrink-0 border-t border-border px-4 py-3">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-text-muted mb-2">
            Try saying
          </p>
          <div className="space-y-1.5">
            {EXAMPLES.map((cmd) => (
              <div
                key={cmd}
                className="text-xs text-text-muted font-mono px-2.5 py-1.5 bg-surface-2 border border-border rounded-md"
              >
                &ldquo;{cmd}&rdquo;
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
