// AI-generated verification report. Takes the finished swarm results (per-state status)
// and synthesizes a concise KYB findings summary. Pure over already-collected data — no
// browser/session needed. Routed through OpenRouter via the Vercel AI SDK.

import { NextRequest } from "next/server";
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { rateLimit, SWARM_LIMIT } from "@/lib/rate-limit";
import { SummaryOutputSchema } from "@/lib/schemas";

export const maxDuration = 30;

// Accepts the general shape { task, results:[{label,status,result,ms}] } and the legacy
// KYB shape { entity, results:[{state,name,status,ms}] } so any caller works.
const SummarySchema = z.object({
  task: z.string().optional(),
  entity: z.string().optional(),
  results: z
    .array(
      z.object({
        label: z.string().optional(),
        state: z.string().optional(),
        name: z.string().optional(),
        status: z.string(),
        result: z.string().optional(),
        ms: z.number().optional(),
      }),
    )
    .min(1),
});

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(ip, SWARM_LIMIT)) {
    return Response.json({ error: "Too many requests", code: "RATE_LIMITED" }, { status: 429 });
  }

  const body = await req.json();
  const parsed = SummarySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message, code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }
  const { results } = parsed.data;
  const subject = parsed.data.task || parsed.data.entity || "the requested task";

  const rows = results
    .map((r) => {
      const label = r.label ?? r.name ?? r.state ?? "?";
      const answer = r.result ? ` -> ${r.result}` : "";
      return `- ${label}: ${r.status}${answer}${r.ms ? ` [${(r.ms / 1000).toFixed(0)}s]` : ""}`;
    })
    .join("\n");

  // Pre-compute counts so the model never has to do arithmetic (LLMs miscount).
  const counts = results.reduce<Record<string, number>>((a, r) => {
    a[r.status] = (a[r.status] ?? 0) + 1;
    return a;
  }, {});
  const countsLine = Object.entries(counts)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  const prompt =
    `A swarm of cloud browsers just ran this task in parallel across ${results.length} targets:\n` +
    `"${subject}"\n\n` +
    `Per-target results (status, then the extracted answer):\n\n${rows}\n\n` +
    `Authoritative counts (use these EXACTLY, do not recount): ${countsLine}. Total: ${results.length}.\n\n` +
    `Status meanings: done = target completed and returned the answer shown; active = registered / in good ` +
    `standing; inactive = dissolved / revoked / expired (worth attention); notfound = no matching record; ` +
    `blocked = the site blocked automated access (CAPTCHA/anti-bot) so it could not be read — a portal ` +
    `limitation, NOT a red flag; error = the check itself failed (the text after "->" is the reason, e.g. ` +
    `the browser session ended, the site timed out, or a bot-wall).\n\n` +
    `Write the synthesis (the per-target rows are shown separately in the UI, so do NOT re-list them all):\n` +
    `- headline: one sentence with the overall finding (how many resolved, the gist).\n` +
    `- takeaway: one-line bottom line for whoever asked.\n` +
    `- notes: 1-4 short bullet strings. Lead with real findings (inactive/dissolved, notable answers). When ` +
    `targets are blocked or errored, explain WHY in plain English (e.g. "3 state portals blocked automated ` +
    `access behind a CAPTCHA" or "2 checks timed out on slow government sites") and, when useful, the fix ` +
    `("a stealth retry with proxies usually clears anti-bot walls"). Group similar failures into one note ` +
    `rather than one per target. Empty array only if everything resolved cleanly.\n` +
    `Plain text, no markdown symbols. Be precise; never invent targets not in the data.`;

  try {
    const { output } = await generateText({
      model: openrouter.chat(process.env.SUMMARY_MODEL || "openai/gpt-4.1-mini"),
      output: Output.object({ schema: SummaryOutputSchema }),
      prompt,
    });
    return Response.json(output);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message, code: "SUMMARY_ERROR" }, { status: 500 });
  }
}
