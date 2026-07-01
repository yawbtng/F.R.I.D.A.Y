// The planner: turns a free-form task ("verify these 12 vendors are real businesses")
// into a structured list of swarm targets, each with its own start URL / search query,
// agent goal, and extraction question. Pure LLM synthesis — no browser/session needed.
// The swarm then fans out over the targets. Mirrors /api/swarm/summary's OpenRouter setup,
// but uses generateText + Output.object so the model must return schema-conformant JSON
// matching PlanOutputSchema (no hand-parsing; generateObject is deprecated in ai v6).

import { NextRequest } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { rateLimit, SWARM_LIMIT } from "@/lib/rate-limit";
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

The agent driving each target can navigate, click, use a site's own search, and read the page.
If its first attempt on the start page comes up empty, the swarm automatically web-searches your
query, opens another result, and tries again — so write a query that would surface the answer.

For each target provide:
- label: a short human-readable name for the tile (e.g. "Acme Corp — CA registry", "Best Buy — iPhone 16 Pro").
- startUrl: the exact entry URL when you are confident of it (a real product/record page or the
  site's search). Prefer this. If unsure, leave it null and rely on query.
- query: ALWAYS provide a strong web search query that would find the exact answer (e.g.
  "Vercel current CEO name", "iPhone 16 Pro 128GB price site:bestbuy.com"). Used both to discover
  the page when startUrl is null AND as the automatic retry fallback. Do not leave it null.
- goal: a COMPREHENSIVE imperative instruction. Name the EXACT thing to find and how to reach it —
  accept any terms gate, use the site's search, open the specific product/record (NOT accessories,
  cases, bundles, financing offers, or look-alikes), and, if it isn't on the landing page, follow
  the most relevant link. Be explicit about disambiguation (e.g. "the new iPhone 16 Pro 128GB
  itself, not a case or a trade-in offer").
- extract: ONE precise question whose answer is exactly the value wanted, with the format spelled
  out (e.g. "What is the current price of the new iPhone 16 Pro 128GB in USD? Reply with just the
  number, e.g. 999." or "Who is the current CEO? Reply with just their full name."). If the value
  isn't present, the agent should reply with nothing.
- engine: leave null for normal targets. Set "bb-agent" ONLY for a genuinely open-ended target that
  needs full autonomous multi-step reasoning across an unknown site.

Rules:
- READ-ONLY only. Never plan logins, purchases, form submissions that change state, or paid actions.
- Flagship pattern — business Verification/KYB: given company names, target each company's official
  registry (usually a U.S. state Secretary of State business search) and ask whether it is active.
- Keep the plan tight: at most ${MAX_TARGETS} targets. Split naturally-parallel work (many
  companies / many retailers / many portals) into one target each.
- title: a short title summarizing the whole run.`;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(ip, SWARM_LIMIT)) {
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

    // Drop empties (strict-mode schema can't enforce non-empty), then cap. No silent caps.
    let targets = output.targets.filter((t) => t.goal.trim() && t.extract.trim());
    if (targets.length === 0) {
      return Response.json(
        { error: "The planner produced no runnable targets for that task.", code: "PLAN_EMPTY" },
        { status: 422 },
      );
    }
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
