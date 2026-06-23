import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock global fetch before importing agent-fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Set env before importing
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

type AgentFetch = typeof import('../../agent/src/lib/agent-fetch.js').agentFetch;

/** Build an error shaped like a fetch abort, so the mock can simulate cancellation. */
function abortError(): Error {
  return Object.assign(new Error('aborted'), { name: 'AbortError' });
}

describe('agentFetch', () => {
  let agentFetch: AgentFetch;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamic import — the module reads APP_URL at load time
    const mod = await import('../../agent/src/lib/agent-fetch.js');
    agentFetch = mod.agentFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends POST with the auth header from the per-call context', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ currentUrl: 'https://example.com', title: 'Example' }),
    });

    const result = await agentFetch<{ currentUrl: string; title: string }>({
      path: '/api/browser/navigate',
      body: { url: 'https://example.com' },
      ctx: { sessionId: 'sess-123', token: 'test-token-123' },
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];

    expect(url).toBe('http://localhost:3000/api/browser/navigate');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token-123');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(result).toEqual({ currentUrl: 'https://example.com', title: 'Example' });
  });

  it('includes the context sessionId in the request body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await agentFetch({
      path: '/api/browser/screenshot',
      body: { quality: 60 },
      ctx: { sessionId: 'sess-456', token: 't' },
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(callBody.sessionId).toBe('sess-456');
    expect(callBody.quality).toBe(60);
  });

  it('uses the token from the call context, not shared module state', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    await agentFetch({ path: '/api/browser/observe', body: {}, ctx: { sessionId: 's1', token: 'token-A' } });
    await agentFetch({ path: '/api/browser/observe', body: {}, ctx: { sessionId: 's2', token: 'token-B' } });

    const h1 = (mockFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    const h2 = (mockFetch.mock.calls[1][1] as RequestInit).headers as Record<string, string>;
    expect(h1['Authorization']).toBe('Bearer token-A');
    expect(h2['Authorization']).toBe('Bearer token-B');
  });

  it('throws on non-ok response with error message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });

    await expect(
      agentFetch({
        path: '/api/browser/navigate',
        body: { url: 'https://example.com' },
        ctx: { sessionId: 's', token: 't' },
      }),
    ).rejects.toThrow('Unauthorized');
  });

  it('throws on non-ok response when json parse fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => { throw new Error('not json'); },
    });

    await expect(
      agentFetch({
        path: '/api/browser/navigate',
        body: {},
        ctx: { sessionId: 's', token: 't' },
      }),
    ).rejects.toThrow('Unknown error');
  });

  it('throws immediately when retryCount >= 2', async () => {
    await expect(
      agentFetch({
        path: '/api/browser/navigate',
        body: {},
        ctx: { sessionId: 's', token: 't' },
        retryCount: 2,
      }),
    ).rejects.toThrow('Operation failed after 2 retries');

    // fetch should never be called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('passes an abort signal to fetch', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    await agentFetch({
      path: '/api/browser/act',
      body: { action: 'click button' },
      ctx: { sessionId: 'sess-789', token: 't' },
    });

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('honors an external abort signal from the context', async () => {
    mockFetch.mockImplementation((_url: string, init: RequestInit) =>
      new Promise((resolve, reject) => {
        const signal = init.signal;
        if (signal?.aborted) return reject(abortError());
        signal?.addEventListener('abort', () => reject(abortError()));
        setTimeout(() => resolve({ ok: true, json: async () => ({ ok: true }) }), 50);
      }),
    );

    const controller = new AbortController();
    const p = agentFetch({
      path: '/api/browser/act',
      body: {},
      ctx: { sessionId: 's', token: 't', signal: controller.signal },
    });
    controller.abort();

    await expect(p).rejects.toThrow('Operation cancelled');
  });

  // CRITICAL regression (eng review test plan #1). The old implementation held a single
  // module-global AbortController and called `currentAbortController?.abort()` on every
  // new request — so launching N workers in parallel collapsed them to one survivor.
  // With per-call contexts, all concurrent requests must complete independently.
  it('runs concurrent fetches with distinct contexts without cancelling each other', async () => {
    mockFetch.mockImplementation((_url: string, init: RequestInit) =>
      new Promise((resolve, reject) => {
        const signal = init.signal;
        if (signal?.aborted) return reject(abortError());
        signal?.addEventListener('abort', () => reject(abortError()));
        // resolve after a tick so all five are genuinely in-flight at once
        setTimeout(() => resolve({ ok: true, json: async () => ({ ok: true }) }), 20);
      }),
    );

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        agentFetch<{ ok: boolean }>({
          path: '/api/browser/navigate',
          body: { i },
          ctx: { sessionId: `sess-${i}`, token: `token-${i}` },
        }),
      ),
    );

    expect(results).toHaveLength(5);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(5);
  });
});
