import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock global fetch before importing agent-fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Set env before importing
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

describe('agentFetch', () => {
  let agentFetch: typeof import('../../agent/src/lib/agent-fetch.js').agentFetch;
  let setSessionToken: typeof import('../../agent/src/lib/agent-fetch.js').setSessionToken;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamic import — the module reads APP_URL at load time
    const mod = await import('../../agent/src/lib/agent-fetch.js');
    agentFetch = mod.agentFetch;
    setSessionToken = mod.setSessionToken;
    setSessionToken('test-token-123');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends POST with correct headers and body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ currentUrl: 'https://example.com', title: 'Example' }),
    });

    const result = await agentFetch<{ currentUrl: string; title: string }>({
      path: '/api/browser/navigate',
      body: { url: 'https://example.com' },
      sessionId: 'sess-123',
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];

    expect(url).toBe('http://localhost:3000/api/browser/navigate');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token-123');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(result).toEqual({ currentUrl: 'https://example.com', title: 'Example' });
  });

  it('includes sessionId in request body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await agentFetch({
      path: '/api/browser/screenshot',
      body: { quality: 60 },
      sessionId: 'sess-456',
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(callBody.sessionId).toBe('sess-456');
    expect(callBody.quality).toBe(60);
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
        sessionId: 'sess-123',
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
        sessionId: 'sess-123',
      }),
    ).rejects.toThrow('Unknown error');
  });

  it('throws immediately when retryCount >= 2', async () => {
    await expect(
      agentFetch({
        path: '/api/browser/navigate',
        body: {},
        sessionId: 'sess-123',
        retryCount: 2,
      }),
    ).rejects.toThrow('Operation failed after 2 retries');

    // fetch should never be called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('passes abort signal to fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await agentFetch({
      path: '/api/browser/act',
      body: { action: 'click button' },
      sessionId: 'sess-789',
    });

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('setSessionToken', () => {
  it('sets the token used in subsequent agentFetch calls', async () => {
    const mod = await import('../../agent/src/lib/agent-fetch.js');

    mod.setSessionToken('new-token-abc');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await mod.agentFetch({
      path: '/api/browser/observe',
      body: {},
      sessionId: 'sess-100',
    });

    const headers = (mockFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer new-token-abc');
  });
});
