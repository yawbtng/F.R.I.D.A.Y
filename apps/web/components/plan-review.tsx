'use client';

// The review gate: shows the planned targets before any browser spawns, so a bad plan
// never burns cloud minutes and the user can steer it. Reads as a clean list — each target
// is one line (label + summary) with its advanced fields (goal/extract/URL/query) tucked
// behind an "Edit details" disclosure, one click away. Edit, remove, add, then Run.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowLeft, X, Plus } from 'lucide-react';
import { hostOf } from './grid-tile';
import type { SwarmTarget } from '@/lib/swarm-target';

const inputBase =
  'rounded-md bg-surface border border-border px-2 py-1 text-[11px] text-text placeholder:text-text-subtle focus:border-border-accent focus:ring-2 focus:ring-accent focus:outline-none ease-brand';

const needsDetails = (t: SwarmTarget) => !t.goal.trim() || !t.extract.trim();

export function PlanReview({
  targets,
  onChange,
  onRun,
  onBack,
  error,
  title,
  planNotes,
}: {
  targets: SwarmTarget[];
  onChange: (t: SwarmTarget[]) => void;
  onRun: () => void;
  onBack: () => void;
  error?: string;
  /** Planner-supplied run title (falls back to a generic heading). */
  title?: string;
  /** 1-4 short notes on what the adversarial critic pass tightened. Hidden when empty. */
  planNotes?: string[];
}) {
  // Which cards have their advanced fields disclosed. Collapsed by default; keyed by id so
  // expansion survives reordering/removal (indices would shift).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const update = (i: number, patch: Partial<SwarmTarget>) =>
    onChange(targets.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const remove = (i: number) => onChange(targets.filter((_, idx) => idx !== i));
  const add = () => {
    const id = `t${targets.length}-${Date.now().toString(36)}`;
    onChange([...targets, { id, label: 'New target', goal: '', extract: '' }]);
    setExpanded((prev) => new Set(prev).add(id)); // new targets need editing — open them
  };

  const notes = planNotes ?? [];
  const incomplete = targets.some(needsDetails);

  return (
    <div className="max-w-3xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold truncate">{title || 'Review plan'}</h2>
          <p className="text-xs text-text-muted">
            {targets.length} target{targets.length === 1 ? '' : 's'} · edit, remove, or add. Nothing spawns until you run.
          </p>
        </div>
        <button
          onClick={onBack}
          className="shrink-0 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-text-muted hover:bg-surface-2 hover:text-text focus-ring"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </button>
      </div>

      {/* What the adversarial critic pass tightened. */}
      {notes.length > 0 && (
        <div className="mb-3 rounded-lg border border-border bg-surface shadow-inset-top px-3 py-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent-text">
            <Sparkles className="h-3 w-3" /> FRIDAY tightened these
          </div>
          <ul className="space-y-1">
            {notes.map((n, i) => (
              <li key={i} className="flex gap-2 text-xs text-text-muted">
                <span className="text-text-muted">·</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        {targets.map((t, i) => {
          const open = expanded.has(t.id);
          const summary = t.startUrl ? hostOf(t.startUrl) : t.query ?? '';
          const isAgent = t.engine === 'bb-agent';
          return (
            <div key={t.id} className="rounded-lg border border-border bg-surface shadow-inset-top overflow-hidden">
              {/* Always-visible summary row: number, label, one-line summary, chips, controls. */}
              <div className="flex items-center gap-2 p-2.5">
                <span className="w-4 shrink-0 text-center font-mono text-[10px] text-text-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <input
                    value={t.label}
                    onChange={(e) => update(i, { label: e.target.value })}
                    aria-label={`Target ${i + 1} label`}
                    className={`w-full font-semibold ${inputBase}`}
                    placeholder="Label"
                  />
                  <div className="mt-1 flex items-center gap-1.5 pl-0.5">
                    {isAgent && (
                      <span className="shrink-0 rounded-sm bg-[var(--accent-pulse)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent-text ring-1 ring-border-accent">
                        agent
                      </span>
                    )}
                    {summary ? (
                      <span className="min-w-0 truncate font-mono text-[11px] text-text-muted">{summary}</span>
                    ) : (
                      <span className="shrink-0 text-[11px] italic text-text-muted">no URL or query yet</span>
                    )}
                    {needsDetails(t) && (
                      <span className="ml-auto shrink-0 text-[10px] font-medium text-warning-fg">needs goal &amp; extract</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggle(t.id)}
                  aria-expanded={open}
                  aria-controls={`details-${t.id}`}
                  className="shrink-0 flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-text-muted hover:bg-surface-2 hover:text-text focus-ring"
                >
                  Edit details
                  <svg
                    className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <button
                  onClick={() => remove(i)}
                  aria-label={`Remove target ${i + 1}`}
                  className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:bg-error-tint hover:text-error-fg focus-ring"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Advanced fields, disclosed on demand — every field stays one click away. */}
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    id={`details-${t.id}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 border-t border-border px-2.5 pb-2.5 pt-2.5">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          value={t.startUrl ?? ''}
                          onChange={(e) => update(i, { startUrl: e.target.value || undefined })}
                          aria-label={`Target ${i + 1} start URL`}
                          placeholder="Start URL (optional)"
                          className={`w-full font-mono ${inputBase}`}
                        />
                        <input
                          value={t.query ?? ''}
                          onChange={(e) => update(i, { query: e.target.value || undefined })}
                          aria-label={`Target ${i + 1} search query`}
                          placeholder="…or search query"
                          className={`w-full font-mono ${inputBase}`}
                        />
                      </div>
                      <textarea
                        value={t.goal}
                        onChange={(e) => update(i, { goal: e.target.value })}
                        rows={2}
                        aria-label={`Target ${i + 1} goal`}
                        placeholder="Goal: what the agent should do on the page"
                        className={`w-full resize-none ${inputBase}`}
                      />
                      <input
                        value={t.extract}
                        onChange={(e) => update(i, { extract: e.target.value })}
                        aria-label={`Target ${i + 1} extract question`}
                        placeholder="Extract: the one question to answer"
                        className={`w-full ${inputBase}`}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <button onClick={add} className="mt-2.5 inline-flex items-center gap-1 rounded-md px-1 text-xs text-accent-text hover:underline focus-ring">
        <Plus className="h-3.5 w-3.5" /> Add target
      </button>

      {error && <p className="mt-3 text-xs text-error-fg font-mono">{error}</p>}

      <div className="mt-4">
        <button
          onClick={onRun}
          disabled={targets.length === 0 || incomplete}
          className="group inline-flex items-center justify-center gap-2 rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg-strong shadow-inset-top transition-[background-color,border-radius,transform] duration-200 ease-brand hover:bg-accent-hover hover:rounded-lg active:scale-[0.98] disabled:opacity-40 focus-ring"
        >
          Run swarm → {targets.length} browser{targets.length === 1 ? '' : 's'}
        </button>
        {incomplete && (
          <p className="mt-2 text-[11px] text-text-muted">Every target needs a goal and an extract question.</p>
        )}
      </div>
    </div>
  );
}
