'use client';

// The unified voice-first command-center, on the real FridayShell (top bar + session sidebar +
// mission log). The CENTER column is the swarm: the aura voice orb, the live grid (the hero),
// the plan review, and a mic/text control bar. One useFriday() fuses the realtime voice session
// with the swarm engine — voice tools and the manual controls drive the SAME state, so it's
// demoable with or without a mic. Styling mirrors command-center.tsx (aura orb + glass controls).

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { UIMessage } from 'ai';
import { useFriday } from '@/hooks/use-friday';
import { FridayShell } from '@/components/friday-shell';
import { AgentAudioVisualizerAura } from '@/components/agents-ui/agent-audio-visualizer-aura';
import { SwarmGrid } from '@/components/swarm-grid';
import { PlanReview } from '@/components/plan-review';
import { PlanningLoader } from '@/components/planning-loader';
import { BrowserModal } from '@/components/browser-modal';
import { ArtifactModal } from '@/components/artifact-modal';

// Statuses that count as a settled answer for the header tally (mirrors swarm/page.tsx).
const SETTLED = ['active', 'inactive', 'notfound', 'done'];

/** Flatten a v7 UIMessage to plain text — joins its text parts, ignores the rest. */
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

  const [taskDraft, setTaskDraft] = useState(
    'Check whether these are active, registered businesses: Tesla, Apple, Stripe, OpenAI',
  );
  const [planning, setPlanning] = useState(false);
  const [textInput, setTextInput] = useState('');

  // Manual plan path (shared by the task box + the bottom control bar). planFromTask keeps
  // phase at 'idle', so the page owns the "planning…" moment (same as the swarm page).
  const doPlan = async (t: string) => {
    const q = t.trim();
    if (!q) return;
    setError('');
    setPlanning(true);
    try {
      await manualPlan(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'planning failed');
    } finally {
      setPlanning(false);
    }
  };

  const micActive = voice.status === 'connected';
  const toggleMic = () => (micActive ? voice.disconnect() : voice.connect());

  const settled = tiles.filter((t) => SETTLED.includes(t.status)).length;
  const errored = tiles.filter((t) => t.status === 'error').length;
  const focusedTile = focusedId ? tiles.find((t) => t.id === focusedId) ?? null : null;
  const recent = voice.messages.slice(-6);

  // Top-bar right: swarm scoreboard + report/retry/new (only once a run has started).
  const headerRight =
    phase !== 'idle' ? (
      <div className="flex items-center gap-3">
        <div className="text-right font-mono text-[11px] leading-tight">
          <div>
            <span className="text-friday-text-primary">{settled}</span>
            <span className="text-friday-text-tertiary">/{tiles.length}</span>
          </div>
          <div className="text-friday-text-tertiary">
            {elapsed.toFixed(0)}s{errored ? ` · ${errored} err` : ''}
          </div>
        </div>
        {phase === 'done' && hasUnresolved && (
          <button
            onClick={retryWithStealth}
            disabled={retrying}
            title="Retry blocked tiles with stealth"
            className="rounded-md px-2.5 py-1 text-xs font-semibold text-orange-300 bg-orange-400/15 ring-1 ring-orange-400/40 hover:bg-orange-400/25 disabled:opacity-50 focus-ring"
          >
            {retrying ? '…' : '🛡'}
          </button>
        )}
        {phase === 'done' && (
          <button
            onClick={openReport}
            disabled={retrying}
            className="rounded-md px-2.5 py-1 text-xs font-semibold text-friday-accent bg-friday-accent/15 ring-1 ring-friday-accent/40 hover:bg-friday-accent/25 disabled:opacity-50 focus-ring"
          >
            ✦ Report
          </button>
        )}
        <button
          onClick={resetAll}
          disabled={running || retrying}
          className="rounded-md px-2.5 py-1 text-xs font-medium glass hover:bg-white/[0.06] disabled:opacity-40 focus-ring"
        >
          New
        </button>
      </div>
    ) : null;

  const center = (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {/* Idle: planning loader, hero orb + task box, or the plan review */}
        {phase === 'idle' && planning && <PlanningLoader />}

        {phase === 'idle' && !planning && plan.length === 0 && (
          <div className="flex flex-col items-center gap-6 py-6">
            <AgentAudioVisualizerAura size="lg" state={voice.voiceState} color="#3B82F6" themeMode="dark" />
            <p className="text-sm text-friday-text-secondary">
              {voice.status === 'connected'
                ? 'Listening… tell me what to check.'
                : voice.status === 'connecting'
                  ? 'Connecting…'
                  : 'Tap the mic to talk, or type a task below.'}
            </p>
            <div className="glass-heavy rounded-xl p-5 w-full max-w-xl">
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
              <button
                onClick={() => doPlan(taskDraft)}
                disabled={!taskDraft.trim()}
                className="mt-4 rounded-lg bg-friday-accent/20 px-5 py-2.5 text-sm font-semibold text-friday-accent ring-1 ring-friday-accent/40 hover:bg-friday-accent/30 disabled:opacity-40 focus-ring"
              >
                Plan →
              </button>
            </div>
          </div>
        )}

        {phase === 'idle' && !planning && plan.length > 0 && (
          <PlanReview
            targets={plan}
            onChange={setPlan}
            onRun={() => run(plan, { task: planTitle || taskDraft.trim() || 'Swarm run' })}
            onBack={() => setPlan([])}
            error={error}
            title={planTitle}
            planNotes={planNotes}
          />
        )}

        {phase === 'spawning' && (
          <div className="flex items-center gap-3 text-sm text-friday-text-secondary">
            <div className="h-4 w-4 rounded-full border-2 border-friday-accent/30 border-t-friday-accent animate-spin" />
            Spawning {tiles.length || plan.length} cloud browsers…
          </div>
        )}

        {(phase === 'running' || phase === 'done') && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <AgentAudioVisualizerAura size="sm" state={voice.voiceState} color="#3B82F6" themeMode="dark" />
              <span className="font-mono text-[11px] uppercase tracking-wide text-friday-text-tertiary">
                {voice.status === 'connected' ? voice.voiceState : phase === 'done' ? 'done' : 'running'}
              </span>
            </div>
            <SwarmGrid tiles={tiles} onSelect={(t) => setFocusedId(t.id)} />
          </div>
        )}

        {/* Transcript — compact, only while connected with real turns */}
        {voice.status === 'connected' && recent.length > 0 && (
          <div className="mt-4 glass rounded-xl p-3 max-h-36 overflow-y-auto">
            <div className="space-y-1.5">
              {recent.map((m) => {
                const t = textOf(m);
                if (!t) return null;
                const isStatus = t.startsWith('[status]');
                return (
                  <div
                    key={m.id}
                    className={`text-xs ${isStatus ? 'italic text-friday-text-tertiary/70' : 'text-friday-text-secondary'}`}
                  >
                    <span className="mr-2 font-mono text-[10px] uppercase text-friday-text-tertiary">{m.role}</span>
                    {t}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Controls bar — mic (voice connect toggle) + text-to-plan (mirrors command-center) */}
      <div className="flex-shrink-0 px-4 pb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (textInput.trim()) {
              doPlan(textInput);
              setTextInput('');
            }
          }}
          className="flex items-center gap-3 p-2 glass rounded-xl"
        >
          <button
            type="button"
            onClick={toggleMic}
            aria-label={micActive ? 'End voice session' : 'Start voice session'}
            className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 focus-ring ${
              micActive
                ? 'bg-friday-accent/20 text-friday-accent shadow-glow border border-friday-accent/30'
                : 'glass-subtle text-friday-text-secondary hover:text-friday-text-primary hover:bg-white/[0.08]'
            }`}
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </button>

          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={
              voice.status === 'connecting' ? 'Connecting…' : 'Type a task, or tap the mic to talk…'
            }
            className="flex-1 bg-transparent text-sm text-friday-text-primary placeholder:text-friday-text-tertiary focus:outline-none font-mono selection:bg-friday-accent/30"
          />

          <button
            type="submit"
            disabled={!textInput.trim()}
            aria-label="Plan task"
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-friday-accent/15 text-friday-accent disabled:opacity-30 disabled:cursor-not-allowed hover:bg-friday-accent/25 transition-all duration-200 focus-ring"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m5 12 7-7 7 7" />
              <path d="M12 19V5" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <FridayShell center={center} headerRight={headerRight} onNewSession={resetAll} />

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
    </>
  );
}
