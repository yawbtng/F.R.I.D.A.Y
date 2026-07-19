// Headless diagnostic probe for the realtime voice path (no microphone needed).
//
// Replicates EXACTLY what the browser does (see node_modules ai@7.0.14 AbstractRealtimeSession
// + @ai-sdk/gateway@4.0.11 getGatewayRealtimeProtocols):
//   1. POST /api/realtime/token → { token, url, tools }
//   2. new WebSocket(url, ["ai-gateway-realtime.v1", "ai-gateway-auth.<token>"])
//   3. on open: send { type: "session-update", config: { ...sessionConfig, tools } }
//   4. text turns: { type: "conversation-item-create", item: { type: "text-message", role: "user", text } }
//      then { type: "response-create" }
//
// Server events arrive as normalized JSON (session-created / session-updated / audio-delta /
// audio-transcript-delta / audio-transcript-done / text-delta / text-done / response-created /
// response-done / function-call-arguments-delta / function-call-arguments-done / error / ...).
//
// Tests:
//   A (date):     "What is today's date?" → PASS if transcript contains current year+month.
//   B (tools):    "Check whether Tesla is a registered business." → PASS if a
//                 function-call-arguments-done for planTask arrives.
//   C (retarget): completes B's tool round-trip (synthetic plan output: Tesla + Walmart),
//                 simulates the launched swarm (runSwarm output), then says "actually,
//                 check Costco instead of Walmart" → PASS if retargetTile is called.
//                 Synthetic outputs only — no real browsers are ever spawned.
//
// Run:  agent/node_modules/.bin/tsx apps/web/scripts/probe-realtime.ts [--no-instructions]
//   --no-instructions = CONTROL run: session-update omits instructions, to distinguish
//   "gateway rejected config" from "model ignores config".
//   --bad-modalities  = REGRESSION run: send the old invalid ["audio","text"] modalities
//   (rejected atomically — voids persona + tools; the original 07-17 bug).
//
// Uses Node >= 22 built-in WebSocket. Never prints env/key values (token from the route is a
// short-lived ephemeral client token; we do not print it either).

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { buildFridayInstructions } from "../lib/friday-persona";

const NO_INSTRUCTIONS = process.argv.includes("--no-instructions");
// Default mirrors the FIXED app config: outputModalities ["audio"]. --bad-modalities
// reproduces the original bug — ['audio','text'] is invalid (only ['text'] OR ['audio']),
// and the rejection silently voids the ENTIRE session.update (persona + all tools).
const BAD_MODALITIES = process.argv.includes("--bad-modalities");
const RUN_LABEL = `${NO_INSTRUCTIONS ? "control-no-instructions" : "instructed"}${BAD_MODALITIES ? "-bad-modalities" : ""}`;
const TOKEN_URL = "http://localhost:3001/api/realtime/token";
// Raw-event evidence log — override with PROBE_LOG=/path/to/file.jsonl
const LOG_PATH = process.env.PROBE_LOG || "/tmp/friday-probe-events.jsonl";
const PHASE_TIMEOUT_MS = 30_000;

// ── logging ──────────────────────────────────────────────────────────
mkdirSync(dirname(LOG_PATH), { recursive: true });

function redactForLog(event: Record<string, unknown>): Record<string, unknown> {
  // audio-delta payloads are big base64 blobs; truncate ONLY that field so the log stays
  // readable evidence. Everything else is logged verbatim.
  if (event.type === "audio-delta" && typeof event.delta === "string" && event.delta.length > 64) {
    return { ...event, delta: `${event.delta.slice(0, 64)}...<${event.delta.length} b64 chars truncated>` };
  }
  return event;
}

function logEvent(direction: "recv" | "send" | "meta", event: Record<string, unknown>): void {
  const entry = { ts: new Date().toISOString(), run: RUN_LABEL, direction, event: redactForLog(event) };
  const line = JSON.stringify(entry);
  appendFileSync(LOG_PATH, line + "\n");
  console.log(line);
}

// ── event bus: collect raw server events, let phases await predicates ─
type ServerEvent = Record<string, unknown> & { type?: string };
const received: ServerEvent[] = [];
type Waiter = { predicate: (e: ServerEvent) => boolean; resolve: (e: ServerEvent) => void };
const waiters: Waiter[] = [];

function onServerEvent(e: ServerEvent): void {
  received.push(e);
  logEvent("recv", e);
  for (let i = waiters.length - 1; i >= 0; i--) {
    if (waiters[i].predicate(e)) {
      const [w] = waiters.splice(i, 1);
      w.resolve(e);
    }
  }
}

function waitFor(predicate: (e: ServerEvent) => boolean, timeoutMs: number): Promise<ServerEvent | null> {
  return waitForNew(0, predicate, timeoutMs);
}

/** Like waitFor, but ignores events buffered before startIndex — needed once multiple
 *  phases await the SAME event type (e.g. a second function-call-arguments-done). */
function waitForNew(
  startIndex: number,
  predicate: (e: ServerEvent) => boolean,
  timeoutMs: number,
): Promise<ServerEvent | null> {
  const already = received.slice(startIndex).find(predicate);
  if (already) return Promise.resolve(already);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const idx = waiters.findIndex((w) => w.resolve === wrapped);
      if (idx >= 0) waiters.splice(idx, 1);
      resolve(null);
    }, timeoutMs);
    const wrapped = (e: ServerEvent) => {
      clearTimeout(timer);
      resolve(e);
    };
    waiters.push({ predicate, resolve: wrapped });
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── main ─────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const summary = {
    CONFIG_ACK: "no" as string,
    DATE_TEST: "fail(no response)" as string,
    TOOL_TEST: "fail(no tool call)" as string,
    RETARGET_TEST: "skipped(no planTask call in TEST B)" as string,
  };

  // 1. Mint via the app's real token route.
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  // Defaults mirror the app's use-voice config. Env overrides for A/B-testing candidate
  // configs against the Gateway (a rejected field voids the WHOLE update, so ALWAYS
  // check CONFIG_ACK here before adopting a config change in the app):
  //   PROBE_TD=server-vad          old silence-timer turn detection (pre-2026-07-18)
  //   PROBE_TRANSCRIBE=<model>     e.g. whisper-1 instead of gpt-4o-mini-transcribe
  //   PROBE_ACK_ONLY=1             exit right after CONFIG_ACK (fast config testing)
  const sessionConfig: Record<string, unknown> = {
    voice: "marin",
    outputModalities: BAD_MODALITIES ? ["audio", "text"] : ["audio"],
    turnDetection:
      process.env.PROBE_TD === "server-vad"
        ? {
            type: "server-vad",
            threshold: 0.5,
            silenceDurationMs: 500,
            prefixPaddingMs: 300,
          }
        : { type: "semantic-vad" },
    inputAudioTranscription: {
      model: process.env.PROBE_TRANSCRIBE || "gpt-4o-mini-transcribe",
    },
  };
  if (!NO_INSTRUCTIONS) sessionConfig.instructions = buildFridayInstructions(today);

  logEvent("meta", { type: "probe-start", run: RUN_LABEL, today });

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionConfig }),
  });
  if (!tokenRes.ok) {
    console.log(`FATAL: token route returned ${tokenRes.status}`);
    process.exit(1);
  }
  const { token, url, tools } = (await tokenRes.json()) as {
    token: string;
    url: string;
    tools: unknown[];
  };
  logEvent("meta", {
    type: "token-minted",
    url,
    toolCount: Array.isArray(tools) ? tools.length : 0,
    toolNames: Array.isArray(tools) ? tools.map((t) => (t as { name?: string }).name) : [],
  });

  // 2. Connect with the gateway subprotocols (mirrors getGatewayRealtimeProtocols).
  const ws = new WebSocket(url, ["ai-gateway-realtime.v1", `ai-gateway-auth.${token}`]);

  const send = (event: Record<string, unknown>) => {
    logEvent("send", event.type === "session-update"
      ? { ...event, config: { ...(event.config as object), instructions: NO_INSTRUCTIONS ? undefined : "<full FRIDAY instructions, " + String((sessionConfig.instructions as string | undefined)?.length ?? 0) + " chars>" } }
      : event);
    ws.send(JSON.stringify(event));
  };

  let closed = false;
  ws.addEventListener("close", (ev) => {
    closed = true;
    logEvent("meta", { type: "ws-close", code: (ev as CloseEvent).code, reason: (ev as CloseEvent).reason });
  });
  ws.addEventListener("error", () => {
    logEvent("meta", { type: "ws-error" });
  });
  ws.addEventListener("message", async (ev) => {
    const data = ev.data;
    const text = typeof data === "string" ? data : data instanceof Blob ? await data.text() : new TextDecoder().decode(data as ArrayBuffer);
    try {
      onServerEvent(JSON.parse(text) as ServerEvent);
    } catch {
      logEvent("recv", { type: "unparseable", raw: text.slice(0, 500) });
    }
  });

  const opened = await new Promise<boolean>((resolve) => {
    const t = setTimeout(() => resolve(false), 15_000);
    ws.addEventListener("open", () => {
      clearTimeout(t);
      resolve(true);
    });
    ws.addEventListener("close", () => {
      clearTimeout(t);
      resolve(false);
    });
  });
  if (!opened) {
    summary.CONFIG_ACK = "error(WebSocket failed to open)";
    printSummary(summary);
    process.exit(1);
  }
  logEvent("meta", { type: "ws-open", protocol: ws.protocol });

  // 3. session-update with the app's REAL config (+ tools from the token response),
  //    exactly like AbstractRealtimeSession.connect's onOpen.
  ws.send(JSON.stringify({ type: "session-update", config: { ...sessionConfig, tools } }));
  logEvent("send", {
    type: "session-update",
    config: {
      ...sessionConfig,
      instructions: NO_INSTRUCTIONS ? undefined : `<FRIDAY instructions, ${(sessionConfig.instructions as string).length} chars>`,
      tools: `<${Array.isArray(tools) ? tools.length : 0} tool defs from token route>`,
    },
  });

  // 4. Does the gateway ACK or reject the config?
  const ack = await waitFor(
    (e) => e.type === "session-updated" || e.type === "session-created" || e.type === "error",
    PHASE_TIMEOUT_MS,
  );
  if (!ack) {
    summary.CONFIG_ACK = "no(nothing received within 30s of session-update)";
  } else if (ack.type === "error") {
    summary.CONFIG_ACK = `error(${JSON.stringify(ack)})`;
  } else {
    // session-created may race ahead of our update; wait a beat for a session-updated too.
    const updated = await waitFor((e) => e.type === "session-updated", 5_000);
    summary.CONFIG_ACK = updated ? "yes(session-updated received)" : `partial(${ack.type} only, no session-updated)`;
  }

  if (process.env.PROBE_ACK_ONLY) {
    if (!closed) ws.close();
    printSummary(summary);
    process.exit(summary.CONFIG_ACK.startsWith("yes") ? 0 : 1);
  }

  // ── TEST A: date awareness ─────────────────────────────────────────
  const responsesBeforeA = received.filter((e) => e.type === "response-done").length;
  send({
    type: "conversation-item-create",
    item: { type: "text-message", role: "user", text: "What is today's date? Answer with just the date." },
  });
  send({ type: "response-create" });

  await waitFor(
    (e) => e.type === "response-done" && received.filter((x) => x.type === "response-done").length > responsesBeforeA,
    PHASE_TIMEOUT_MS,
  );
  await sleep(1_000); // let trailing transcript-done events land

  const answerA = extractResponseText();
  const yearOk = /2026/.test(answerA);
  const monthOk = /july/i.test(answerA);
  summary.DATE_TEST = yearOk && monthOk ? `pass("${answerA.trim()}")` : `fail("${answerA.trim() || "<no text captured>"}")`;

  // ── TEST B: tool calling ───────────────────────────────────────────
  const textLenBeforeB = fullTranscriptLength();
  send({
    type: "conversation-item-create",
    item: { type: "text-message", role: "user", text: "Check whether Tesla is a registered business." },
  });
  send({ type: "response-create" });

  const toolCall = await waitFor((e) => e.type === "function-call-arguments-done", PHASE_TIMEOUT_MS);
  if (toolCall) {
    summary.TOOL_TEST =
      (toolCall as { name?: string }).name === "planTask"
        ? `pass(planTask called: ${JSON.stringify(toolCall)})`
        : `pass-other-tool(${JSON.stringify(toolCall)})`;
  } else {
    await sleep(500);
    const spokenInstead = extractResponseText().slice(textLenBeforeB).trim();
    summary.TOOL_TEST = `fail(no function-call event in 30s; model said: "${spokenInstead || "<nothing>"}")`;
  }

  // ── TEST C: single-tile retarget mid-run ───────────────────────────
  // Completes the tool round-trip TEST B opened (synthetic plan output), simulates the
  // launched swarm, then changes ONE target by text. PASS = the model reaches for
  // retargetTile (updatePlan would be the pre-run tool; the swarm is "running" here).
  // All tool outputs are synthetic — no real browsers are spawned by this probe.
  if (toolCall) {
    const answerCall = (call: ServerEvent, output: Record<string, unknown>) => {
      send({
        type: "conversation-item-create",
        item: {
          type: "function-call-output",
          callId: String((call as { callId?: unknown }).callId ?? ""),
          name: String((call as { name?: unknown }).name ?? ""),
          output: JSON.stringify(output),
        },
      });
      send({ type: "response-create" });
    };

    // 1. Answer TEST B's planTask with a two-target plan.
    let idx = received.length;
    answerCall(toolCall, {
      title: "Verify Tesla and Walmart are registered businesses",
      count: 2,
      targets: [
        { id: "tesla", label: "Tesla" },
        { id: "walmart", label: "Walmart" },
      ],
      message: "plan ready — 2 targets",
    });
    await waitForNew(idx, (e) => e.type === "response-done", PHASE_TIMEOUT_MS);

    // 2. Green-light the run; whatever tool it calls (expected: runSwarm), answer as launched
    //    so nothing dangles before the retarget ask.
    send({
      type: "conversation-item-create",
      item: { type: "text-message", role: "user", text: "Yes, run it." },
    });
    send({ type: "response-create" });
    idx = received.length;
    const runCall = await waitForNew(
      idx,
      (e) => e.type === "function-call-arguments-done",
      PHASE_TIMEOUT_MS,
    );
    if (runCall) {
      idx = received.length;
      answerCall(runCall, { runId: "run-1", count: 2, message: "swarm launched" });
      await waitForNew(idx, (e) => e.type === "response-done", PHASE_TIMEOUT_MS);
    }

    // 3. The change of mind — the moment under test.
    send({
      type: "conversation-item-create",
      item: {
        type: "text-message",
        role: "user",
        text: "Actually, change of plan — check Costco instead of Walmart. Keep Tesla going.",
      },
    });
    send({ type: "response-create" });
    idx = received.length;
    let rt = await waitForNew(
      idx,
      (e) => e.type === "function-call-arguments-done",
      PHASE_TIMEOUT_MS,
    );
    let redirected = false;
    // Production loop: dispatch bounces a mid-run updatePlan with a corrective error
    // (use-friday guards on phase). Answer with the SAME error and expect self-correction.
    if (rt && String((rt as { name?: unknown }).name ?? "") === "updatePlan") {
      redirected = true;
      idx = received.length;
      answerCall(rt, {
        error:
          "swarm already launched — updatePlan cannot change live browsers; call retargetTile with the target to replace",
      });
      rt = await waitForNew(
        idx,
        (e) => e.type === "function-call-arguments-done",
        PHASE_TIMEOUT_MS,
      );
    }
    if (rt) {
      const name = String((rt as { name?: unknown }).name ?? "");
      summary.RETARGET_TEST =
        name === "retargetTile"
          ? `pass${redirected ? "-after-redirect" : ""}(${JSON.stringify(rt)})`
          : `partial(called ${name} instead: ${JSON.stringify(rt)})`;
    } else {
      await sleep(500);
      summary.RETARGET_TEST = `fail(no function call${redirected ? " after redirect" : ""}; model said: "${extractResponseText().slice(-200).trim()}")`;
    }
  }

  // Synthetic outputs only above — nothing real was executed. Disconnect.
  if (!closed) ws.close();
  printSummary(summary);
  process.exit(0);

  // ── helpers over the received buffer ───────────────────────────────
  function extractResponseText(): string {
    // Prefer finalized text; fall back to concatenated deltas.
    const done = received
      .filter((e) => e.type === "audio-transcript-done" || e.type === "text-done")
      .map((e) => (e as { transcript?: string; text?: string }).transcript ?? (e as { text?: string }).text ?? "")
      .join(" ");
    if (done.trim()) return done;
    return received
      .filter((e) => e.type === "audio-transcript-delta" || e.type === "text-delta")
      .map((e) => (e as { delta?: string }).delta ?? "")
      .join("");
  }
  function fullTranscriptLength(): number {
    return extractResponseText().length;
  }
}

function printSummary(s: {
  CONFIG_ACK: string;
  DATE_TEST: string;
  TOOL_TEST: string;
  RETARGET_TEST: string;
}): void {
  console.log("\n================ PROBE SUMMARY (" + RUN_LABEL + ") ================");
  console.log("CONFIG_ACK:    " + s.CONFIG_ACK);
  console.log("DATE_TEST:     " + s.DATE_TEST);
  console.log("TOOL_TEST:     " + s.TOOL_TEST);
  console.log("RETARGET_TEST: " + s.RETARGET_TEST);
  console.log("Event log:  " + LOG_PATH);
  console.log("================================================================");
}

// Hard kill at 4 min so we never hang (TEST C adds ~3 more model turns).
setTimeout(() => {
  console.log("FATAL: total runtime cap (240s) hit; exiting.");
  process.exit(2);
}, 240_000).unref();

main().catch((err) => {
  console.error("FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
