'use client';

// The review gate: shows the planned targets before any browser spawns, so a bad plan
// never burns cloud minutes and the user can steer it. Reads as a clean list — each target
// is one line (label + summary) with its advanced fields (goal/extract/URL/query) tucked
// behind an "Edit details" disclosure, one click away. Edit, remove, add, then Run.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hostOf } from './grid-tile';
import type { SwarmTarget } from '@/lib/swarm-target';

const inputBase =
  'rounded bg-white/[0.03] border border-white/[0.06] px-2 py-1 text-[11px] focus-ring placeholder:text-friday-text-tertiary';

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
          <p className="text-xs text-friday-text-tertiary">
            {targets.length} target{targets.length === 1 ? '' : 's'} · edit, remove, or add. Nothing spawns until you run.
          </p>
        </div>
        <button
          onClick={onBack}
          className="shrink-0 text-xs text-friday-text-tertiary hover:text-friday-text-primary focus-ring rounded px-1"
        >
          ← Back
        </button>
      </div>

      {/* What the adversarial critic pass tightened. */}
      {notes.length > 0 && (
        <div className="mb-3 rounded-lg glass px-3 py-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-friday-accent">
            <span>✦</span> FRIDAY tightened these
          </div>
          <ul className="space-y-1">
            {notes.map((n, i) => (
              <li key={i} className="flex gap-2 text-xs text-friday-text-secondary">
                <span className="text-friday-text-tertiary">·</span>
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
            <div key={t.id} className="glass rounded-lg overflow-hidden">
              {/* Always-visible summary row: number, label, one-line summary, chips, controls. */}
              <div className="flex items-center gap-2 p-2.5">
                <span className="w-4 shrink-0 text-center font-mono text-[10px] text-friday-text-tertiary">{i + 1}</span>
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
                      <span className="shrink-0 rounded bg-friday-accent/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-friday-accent ring-1 ring-friday-accent/30">
                        agent
                      </span>
                    )}
                    {summary ? (
                      <span className="min-w-0 truncate font-mono text-[11px] text-friday-text-tertiary">{summary}</span>
                    ) : (
                      <span className="shrink-0 text-[11px] italic text-friday-text-tertiary">no URL or query yet</span>
                    )}
                    {needsDetails(t) && (
                      <span className="ml-auto shrink-0 text-[10px] font-medium text-amber-300/80">needs goal &amp; extract</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggle(t.id)}
                  aria-expanded={open}
                  aria-controls={`details-${t.id}`}
                  className="shrink-0 flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-friday-text-secondary hover:text-friday-text-primary focus-ring"
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
                  className="shrink-0 h-6 w-6 rounded text-friday-text-tertiary hover:text-red-300 hover:bg-red-400/10 focus-ring"
                >
                  ×
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
                    <div className="space-y-2 border-t border-white/[0.06] px-2.5 pb-2.5 pt-2.5">
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

      <button onClick={add} className="mt-2.5 text-xs text-friday-accent hover:underline focus-ring rounded px-1">
        + Add target
      </button>

      {error && <p className="mt-3 text-xs text-red-400 font-mono">{error}</p>}

      <div className="mt-4">
        <button
          onClick={onRun}
          disabled={targets.length === 0 || incomplete}
          className="rounded-lg bg-friday-accent/20 px-5 py-2.5 text-sm font-semibold text-friday-accent ring-1 ring-friday-accent/40 hover:bg-friday-accent/30 disabled:opacity-40 focus-ring"
        >
          Run swarm → {targets.length} browser{targets.length === 1 ? '' : 's'}
        </button>
        {incomplete && (
          <p className="mt-2 text-[11px] text-friday-text-tertiary">Every target needs a goal and an extract question.</p>
        )}
      </div>
    </div>
  );
}
