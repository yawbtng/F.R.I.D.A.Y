// Diagram author: turns a finished swarm run into ONE Mermaid diagram whose TYPE the model picks
// to fit the task (fan-out flowchart, relationship graph, proportions pie, hierarchy, timeline).
// Mirrors /api/swarm/summary's OpenRouter + generateText/Output.object setup (generateObject is
// deprecated in ai v6). Pure over already-collected results — no browser/session. The CLIENT
// renders the source and guards against malformed Mermaid, so we don't validate syntax here.

import { NextRequest } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { rateLimit, SWARM_LIMIT } from "@/lib/rate-limit";
import { DiagramRequestSchema, DiagramOutputSchema } from "@/lib/schemas";

export const maxDuration = 30;

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

// The model chooses the diagram TYPE for the task (per the product decision: the right diagram
// depends on the query). The hard rules exist because LLM-authored Mermaid most often fails to
// parse on unquoted/complex node labels — quoting + simple ids keeps the render path green.
const SYSTEM = `You are F.R.I.D.A.Y.'s diagram author. Given a finished browser-swarm run (a task
plus per-target results), produce ONE Mermaid diagram that best illuminates THIS task and its
findings. YOU choose the diagram type — pick whatever communicates the result most clearly:

- how one command fanned out across targets, or a process → flowchart ("flowchart LR" / "flowchart TD")
- how findings relate / connect → graph
- proportion of an outcome (e.g. verified vs needs-attention) → pie
- a hierarchy or breakdown → mindmap
- steps over time → timeline

Author RENDERABLE Mermaid v11 source. Follow these rules exactly so it parses:
- The FIRST line is the diagram directive (e.g. "flowchart LR", "pie showData", "mindmap").
- Give every node's display text in double quotes: n1["Acme Corp"]. Keep label text short.
- NEVER put parentheses, square brackets, braces, quotes, colons, semicolons, or newlines INSIDE
  a label. Strip them from real names if needed.
- Use simple alphanumeric node ids (n1, n2, ...). Reflect the REAL labels and statuses from the data.
- If there are many targets, group or summarize so it stays readable — aim for roughly 15 nodes max.
- Use the run's actual data. Never invent targets that are not present.
- Output the Mermaid SOURCE ONLY (no markdown code fences).

Return: title (short), kind (one or two words for the shape, e.g. "fan-out flowchart" or "outcome pie"),
mermaid (the source).`;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(ip, SWARM_LIMIT)) {
    return Response.json({ error: "Too many requests", code: "RATE_LIMITED" }, { status: 429 });
  }

  const body = await req.json();
  const parsed = DiagramRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message, code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }
  const { results, hint } = parsed.data;
  const subject = parsed.data.task || "the requested task";

  const rows = results
    .map((r) => `- ${r.label}: ${r.status}${r.result ? ` -> ${r.result}` : ""}`)
    .join("\n");
  const counts = results.reduce<Record<string, number>>((a, r) => {
    a[r.status] = (a[r.status] ?? 0) + 1;
    return a;
  }, {});
  const countsLine = Object.entries(counts)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  const prompt =
    `Task the swarm ran across ${results.length} targets:\n"${subject}"\n\n` +
    `Per-target results (status, then extracted answer):\n${rows}\n\n` +
    `Status counts: ${countsLine}. Total: ${results.length}.\n` +
    (hint ? `\nThe user asked specifically for: ${hint}\n` : "") +
    `\nChoose the clearest diagram type for this and author the Mermaid.`;

  try {
    const { output } = await generateText({
      model: openrouter.chat(process.env.DIAGRAM_MODEL || "openai/gpt-4.1-mini"),
      output: Output.object({ schema: DiagramOutputSchema }),
      system: SYSTEM,
      prompt,
    });
    // Defensively strip stray code fences the model may add despite the instruction.
    const mermaid = output.mermaid
      .replace(/^\s*```(?:mermaid)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    if (!mermaid) {
      return Response.json({ error: "The model returned an empty diagram.", code: "DIAGRAM_EMPTY" }, { status: 422 });
    }
    return Response.json({ title: output.title, kind: output.kind, mermaid });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message, code: "DIAGRAM_ERROR" }, { status: 500 });
  }
}
