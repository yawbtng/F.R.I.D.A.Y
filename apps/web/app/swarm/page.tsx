'use client';

// Mission-control swarm grid. Client-driven: spawn a fleet of cloud browsers, then
// fan out one Stagehand agent + structured extract per state, lighting each tile up
// live as it resolves. No backend orchestrator — every per-state lookup is an
// independent <60s API call, so this runs locally for the hero clip AND deploys to
// Vercel unchanged.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  STATE_ADAPTERS,
  SUPPORTED_STATES,
  STATUS_EXTRACT,
  goalFor,
  mapStatus,
  type WorkerStatus,
} from '@/lib/sos-adapters';
import { SwarmGrid, type Tile, type TileState } from '@/components/swarm-grid';
import { BrowserModal } from '@/components/browser-modal';

interface SpawnedBrowser {
  browserId: string;
  sessionId: string;
  liveViewUrl: string;
  token: string;
}

type Phase = 'config' | 'spawning' | 'running' | 'done';

/** Drive one browser: agent navigates + opens the record, extract reads the status. */
async function verifyState(b: SpawnedBrowser, state: string, entity: string): Promise<WorkerStatus> {
  const adapter = STATE_ADAPTERS[state];
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${b.token}` };

  const agentRes = await fetch('/api/browser/agent', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sessionId: b.sessionId,
      startUrl: adapter.searchUrl,
      instruction: goalFor(adapter, entity),
      maxSteps: 14,
    }),
  });
  if (!agentRes.ok) {
    throw new Error((await agentRes.json().catch(() => ({}))).error || `agent HTTP ${agentRes.status}`);
  }

  const exRes = await fetch('/api/browser/extract', {
    method: 'POST',
    headers,
    body: JSON.stringify({ sessionId: b.sessionId, instruction: STATUS_EXTRACT }),
  });
  if (!exRes.ok) {
    throw new Error((await exRes.json().catch(() => ({}))).error || `extract HTTP ${exRes.status}`);
  }
  return mapStatus((await exRes.json()).data);
}

/** Release one cloud session immediately so it stops billing. */
function releaseOne(b: SpawnedBrowser) {
  fetch('/api/fleet', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: b.sessionId }),
  }).catch(() => {});
}

/** Best-effort release of any still-open sessions (unmount / reset safety net). */
function releaseFleet(browsers: SpawnedBrowser[]) {
  for (const b of browsers) releaseOne(b);
}

/** Capture the final page as a data-URL so the tile can freeze after the session closes. */
async function captureFrame(b: SpawnedBrowser): Promise<string | undefined> {
  try {
    const res = await fetch('/api/browser/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${b.token}` },
      body: JSON.stringify({ sessionId: b.sessionId }),
    });
    if (!res.ok) return undefined;
    const { screenshot } = (await res.json()) as { screenshot?: string };
    return screenshot ? `data:image/jpeg;base64,${screenshot}` : undefined;
  } catch {
    return undefined;
  }
}

export default function SwarmPage() {
  const [entity, setEntity] = useState('Tesla, Inc.');
  const [selected, setSelected] = useState<string[]>(SUPPORTED_STATES);
  const [phase, setPhase] = useState<Phase>('config');
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [error, setError] = useState('');
  const [startTs, setStartTs] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [focusedState, setFocusedState] = useState<string | null>(null);
  const fleetRef = useRef<SpawnedBrowser[]>([]);

  // Release the fleet if the user navigates away mid-run.
  useEffect(() => () => releaseFleet(fleetRef.current), []);

  // Live elapsed timer while the swarm runs.
  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => setElapsed((Date.now() - startTs) / 1000), 100);
    return () => clearInterval(id);
  }, [phase, startTs]);

  const updateTile = (i: number, patch: Partial<Tile>) =>
    setTiles((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  const toggle = (s: string) =>
    setSelected((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const run = useCallback(async () => {
    const name = entity.trim();
    const states = SUPPORTED_STATES.filter((s) => selected.includes(s)); // canonical order
    if (!name || states.length === 0) return;

    setError('');
    setPhase('spawning');
    try {
      const res = await fetch('/api/fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: states.length }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'fleet spawn failed');

      const browsers: SpawnedBrowser[] = data.browsers;
      fleetRef.current = browsers;
      setTiles(
        states.map((s, i) => ({
          state: s,
          name: STATE_ADAPTERS[s].name,
          url: STATE_ADAPTERS[s].searchUrl,
          sessionId: browsers[i].sessionId,
          token: browsers[i].token,
          liveViewUrl: browsers[i].liveViewUrl,
          status: 'idle' as TileState,
        })),
      );

      const runStart = Date.now();
      setStartTs(runStart);
      setElapsed(0);
      setPhase('running');

      await Promise.allSettled(
        states.map(async (s, i) => {
          const t0 = Date.now();
          updateTile(i, { status: 'working' });
          let status: TileState = 'error';
          try {
            status = await verifyState(browsers[i], s, name);
          } catch {
            status = 'error';
          }
          // Freeze the final frame, then release the session so it stops billing.
          const screenshotUrl = await captureFrame(browsers[i]);
          updateTile(i, { status, ms: Date.now() - t0, screenshotUrl });
          releaseOne(browsers[i]);
        }),
      );

      setElapsed((Date.now() - runStart) / 1000);
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'run failed');
      setPhase('config');
    }
  }, [entity, selected]);

  const reset = useCallback(() => {
    releaseFleet(fleetRef.current);
    fleetRef.current = [];
    setTiles([]);
    setPhase('config');
    setElapsed(0);
    setError('');
  }, []);

  const verified = tiles.filter((t) => t.status === 'active' || t.status === 'inactive' || t.status === 'notfound').length;
  const errored = tiles.filter((t) => t.status === 'error').length;
  const running = phase === 'running' || phase === 'spawning';
  const focusedTile = focusedState ? tiles.find((t) => t.state === focusedState) ?? null : null;

  return (
    <div className="min-h-screen w-full bg-friday-bg text-friday-text-primary">
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        {/* Header */}
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              F.R.I.D.A.Y. <span className="text-friday-text-tertiary font-mono">// swarm</span>
            </h1>
            <p className="text-xs text-friday-text-tertiary">
              Verify a business entity across {SUPPORTED_STATES.length} Secretary-of-State registries in parallel.
            </p>
          </div>

          {phase !== 'config' && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="font-mono text-sm">
                  <span className="text-friday-text-primary">{verified}</span>
                  <span className="text-friday-text-tertiary"> / {tiles.length} verified</span>
                </div>
                <div className="font-mono text-[11px] text-friday-text-tertiary">
                  {elapsed.toFixed(1)}s{errored > 0 ? ` · ${errored} error` : ''}
                </div>
              </div>
              <button
                onClick={reset}
                disabled={running}
                className="rounded-md px-3 py-1.5 text-xs font-medium glass hover:bg-white/[0.06] disabled:opacity-40 focus-ring"
              >
                New run
              </button>
            </div>
          )}
        </header>

        {/* Config */}
        {phase === 'config' && (
          <div className="glass-heavy rounded-xl p-5 max-w-2xl">
            <label className="block text-xs font-medium text-friday-text-secondary mb-1.5">Entity name</label>
            <input
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
              placeholder="e.g. Tesla, Inc."
              className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm font-mono focus-ring placeholder:text-friday-text-tertiary"
            />

            <div className="mt-4 mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-friday-text-secondary">States ({selected.length})</label>
              <button
                onClick={() => setSelected(selected.length === SUPPORTED_STATES.length ? [] : SUPPORTED_STATES)}
                className="text-[11px] text-friday-accent hover:underline"
              >
                {selected.length === SUPPORTED_STATES.length ? 'Clear' : 'Select all'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_STATES.map((s) => {
                const on = selected.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggle(s)}
                    className={`rounded-md px-3 py-1.5 text-xs font-mono transition-colors focus-ring ${
                      on
                        ? 'bg-friday-accent/15 text-friday-accent ring-1 ring-friday-accent/40'
                        : 'glass text-friday-text-secondary hover:text-friday-text-primary'
                    }`}
                  >
                    {s} · {STATE_ADAPTERS[s].name}
                  </button>
                );
              })}
            </div>

            {error && <p className="mt-4 text-xs text-red-400 font-mono">{error}</p>}

            <button
              onClick={run}
              disabled={!entity.trim() || selected.length === 0}
              className="mt-5 rounded-lg bg-friday-accent/20 px-5 py-2.5 text-sm font-semibold text-friday-accent ring-1 ring-friday-accent/40 hover:bg-friday-accent/30 disabled:opacity-40 focus-ring"
            >
              Run swarm → {selected.length} browser{selected.length === 1 ? '' : 's'}
            </button>
          </div>
        )}

        {/* Spawning */}
        {phase === 'spawning' && (
          <div className="flex items-center gap-3 text-sm text-friday-text-secondary">
            <div className="w-4 h-4 border-2 border-friday-accent/30 border-t-friday-accent rounded-full animate-spin" />
            Spawning {selected.length} cloud browsers…
          </div>
        )}

        {/* Grid */}
        {(phase === 'running' || phase === 'done') && (
          <SwarmGrid tiles={tiles} onSelect={(t) => setFocusedState(t.state)} />
        )}
      </div>

      <AnimatePresence>
        {focusedTile && <BrowserModal tile={focusedTile} onClose={() => setFocusedState(null)} />}
      </AnimatePresence>
    </div>
  );
}
