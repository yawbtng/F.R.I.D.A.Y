import { z } from "zod";

export const SessionCreateSchema = z
  .object({
    action: z.enum(["create", "resume"]),
    sessionId: z.string().min(1).optional(),
  })
  .refine((d) => d.action !== "resume" || d.sessionId, {
    message: "sessionId required for resume",
  });

export const NavigateSchema = z.object({
  sessionId: z.string().min(1),
  url: z.string().url("Must be a valid URL"),
});

export const ActSchema = z.object({
  sessionId: z.string().min(1),
  instruction: z.string().min(1, "Instruction cannot be empty"),
});

export const ExtractSchema = z.object({
  sessionId: z.string().min(1),
  instruction: z.string().min(1, "Instruction cannot be empty"),
});

export const ObserveSchema = z.object({
  sessionId: z.string().min(1),
  instruction: z.string().min(1),
});

export const SearchSchema = z.object({
  sessionId: z.string().min(1),
  query: z.string().min(1, "Search query cannot be empty"),
});

export const ScreenshotSchema = z.object({
  sessionId: z.string().min(1),
});

// Fleet: spawn N browsers for a swarm run. Cap at the Developer-tier concurrency limit.
export const FleetSpawnSchema = z.object({
  count: z.number().int().min(1).max(25),
});

export const FleetCloseSchema = z.object({
  sessionId: z.string().min(1),
});
