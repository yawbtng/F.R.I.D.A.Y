'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';

/** The end-of-run artifact: an AI-synthesized KYB verification report over the swarm results. */
export function ArtifactModal({
  entity,
  summary,
  loading,
  onClose,
}: {
  entity: string;
  summary: string;
  loading: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-2xl rounded-xl overflow-hidden glass-heavy ring-1 ring-friday-accent/30"
        initial={{ scale: 0.96, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-white/[0.03] border-b border-white/[0.06]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-friday-accent">✦</span>
            <h2 className="text-sm font-semibold truncate">
              Verification report — <span className="font-mono text-friday-text-secondary">{entity}</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-2 flex h-7 w-7 items-center justify-center rounded-md text-friday-text-tertiary hover:text-friday-text-primary hover:bg-white/[0.06] focus-ring"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-3 text-sm text-friday-text-secondary">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-friday-accent/30 border-t-friday-accent" />
              Synthesizing findings…
            </div>
          ) : (
            <p className="whitespace-pre-line text-sm leading-relaxed text-friday-text-secondary">{summary}</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
