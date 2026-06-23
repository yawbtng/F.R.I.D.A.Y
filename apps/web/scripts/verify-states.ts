// Headless verification + latency harness for the SHIPPING swarm path. Spawns a fleet
// via the running dev server, then runs the same agent + structured extract per state
// the /swarm grid runs (importing the canonical apps/web/lib/sos-adapters). Releases each
// session the instant its lookup finishes, exactly like the grid. Use it to confirm which
// curated portals actually resolve before trusting them on camera, and to measure latency.
//
// Prereq: dev server running (pnpm --filter @friday/web dev).
// Usage (from repo root):
//   agent/node_modules/.bin/tsx apps/web/scripts/verify-states.ts "Apple Inc." CA FL NY ...
//   (no states -> every SUPPORTED_STATES)

import {
  STATE_ADAPTERS,
  SUPPORTED_STATES,
  STATUS_EXTRACT,
  goalFor,
  mapStatus,
} from "../lib/sos-adapters";

const APP = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface Spawned {
  sessionId: string;
  token: string;
  liveViewUrl: string;
}

async function verify(b: Spawned, state: string, entity: string) {
  const adapter = STATE_ADAPTERS[state];
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${b.token}` };
  const signal = AbortSignal.timeout(95_000);

  const ag = await fetch(`${APP}/api/browser/agent`, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      sessionId: b.sessionId,
      startUrl: adapter.searchUrl,
      instruction: goalFor(adapter, entity),
      maxSteps: 25,
    }),
  });
  if (!ag.ok) throw new Error(`agent ${ag.status}: ${(await ag.text()).slice(0, 140)}`);

  const ex = await fetch(`${APP}/api/browser/extract`, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({ sessionId: b.sessionId, instruction: STATUS_EXTRACT }),
  });
  if (!ex.ok) throw new Error(`extract ${ex.status}`);
  const data = (await ex.json()).data;
  return { status: mapStatus(data), raw: typeof data === "string" ? data : JSON.stringify(data) };
}

function releaseOne(b: Spawned) {
  return fetch(`${APP}/api/fleet`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: b.sessionId }),
  }).catch(() => {});
}

async function main() {
  const [entity, ...args] = process.argv.slice(2);
  if (!entity) {
    console.error('usage: tsx apps/web/scripts/verify-states.ts "<entity>" [STATE...]');
    process.exit(1);
  }
  const states = (args.length ? args.map((s) => s.toUpperCase()) : SUPPORTED_STATES).filter(
    (s) => STATE_ADAPTERS[s],
  );
  console.log(`[verify] "${entity}" across ${states.length}: ${states.join(", ")}`);

  const res = await fetch(`${APP}/api/fleet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count: states.length }),
  });
  if (!res.ok) throw new Error(`fleet spawn ${res.status}: ${await res.text()}`);
  const { browsers } = (await res.json()) as { browsers: Spawned[] };

  const t0 = Date.now();
  const rows = await Promise.all(
    states.map(async (s, i) => {
      const st = Date.now();
      let status: string, raw: string;
      try {
        const r = await verify(browsers[i], s, entity);
        status = r.status;
        raw = r.raw;
      } catch (e) {
        status = "error";
        raw = e instanceof Error ? e.message : String(e);
      }
      await releaseOne(browsers[i]); // close the moment this lookup is done
      return { s, status, raw, ms: Date.now() - st };
    }),
  );
  const total = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n[verify] done in ${total}s (wall-clock, parallel)\n`);
  let definitive = 0;
  for (const r of rows) {
    if (r.status === "active" || r.status === "inactive") definitive++;
    console.log(
      `  ${r.s.padEnd(3)} ${r.status.padEnd(9)} ${String(r.ms + "ms").padEnd(8)} ${r.raw.slice(0, 90)}`,
    );
  }
  console.log(
    `\n[verify] ${definitive}/${states.length} returned a definitive active/inactive status; fleet released`,
  );
}

main().catch((e) => {
  console.error("[verify] FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
