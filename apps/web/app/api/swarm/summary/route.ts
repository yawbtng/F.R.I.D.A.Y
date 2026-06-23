// AI-generated verification report. Takes the finished swarm results (per-state status)
// and synthesizes a concise KYB findings summary. Pure over already-collected data — no
// browser/session needed. Routed through OpenRouter via the Vercel AI SDK.

import { NextRequest } from "next/server";
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

const SummarySchema = z.object({
  entity: z.string().min(1),
  results: z
    .array(
      z.object({
        state: z.string(),
        name: z.string().optional(),
        status: z.string(),
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
  if (!rateLimit(ip, 120)) {
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
  const { entity, results } = parsed.data;

  const rows = results
    .map(
      (r) =>
        `- ${r.name ?? r.state} (${r.state}): ${r.status}${r.ms ? ` [${(r.ms / 1000).toFixed(0)}s]` : ""}`,
    )
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
    `You are a KYB (know-your-business) analyst. A swarm of cloud browsers just checked the ` +
    `registration status of "${entity}" across ${results.length} U.S. state Secretary-of-State business ` +
    `registries, in parallel. Per-state results:\n\n${rows}\n\n` +
    `Authoritative counts (use these EXACTLY, do not recount): ${countsLine}. Total checked: ${results.length}.\n\n` +
    `Status meanings: active = registered, in good standing; inactive = dissolved/revoked/expired (worth ` +
    `attention); notfound = no matching record on that state's registry; blocked = the state's portal blocked ` +
    `automated access (CAPTCHA/anti-bot) so it could not be checked — a portal limitation, NOT a red flag for ` +
    `the entity; error = the check itself failed.\n\n` +
    `Write a concise report in PLAIN TEXT (no markdown symbols — no #, *, or backticks). Use short labeled ` +
    `sections separated by blank lines:\n` +
    `HEADLINE: one sentence with the overall finding (how many states confirm it active).\n` +
    `BREAKDOWN: counts per status; list the states in each non-active group.\n` +
    `NOTES: flag any inactive/dissolved results (these matter), note which states blocked automation, and any ` +
    `anomalies.\n` +
    `TAKEAWAY: one-line bottom line for someone vetting this business.\n` +
    `Under 180 words. Be precise; never invent states not in the data.`;

  try {
    const { text } = await generateText({
      model: openrouter.chat(process.env.SUMMARY_MODEL || "openai/gpt-4.1-mini"),
      prompt,
    });
    return Response.json({ summary: text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message, code: "SUMMARY_ERROR" }, { status: 500 });
  }
}
