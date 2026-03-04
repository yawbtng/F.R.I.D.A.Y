import { NextRequest } from 'next/server';
import { Stagehand } from '@browserbasehq/stagehand';
import { SessionCreateSchema } from '@/lib/schemas';
import { createSessionToken } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip)) {
    return Response.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const body = await req.json();
  const parsed = SessionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' }, { status: 400 });
  }

  try {
    if (parsed.data.action === 'create') {
      const stagehand = new Stagehand({
        env: "BROWSERBASE",
        apiKey: process.env.BROWSERBASE_API_KEY!,
        projectId: process.env.BROWSERBASE_PROJECT_ID!,
        keepAlive: true,
      });
      await stagehand.init();
      const sessionId = stagehand.browserbaseSessionID!;

      // Fetch debug URL
      const debugRes = await fetch(
        `https://api.browserbase.com/v1/sessions/${sessionId}/debug`,
        { headers: { 'x-bb-api-key': process.env.BROWSERBASE_API_KEY! } }
      );
      const { debuggerFullscreenUrl } = await debugRes.json();

      const token = await createSessionToken(sessionId);

      await stagehand.close(); // keepAlive means session stays alive

      return Response.json({
        sessionId,
        debugUrl: debuggerFullscreenUrl,
        status: 'created',
        token,
      });
    }

    // Resume existing session
    const sessionId = parsed.data.sessionId!;
    const token = await createSessionToken(sessionId);
    return Response.json({ sessionId, status: 'resumed', token });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message, code: 'STAGEHAND_ERROR' }, { status: 500 });
  }
}
