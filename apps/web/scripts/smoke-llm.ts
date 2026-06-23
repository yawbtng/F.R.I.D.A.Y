// Diagnostic: exercise Stagehand extract against OpenRouter and print the FULL
// provider error (url + responseBody), which the API layer hides behind "Bad Request".
// Pass a modelName to triangulate: tsx scripts/smoke-llm.ts "xai/x-ai/grok-4.20"

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

const ENV_PATH = resolve(__dirname, "../../../.env");
for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

async function main() {
  const modelName = process.argv[2] || `xai/${process.env.OPENROUTER_MODEL || "x-ai/grok-4.20"}`;
  console.log("[llm-smoke] model:", modelName);

  // mode: "native" => bare string; "gw" => Model Gateway (BB key as model key, no baseURL);
  // default => OpenRouter via custom baseURL.
  const mode = process.argv[3];
  const modelConfig =
    mode === "native"
      ? modelName
      : mode === "gw"
        ? { modelName, apiKey: process.env.BROWSERBASE_API_KEY! }
        : { modelName, baseURL: "https://openrouter.ai/api/v1", apiKey: process.env.OPENROUTER_API_KEY! };
  console.log("[llm-smoke] mode:", mode || "openrouter");
  const sh = new Stagehand({
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    keepAlive: true,
    model: modelConfig,
  });
  await sh.init();
  const page = sh.context.activePage()!;
  await page.goto("https://example.com");

  try {
    const data = await sh.extract("extract the main heading text", z.object({ heading: z.string() }));
    console.log("[llm-smoke] PASS ->", JSON.stringify(data));
  } catch (e) {
    const err = e as Record<string, unknown>;
    console.error("[llm-smoke] FAILED");
    console.error("  message:", err?.message);
    // Stagehand wraps the AI-SDK error; the real detail is on .cause (possibly nested).
    let cur: Record<string, unknown> | undefined = err;
    let depth = 0;
    while (cur && depth < 5) {
      const rb = cur.responseBody ?? cur.data;
      if (cur.statusCode || cur.url || rb) {
        console.error(`  [cause depth ${depth}] name=${String(cur.name)} status=${String(cur.statusCode)} url=${String(cur.url)}`);
        console.error("  responseBody:", typeof rb === "string" ? rb.slice(0, 800) : JSON.stringify(rb)?.slice(0, 800));
      }
      cur = cur.cause as Record<string, unknown> | undefined;
      depth++;
    }
    console.error("  raw:", JSON.stringify(err, Object.getOwnPropertyNames(err as object)).slice(0, 800));
  } finally {
    await sh.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
