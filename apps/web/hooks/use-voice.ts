"use client";

// Thin wrapper over the AI SDK realtime hook. Connects the browser to gpt-realtime through
// the AI Gateway (ephemeral token from /api/realtime/token), captures the mic with server-VAD
// + barge-in, maps events to a VoiceState for the orb, and routes tool calls to a caller-
// supplied dispatcher. use-friday (M2) composes this with use-swarm and supplies the real
// onToolCall handlers. This hook owns transport only — no swarm knowledge.

import { createGateway } from "@ai-sdk/gateway";
import { experimental_useRealtime } from "@ai-sdk/react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { UIMessage } from "ai";
import type { VoiceState } from "@/lib/voice-state";

// MUST be a model the AI Gateway serves over WebSocket, not just REST. `openai/gpt-realtime`
// and the gpt-4o-realtime-preview family mint tokens fine but 400 on the WS upgrade
// ("not available over WebSocket") — the socket connects then dies in ~1s. gpt-realtime-mini
// is WS-available. Re-check with scripts/verify-realtime-token.ts before changing this.
const REALTIME_MODEL = "openai/gpt-realtime-mini";

// The exact options type the realtime hook expects — lets the memoized `api` / `sessionConfig`
// literals stay correctly narrowed (server-vad, modalities) instead of re-widening to string.
type RealtimeOptions = Parameters<typeof experimental_useRealtime>[0];

export interface UseVoiceOptions {
  /** System prompt / persona for the voice agent. */
  instructions: string;
  /** Realtime voice id (default "marin"). */
  voice?: string;
  /** Handle a tool call from the model. Return a value to have it spoken back; return
   *  undefined and call addToolOutput(callId, result) later for async (long-running) work. */
  onToolCall?: (
    toolName: string,
    args: unknown,
    callId: string,
  ) => Promise<unknown> | unknown;
  onError?: (err: Error) => void;
}

export interface UseVoiceReturn {
  status: "disconnected" | "connecting" | "connected" | "error";
  voiceState: VoiceState;
  /** True when the mic track is disabled (session still live). */
  muted: boolean;
  /** Conversation turns (user + assistant) for the transcript panel. */
  messages: UIMessage[];
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Toggle the mic on/off without ending the session. */
  toggleMute: () => void;
  /** Submit a deferred tool result (for tools whose onToolCall returned undefined). */
  addToolOutput: (callId: string, result: unknown) => void;
  /** Inject a text turn (used by the M3 progress bridge to make the agent narrate). */
  sendTextMessage: (text: string) => void;
}

export function useVoice({
  instructions,
  voice = "marin",
  onToolCall,
  onError,
}: UseVoiceOptions): UseVoiceReturn {
  // Client-only model instance: used for the WS handshake + event (de)serialization.
  // Needs no API key — the key-bearing path runs only server-side in the token route.
  const model = useMemo(() => createGateway().experimental_realtime(REALTIME_MODEL), []);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [muted, setMuted] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  // These MUST be referentially stable. experimental_useRealtime rebuilds the whole realtime
  // store — tearing down the live WebSocket + audio — whenever `api` or `sessionConfig` change
  // by reference (shouldCreateRealtimeStore compares with !==). Inline object literals here
  // re-created the session on EVERY render: the cause of the glitching, doubled/overlapping
  // audio, and tool calls that never completed. Memoized → the session is created once.
  const api = useMemo<RealtimeOptions["api"]>(() => ({ token: "/api/realtime/token" }), []);
  const sessionConfig = useMemo<RealtimeOptions["sessionConfig"]>(
    () => ({
      instructions,
      voice,
      outputModalities: ["audio", "text"],
      turnDetection: {
        type: "server-vad", // auto turn-taking + barge-in
        threshold: 0.5,
        silenceDurationMs: 500,
        prefixPaddingMs: 300,
      },
      inputAudioTranscription: { model: "whisper-1" },
    }),
    [instructions, voice],
  );

  // Kept fresh (below) so onError can tell a transient blip from a real disconnect without a
  // TDZ reference to `rt` (its closure only runs later).
  const statusRef = useRef<"disconnected" | "connecting" | "connected" | "error">("disconnected");

  const rt = experimental_useRealtime({
    model,
    api,
    sessionConfig,
    onToolCall: async ({ toolCall }) =>
      onToolCall
        ? await onToolCall(toolCall.toolName, toolCall.args, toolCall.toolCallId)
        : undefined,
    onEvent: (event) => {
      const type = (event as { type?: string }).type ?? "";
      if (type.includes("speech_started") || type.includes("speech-started")) {
        setVoiceState("listening");
      } else if (type.includes("audio") && type.includes("delta")) {
        setVoiceState("speaking");
      } else if (type.includes("response") && type.includes("done")) {
        setVoiceState("idle");
      }
    },
    onError: (e) => {
      // A transient realtime error while still connected shouldn't nuke the UI to "failed" (it
      // flashed FAILED on the orb mid-run while voice kept working). Only fail when truly down.
      if (statusRef.current !== "connected") setVoiceState("failed");
      onError?.(e);
    },
  });
  statusRef.current = rt.status;

  const connect = useCallback(async () => {
    setVoiceState("connecting");
    try {
      await rt.connect();
      // echoCancellation/noiseSuppression help the mic not re-trigger on FRIDAY's own voice
      // through laptop speakers — otherwise server-VAD hears it and the model talks over itself.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      rt.startAudioCapture(stream);
      setMuted(false);
      setVoiceState("idle");
    } catch (e) {
      setVoiceState("failed");
      onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  }, [rt, onError]);

  const disconnect = useCallback(() => {
    rt.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setMuted(false);
    setVoiceState("disconnected");
  }, [rt]);

  // Mute keeps the session + WebSocket alive and just disables the mic track (it emits silence),
  // so it's instant and reversible — unlike stopAudioCapture, which ends the track for good.
  const toggleMute = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const next = !mutedRef.current;
    stream.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, []);

  return {
    status: rt.status,
    voiceState,
    muted,
    messages: rt.messages,
    connect,
    disconnect,
    toggleMute,
    addToolOutput: rt.addToolOutput,
    sendTextMessage: rt.sendTextMessage,
  };
}
