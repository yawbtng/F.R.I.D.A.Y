// Fleet spawn/close. POST spawns N Browserbase sessions for a swarm run and returns
// one { browserId, sessionId, liveViewUrl, token } per browser; the local-first
// orchestrator (agent/src/fleet) builds an AgentContext from each and fans out.
// DELETE closes a single session.
//
// LIVE-VERIFY: the spawn path is the same create-then-reattach flow as /api/session
// (keepAlive). Needs a live smoke run to confirm behaviour on the current plan tier.

import { NextRequest } from "next/server";
import { FleetSpawnSchema, FleetCloseSchema } from "@/lib/schemas";
import { rateLimit, SWARM_LIMIT } from "@/lib/rate-limit";
import { createBrowserSession, releaseBrowserSession } from "@/lib/browserbase";
import { removeSession } from "@/lib/stagehand";

export const maxDuration = 60;

// Spawn in small batches so the grid fills quickly without bursting session creates.
const SPAWN_BATCH = 5;

interface SpawnedBrowser {
  browserId: string;
  sessionId: string;
  liveViewUrl: string;
  token: string;
}

/** Drop the local handle and end the cloud session. Best-effort per id: one failed release
 *  must not abort the rest, or the leak this exists to prevent comes back. */
async function releaseAll(items: Array<{ sessionId: string }>): Promise<void> {
  await Promise.allSettled(
    items.map(async ({ sessionId }) => {
      removeSession(sessionId);
      await releaseBrowserSession(sessionId).catch(() => {});
    }),
  );
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  // One spawn per run, but allow several runs/minute from the same demo machine.
  if (!rateLimit(ip, SWARM_LIMIT)) {
    return Response.json({ error: "Too many requests", code: "RATE_LIMITED" }, { status: 429 });
  }

  const body = await req.json();
  const parsed = FleetSpawnSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message, code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  try {
    const browsers: SpawnedBrowser[] = [];
    for (let i = 0; i < parsed.data.count; i += SPAWN_BATCH) {
      const size = Math.min(SPAWN_BATCH, parsed.data.count - i);
      // allSettled, NOT all: `Promise.all` rejects on the first failure and DISCARDS the
      // siblings that already resolved — those sessions exist on Browserbase but their ids
      // never reach the client, so nothing holds them and nothing can release them. At the old
      // ~60s session timeout that self-healed; at 300s (lib/browserbase.ts) a failed spawn of
      // 20 locked most of the 20-session concurrency pool for five minutes, and the NEXT run
      // then failed with an unexplained 500. So: settle everything, keep the winners in hand.
      const settled = await Promise.allSettled(
        Array.from({ length: size }, () => createBrowserSession({ stealth: parsed.data.stealth })),
      );
      for (const s of settled) {
        if (s.status === "fulfilled") {
          const c = s.value;
          browsers.push({ browserId: c.sessionId, sessionId: c.sessionId, liveViewUrl: c.liveViewUrl, token: c.token });
        }
      }
      const failure = settled.find((s) => s.status === "rejected");
      if (failure) {
        // Partial failure: hand back nothing, but leak nothing either. Release every session
        // created so far (this batch AND earlier ones) before rethrowing, so the pool is clean
        // by the time the client sees the error. Same release path as DELETE below.
        await releaseAll(browsers);
        throw failure.reason instanceof Error ? failure.reason : new Error(String(failure.reason));
      }
    }
    return Response.json({ browsers, count: browsers.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message, code: "FLEET_ERROR" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const parsed = FleetCloseSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message, code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  removeSession(parsed.data.sessionId); // drop the local handle
  await releaseBrowserSession(parsed.data.sessionId).catch(() => {}); // actually end the cloud session
  return Response.json({ closed: parsed.data.sessionId });
}
