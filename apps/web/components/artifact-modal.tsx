'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { STATUS_META, hostOf, type TileState } from './grid-tile';
import {
  buildReport,
  reportToMarkdown,
  reportToPrintableHtml,
  RESOLVED_STATUSES,
  type ReportItem,
  type ReportNarrative,
} from '@/lib/report';

const SYNTH_STEPS = [
  'Reading the results…',
  'Grouping resolved vs. needs-work…',
  'Flagging what needs attention…',
  'Writing the summary…',
];

const metaFor = (status: string) =>
  STATUS_META[(status as TileState) in STATUS_META ? (status as TileState) : 'error'];

/** At-a-glance chart: a segmented proportion bar of the per-status counts (colors from the
 *  tile status palette). Deterministic from the report data — always renders, no dependency. */
function StatusBar({ byStatus, total }: { byStatus: Record<string, number>; total: number }) {
  const denom = total || 1;
  const entries = Object.entries(byStatus).filter(([, n]) => n > 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full ring-1 ring-white/10 bg-white/[0.04]">
      {entries.map(([s, n]) => {
        const m = metaFor(s);
        return (
          <div
            key={s}
            className={m.dot}
            style={{ width: `${(n / denom) * 100}%` }}
            title={`${n} ${m.label}`}
          />
        );
      })}
    </div>
  );
}

/** Cycles through synthesis steps while the AI narrative is in flight. */
function SynthLoader() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => Math.min(x + 1, SYNTH_STEPS.length - 1)), 1100);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2 text-sm text-friday-text-secondary">
      <div className="w-3.5 h-3.5 border-2 border-friday-accent/30 border-t-friday-accent rounded-full animate-spin" />
      {SYNTH_STEPS[i]}
    </div>
  );
}

function ItemRow({ it }: { it: ReportItem }) {
  const m = metaFor(it.status);
  return (
    <div className="flex items-center gap-3 py-2 border-t border-white/[0.05] first:border-t-0">
      {it.screenshotUrl ? (
        <img src={it.screenshotUrl} alt="" className="w-16 h-10 shrink-0 object-cover rounded ring-1 ring-white/10" />
      ) : (
        <div className="w-16 h-10 shrink-0 rounded bg-white/[0.04] ring-1 ring-white/10" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-friday-text-primary truncate">{it.label}</div>
        {it.url && (
          <a
            href={it.url}
            target="_blank"
            rel="noreferrer"
            className="block text-[11px] font-mono text-friday-accent hover:underline truncate"
          >
            {hostOf(it.url)}
          </a>
        )}
      </div>
      <span className={`shrink-0 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide ${m.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
        {m.label}
      </span>
      <div className={`shrink-0 max-w-[38%] text-sm font-semibold truncate text-right ${m.text}`} title={it.result}>
        {it.result || '—'}
      </div>
    </div>
  );
}

/** Structured verification artifact: deterministic per-target rows + AI synthesis, exportable. */
export function ArtifactModal({
  task,
  items,
  narrative,
  loading,
  onClose,
}: {
  task: string;
  items: ReportItem[];
  narrative: ReportNarrative | null;
  loading: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const model = buildReport(task, items, narrative);
  const resolved = model.items.filter((it) => RESOLVED_STATUSES.has(it.status));
  const needsWork = model.items.filter((it) => !RESOLVED_STATUSES.has(it.status));

  const downloadMarkdown = () => {
    const blob = new Blob([reportToMarkdown(model)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'friday-report.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const printPdf = () => {
    // Open the self-contained report HTML in a new tab (blob URL, same-origin) and print it —
    // the browser's "Save as PDF" renders text + inline thumbnails at full fidelity.
    const blob = new Blob([reportToPrintableHtml(model)], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) {
      URL.revokeObjectURL(url);
      return;
    }
    w.addEventListener('load', () => w.print(), { once: true });
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const btn = 'rounded-md px-2.5 py-1 text-[11px] font-medium glass hover:bg-white/[0.08] focus-ring';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-3xl rounded-xl overflow-hidden glass-heavy ring-1 ring-white/10 flex flex-col max-h-[85vh]"
        initial={{ scale: 0.96, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] shrink-0">
          <span className="text-sm font-semibold text-friday-accent shrink-0">✦ Verification report</span>
          <span className="text-xs text-friday-text-tertiary truncate">— {task}</span>
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <button onClick={downloadMarkdown} className={btn} title="Download Markdown">
              ⤓ Markdown
            </button>
            <button onClick={printPdf} className={btn} title="Save as PDF">
              ⎙ PDF
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-md text-friday-text-tertiary hover:text-friday-text-primary hover:bg-white/[0.06] focus-ring"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-4 py-4 space-y-4">
          {/* Counts band */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="text-sm font-mono">
              <span className="text-friday-text-primary font-semibold">{model.counts.resolved}</span>
              <span className="text-friday-text-tertiary"> / {model.counts.total} resolved</span>
            </span>
            {Object.entries(model.counts.byStatus).map(([s, n]) => {
              const meta = metaFor(s);
              return (
                <span key={s} className={`flex items-center gap-1 text-[11px] ${meta.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                  {n} {meta.label.toLowerCase()}
                </span>
              );
            })}
          </div>

          {/* At-a-glance chart */}
          <StatusBar byStatus={model.counts.byStatus} total={model.counts.total} />

          {/* AI headline (or synthesis loader) */}
          <div className="min-h-[1.25rem]">
            {narrative
              ? narrative.headline && (
                  <p className="text-sm font-medium text-friday-text-primary">{narrative.headline}</p>
                )
              : loading && <SynthLoader />}
          </div>

          {/* Verified */}
          {resolved.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-friday-text-tertiary mb-1">
                Verified · {resolved.length}
              </h3>
              <div className="rounded-lg glass px-3">
                {resolved.map((it) => (
                  <ItemRow key={it.label} it={it} />
                ))}
              </div>
            </div>
          )}

          {/* Needs attention */}
          {needsWork.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-friday-text-tertiary mb-1">
                Needs attention · {needsWork.length}
              </h3>
              <div className="rounded-lg glass px-3">
                {needsWork.map((it) => (
                  <ItemRow key={it.label} it={it} />
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {narrative && narrative.notes.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-friday-text-tertiary mb-1">Notes</h3>
              <ul className="space-y-1">
                {narrative.notes.map((n, i) => (
                  <li key={i} className="flex gap-2 text-xs text-friday-text-secondary">
                    <span className="text-friday-text-tertiary">·</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Takeaway */}
          {narrative?.takeaway && (
            <div className="pt-2 border-t border-white/[0.08]">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-friday-text-tertiary">Takeaway </span>
              <span className="text-sm text-friday-text-primary">{narrative.takeaway}</span>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
