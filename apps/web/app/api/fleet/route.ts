// Fleet spawn/close. POST spawns N Browserbase sessions for a swarm run and returns
// one { browserId, sessionId, liveViewUrl, token } per browser; the local-first
// orchestrator (agent/src/fleet) builds an AgentContext from each and fans out.
// DELETE closes a single session.
//
// LIVE-VERIFY: the spawn path is the same create-then-reattach flow as /api/session
// (keepAlive). Needs a live smoke run to confirm behaviour on the current plan tier.

import { NextRequest } from "next/server";
import { FleetSpawnSchema, FleetCloseSchema } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { createBrowserSession } from "@/lib/browserbase";
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

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  // One spawn per run, but allow several runs/minute from the same demo machine.
  if (!rateLimit(ip, 60)) {
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
      const created = await Promise.all(
        Array.from({ length: size }, () => createBrowserSession()),
      );
      for (const c of created) {
        browsers.push({ browserId: c.sessionId, sessionId: c.sessionId, liveViewUrl: c.liveViewUrl, token: c.token });
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

  removeSession(parsed.data.sessionId);
  return Response.json({ closed: parsed.data.sessionId });
}
