import { describe, it, expect, beforeAll } from 'vitest';

// Skip entirely if INTEGRATION env var is not set
const shouldRun = process.env.INTEGRATION === 'true';

describe.skipIf(!shouldRun)('Browser Flow Integration', () => {
  let sessionId: string;
  let token: string;
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  beforeAll(async () => {
    // Create a session
    const res = await fetch(`${APP_URL}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create' }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    sessionId = data.sessionId;
    token = data.token;
    expect(sessionId).toBeTruthy();
    expect(token).toBeTruthy();
  }, 30_000); // 30s timeout for session creation

  it('navigates to a page and returns screenshot', async () => {
    const res = await fetch(`${APP_URL}/api/browser/navigate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ sessionId, url: 'https://example.com' }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.currentUrl).toContain('example.com');
    expect(data.title).toBeTruthy();
    // JPEG base64 starts with /9j/
    expect(data.screenshot).toMatch(/^\/9j\//);
  }, 30_000);

  it('extracts page title', async () => {
    const res = await fetch(`${APP_URL}/api/browser/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ sessionId, instruction: 'What is the page title?' }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.data).toBeTruthy();
  }, 30_000);

  it('takes a screenshot', async () => {
    const res = await fetch(`${APP_URL}/api/browser/screenshot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ sessionId }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.screenshot).toMatch(/^\/9j\//);
  }, 30_000);

  it('observes page elements', async () => {
    const res = await fetch(`${APP_URL}/api/browser/observe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ sessionId, instruction: 'What links are on the page?' }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data.actions)).toBe(true);
  }, 30_000);

  it('rejects unauthorized requests', async () => {
    const res = await fetch(`${APP_URL}/api/browser/navigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, url: 'https://example.com' }),
      // No Authorization header
    });
    expect(res.status).toBe(401);
  });
});
