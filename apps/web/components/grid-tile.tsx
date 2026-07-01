'use client';

import { motion } from 'framer-motion';
import type { WorkerStatus } from '@/lib/sos-adapters';

/** Lifecycle of one browser tile: queued -> working -> a resolved WorkerStatus. */
export type TileState = 'idle' | 'working' | WorkerStatus;

export interface StatusMeta {
  label: string;
  dot: string;
  ring: string;
  text: string;
}

/** Shared status styling — reused by the grid tile and the focus modal. */
export const STATUS_META: Record<TileState, StatusMeta> = {
  idle: { label: 'Queued', dot: 'bg-friday-text-tertiary', ring: 'ring-white/10', text: 'text-friday-text-tertiary' },
  working: { label: 'Working', dot: 'bg-friday-accent', ring: 'ring-friday-accent/60', text: 'text-friday-accent' },
  active: { label: 'Active', dot: 'bg-emerald-400', ring: 'ring-emerald-400/60', text: 'text-emerald-300' },
  inactive: { label: 'Inactive', dot: 'bg-red-400', ring: 'ring-red-400/60', text: 'text-red-300' },
  notfound: { label: 'Not found', dot: 'bg-amber-400', ring: 'ring-amber-400/50', text: 'text-amber-300' },
  blocked: { label: 'Blocked', dot: 'bg-orange-400', ring: 'ring-orange-400/50', text: 'text-orange-300' },
  error: { label: 'Error', dot: 'bg-red-500', ring: 'ring-red-500/60', text: 'text-red-400' },
  // Generic (non-KYB) success. Teal, distinct from KYB's emerald "active".
  done: { label: 'Done', dot: 'bg-teal-400', ring: 'ring-teal-400/60', text: 'text-teal-300' },
};

const RESOLVED: TileState[] = ['active', 'inactive', 'notfound', 'blocked', 'error', 'done'];

export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

interface GridTileProps {
  /** Tile display name (state code for KYB, planned label for general tasks). */
  label: string;
  /** Entry URL — its host is shown in the chrome's address pill. */
  url: string;
  liveViewUrl: string;
  /** Frozen final-page image once the session has been released. */
  screenshotUrl?: string;
  /** Extracted answer to surface on the tile (e.g. "Active", "$799"). */
  result?: string;
  /** Transient worker note shown while working (e.g. "searching", "retrying"). */
  note?: string;
  status: TileState;
  ms?: number;
  /** Click anywhere on the live view to focus this browser. */
  onClick?: () => void;
}

export function GridTile({ label, url, liveViewUrl, screenshotUrl, result, note, status, ms, onClick }: GridTileProps) {
  const m = STATUS_META[status];
  const working = status === 'working';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`relative rounded-lg overflow-hidden glass-heavy ring-1 ${m.ring} transition-colors duration-300`}
    >
      {/* Pulsing glow while the agent works this portal */}
      {working && (
        <motion.div
          aria-hidden
          className="absolute inset-0 z-10 rounded-lg pointer-events-none"
          animate={{
            boxShadow: [
              'inset 0 0 0px var(--accent-glow)',
              'inset 0 0 24px var(--accent-glow)',
              'inset 0 0 0px var(--accent-glow)',
            ],
          }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Browser chrome: traffic lights · state + address pill · status */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white/[0.03] border-b border-white/[0.06]">
        <div className="flex items-center gap-[5px] shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-2 px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
          <span className="text-[10px] font-mono font-semibold text-friday-text-primary truncate max-w-[45%] shrink-0" title={label}>
            {label}
          </span>
          <span className="text-[10px] font-mono text-friday-text-tertiary truncate">{hostOf(url)}</span>
        </div>

        <div className={`flex items-center gap-1.5 shrink-0 ${m.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${m.dot} ${working ? 'animate-pulse' : ''}`} />
          <span className="text-[9px] font-medium uppercase tracking-wide">{m.label}</span>
        </div>
      </div>

      {/* Live Browserbase view */}
      <div className="relative w-full bg-friday-bg" style={{ aspectRatio: '16 / 10' }}>
        {screenshotUrl ? (
          // Session released on completion — show the frozen final page, not a dead iframe.
          <img
            src={screenshotUrl}
            alt={`${label} result`}
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        ) : (
          <iframe
            src={liveViewUrl}
            title={`${label} live view`}
            className="absolute inset-0 w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
          />
        )}
        {/* Keep queued tiles calm until their worker fires */}
        {status === 'idle' && <div className="absolute inset-0 bg-friday-bg/50" />}
        {/* Live worker note (searching / retrying) so agency is visible on camera */}
        {working && note && (
          <div className="absolute top-1.5 left-1.5 z-20 px-1.5 py-0.5 rounded bg-friday-accent/20 backdrop-blur-sm text-[10px] font-medium text-friday-accent ring-1 ring-friday-accent/40 pointer-events-none">
            ↻ {note}
          </div>
        )}
        {/* Extracted answer, surfaced on the tile once resolved (e.g. "Active", "$799"). */}
        {result && RESOLVED.includes(status) && (
          <div className={`absolute bottom-1.5 left-1.5 z-20 max-w-[70%] px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] font-medium truncate pointer-events-none ${m.text}`} title={result}>
            {result}
          </div>
        )}
        {/* Timing badge once resolved */}
        {ms != null && RESOLVED.includes(status) && (
          <div className="absolute bottom-1.5 right-1.5 z-20 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] font-mono text-friday-text-secondary pointer-events-none">
            {(ms / 1000).toFixed(1)}s
          </div>
        )}
        {/* Click-to-focus overlay (grid iframes are previews, not interactive) */}
        {onClick && (
          <button
            type="button"
            onClick={onClick}
            aria-label={`Focus ${label}`}
            className="group absolute inset-0 z-30 cursor-pointer focus-ring"
          >
            <span className="absolute inset-0 bg-transparent transition-colors group-hover:bg-white/[0.05]" />
            <span className="absolute top-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-friday-text-secondary opacity-0 transition-opacity group-hover:opacity-100">
              expand ⛶
            </span>
          </button>
        )}
      </div>
    </motion.div>
  );
}
