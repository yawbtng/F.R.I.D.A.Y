'use client';

// The live Mission Log for the Phase B swarm. Renders the CURRENT run straight from in-memory
// state: the voice conversation as it happens, the streamed action pills (planning / running /
// checking / done), plus a live progress header. Client-only — persistence is the sidebar's job.
//
// Ordering: the realtime API finalizes the user's transcript AFTER the assistant starts replying,
// so a naive render flashes FRIDAY's answer above the user's words. We keep the user's turn slot
// (with a pending "…") even before its text lands, so your words always sit above the reply.

import { useEffect, useRef } from 'react';
import type { UIMessage } from 'ai';
import type { Tile } from './swarm-grid';
import type { ActionEvent } from '@/hooks/use-friday';

/** Flatten a v7 UIMessage to plain text. Assistant turns carry `type:'text'` parts; the user's
 *  SPOKEN turns carry the Whisper transcript on a different part shape (e.g. `transcript`/`audio`),
 *  so we also pull any string `transcript` or `text` field — otherwise the user's side of the
 *  conversation flattens to '' and gets filtered out (only F.R.I.D.A.Y. shows). */
function textOf(m: UIMessage): string {
  if (!Array.isArray(m.parts)) return '';
  return m.parts
    .map((p) => {
      if (typeof p !== 'object' || p === null) return '';
      const part = p as { type?: string; text?: unknown; transcript?: unknown };
      if (typeof part.text === 'string') return part.text;
      if (typeof part.transcript === 'string') return part.transcript;
      return '';
    })
    .join('')
    .trim();
}

// Statuses that count as a settled answer for the progress tally (mirrors the page/header).
const SETTLED = ['active', 'inactive', 'notfound', 'done'];

const EXAMPLES = [
  'Verify these are real businesses: Tesla, Nvidia, Costco',
  'Are these 8 companies actually registered?',
  'Check if these companies are active',
];

// Pill accent per action tone. Full literal classes (so Tailwind's JIT keeps them) using only
// confirmed design tokens — colored tint bg + fg text carry the tone; border stays safe.
const PILL_TONE: Record<ActionEvent['tone'], string> = {
  plan: 'text-info-fg bg-info-tint border-border',
  run: 'text-accent-text bg-neutral-tint border-border-accent',
  check: 'text-warning-fg bg-warning-tint border-border',
  done: 'text-success-fg bg-success-tint border-border',
};

function ActionPill({ label, tone }: { label: string; tone: ActionEvent['tone'] }) {
  return (
    <div className="flex justify-start">
      <span
        className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${PILL_TONE[tone]}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
        {label}
      </span>
    </div>
  );
}

type FeedItem =
  | { kind: 'user' | 'assistant'; id: string; text: string; sortTs: number }
  | { kind: 'pill'; id: string; label: string; tone: ActionEvent['tone']; sortTs: number };

export function LiveRunPanel({
  messages,
  actions = [],
  tiles,
  phase,
  elapsed,
  title,
  listening,
}: {
  messages: UIMessage[];
  /** Streamed agent actions (pills) — planning / running / checking / done. */
  actions?: ActionEvent[];
  tiles: Tile[];
  phase: string;
  elapsed: number;
  title?: string;
  /** True while the mic is capturing the user's speech — the final transcript arrives
   *  asynchronously (often after FRIDAY starts replying), so this bubble is the instant
   *  "I hear you" signal. */
  listening?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // First-seen timestamp per message id — the realtime UIMessages carry no reliable createdAt,
  // so we stamp each id the first render we see it. Interleaves pills with turns by time.
  const firstSeen = useRef<Map<string, number>>(new Map());

  // Build the merged feed: conversation turns (kept in the hook's array order via a monotonic
  // clamp) plus action pills, sorted by time. [status] turns are dropped — they're represented
  // by pills now. Empty USER turns are KEPT (pending "…") so the reply never renders above them.
  let prevTs = 0;
  const turnItems: FeedItem[] = [];
  for (const m of messages) {
    const text = textOf(m);
    if (text.startsWith('[status]')) continue; // action channel → shown as pills, not chat
    if (m.role === 'assistant' && !text) continue; // skip empty assistant fragments
    let ts = firstSeen.current.get(m.id);
    if (ts === undefined) {
      ts = Date.now();
      firstSeen.current.set(m.id, ts);
    }
    const sortTs = Math.max(ts, prevTs + 1); // keep conversation order even if stamps tie
    prevTs = sortTs;
    turnItems.push({ kind: m.role === 'user' ? 'user' : 'assistant', id: m.id, text, sortTs });
  }
  const pillItems: FeedItem[] = actions.map((a) => ({
    kind: 'pill',
    id: a.id,
    label: a.label,
    tone: a.tone,
    sortTs: a.ts,
  }));
  const feed = [...turnItems, ...pillItems].sort((a, b) => a.sortTs - b.sortTs);

  const hasConversation = turnItems.length > 0 || pillItems.length > 0;
  const settled = tiles.filter((t) => SETTLED.includes(t.status)).length;
  const errored = tiles.filter((t) => t.status === 'error').length;
  const running = phase === 'running' || phase === 'spawning';

  // Follow the feed as items come in (and when the listening bubble appears).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [feed.length, settled, listening]);

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

      {/* Conversation + action feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {title && phase !== 'idle' && (
          <div className="rounded-md border border-border bg-info-tint p-3 font-mono text-[11px] uppercase tracking-wider text-text">
            {title}
          </div>
        )}

        {!hasConversation ? (
          <p className="text-xs text-text-muted font-mono text-center mt-8">
            {running ? 'Working…' : 'Tap the mic or type a task to begin.'}
          </p>
        ) : (
          feed.map((item) => {
            if (item.kind === 'pill') return <ActionPill key={item.id} label={item.label} tone={item.tone} />;
            if (item.kind === 'user') {
              return (
                <div key={item.id} className="flex justify-end">
                  <div className="max-w-[85%] px-3 py-2 rounded-lg bg-surface-2 border border-border text-xs text-text">
                    {/* Pending transcript: hold the slot so the reply can't jump above it. */}
                    {item.text || <PendingDots />}
                  </div>
                </div>
              );
            }
            return (
              <div key={item.id} className="space-y-1">
                <p className="text-[10px] font-semibold text-accent-text uppercase tracking-wider">
                  F.R.I.D.A.Y.
                </p>
                <p className="text-xs text-text-muted leading-relaxed">{item.text}</p>
              </div>
            );
          })
        )}

        {/* Instant "I hear you" while speech is being captured, if no pending user turn exists
            yet (the transcript item can lag the mic). */}
        {listening && (
          <div className="flex justify-end">
            <div className="px-3 py-2 rounded-lg bg-surface-2 border border-border">
              <PendingDots />
            </div>
          </div>
        )}
      </div>

      {/* Try saying — only before a run, when there's no conversation yet */}
      {phase === 'idle' && !hasConversation && (
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

function PendingDots() {
  return (
    <span className="flex gap-1 items-center">
      <span className="w-1.5 h-1.5 rounded-full bg-accent-text animate-pulse" />
      <span className="w-1.5 h-1.5 rounded-full bg-accent-text animate-pulse [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-accent-text animate-pulse [animation-delay:300ms]" />
    </span>
  );
}
