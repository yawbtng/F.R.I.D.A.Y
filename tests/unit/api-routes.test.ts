import { describe, it, expect, vi, beforeEach } from 'vitest';

// =========================================
// Schema Validation Tests
// =========================================
describe('API Route Schemas', () => {
  let schemas: typeof import('../../apps/web/lib/schemas');

  beforeEach(async () => {
    schemas = await import('../../apps/web/lib/schemas');
  });

  // --- SessionCreateSchema ---
  describe('SessionCreateSchema', () => {
    it('accepts valid create action', () => {
      const result = schemas.SessionCreateSchema.safeParse({ action: 'create' });
      expect(result.success).toBe(true);
    });

    it('accepts create action with optional sessionId', () => {
      const result = schemas.SessionCreateSchema.safeParse({
        action: 'create',
        sessionId: 'sess-123',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid resume action with sessionId', () => {
      const result = schemas.SessionCreateSchema.safeParse({
        action: 'resume',
        sessionId: 'abc123',
      });
      expect(result.success).toBe(true);
    });

    it('rejects resume without sessionId', () => {
      const result = schemas.SessionCreateSchema.safeParse({ action: 'resume' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid action', () => {
      const result = schemas.SessionCreateSchema.safeParse({ action: 'delete' });
      expect(result.success).toBe(false);
    });

    it('rejects empty object', () => {
      const result = schemas.SessionCreateSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // --- NavigateSchema ---
  describe('NavigateSchema', () => {
    it('accepts valid URL with sessionId', () => {
      const result = schemas.NavigateSchema.safeParse({
        sessionId: 'abc',
        url: 'https://example.com',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid URL', () => {
      const result = schemas.NavigateSchema.safeParse({
        sessionId: 'abc',
        url: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing sessionId', () => {
      const result = schemas.NavigateSchema.safeParse({
        url: 'https://example.com',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty sessionId', () => {
      const result = schemas.NavigateSchema.safeParse({
        sessionId: '',
        url: 'https://example.com',
      });
      expect(result.success).toBe(false);
    });
  });

  // --- ActSchema ---
  describe('ActSchema', () => {
    it('accepts valid instruction', () => {
      const result = schemas.ActSchema.safeParse({
        sessionId: 'abc',
        instruction: 'click the button',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty instruction', () => {
      const result = schemas.ActSchema.safeParse({
        sessionId: 'abc',
        instruction: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing sessionId', () => {
      const result = schemas.ActSchema.safeParse({
        instruction: 'click the button',
      });
      expect(result.success).toBe(false);
    });
  });

  // --- ExtractSchema ---
  describe('ExtractSchema', () => {
    it('accepts valid instruction', () => {
      const result = schemas.ExtractSchema.safeParse({
        sessionId: 'abc',
        instruction: 'get the price',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty instruction', () => {
      const result = schemas.ExtractSchema.safeParse({
        sessionId: 'abc',
        instruction: '',
      });
      expect(result.success).toBe(false);
    });
  });

  // --- ObserveSchema ---
  describe('ObserveSchema', () => {
    it('accepts valid instruction', () => {
      const result = schemas.ObserveSchema.safeParse({
        sessionId: 'abc',
        instruction: 'list buttons',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing instruction', () => {
      const result = schemas.ObserveSchema.safeParse({
        sessionId: 'abc',
      });
      expect(result.success).toBe(false);
    });
  });

  // --- SearchSchema ---
  describe('SearchSchema', () => {
    it('accepts valid query', () => {
      const result = schemas.SearchSchema.safeParse({
        sessionId: 'abc',
        query: 'hacker news',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty query', () => {
      const result = schemas.SearchSchema.safeParse({
        sessionId: 'abc',
        query: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing sessionId', () => {
      const result = schemas.SearchSchema.safeParse({
        query: 'hacker news',
      });
      expect(result.success).toBe(false);
    });
  });

  // --- ScreenshotSchema ---
  describe('ScreenshotSchema', () => {
    it('accepts valid sessionId', () => {
      const result = schemas.ScreenshotSchema.safeParse({
        sessionId: 'abc',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty sessionId', () => {
      const result = schemas.ScreenshotSchema.safeParse({
        sessionId: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing sessionId', () => {
      const result = schemas.ScreenshotSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});

// =========================================
// Rate Limiter Tests
// =========================================
describe('Rate Limiter', () => {
  let rateLimit: typeof import('../../apps/web/lib/rate-limit').rateLimit;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../apps/web/lib/rate-limit');
    rateLimit = mod.rateLimit;
  });

  it('allows requests under threshold', () => {
    for (let i = 0; i < 30; i++) {
      expect(rateLimit('192.168.1.1')).toBe(true);
    }
  });

  it('blocks after threshold exceeded', () => {
    for (let i = 0; i < 30; i++) {
      rateLimit('192.168.1.2');
    }
    expect(rateLimit('192.168.1.2')).toBe(false);
  });

  it('tracks IPs independently', () => {
    for (let i = 0; i < 30; i++) {
      rateLimit('ip-a');
    }
    expect(rateLimit('ip-a')).toBe(false);
    expect(rateLimit('ip-b')).toBe(true);
  });

  it('respects custom maxRequests parameter', () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit('ip-custom', 5)).toBe(true);
    }
    expect(rateLimit('ip-custom', 5)).toBe(false);
  });

  it('resets after window expires', () => {
    vi.useFakeTimers();
    try {
      // Exhaust the limit
      for (let i = 0; i < 30; i++) {
        rateLimit('ip-timer');
      }
      expect(rateLimit('ip-timer')).toBe(false);

      // Advance past the 60s window
      vi.advanceTimersByTime(61_000);

      // Should be allowed again
      expect(rateLimit('ip-timer')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

// =========================================
// Auth Tests (api-auth.ts)
// =========================================
describe('API Auth', () => {
  const TEST_SECRET = 'test-secret-for-signing-jwts-1234';

  beforeEach(() => {
    vi.resetModules();
    process.env.AGENT_API_SECRET = TEST_SECRET;
  });

  it('createSessionToken returns a JWT string', async () => {
    const { createSessionToken } = await import('../../apps/web/lib/api-auth');
    const token = await createSessionToken('sess-123');
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  it('validateAgentRequest returns true for valid token', async () => {
    const { createSessionToken, validateAgentRequest } = await import(
      '../../apps/web/lib/api-auth'
    );
    const token = await createSessionToken('sess-abc');

    const req = new Request('http://localhost/api/browser/navigate', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const valid = await validateAgentRequest(req, 'sess-abc');
    expect(valid).toBe(true);
  });

  it('validateAgentRequest returns false for wrong sessionId', async () => {
    const { createSessionToken, validateAgentRequest } = await import(
      '../../apps/web/lib/api-auth'
    );
    const token = await createSessionToken('sess-abc');

    const req = new Request('http://localhost/api/browser/navigate', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const valid = await validateAgentRequest(req, 'sess-different');
    expect(valid).toBe(false);
  });

  it('validateAgentRequest returns false for missing auth header', async () => {
    const { validateAgentRequest } = await import('../../apps/web/lib/api-auth');

    const req = new Request('http://localhost/api/browser/navigate');
    const valid = await validateAgentRequest(req, 'sess-abc');
    expect(valid).toBe(false);
  });

  it('validateAgentRequest returns false for invalid token', async () => {
    const { validateAgentRequest } = await import('../../apps/web/lib/api-auth');

    const req = new Request('http://localhost/api/browser/navigate', {
      headers: { Authorization: 'Bearer invalid.jwt.token' },
    });

    const valid = await validateAgentRequest(req, 'sess-abc');
    expect(valid).toBe(false);
  });
});
