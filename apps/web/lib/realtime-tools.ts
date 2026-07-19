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
      "Plan a browser swarm to look something up on the live web. Turns ANY request OR question that needs real/current information — 'verify these 15 businesses are real', 'what games are on this week', 'compare the price of X across these stores' — into a list of targets, one per cloud browser. Call this instead of answering from your own knowledge; call it as soon as the user asks something you'd need the web to answer.",
    inputSchema: z.object({
      task: z
        .string()
        .describe("The user's task in natural language, verbatim or lightly cleaned up."),
    }),
  }),

  updatePlan: tool({
    description:
      "Edit the current plan BEFORE the swarm launches: add, remove, reorder, or rewrite targets ('drop Walmart', 'add Costco', 'check its license status too'). Once the swarm is running, changing one target is retargetTile's job, not this — updatePlan cannot touch live browsers.",
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

  retargetTile: tool({
    description:
      "Redirect ONE browser to a different target WITHOUT restarting the swarm — call when the user changes their mind about a single target ('actually, check Costco instead of Walmart', 'have the Texas one look up the LLC filing instead'). The other browsers keep working; only that slot gets a fresh browser pointed at the new thing. Returns immediately — you'll get a [status] note when the redirected browser settles.",
    inputSchema: z.object({
      idOrLabel: z
        .string()
        .describe("Which existing target to replace, by id or display label, e.g. 'Walmart'."),
      label: z.string().nullable().describe("New display name, e.g. 'Costco'; null to keep."),
      goal: z
        .string()
        .nullable()
        .describe("New instruction for that browser's page; null to keep the old goal."),
      extract: z
        .string()
        .nullable()
        .describe("New one-question extraction; null to keep the old one."),
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
