'use client';

// The swarm engine, lifted out of swarm/page.tsx so it's a self-contained, UI-free hook.
// Client-driven: spawn a fleet of cloud browsers, fan out one runTarget per target (agent
// navigate + structured extract), light each tile up live, freeze + release on completion.
// No backend orchestrator — every lookup is an independent <60s API call. Portable so a
// second consumer (the /workspace voice shell, Phase B) can drive the same swarm.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tile, TileState } from '@/components/swarm-grid';
import type { SwarmTarget } from '@/lib/swarm-target';
import type { ReportNarrative } from '@/lib/report';
import { runTarget, isHttpUrl, type RunSession } from '@/lib/run-target';
import { saveRun, patchRun, compactTiles } from '@/lib/run-history';

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
function releaseOne(b: { sessionId: string }) {
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
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [narrative, setNarrative] = useState<ReportNarrative | null>(null);
  const fleetRef = useRef<SpawnedBrowser[]>([]);
  const targetsRef = useRef<SwarmTarget[]>([]); // kept so retry knows each tile's goal/extract
  const taskRef = useRef<string>(''); // the task label, for the report
  const tilesRef = useRef<Tile[]>([]);
  tilesRef.current = tiles; // always-latest snapshot for the report generator
  const autoReportRef = useRef(false); // auto-open the report once per run
  const cancelledRef = useRef(false); // set by cancel()/reset() to halt the in-flight run
  // Per-tile generation counter, bumped by retarget(): a superseded closure (original run,
  // stealth retry, or an earlier retarget of the same slot) captures its generation at start
  // and drops its tile writes if the slot has since been retargeted — otherwise the old
  // session's death would clobber the new target's live state when it settles.
  const tileGen = useRef<Record<number, number>>({});
  // The localStorage record for the current run (lib/run-history) — created when the run
  // finishes, then patched as the narrative lands or a retarget changes the findings.
  const runRecordIdRef = useRef<string | null>(null);

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
      cancelledRef.current = false;
      tileGen.current = {}; // fresh grid — no slot has been retargeted yet
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
            // Generation-guarded writes: if this slot gets retargeted mid-run, this closure's
            // session dies (released) and its remaining writes must not clobber the new target.
            const gen = tileGen.current[i] ?? 0;
            const guarded = (patch: Partial<Tile>) => {
              if ((tileGen.current[i] ?? 0) === gen) updateTile(i, patch);
            };
            guarded({ status: 'working' });
            let status: TileState = 'error';
            let result: string | undefined;
            try {
              const r = await drive(browsers[i], tgt, (note) => guarded({ note }));
              status = r.status;
              result = r.result;
              if (r.url) guarded({ url: r.url });
            } catch {
              status = 'error';
            }
            // Freeze the final frame, then release the session so it stops billing.
            const screenshotUrl = await captureFrame(browsers[i]);
            guarded({ status, result, ms: Date.now() - t0, screenshotUrl, note: undefined });
            releaseOne(browsers[i]);
          }),
        );

        setElapsed((Date.now() - runStart) / 1000);
        if (cancelledRef.current) { setPhase('idle'); return; }
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
          const gen = tileGen.current[i] ?? 0; // same clobber guard as run() — see tileGen
          const guarded = (patch: Partial<Tile>) => {
            if ((tileGen.current[i] ?? 0) === gen) updateTile(i, patch);
          };
          let status: TileState = 'error';
          let result: string | undefined;
          try {
            const r = await drive(browsers[k], tgt, (note) => guarded({ note }));
            status = r.status;
            result = r.result;
            if (r.url) guarded({ url: r.url });
          } catch {
            status = 'error';
          }
          const screenshotUrl = await captureFrame(browsers[k]);
          guarded({ status, result, ms: Date.now() - t0, screenshotUrl, note: undefined });
          releaseOne(browsers[k]);
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'stealth retry failed');
    } finally {
      setRetrying(false);
      setNarrative(null); // tiles changed — invalidate the cached report so it regenerates
    }
  }, [tiles, retrying, updateTile]);

  /** Redirect ONE tile to a new target without restarting the swarm — "actually, check
   *  Costco instead of Walmart". Bumps the slot's generation (so the superseded closure
   *  can't clobber it), releases the old session (its in-flight drive fails fast as
   *  SESSION_LOST), spawns a single fresh browser, and re-drives just that slot in place.
   *  Mid-run, the other tiles keep working untouched. Returns the settled outcome. */
  const retarget = useCallback(
    async (
      idOrLabel: string,
      patch: Partial<Pick<SwarmTarget, 'label' | 'goal' | 'extract' | 'startUrl' | 'query'>>,
    ) => {
      const i = tilesRef.current.findIndex(
        (t) => t.id === idOrLabel || t.label.toLowerCase() === idOrLabel.toLowerCase(),
      );
      if (i === -1) throw new Error(`no target named ${idOrLabel}`);
      const prev = targetsRef.current[i];
      if (!prev) throw new Error('nothing to retarget yet');

      // A new label means the old startUrl/query point at the wrong thing — drop them unless
      // the caller re-supplies (patch spreads after the clear, so explicit fields win). If
      // neither survives, fall back to searching the new label.
      const next: SwarmTarget = {
        ...prev,
        ...(patch.label ? { startUrl: undefined, query: undefined } : {}),
        ...patch,
        id: prev.id, // the grid slot keeps its identity
      };
      if (!next.startUrl && !next.query) next.query = next.label;
      targetsRef.current[i] = next;

      const gen = (tileGen.current[i] = (tileGen.current[i] ?? 0) + 1);
      const guarded = (p: Partial<Tile>) => {
        if (tileGen.current[i] === gen) updateTile(i, p);
      };

      const old = tilesRef.current[i];
      if (old.sessionId) releaseOne({ sessionId: old.sessionId });
      guarded({
        label: next.label,
        status: 'working',
        result: undefined,
        screenshotUrl: undefined,
        ms: undefined,
        note: undefined,
        url: isHttpUrl(next.startUrl) ? next.startUrl : '',
      });

      try {
        const res = await fetch('/api/fleet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: 1, stealth: false }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'spawn failed');
        const b: SpawnedBrowser = data.browsers[0];
        fleetRef.current = [...fleetRef.current, b];
        guarded({ sessionId: b.sessionId, token: b.token, liveViewUrl: b.liveViewUrl });

        const t0 = Date.now();
        let status: TileState = 'error';
        let result: string | undefined;
        try {
          const r = await drive(b, next, (note) => guarded({ note }));
          status = r.status;
          result = r.result;
          if (r.url) guarded({ url: r.url });
        } catch {
          status = 'error';
        }
        const screenshotUrl = await captureFrame(b);
        guarded({ status, result, ms: Date.now() - t0, screenshotUrl, note: undefined });
        releaseOne(b);
        setNarrative(null); // findings changed — regenerate the report on next open
        return { label: next.label, status, result };
      } catch (e) {
        guarded({
          status: 'error',
          result: e instanceof Error ? e.message : 'retarget failed',
          note: undefined,
        });
        throw e;
      }
    },
    [updateTile],
  );

  // Fetch the AI narrative (headline / takeaway / notes). Reads tiles via a ref so its
  // identity is stable (the auto-open effect depends on it). The per-target rows are built
  // deterministically from tiles in the UI — this only synthesizes the prose.
  const generateReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const res = await fetch('/api/swarm/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: taskRef.current,
          results: tilesRef.current.map((t) => ({
            label: t.label,
            status: t.status,
            result: t.result,
            ms: t.ms,
          })),
        }),
      });
      const data = await res.json();
      const n: ReportNarrative = res.ok
        ? { headline: data.headline ?? '', takeaway: data.takeaway ?? '', notes: data.notes ?? [] }
        : { headline: 'Report unavailable', takeaway: data.error || 'Failed to synthesize.', notes: [] };
      setNarrative(n);
      if (res.ok && runRecordIdRef.current) patchRun(runRecordIdRef.current, { narrative: n });
    } catch {
      setNarrative({ headline: 'Report unavailable', takeaway: 'Failed to synthesize the report.', notes: [] });
    } finally {
      setReportLoading(false);
    }
  }, []);

  const openReport = useCallback(() => {
    setReportOpen(true);
    if (!narrative && !reportLoading) generateReport();
  }, [narrative, reportLoading, generateReport]);

  // Auto-open + synthesize the report the moment a run finishes (once per run), and
  // persist the run to local history (screenshots excluded — see lib/run-history).
  useEffect(() => {
    if (phase === 'done' && !autoReportRef.current) {
      autoReportRef.current = true;
      runRecordIdRef.current = `run-${Date.now()}`;
      saveRun({
        id: runRecordIdRef.current,
        ts: Date.now(),
        task: taskRef.current,
        tiles: compactTiles(tilesRef.current),
      });
      setReportOpen(true);
      generateReport();
    }
    if (phase === 'idle') autoReportRef.current = false;
  }, [phase, generateReport]);

  // Keep the saved record honest after the run: a stealth retry or a voice retarget can
  // change findings while phase is still 'done' — mirror those into local history.
  useEffect(() => {
    if (phase === 'done' && runRecordIdRef.current) {
      patchRun(runRecordIdRef.current, { tiles: compactTiles(tiles) });
    }
  }, [tiles, phase]);

  // Halt the in-flight run: release the fleet now (so pending agent/extract calls fail fast),
  // mark still-working tiles as stopped, and drop back to idle. Barge-in "stop" calls this.
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    releaseFleet(fleetRef.current);
    fleetRef.current = [];
    setRetrying(false);
    setTiles((prev) =>
      prev.map((t) =>
        t.status === 'working' || t.status === 'idle'
          ? { ...t, status: 'error' as TileState, result: 'stopped', note: undefined }
          : t,
      ),
    );
    setPhase('idle');
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    releaseFleet(fleetRef.current);
    fleetRef.current = [];
    targetsRef.current = [];
    runRecordIdRef.current = null; // history record stays saved; just stop patching it
    setTiles([]);
    setPhase('idle');
    setElapsed(0);
    setError('');
    setReportOpen(false);
    setNarrative(null);
    autoReportRef.current = false;
  }, []);

  return {
    tiles,
    phase,
    elapsed,
    error,
    retrying,
    running: phase === 'spawning' || phase === 'running',
    hasUnresolved: tiles.some((t) => UNRESOLVED.includes(t.status)),
    task: taskRef.current,
    reportOpen,
    reportLoading,
    narrative,
    openReport,
    closeReport: () => setReportOpen(false),
    regenerateReport: generateReport,
    run,
    cancel,
    retryWithStealth,
    retarget,
    reset,
    setError,
  };
}
