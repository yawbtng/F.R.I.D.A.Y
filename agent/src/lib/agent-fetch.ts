// Shared fetch utility for agent → Next.js API calls
// Handles: auth (JWT), abort (interrupt & pivot), timeout (10s), retries (max 2)

import type { voice } from '@livekit/agents';

let sessionToken = '';
let currentAbortController: AbortController | null = null;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface AgentFetchOptions {
  path: string;
  body: Record<string, unknown>;
  sessionId: string;
  timeoutMs?: number;
  retryCount?: number;
}

export async function agentFetch<T>(opts: AgentFetchOptions): Promise<T> {
  const { path, body, sessionId, timeoutMs = 10_000, retryCount = 0 } = opts;
  if (retryCount >= 2) throw new Error('Operation failed after 2 retries. Try a different approach.');

  currentAbortController?.abort();
  currentAbortController = new AbortController();
  const timeoutId = setTimeout(() => currentAbortController?.abort(), timeoutMs);

  try {
    const res = await fetch(`${APP_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ sessionId, ...body }),
      signal: currentAbortController.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error((err as { error: string }).error || `HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Operation cancelled — new command received or timeout.');
    }
    throw err;
  }
}

export async function agentFetchWithHeartbeat<T>(
  opts: AgentFetchOptions,
  session: voice.AgentSession,
): Promise<T> {
  const heartbeat = setTimeout(() => {
    session.say('Still working on it...', { allowInterruptions: true });
  }, 5_000);
  try {
    return await agentFetch<T>(opts);
  } finally {
    clearTimeout(heartbeat);
  }
}

export function setSessionToken(token: string): void {
  sessionToken = token;
}
