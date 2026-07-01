'use client';

// Mission-control swarm grid. Thin UI over the useSwarm engine: it owns the config screen
// (a free-form task box that the planner turns into targets, or a KYB preset), the review
// gate, and the focus/report modals. The hook owns spawning, the client-side fan-out, and
// release. Runs locally for the hero clip AND deploys to Vercel unchanged.

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { STATE_ADAPTERS, SUPPORTED_STATES } from '@/lib/sos-adapters';
import { buildKybTargets, planToTargets, type SwarmTarget } from '@/lib/swarm-target';
import type { PlanTarget } from '@/lib/schemas';
import { useSwarm } from '@/hooks/use-swarm';
import { SwarmGrid } from '@/components/swarm-grid';
import { PlanReview } from '@/components/plan-review';
import { BrowserModal } from '@/components/browser-modal';
import { ArtifactModal } from '@/components/artifact-modal';

// Statuses that count as a settled answer for the header tally.
const SETTLED = ['active', 'inactive', 'notfound', 'done'];

type Mode = 'general' | 'kyb';
type Step = 'config' | 'planning' | 'review';

export default function SwarmPage() {
  const swarm = useSwarm();
  const [mode, setMode] = useState<Mode>('general');
  const [step, setStep] = useState<Step>('config');
  const [task, setTask] = useState('Check whether these are active, registered businesses: Tesla, Apple, Stripe, OpenAI');
  const [autoRun, setAutoRun] = useState(false);
  const [plan, setPlan] = useState<SwarmTarget[]>([]);
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
    <div className="min-h-screen w-full bg-friday-bg text-friday-text-primary">
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        {/* Header */}
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              F.R.I.D.A.Y. <span className="text-friday-text-tertiary font-mono">// swarm</span>
            </h1>
            <p className="text-xs text-friday-text-tertiary">
              Give it a task. It plans the targets, then a swarm of cloud browsers runs them in parallel.
            </p>
          </div>

          {!configuring && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="font-mono text-sm">
                  <span className="text-friday-text-primary">{settled}</span>
                  <span className="text-friday-text-tertiary"> / {tiles.length} resolved</span>
                </div>
                <div className="font-mono text-[11px] text-friday-text-tertiary">
                  {elapsed.toFixed(1)}s{errored > 0 ? ` · ${errored} error` : ''}
                </div>
              </div>
              {phase === 'done' && swarm.hasUnresolved && (
                <button
                  onClick={swarm.retryWithStealth}
                  disabled={retrying}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold text-orange-300 bg-orange-400/15 ring-1 ring-orange-400/40 hover:bg-orange-400/25 disabled:opacity-50 focus-ring"
                >
                  {retrying ? 'Retrying…' : '🛡 Retry blocked w/ stealth'}
                </button>
              )}
              {phase === 'done' && (
                <button
                  onClick={swarm.generateSummary}
                  disabled={retrying}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold text-friday-accent bg-friday-accent/15 ring-1 ring-friday-accent/40 hover:bg-friday-accent/25 disabled:opacity-50 focus-ring"
                >
                  ✦ Report
                </button>
              )}
              <button
                onClick={resetAll}
                disabled={running || retrying}
                className="rounded-md px-3 py-1.5 text-xs font-medium glass hover:bg-white/[0.06] disabled:opacity-40 focus-ring"
              >
                New run
              </button>
            </div>
          )}
        </header>

        {/* Config: task box (general) or KYB preset */}
        {configuring && step === 'config' && (
          <div className="glass-heavy rounded-xl p-5 max-w-2xl">
            {/* Mode toggle */}
            <div className="mb-4 flex gap-2">
              {(['general', 'kyb'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-ring ${
                    mode === m
                      ? 'bg-friday-accent/15 text-friday-accent ring-1 ring-friday-accent/40'
                      : 'glass text-friday-text-secondary hover:text-friday-text-primary'
                  }`}
                >
                  {m === 'general' ? 'General task' : 'Verify business × states'}
                </button>
              ))}
            </div>

            {mode === 'general' ? (
              <>
                <label className="block text-xs font-medium text-friday-text-secondary mb-1.5">
                  What should F.R.I.D.A.Y. check across the web?
                </label>
                <textarea
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  rows={3}
                  placeholder="e.g. Check if these 12 vendors are real, registered businesses: …"
                  className="w-full resize-none rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm focus-ring placeholder:text-friday-text-tertiary"
                />

                <label className="mt-3 flex items-center gap-2 text-xs text-friday-text-secondary cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoRun}
                    onChange={(e) => setAutoRun(e.target.checked)}
                    className="accent-friday-accent"
                  />
                  Just run it (skip the review step)
                </label>

                {planError && <p className="mt-4 text-xs text-red-400 font-mono">{planError}</p>}

                <button
                  onClick={planTask}
                  disabled={!task.trim()}
                  className="mt-4 rounded-lg bg-friday-accent/20 px-5 py-2.5 text-sm font-semibold text-friday-accent ring-1 ring-friday-accent/40 hover:bg-friday-accent/30 disabled:opacity-40 focus-ring"
                >
                  {autoRun ? 'Plan & run →' : 'Plan →'}
                </button>
              </>
            ) : (
              <>
                <label className="block text-xs font-medium text-friday-text-secondary mb-1.5">Entity name</label>
                <input
                  value={entity}
                  onChange={(e) => setEntity(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runKyb()}
                  placeholder="e.g. Tesla, Inc."
                  className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm font-mono focus-ring placeholder:text-friday-text-tertiary"
                />

                <div className="mt-4 mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-medium text-friday-text-secondary">States ({selected.length})</label>
                  <button
                    onClick={() => setSelected(selected.length === SUPPORTED_STATES.length ? [] : SUPPORTED_STATES)}
                    className="text-[11px] text-friday-accent hover:underline"
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
                        className={`rounded-md px-3 py-1.5 text-xs font-mono transition-colors focus-ring ${
                          on
                            ? 'bg-friday-accent/15 text-friday-accent ring-1 ring-friday-accent/40'
                            : 'glass text-friday-text-secondary hover:text-friday-text-primary'
                        }`}
                      >
                        {s} · {STATE_ADAPTERS[s].name}
                      </button>
                    );
                  })}
                </div>

                {error && <p className="mt-4 text-xs text-red-400 font-mono">{error}</p>}

                <button
                  onClick={runKyb}
                  disabled={!entity.trim() || selected.length === 0}
                  className="mt-5 rounded-lg bg-friday-accent/20 px-5 py-2.5 text-sm font-semibold text-friday-accent ring-1 ring-friday-accent/40 hover:bg-friday-accent/30 disabled:opacity-40 focus-ring"
                >
                  Run swarm → {selected.length} browser{selected.length === 1 ? '' : 's'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Planning */}
        {configuring && step === 'planning' && (
          <div className="flex items-center gap-3 text-sm text-friday-text-secondary">
            <div className="w-4 h-4 border-2 border-friday-accent/30 border-t-friday-accent rounded-full animate-spin" />
            Planning targets…
          </div>
        )}

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
          />
        )}

        {/* Spawning */}
        {phase === 'spawning' && (
          <div className="flex items-center gap-3 text-sm text-friday-text-secondary">
            <div className="w-4 h-4 border-2 border-friday-accent/30 border-t-friday-accent rounded-full animate-spin" />
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
        {swarm.summaryOpen && (
          <ArtifactModal
            entity={reportSubject}
            summary={swarm.summaryText}
            loading={swarm.summaryLoading}
            onClose={swarm.closeSummary}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
