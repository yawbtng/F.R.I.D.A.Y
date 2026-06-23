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
    searchInstruction: 'Type "{entity}" and search.',
    extractInstruction: 'extract status',
  },
};
const ctx = { sessionId: 's', token: 't' };
const ok = (json: unknown) => Promise.resolve({ ok: true, json: async () => json });
const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string) as Record<string, unknown>;

describe('mapStatus', () => {
  it('classifies active / inactive / notfound (inactive wins over substring "active")', () => {
    expect(mapStatus({ status: 'Active' }).status).toBe('active');
    expect(mapStatus({ status: 'Good Standing' }).status).toBe('active');
    expect(mapStatus({ status: 'Inactive' }).status).toBe('inactive');
    expect(mapStatus({ status: 'Expired' }).status).toBe('inactive');
    expect(mapStatus({ status: 'Dissolved' }).status).toBe('inactive');
    expect(mapStatus({ status: '' }).status).toBe('notfound');
    expect(mapStatus(null).status).toBe('notfound');
  });
});

describe('makeStateWorker', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('navigates to the adapter URL, searches with the entity interpolated, and maps active', async () => {
    mockFetch.mockImplementation((url: string) =>
      url.includes('/extract') ? ok({ data: { status: 'Active', entityName: 'Acme Corp' } }) : ok({ ok: true }),
    );

    const res = await makeStateWorker(adapters)({ state: 'DE', entityName: 'Acme Corp' }, ctx);

    expect(res).toMatchObject({ state: 'DE', status: 'active' });
    expect(typeof res.ms).toBe('number');

    const calls = mockFetch.mock.calls;
    const nav = calls.find((c) => String(c[0]).includes('/navigate'))!;
    const act = calls.find((c) => String(c[0]).includes('/act'))!;
    expect(bodyOf(nav).url).toBe('https://de.example/search');
    expect(bodyOf(act).instruction).toContain('Acme Corp');
  });

  it('maps an expired entity to inactive', async () => {
    mockFetch.mockImplementation((url: string) =>
      url.includes('/extract') ? ok({ data: { status: 'Expired' } }) : ok({ ok: true }),
    );
    const res = await makeStateWorker(adapters)({ state: 'DE', entityName: 'X' }, ctx);
    expect(res.status).toBe('inactive');
  });

  it('returns notfound without any fetch when no adapter exists for the state', async () => {
    const res = await makeStateWorker(adapters)({ state: 'ZZ', entityName: 'X' }, ctx);
    expect(res.status).toBe('notfound');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('propagates a failed action so the orchestrator can mark it error', async () => {
    mockFetch.mockImplementation((url: string) =>
      url.includes('/extract')
        ? Promise.resolve({ ok: false, status: 500, json: async () => ({ error: 'board down' }) })
        : ok({ ok: true }),
    );
    await expect(makeStateWorker(adapters)({ state: 'DE', entityName: 'X' }, ctx)).rejects.toThrow('board down');
  });
});
