import { NextRequest } from "next/server";
import { ExtractSchema } from "@/lib/schemas";
import { validateAgentRequest } from "@/lib/api-auth";
import { rateLimit, SWARM_LIMIT } from "@/lib/rate-limit";
import { getStagehand } from "@/lib/stagehand";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  // Higher per-IP ceiling for the swarm fan-out (paired with /api/browser/agent).
  if (!rateLimit(ip, SWARM_LIMIT)) {
    return Response.json(
      { error: "Too many requests", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  const body = await req.json();
  const parsed = ExtractSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message, code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  if (!(await validateAgentRequest(req, parsed.data.sessionId))) {
    return Response.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const stagehand = await getStagehand(parsed.data.sessionId);
    const data = await stagehand.extract(parsed.data.instruction);
    return Response.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { error: message, code: "STAGEHAND_ERROR" },
      { status: 500 }
    );
  }
}
