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

// One planned target. Shaped for OpenAI STRICT structured outputs: every field must be
// present in `required`, so "optional" fields are required-but-nullable (not .optional()),
// and unsupported keywords (minLength / minItems) are omitted — count clamping + empty
// filtering happen in code. `startUrl` is a plain string (not z.url()): the LLM sometimes
// emits a bare domain, and one bad URL must not fail the whole plan; the worker cleans it.
export const PlanTargetSchema = z.object({
  label: z.string(),
  startUrl: z.string().nullable(),
  query: z.string().nullable(),
  goal: z.string(),
  extract: z.string(),
  engine: z.enum(["stagehand", "bb-agent"]).nullable(),
});

export const PlanOutputSchema = z.object({
  title: z.string(),
  targets: z.array(PlanTargetSchema),
});

export type PlanTarget = z.infer<typeof PlanTargetSchema>;
export type PlanOutput = z.infer<typeof PlanOutputSchema>;

// Critic/refine pass output = the same plan shape plus `planNotes`: 1-4 short strings
// describing what the adversarial reviewer tightened (empty if the draft was already good).
// Strict-mode safe: every field required; target fields stay nullable-not-optional via
// PlanTargetSchema. `planNotes` is a required array (no minItems — an empty array is valid).
export const PlanRefineOutputSchema = z.object({
  title: z.string(),
  targets: z.array(PlanTargetSchema),
  planNotes: z.array(z.string()),
});

export type PlanRefined = z.infer<typeof PlanRefineOutputSchema>;

// Structured report narrative (strict-mode safe: all fields required). The per-target rows
// come from the swarm's own data client-side; the LLM only writes the synthesis prose.
export const SummaryOutputSchema = z.object({
  headline: z.string(),
  takeaway: z.string(),
  notes: z.array(z.string()),
});

export type SummaryOutput = z.infer<typeof SummaryOutputSchema>;
