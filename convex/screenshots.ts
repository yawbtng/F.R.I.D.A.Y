import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Generate an upload URL for storing a screenshot in Convex file storage.
 */
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Get a URL to access a stored screenshot by its storage ID.
 */
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});

/**
 * Save a screenshot: upload was done client-side, now link it to the session.
 */
export const linkToSession = mutation({
  args: {
    browserbaseSessionId: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { browserbaseSessionId, storageId }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_browserbase_id", (q) =>
        q.eq("browserbaseSessionId", browserbaseSessionId),
      )
      .first();
    if (session) {
      await ctx.db.patch(session._id, {
        lastScreenshot: storageId,
        lastActiveAt: Date.now(),
      });
    }
    return storageId;
  },
});
