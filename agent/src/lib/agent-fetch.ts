// Shared fetch utility for agent → Next.js API calls.
//
// Stateless + context-driven: every call carries its own session, token, and
// (optional) abort signal. There is NO module-global AbortController, so N parallel
// swarm workers never cancel each other. "Interrupt" is expressed by aborting the
// caller's own controller(s) — e.g. the orchestrator aborts the whole fleet.
//
// Handles: auth (per-call JWT), timeout (default 30s), abort (per-call signal).

import type { voice } from '@livekit/agents';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Per-worker handle: which browser session to drive, its auth token, and an optional
 * external abort signal (fleet-wide interrupt or voice barge-in). Combined with the
 * per-call timeout so a slow request still resolves or fails on its own clock.
 */
export interface AgentContext {
  sessionId: string;
  token: string;
  signal?: AbortSignal;
}

interface AgentFetchOptions {
  path: string;
  body: Record<string, unknown>;
  ctx: AgentContext;
  timeoutMs?: number;
  retryCount?: number;
}

export async function agentFetch<T>(opts: AgentFetchOptions): Promise<T> {
  const { path, body, ctx, timeoutMs = 30_000, retryCount = 0 } = opts;
  if (retryCount >= 2) throw new Error('Operation failed after 2 retries. Try a different approach.');

  // Per-call abort: own timeout, optionally combined with the caller's signal.
  // No shared state — concurrent calls are fully independent.
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = ctx.signal ? AbortSignal.any([ctx.signal, timeout]) : timeout;

  try {
    const res = await fetch(`${APP_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ctx.token}`,
      },
      body: JSON.stringify({ sessionId: ctx.sessionId, ...body }),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error((err as { error: string }).error || `HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err: unknown) {
    if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      throw new Error('Operation cancelled — interrupted or timed out.');
    }
    throw err;
  }
}

export async function agentFetchWithHeartbeat<T>(
  opts: AgentFetchOptions,
  session: voice.AgentSession,
): Promise<T> {
  // TODO(phase-3): under gpt-realtime, swap session.say() for session.generateReply().
  const heartbeat = setTimeout(() => {
    session.say('Still working on it...', { allowInterruptions: true });
  }, 5_000);
  try {
    return await agentFetch<T>(opts);
  } finally {
    clearTimeout(heartbeat);
  }
}
