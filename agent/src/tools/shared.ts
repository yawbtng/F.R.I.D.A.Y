// Shared module-scoped state for agent tools.
// browserSessionId must be set before any tool is invoked.

let _browserSessionId = '';

export function setBrowserSessionId(id: string): void {
  _browserSessionId = id;
}

export function getBrowserSessionId(): string {
  if (!_browserSessionId) throw new Error('Browser session ID not set');
  return _browserSessionId;
}
