// Fleet types — the contract between the orchestrator, the per-browser workers,
// and (later) the mission-control UI. Kept in one place so Lane B adapters and the
// grid HUD share the same shapes.

import type { AgentContext } from '../lib/agent-fetch.js';

/** One unit of swarm work: verify `entityName` in `state`. */
export interface WorkerInput {
  state: string;
  entityName: string;
}

/** Outcome of a single lookup. Only 'error' counts as a failure; the rest are answers. */
export type WorkerStatus = 'active' | 'inactive' | 'notfound' | 'error';

/** Result of one worker (one browser, one state). Always returned — never thrown. */
export interface WorkerResult {
  state: string;
  status: WorkerStatus;
  details?: Record<string, unknown>;
  /** Human-readable summary or the error message when status === 'error'. */
  raw: string;
  ms: number;
}

/** Lifecycle of a browser in the fleet (drives tile colour in the grid HUD). */
export type BrowserStatus = 'idle' | 'working' | 'done' | 'error';

/** A live cloud browser the orchestrator can route work to. */
export interface FleetBrowser {
  browserId: string;
  sessionId: string;
  token: string;
  liveViewUrl: string;
  status: BrowserStatus;
}

/** Aggregate swarm outcome — the "X of N verified" the demo narrates. */
export interface SwarmResult {
  total: number;
  /** status !== 'error' — we got a real answer. */
  succeeded: number;
  /** status === 'error' — board down, timeout, etc. */
  failed: number;
  byStatus: Record<WorkerStatus, number>;
  results: WorkerResult[];
}

/** Drives one browser for one input and returns a contract result. */
export type Worker = (input: WorkerInput, ctx: AgentContext) => Promise<WorkerResult>;
