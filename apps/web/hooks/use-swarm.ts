'use client';

// The swarm engine, lifted out of swarm/page.tsx so it's a self-contained, UI-free hook.
// Client-driven: spawn a fleet of cloud browsers, fan out one runTarget per target (agent
// navigate + structured extract), light each tile up live, freeze + release on completion.
// No backend orchestrator — every lookup is an independent <60s API call. Portable so a
// second consumer (the /workspace voice shell, Phase B) can drive the same swarm.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tile, TileState } from '@/components/swarm-grid';
import type { SwarmTarget } from '@/lib/swarm-target';
import { runTarget, isHttpUrl, type RunSession } from '@/lib/run-target';

export interface SpawnedBrowser {
  browserId: string;
  sessionId: string;
  liveViewUrl: string;
  token: string;
}

export type SwarmPhase = 'idle' | 'spawning' | 'running' | 'done';

/** Tiles worth re-running: the portal blocked us, nothing matched, or the check errored.
 *  (done / active / inactive are settled answers and are left alone.) */
const UNRESOLVED: TileState[] = ['notfound', 'blocked', 'error'];

// The worker itself lives in lib/run-target (isomorphic, shared with the verify-plan harness).
// The hook drives it in-browser with base "" (relative fetch).
const drive = (b: RunSession, target: SwarmTarget, onProgress?: (note: string) => void) =>
  runTarget('', b, target, onProgress);

/** Release one cloud session immediately so it stops billing. */
function releaseOne(b: SpawnedBrowser) {
  fetch('/api/fleet', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: b.sessionId }),
  }).catch(() => {});
}

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

export function useSwarm() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [phase, setPhase] = useState<SwarmPhase>('idle');
  const [error, setError] = useState('');
  const [startTs, setStartTs] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const fleetRef = useRef<SpawnedBrowser[]>([]);
  const targetsRef = useRef<SwarmTarget[]>([]); // kept so retry knows each tile's goal/extract
  const taskRef = useRef<string>(''); // the task label, for the report

  // Release the fleet if the consumer unmounts mid-run.
  useEffect(() => () => releaseFleet(fleetRef.current), []);

  // Live elapsed timer while the swarm runs.
  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => setElapsed((Date.now() - startTs) / 1000), 100);
    return () => clearInterval(id);
  }, [phase, startTs]);

  const updateTile = useCallback(
    (i: number, patch: Partial<Tile>) =>
      setTiles((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t))),
    [],
  );

  const run = useCallback(
    async (targets: SwarmTarget[], opts?: { stealth?: boolean; task?: string }) => {
      if (targets.length === 0) return;
      targetsRef.current = targets;
      if (opts?.task != null) taskRef.current = opts.task;

      setError('');
      setPhase('spawning');
      try {
        const res = await fetch('/api/fleet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: targets.length, stealth: opts?.stealth ?? false }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'fleet spawn failed');

        const browsers: SpawnedBrowser[] = data.browsers;
        fleetRef.current = browsers;
        setTiles(
          targets.map((tgt, i) => ({
            id: tgt.id,
            label: tgt.label,
            url: isHttpUrl(tgt.startUrl) ? tgt.startUrl : '',
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
          targets.map(async (tgt, i) => {
            const t0 = Date.now();
            updateTile(i, { status: 'working' });
            let status: TileState = 'error';
            let result: string | undefined;
            try {
              const r = await drive(browsers[i], tgt, (note) => updateTile(i, { note }));
              status = r.status;
              result = r.result;
              if (r.url) updateTile(i, { url: r.url });
            } catch {
              status = 'error';
            }
            // Freeze the final frame, then release the session so it stops billing.
            const screenshotUrl = await captureFrame(browsers[i]);
            updateTile(i, { status, result, ms: Date.now() - t0, screenshotUrl, note: undefined });
            releaseOne(browsers[i]);
          }),
        );

        setElapsed((Date.now() - runStart) / 1000);
        setPhase('done');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'run failed');
        setPhase('idle');
      }
    },
    [updateTile],
  );

  // Re-run the unresolved tiles (blocked / notfound / error) on a fresh Browserbase stealth
  // fleet (proxies + CAPTCHA solving). Anti-bot walls flip live; genuinely-hard ones stay
  // honest. (The Browserbase Agents escalation is a stronger, separate path added later.)
  const retryWithStealth = useCallback(async () => {
    const unresolved = tiles
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => UNRESOLVED.includes(t.status));
    if (unresolved.length === 0 || retrying) return;
    setRetrying(true);
    try {
      const res = await fetch('/api/fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: unresolved.length, stealth: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'stealth spawn failed');
      const browsers: SpawnedBrowser[] = data.browsers;
      fleetRef.current = [...fleetRef.current, ...browsers];

      unresolved.forEach(({ i }, k) =>
        updateTile(i, {
          status: 'working',
          sessionId: browsers[k].sessionId,
          token: browsers[k].token,
          liveViewUrl: browsers[k].liveViewUrl,
          screenshotUrl: undefined,
          ms: undefined,
        }),
      );

      await Promise.allSettled(
        unresolved.map(async ({ i }, k) => {
          const t0 = Date.now();
          const tgt = targetsRef.current[i];
          let status: TileState = 'error';
          let result: string | undefined;
          try {
            const r = await drive(browsers[k], tgt, (note) => updateTile(i, { note }));
            status = r.status;
            result = r.result;
            if (r.url) updateTile(i, { url: r.url });
          } catch {
            status = 'error';
          }
          const screenshotUrl = await captureFrame(browsers[k]);
          updateTile(i, { status, result, ms: Date.now() - t0, screenshotUrl, note: undefined });
          releaseOne(browsers[k]);
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'stealth retry failed');
    } finally {
      setRetrying(false);
    }
  }, [tiles, retrying, updateTile]);

  const generateSummary = useCallback(async () => {
    setSummaryOpen(true);
    setSummaryLoading(true);
    setSummaryText('');
    try {
      const res = await fetch('/api/swarm/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: taskRef.current,
          results: tiles.map((t) => ({ label: t.label, status: t.status, result: t.result, ms: t.ms })),
        }),
      });
      const data = await res.json();
      setSummaryText(res.ok ? data.summary : data.error || 'Failed to generate report.');
    } catch {
      setSummaryText('Failed to generate report.');
    } finally {
      setSummaryLoading(false);
    }
  }, [tiles]);

  const reset = useCallback(() => {
    releaseFleet(fleetRef.current);
    fleetRef.current = [];
    targetsRef.current = [];
    setTiles([]);
    setPhase('idle');
    setElapsed(0);
    setError('');
  }, []);

  return {
    tiles,
    phase,
    elapsed,
    error,
    retrying,
    running: phase === 'spawning' || phase === 'running',
    hasUnresolved: tiles.some((t) => UNRESOLVED.includes(t.status)),
    summaryOpen,
    summaryText,
    summaryLoading,
    run,
    retryWithStealth,
    generateSummary,
    reset,
    setError,
    closeSummary: () => setSummaryOpen(false),
  };
}
