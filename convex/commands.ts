import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const add = mutation({
  args: {
    sessionId: v.id("sessions"),
    input: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("commands", {
      ...args,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("commands"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("done"),
        v.literal("error")
      )
    ),
    result: v.optional(v.string()),
    screenshotId: v.optional(v.id("_storage")),
    toolsUsed: v.optional(v.array(v.string())),
    errorMessage: v.optional(v.string()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const updates: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) {
        updates[key] = val;
      }
    }
    await ctx.db.patch(id, updates);
  },
});

export const listBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query("commands")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .order("desc")
      .take(50);
  },
});
