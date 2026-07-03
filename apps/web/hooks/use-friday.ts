"use client";

// The orchestrator: composes use-voice (transport) + use-swarm (engine) and owns the tool
// dispatch table + plan state. This is the single seam the unified command-center consumes,
// so page components stay thin. Voice tool calls flow in here; swarm state flows back out.

import { useCallback, useRef, useState } from "react";
import { useVoice } from "./use-voice";
import { useSwarm } from "./use-swarm";
import { planToTargets, type SwarmTarget } from "@/lib/swarm-target";
import type { PlanTarget } from "@/lib/schemas";
import { applyPlanOps, planSummary, reportSummary, type PlanOp } from "@/lib/friday-tools";
import { FRIDAY_INSTRUCTIONS } from "@/lib/friday-persona";

export function useFriday() {
  const swarm = useSwarm();
  const [plan, setPlan] = useState<SwarmTarget[]>([]);
  const [planTitle, setPlanTitle] = useState("");
  const [planNotes, setPlanNotes] = useState<string[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // Refs so the (stable) dispatch always reads current state without re-subscribing the
  // realtime session on every render.
  const swarmRef = useRef(swarm);
  swarmRef.current = swarm;
  const planRef = useRef<SwarmTarget[]>(plan);
  planRef.current = plan;
  const titleRef = useRef("");
  titleRef.current = planTitle;
  const runSeq = useRef(0);

  const dispatch = useCallback(async (toolName: string, args: unknown) => {
    const s = swarmRef.current;
    switch (toolName) {
      case "planTask": {
        const { task } = (args ?? {}) as { task?: string };
        if (!task) return { error: "no task provided" };
        const res = await fetch("/api/swarm/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error || "planning failed" };
        const targets = planToTargets((data.targets ?? []) as PlanTarget[]);
        setPlan(targets);
        setPlanTitle(data.title ?? "");
        setPlanNotes(Array.isArray(data.planNotes) ? data.planNotes : []);
        return planSummary(data.title ?? "", targets);
      }

      case "updatePlan": {
        const { operations } = (args ?? {}) as { operations?: PlanOp[] };
        const next = applyPlanOps(planRef.current, operations ?? []);
        setPlan(next);
        return planSummary(titleRef.current, next);
      }

      case "runSwarm": {
        const { stealth } = (args ?? {}) as { stealth?: boolean | null };
        if (planRef.current.length === 0) return { error: "no plan yet — call planTask first" };
        runSeq.current += 1;
        const runId = `run-${runSeq.current}`;
        // Fire and DO NOT await — a realtime tool call must return in seconds while the run
        // takes minutes. Progress is narrated separately (M3 event bridge).
        void s.run(planRef.current, { stealth: stealth ?? false, task: titleRef.current });
        return { runId, count: planRef.current.length, message: "swarm launched" };
      }

      case "getReport":
        return reportSummary(
          s.phase,
          s.tiles.map((t) => ({ label: t.label, status: t.status, result: t.result })),
        );

      case "stopSwarm":
        s.cancel();
        return { stopped: true };

      case "focusTile": {
        const { idOrLabel } = (args ?? {}) as { idOrLabel?: string };
        if (!idOrLabel) return { error: "no target specified" };
        const tile = s.tiles.find(
          (t) => t.id === idOrLabel || t.label.toLowerCase() === idOrLabel.toLowerCase(),
        );
        if (!tile) return { error: `no target named ${idOrLabel}` };
        setFocusedId(tile.id);
        return { focused: tile.label };
      }

      // Report visuals land in M5; acknowledge so the agent doesn't stall.
      case "chartFromData":
      case "mermaidDiagram":
        return { status: "queued", note: "renders into the report artifact" };

      default:
        return { error: `unknown tool ${toolName}` };
    }
  }, []);

  const voice = useVoice({ instructions: FRIDAY_INSTRUCTIONS, onToolCall: dispatch });

  const resetAll = useCallback(() => {
    swarmRef.current.reset();
    setPlan([]);
    setPlanTitle("");
    setPlanNotes([]);
    setFocusedId(null);
  }, []);

  return {
    ...swarm,
    voice,
    plan,
    planTitle,
    planNotes,
    focusedId,
    setFocusedId,
    resetAll,
  };
}
