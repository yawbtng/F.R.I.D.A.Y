'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CommandCenter } from './command-center';
import { SessionSidebar } from './session-sidebar';
import { MissionLog } from './mission-log';

type OrbState = 'idle' | 'listening' | 'speaking';

/** Error to display in the shell */
interface ShellError {
  type: 'session-expired' | 'navigation' | 'agent-disconnected' | 'generic';
  message: string;
  suggestion?: string;
  retryInSeconds?: number;
}

/** Session data for export */
interface ExportSessionData {
  title?: string;
  browserbaseSessionId: string;
  currentUrl?: string;
  status: 'active' | 'idle' | 'error';
  createdAt: number;
  commands: Array<{
    input: string;
    result?: string;
    toolsUsed?: string[];
    status: 'pending' | 'running' | 'done' | 'error';
    errorMessage?: string;
    durationMs?: number;
    screenshotUrl?: string;
    createdAt: number;
  }>;
}

interface FridayShellProps {
  /** Whether a browser session is active */
  sessionActive?: boolean;
  /** Whether a session is being created */
  sessionCreating?: boolean;
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
  /** Callback when user clicks "+ New Session" */
  onNewSession?: () => void;
  /** Current error to display */
  error?: ShellError | null;
  /** Called to retry/dismiss errors */
  onErrorRetry?: () => void;
  /** Session data for export functionality */
  exportData?: ExportSessionData | null;
}

// ---------------------------------------------------------------------------
// Main shell layout
// ---------------------------------------------------------------------------

export function FridayShell(props: FridayShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Shared sidebar props
  const sidebarProps = {
    activeSessionId: props.sessionId,
    onSelectSession: props.onSelectSession,
    onNewSession: props.onNewSession,
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-friday-bg flex flex-col">
      {/* Top bar */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 h-12 border-b border-friday-border bg-friday-surface/80 backdrop-blur-sm">
        {/* Left — sidebar toggle + logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded-md text-friday-text-secondary hover:text-friday-text-primary hover:bg-friday-tertiary transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <line x1="3" x2="21" y1="6" y2="6" />
              <line x1="3" x2="21" y1="12" y2="12" />
              <line x1="3" x2="21" y1="18" y2="18" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-friday-accent shadow-glow" />
            <span className="text-sm font-semibold text-friday-text-primary tracking-wide">
              F.R.I.D.A.Y.
            </span>
          </div>
        </div>

        {/* Right — status indicator */}
        <div className="flex items-center gap-2">
          {props.sessionId && (
            <div className="flex items-center gap-1.5 text-xs text-friday-text-tertiary font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-friday-active" />
              Active
            </div>
          )}
        </div>
      </header>

      {/* Main content — 3-column grid */}
      <div className="flex-1 min-h-0 flex">
        {/* Left sidebar — desktop: always visible, tablet: icon strip, mobile: overlay */}
        {/* Desktop (xl+): full 280px sidebar */}
        <div className="hidden xl:block flex-shrink-0 w-[280px]">
          <SessionSidebar collapsed={false} {...sidebarProps} />
        </div>

        {/* Tablet (md-xl): collapsed 60px icon strip */}
        <div className="hidden md:block xl:hidden flex-shrink-0 w-[60px]">
          <SessionSidebar collapsed={true} {...sidebarProps} />
        </div>

        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                key="sidebar-backdrop"
                className="md:hidden fixed inset-0 z-40 bg-black/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
              />
              <motion.div
                key="sidebar-panel"
                className="md:hidden fixed inset-y-0 left-0 z-50 w-[280px]"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <SessionSidebar collapsed={false} {...sidebarProps} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Center — Command Center */}
        <div className="flex-1 min-w-0">
          <CommandCenter
            sessionActive={props.sessionActive}
            sessionCreating={props.sessionCreating}
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
        </div>

        {/* Right — Mission Log (hidden on mobile) */}
        <div className="hidden md:block flex-shrink-0 w-[320px]">
          <MissionLog
            sessionId={props.sessionId}
            error={props.error}
            onErrorRetry={props.onErrorRetry}
            exportData={props.exportData}
          />
        </div>
      </div>
    </div>
  );
}
