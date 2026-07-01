'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { STATUS_META, hostOf } from './grid-tile';
import { SessionReplay } from './session-replay';
import type { Tile } from './swarm-grid';

/** Full-attention view of one browser. Live iframe while the session is open;
 *  the frozen final screenshot once the session has been released. */
export function BrowserModal({ tile, onClose }: { tile: Tile; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const m = STATUS_META[tile.status];
  const resolved = tile.status !== 'idle' && tile.status !== 'working';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className={`w-full max-w-5xl rounded-xl overflow-hidden glass-heavy ring-1 ${m.ring}`}
        initial={{ scale: 0.96, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Chrome */}
        <div className="flex items-center gap-2.5 px-3 py-2 bg-white/[0.03] border-b border-white/[0.06]">
          <div className="flex items-center gap-[6px] shrink-0">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>

          <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-1 rounded-md bg-white/[0.04] border border-white/[0.06]">
            <span className="text-xs font-mono font-semibold text-friday-text-primary shrink-0">{tile.label}</span>
            <span className="text-xs font-mono text-friday-text-tertiary truncate">· {hostOf(tile.url)}</span>
          </div>

          <div className={`flex items-center gap-1.5 shrink-0 ${m.text}`}>
            <span className={`w-2 h-2 rounded-full ${m.dot}`} />
            <span className="text-xs font-medium uppercase tracking-wide">{m.label}</span>
            {tile.result && <span className="text-xs font-mono text-friday-text-secondary truncate max-w-[16rem]">· {tile.result}</span>}
            {tile.ms != null && (
              <span className="text-xs font-mono text-friday-text-tertiary">· {(tile.ms / 1000).toFixed(1)}s</span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-friday-text-tertiary hover:text-friday-text-primary hover:bg-white/[0.06] focus-ring"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* View: scrubable replay once the run is done; live session while it's still working */}
        <div className="relative w-full bg-friday-bg" style={{ aspectRatio: '16 / 10' }}>
          {resolved ? (
            <SessionReplay sessionId={tile.sessionId} token={tile.token} poster={tile.screenshotUrl} />
          ) : (
            <iframe
              src={tile.liveViewUrl}
              title={`${tile.label} focused`}
              className="absolute inset-0 w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
