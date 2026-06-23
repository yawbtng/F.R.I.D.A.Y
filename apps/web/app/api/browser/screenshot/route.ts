import { NextRequest } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { ScreenshotSchema } from "@/lib/schemas";
import { validateAgentRequest } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { getStagehand } from "@/lib/stagehand";
import { compressScreenshot } from "@/lib/screenshot";
import { api } from "../../../../../../convex/_generated/api";

export const maxDuration = 60;

const convex = process.env.NEXT_PUBLIC_CONVEX_URL
  ? new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL)
  : null;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  // Part of the swarm fan-out (one freeze-frame per tile on completion); the per-IP
  // counter is shared across routes, so match the agent/extract ceiling.
  if (!rateLimit(ip, 120)) {
    return Response.json(
      { error: "Too many requests", code: "RATE_LIMITED" },
      { status: 429 },
    );
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
    return Response.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  try {
    const stagehand = await getStagehand(parsed.data.sessionId);
    const screenshot = await compressScreenshot(stagehand);

    // Persist screenshot to Convex file storage (non-blocking)
    if (convex) {
      persistScreenshot(parsed.data.sessionId, screenshot).catch(
        (err: unknown) => {
          console.error("[convex] Failed to persist screenshot:", err);
        },
      );
    }

    return Response.json({ screenshot });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { error: message, code: "STAGEHAND_ERROR" },
      { status: 500 },
    );
  }
}

/**
 * Upload a base64 screenshot to Convex file storage and link it to the session.
 */
async function persistScreenshot(
  sessionId: string,
  base64Screenshot: string,
): Promise<void> {
  if (!convex) return;

  // Get an upload URL from Convex
  const uploadUrl = await convex.mutation(api.screenshots.generateUploadUrl);

  // Convert base64 to binary and upload
  const binaryData = Buffer.from(base64Screenshot, "base64");
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: binaryData,
  });

  if (!uploadRes.ok) {
    throw new Error(`Screenshot upload failed: ${uploadRes.statusText}`);
  }

  const { storageId } = (await uploadRes.json()) as { storageId: string };

  // Link the uploaded file to the session
  await convex.mutation(api.screenshots.linkToSession, {
    browserbaseSessionId: sessionId,
    storageId: storageId as never, // Convex ID type from string
  });
}
