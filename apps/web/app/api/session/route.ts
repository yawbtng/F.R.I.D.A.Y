import { NextRequest } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { SessionCreateSchema } from '@/lib/schemas';
import { createSessionToken } from '@/lib/api-auth';
import { createBrowserSession } from '@/lib/browserbase';
import { rateLimit } from '@/lib/rate-limit';
import { api } from '../../../../../convex/_generated/api';

export const maxDuration = 60;

const convex = process.env.NEXT_PUBLIC_CONVEX_URL
  ? new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL)
  : null;

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
      const { sessionId, liveViewUrl, token } = await createBrowserSession();

      // Persist session to Convex (fire-and-forget, non-blocking)
      if (convex) {
        convex
          .mutation(api.sessions.create, { browserbaseSessionId: sessionId })
          .catch((err: unknown) => {
            console.error('[convex] Failed to save session:', err);
          });
      }

      return Response.json({
        sessionId,
        debugUrl: liveViewUrl,
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
