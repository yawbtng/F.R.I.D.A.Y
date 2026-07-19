// Shared voice/orb animation state, decoupled from any transport. Replaces LiveKit's
// `AgentState` so the audio-orb components (agent-audio-visualizer-*) render independently
// of the voice engine. The realtime session (use-voice) and the swarm both map into these.
//
// The narrow set — idle | listening | thinking | speaking | working — is what callers set;
// the wider set carries the transient connection states the orb hooks animate.
export type VoiceState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "working"
  | "connecting"
  | "initializing"
  | "pre-connect-buffering"
  | "failed"
  | "disconnected";
