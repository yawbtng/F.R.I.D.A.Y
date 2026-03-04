'use client';

import { useState, useCallback } from 'react';
import { FridayShell } from '@/components/friday-shell';

type OrbState = 'idle' | 'listening' | 'speaking';

export default function Home() {
  const [sessionId, setSessionId] = useState('');
  const [token, setToken] = useState('');
  const [debugUrl, setDebugUrl] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [micActive, setMicActive] = useState(false);

  const sessionActive = !!sessionId;

  const createSession = useCallback(async () => {
    setLoading(true);
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
    } catch {
      // Session creation errors will be handled by a proper toast system later
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTextCommand = useCallback(
    async (command: string) => {
      // If no session yet, create one first
      if (!sessionId) {
        await createSession();
      }
      // Text command handling will be wired to the agent in a future issue
      // For now, treat it as a navigate if it looks like a URL
      if (command.startsWith('http://') || command.startsWith('https://')) {
        if (!sessionId || !token) return;
        setLoading(true);
        try {
          const res = await fetch('/api/browser/navigate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ sessionId, url: command }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setCurrentUrl(command);
          if (data.screenshot) {
            setScreenshotUrl(`data:image/jpeg;base64,${data.screenshot}`);
          }
        } catch {
          // Navigation errors will be handled by a proper toast system later
        } finally {
          setLoading(false);
        }
      }
    },
    [sessionId, token, createSession]
  );

  const handleMicToggle = useCallback(() => {
    setMicActive((prev: boolean) => !prev);
    setOrbState((prev: OrbState) => (prev === 'listening' ? 'idle' : 'listening'));
  }, []);

  return (
    <FridayShell
      sessionActive={sessionActive}
      screenshotUrl={screenshotUrl}
      iframeSrc={debugUrl || undefined}
      currentUrl={currentUrl}
      sessionId={sessionId || undefined}
      isLoading={loading}
      orbState={orbState}
      onTextCommand={handleTextCommand}
      onMicToggle={handleMicToggle}
      micActive={micActive}
    />
  );
}
