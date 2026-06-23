import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

import { makeStateWorker, mapStatus } from '../../agent/src/fleet/worker.js';
import type { StateAdapter } from '../../agent/src/fleet/states.js';

const adapters: Record<string, StateAdapter> = {
  DE: {
    state: 'DE',
    name: 'Delaware',
    searchUrl: 'https://de.example/search',
    agentGoal: 'Open the record for "{entity}".',
  },
};
const ctx = { sessionId: 's', token: 't' };
const ok = (json: unknown) => Promise.resolve({ ok: true, json: async () => json });
const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string) as Record<string, unknown>;

// Route the mock by URL: agent -> opened record; extract -> a one-word status.
function wire(extraction: string) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/api/browser/agent')) return ok({ data: { message: 'opened the record', completed: true } });
    if (url.includes('/api/browser/extract')) return ok({ data: { extraction } });
    return ok({ ok: true });
  });
}

describe('mapStatus', () => {
  it('classifies active / inactive / notfound (inactive wins over substring "active")', () => {
    expect(mapStatus({ extraction: 'active' }).status).toBe('active');
    expect(mapStatus({ extraction: 'Good Standing' }).status).toBe('active');
    expect(mapStatus({ extraction: 'inactive' }).status).toBe('inactive');
    expect(mapStatus({ extraction: 'Expired' }).status).toBe('inactive');
    expect(mapStatus({ extraction: 'notfound' }).status).toBe('notfound');
    expect(mapStatus({ extraction: '' }).status).toBe('notfound');
    expect(mapStatus(null).status).toBe('notfound');
  });
});

describe('makeStateWorker (agent navigate + structured extract)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('runs the agent (startUrl + entity goal) then extracts the status', async () => {
    wire('active');
    const res = await makeStateWorker(adapters)({ state: 'DE', entityName: 'Acme Corp' }, ctx);

    expect(res).toMatchObject({ state: 'DE', status: 'active' });
    expect(typeof res.ms).toBe('number');

    const agentCall = mockFetch.mock.calls.find((c) => String(c[0]).includes('/api/browser/agent'))!;
    expect(agentCall, 'agent route should be called').toBeTruthy();
    const ab = bodyOf(agentCall);
    expect(ab.startUrl).toBe('https://de.example/search');
    expect(ab.instruction).toContain('Acme Corp');

    expect(mockFetch.mock.calls.some((c) => String(c[0]).includes('/api/browser/extract'))).toBe(true);
  });

  it('maps an expired extract to inactive', async () => {
    wire('expired');
    const res = await makeStateWorker(adapters)({ state: 'DE', entityName: 'X' }, ctx);
    expect(res.status).toBe('inactive');
  });

  it('returns notfound without any fetch when no adapter exists for the state', async () => {
    const res = await makeStateWorker(adapters)({ state: 'ZZ', entityName: 'X' }, ctx);
    expect(res.status).toBe('notfound');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('propagates a failed agent run so the orchestrator can mark it error', async () => {
    mockFetch.mockImplementation((url: string) =>
      url.includes('/api/browser/agent')
        ? Promise.resolve({ ok: false, status: 500, json: async () => ({ error: 'agent crashed' }) })
        : ok({ ok: true }),
    );
    await expect(makeStateWorker(adapters)({ state: 'DE', entityName: 'X' }, ctx)).rejects.toThrow('agent crashed');
  });
});
