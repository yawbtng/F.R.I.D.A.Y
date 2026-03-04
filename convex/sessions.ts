import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    browserbaseSessionId: v.string(),
    livekitRoomName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessions", {
      ...args,
      status: "active",
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("sessions"),
    status: v.optional(
      v.union(v.literal("active"), v.literal("idle"), v.literal("error"))
    ),
    currentUrl: v.optional(v.string()),
    lastScreenshot: v.optional(v.id("_storage")),
    title: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const updates: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) {
        updates[key] = val;
      }
    }
    await ctx.db.patch(id, { ...updates, lastActiveAt: Date.now() });
  },
});

export const updateScreenshot = mutation({
  args: {
    browserbaseSessionId: v.string(),
    lastScreenshot: v.id("_storage"),
  },
  handler: async (ctx, { browserbaseSessionId, lastScreenshot }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_browserbase_id", (q) =>
        q.eq("browserbaseSessionId", browserbaseSessionId)
      )
      .first();
    if (session) {
      await ctx.db.patch(session._id, {
        lastScreenshot,
        lastActiveAt: Date.now(),
      });
    }
  },
});

export const list = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_last_active")
      .order("desc")
      .take(20);
  },
});

export const getByBrowserbaseId = query({
  args: { browserbaseSessionId: v.string() },
  handler: async (ctx, { browserbaseSessionId }) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_browserbase_id", (q) =>
        q.eq("browserbaseSessionId", browserbaseSessionId)
      )
      .first();
  },
});
