'use client';

import { useState } from 'react';
import { VoiceSession } from '@/components/voice-session';

export default function Home() {
  const [sessionId, setSessionId] = useState('');
  const [token, setToken] = useState('');
  const [debugUrl, setDebugUrl] = useState('');
  const [url, setUrl] = useState('https://news.ycombinator.com');
  const [screenshot, setScreenshot] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function createSession() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSessionId(data.sessionId);
      setToken(data.token);
      setDebugUrl(data.debugUrl || '');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setLoading(false);
    }
  }

  async function navigate() {
    if (!sessionId || !token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/browser/navigate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId, url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setScreenshot(data.screenshot);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Navigation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-friday-bg p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-semibold text-friday-text-primary tracking-tight">
          F.R.I.D.A.Y. — Phase 1 Test
        </h1>

        {/* Session Controls */}
        <div className="space-y-3">
          <button
            onClick={createSession}
            disabled={loading || !!sessionId}
            className="px-4 py-2 bg-friday-accent text-white rounded-lg disabled:opacity-50 hover:bg-friday-accent/80 transition"
          >
            {sessionId ? 'Session Active' : 'Create Session'}
          </button>

          {sessionId && (
            <p className="text-sm text-friday-text-secondary font-mono">
              Session: {sessionId}
            </p>
          )}
        </div>

        {/* Navigation */}
        {sessionId && (
          <div className="flex gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter URL..."
              className="flex-1 px-4 py-2 bg-friday-surface border border-friday-border rounded-lg text-friday-text-primary font-mono text-sm focus:outline-none focus:border-friday-accent"
            />
            <button
              onClick={navigate}
              disabled={loading}
              className="px-4 py-2 bg-friday-accent text-white rounded-lg disabled:opacity-50 hover:bg-friday-accent/80 transition"
            >
              {loading ? 'Loading...' : 'Navigate'}
            </button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <p className="text-red-400 text-sm font-mono">{error}</p>
        )}

        {/* Screenshot Display */}
        {screenshot && (
          <div className="border border-friday-border rounded-lg overflow-hidden">
            <img
              src={`data:image/jpeg;base64,${screenshot}`}
              alt="Browser screenshot"
              className="w-full"
            />
          </div>
        )}

        {/* Debug URL */}
        {debugUrl && (
          <details className="text-sm text-friday-text-secondary">
            <summary className="cursor-pointer hover:text-friday-text-primary">
              Debug URL
            </summary>
            <a
              href={debugUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-friday-accent underline font-mono text-xs break-all"
            >
              {debugUrl}
            </a>
          </details>
        )}

        {/* Voice Section */}
        <div className="border-t border-friday-border pt-6 space-y-3">
          <h2 className="text-xl font-semibold text-friday-text-primary">
            Voice Assistant
          </h2>
          <VoiceSession roomName={sessionId || `friday-${Date.now()}`} />
        </div>
      </div>
    </main>
  );
}
