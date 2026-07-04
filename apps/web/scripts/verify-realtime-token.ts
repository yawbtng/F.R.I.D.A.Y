// Live check of the realtime voice plumbing's SERVER half. CRITICAL: minting a token is NOT
// enough — the AI Gateway will mint a token for a model it then REFUSES over WebSocket
// ("Model X is not available over WebSocket", HTTP 400 on the upgrade). openai/gpt-realtime and
// the gpt-4o-realtime-preview family are REST-only; the browser socket connects then dies in
// ~1s. So this script mints a token AND opens the real WS upgrade, and only blesses a model that
// returns 101. Run this before changing REALTIME_MODEL.
//
// Usage (repo root): agent/node_modules/.bin/tsx apps/web/scripts/verify-realtime-token.ts

import { readFileSync } from "fs";
import https from "node:https";
import crypto from "node:crypto";
import { createGateway } from "@ai-sdk/gateway";

// Load .env (mirrors smoke-agent.ts): apps/web/scripts/../.env -> apps/web/.env -> repo .env
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

// Open the actual gateway realtime WS upgrade with the minted token. Resolves "101" on success,
// otherwise the HTTP status + gateway error message (e.g. the "not available over WebSocket" 400).
function upgradeCheck(url: string, token: string): Promise<string> {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = https.request({
      host: u.host,
      path: u.pathname + u.search,
      method: "GET",
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": crypto.randomBytes(16).toString("base64"),
        "Sec-WebSocket-Protocol": `ai-gateway-realtime.v1, ai-gateway-auth.${token}`,
      },
    });
    req.on("upgrade", (r) => {
      resolve(`101 (WS available) [${r.statusCode}]`);
      req.destroy();
    });
    req.on("response", (r) => {
      let b = "";
      r.on("data", (d) => (b += d));
      r.on("end", () => {
        let msg: string | undefined;
        try {
          msg = JSON.parse(b).error?.message;
        } catch {
          /* non-JSON body */
        }
        resolve(`${r.statusCode} ${msg ?? b.slice(0, 120)}`);
      });
    });
    req.on("error", (e) => resolve(`ERR ${e.message}`));
    req.end();
  });
}

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error("[realtime] AI_GATEWAY_API_KEY not found in .env");
    process.exit(1);
  }
  const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });

  // Put the model the code currently defaults to first, then known/likely realtime ids. We want
  // the FIRST that both mints AND upgrades to 101.
  const candidates = [
    process.env.REALTIME_MODEL || "openai/gpt-realtime-mini",
    "openai/gpt-realtime-mini",
    "openai/gpt-realtime",
    "openai/gpt-4o-realtime-preview",
    "openai/gpt-4o-mini-realtime-preview",
  ].filter((m, i, a) => a.indexOf(m) === i); // de-dupe, keep order

  let winner: string | null = null;
  for (const model of candidates) {
    try {
      const r = await gateway.experimental_realtime.getToken({ model, expiresAfterSeconds: 60 });
      const ws = await upgradeCheck(r.url, String(r.token));
      const ok = ws.startsWith("101");
      console.log(`[realtime] ${ok ? "✅" : "⚠️ "} ${model}  mint=ok  ws=${ws}`);
      if (ok && !winner) winner = model;
    } catch (e) {
      console.log(`[realtime] ❌ ${model}: mint failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (winner) {
    console.log(`\n[realtime] USE  REALTIME_MODEL=${winner}  (mints AND opens the WebSocket)`);
    return;
  }
  console.error("\n[realtime] no candidate is WS-available — check the gateway's realtime access/budget");
  process.exit(1);
}

main().catch((e) => {
  console.error("[realtime] FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
