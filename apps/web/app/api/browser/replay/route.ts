// Proxy a Browserbase session replay (HLS). The rrweb /recording API is deprecated;
// /replays returns { pages:[{pageId,...}] } and /replays/{pageId} is an .m3u8 manifest
// whose segment URLs are pre-signed CDN links (valid ~6h). We fetch the manifest with the
// BB API key server-side and hand the text to the client, which plays it via hls.js
// (segments load directly from the pre-signed URLs — no need to proxy them).

import { NextRequest } from "next/server";
import { ScreenshotSchema } from "@/lib/schemas"; // { sessionId } — same shape we need
import { validateAgentRequest } from "@/lib/api-auth";
import { rateLimit, SWARM_LIMIT } from "@/lib/rate-limit";

export const maxDuration = 30;

const BB = "https://api.browserbase.com";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  // Shares the global per-IP counter with the swarm routes — keep the same high ceiling.
  if (!rateLimit(ip, SWARM_LIMIT)) {
    return Response.json({ error: "Too many requests", code: "RATE_LIMITED" }, { status: 429 });
  }

  const body = await req.json();
  const parsed = ScreenshotSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message, code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  if (!(await validateAgentRequest(req, parsed.data.sessionId))) {
    return Response.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const key = process.env.BROWSERBASE_API_KEY!;
  const sid = parsed.data.sessionId;
  try {
    const metaRes = await fetch(`${BB}/v1/sessions/${sid}/replays`, {
      headers: { "x-bb-api-key": key },
    });
    if (!metaRes.ok) return Response.json({ ready: false });

    const meta = (await metaRes.json()) as { pages?: { pageId: string }[] };
    const pageId = meta.pages?.[0]?.pageId;
    if (pageId == null) return Response.json({ ready: false });

    const m3uRes = await fetch(`${BB}/v1/sessions/${sid}/replays/${pageId}`, {
      headers: { "x-bb-api-key": key },
    });
    if (!m3uRes.ok) return Response.json({ ready: false });

    const m3u8 = await m3uRes.text();
    return Response.json({ ready: true, m3u8 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message, code: "REPLAY_ERROR" }, { status: 500 });
  }
}
