// Local run history: compact, quota-safe localStorage persistence for finished swarm runs.
// This is the interim store — Convex is the later upgrade path (its screenshot side-channel
// already exists behind the circuit breaker); swapping the backend means reimplementing
// these three functions against Convex and nothing else changes.
//
// Screenshots are deliberately EXCLUDED: tiles carry data-URL frames that would blow the
// ~5MB localStorage quota within a couple of 15-tile runs. A record is the findings, not
// the pixels.

import type { Tile } from '@/components/swarm-grid';
import type { ReportNarrative } from './report';

export interface RunRecordTile {
  label: string;
  status: string;
  result?: string;
  ms?: number;
}

export interface RunRecord {
  id: string;
  ts: number;
  task: string;
  tiles: RunRecordTile[];
  narrative?: ReportNarrative | null;
}

const KEY = 'friday.runs.v1';
const MAX_RUNS = 20;

/** localStorage writes don't trigger React re-renders in the same tab, and the `storage`
 *  event only fires cross-tab. This custom event lets the sidebar refresh the run list the
 *  moment a run is saved or patched in THIS tab. */
export const RUNS_EVENT = 'friday:runs-changed';
function notifyChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(RUNS_EVENT));
}

/** Strip a live tile down to its persistable findings (no screenshots, tokens, or urls). */
export function compactTiles(tiles: Tile[]): RunRecordTile[] {
  return tiles.map((t) => ({ label: t.label, status: t.status, result: t.result, ms: t.ms }));
}

export function loadRuns(): RunRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as RunRecord[]) : [];
  } catch {
    return []; // corrupted store — treat as empty rather than crashing the app
  }
}

function write(runs: RunRecord[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(runs.slice(0, MAX_RUNS)));
  } catch {
    // Quota exceeded or storage disabled — drop the oldest half and retry once, then give up.
    try {
      window.localStorage.setItem(KEY, JSON.stringify(runs.slice(0, Math.ceil(MAX_RUNS / 2))));
    } catch {
      /* persistence is best-effort; never break the run over it */
    }
  }
}

/** Prepend a new run record (newest first). */
export function saveRun(record: RunRecord): void {
  if (typeof window === 'undefined') return;
  write([record, ...loadRuns().filter((r) => r.id !== record.id)]);
  notifyChanged();
}

/** Merge fields into an existing record — used as the narrative lands or a retarget
 *  changes the findings after the run finished. */
export function patchRun(id: string, patch: Partial<Omit<RunRecord, 'id'>>): void {
  if (typeof window === 'undefined') return;
  write(loadRuns().map((r) => (r.id === id ? { ...r, ...patch } : r)));
  notifyChanged();
}
