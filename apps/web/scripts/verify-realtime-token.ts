// Live check of the realtime voice plumbing's SERVER half: does AI_GATEWAY_API_KEY mint a
// gpt-realtime token through the Vercel AI Gateway? This is the one voice piece verifiable
// headlessly (no mic/browser) — it proves /api/realtime/token will work before the M4 UI.
//
// Usage (repo root): agent/node_modules/.bin/tsx apps/web/scripts/verify-realtime-token.ts

import { readFileSync } from "fs";
import { createGateway } from "@ai-sdk/gateway";

// Load .env (mirrors smoke-agent.ts): apps/web/scripts/../.env -> apps/web/.env -> repo .env
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error("[realtime] AI_GATEWAY_API_KEY not found in .env");
    process.exit(1);
  }
  const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });

  // Try the canonical model ids (the docs' catalog) plus the generic alias my code defaults to.
  const candidates = [
    "openai/gpt-realtime",
    "openai/gpt-realtime-2",
    "openai/gpt-realtime-1.5",
    "openai/gpt-realtime-mini",
  ];

  for (const model of candidates) {
    try {
      const r = await gateway.experimental_realtime.getToken({ model, expiresAfterSeconds: 60 });
      console.log(
        `[realtime] ✅ ${model} -> token ${String(r.token).slice(0, 10)}… url=${r.url} expiresAt=${r.expiresAt ?? "-"}`,
      );
      console.log(`[realtime] SET  REALTIME_MODEL=${model}`);
      return;
    } catch (e) {
      console.log(`[realtime] ❌ ${model}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.error("[realtime] no candidate minted a token — check the gateway's realtime access/budget");
  process.exit(1);
}

main().catch((e) => {
  console.error("[realtime] FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
