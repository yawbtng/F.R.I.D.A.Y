// Tool SCHEMAS the realtime voice agent (F.R.I.D.A.Y) can call. These are declared
// server-side and sent to the model at session setup (see /api/realtime/token), but they
// are EXECUTED in the browser — the swarm is client-driven, so use-friday's onToolCall
// dispatch (Phase B M2) runs them against the use-swarm engine. Hence NO `execute` here.
//
// Optional fields are `.nullable()` (not `.optional()`): OpenAI realtime function-calling
// is happiest when every property is present, matching the Phase A strict-schema lesson.

import { tool } from "ai";
import { z } from "zod";

export const realtimeTools = {
  planTask: tool({
    description:
      "Plan a browser swarm for the user's task. Turns a free-form request (e.g. 'verify these 15 businesses are real and active') into a list of targets, one per cloud browser. Call this as soon as the user describes what they want done.",
    inputSchema: z.object({
      task: z
        .string()
        .describe("The user's task in natural language, verbatim or lightly cleaned up."),
    }),
  }),

  updatePlan: tool({
    description:
      "Edit the current plan before running: add, remove, reorder, or rewrite targets. Call whenever the user asks to change the plan by voice ('drop Walmart', 'add Costco', 'check its license status too').",
    inputSchema: z.object({
      operations: z
        .array(
          z.object({
            op: z.enum(["add", "remove", "reorder", "modify"]),
            targetId: z
              .string()
              .nullable()
              .describe("Which target to remove/modify/reorder; null when adding."),
            label: z.string().nullable().describe("Target display name (for add/modify)."),
            goal: z.string().nullable().describe("Agent instruction for the page (add/modify)."),
            extract: z
              .string()
              .nullable()
              .describe("The one question to read off the page (add/modify)."),
            toIndex: z.number().nullable().describe("New position, for reorder."),
          }),
        )
        .describe("Ordered list of edits to apply to the plan."),
    }),
  }),

  runSwarm: tool({
    description:
      "Launch the browser swarm on the current plan. Only call AFTER stating what you'll do and getting the user's go-ahead. Returns immediately with a runId; you narrate progress as tiles come back.",
    inputSchema: z.object({
      stealth: z
        .boolean()
        .nullable()
        .describe("Use stealth proxies (slower, harder to block). Default false."),
    }),
  }),

  getReport: tool({
    description:
      "Get the structured results after the swarm finishes, so you can discuss findings and answer questions about them.",
    inputSchema: z.object({}),
  }),

  stopSwarm: tool({
    description:
      "Immediately stop the running swarm and release all browsers. Call if the user says stop, cancel, or halt.",
    inputSchema: z.object({}),
  }),

  focusTile: tool({
    description:
      "Open the live browser view for one target so the user can watch it. Call when the user says 'show me X' or 'pull up the Acme one'.",
    inputSchema: z.object({
      idOrLabel: z.string().describe("The target id or label to focus, e.g. 'Acme Corp'."),
    }),
  }),

  renderDiagram: tool({
    description:
      "Draw a diagram in the report when a picture makes the findings clearer — how the swarm fanned out across targets, how results relate, a breakdown, or a flow. YOU write the Mermaid source and pick the diagram type that fits the task. Call after a run when a visual would help, or when the user asks to diagram / visualize / chart something. Don't diagram a plain short list.",
    inputSchema: z.object({
      title: z.string().describe("Short title for the diagram."),
      mermaid: z
        .string()
        .describe(
          "Valid Mermaid v11 source. First line is the directive (e.g. 'flowchart LR'). Put node text in double quotes, keep labels short, use simple ids (n1, n2), and never put parentheses/brackets/quotes inside a label — so it parses.",
        ),
    }),
  }),
};

/** The tool names the client dispatch table must handle. */
export type RealtimeToolName = keyof typeof realtimeTools;
