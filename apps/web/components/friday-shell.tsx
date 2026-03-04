'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CommandCenter } from './command-center';

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
}

// ---------------------------------------------------------------------------
// Sidebar placeholder (issue #20)
// ---------------------------------------------------------------------------

/** Animation variants for session cards sliding in from left */
const sessionCardVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
};

const sessionListVariants = {
  visible: {
    transition: { staggerChildren: 0.05 },
  },
};

function SessionSidebar({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="h-full flex flex-col bg-friday-surface border-r border-friday-border">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-friday-border">
        {!collapsed && (
          <span className="text-sm font-semibold text-friday-text-primary tracking-wide uppercase">
            Sessions
          </span>
        )}
        {collapsed && (
          <svg
            className="w-5 h-5 text-friday-text-secondary mx-auto"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18" />
          </svg>
        )}
      </div>

      {/* Session cards with slide-in animation */}
      <motion.div
        className="flex-1 overflow-y-auto px-3 py-3"
        variants={sessionListVariants}
        initial="hidden"
        animate="visible"
      >
        {!collapsed && (
          <motion.p
            variants={sessionCardVariants}
            className="text-xs text-friday-text-tertiary font-mono text-center mt-8"
          >
            Session history will appear here
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mission Log placeholder (right panel)
// ---------------------------------------------------------------------------

function MissionLog() {
  return (
    <div className="h-full flex flex-col bg-friday-surface border-l border-friday-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-friday-border">
        <span className="text-sm font-semibold text-friday-text-primary tracking-wide uppercase">
          Mission Log
        </span>
        {/* Export placeholder */}
        <button
          className="text-friday-text-tertiary hover:text-friday-text-secondary transition-colors duration-150 ease-out focus-ring rounded-md p-1 -m-1"
          aria-label="Export transcript"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" x2="12" y1="15" y2="3" />
          </svg>
        </button>
      </div>

      {/* Transcript area */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="text-xs text-friday-text-tertiary font-mono text-center mt-8">
          Conversation transcript will appear here
        </p>
      </div>

      {/* Example commands */}
      <div className="flex-shrink-0 border-t border-friday-border px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-friday-text-tertiary mb-2 font-semibold">
          Try saying
        </p>
        <div className="space-y-1.5">
          {[
            'Go to Hacker News',
            'Click the top story',
            'What does this page say?',
          ].map((cmd) => (
            <div
              key={cmd}
              className="text-xs text-friday-text-secondary font-mono px-2.5 py-1.5 bg-friday-tertiary rounded-md border border-friday-border hover:border-friday-border-hover hover:text-friday-text-primary transition-colors duration-150 ease-out cursor-default"
            >
              &ldquo;{cmd}&rdquo;
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main shell layout
// ---------------------------------------------------------------------------

export function FridayShell(props: FridayShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="h-screen w-screen overflow-hidden bg-friday-bg flex flex-col">
      {/* Top bar */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 h-12 border-b border-friday-border/60 bg-friday-surface/60 backdrop-blur-xl supports-[backdrop-filter]:bg-friday-surface/40">
        {/* Left — sidebar toggle + logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded-md text-friday-text-secondary hover:text-friday-text-primary hover:bg-friday-tertiary transition-colors duration-150 ease-out focus-ring"
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
          <SessionSidebar collapsed={false} />
        </div>

        {/* Tablet (md-xl): collapsed 60px icon strip */}
        <div className="hidden md:block xl:hidden flex-shrink-0 w-[60px]">
          <SessionSidebar collapsed={true} />
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
                <SessionSidebar collapsed={false} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Center — Command Center */}
        <div className="flex-1 min-w-0">
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
        </div>

        {/* Right — Mission Log (hidden on mobile) */}
        <div className="hidden md:block flex-shrink-0 w-[320px]">
          <MissionLog />
        </div>
      </div>
    </div>
  );
}
