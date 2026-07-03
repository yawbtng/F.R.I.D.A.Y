import { describe, it, expect } from "vitest";
import {
  applyPlanOps,
  planSummary,
  reportSummary,
  type PlanOp,
} from "../../apps/web/lib/friday-tools";
import type { SwarmTarget } from "../../apps/web/lib/swarm-target";

// Build a full PlanOp from a partial (fields are nullable, not optional).
const op = (o: Partial<PlanOp> & { op: PlanOp["op"] }): PlanOp => ({
  op: o.op,
  targetId: o.targetId ?? null,
  label: o.label ?? null,
  goal: o.goal ?? null,
  extract: o.extract ?? null,
  toIndex: o.toIndex ?? null,
});

const base: SwarmTarget[] = [
  { id: "t0-acme", label: "Acme", goal: "g0", extract: "e0" },
  { id: "t1-globex", label: "Globex", goal: "g1", extract: "e1" },
];

describe("applyPlanOps", () => {
  it("adds a target with sensible defaults", () => {
    const r = applyPlanOps(base, [op({ op: "add", label: "Initech" })]);
    expect(r).toHaveLength(3);
    expect(r[2].label).toBe("Initech");
    expect(r[2].goal).toContain("Initech");
  });

  it("removes by label or by id", () => {
    expect(applyPlanOps(base, [op({ op: "remove", targetId: "Acme" })])).toHaveLength(1);
    expect(applyPlanOps(base, [op({ op: "remove", targetId: "t1-globex" })])[0].label).toBe("Acme");
  });

  it("modifies only the referenced fields", () => {
    const r = applyPlanOps(base, [op({ op: "modify", targetId: "t0-acme", goal: "newgoal" })]);
    expect(r[0].goal).toBe("newgoal");
    expect(r[0].label).toBe("Acme");
  });

  it("reorders by moving a target to an index", () => {
    const r = applyPlanOps(base, [op({ op: "reorder", targetId: "Globex", toIndex: 0 })]);
    expect(r[0].label).toBe("Globex");
  });

  it("ignores unknown references", () => {
    expect(applyPlanOps(base, [op({ op: "remove", targetId: "Nope" })])).toHaveLength(2);
  });

  it("applies a batch of ops in order", () => {
    const r = applyPlanOps(base, [
      op({ op: "add", label: "Initech" }),
      op({ op: "remove", targetId: "Acme" }),
    ]);
    expect(r.map((t) => t.label)).toEqual(["Globex", "Initech"]);
  });
});

describe("summaries", () => {
  it("planSummary reports count + title", () => {
    const s = planSummary("My Plan", base);
    expect(s.count).toBe(2);
    expect(s.title).toBe("My Plan");
    expect(s.targets[0].label).toBe("Acme");
  });

  it("reportSummary buckets statuses (resolved = done/active/inactive)", () => {
    const s = reportSummary("done", [
      { label: "A", status: "active" },
      { label: "B", status: "blocked" },
      { label: "C", status: "notfound" },
      { label: "D", status: "done" },
    ]);
    expect(s.total).toBe(4);
    expect(s.resolved).toBe(2);
    expect(s.blocked).toBe(1);
    expect(s.notfound).toBe(1);
  });
});
