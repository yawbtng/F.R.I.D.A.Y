# AGENTS Notes

## Correction Loop Log

### 2026-03-04 - Landing Hero + Layout Direction
- User feedback: Hero looked AI-generated, readability dropped, and some sections felt right-shifted.
- Pattern to prevent repeat:
  - If using animated/WebGL backgrounds, enforce a darkened readability layer and test headline contrast first.
  - Keep hero primary content centered unless the user explicitly asks for asymmetry.
  - Place product demo immediately after hero when the experience itself is the core proof.
  - Use brand visuals (logos) for social proof instead of only text when asked for stronger visual identity.
- Pre-ship check for landing updates:
  - Hero text passes quick contrast sanity check on brightest animation frame.
  - Section headers and body blocks align to centered grid where intended.
  - Demo appears directly below hero if requested.
  - Visual hierarchy validated at desktop and mobile breakpoints.

### 2026-03-04 - Hydration Mismatch in Orbital Motion Styles
- User feedback: React hydration mismatch in orbital logos from server/client style attribute differences.
- Pattern to prevent repeat:
  - Avoid raw floating-point transform inputs in SSR for animated style props.
  - Precompute and round coordinates used in `style` (for example `toFixed(3)` then `Number(...)`).
  - Prefer deterministic constants/arrays for geometry instead of recomputing values in render paths.
- Pre-ship check for animated SSR components:
  - No hydration warnings in browser console on first load.
  - Server-rendered style values are deterministic and stable across client hydration.

### 2026-03-04 - Orbital Section Visual Centering
- User feedback: Orbital logos did not feel centered around Friday and the center orb felt weak.
- Pattern to prevent repeat:
  - Build orbital layouts from one explicit center coordinate system and derive all child positions from that center.
  - Add center-to-node visual links (subtle radial lines/ring) so hierarchy reads instantly.
  - Use a recognizable, high-quality center primitive (for example `AudioOrb`) instead of plain text-only circles.
- Pre-ship check for orbital sections:
  - Orb center aligns with orbit ring center at desktop and mobile breakpoints.
  - Equal visual spacing of orbit nodes around the center.
  - Center element remains the visual focal point over all orbiting logos.

### 2026-03-04 - Respect Requested Component Pattern
- User feedback: Wanted the specific MagicUI orbiting-circles component instead of a custom orbital implementation.
- Pattern to prevent repeat:
  - When user requests a named component pattern/library, use that pattern directly before custom variants.
  - Implement requested shared primitives in `components/ui` and compose feature sections on top of them.
  - Keep center behavior explicit in layout (agent orb fixed, orbiting items around it).
- Pre-ship check for component swaps:
  - Requested component API/pattern is present in code.
  - Section behavior matches user intent (fixed center + orbiting children).
  - No fallback custom implementation is left in active render path.

### 2026-03-04 - Orbit Motion + Logo Visibility Parity
- User feedback: Orbit circles were not visibly moving and only a subset of logos were visible.
- Pattern to prevent repeat:
  - When porting animation utilities from external examples, do not rely on one toolchain path only (Tailwind utility generation); add a deterministic fallback (global keyframes + explicit animation style) for critical motion.
  - For third-party favicon/logo assets, enforce contrast containers so dark logos remain visible on dark backgrounds.
  - Verify orbit behavior in-browser, not just by build success.
- Pre-ship check for orbit components:
  - Orbit items visibly rotate in both directions where configured.
  - All intended partner logos are visible at first paint and during motion.
  - Center orb remains fixed while only surrounding items animate.

### 2026-03-04 - Orbit Spacing Calibration
- User feedback: Logos felt too close to center and to each other.
- Pattern to prevent repeat:
  - Treat orbital layout as three spacing layers (center orb size, inner radius, outer radius) and tune them together.
  - Increase container/canvas size alongside radius changes to avoid crowding/clipping.
  - Keep a minimum visual gap between center orb edge and first orbiting icon edge.
- Pre-ship check for spacing:
  - Clear separation between center orb and inner ring.
  - Distinct separation between inner and outer rings during motion.
  - No icon overlap at any point in the orbit cycle.

### 2026-03-04 - Orbit Icon Visual Style Parity
- User feedback: Orbit logos should not sit inside square background tiles; should resemble clean floating icons in reference.
- Pattern to prevent repeat:
  - Match visual treatment from requested reference before adding custom containers.
  - Prefer transparent icon presentation with subtle glow over boxed logo chips unless user explicitly asks for chips/cards.
  - Set orbit phase offsets intentionally (for example evenly by ring) to avoid accidental clustering.
- Pre-ship check for icon style:
  - Orbit icons render without extra card/tile backgrounds.
  - Icon spacing appears balanced around each ring during motion.
  - Overall look aligns with the referenced component style.
