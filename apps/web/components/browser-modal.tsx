'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-[var(--scrim)] backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-5xl rounded-lg overflow-hidden border border-border bg-surface shadow-overlay"
        initial={{ scale: 0.96, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Chrome */}
        <div className="flex items-center gap-2.5 px-3 py-2 bg-surface-2 border-b border-border">
          <div className="flex items-center gap-[6px] shrink-0">
            <span className="w-3 h-3 rounded-full bg-wc-red" />
            <span className="w-3 h-3 rounded-full bg-wc-yellow" />
            <span className="w-3 h-3 rounded-full bg-wc-green" />
          </div>

          <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-1 rounded-md bg-surface border border-border">
            <span className="text-xs font-mono font-semibold text-text shrink-0">{tile.label}</span>
            <span className="text-xs font-mono text-text-muted truncate">· {hostOf(tile.url)}</span>
          </div>

          <div className={`flex items-center gap-1.5 shrink-0 ${m.text}`}>
            <span className={`w-2 h-2 rounded-full ${m.dot}`} />
            <span className="text-xs font-medium uppercase tracking-wide">{m.label}</span>
            {tile.result && <span className="text-xs font-mono text-text-muted truncate max-w-[16rem]">· {tile.result}</span>}
            {tile.ms != null && (
              <span className="text-xs font-mono text-text-subtle">· {(tile.ms / 1000).toFixed(1)}s</span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-surface-2 focus-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* View: scrubable replay once the run is done; live session while it's still working */}
        <div className="relative w-full bg-surface-sunken" style={{ aspectRatio: '16 / 10' }}>
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
