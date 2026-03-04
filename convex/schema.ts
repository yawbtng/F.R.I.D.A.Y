import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  sessions: defineTable({
    browserbaseSessionId: v.string(),
    livekitRoomName: v.optional(v.string()),
    title: v.optional(v.string()),
    status: v.union(
      v.literal('active'),
      v.literal('idle'),
      v.literal('error'),
    ),
    currentUrl: v.optional(v.string()),
    lastScreenshot: v.optional(v.id('_storage')),
    createdAt: v.number(),
    lastActiveAt: v.number(),
  })
    .index('by_last_active', ['lastActiveAt'])
    .index('by_browserbase_id', ['browserbaseSessionId']),

  commands: defineTable({
    sessionId: v.id('sessions'),
    input: v.string(),
    result: v.optional(v.string()),
    screenshotId: v.optional(v.id('_storage')),
    toolsUsed: v.optional(v.array(v.string())),
    status: v.union(
      v.literal('pending'),
      v.literal('running'),
      v.literal('done'),
      v.literal('error'),
    ),
    errorMessage: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    createdAt: v.number(),
  }).index('by_session', ['sessionId', 'createdAt']),
});
