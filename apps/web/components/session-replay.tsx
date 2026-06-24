'use client';

import { useEffect, useRef, useState } from 'react';

type ReplayState = 'loading' | 'ready' | 'unavailable';

/** Plays a Browserbase session replay (HLS) in the focus modal. Fetches the .m3u8 via the
 *  proxy route, plays it with hls.js (segments load from pre-signed CDN URLs). Falls back to
 *  the frozen screenshot while loading or if the recording isn't ready yet. */
export function SessionReplay({
  sessionId,
  token,
  poster,
}: {
  sessionId: string;
  token: string;
  poster?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<ReplayState>('loading');

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    let hls: { destroy: () => void } | null = null;

    (async () => {
      try {
        const res = await fetch('/api/browser/replay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data.ready || !data.m3u8) {
          setState('unavailable');
          return;
        }

        const blob = new Blob([data.m3u8], { type: 'application/vnd.apple.mpegurl' });
        objectUrl = URL.createObjectURL(blob);
        const video = videoRef.current;
        if (!video) return;

        const Hls = (await import('hls.js')).default;
        if (cancelled) return;

        if (Hls.isSupported()) {
          const h = new Hls();
          h.loadSource(objectUrl);
          h.attachMedia(video);
          hls = h;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = objectUrl; // Safari native HLS
        } else {
          setState('unavailable');
          return;
        }
        setState('ready');
      } catch {
        if (!cancelled) setState('unavailable');
      }
    })();

    return () => {
      cancelled = true;
      hls?.destroy();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sessionId, token]);

  return (
    <div className="absolute inset-0">
      <video
        ref={videoRef}
        controls
        autoPlay
        muted
        playsInline
        className={`absolute inset-0 w-full h-full bg-friday-bg object-contain ${state === 'ready' ? '' : 'opacity-0'}`}
      />
      {/* Poster fallback while loading / when no replay exists */}
      {state !== 'ready' &&
        (poster ? (
          <img src={poster} alt="result" className="absolute inset-0 w-full h-full object-contain" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-friday-text-tertiary text-sm font-mono">
            no preview
          </div>
        ))}
      {state === 'loading' && (
        <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-mono text-friday-text-tertiary">
          loading replay…
        </div>
      )}
      {state === 'unavailable' && (
        <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-mono text-friday-text-tertiary">
          replay not ready
        </div>
      )}
    </div>
  );
}
