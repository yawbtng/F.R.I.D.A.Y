// Convex HTTP client for persisting sessions and commands from the agent worker.
// Uses ConvexHttpClient (server-side) since the agent runs outside Next.js.

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const CONVEX_URL = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;

function getClient(): ConvexHttpClient | null {
  if (!CONVEX_URL) return null;
  return new ConvexHttpClient(CONVEX_URL);
}

/**
 * Add a new command record for a session.
 * Returns the Convex command ID, or null if Convex is not configured.
 */
export async function addCommand(args: {
  sessionId: Id<"sessions">;
  input: string;
}): Promise<Id<"commands"> | null> {
  const client = getClient();
  if (!client) return null;
  try {
    return await client.mutation(api.commands.add, args);
  } catch (err) {
    console.error("[convex] Failed to add command:", err);
    return null;
  }
}

/**
 * Update an existing command's status, result, tools, or error.
 */
export async function updateCommand(args: {
  id: Id<"commands">;
  status?: "pending" | "running" | "done" | "error";
  result?: string;
  screenshotId?: Id<"_storage">;
  toolsUsed?: string[];
  errorMessage?: string;
  durationMs?: number;
}): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    await client.mutation(api.commands.update, args);
  } catch (err) {
    console.error("[convex] Failed to update command:", err);
  }
}

/**
 * Save a command in one call (add + mark done). Convenience wrapper for simple cases.
 */
export async function saveCommand(args: {
  sessionId: Id<"sessions">;
  input: string;
  result?: string;
  toolsUsed?: string[];
  status: "pending" | "running" | "done" | "error";
}): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    const commandId = await client.mutation(api.commands.add, {
      sessionId: args.sessionId,
      input: args.input,
    });
    await client.mutation(api.commands.update, {
      id: commandId,
      status: args.status,
      result: args.result,
      toolsUsed: args.toolsUsed,
    });
  } catch (err) {
    console.error("[convex] Failed to save command:", err);
  }
}

/**
 * Update a session's screenshot reference in Convex.
 */
export async function updateSessionScreenshot(
  browserbaseSessionId: string,
  lastScreenshot: Id<"_storage">,
): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    await client.mutation(api.sessions.updateScreenshot, {
      browserbaseSessionId,
      lastScreenshot,
    });
  } catch (err) {
    console.error("[convex] Failed to update session screenshot:", err);
  }
}
