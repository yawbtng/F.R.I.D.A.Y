'use client';

import { useEffect, useMemo, useState } from 'react';

interface TypewriterProps {
  commands: string[];
  className?: string;
  typingSpeedMs?: number;
  deletingSpeedMs?: number;
  pauseMs?: number;
}

export function Typewriter({
  commands,
  className,
  typingSpeedMs = 34,
  deletingSpeedMs = 22,
  pauseMs = 1400,
}: TypewriterProps) {
  const safeCommands = useMemo(
    () => (commands.length > 0 ? commands : ['"Say a command"']),
    [commands],
  );
  const [commandIndex, setCommandIndex] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const activeCommand = safeCommands[commandIndex];
    const atEnd = displayed === activeCommand;
    const atStart = displayed.length === 0;

    const delay = isDeleting ? deletingSpeedMs : typingSpeedMs;

    const timer = window.setTimeout(() => {
      if (!isDeleting && atEnd) {
        setIsDeleting(true);
        return;
      }

      if (isDeleting && atStart) {
        setIsDeleting(false);
        setCommandIndex((prev) => (prev + 1) % safeCommands.length);
        return;
      }

      const nextLength = isDeleting ? displayed.length - 1 : displayed.length + 1;
      setDisplayed(activeCommand.slice(0, nextLength));
    }, !isDeleting && atEnd ? pauseMs : delay);

    return () => window.clearTimeout(timer);
  }, [
    commandIndex,
    deletingSpeedMs,
    displayed,
    isDeleting,
    pauseMs,
    safeCommands,
    typingSpeedMs,
  ]);

  return (
    <div className={className} aria-live="polite">
      <span>{displayed}</span>
      <span
        className="ml-0.5 inline-block h-[1em] w-[1px] bg-friday-text-accent align-[-0.1em] animate-pulse"
        aria-hidden="true"
      />
    </div>
  );
}
