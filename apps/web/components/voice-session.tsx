'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  LiveKitRoom,
  useVoiceAssistant,
  BarVisualizer,
  RoomAudioRenderer,
  VoiceAssistantControlBar,
} from '@livekit/components-react';
import '@livekit/components-styles';

interface VoiceSessionProps {
  roomName: string;
}

function VoiceContent() {
  const { state, audioTrack, agentTranscriptions } = useVoiceAssistant();
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentTranscriptions.length]);

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            state === 'listening' || state === 'speaking' || state === 'idle'
              ? 'bg-green-400'
              : state === 'connecting' ||
                  state === 'initializing' ||
                  state === 'thinking' ||
                  state === 'pre-connect-buffering'
                ? 'bg-yellow-400 animate-pulse'
                : state === 'failed'
                  ? 'bg-red-400'
                  : 'bg-gray-400'
          }`}
        />
        <span className="text-sm text-friday-text-secondary font-mono">
          {state}
        </span>
      </div>

      {/* Audio Visualizer */}
      <div className="flex justify-center py-8">
        <div className="w-48 h-48">
          <BarVisualizer
            state={state}
            track={audioTrack}
            barCount={5}
            options={{ minHeight: 24 }}
          />
        </div>
      </div>

      {/* Control Bar (mic toggle) */}
      <VoiceAssistantControlBar />

      {/* Transcript */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {agentTranscriptions.map((seg, i) => (
          <div key={i} className="text-sm">
            <span className="text-friday-accent font-mono">FRIDAY:</span>{' '}
            <span className="text-friday-text-primary">{seg.text}</span>
          </div>
        ))}
        <div ref={transcriptEndRef} />
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

export function VoiceSession({ roomName }: VoiceSessionProps) {
  const [connectionDetails, setConnectionDetails] = useState<{
    token: string;
    serverUrl: string;
  } | null>(null);
  const [error, setError] = useState('');

  const connect = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/token?room=${encodeURIComponent(roomName)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConnectionDetails({ token: data.token, serverUrl: data.serverUrl });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to get token');
    }
  }, [roomName]);

  if (error) {
    return <p className="text-red-400 text-sm font-mono">{error}</p>;
  }

  if (!connectionDetails) {
    return (
      <button
        onClick={connect}
        className="px-4 py-2 bg-friday-accent text-white rounded-lg hover:bg-friday-accent-hover transition-colors duration-150 ease-out focus-ring font-medium text-sm"
      >
        Connect Voice
      </button>
    );
  }

  return (
    <LiveKitRoom
      token={connectionDetails.token}
      serverUrl={connectionDetails.serverUrl}
      connect={true}
      audio={true}
      video={false}
    >
      <VoiceContent />
    </LiveKitRoom>
  );
}
