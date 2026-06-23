// Autonomous agent on a browser session. Optionally navigates to startUrl, then runs
// Stagehand's agent (dom mode) toward `instruction` and returns its final message.
// Used by swarm workers so each browser can figure out its own portal (a fixed
// act sequence can't generalize across ASP.NET / SPA / terms-gated gov sites).

import { NextRequest } from "next/server";
import { AgentSchema } from "@/lib/schemas";
import { validateAgentRequest } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { getStagehand } from "@/lib/stagehand";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  // Swarm fan-out: one grid tab fires ~2 calls per state in a burst, so the per-IP
  // ceiling must clear a full 25-state run (≈50 calls) — well above the 30/min default.
  if (!rateLimit(ip, 120)) {
    return Response.json({ error: "Too many requests", code: "RATE_LIMITED" }, { status: 429 });
  }

  const body = await req.json();
  const parsed = AgentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message, code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  if (!(await validateAgentRequest(req, parsed.data.sessionId))) {
    return Response.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const stagehand = await getStagehand(parsed.data.sessionId);

    if (parsed.data.startUrl) {
      const page = stagehand.context.activePage()!;
      await page.goto(parsed.data.startUrl);
    }

    // Model routes through the Browserbase Model Gateway (plain slug + BB key).
    const agent = stagehand.agent({ model: process.env.STAGEHAND_MODEL || "openai/gpt-4.1-mini" });
    const result = await agent.execute({
      instruction: parsed.data.instruction,
      maxSteps: parsed.data.maxSteps ?? 14,
    });

    return Response.json({
      data: { message: result.message, completed: result.completed },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message, code: "STAGEHAND_ERROR" }, { status: 500 });
  }
}
