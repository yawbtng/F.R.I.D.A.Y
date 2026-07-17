// Autonomous agent on a browser session. Optionally navigates to startUrl, then runs
// Stagehand's agent (dom mode) toward `instruction` and returns its final message.
// Used by swarm workers so each browser can figure out its own portal (a fixed
// act sequence can't generalize across ASP.NET / SPA / terms-gated gov sites).

import { NextRequest } from "next/server";
import { AgentSchema } from "@/lib/schemas";
import { validateAgentRequest } from "@/lib/api-auth";
import { rateLimit, SWARM_LIMIT } from "@/lib/rate-limit";
import { getStagehand, removeSession } from "@/lib/stagehand";

export const maxDuration = 60;

// Cheap bot-wall fingerprints (Cloudflare Turnstile, generic CAPTCHA / challenge pages).
// Matched against page title+text after navigation and against act/click error messages,
// so a blocked portal settles as `blocked` immediately instead of grinding act() timeouts.
const BOT_WALL =
  /turnstile|captcha|verify you are|are you human|challenge|attention required/i;

const blockedResponse = (detail: string) =>
  Response.json({
    data: { message: `Blocked: ${detail}`, completed: false, blocked: true },
  });

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  // Swarm fan-out: one grid tab fires ~2 calls per state in a burst, so the per-IP
  // ceiling must clear a full 25-state run (≈50 calls) — well above the 30/min default.
  if (!rateLimit(ip, SWARM_LIMIT)) {
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

    // Fail fast on a dead session: no page means the browser is gone, so don't let the
    // agent loop start (every tool call would null-crash until maxSteps burn out).
    const page = stagehand.context?.activePage();
    if (!page) {
      removeSession(parsed.data.sessionId);
      return Response.json({ error: "Browser session lost", code: "SESSION_LOST" }, { status: 500 });
    }

    if (parsed.data.startUrl) {
      await page.goto(parsed.data.startUrl);
      // Fast blocked detection: a Turnstile/CAPTCHA wall never yields to the agent, so
      // classify it from title + visible text (one cheap evaluate) before driving it.
      const fingerprint = await page
        .evaluate<string>("document.title + ' ' + (document.body?.innerText ?? '').slice(0, 500)")
        .catch(() => "");
      if (BOT_WALL.test(fingerprint)) {
        return blockedResponse("CAPTCHA / bot-verification wall detected after navigation");
      }
    }

    // Model routes through the Browserbase Model Gateway (plain slug + BB key).
    const agent = stagehand.agent({ model: process.env.STAGEHAND_MODEL || "openai/gpt-4.1-mini" });
    // Fail fast if the CDP context dies mid-run (released/expired session): reject the
    // request the moment stagehand.context nulls instead of letting the model retry
    // null-crashing tools step after step. (The hosted API forbids the abort signal.)
    let liveness: ReturnType<typeof setInterval> | undefined;
    let result;
    try {
      result = await Promise.race([
        agent.execute({
          instruction: parsed.data.instruction,
          maxSteps: parsed.data.maxSteps ?? 25,
        }),
        new Promise<never>((_, reject) => {
          liveness = setInterval(() => {
            if (!stagehand.context) reject(new Error("Browser session lost mid-run"));
          }, 1_000);
        }),
      ]);
    } finally {
      clearInterval(liveness);
    }
    // execute() swallows internal errors into { success: false }; a nulled context by the
    // end means the session is gone — evict + surface it, don't hand back a chatty 200.
    if (!stagehand.context) {
      removeSession(parsed.data.sessionId);
      return Response.json({ error: "Browser session lost", code: "SESSION_LOST" }, { status: 500 });
    }

    return Response.json({
      data: { message: result.message, completed: result.completed },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // An act that died on a CAPTCHA iframe (e.g. StagehandClickError on cf-turnstile)
    // means the portal is blocking us, not erroring — settle the tile as blocked.
    if (BOT_WALL.test(message)) {
      return blockedResponse(message.slice(0, 140));
    }
    return Response.json({ error: message, code: "STAGEHAND_ERROR" }, { status: 500 });
  }
}
