'use client';

// Renders agent-authored Mermaid source. Mermaid needs the DOM and is heavy (~500KB), so it's
// dynamically imported inside the effect — never bundled into the initial load, never run on the
// server. securityLevel:'strict' because the source is model-authored (sanitizes labels, blocks
// click handlers / raw HTML). Malformed source is EXPECTED occasionally (LLMs write bad Mermaid),
// so a parse failure falls back to showing the raw source instead of throwing. Re-renders when the
// source or theme changes; theme follows next-themes so it re-colors in light/dark.

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

// Module-level counter → a fresh, collision-free DOM id per render (mermaid.render injects a temp
// element keyed by id; reusing an id across renders throws).
let renderSeq = 0;

export function MermaidDiagram({ source, className }: { source: string; className?: string }) {
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const src = source.trim();
    if (!src) {
      setSvg('');
      setFailed(false);
      return;
    }
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: resolvedTheme === 'light' ? 'neutral' : 'dark',
        });
        const { svg: out } = await mermaid.render(`fri-mmd-${++renderSeq}`, src);
        if (!cancelled) {
          setSvg(out);
          setFailed(false);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
          setSvg('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, resolvedTheme]);

  if (failed) {
    return (
      <div className={className}>
        <p className="mb-1 text-xs text-text-muted">Couldn&apos;t render this diagram — showing the source.</p>
        <pre className="overflow-x-auto rounded-md border border-border bg-surface-2 p-2 text-[11px] font-mono text-text-muted">
          {source.trim()}
        </pre>
      </div>
    );
  }
  if (!svg) {
    return (
      <div className={className}>
        <div className="h-32 animate-pulse rounded-md bg-surface-2" />
      </div>
    );
  }
  // The SVG is mermaid-sanitized (strict). Center it and constrain to the container width.
  return (
    <div
      className={`overflow-x-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
