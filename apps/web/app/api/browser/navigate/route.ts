import { NextRequest } from "next/server";
import { NavigateSchema } from "@/lib/schemas";
import { validateAgentRequest } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { getStagehand, updateCache } from "@/lib/stagehand";
import { compressScreenshot } from "@/lib/screenshot";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(ip)) {
    return Response.json(
      { error: "Too many requests", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  const body = await req.json();
  const parsed = NavigateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message, code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  if (!(await validateAgentRequest(req, parsed.data.sessionId))) {
    return Response.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const stagehand = await getStagehand(parsed.data.sessionId);
    const page = stagehand.context.activePage()!;
    await page.goto(parsed.data.url);
    const title = await page.title();
    const currentUrl = page.url();
    const screenshot = await compressScreenshot(stagehand);
    updateCache(parsed.data.sessionId, currentUrl, screenshot);
    return Response.json({ currentUrl, title, screenshot });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { error: message, code: "STAGEHAND_ERROR" },
      { status: 500 }
    );
  }
}
