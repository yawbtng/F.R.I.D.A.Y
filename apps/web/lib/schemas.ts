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
  stealth: z.boolean().optional(),
});

export const FleetCloseSchema = z.object({
  sessionId: z.string().min(1),
});

// Autonomous agent run on a session (Stagehand agent.execute). Optionally navigate
// to startUrl first, then run the agent toward `instruction`.
export const AgentSchema = z.object({
  sessionId: z.string().min(1),
  instruction: z.string().min(1, "Instruction cannot be empty"),
  startUrl: z.string().url("startUrl must be a valid URL").optional(),
  maxSteps: z.number().int().min(1).max(50).optional(),
});

// Planner: a free-form task the LLM turns into a list of swarm targets.
export const PlanRequestSchema = z.object({
  task: z.string().min(1, "Task cannot be empty").max(2000),
});

// One planned target. `startUrl` is intentionally NOT z.url() — the LLM occasionally
// emits a bare domain or a stray value, and one bad URL must not fail the whole plan;
// the client validates/cleans it. Cap targets at the Developer-tier concurrency limit.
export const PlanTargetSchema = z.object({
  label: z.string().min(1),
  startUrl: z.string().optional(),
  query: z.string().optional(),
  goal: z.string().min(1),
  extract: z.string().min(1),
  engine: z.enum(["stagehand", "bb-agent"]).optional(),
});

export const PlanOutputSchema = z.object({
  title: z.string(),
  targets: z.array(PlanTargetSchema).min(1).max(25),
});

export type PlanTarget = z.infer<typeof PlanTargetSchema>;
export type PlanOutput = z.infer<typeof PlanOutputSchema>;
