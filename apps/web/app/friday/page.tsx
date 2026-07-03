'use client';

// The unified voice-first command-center — the demo centerpiece. One useFriday() hook fuses
// the realtime voice session with the swarm engine: voice tools set the plan, run it, and focus
// tiles automatically, while the manual controls (task box, plan review, buttons) drive the SAME
// state so the whole thing is demoable without a mic. The swarm grid is the hero; voice is the
// steering wheel. Styling mirrors app/swarm/page.tsx (friday-* + glass tokens, focus-ring).

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { UIMessage } from 'ai';
import { useFriday } from '@/hooks/use-friday';
import { SwarmGrid } from '@/components/swarm-grid';
import { PlanReview } from '@/components/plan-review';
import { PlanningLoader } from '@/components/planning-loader';
import { BrowserModal } from '@/components/browser-modal';
import { ArtifactModal } from '@/components/artifact-modal';
import { AudioOrb } from '@/components/audio-orb';

// Statuses that count as a settled answer for the header tally (mirrors swarm/page.tsx).
const SETTLED = ['active', 'inactive', 'notfound', 'done'];

/** Flatten a v7 UIMessage to its plain text — joins the text parts, ignores everything else. */
function textOf(m: UIMessage): string {
  if (!Array.isArray(m.parts)) return '';
  return m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('').trim();
}

export default function FridayPage() {
  const {
    tiles,
    phase,
    elapsed,
    error,
    retrying,
    running,
    hasUnresolved,
    task,
    reportOpen,
    reportLoading,
    narrative,
    openReport,
    closeReport,
    run,
    retryWithStealth,
    setError,
    voice,
    plan,
    setPlan,
    manualPlan,
    planTitle,
    planNotes,
    focusedId,
    setFocusedId,
    resetAll,
  } = useFriday();

  // Manual fallback: a task draft + a local planning flag (planFromTask keeps phase at 'idle',
  // so the page owns the "planning…" moment itself, same spirit as the swarm page's step state).
  const [taskDraft, setTaskDraft] = useState(
    'Check whether these are active, registered businesses: Tesla, Apple, Stripe, OpenAI',
  );
  const [planning, setPlanning] = useState(false);

  const handlePlan = async () => {
    const t = taskDraft.trim();
    if (!t) return;
    setError('');
    setPlanning(true);
    try {
      await manualPlan(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'planning failed');
    } finally {
      setPlanning(false);
    }
  };

  // Voice → orb: the orb only knows idle/listening/speaking; everything else reads as idle.
  const orbState: 'idle' | 'listening' | 'speaking' =
    voice.voiceState === 'listening'
      ? 'listening'
      : voice.voiceState === 'speaking'
        ? 'speaking'
        : 'idle';

  const settled = tiles.filter((t) => SETTLED.includes(t.status)).length;
  const errored = tiles.filter((t) => t.status === 'error').length;
  const focusedTile = focusedId ? tiles.find((t) => t.id === focusedId) ?? null : null;
  const recentMessages = voice.messages.slice(-6);

  return (
    <div className="min-h-screen w-full bg-friday-bg text-friday-text-primary">
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        {/* Header */}
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              F.R.I.D.A.Y. <span className="text-friday-text-tertiary font-mono">// command</span>
            </h1>
            <p className="text-xs text-friday-text-tertiary">
              Talk to her, or type a task. She plans it, then a swarm of cloud browsers runs it in parallel.
            </p>
          </div>

          {phase !== 'idle' && (
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
              {phase === 'done' && hasUnresolved && (
                <button
                  onClick={retryWithStealth}
                  disabled={retrying}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold text-orange-300 bg-orange-400/15 ring-1 ring-orange-400/40 hover:bg-orange-400/25 disabled:opacity-50 focus-ring"
                >
                  {retrying ? 'Retrying…' : '🛡 Retry blocked'}
                </button>
              )}
              {phase === 'done' && (
                <button
                  onClick={openReport}
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

        {/* Voice control — the primary way to drive everything. */}
        <section className="glass-heavy rounded-xl p-4 mb-4">
          {voice.status === 'connected' ? (
            <div className="flex items-center gap-4">
              <AudioOrb state={orbState} sessionActive />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">F.R.I.D.A.Y. is live</div>
                <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-friday-text-tertiary">
                  {voice.voiceState}
                </div>
              </div>
              <button
                onClick={voice.disconnect}
                className="rounded-md px-3 py-1.5 text-xs font-medium glass hover:bg-white/[0.06] focus-ring"
              >
                End
              </button>
            </div>
          ) : voice.status === 'connecting' ? (
            <div className="flex items-center gap-3 text-sm text-friday-text-secondary">
              <div className="h-4 w-4 rounded-full border-2 border-friday-accent/30 border-t-friday-accent animate-spin" />
              Connecting…
            </div>
          ) : (
            <div className="flex flex-col items-start gap-2">
              <button
                onClick={() => voice.connect()}
                className="rounded-full bg-friday-accent/90 px-8 py-4 text-base font-semibold text-white shadow-glow transition-all duration-200 hover:bg-friday-accent-hover focus-ring"
              >
                🎙 Talk to F.R.I.D.A.Y.
              </button>
              {voice.status === 'error' && (
                <p className="font-mono text-xs text-red-400">
                  Voice connection failed — tap to try again.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Transcript — compact, only while connected with real turns. */}
        {voice.status === 'connected' && recentMessages.length > 0 && (
          <section className="glass rounded-xl p-3 mb-5 max-h-40 overflow-y-auto">
            <div className="space-y-1.5">
              {recentMessages.map((m) => {
                const text = textOf(m);
                if (!text) return null;
                const isStatus = text.startsWith('[status]');
                return (
                  <div
                    key={m.id}
                    className={`text-xs ${
                      isStatus ? 'italic text-friday-text-tertiary/70' : 'text-friday-text-secondary'
                    }`}
                  >
                    <span className="mr-2 font-mono text-[10px] uppercase tracking-wide text-friday-text-tertiary">
                      {m.role}
                    </span>
                    {text}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Main stage */}
        {phase === 'idle' &&
          (planning ? (
            <PlanningLoader />
          ) : plan.length === 0 ? (
            // Manual fallback so the demo works with no mic.
            <div className="glass-heavy rounded-xl p-5 max-w-2xl">
              <label className="block text-xs font-medium text-friday-text-secondary mb-1.5">
                What should F.R.I.D.A.Y. check across the web?
              </label>
              <textarea
                value={taskDraft}
                onChange={(e) => setTaskDraft(e.target.value)}
                rows={3}
                placeholder="e.g. Check if these 12 vendors are real, registered businesses: …"
                className="w-full resize-none rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm focus-ring placeholder:text-friday-text-tertiary"
              />

              {error && <p className="mt-3 text-xs text-red-400 font-mono">{error}</p>}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={handlePlan}
                  disabled={!taskDraft.trim()}
                  className="rounded-lg bg-friday-accent/20 px-5 py-2.5 text-sm font-semibold text-friday-accent ring-1 ring-friday-accent/40 hover:bg-friday-accent/30 disabled:opacity-40 focus-ring"
                >
                  Plan →
                </button>
                <span className="text-xs text-friday-text-tertiary">
                  …or just talk to F.R.I.D.A.Y. above.
                </span>
              </div>
            </div>
          ) : (
            // The plan the agent (or you) made — visible, editable, runnable.
            <PlanReview
              targets={plan}
              onChange={setPlan}
              onRun={() => run(plan, { task: planTitle || taskDraft.trim() || 'Swarm run' })}
              onBack={() => setPlan([])}
              error={error}
              title={planTitle}
              planNotes={planNotes}
            />
          ))}

        {/* Spawning */}
        {phase === 'spawning' && (
          <div className="flex items-center gap-3 text-sm text-friday-text-secondary">
            <div className="h-4 w-4 rounded-full border-2 border-friday-accent/30 border-t-friday-accent animate-spin" />
            Spawning {tiles.length || plan.length} cloud browsers…
          </div>
        )}

        {/* The hero: the live swarm grid */}
        {(phase === 'running' || phase === 'done') && (
          <SwarmGrid tiles={tiles} onSelect={(t) => setFocusedId(t.id)} />
        )}
      </div>

      <AnimatePresence>
        {focusedTile && <BrowserModal tile={focusedTile} onClose={() => setFocusedId(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {reportOpen && (
          <ArtifactModal
            task={planTitle || task || taskDraft}
            items={tiles}
            narrative={narrative}
            loading={reportLoading}
            onClose={closeReport}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
