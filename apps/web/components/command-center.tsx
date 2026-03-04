'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrowserPreview } from './browser-preview';
import { AudioOrb } from './audio-orb';

type OrbState = 'idle' | 'listening' | 'speaking';

interface CommandCenterProps {
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

export function CommandCenter({
  sessionActive = false,
  screenshotUrl,
  iframeSrc,
  currentUrl,
  sessionId,
  isLoading = false,
  orbState = 'idle',
  audioLevel = 0,
  waveformData,
  onTextCommand,
  onMicToggle,
  micActive = false,
}: CommandCenterProps) {
  const [textInput, setTextInput] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = textInput.trim();
      if (!trimmed || !onTextCommand) return;
      onTextCommand(trimmed);
      setTextInput('');
    },
    [textInput, onTextCommand]
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Browser preview — slides in when session is active */}
      <AnimatePresence>
        {sessionActive && (
          <motion.div
            key="browser"
            className="flex-shrink-0 px-4 pt-4"
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <BrowserPreview
              screenshotUrl={screenshotUrl}
              iframeSrc={iframeSrc}
              currentUrl={currentUrl}
              sessionId={sessionId}
              isLoading={isLoading}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Orb area — centered when idle, pinned to bottom when session active */}
      <motion.div
        layout
        className={`flex items-center justify-center ${
          sessionActive ? 'flex-shrink-0 py-6' : 'flex-1'
        }`}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <AudioOrb
          state={orbState}
          audioLevel={audioLevel}
          waveformData={waveformData}
          sessionActive={sessionActive}
        />
      </motion.div>

      {/* Controls bar — mic button + text input */}
      <div className="flex-shrink-0 px-4 pb-4">
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-3 p-2 bg-friday-secondary rounded-xl border border-friday-border"
        >
          {/* Mic toggle */}
          <button
            type="button"
            onClick={onMicToggle}
            className={`
              flex items-center justify-center w-10 h-10 rounded-lg
              transition-all duration-200
              ${
                micActive
                  ? 'bg-friday-accent/20 text-friday-accent shadow-glow'
                  : 'bg-friday-tertiary text-friday-text-secondary hover:text-friday-text-primary hover:bg-friday-border'
              }
            `}
            aria-label={micActive ? 'Mute microphone' : 'Unmute microphone'}
          >
            {micActive ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="2" x2="22" y1="2" y2="22" />
                <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
                <path d="M5 10v2a7 7 0 0 0 12 5" />
                <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            )}
          </button>

          {/* Text input */}
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-sm text-friday-text-primary placeholder:text-friday-text-tertiary focus:outline-none font-mono"
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={!textInput.trim()}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-friday-accent/15 text-friday-accent disabled:opacity-30 disabled:cursor-not-allowed hover:bg-friday-accent/25 transition-colors"
            aria-label="Send command"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 7-7 7 7" />
              <path d="M12 19V5" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
