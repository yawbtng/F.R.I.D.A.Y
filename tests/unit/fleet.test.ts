import { describe, it, expect, vi } from 'vitest';
import { mapWithConcurrency } from '../../agent/src/fleet/pool.js';
import { FleetRegistry } from '../../agent/src/fleet/registry.js';
import { runSwarm } from '../../agent/src/fleet/orchestrator.js';
import type { Worker, WorkerInput, WorkerResult, FleetBrowser } from '../../agent/src/fleet/types.js';

const ctxFor = () => ({ sessionId: 's', token: 't' });
const inputs = (n: number): WorkerInput[] =>
  Array.from({ length: n }, (_, i) => ({ state: `S${i}`, entityName: 'Acme Corp' }));

function browser(id: string): FleetBrowser {
  return { browserId: id, sessionId: `sess-${id}`, token: `tok-${id}`, liveViewUrl: `https://lv/${id}`, status: 'idle' };
}

describe('mapWithConcurrency (pool)', () => {
  it('preserves input order despite varying durations', async () => {
    const out = await mapWithConcurrency([30, 5, 20, 1], 2, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms));
      return i;
    });
    expect(out.map((s) => (s.status === 'fulfilled' ? s.value : null))).toEqual([0, 1, 2, 3]);
  });

  it('settles rejections instead of throwing', async () => {
    const out = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('boom');
      return n;
    });
    expect(out[0]).toMatchObject({ status: 'fulfilled', value: 1 });
    expect(out[1].status).toBe('rejected');
    expect(out[2]).toMatchObject({ status: 'fulfilled', value: 3 });
  });

  it('never exceeds the concurrency cap', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    await mapWithConcurrency(Array.from({ length: 12 }, (_, i) => i), 4, async (n) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return n;
    });
    expect(maxInFlight).toBeLessThanOrEqual(4);
    expect(maxInFlight).toBeGreaterThan(1); // proves it actually parallelised
  });

  it('handles an empty list', async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
  });
});

describe('FleetRegistry', () => {
  it('adds, gets, lists, and reports size', () => {
    const reg = new FleetRegistry();
    reg.add(browser('a'));
    reg.add(browser('b'));
    expect(reg.size).toBe(2);
    expect(reg.has('a')).toBe(true);
    expect(reg.get('b').sessionId).toBe('sess-b');
    expect(reg.list().map((b) => b.browserId).sort()).toEqual(['a', 'b']);
  });

  it('updates status and removes browsers', () => {
    const reg = new FleetRegistry();
    reg.add(browser('a'));
    reg.setStatus('a', 'working');
    expect(reg.get('a').status).toBe('working');
    const removed = reg.remove('a');
    expect(removed.browserId).toBe('a');
    expect(reg.has('a')).toBe(false);
    expect(reg.size).toBe(0);
  });

  it('throws a clean error for an unknown browserId', () => {
    const reg = new FleetRegistry();
    expect(() => reg.get('ghost')).toThrow('Unknown browserId: ghost');
    expect(() => reg.setStatus('ghost', 'done')).toThrow('Unknown browserId: ghost');
  });
});

describe('runSwarm (orchestrator)', () => {
  it('aggregates an all-success run', async () => {
    const worker: Worker = async (input) => ({ state: input.state, status: 'active', raw: 'ok', ms: 5 });
    const res = await runSwarm(inputs(5), worker, { concurrency: 3, contextFor: ctxFor });
    expect(res.total).toBe(5);
    expect(res.succeeded).toBe(5);
    expect(res.failed).toBe(0);
    expect(res.byStatus.active).toBe(5);
  });

  // CRITICAL (eng review test plan #2): N workers where some throw → "N-2 of N",
  // failures flagged, never throws.
  it('returns "N-2 of N" on partial failure and never throws', async () => {
    const worker: Worker = async (input) => {
      if (input.state === 'S1' || input.state === 'S4') throw new Error('board down');
      return { state: input.state, status: 'active', raw: 'ok', ms: 5 };
    };
    const res = await runSwarm(inputs(6), worker, { concurrency: 3, contextFor: ctxFor });

    expect(res.total).toBe(6);
    expect(res.succeeded).toBe(4);
    expect(res.failed).toBe(2);
    expect(res.byStatus.error).toBe(2);
    expect(res.byStatus.active).toBe(4);

    const errs = res.results.filter((r) => r.status === 'error');
    expect(errs.map((e) => e.state).sort()).toEqual(['S1', 'S4']);
    expect(errs[0].raw).toContain('board down');
  });

  it('treats a thrown timeout as an error result, not a crash', async () => {
    const worker: Worker = async (input) => {
      if (input.state === 'S0') throw new Error('Operation cancelled — interrupted or timed out.');
      return { state: input.state, status: 'inactive', raw: 'expired', ms: 5 };
    };
    const res = await runSwarm(inputs(3), worker, { contextFor: ctxFor });
    expect(res.failed).toBe(1);
    expect(res.byStatus.inactive).toBe(2);
    expect(res.results[0]).toMatchObject({ state: 'S0', status: 'error' });
  });

  it('counts a mixed-status run correctly', async () => {
    const map: Record<string, WorkerResult['status']> = { S0: 'active', S1: 'inactive', S2: 'notfound', S3: 'active' };
    const worker: Worker = async (input) => ({ state: input.state, status: map[input.state], raw: 'x', ms: 1 });
    const res = await runSwarm(inputs(4), worker, { contextFor: ctxFor });
    expect(res.byStatus).toEqual({ active: 2, inactive: 1, notfound: 1, error: 0 });
    expect(res.succeeded).toBe(4);
  });

  it('passes the routed context to each worker', async () => {
    const seen: string[] = [];
    const worker: Worker = async (input, ctx) => {
      seen.push(ctx.sessionId);
      return { state: input.state, status: 'active', raw: 'ok', ms: 1 };
    };
    await runSwarm(inputs(3), worker, {
      contextFor: (_input, i) => ({ sessionId: `browser-${i}`, token: 't' }),
    });
    expect(seen.sort()).toEqual(['browser-0', 'browser-1', 'browser-2']);
  });

  it('handles an empty work list', async () => {
    const res = await runSwarm([], vi.fn(), { contextFor: ctxFor });
    expect(res).toMatchObject({ total: 0, succeeded: 0, failed: 0 });
    expect(res.results).toEqual([]);
  });
});
