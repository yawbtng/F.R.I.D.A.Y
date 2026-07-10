'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Printer } from 'lucide-react';
import { STATUS_META, hostOf, type TileState } from './grid-tile';
import {
  buildReport,
  donutSvg,
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

/** The report renders on paper-grade surfaces, so per-status color maps to the Browserbase
 *  semantic status tokens (grid-tile's STATUS_META keeps the raw tile palette for the live grid).
 *  Full literal class strings so Tailwind's JIT statically detects them. */
type StatusTone = 'success' | 'warning' | 'error' | 'neutral';

const STATUS_TONE: Record<string, StatusTone> = {
  active: 'success',
  done: 'success',
  inactive: 'error',
  error: 'error',
  notfound: 'warning',
  blocked: 'warning',
  working: 'neutral',
  idle: 'neutral',
};

const toneOf = (status: string): StatusTone => STATUS_TONE[status] ?? 'error';

const TONE_DOT: Record<StatusTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  neutral: 'bg-neutral',
};

const TONE_FG: Record<StatusTone, string> = {
  success: 'text-success-fg',
  warning: 'text-warning-fg',
  error: 'text-error-fg',
  neutral: 'text-neutral-fg',
};

const TONE_VAR: Record<StatusTone, string> = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  error: 'var(--error)',
  neutral: 'var(--neutral)',
};

/** At-a-glance donut of the per-status proportions; center reads resolved/total. Reuses the pure
 *  donutSvg (shared with the PDF export) with theme-aware CSS-var fills, so it re-colors in
 *  light/dark for free. The SVG string is ours (numbers + token vars), so inlining it is safe. */
function StatusDonut({ byStatus, resolved, total }: { byStatus: Record<string, number>; resolved: number; total: number }) {
  if (total === 0) return null;
  const svg = donutSvg(byStatus, (s) => TONE_VAR[toneOf(s)], {
    size: 104,
    stroke: 14,
    center: String(resolved),
    sub: `of ${total}`,
    track: 'var(--surface-2)',
    label: `${resolved} of ${total} resolved`,
  });
  return <div className="shrink-0 text-text" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** At-a-glance chart: a segmented proportion bar of the per-status counts (colors from the
 *  status token palette). Deterministic from the report data — always renders, no dependency. */
function StatusBar({ byStatus, total }: { byStatus: Record<string, number>; total: number }) {
  const denom = total || 1;
  const entries = Object.entries(byStatus).filter(([, n]) => n > 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full border border-border bg-surface-2">
      {entries.map(([s, n]) => {
        const m = metaFor(s);
        return (
          <div
            key={s}
            className={TONE_DOT[toneOf(s)]}
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
    <div className="flex items-center gap-2 text-sm text-text-muted">
      <div className="w-3.5 h-3.5 border-2 border-border border-t-accent rounded-full animate-spin" />
      {SYNTH_STEPS[i]}
    </div>
  );
}

function ItemRow({ it }: { it: ReportItem }) {
  const m = metaFor(it.status);
  const tone = toneOf(it.status);
  // Section-level cue: verified rows read as success, needs-attention as warning.
  const rowTint = RESOLVED_STATUSES.has(it.status) ? 'bg-success-tint' : 'bg-warning-tint';
  return (
    <div className={`flex items-center gap-3 rounded-md border border-border px-3 py-2 ${rowTint}`}>
      {it.screenshotUrl ? (
        <img src={it.screenshotUrl} alt="" className="w-16 h-10 shrink-0 object-cover rounded border border-border" />
      ) : (
        <div className="w-16 h-10 shrink-0 rounded bg-surface-2 border border-border" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text truncate">{it.label}</div>
        {it.url && (
          <a
            href={it.url}
            target="_blank"
            rel="noreferrer"
            className="block text-[11px] font-mono text-accent-text hover:underline truncate"
          >
            {hostOf(it.url)}
          </a>
        )}
      </div>
      <span className={`shrink-0 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide ${TONE_FG[tone]}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${TONE_DOT[tone]}`} />
        {m.label}
      </span>
      <div className={`shrink-0 max-w-[38%] text-sm font-semibold truncate text-right ${TONE_FG[tone]}`} title={it.result}>
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

  const btn =
    'inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text hover:bg-surface-2 ease-brand focus-ring';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-[var(--scrim)] backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-3xl rounded-lg overflow-hidden border border-border bg-surface shadow-overlay flex flex-col max-h-[85vh]"
        initial={{ scale: 0.96, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <div className="min-w-0">
            <div className="font-mono text-xs uppercase tracking-[0.14em] text-text-muted">Verification report</div>
            <div className="truncate font-display text-sm font-semibold text-text" title={task}>
              {task}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <button onClick={downloadMarkdown} className={btn} title="Download Markdown">
              <Download className="h-3.5 w-3.5" /> Markdown
            </button>
            <button onClick={printPdf} className={btn} title="Save as PDF">
              <Printer className="h-3.5 w-3.5" /> PDF
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-subtle hover:text-text hover:bg-surface-2 focus-ring"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-4 py-4 space-y-4">
          {/* At-a-glance: donut focal + legend + proportion bar (donut center = resolved/total) */}
          <div className="flex items-center gap-4">
            <StatusDonut byStatus={model.counts.byStatus} resolved={model.counts.resolved} total={model.counts.total} />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {Object.entries(model.counts.byStatus).map(([s, n]) => {
                  const meta = metaFor(s);
                  const tone = toneOf(s);
                  return (
                    <span key={s} className={`flex items-center gap-1 text-[11px] ${TONE_FG[tone]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${TONE_DOT[tone]}`} />
                      {n} {meta.label.toLowerCase()}
                    </span>
                  );
                })}
              </div>
              <StatusBar byStatus={model.counts.byStatus} total={model.counts.total} />
            </div>
          </div>

          {/* AI headline (or synthesis loader) */}
          <div className="min-h-[1.25rem]">
            {narrative
              ? narrative.headline && <p className="text-sm font-medium text-text">{narrative.headline}</p>
              : loading && <SynthLoader />}
          </div>

          {/* Verified */}
          {resolved.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1">
                Verified · {resolved.length}
              </h3>
              <div className="space-y-1.5">
                {resolved.map((it) => (
                  <ItemRow key={it.label} it={it} />
                ))}
              </div>
            </div>
          )}

          {/* Needs attention */}
          {needsWork.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1">
                Needs attention · {needsWork.length}
              </h3>
              <div className="space-y-1.5">
                {needsWork.map((it) => (
                  <ItemRow key={it.label} it={it} />
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {narrative && narrative.notes.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1">Notes</h3>
              <ul className="space-y-1">
                {narrative.notes.map((n, i) => (
                  <li key={i} className="flex gap-2 text-xs text-text-muted">
                    <span className="text-text-subtle">·</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Takeaway */}
          {narrative?.takeaway && (
            <div className="pt-2 border-t border-border">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Takeaway </span>
              <span className="text-sm text-text">{narrative.takeaway}</span>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
