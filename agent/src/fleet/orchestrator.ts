// Fan-out orchestrator. Iterates the work list, routes each item to a browser's
// AgentContext, runs them through the capped pool, and aggregates into "X of N".
//
// Graceful partial-failure is the whole point: a worker that throws or times out
// becomes a WorkerResult with status 'error'. The swarm NEVER rejects, so one dead
// state board degrades a tile instead of taking down the demo.

import { mapWithConcurrency } from './pool.js';
import type { AgentContext } from '../lib/agent-fetch.js';
import type { WorkerInput, WorkerResult, WorkerStatus, SwarmResult, Worker } from './types.js';

const DEFAULT_CONCURRENCY = 6;

export interface RunSwarmOptions {
  /** Max simultaneous workers (LLM rate-limit guard). Defaults to 6. */
  concurrency?: number;
  /** Hand each input the browser context that should run it (one browser per worker). */
  contextFor: (input: WorkerInput, index: number) => AgentContext;
}

export async function runSwarm(
  inputs: WorkerInput[],
  worker: Worker,
  opts: RunSwarmOptions,
): Promise<SwarmResult> {
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;

  const settled = await mapWithConcurrency(inputs, concurrency, (input, i) =>
    worker(input, opts.contextFor(input, i)),
  );

  const results: WorkerResult[] = settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    const reason = s.reason instanceof Error ? s.reason.message : String(s.reason);
    return { state: inputs[i].state, status: 'error', raw: reason, ms: 0 };
  });

  const byStatus: Record<WorkerStatus, number> = { active: 0, inactive: 0, notfound: 0, error: 0 };
  for (const r of results) byStatus[r.status]++;

  return {
    total: results.length,
    succeeded: results.length - byStatus.error,
    failed: byStatus.error,
    byStatus,
    results,
  };
}
