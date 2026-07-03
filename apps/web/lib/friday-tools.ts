// Pure helpers behind the voice agent's tool dispatch. Kept side-effect-free so they're unit-
// testable (the hook, use-friday, wires them to state + the swarm engine). Mirrors the tool
// schemas in realtime-tools.ts.

import type { SwarmTarget } from "./swarm-target";

/** One conversational plan edit (from the updatePlan tool). Nullable, not optional, to match
 *  the realtime strict-schema convention. */
export interface PlanOp {
  op: "add" | "remove" | "reorder" | "modify";
  targetId: string | null;
  label: string | null;
  goal: string | null;
  extract: string | null;
  toIndex: number | null;
}

const slugId = (label: string, seed: number) =>
  `t-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "target"}-${seed}`;

/** True when an op references this target by its id OR its display label (voice users say the
 *  label, not the slug). */
const matches = (t: SwarmTarget, ref: string | null) =>
  ref != null && (t.id === ref || t.label.toLowerCase() === ref.toLowerCase());

/** Apply a batch of plan edits, returning a new target list. Unknown refs are no-ops. */
export function applyPlanOps(targets: SwarmTarget[], ops: PlanOp[]): SwarmTarget[] {
  let next = [...targets];
  let seed = next.length;
  for (const op of ops) {
    if (op.op === "add") {
      if (!op.label) continue;
      next.push({
        id: slugId(op.label, seed++),
        label: op.label,
        query: op.label,
        goal: op.goal ?? `Find the official record for ${op.label} and confirm it exists.`,
        extract: op.extract ?? "Report the key status or value for this target.",
      });
    } else if (op.op === "remove") {
      next = next.filter((t) => !matches(t, op.targetId));
    } else if (op.op === "modify") {
      next = next.map((t) =>
        matches(t, op.targetId)
          ? {
              ...t,
              label: op.label ?? t.label,
              goal: op.goal ?? t.goal,
              extract: op.extract ?? t.extract,
            }
          : t,
      );
    } else if (op.op === "reorder") {
      const from = next.findIndex((t) => matches(t, op.targetId));
      if (from >= 0 && op.toIndex != null) {
        const [moved] = next.splice(from, 1);
        next.splice(Math.max(0, Math.min(op.toIndex, next.length)), 0, moved);
      }
    }
  }
  return next;
}

/** Compact plan description the agent speaks after planTask / updatePlan. */
export function planSummary(title: string, targets: SwarmTarget[]) {
  return {
    title,
    count: targets.length,
    targets: targets.map((t) => ({ id: t.id, label: t.label, goal: t.goal, extract: t.extract })),
  };
}

const RESOLVED = ["done", "active", "inactive"];

/** Compact results description the agent speaks after getReport. */
export function reportSummary(
  phase: string,
  tiles: { label: string; status: string; result?: string }[],
) {
  const count = (s: string) => tiles.filter((t) => t.status === s).length;
  return {
    phase,
    total: tiles.length,
    resolved: tiles.filter((t) => RESOLVED.includes(t.status)).length,
    blocked: count("blocked"),
    notfound: count("notfound"),
    error: count("error"),
    results: tiles.map((t) => ({ label: t.label, status: t.status, result: t.result ?? "" })),
  };
}
