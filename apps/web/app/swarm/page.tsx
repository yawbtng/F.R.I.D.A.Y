'use client';

// Mission-control swarm grid. Thin UI over the useSwarm engine: it owns the config screen
// (a free-form task box that the planner turns into targets, or a KYB preset), the review
// gate, and the focus/report modals. The hook owns spawning, the client-side fan-out, and
// release. Runs locally for the hero clip AND deploys to Vercel unchanged.
//
// Chrome matches FridayShell (flat hairline bar, mono wordmark, theme toggle) so the whole app
// reads as one surface; the body is a single centered config→grid flow (no sessions/mission-log,
// so it isn't wrapped in the 3-panel shell). All styling reads from semantic tokens → light+dark.

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Shield, Sparkles } from 'lucide-react';
import { STATE_ADAPTERS, SUPPORTED_STATES } from '@/lib/sos-adapters';
import { buildKybTargets, planToTargets, type SwarmTarget } from '@/lib/swarm-target';
import type { PlanTarget } from '@/lib/schemas';
import { useSwarm } from '@/hooks/use-swarm';
import { SwarmGrid } from '@/components/swarm-grid';
import { PlanReview } from '@/components/plan-review';
import { PlanningLoader } from '@/components/planning-loader';
import { BrowserModal } from '@/components/browser-modal';
import { ArtifactModal } from '@/components/artifact-modal';
import { ThemeToggle } from '@/components/theme-toggle';

// Statuses that count as a settled answer for the header tally.
const SETTLED = ['active', 'inactive', 'notfound', 'done'];

type Mode = 'general' | 'kyb';
type Step = 'config' | 'planning' | 'review';

const labelEyebrow = 'mb-1.5 block font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted';
const inputBase =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-border-accent focus:outline-none focus:ring-2 focus:ring-accent transition-colors duration-200 ease-brand';
const primaryBtn =
  'rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg-strong shadow-inset-top transition-[background-color,border-radius,transform] duration-200 ease-brand hover:bg-accent-hover hover:rounded-lg active:scale-[0.98] disabled:opacity-40 disabled:hover:rounded-pill focus-ring';

export default function SwarmPage() {
  const swarm = useSwarm();
  const [mode, setMode] = useState<Mode>('general');
  const [step, setStep] = useState<Step>('config');
  const [task, setTask] = useState('Check whether these are active, registered businesses: Tesla, Apple, Stripe, OpenAI');
  const [autoRun, setAutoRun] = useState(false);
  const [plan, setPlan] = useState<SwarmTarget[]>([]);
  const [planTitle, setPlanTitle] = useState('');
  const [planNotes, setPlanNotes] = useState<string[]>([]);
  const [planError, setPlanError] = useState('');
  // KYB preset config
  const [entity, setEntity] = useState('Tesla, Inc.');
  const [selected, setSelected] = useState<string[]>(SUPPORTED_STATES);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const { tiles, phase, elapsed, error, retrying, running } = swarm;
  const configuring = phase === 'idle'; // hook is pre-run; the page owns the config/plan UI

  const toggle = (s: string) =>
    setSelected((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  // General path: task -> planner -> (review gate | just-run).
  const planTask = async () => {
    const t = task.trim();
    if (!t) return;
    setPlanError('');
    setStep('planning');
    try {
      const res = await fetch('/api/swarm/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: t }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'planning failed');
      const targets = planToTargets(data.targets as PlanTarget[]);
      setPlan(targets);
      // Capture the run title + adversarial-critic notes for the review gate (defensive:
      // the review UI degrades gracefully when either is absent).
      setPlanTitle(typeof data.title === 'string' ? data.title : '');
      setPlanNotes(Array.isArray(data.planNotes) ? (data.planNotes as string[]) : []);
      if (autoRun) {
        setStep('config');
        swarm.run(targets, { task: t });
      } else {
        setStep('review');
      }
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : 'planning failed');
      setStep('config');
    }
  };

  // KYB preset: proven path, no planner.
  const runKyb = () => {
    const name = entity.trim();
    const states = SUPPORTED_STATES.filter((s) => selected.includes(s)); // canonical order
    if (!name || states.length === 0) return;
    swarm.run(buildKybTargets(name, states), {
      task: `Verify "${name}" is registered and active across ${states.length} U.S. state business registries`,
    });
  };

  const resetAll = () => {
    swarm.reset();
    setStep('config');
    setPlanError('');
  };

  const settled = tiles.filter((t) => SETTLED.includes(t.status)).length;
  const errored = tiles.filter((t) => t.status === 'error').length;
  const focusedTile = focusedId ? tiles.find((t) => t.id === focusedId) ?? null : null;
  const reportSubject = mode === 'kyb' ? entity : task;

  return (
    <div className="min-h-screen w-full bg-bg text-text">
      {/* Header — matches the FridayShell chrome */}
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-accent shadow-glow" />
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-text">F.R.I.D.A.Y.</span>
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-text-muted">/ swarm</span>
        </div>

        <div className="flex items-center gap-3">
          {!configuring && (
            <>
              <div className="text-right font-mono leading-tight">
                <div className="text-sm tabular-nums">
                  <span className="text-text">{settled}</span>
                  <span className="text-text-muted"> / {tiles.length} resolved</span>
                </div>
                <div className="text-[11px] text-text-muted tabular-nums">
                  {elapsed.toFixed(1)}s{errored > 0 ? ` · ${errored} error` : ''}
                </div>
              </div>
              {phase === 'done' && swarm.hasUnresolved && (
                <button
                  onClick={swarm.retryWithStealth}
                  disabled={retrying}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-warning-tint px-3 py-1.5 text-xs font-semibold text-warning-fg transition-colors duration-200 ease-brand hover:bg-surface-2 disabled:opacity-50 focus-ring"
                >
                  <Shield className="h-3.5 w-3.5" aria-hidden />
                  {retrying ? 'Retrying…' : 'Retry blocked'}
                </button>
              )}
              {phase === 'done' && (
                <button
                  onClick={swarm.openReport}
                  disabled={retrying}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg-strong shadow-inset-top transition-[background-color,border-radius] duration-200 ease-brand hover:bg-accent-hover hover:rounded-lg disabled:opacity-50 focus-ring"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Report
                </button>
              )}
              <button
                onClick={resetAll}
                disabled={running || retrying}
                className="rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text transition-colors duration-200 ease-brand hover:bg-surface-2 disabled:opacity-40 focus-ring"
              >
                New run
              </button>
            </>
          )}
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        {/* Config: task box (general) or KYB preset */}
        {configuring && step === 'config' && (
          <div className="max-w-2xl rounded-lg border border-border bg-surface p-5 shadow-inset-top">
            {/* Mode toggle */}
            <div className="mb-5 flex gap-2">
              {(['general', 'kyb'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-pill px-3 py-1.5 text-xs font-medium transition-colors duration-200 ease-brand focus-ring ${
                    mode === m
                      ? 'bg-accent text-accent-fg-strong'
                      : 'border border-border bg-surface text-text-muted hover:bg-surface-2 hover:text-text'
                  }`}
                >
                  {m === 'general' ? 'General task' : 'Verify business × states'}
                </button>
              ))}
            </div>

            {mode === 'general' ? (
              <>
                <label className={labelEyebrow}>What should F.R.I.D.A.Y. check across the web?</label>
                <textarea
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  rows={3}
                  placeholder="e.g. Check if these 12 vendors are real, registered businesses: …"
                  className={`resize-none ${inputBase}`}
                />

                <label className="mt-3 flex cursor-pointer select-none items-center gap-2 text-xs text-text-muted">
                  <input
                    type="checkbox"
                    checked={autoRun}
                    onChange={(e) => setAutoRun(e.target.checked)}
                    className="accent-accent"
                  />
                  Just run it (skip the review step)
                </label>

                {planError && <p className="mt-4 font-mono text-xs text-error-fg">{planError}</p>}

                <button onClick={planTask} disabled={!task.trim()} className={`mt-4 ${primaryBtn}`}>
                  {autoRun ? 'Plan & run →' : 'Plan →'}
                </button>
              </>
            ) : (
              <>
                <label className={labelEyebrow}>Entity name</label>
                <input
                  value={entity}
                  onChange={(e) => setEntity(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runKyb()}
                  placeholder="e.g. Tesla, Inc."
                  className={`font-mono ${inputBase}`}
                />

                <div className="mb-1.5 mt-4 flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">
                    States ({selected.length})
                  </span>
                  <button
                    onClick={() => setSelected(selected.length === SUPPORTED_STATES.length ? [] : SUPPORTED_STATES)}
                    className="text-[11px] text-accent-text hover:underline focus-ring"
                  >
                    {selected.length === SUPPORTED_STATES.length ? 'Clear' : 'Select all'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SUPPORTED_STATES.map((s) => {
                    const on = selected.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() => toggle(s)}
                        className={`rounded-md px-3 py-1.5 font-mono text-xs transition-colors duration-200 ease-brand focus-ring ${
                          on
                            ? 'border border-border-accent bg-[var(--accent-pulse)] text-accent-text'
                            : 'border border-border bg-surface text-text-muted hover:bg-surface-2 hover:text-text'
                        }`}
                      >
                        {s} · {STATE_ADAPTERS[s].name}
                      </button>
                    );
                  })}
                </div>

                {error && <p className="mt-4 font-mono text-xs text-error-fg">{error}</p>}

                <button
                  onClick={runKyb}
                  disabled={!entity.trim() || selected.length === 0}
                  className={`mt-5 ${primaryBtn}`}
                >
                  Run swarm → {selected.length} browser{selected.length === 1 ? '' : 's'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Planning */}
        {configuring && step === 'planning' && <PlanningLoader />}

        {/* Review gate */}
        {configuring && step === 'review' && (
          <PlanReview
            targets={plan}
            onChange={setPlan}
            onRun={() => {
              setStep('config');
              swarm.run(plan, { task: task.trim() });
            }}
            onBack={() => setStep('config')}
            error={error}
            title={planTitle}
            planNotes={planNotes}
          />
        )}

        {/* Spawning */}
        {phase === 'spawning' && (
          <div className="flex items-center gap-3 text-sm text-text-muted">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-border-accent border-t-accent" />
            Spawning {tiles.length || plan.length} cloud browsers…
          </div>
        )}

        {/* Grid */}
        {(phase === 'running' || phase === 'done') && (
          <SwarmGrid tiles={tiles} onSelect={(t) => setFocusedId(t.id)} />
        )}
      </div>

      <AnimatePresence>
        {focusedTile && <BrowserModal tile={focusedTile} onClose={() => setFocusedId(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {swarm.reportOpen && (
          <ArtifactModal
            task={reportSubject}
            items={tiles}
            narrative={swarm.narrative}
            loading={swarm.reportLoading}
            onClose={swarm.closeReport}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
