"use client";

// The orchestrator: composes use-voice (transport) + use-swarm (engine) and owns the tool
// dispatch table + plan state. This is the single seam the unified command-center consumes,
// so page components stay thin. Voice tool calls flow in here; swarm state flows back out.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { useVoice } from "./use-voice";
import { useSwarm } from "./use-swarm";
import { planToTargets, type SwarmTarget } from "@/lib/swarm-target";
import type { PlanTarget } from "@/lib/schemas";
import { applyPlanOps, planSummary, reportSummary, type PlanOp } from "@/lib/friday-tools";
import { buildFridayInstructions } from "@/lib/friday-persona";

/** A streamed agent action shown as a pill in the mission log (planning, running browsers,
 *  checking results, updates) — the visible trace of what the swarm is DOING, distinct from
 *  the spoken conversation. Derived from swarm state so it's exact, not parsed from prose. */
export interface ActionEvent {
  id: string;
  ts: number;
  label: string;
  tone: "plan" | "run" | "check" | "done";
}

/** A conversation turn carrying the moment it first appeared. The realtime UIMessages have no
 *  reliable createdAt, and the mission log has to interleave them with action pills by time, so
 *  we stamp each id here — in the always-mounted hook, next to the pills whose `ts` it's sorted
 *  against. The panel that renders the merge is conditionally mounted (Hide mission log), so a
 *  stamp kept there would be lost on every toggle and re-date the whole backlog to "now". */
export type StampedMessage = UIMessage & { firstSeen: number };

export function useFriday() {
  const swarm = useSwarm();
  const [plan, setPlan] = useState<SwarmTarget[]>([]);
  const [planTitle, setPlanTitle] = useState("");
  const [planNotes, setPlanNotes] = useState<string[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  // Agent-authored (or button-generated) diagram for the report. Both paths land here.
  const [diagram, setDiagram] = useState<{ title: string; kind: string; mermaid: string } | null>(null);

  // Streamed action pills for the mission log (planning / running / checking / done).
  const [actions, setActions] = useState<ActionEvent[]>([]);
  const actionSeq = useRef(0);
  const pushAction = useCallback((label: string, tone: ActionEvent["tone"]) => {
    setActions((prev) => {
      // Dedupe consecutive identical labels (the progress effect re-fires on every tile change).
      // Planning pills are exempt: planning is user-initiated, never re-fired by an effect, and
      // each call is a fresh 10-20s wait. Suppressing the second one (plan task A, then task B)
      // leaves the log visibly frozen exactly while the slowest step is running.
      if (tone !== "plan" && prev.length && prev[prev.length - 1].label === label) return prev;
      return [...prev, { id: `a${actionSeq.current++}`, ts: Date.now(), label, tone }];
    });
  }, []);

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
    pushAction("Planning the workflow", "plan");
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
  }, [pushAction]);

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
        // Semantics enforced here, not by model discipline: once browsers are live, editing
        // the plan list is a silent no-op (it never touches running tiles). Bounce the model
        // to retargetTile — realtime models self-correct well on corrective tool errors.
        if (s.phase === "spawning" || s.phase === "running") {
          return {
            error:
              "swarm already launched — updatePlan cannot change live browsers; call retargetTile with the target to replace",
          };
        }
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

      case "retargetTile": {
        const { idOrLabel, label, goal, extract } = (args ?? {}) as {
          idOrLabel?: string;
          label?: string | null;
          goal?: string | null;
          extract?: string | null;
        };
        if (!idOrLabel) return { error: "no target specified" };
        const known = s.tiles.some(
          (t) => t.id === idOrLabel || t.label.toLowerCase() === idOrLabel.toLowerCase(),
        );
        if (!known) return { error: `no target named ${idOrLabel}` };
        // Fire and DO NOT await (same contract as runSwarm): the redirect drives a full
        // browser run (~a minute) while a realtime tool call must return in seconds. The
        // settled outcome comes back through the [status] narration channel below.
        void s
          .retarget(idOrLabel, {
            ...(label ? { label } : {}),
            ...(goal ? { goal } : {}),
            ...(extract ? { extract } : {}),
          })
          .then((r) =>
            voiceRef.current.sendTextMessage(
              `[status] Retargeted ${r.label}: ${r.status}${r.result ? ` — ${r.result}` : ""}. Tell the user what came back.`,
            ),
          )
          .catch((e) =>
            voiceRef.current.sendTextMessage(
              `[status] Retarget of ${idOrLabel} failed: ${
                e instanceof Error ? e.message : "unknown error"
              }. Tell the user.`,
            ),
          );
        return { retargeting: idOrLabel, message: "old browser dropped — fresh one spinning up on the new target" };
      }

      case "renderDiagram": {
        const { title, mermaid } = (args ?? {}) as { title?: string; mermaid?: string };
        if (!mermaid) return { error: "no diagram source" };
        setDiagram({ title: title ?? "Diagram", kind: "", mermaid });
        s.openReport(); // surface the report so the diagram is visible
        return { rendered: true };
      }

      default:
        return { error: `unknown tool ${toolName}` };
    }
  }, [planFromTask]);

  // No-voice path for the report modal's "Diagram" button: generate a Mermaid diagram from the
  // finished run and drop it into the SAME diagram state the voice renderDiagram tool feeds.
  const visualize = useCallback(async (hint?: string) => {
    const s = swarmRef.current;
    const results = s.tiles.map((t) => ({ label: t.label, status: t.status, result: t.result }));
    if (results.length === 0) throw new Error("nothing to diagram yet");
    const res = await fetch("/api/swarm/diagram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: titleRef.current, results, ...(hint ? { hint } : {}) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "diagram failed");
    setDiagram({ title: data.title ?? "Diagram", kind: data.kind ?? "", mermaid: data.mermaid ?? "" });
  }, []);

  // Instructions carry today's date + a hard "never answer from memory, always look it up" rule.
  // Built once (stable ref) so the realtime session isn't torn down on every re-render.
  const instructions = useMemo(
    () =>
      buildFridayInstructions(
        new Date().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      ),
    [],
  );
  const voice = useVoice({ instructions, onToolCall: dispatch });

  // Mission-log transcript minus turns hidden by a New Session. The realtime hook exposes no
  // clearMessages, so we snapshot the current message ids on reset and filter them out; genuinely
  // new turns (fresh ids after reconnect) still appear.
  const hiddenMsgIds = useRef<Set<string>>(new Set());
  // First-seen stamp per message id (see StampedMessage). Written on the render a turn first
  // shows up and never rewritten, so a turn keeps its true position in the merged feed for the
  // life of the session; cleared by resetAll so the map can't outlive the transcript it describes.
  const msgFirstSeen = useRef<Map<string, number>>(new Map());
  const visibleMessages: StampedMessage[] = voice.messages
    .filter((m) => !hiddenMsgIds.current.has(m.id))
    .map((m) => {
      let firstSeen = msgFirstSeen.current.get(m.id);
      if (firstSeen === undefined) {
        firstSeen = Date.now();
        msgFirstSeen.current.set(m.id, firstSeen);
      }
      return { ...m, firstSeen };
    });

  // M3 progress bridge: two channels off ONE read of swarm state — action pills (always) and
  // spoken [status] notes (only on a live realtime session). Both are derived from swarm.phase /
  // swarm.tiles, which the voice and text paths populate identically, so the effect itself must
  // NOT be gated on voice.status: a text-path user still needs the full visible action trace.
  // Only the sendTextMessage calls are gated — pushing into a disconnected session is a no-op at
  // best and an error at worst. The swarm and voice sessions share this browser, so no server
  // polling is needed — this reads live state directly.
  // NOTE: the exact conversational feel (interruption, cadence) needs live tuning with a mic.
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  // Two cadences, two refs. The pill cadence advances on real progress alone; the voice cadence
  // additionally waits out the 6s/turn-taking guards. Sharing one ref would let a suppressed
  // announcement (user mid-sentence, or simply no voice session) swallow the pill too — which is
  // exactly the text-path blackout this split fixes.
  const lastPillSettledRef = useRef(0);
  const lastSettledRef = useRef(0);
  const lastAnnounceRef = useRef(0);
  const doneAnnouncedRef = useRef(false);

  useEffect(() => {
    const tiles = swarm.tiles;
    const connected = voice.status === "connected";

    // Every ref below is RUN-scoped, so it has to be zeroed at the START of a run, not only on
    // idle. useSwarm.run() goes spawning → running → done and never passes back through idle, so
    // a second run in the same session (e.g. "now check these three instead") would otherwise
    // inherit run 1's counters: lastPillSettled stuck at run 1's total means `settled >` never
    // holds (no progress pills at all), and doneAnnounced stuck true means no "Verified" pill AND
    // no [status] Swarm finished — on the voice path FRIDAY would silently never report run 2.
    if (swarm.phase === "idle" || swarm.phase === "spawning") {
      lastPillSettledRef.current = 0;
      lastSettledRef.current = 0;
      lastAnnounceRef.current = 0;
      doneAnnouncedRef.current = false;
    }
    if (swarm.phase === "idle") return;
    if (swarm.phase === "spawning") {
      // Count from the PLAN, not the tiles: run() flips to 'spawning' before the fleet resolves
      // and leaves the previous run's tiles in place, so tiles.length is either 0 (first run —
      // count vanishes) or the last run's size (second run — wrong count). The plan is what's
      // about to be spawned, and both entry paths (runSwarm tool, manual Run button) fill it first.
      const count = planRef.current.length;
      pushAction(count ? `Spawning ${count} cloud browsers` : "Spawning cloud browsers", "run");
      return;
    }
    if (tiles.length === 0) return;

    const settled = tiles.filter((t) => t.status !== "idle" && t.status !== "working").length;

    if (swarm.phase === "running") {
      // First running tick → a "browsers are working" pill (the visible action trace, separate
      // from the spoken narration).
      if (lastPillSettledRef.current === 0 && settled === 0) pushAction(`Running ${tiles.length} browsers`, "run");

      // Pill cadence: one "checked X of N" per real advance, no clock and no turn-taking gate.
      // Progress is the only sensible coalescer for a visual stream — the effect re-fires on every
      // tile mutation (status → result → screenshot), so without it we'd emit duplicates, and with
      // a time gate we'd silently drop steps the user can see happening in the tiles.
      if (settled > lastPillSettledRef.current) {
        lastPillSettledRef.current = settled;
        pushAction(`Checked ${settled} of ${tiles.length}`, "check");
      }

      // Voice cadence: progress AND ~6s apart AND the user isn't mid-sentence. Talking over
      // someone is far worse than a skipped update, so these stay strict — and they stay here,
      // where they can't reach the pills.
      const now = Date.now();
      const progressed = settled > lastSettledRef.current;
      const enoughTimePassed = now - lastAnnounceRef.current > 6000;
      const userQuiet = voice.voiceState !== "listening";
      if (connected && progressed && enoughTimePassed && userQuiet) {
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
      pushAction(`Verified ${resolved} of ${tiles.length} — compiling report`, "done");
      if (connected) {
        voiceRef.current.sendTextMessage(
          `[status] Swarm finished: ${resolved} of ${tiles.length} resolved. Summarize the findings for the user.`,
        );
      }
    }
  }, [swarm.tiles, swarm.phase, voice.status, voice.voiceState, pushAction]);

  const resetAll = useCallback(() => {
    // Hide the current transcript, then end the voice session so the model's conversation context
    // resets too — "New Session" means a genuine fresh start, not just a cleared screen.
    hiddenMsgIds.current = new Set(voiceRef.current.messages.map((m) => m.id));
    msgFirstSeen.current = new Map(); // every stamped id is now hidden — drop them, don't leak
    voiceRef.current.disconnect();
    swarmRef.current.reset();
    setPlan([]);
    setPlanTitle("");
    setPlanNotes([]);
    setFocusedId(null);
    setDiagram(null);
    setActions([]);
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
    diagram,
    setDiagram,
    visualize,
    messages: visibleMessages,
    actions,
    resetAll,
  };
}
