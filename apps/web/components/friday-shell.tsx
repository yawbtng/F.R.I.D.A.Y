'use client';

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CommandCenter } from './command-center';
import { SessionSidebar } from './session-sidebar';
import { MissionLog } from './mission-log';

type OrbState = 'idle' | 'listening' | 'speaking';

interface FridayShellProps {
  /** Whether a browser session is active */
  sessionActive?: boolean;
  /** Current screenshot URL */
  screenshotUrl?: string;
  /** Browserbase debug iframe URL */
  iframeSrc?: string;
  /** Current page URL */
  currentUrl?: string;
  /** Active session ID */
  sessionId?: string;
  /** Whether the browser is loading */
  isLoading?: boolean;
  /** Audio orb state */
  orbState?: OrbState;
  /** Audio level 0-1 */
  audioLevel?: number;
  /** Waveform data */
  waveformData?: number[];
  /** Callback when user submits text command */
  onTextCommand?: (command: string) => void;
  /** Callback when mic button is toggled */
  onMicToggle?: () => void;
  /** Whether the mic is active */
  micActive?: boolean;
  /** Callback when user selects a session from sidebar */
  onSelectSession?: (sessionId: string) => void;
  /** Callback when user clicks New Session */
  onNewSession?: () => void;
  /** Whether a session is being created */
  sessionCreating?: boolean;
  /** Optional override for the center column (Phase B swarm command-center). */
  center?: ReactNode;
  /** Optional extra content for the top-bar right side (e.g. swarm scoreboard + buttons). */
  headerRight?: ReactNode;
  /** Optional override for the right Mission Log panel (Phase B live-run panel). */
  rightPanel?: ReactNode;
}

// Real SessionSidebar and MissionLog are imported above from their own files.

// ---------------------------------------------------------------------------
// Main shell layout
// ---------------------------------------------------------------------------

export function FridayShell(props: FridayShellProps) {
  // Both side panels are user-collapsible so the browser grid can take the whole width.
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  return (
    <div className="h-screen w-screen overflow-hidden bg-friday-bg flex flex-col">
      {/* Top bar */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 h-12 glass glass-highlight">
        {/* Left — Sessions toggle + logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLeftOpen((v) => !v)}
            className="flex items-center justify-center w-8 h-8 rounded-md text-friday-text-secondary hover:text-friday-text-primary hover:bg-friday-tertiary transition-colors duration-150 ease-out focus-ring"
            aria-label={leftOpen ? 'Hide sessions' : 'Show sessions'}
            title={leftOpen ? 'Hide sessions' : 'Show sessions'}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" x2="9" y1="3" y2="21" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-friday-accent shadow-glow" />
            <span className="text-sm font-semibold text-friday-text-primary tracking-wide">
              F.R.I.D.A.Y.
            </span>
          </div>
        </div>

        {/* Right — status indicator + optional swarm controls + Mission Log toggle */}
        <div className="flex items-center gap-3">
          {props.sessionId && (
            <div className="flex items-center gap-1.5 text-xs text-friday-text-tertiary font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-friday-active" />
              Active
            </div>
          )}
          {props.headerRight}
          <button
            onClick={() => setRightOpen((v) => !v)}
            className="hidden md:flex items-center justify-center w-8 h-8 rounded-md text-friday-text-secondary hover:text-friday-text-primary hover:bg-friday-tertiary transition-colors duration-150 ease-out focus-ring"
            aria-label={rightOpen ? 'Hide mission log' : 'Show mission log'}
            title={rightOpen ? 'Hide mission log' : 'Show mission log'}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="15" x2="15" y1="3" y2="21" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main content — collapsible 3-column layout */}
      <div className="flex-1 min-h-0 flex">
        {/* Left sidebar (md+) — smoothly collapses to zero width */}
        <AnimatePresence initial={false}>
          {leftOpen && (
            <motion.div
              key="left-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
              className="hidden md:block flex-shrink-0 overflow-hidden"
            >
              <div className="h-full w-[280px]">
                <SessionSidebar collapsed={false} activeSessionId={props.sessionId} onSelectSession={props.onSelectSession} onNewSession={props.onNewSession} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {leftOpen && (
            <>
              <motion.div
                key="sidebar-backdrop"
                className="md:hidden fixed inset-0 z-40 bg-black/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setLeftOpen(false)}
              />
              <motion.div
                key="sidebar-panel"
                className="md:hidden fixed inset-y-0 left-0 z-50 w-[280px]"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <SessionSidebar collapsed={false} activeSessionId={props.sessionId} onSelectSession={props.onSelectSession} onNewSession={props.onNewSession} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Center — swarm command-center (Phase B) or the default single-browser CommandCenter */}
        <div className="flex-1 min-w-0">
          {props.center ?? (
            <CommandCenter
              sessionActive={props.sessionActive}
              screenshotUrl={props.screenshotUrl}
              iframeSrc={props.iframeSrc}
              currentUrl={props.currentUrl}
              sessionId={props.sessionId}
              isLoading={props.isLoading}
              orbState={props.orbState}
              audioLevel={props.audioLevel}
              waveformData={props.waveformData}
              onTextCommand={props.onTextCommand}
              onMicToggle={props.onMicToggle}
              micActive={props.micActive}
            />
          )}
        </div>

        {/* Right — Mission Log (md+, hidden on mobile) — smoothly collapses. Defaults to the
            Convex log; Phase B passes a live-run panel via rightPanel. */}
        <AnimatePresence initial={false}>
          {rightOpen && (
            <motion.div
              key="right-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
              className="hidden md:block flex-shrink-0 overflow-hidden"
            >
              <div className="h-full w-[320px]">
                {props.rightPanel ?? <MissionLog sessionId={props.sessionId} />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
