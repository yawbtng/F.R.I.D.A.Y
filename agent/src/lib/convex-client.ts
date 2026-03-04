// Convex HTTP client for persisting sessions and commands
// TODO: Phase 3 — implement once convex/sessions.ts and convex/commands.ts are done

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

export async function saveCommand(_args: {
  sessionId: string;
  input: string;
  result?: string;
  toolsUsed?: string[];
  status: 'pending' | 'running' | 'done' | 'error';
}): Promise<void> {
  if (!CONVEX_URL) return; // Skip if Convex not configured
  // TODO: Implement with ConvexHttpClient
}

export async function updateSessionScreenshot(
  _sessionId: string,
  _screenshotFileId: string,
): Promise<void> {
  if (!CONVEX_URL) return;
  // TODO: Implement with ConvexHttpClient
}
