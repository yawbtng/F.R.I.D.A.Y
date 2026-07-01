// The planner: turns a free-form task ("verify these 12 vendors are real businesses")
// into a structured list of swarm targets, each with its own start URL / search query,
// agent goal, and extraction question. Pure LLM synthesis — no browser/session needed.
// The swarm then fans out over the targets. Mirrors /api/swarm/summary's OpenRouter setup,
// but uses generateText + Output.object so the model must return schema-conformant JSON
// matching PlanOutputSchema (no hand-parsing; generateObject is deprecated in ai v6).

import { NextRequest } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { rateLimit } from "@/lib/rate-limit";
import { PlanRequestSchema, PlanOutputSchema } from "@/lib/schemas";

export const maxDuration = 30;

// Hard cap on targets = the swarm's proven concurrency. The schema allows 25; we clamp to
// 20 to match the Developer-tier fleet and the "20 is enough" product decision.
const MAX_TARGETS = 20;

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Flagship pattern = Verification/KYB, but the planner handles arbitrary fan-out tasks.
const SYSTEM = `You are F.R.I.D.A.Y.'s dispatch planner. You turn a user's natural-language
task into a list of INDEPENDENT targets, one per cloud browser, that a swarm runs in parallel.

Each target is one browser doing one job on one site and reading back one answer. Targets must
be independent — no target may depend on another's result (they run at the same time).

For each target provide:
- label: a short human-readable name for the tile (e.g. "Acme Corp — CA registry", "BestBuy — iPhone 16 Pro").
- startUrl: the exact entry URL when you are confident of it. Prefer this.
- query: a web search query to discover the right page, used ONLY when you don't know a startUrl.
  Provide exactly one of startUrl or query per target.
- goal: an imperative instruction telling the agent what to DO on the page (search, accept a
  terms gate, open the matching record, navigate to the right product, etc.).
- extract: ONE concise question whose answer is the value you want back (e.g. "Is this business
  active or dissolved? Reply one word." or "What is the listed price in USD?").
- engine: omit for normal targets (they run on the fast default engine). Set "bb-agent" ONLY for a
  genuinely open-ended target that needs full autonomous multi-step reasoning across an unknown site.

Rules:
- READ-ONLY only. Never plan logins, purchases, form submissions that change state, or paid actions.
- Flagship pattern — business Verification/KYB: given company names, target each company's official
  registry (usually a U.S. state Secretary of State business search) and ask whether it is active.
- Keep the plan tight: at most ${MAX_TARGETS} targets. Split naturally-parallel work (many
  companies / many retailers / many portals) into one target each.
- title: a short title summarizing the whole run.`;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(ip, 60)) {
    return Response.json({ error: "Too many requests", code: "RATE_LIMITED" }, { status: 429 });
  }

  const body = await req.json();
  const parsed = PlanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message, code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }
  const { task } = parsed.data;

  try {
    // generateText + Output.object is the v6 structured-output path (generateObject is
    // deprecated). The model is forced to return JSON matching PlanOutputSchema.
    const { output } = await generateText({
      model: openrouter.chat(process.env.PLANNER_MODEL || "openai/gpt-4.1"),
      output: Output.object({ schema: PlanOutputSchema }),
      system: SYSTEM,
      prompt: `Task: ${task}`,
    });

    // No silent caps: if the model over-plans, trim and say so.
    let targets = output.targets;
    if (targets.length > MAX_TARGETS) {
      console.warn(`[plan] clamped ${targets.length} -> ${MAX_TARGETS} targets`);
      targets = targets.slice(0, MAX_TARGETS);
    }

    return Response.json({ title: output.title, targets });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message, code: "PLAN_ERROR" }, { status: 500 });
  }
}
