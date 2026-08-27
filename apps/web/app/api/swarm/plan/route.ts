// The planner: turns a free-form task ("verify these 12 vendors are real businesses")
// into a structured list of swarm targets, each with its own start URL / search query,
// agent goal, and extraction question. Pure LLM synthesis — no browser/session needed.
// The swarm then fans out over the targets. Mirrors /api/swarm/summary's OpenRouter setup,
// but uses generateText + Output.object so the model must return schema-conformant JSON
// (no hand-parsing; generateObject is deprecated in ai v6). Runs TWO adversarial passes:
// (1) draft the targets, then (2) a critic pass reviews and tightens them, returning the
// refined plan plus short `planNotes` on what changed. A failed critique falls back to the draft.

import { NextRequest } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { rateLimit, SWARM_LIMIT } from "@/lib/rate-limit";
import { PlanRequestSchema, PlanOutputSchema, PlanRefineOutputSchema } from "@/lib/schemas";

export const maxDuration = 60; // two sequential planner passes; 30s risks a 504 mid-pass-2

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
- subject: the bare entity the pinned source is looked up by. REQUIRED for kind "kyb" and "fact",
  null for "general". For "fact" it is the Wikipedia ARTICLE SUBJECT ("Airbnb", "Tokyo", "Notion") —
  never the question and never a phrase like "Airbnb founding year". For "kyb" it is the plain
  company name ("Tesla", "Costco"). label is display text and may still read "Airbnb — founding year".
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
- kind: routing hint. Set one of:
    "kyb"  — verifying whether a COMPANY is a real / registered / active business. Put the plain
             company name in subject; the system routes to SEC EDGAR automatically (don't pick a URL).
    "fact" — a FACTUAL lookup about a specific entity, place, person, product, or work (e.g. founding
             year, CEO, headquarters, population, employee count, release date, director). Put the
             article subject in subject (e.g. "Airbnb", "Tokyo", "Notion") and the precise question in
             extract; the system routes to Wikipedia automatically, so DON'T pick a URL for these.
    "general" — anything else (prices, live status, availability, specs on a specific site). Provide a
             real startUrl/query as usual, and set subject to null.
  Prefer "fact" for stable facts about well-known subjects (Wikipedia is fast + reliable); use
  "general" only when the answer is inherently NOT on Wikipedia (current prices, stock quotes, live
  inventory, retailer-specific data).

Rules:
- READ-ONLY only. Never plan logins, purchases, form submissions that change state, or paid actions.
- Flagship pattern — business Verification/KYB: given company names, create ONE target per company with
  kind:"kyb" and the plain company name as the subject (e.g. "Tesla", "Costco"). Leave startUrl null; the
  system supplies the registry. Ask whether the company is a registered/active business.
- Keep the plan tight: at most ${MAX_TARGETS} targets. Split naturally-parallel work (many
  companies / many retailers / many portals) into one target each.
- title: a short title summarizing the whole run.`;

// Second pass. The model is an adversarial reviewer of the DRAFT plan for THIS task: it hunts
// for weak targets and rewrites them, then reports what it changed. Same target contract as the
// draft (label/subject/startUrl/query/goal/extract/engine), so its output drops straight into the swarm.
const CRITIC = `You are F.R.I.D.A.Y.'s adversarial plan reviewer. You are handed a DRAFT plan (a
title + a list of targets) produced for the user's task. Assume the draft is flawed. Your job is to
tear it apart and return a TIGHTER plan that is more likely to return the exact right answers.

For every target, interrogate it and fix it:
- startUrl: is it the RIGHT, specific page — a real product/record page or the site's own search —
  or is it a vague homepage/wrong page? If you cannot be confident of a specific URL, set it to null
  and lean on query. Do not invent deep URLs you are unsure of.
- goal: is it specific enough to avoid wrong matches? Sharpen it so the agent lands on the exact
  thing, not a look-alike (e.g. "the iPhone 16 Pro 128GB product page itself, NOT a case, accessory,
  trade-in, or financing offer"). Spell out the disambiguation.
- query: is it a strong web search that would surface the exact answer on its own? Rewrite weak
  queries. Every target MUST end with a non-empty query (it is also the automatic retry fallback).
- extract: one precise question with the output format spelled out.
- kind + subject: preserve each target's kind. "kyb" -> SEC EDGAR and "fact" -> Wikipedia are routed
  by the system off SUBJECT, not off label, so DON'T pick URLs for those — instead make subject a bare
  entity name ("Tesla", "Airbnb", "Tokyo"), never a question or a phrase, filling it in if the draft
  left it null; subject must be null for "general". label stays display text ("Airbnb — founding year"
  is fine). For "fact" also ensure the extract is a precise question. Prefer "fact" over "general" for
  stable facts about well-known subjects (founding year, CEO, HQ, population, release date). Only flip
  kind if the draft clearly mislabeled a target (e.g. a live price marked "fact").

Then fix the plan as a whole:
- Remove redundant or duplicate targets (same site + same goal).
- Add an obviously-missing target the task clearly implies but the draft omitted.
- Drop any off-task target that does not serve the user's request.
- Enforce READ-ONLY: no logins, purchases, sign-ups, or any state-changing action. Rewrite or drop
  any target that would require them.

Return the improved plan as { title, targets } using the SAME target shape as the draft, PLUS:
- planNotes: an array of 1-4 SHORT strings, each naming one concrete change you made (e.g. "Pointed
  Best Buy at the exact product page instead of search", "Dropped duplicate Vercel target",
  "Tightened goal to exclude accessories"). If the draft was already good and you changed nothing,
  return the draft's targets unchanged and planNotes as an empty array. Never pad planNotes with
  changes you did not actually make.`;

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
    // Pass 1 (draft). generateText + Output.object is the v6 structured-output path
    // (generateObject is deprecated). The model is forced to return JSON matching PlanOutputSchema.
    const { output: draft } = await generateText({
      model: openrouter.chat(process.env.PLANNER_MODEL || "openai/gpt-4.1"),
      output: Output.object({ schema: PlanOutputSchema }),
      system: SYSTEM,
      prompt: `Task: ${task}`,
    });

    // Pass 2 (critic/refine). An adversarial reviewer tightens the draft for THIS task and reports
    // what it changed in planNotes. A failed critique must NOT fail the whole request, so it has its
    // own try/catch: on error we fall back to the draft plan with empty planNotes.
    let title = draft.title;
    let refinedTargets = draft.targets;
    let planNotes: string[] = [];
    try {
      const { output: refined } = await generateText({
        model: openrouter.chat(process.env.PLANNER_MODEL || "openai/gpt-4.1"),
        output: Output.object({ schema: PlanRefineOutputSchema }),
        system: CRITIC,
        prompt: `Task: ${task}\n\nDraft plan (JSON) to review and tighten:\n${JSON.stringify(draft, null, 2)}`,
      });
      title = refined.title.trim() || draft.title; // never let an empty critic title win
      refinedTargets = refined.targets;
      planNotes = refined.planNotes;
    } catch (critErr: unknown) {
      const m = critErr instanceof Error ? critErr.message : "unknown error";
      console.warn(`[plan] critic pass failed, using draft: ${m}`);
    }

    // Drop empties (strict-mode schema can't enforce non-empty), then cap the REFINED targets.
    // No silent caps. The critic is told to "tear the plan apart" and can validly return an
    // empty/over-pruned list — that's not a throw, so floor it against the draft before we'd
    // 422 a task that actually had runnable targets.
    let targets = refinedTargets.filter((t) => t.goal.trim() && t.extract.trim());
    if (targets.length === 0) {
      const draftRunnable = draft.targets.filter((t) => t.goal.trim() && t.extract.trim());
      if (draftRunnable.length > 0) {
        console.warn("[plan] critic returned no runnable targets; falling back to draft");
        targets = draftRunnable;
        planNotes = [];
      } else {
        return Response.json(
          { error: "The planner produced no runnable targets for that task.", code: "PLAN_EMPTY" },
          { status: 422 },
        );
      }
    }
    if (targets.length > MAX_TARGETS) {
      console.warn(`[plan] clamped ${targets.length} -> ${MAX_TARGETS} targets`);
      targets = targets.slice(0, MAX_TARGETS);
    }

    return Response.json({ title, targets, planNotes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message, code: "PLAN_ERROR" }, { status: 500 });
  }
}
