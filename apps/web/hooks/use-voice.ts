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

const REALTIME_MODEL = "openai/gpt-realtime";

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
  /** Conversation turns (user + assistant) for the transcript panel. */
  messages: UIMessage[];
  connect: () => Promise<void>;
  disconnect: () => void;
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
  const streamRef = useRef<MediaStream | null>(null);

  const rt = experimental_useRealtime({
    model,
    api: { token: "/api/realtime/token" }, // URL of the token route, NOT a token
    sessionConfig: {
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
    },
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
      setVoiceState("failed");
      onError?.(e);
    },
  });

  const connect = useCallback(async () => {
    setVoiceState("connecting");
    try {
      await rt.connect();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      rt.startAudioCapture(stream);
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
    setVoiceState("disconnected");
  }, [rt]);

  return {
    status: rt.status,
    voiceState,
    messages: rt.messages,
    connect,
    disconnect,
    addToolOutput: rt.addToolOutput,
    sendTextMessage: rt.sendTextMessage,
  };
}
