"use client";

// The orchestrator: composes use-voice (transport) + use-swarm (engine) and owns the tool
// dispatch table + plan state. This is the single seam the unified command-center consumes,
// so page components stay thin. Voice tool calls flow in here; swarm state flows back out.

import { useCallback, useEffect, useRef, useState } from "react";
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

  // Shared planning path — used by both the planTask voice tool and the manual text box (DRY).
  const planFromTask = useCallback(async (task: string) => {
    const res = await fetch("/api/swarm/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "planning failed");
    const targets = planToTargets((data.targets ?? []) as PlanTarget[]);
    setPlan(targets);
    const title = typeof data.title === "string" ? data.title : "";
    setPlanTitle(title);
    setPlanNotes(Array.isArray(data.planNotes) ? (data.planNotes as string[]) : []);
    return { title, targets };
  }, []);

  const dispatch = useCallback(async (toolName: string, args: unknown) => {
    const s = swarmRef.current;
    switch (toolName) {
      case "planTask": {
        const { task } = (args ?? {}) as { task?: string };
        if (!task) return { error: "no task provided" };
        try {
          const { title, targets } = await planFromTask(task);
          return planSummary(title, targets);
        } catch (e) {
          return { error: e instanceof Error ? e.message : "planning failed" };
        }
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
  }, [planFromTask]);

  const voice = useVoice({ instructions: FRIDAY_INSTRUCTIONS, onToolCall: dispatch });

  // M3 progress bridge: narrate the run as tiles come back. Coalesced (~every 6s, only on real
  // progress) and turn-aware (never while the user is speaking) so it doesn't spam or talk over
  // them. Injects short [status] notes the persona knows to narrate. The swarm and voice sessions
  // share this browser, so no server polling is needed — this reads live state directly.
  // NOTE: the exact conversational feel (interruption, cadence) needs live tuning with a mic.
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const lastSettledRef = useRef(0);
  const lastAnnounceRef = useRef(0);
  const doneAnnouncedRef = useRef(false);

  useEffect(() => {
    if (voice.status !== "connected") return;
    const tiles = swarm.tiles;

    if (swarm.phase === "idle" || swarm.phase === "spawning") {
      lastSettledRef.current = 0;
      lastAnnounceRef.current = 0;
      doneAnnouncedRef.current = false;
      return;
    }
    if (tiles.length === 0) return;

    const settled = tiles.filter((t) => t.status !== "idle" && t.status !== "working").length;

    if (swarm.phase === "running") {
      const now = Date.now();
      const progressed = settled > lastSettledRef.current;
      const enoughTimePassed = now - lastAnnounceRef.current > 6000;
      const userQuiet = voice.voiceState !== "listening";
      if (progressed && enoughTimePassed && userQuiet) {
        lastSettledRef.current = settled;
        lastAnnounceRef.current = now;
        const blocked = tiles.filter((t) => t.status === "blocked").map((t) => t.label);
        voiceRef.current.sendTextMessage(
          `[status] ${settled} of ${tiles.length} done so far${
            blocked.length ? `; blocked: ${blocked.join(", ")}` : ""
          }.`,
        );
      }
    } else if (swarm.phase === "done" && !doneAnnouncedRef.current) {
      doneAnnouncedRef.current = true;
      const resolved = tiles.filter((t) => ["done", "active", "inactive"].includes(t.status)).length;
      voiceRef.current.sendTextMessage(
        `[status] Swarm finished: ${resolved} of ${tiles.length} resolved. Summarize the findings for the user.`,
      );
    }
  }, [swarm.tiles, swarm.phase, voice.status, voice.voiceState]);

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
    setPlan,
    manualPlan: planFromTask,
    planTitle,
    planNotes,
    focusedId,
    setFocusedId,
    resetAll,
  };
}
