import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface OrbitingCirclesProps {
  className?: string;
  children?: ReactNode;
  reverse?: boolean;
  duration?: number;
  delay?: number;
  radius?: number;
  path?: boolean;
}

export function OrbitingCircles({
  className,
  children,
  reverse,
  duration = 20,
  delay = 10,
  radius = 50,
  path = true,
}: OrbitingCirclesProps) {
  return (
    <>
      {path ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          version="1.1"
          className="pointer-events-none absolute inset-0 size-full"
        >
          <circle
            className="stroke-black/10 stroke-1 dark:stroke-white/10"
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
          />
        </svg>
      ) : null}

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          style={
            {
              '--radius': radius,
              animation: `orbit ${duration}s linear infinite`,
              animationDelay: `${-delay}s`,
              animationDirection: reverse ? 'reverse' : 'normal',
            } as CSSProperties
          }
          className={cn(
            'pointer-events-auto absolute flex transform-gpu items-center justify-center rounded-full border bg-black/10 dark:bg-white/10',
            className,
          )}
        >
          {children}
        </div>
      </div>
    </>
  );
}
