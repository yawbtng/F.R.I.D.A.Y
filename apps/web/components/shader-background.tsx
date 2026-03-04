'use client';

import { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

/**
 * Animated concentric ripple background for the landing page hero.
 *
 * Uses layered CSS radial-gradients + keyframe animations for GPU-accelerated
 * concentric rings expanding outward from center. Blue-tinted to match
 * --accent-primary. Fades out as the user scrolls past the hero section.
 */
export function ShaderBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Fade out as user scrolls past hero (0 → 100vh scroll = 1 → 0 opacity)
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 600], [1, 0]);

  return (
    <motion.div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ opacity }}
      aria-hidden="true"
    >
      {/* Base ambient gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 45%, rgba(59,130,246,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Concentric ring layers — each ring expands outward with staggered delays */}
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="absolute top-1/2 left-1/2 rounded-full shader-ring"
          style={{
            width: 200 + i * 160,
            height: 200 + i * 160,
            marginTop: -(100 + i * 80),
            marginLeft: -(100 + i * 80),
            border: `1px solid rgba(59,130,246,${0.08 - i * 0.012})`,
            boxShadow: `0 0 ${20 + i * 10}px rgba(59,130,246,${0.04 - i * 0.006}), inset 0 0 ${20 + i * 10}px rgba(59,130,246,${0.02 - i * 0.003})`,
            animationDelay: `${i * -1.2}s`,
            willChange: 'transform, opacity',
          }}
        />
      ))}

      {/* Central glow pulse */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full shader-pulse"
        style={{
          background:
            'radial-gradient(circle, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0.03) 40%, transparent 70%)',
          willChange: 'transform, opacity',
        }}
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 shader-grid"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59,130,246,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 45%, black 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 45%, black 0%, transparent 70%)',
        }}
      />
    </motion.div>
  );
}
