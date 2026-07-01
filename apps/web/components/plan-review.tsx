'use client';

// The review gate: shows the planned targets before any browser spawns, so a bad plan
// never burns cloud minutes and the user can steer it. Edit labels/goals/extract/URL,
// remove targets, add new ones, then Run.

import type { SwarmTarget } from '@/lib/swarm-target';

const inputBase =
  'rounded bg-white/[0.03] border border-white/[0.06] px-2 py-1 text-[11px] focus-ring placeholder:text-friday-text-tertiary';

export function PlanReview({
  targets,
  onChange,
  onRun,
  onBack,
  error,
}: {
  targets: SwarmTarget[];
  onChange: (t: SwarmTarget[]) => void;
  onRun: () => void;
  onBack: () => void;
  error?: string;
}) {
  const update = (i: number, patch: Partial<SwarmTarget>) =>
    onChange(targets.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const remove = (i: number) => onChange(targets.filter((_, idx) => idx !== i));
  const add = () =>
    onChange([
      ...targets,
      { id: `t${targets.length}-${Date.now().toString(36)}`, label: 'New target', goal: '', extract: '' },
    ]);

  const incomplete = targets.some((t) => !t.goal.trim() || !t.extract.trim());

  return (
    <div className="max-w-3xl">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">
            Review plan · {targets.length} target{targets.length === 1 ? '' : 's'}
          </h2>
          <p className="text-xs text-friday-text-tertiary">
            Edit, remove, or add targets. Nothing spawns until you run.
          </p>
        </div>
        <button onClick={onBack} className="text-xs text-friday-text-tertiary hover:text-friday-text-primary focus-ring rounded px-1">
          ← Back
        </button>
      </div>

      <div className="space-y-2.5">
        {targets.map((t, i) => (
          <div key={t.id} className="glass rounded-lg p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-mono text-[10px] text-friday-text-tertiary shrink-0">{i + 1}</span>
              <input
                value={t.label}
                onChange={(e) => update(i, { label: e.target.value })}
                className={`flex-1 font-semibold ${inputBase}`}
                placeholder="Label"
              />
              <button
                onClick={() => remove(i)}
                aria-label="Remove target"
                className="shrink-0 h-6 w-6 rounded text-friday-text-tertiary hover:text-red-300 hover:bg-red-400/10 focus-ring"
              >
                ×
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={t.startUrl ?? ''}
                onChange={(e) => update(i, { startUrl: e.target.value || undefined })}
                placeholder="Start URL (optional)"
                className={`font-mono ${inputBase}`}
              />
              <input
                value={t.query ?? ''}
                onChange={(e) => update(i, { query: e.target.value || undefined })}
                placeholder="…or search query"
                className={`font-mono ${inputBase}`}
              />
            </div>
            <textarea
              value={t.goal}
              onChange={(e) => update(i, { goal: e.target.value })}
              rows={2}
              placeholder="Goal: what the agent should do on the page"
              className={`mt-2 w-full resize-none ${inputBase}`}
            />
            <input
              value={t.extract}
              onChange={(e) => update(i, { extract: e.target.value })}
              placeholder="Extract: the one question to answer"
              className={`mt-2 w-full ${inputBase}`}
            />
          </div>
        ))}
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
