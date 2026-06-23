'use client';

import { motion } from 'framer-motion';
import type { WorkerStatus } from '@/lib/sos-adapters';

/** Lifecycle of one browser tile: queued -> working -> a resolved WorkerStatus. */
export type TileState = 'idle' | 'working' | WorkerStatus;

interface StatusMeta {
  label: string;
  dot: string;
  ring: string;
  text: string;
}

const META: Record<TileState, StatusMeta> = {
  idle: { label: 'Queued', dot: 'bg-friday-text-tertiary', ring: 'ring-white/10', text: 'text-friday-text-tertiary' },
  working: { label: 'Working', dot: 'bg-friday-accent', ring: 'ring-friday-accent/60', text: 'text-friday-accent' },
  active: { label: 'Active', dot: 'bg-emerald-400', ring: 'ring-emerald-400/60', text: 'text-emerald-300' },
  inactive: { label: 'Inactive', dot: 'bg-red-400', ring: 'ring-red-400/60', text: 'text-red-300' },
  notfound: { label: 'Not found', dot: 'bg-amber-400', ring: 'ring-amber-400/50', text: 'text-amber-300' },
  error: { label: 'Error', dot: 'bg-red-500', ring: 'ring-red-500/60', text: 'text-red-400' },
};

const RESOLVED: TileState[] = ['active', 'inactive', 'notfound', 'error'];

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

interface GridTileProps {
  stateCode: string;
  stateName: string;
  /** Portal entry URL — its host is shown in the chrome's address pill. */
  url: string;
  liveViewUrl: string;
  status: TileState;
  ms?: number;
}

export function GridTile({ stateCode, stateName, url, liveViewUrl, status, ms }: GridTileProps) {
  const m = META[status];
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
          <span className="text-[10px] font-mono font-semibold text-friday-text-primary shrink-0">{stateCode}</span>
          <span className="text-[10px] font-mono text-friday-text-tertiary truncate" title={stateName}>
            {hostOf(url)}
          </span>
        </div>

        <div className={`flex items-center gap-1.5 shrink-0 ${m.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${m.dot} ${working ? 'animate-pulse' : ''}`} />
          <span className="text-[9px] font-medium uppercase tracking-wide">{m.label}</span>
        </div>
      </div>

      {/* Live Browserbase view */}
      <div className="relative w-full bg-friday-bg" style={{ aspectRatio: '16 / 10' }}>
        <iframe
          src={liveViewUrl}
          title={`${stateName} live view`}
          className="absolute inset-0 w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin"
        />
        {/* Keep queued tiles calm until their worker fires */}
        {status === 'idle' && <div className="absolute inset-0 bg-friday-bg/50" />}
        {/* Timing badge once resolved */}
        {ms != null && RESOLVED.includes(status) && (
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] font-mono text-friday-text-secondary">
            {(ms / 1000).toFixed(1)}s
          </div>
        )}
      </div>
    </motion.div>
  );
}
