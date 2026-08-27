// Batch session release, shaped for `navigator.sendBeacon` (see hooks/use-swarm.ts).
//
// Why this exists rather than reusing DELETE /api/fleet: a beacon is the only send that
// survives page teardown, and it can ONLY issue a POST with a body — no custom method, no
// custom headers. DELETE /api/fleet also takes one id per call, so a 20-browser fleet would
// need 20 requests fired during unload, which the browser is free to drop. This is the same
// release path (removeSession + REQUEST_RELEASE), just batched behind one POST.
//
// Unauthenticated, matching DELETE /api/fleet: the only thing an id buys you is ENDING a
// session, which is the safe direction (a stranded session bills; a released one cannot).

import { NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit, SWARM_LIMIT } from "@/lib/rate-limit";
import { releaseBrowserSession } from "@/lib/browserbase";
import { removeSession } from "@/lib/stagehand";

export const maxDuration = 60;

// Capped at the Developer-tier concurrency limit — a beacon can't carry more live sessions
// than the plan can hold, so anything larger is malformed, not a bigger fleet.
const FleetReleaseSchema = z.object({
  sessionIds: z.array(z.string().min(1)).min(1).max(25),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(ip, SWARM_LIMIT)) {
    return Response.json({ error: "Too many requests", code: "RATE_LIMITED" }, { status: 429 });
  }

  // sendBeacon bodies arrive as a Blob whose type we set to application/json; a torn-down
  // page can still produce a truncated body, so a parse failure is a 400, never a throw.
  const body = await req.json().catch(() => null);
  const parsed = FleetReleaseSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message, code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  // Best-effort per id: an already-released session 4xxs on REQUEST_RELEASE and that must not
  // stop the rest of the batch. Releasing twice is a no-op, so over-releasing is always safe.
  await Promise.allSettled(
    parsed.data.sessionIds.map(async (sessionId) => {
      removeSession(sessionId);
      await releaseBrowserSession(sessionId).catch(() => {});
    }),
  );

  // The caller is a page that no longer exists — nobody reads this. Keep it cheap.
  return Response.json({ released: parsed.data.sessionIds.length });
}
