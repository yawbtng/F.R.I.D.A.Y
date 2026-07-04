// Mints a short-lived ephemeral token for the browser's realtime voice session, so the
// AI Gateway key NEVER reaches the client. The browser POSTs here (the useRealtime hook's
// `api.token` is THIS route's URL), gets back { token, url, tools }, then opens a WebSocket
// straight to gpt-realtime through the Gateway. Tool SCHEMAS are attached here; the browser
// executes them (the swarm is client-driven — see use-friday's dispatch in M2).
import {
  experimental_getRealtimeToolDefinitions,
  type Experimental_RealtimeSetupResponse,
} from "ai";
import { createGateway } from "@ai-sdk/gateway";
import { realtimeTools } from "@/lib/realtime-tools";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request): Promise<Response> {
  await req.json().catch(() => ({})); // client sends { sessionConfig }; we ignore for now

  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "AI_GATEWAY_API_KEY is not set" }, { status: 500 });
  }

  const gateway = createGateway({ apiKey });
  // This model id is embedded in the returned WS url, so it MUST be WS-available on the
  // Gateway (not just REST-mintable). openai/gpt-realtime is REST-only and 400s the upgrade;
  // gpt-realtime-mini works. Keep this default in sync with use-voice.ts.
  const { token, url, expiresAt } = await gateway.experimental_realtime.getToken({
    model: process.env.REALTIME_MODEL || "openai/gpt-realtime-mini",
    expiresAfterSeconds: 60,
  });

  const tools = await experimental_getRealtimeToolDefinitions({ tools: realtimeTools });

  const body: Experimental_RealtimeSetupResponse = { token, url, expiresAt, tools };
  return Response.json(body);
}
