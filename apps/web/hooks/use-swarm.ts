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

/** Release the whole fleet in ONE request that survives page teardown.
 *
 *  releaseOne() above uses fetch(), which the browser is free to cancel the moment the document
 *  goes away — so closing the tab mid-run released nothing. `navigator.sendBeacon` is the only
 *  send guaranteed to be queued and flushed after teardown, but it can only POST a body (no
 *  DELETE, no Authorization header), which is why /api/fleet/release exists alongside the
 *  per-session DELETE. Falls back to keepalive fetch where sendBeacon is unavailable. */
function releaseFleetBeacon(browsers: SpawnedBrowser[]) {
  const sessionIds = browsers.map((b) => b.sessionId).filter(Boolean);
  if (sessionIds.length === 0) return;
  const body = JSON.stringify({ sessionIds });
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon('/api/fleet/release', new Blob([body], { type: 'application/json' }));
    return;
  }
  fetch('/api/fleet/release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}

// The screenshot is decoration on a settled tile, so it must never be able to hold the run open.
// In production the route's `maxDuration = 60` bounds it, but `next dev` does NOT enforce
// maxDuration: against a hung capture the awaited call never returns, the tile stays 'working'
// forever, Promise.allSettled never resolves, phase never reaches 'done', and the only way out is
// a page reload (the "New" button is disabled while running). 20s is far above the ~1-3s a
// capture+compress actually takes, so it only ever fires on a genuine hang.
const SCREENSHOT_TIMEOUT_MS = 20_000;

/** Capture the final page as a data-URL so the tile can freeze after the session closes.
 *  Best-effort: any failure (including the timeout) degrades to "no frame", never a failed tile. */
async function captureFrame(b: SpawnedBrowser): Promise<string | undefined> {
  try {
    const res = await fetch('/api/browser/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${b.token}` },
      signal: AbortSignal.timeout(SCREENSHOT_TIMEOUT_MS),
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
  // Two generation counters, because "a new run" and "the tiles are moving again" are
  // different events and the latches that key off them want different answers.
  //
  //   runGen    — bumped ONLY by run(). Identifies the run RECORD. A stealth retry or a
  //               voice retarget is a continuation of the same run (same targets, same
  //               task, same history entry), so they must NOT bump it — bumping would
  //               orphan the record we're still patching and save a duplicate.
  //   settleGen — bumped by run() AND retryWithStealth() AND retarget(): every path that
  //               puts tiles back in flight. Consumers that announce progress ("checked
  //               3 of 8", "swarm finished") re-arm on this, so a retry is narrated.
  //
  // phase cannot do either job: run() goes spawning → running → done and never passes
  // back through idle, and retry/retarget mutate tiles while phase sits at 'done'. Every
  // latch previously keyed on a phase value was therefore stuck after the first run —
  // silent retries (no pill, no voice) and unsaved second runs.
  const [runGen, setRunGen] = useState(0);
  const [settleGen, setSettleGen] = useState(0);
  const fleetRef = useRef<SpawnedBrowser[]>([]);
  const targetsRef = useRef<SwarmTarget[]>([]); // kept so retry knows each tile's goal/extract
  const taskRef = useRef<string>(''); // the task label, for the report
  const tilesRef = useRef<Tile[]>([]);
  tilesRef.current = tiles; // always-latest snapshot for the report generator
  // The runGen already saved to history + auto-opened. 0 = nothing saved yet, and run()
  // bumps runGen to 1 first, so the first run always qualifies.
  const savedGenRef = useRef(0);
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

  // ...and if the TAB goes away, which the unmount effect above never sees: closing the tab or
  // hard-refreshing tears the document down without running React cleanup, so up to 20 sessions
  // stayed alive for the full 300s session timeout (lib/browserbase.ts), ate the 20-session
  // concurrency cap, and made the next run fail with an unexplained 500.
  //
  // `pagehide` over `beforeunload`: beforeunload is unreliable on mobile Safari and is skipped
  // entirely when a page enters the back/forward cache.
  //
  // This CANNOT misfire on a normal React unmount: the handler is only ever invoked by the
  // browser at document teardown — a route change unmounts the hook, which removes the listener
  // (and runs the effect above) without the event ever firing. The one case where pagehide fires
  // on a page that may come BACK is a bfcache entry (`persisted: true`); we skip that, because
  // restoring from bfcache resumes the very run whose sessions we'd have killed.
  //
  // Over-releasing is safe in the other direction: REQUEST_RELEASE on an already-finished
  // session is a no-op, so firing for a completed run costs one ignored request.
  useEffect(() => {
    const onPageHide = (e: PageTransitionEvent) => {
      if (e.persisted) return; // bfcache — the page (and its run) can still come back
      releaseFleetBeacon(fleetRef.current);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, []);

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
      // Open the new run's generation BEFORE any await, so every latch keyed on it re-arms
      // on the same commit the grid resets on.
      setRunGen((g) => g + 1);
      setSettleGen((g) => g + 1);
      // The previous run's report describes the previous run's tiles. Without this, a second
      // run in the same session (no "New Session") left run 1's modal open and its cached
      // narrative sitting on top of run 2's grid until the new synthesis landed.
      setReportOpen(false);
      setNarrative(null);
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
            } catch (e) {
              // Keep the reason — an errored tile with an empty result gives the report nothing
              // to explain (it just reads "N errors"). The message ("Browser session lost",
              // "act() timed out", etc.) is what makes the report say WHY a target failed.
              status = 'error';
              result = e instanceof Error ? e.message : 'run failed';
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
      // Tiles are in flight again while phase stays 'done' — re-arm the progress/announcement
      // latches (this is the whole reason settleGen exists). Bumped HERE, batched with the
      // flip to 'working', not at the top of the function: a bump while every tile is still
      // settled would fire the "swarm finished" announcement a second time before the retry
      // has even started. runGen deliberately stays put — this is the same run record.
      setSettleGen((g) => g + 1);

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
          } catch (e) {
            status = 'error';
            result = e instanceof Error ? e.message : 'run failed'; // preserve the reason (see run())
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
      // Same contract as the stealth retry: one slot is back in flight, so re-arm the
      // announcement latches (batched with the flip, for the same reason), but keep runGen —
      // a retarget edits the run in place, it does not start a new one.
      setSettleGen((g) => g + 1);

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
  // Keyed on runGen, not on phase: the old `if (phase === 'idle') autoReportRef = false`
  // re-arm never fired, because run() goes spawning → running → done and only cancel()/
  // reset()/an error ever set 'idle'. A second run without "New Session" was therefore
  // never saveRun'd — it never showed up in the sidebar, and openReport served run 1's
  // cached narrative over run 2's tiles.
  useEffect(() => {
    if (phase !== 'done' || savedGenRef.current === runGen) return;
    savedGenRef.current = runGen;
    runRecordIdRef.current = `run-${Date.now()}`;
    saveRun({
      id: runRecordIdRef.current,
      ts: Date.now(),
      task: taskRef.current,
      tiles: compactTiles(tilesRef.current),
    });
    setReportOpen(true);
    generateReport();
  }, [phase, runGen, generateReport]);

  // Keep the saved record honest after the run: a stealth retry or a voice retarget can
  // change findings while phase is still 'done' — mirror those into local history, but only
  // once the grid has fully settled again.
  //
  // This effect used to patch on EVERY [tiles, phase] commit while phase === 'done', and each
  // tile emits 2-4 of those as it settles (working flip → progress notes → url → final
  // result). One stealth retry over 15 tiles meant ~45 synchronous JSON.stringify +
  // localStorage.setItem of up to 20 full run records on the main thread — a visible stutter
  // in the live grid, spent writing intermediate states nobody can read until the run is over.
  // Gating on "nothing in flight" collapses that to a single write per retry/retarget, and it
  // cannot drop the last write: the commit that settles the final tile IS the trigger.
  useEffect(() => {
    if (phase !== 'done' || !runRecordIdRef.current) return;
    if (tiles.some((t) => t.status === 'working' || t.status === 'idle')) return;
    patchRun(runRecordIdRef.current, { tiles: compactTiles(tiles) });
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
    // savedGenRef is deliberately left alone: the next run() bumps runGen past it, which is
    // what arms the save. Zeroing it here would be a second, redundant way to say the same
    // thing — and the kind of "unlatch on idle" coupling that caused these bugs.
  }, []);

  return {
    tiles,
    phase,
    runGen,
    settleGen,
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
