'use client';

// The unified voice-first command-center, on the real FridayShell (top bar + session sidebar +
// mission log). The CENTER column is the swarm: the aura voice orb, the live grid (the hero),
// the plan review, and a mic/text control bar. One useFriday() fuses the realtime voice session
// with the swarm engine — voice tools and the manual controls drive the SAME state, so it's
// demoable with or without a mic. Styling mirrors command-center.tsx (aura orb + glass controls).

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Shield, Sparkles } from 'lucide-react';
import { useFriday } from '@/hooks/use-friday';
import { FridayShell } from '@/components/friday-shell';
import { AgentAudioVisualizerAura } from '@/components/agents-ui/agent-audio-visualizer-aura';
import { SwarmGrid } from '@/components/swarm-grid';
import { PlanReview } from '@/components/plan-review';
import { PlanningLoader } from '@/components/planning-loader';
import { BrowserModal } from '@/components/browser-modal';
import { ArtifactModal } from '@/components/artifact-modal';
import { LiveRunPanel } from '@/components/live-run-panel';

// Statuses that count as a settled answer for the header tally (mirrors swarm/page.tsx).
const SETTLED = ['active', 'inactive', 'notfound', 'done'];

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
    diagram,
    visualize,
    messages,
    resetAll,
  } = useFriday();

  const [planning, setPlanning] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [diagramLoading, setDiagramLoading] = useState(false);

  // Report-modal "Diagram" button (no-voice path): generate a Mermaid diagram from the finished run.
  const doVisualize = async () => {
    setDiagramLoading(true);
    try {
      await visualize();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'diagram failed');
    } finally {
      setDiagramLoading(false);
    }
  };

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

  const connected = voice.status === 'connected';
  const connecting = voice.status === 'connecting';

  const settled = tiles.filter((t) => SETTLED.includes(t.status)).length;
  const errored = tiles.filter((t) => t.status === 'error').length;
  const focusedTile = focusedId ? tiles.find((t) => t.id === focusedId) ?? null : null;

  // Never surface transport/error micro-states ('failed'/'connecting'/'disconnected') as the big
  // orb label — mid-run they read as alarming even when voice is fine. Show only conversational
  // states; otherwise a neutral word tied to the swarm phase.
  const conversational =
    voice.voiceState === 'listening' ||
    voice.voiceState === 'speaking' ||
    voice.voiceState === 'thinking';
  const orbState = conversational ? voice.voiceState : 'idle';
  const voiceWord = conversational ? voice.voiceState : phase === 'done' ? 'done' : 'running';

  // Top-bar right: swarm scoreboard + report/retry/new (only once a run has started).
  const headerRight =
    phase !== 'idle' ? (
      <div className="flex items-center gap-3">
        <div className="text-right font-mono text-[11px] leading-tight">
          <div>
            <span className="text-text">{settled}</span>
            <span className="text-text-muted">/{tiles.length}</span>
          </div>
          <div className="text-text-muted">
            {elapsed.toFixed(0)}s{errored ? ` · ${errored} err` : ''}
          </div>
        </div>
        {phase === 'done' && hasUnresolved && (
          <button
            onClick={retryWithStealth}
            disabled={retrying}
            title="Retry blocked tiles with stealth"
            className="inline-flex items-center justify-center rounded-md border border-border bg-warning-tint px-2.5 py-1 text-xs font-semibold text-warning-fg transition-colors duration-200 ease-brand hover:bg-surface-2 disabled:opacity-50 focus-ring"
          >
            {retrying ? '…' : <Shield className="h-3.5 w-3.5" aria-hidden />}
          </button>
        )}
        {phase === 'done' && (
          <button
            onClick={openReport}
            disabled={retrying}
            className="inline-flex items-center gap-1.5 rounded-pill bg-accent px-2.5 py-1 text-xs font-semibold text-accent-fg-strong shadow-inset-top transition-[background-color,border-radius] duration-200 ease-brand hover:bg-accent-hover hover:rounded-lg disabled:opacity-50 focus-ring"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Report
          </button>
        )}
        <button
          onClick={resetAll}
          disabled={running || retrying}
          className="rounded-pill border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text transition-colors duration-200 ease-brand hover:bg-surface-2 disabled:opacity-40 focus-ring"
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
          <div className="flex h-full flex-col items-center justify-center gap-5 py-6 text-center">
            <AgentAudioVisualizerAura size="lg" state={orbState} color="#FF4500" />
            <p className="text-sm text-text-muted">
              {voice.status === 'connected'
                ? 'Listening… tell me what to check.'
                : voice.status === 'connecting'
                  ? 'Connecting…'
                  : 'Tap the mic to talk, or type a task in the bar below.'}
            </p>
            {error && <p className="font-mono text-xs text-error-fg">{error}</p>}
          </div>
        )}

        {phase === 'idle' && !planning && plan.length > 0 && (
          <PlanReview
            targets={plan}
            onChange={setPlan}
            onRun={() => run(plan, { task: planTitle || 'Swarm run' })}
            onBack={() => setPlan([])}
            error={error}
            title={planTitle}
            planNotes={planNotes}
          />
        )}

        {phase === 'spawning' && (
          <div className="flex items-center gap-3 text-sm text-text-muted">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-border-accent border-t-accent" />
            Spawning {tiles.length || plan.length} cloud browsers…
          </div>
        )}

        {(phase === 'running' || phase === 'done') && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <AgentAudioVisualizerAura size="sm" state={orbState} color="#FF4500" />
              <span className="font-mono text-[11px] uppercase tracking-wide text-text-muted">
                {voiceWord}
              </span>
            </div>
            <SwarmGrid tiles={tiles} onSelect={(t) => setFocusedId(t.id)} />
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
          className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2 shadow-inset-top"
        >
          {!connected ? (
            // Not in a call: single button starts the voice session.
            <button
              type="button"
              onClick={() => voice.connect()}
              disabled={connecting}
              aria-label="Start voice session"
              title="Start voice"
              className="flex items-center justify-center w-10 h-10 rounded-lg border border-border bg-surface text-text-muted hover:bg-surface-2 hover:text-text transition-colors duration-200 ease-brand focus-ring disabled:opacity-50"
            >
              {connecting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-border-accent border-t-accent" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              )}
            </button>
          ) : (
            // In a call: mute/unmute the mic (session stays live) + a separate end button.
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={voice.toggleMute}
                aria-label={voice.muted ? 'Unmute microphone' : 'Mute microphone'}
                title={voice.muted ? 'Muted — tap to talk' : 'Mute'}
                className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors duration-200 ease-brand focus-ring ${
                  voice.muted
                    ? 'bg-error-tint text-error-fg border border-border'
                    : 'bg-[var(--accent-pulse)] text-accent-text shadow-glow border border-border-accent'
                }`}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                  {voice.muted && <line x1="4" y1="3" x2="20" y2="21" />}
                </svg>
              </button>
              <button
                type="button"
                onClick={voice.disconnect}
                aria-label="End voice session"
                title="End session"
                className="flex items-center justify-center w-10 h-10 rounded-lg border border-border bg-surface text-text-muted hover:text-error-fg hover:bg-error-tint transition-colors duration-200 ease-brand focus-ring"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            </div>
          )}

          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={
              voice.status === 'connecting' ? 'Connecting…' : 'Type a task, or tap the mic to talk…'
            }
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text-subtle focus:outline-none font-mono selection:bg-accent selection:text-accent-fg-strong"
          />

          <button
            type="submit"
            disabled={!textInput.trim()}
            aria-label="Plan task"
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent text-accent-fg-strong shadow-inset-top disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent-hover active:scale-[0.98] transition-[background-color,transform] duration-200 ease-brand focus-ring"
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

  const rightPanel = (
    <LiveRunPanel
      messages={messages}
      tiles={tiles}
      phase={phase}
      elapsed={elapsed}
      title={planTitle || task}
      listening={voice.voiceState === 'listening'}
    />
  );

  return (
    <>
      <FridayShell center={center} headerRight={headerRight} rightPanel={rightPanel} onNewSession={resetAll} />

      <AnimatePresence>
        {focusedTile && <BrowserModal tile={focusedTile} onClose={() => setFocusedId(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {reportOpen && (
          <ArtifactModal
            task={planTitle || task || 'F.R.I.D.A.Y. run'}
            items={tiles}
            narrative={narrative}
            loading={reportLoading}
            diagram={diagram}
            diagramLoading={diagramLoading}
            onVisualize={doVisualize}
            onClose={closeReport}
          />
        )}
      </AnimatePresence>
    </>
  );
}
