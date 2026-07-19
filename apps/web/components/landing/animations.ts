// Shared landing motion. One easing vocabulary so every section reads as one system.
// EASE_OUT_EXPO is the entrance curve (soft settle); BRAND_EASE mirrors the CSS --ease
// (cubic-bezier(0.3,0,0.15,1)) used for hover/transform elsewhere. Reduced-motion is
// handled globally in globals.css, so these variants don't need per-component guards.

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
export const BRAND_EASE = [0.3, 0, 0.15, 1] as const;

// IO-gated rise-and-fade: ~1rem travel, fast (§6).
export const riseAndFade = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT_EXPO } },
};

// Alias kept for existing imports.
export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT_EXPO } },
};

export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

// Results "resolve into focus" — blur + scale-up (§6). For streaming tiles / list items.
export const blurScaleIn = {
  hidden: { opacity: 0, scale: 0.96, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.45, ease: EASE_OUT_EXPO },
  },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT_EXPO } },
};

// Standard viewport config for in-view sections (fire once, a little before fully visible).
export const inView = { once: true, margin: '-80px' } as const;
