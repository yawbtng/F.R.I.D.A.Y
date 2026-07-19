# F.R.I.D.A.Y Redesign Spec — Browserbase-native, dark-default + light-first-class

> Scope: retheme `projects/F.R.I.D.A.Y/apps/web` from the stock zinc+blue shadcn look to a Browserbase-native system with **OrangeRed #FF4500** as the single owned accent, warm neutrals, and a fully theme-swappable token layer. Dark is the default; light is a fully-designed, AA-compliant Browserbase-paper alternate. Every value below is either sourced from the research or explicitly marked `[INFERRED]`.

---

## 1. Browserbase Design DNA

### 1.1 Palette (name · hex · usage)

**Core accent — the one loud color, used sparingly.**
| Name | Hex | Usage (sourced) |
|---|---|---|
| Browserbase OrangeRed | `#FF4500` | The single brand accent across every property — logo mark, "Run"/"Add website" CTA, headline highlighter block, focus rings, live/running indicators. |
| Orange pressed | `#E63E00` | Hover/active fill on orange (AnimatedButton, marketing buttons). |
| Docs orange | `#F03603` | Mintlify `--primary`; slightly deeper/redder variant for docs icons/links. Treat as same brand hue. |

**Neutrals — warm, not cold. Browserbase never uses pure-gray zinc.**
| Name | Hex | Usage |
|---|---|---|
| Ink / near-black plum | `#260F17` | Primary text on light; warm near-black with a faint maroon tint (browse.sh + plg-dashboard, exact). |
| Warm secondary text | `#575150` | Secondary body (docs). |
| Warm muted text | `#777170` | Footer/meta/muted. |
| Warm faint text | `#A5A09E` | Captions, axis ticks. |
| Cream (marketing) | `#F1F0EC` | Dominant warm off-white section background. |
| Paper (browse.sh) | `#F4F1EE` | Warm page canvas — the "editorial, not dark-mode" signal. |
| Pale cream | `#F8F7F4` / `#FAFAFA` | Lighter neutral surface / skeleton fills. |
| White | `#FFFFFF` | Card/surface fill — white cards *float* on cream. |
| Warm hairline | `#F5EFEE` / `#EDEBEB` | Barely-there warm dividers/borders. |

**Signature cool neutral (light-only brand texture).**
| Name | Hex | Usage |
|---|---|---|
| Periwinkle | `#E2E9F3` | Hero backdrop, secondary pill button, card tint. Browserbase's cool neutral. |
| Periwinkle border | `#C5D3E8` / `#D3DEED` | Hairline card borders; also the **1px inset top-highlight** used for depth-without-shadow. |

**Semantic / data colors (from plg-dashboard, the analytics reference).**
| Name | Hex | Usage |
|---|---|---|
| Terminal/success green | `#71AC38` | `$` CLI prompt lines, positive deltas, goal-met. Olive-lime, not emerald. |
| Error red | `#CE1F02` / `#E5484D` | Negative deltas, failures. |
| Warn yellow | `#F8D06F` / `#F4BA41` | Medium-confidence / warning (tint only — too light for text). |
| Link/active blue | `#4DA9E4` | Source links, info state, ICP tier B. |

**Playful accent spectrum — reserved ONLY for category/status tints so orange stays special.**
`#C4EDFF` sky · `#00B0FF` azure · `#A4F9C6` mint · `#FFBAFF` pink · `#F4BA41` yellow · `#9C71F0` violet.

**Dark-theme neutrals.** Browserbase's dark surfaces are only exposed via the docs toggle + plg-dashboard `.dark` overrides; the marketing site is light. Sourced dark values (plg-dashboard): `bg #000000`, `bg-top #0C0A0A`, `bg-subtle #161213`, `text-primary #F4F1EF`, `text-secondary #A8A29E`, `border-faint color-mix(#F9F6F4 12%)`. FRIDAY's dark ramp below is built on Tailwind **stone** (warm) to extend these `[INFERRED, anchored to plg-dashboard dark]`.

### 1.2 Typography

**Three-family system (the Browserbase signature).**
- **Display** — `GT Planar` (Grilli Type, licensed) on marketing; **`PP Neue Montreal`** (Pangram Pangram) on Browserbase's own Open Operator. Tight negative tracking. `[foundry inferred on PP]`
- **Body/UI** — `Plain` (Optimo-style humanist grotesque) on marketing; `PP Supply Sans` on Operator; `Inter` fallback.
- **Mono** — `GT Standard Mono` / `PP Supply Mono` / `Paper Mono`. Carries ALL the "developer/API/terminal" signaling: eyebrows, labels, dates, code, telemetry.

**FRIDAY recommendation.** Primary pairing = **PP Neue Montreal (display) + PP Supply Sans (body) + PP Supply Mono (mono)** — this is literally what Browserbase ships on operator.browserbase.com, so it reads native. **No-license fallback** = keep the already-installed **Geist Sans / Geist Mono** with tightened display tracking. Wire both via CSS vars so swapping is a font-file change, not a code change.

**Type scale** (from plg-dashboard's `@utility` scale; negative tracking grows with size, positive on captions/eyebrows):
| Token | Size / line-height | Tracking | Weight | Face |
|---|---|---|---|---|
| `type-jumbo` (hero) | `clamp(2.5rem, 6vw, 5rem)` / 1.05 | −0.02em | 500 | display |
| `type-title` | 1.5rem / 2rem | −0.015em | 500 | display |
| `type-header` (card title) | 1.25rem / 1.75rem | −0.01em | 500 | display |
| `type-large` | 1.125rem / 1.75rem | 0 | 400 | body |
| `type-base` | 1rem / 1.5rem | 0 | 400 | body |
| `type-body` (workhorse) | 0.875rem / 1.25rem | 0 | 400 | body |
| `type-caption` | 0.75rem / 1rem | +0.01em | 400 | body |
| `type-eyebrow` | 0.75rem / 1rem | +0.14em, UPPERCASE | 500 | **mono** |

Weight discipline: **500 is the workhorse** (Browserbase marketing is almost entirely weight-500), 400 body, 600 for emphasis. Metric numbers use `tabular-nums leading-none`.

### 1.3 Spacing / radii / shadows / borders
- **Spacing:** keep the app's 8px base (`fri-*`). Section rhythm: mono-eyebrow → large headline → grid. Card headers `px-5 py-4`, bodies `p-4`/`p-5`, page gutters `px-5 py-8`.
- **Radii — bimodal, resolved into one scale:** pill `999px` (primary CTAs, status pills), `lg 12px` (cards/modals), `md 8px` (panels), `sm 6px` (inputs/badges), and a reserved **`sharp 0px`** for the "operator/terminal" surfaces (mission-log step cards, install/command blocks) as an intentional browse.sh nod. Browserbase itself ranges 99px pills → 4–6px cards → 0px browse.sh; we codify all three with purpose.
- **Shadows — near-absent.** Depth comes from **hairline border + a 1px inset top-highlight** (`box-shadow: inset 0 1px 0 0 var(--highlight)`, Browserbase's `#C5D3E8 0 -1px 0 0 inset` move), NOT drop shadows. Real shadow is reserved for true overlays (modal `shadow-xl`, dropdown `shadow-sm`).
- **Borders are the primary structuring device:** a 3-tier scale (faint / solid / strong) instead of the current ad-hoc `white/[0.06–0.14]`.

### 1.4 Motion principles
- **ONE signature easing everywhere:** `cubic-bezier(0.3, 0, 0.15, 1)` as `--ease`, applied to `background-color, color, transform, border-radius`. Consistency of curve is what reads "expensive."
- **Pill radius-morph on hover** (transition `border-radius` alongside bg — Browserbase's subtle tactile detail).
- **IO-gated rise-and-fade** on scroll: `opacity 0 + translateY(1rem) → none`, small travel, fast.
- **`blurScaleIn`** (blur + scale-up ~0.22s) + staggered `fadeSlideIn` for results/list items that "resolve into focus."
- **Odometer** rolling-digit counters for live telemetry.
- **`dotBounce`** for AI-thinking, **shimmer** skeletons for streaming.
- **One signature hero effect per surface** (FRIDAY's is the swarm — see §4/§6). Restraint over spectacle.

### 1.5 Iconography
Kill emoji-in-production (`✦ 🛡 ⛶ ⤓ ⎙`). Use the already-installed **lucide-react** line set, orange only for active/live. Mono uppercase **eyebrow labels** for cheap texture. The **macOS traffic-light chrome** (`#FF5F57 / #FEBC2E / #28C840`) is the universal "this is a real browser session" frame — reuse on every live-view surface.

### 1.6 Brand voice + example headlines
Declarative, developer-direct, agent-native, terse, playful, numbers-as-flex. Provocative **two-beat headlines** (negate the obvious, then reframe), with the key phrase in an orange highlighter block.
- **"Don't run one browser. [Run fifty.]"** (swarm reframe; highlight the payoff)
- **"Speak once. [Watch fifty browsers work.]"**
- **"Give your voice [a swarm of browsers.]"** (echoes "Give your agents access to the whole web")

Microcopy stays honest/status-driven ("Assembling the swarm", "12 / 50 states verified", "Needs attention") — warmth without corporate polish.

---

## 2. Token migration + theming architecture (dark default + light first-class)

### 2.1 Strategy
- Semantic tokens live as **CSS variables in `app/globals.css`**. Dark values sit on **`:root`** (default; also active when `<html class="dark">` since `:root` always matches). Light values override under **`.light`** (equal specificity to `:root`, so it must appear *after* `:root` in the file).
- **Tailwind maps color names → `var(--token)`** so components use semantic classes (`bg-surface text-text border-border`) and never raw hex or `friday-*`/`dark:` values.
- **`next-themes`** provides the toggle with a system-preference default, dark fallback, and an inline pre-hydration script → **no FOUC**.

### 2.2 `app/globals.css` — exact variable blocks

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ============ DARK (default) — also applies under html.dark ============ */
:root {
  color-scheme: dark;

  /* surfaces */
  --bg:            #0C0A09; /* warm near-black canvas (stone-950) */
  --surface:       #1C1917; /* raised card (stone-900) */
  --surface-2:     #292524; /* higher elevation / hover (stone-800) */
  --surface-sunken:#0A0908; /* wells, iframe letterbox */

  /* borders */
  --border:        #262220; /* faint hairline */
  --border-strong: #44403C; /* stronger structure (stone-700) */
  --border-accent: #FF4500; /* active/focused border */

  /* text */
  --text:          #F5F3F0; /* warm off-white */
  --text-muted:    #A8A29E; /* stone-400 */
  --text-subtle:   #8A827B; /* meta/timestamps (AA-large) */

  /* accent */
  --accent:        #FF4500;
  --accent-hover:  #FF6A33; /* brightened for dark */
  --accent-pressed:#E63E00;
  --accent-fg:     #FFFFFF; /* text on accent */
  --accent-text:   #FF7A45; /* accent-colored TEXT on dark bg (AA) */
  --accent-glow:   rgba(255,69,0,0.35);
  --accent-pulse:  rgba(255,69,0,0.10);

  /* status: base=dot/border, -fg=text-on-surface (AA), -tint=pill bg */
  --success:#71AC38; --success-fg:#8FD24E; --success-tint:rgba(113,172,56,0.16);
  --warning:#F4BA41; --warning-fg:#F4BA41; --warning-tint:rgba(244,186,65,0.16);
  --error:  #E5484D; --error-fg:  #FF8A8A; --error-tint:  rgba(229,72,77,0.16);
  --info:   #4DA9E4; --info-fg:   #7BC4F0; --info-tint:   rgba(77,169,228,0.16);
  --neutral:#78716C; --neutral-fg:#A8A29E; --neutral-tint:rgba(120,113,108,0.16);

  /* glass — reserved for nav + overlays only */
  --glass-bg:      rgba(28,25,23,0.55);
  --glass-border:  rgba(245,243,240,0.09);
  --glass-highlight:rgba(245,243,240,0.06);

  /* elevation without shadow */
  --highlight:     rgba(245,243,240,0.06); /* inset top hairline */
  --shadow-overlay:0 16px 48px rgba(0,0,0,0.55);
  --shadow-pop:    0 6px 24px rgba(0,0,0,0.45);

  /* window chrome (theme-independent) */
  --wc-red:#FF5F57; --wc-yellow:#FEBC2E; --wc-green:#28C840;

  /* motion + shape */
  --ease: cubic-bezier(0.3, 0, 0.15, 1);
  --dur-fast:120ms; --dur:200ms; --dur-slow:320ms;
  --radius-sm:6px; --radius-md:8px; --radius-lg:12px;
  --radius-pill:999px; --radius-sharp:0px;
}

/* ============ LIGHT — Browserbase paper. Must come AFTER :root ============ */
.light {
  color-scheme: light;

  --bg:            #F4F1EC; /* warm cream canvas */
  --surface:       #FFFFFF; /* white cards float on cream */
  --surface-2:     #FAF8F4; /* subtle raised / hover */
  --surface-sunken:#EFEBE3;

  --border:        #E7E1D6; /* warm hairline */
  --border-strong: #D6CFC2;
  --border-accent: #FF4500;

  --text:          #260F17; /* ink plum */
  --text-muted:    #575150;
  --text-subtle:   #777170;

  --accent:        #FF4500;
  --accent-hover:  #E63E00; /* darken on light */
  --accent-pressed:#CC3700;
  --accent-fg:     #FFFFFF;
  --accent-text:   #C43700; /* accent TEXT that hits AA on cream */
  --accent-glow:   rgba(255,69,0,0.22);
  --accent-pulse:  rgba(255,69,0,0.08);

  --success:#71AC38; --success-fg:#4E7A24; --success-tint:rgba(113,172,56,0.14);
  --warning:#F4BA41; --warning-fg:#8A5A00; --warning-tint:rgba(244,186,65,0.20);
  --error:  #CE1F02; --error-fg:  #CE1F02; --error-tint:  rgba(206,31,2,0.10);
  --info:   #2D7FB8; --info-fg:   #2D7FB8; --info-tint:   rgba(77,169,228,0.14);
  --neutral:#A5A09E; --neutral-fg:#777170; --neutral-tint:rgba(120,113,108,0.10);

  --glass-bg:      rgba(255,255,255,0.72);
  --glass-border:  rgba(38,15,23,0.08);
  --glass-highlight:rgba(255,255,255,0.9);

  --highlight:     #C5D3E8; /* periwinkle inset top-highlight (Browserbase move) */
  --shadow-overlay:0 16px 48px rgba(38,15,23,0.14);
  --shadow-pop:    0 6px 24px rgba(38,15,23,0.10);

  /* window chrome + motion/shape inherited from :root (unchanged) */
}

@layer base {
  * { border-color: var(--border); }            /* hairline default everywhere */
  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-supply, var(--font-geist-sans), system-ui, sans-serif);
    -webkit-font-smoothing: antialiased;
  }
}
```

**AA notes.** Dark: `--text` 17:1, `--text-muted` 7.8:1, `--text-subtle` ≈4.9:1 on `--bg`. Light: `--text` 13:1, `--text-muted` 6.6:1 on cream; `--text-subtle` sits on white surfaces (4.8:1) — use it only on `--surface`, not on `--bg`. `--accent-fg` white-on-orange is **AA-large only** (~3.2:1) → use for bold/≥16px button labels; for small text on orange use `--accent-fg-strong: #1A0A00`. `--warning` is never a text color — always `--warning-fg` + `--warning-tint`.

### 2.3 `tailwind.config.ts` — theme extension

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'], // tokens do the work; `dark:` reserved for rare raw-value exceptions
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'surface-sunken': 'var(--surface-sunken)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        'border-accent': 'var(--border-accent)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        'text-subtle': 'var(--text-subtle)',
        accent: { DEFAULT: 'var(--accent)', hover: 'var(--accent-hover)', pressed: 'var(--accent-pressed)', fg: 'var(--accent-fg)', text: 'var(--accent-text)' },
        success: { DEFAULT: 'var(--success)', fg: 'var(--success-fg)', tint: 'var(--success-tint)' },
        warning: { DEFAULT: 'var(--warning)', fg: 'var(--warning-fg)', tint: 'var(--warning-tint)' },
        error:   { DEFAULT: 'var(--error)',   fg: 'var(--error-fg)',   tint: 'var(--error-tint)' },
        info:    { DEFAULT: 'var(--info)',    fg: 'var(--info-fg)',    tint: 'var(--info-tint)' },
        neutral: { DEFAULT: 'var(--neutral)', fg: 'var(--neutral-fg)', tint: 'var(--neutral-tint)' },
        wc: { red: 'var(--wc-red)', yellow: 'var(--wc-yellow)', green: 'var(--wc-green)' },
      },
      borderRadius: { sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)', pill: 'var(--radius-pill)', sharp: 'var(--radius-sharp)' },
      boxShadow: {
        'inset-top': 'inset 0 1px 0 0 var(--highlight)',
        overlay: 'var(--shadow-overlay)',
        pop: 'var(--shadow-pop)',
        glow: '0 0 24px var(--accent-glow)',
      },
      backgroundColor: { glass: 'var(--glass-bg)' },
      borderColor: { glass: 'var(--glass-border)' },
      transitionTimingFunction: { brand: 'var(--ease)' },
      fontFamily: {
        display: ['var(--font-neue)', 'var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        sans:    ['var(--font-supply)', 'var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-supply-mono)', 'var(--font-geist-mono)', 'monospace'],
      },
    },
  },
} satisfies Config;
```
> For Tailwind opacity modifiers on tokens (`bg-surface/60`), either use the dedicated `--glass-*`/`--*-tint` tokens (preferred) or add RGB-channel companion vars and map with `rgb(var(--bg-rgb) / <alpha-value>)`. Default components should not need `/opacity` on core surfaces.

### 2.4 Theme provider + no-FOUC toggle

```tsx
// app/components/providers/theme-provider.tsx
'use client';
import { ThemeProvider as NextThemes } from 'next-themes';
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="dark" enableSystem
      themes={['light', 'dark']} disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}
```
```tsx
// app/layout.tsx  (remove the hardcoded `dark` class on <html>)
<html lang="en" suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${neue.variable} ${supply.variable}`}>
  <body className="font-sans antialiased bg-bg text-text">
    <ThemeProvider>
      <ConvexClientProvider>{children}</ConvexClientProvider>
    </ThemeProvider>
  </body>
</html>
```
`next-themes` injects an inline pre-hydration script that sets `class="light"`/`"dark"` before first paint; `suppressHydrationWarning` silences the html-class mismatch. Because dark values live on `:root`, SSR/no-JS renders correctly dark; the script only *adds* `light` when needed → **no flash**.

**Toggle lives in the header** (`friday-shell` top bar, right cluster) — icon button, `mounted` guard to avoid hydration mismatch:
```tsx
// app/components/theme-toggle.tsx
'use client';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [m, setM] = useState(false); useEffect(() => setM(true), []);
  if (!m) return <div className="h-8 w-8" />;
  const dark = resolvedTheme === 'dark';
  return (
    <button aria-label="Toggle theme" onClick={() => setTheme(dark ? 'light' : 'dark')}
      className="grid h-8 w-8 place-items-center rounded-md text-text-muted
                 transition-colors duration-200 ease-brand hover:bg-surface-2 hover:text-text">
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
```
*(Tiny-custom alternative if avoiding the dep: a `<script>` in `<head>` doing `try{var t=localStorage.getItem('theme');document.documentElement.classList.add(t||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'))}catch(e){document.documentElement.classList.add('dark')}` + a context that writes the class and `localStorage`.)*

### 2.5 Migration table (every current `friday-*` token → semantic token, both themes)

| Current token | Old value | New semantic token | Dark value | Light value |
|---|---|---|---|---|
| `friday-bg` `--bg-primary` | `#09090b` | `--bg` | `#0C0A09` | `#F4F1EC` |
| `friday-secondary` | `#18181b` | `--surface` | `#1C1917` | `#FFFFFF` |
| `friday-tertiary` | `#27272a` | `--surface-2` | `#292524` | `#FAF8F4` |
| `friday-elevated` | `#1c1c1f` | `--surface-2` (merged) | `#292524` | `#FAF8F4` |
| `friday-surface` | `#0d0d0d` | `--surface-sunken` | `#0A0908` | `#EFEBE3` |
| `friday-border` `--border-default` | `#27272a` | `--border` | `#262220` | `#E7E1D6` |
| `--border-subtle` | `#1f1f23` | `--border` (faint) | `#262220` | `#EFEAE1`* |
| `--border-hover` | `#333333` | `--border-strong` | `#44403C` | `#D6CFC2` |
| `--border-active` | `#3b82f6` | `--border-accent` | `#FF4500` | `#FF4500` |
| `friday-text-primary` | `#fafafa` | `--text` | `#F5F3F0` | `#260F17` |
| `friday-text-secondary` | `#a1a1aa` | `--text-muted` | `#A8A29E` | `#575150` |
| `friday-text-muted`/`tertiary` | `#71717a` | `--text-subtle` | `#8A827B` | `#777170` |
| `friday-text-accent` | `#60a5fa` | `--accent-text` | `#FF7A45` | `#C43700` |
| `friday-accent` `--accent-primary` | `#3b82f6` | `--accent` | `#FF4500` | `#FF4500` |
| `friday-accent-hover` | `#60a5fa` | `--accent-hover` | `#FF6A33` | `#E63E00` |
| `--accent-glow` | `rgba(59,130,246,.4)` | `--accent-glow` | `rgba(255,69,0,.35)` | `rgba(255,69,0,.22)` |
| `--accent-pulse` `--friday-pulse` | `rgba(59,130,246,.08)` | `--accent-pulse` | `rgba(255,69,0,.10)` | `rgba(255,69,0,.08)` |
| `friday-active` `--status-success` | `#22c55e` | `--success` (+`-fg`) | `#71AC38` / fg `#8FD24E` | `#71AC38` / fg `#4E7A24` |
| `friday-error` `--status-error` | `#ef4444` | `--error` (+`-fg`) | `#E5484D` / fg `#FF8A8A` | `#CE1F02` / fg `#CE1F02` |
| `friday-pending` `--status-warning` | `#f59e0b` | `--warning` (+`-fg`) | `#F4BA41` / fg `#F4BA41` | `#F4BA41` / fg `#8A5A00` |
| `friday-info` `--status-info` | `#3b82f6` | `--info` (+`-fg`) | `#4DA9E4` / fg `#7BC4F0` | `#2D7FB8` / fg `#2D7FB8` |
| `glass-*` white-alpha ramp | `rgba(255,255,255,.03–.12)` | `--glass-bg`/`--glass-border` | `rgba(28,25,23,.55)` / `rgba(245,243,240,.09)` | `rgba(255,255,255,.72)` / `rgba(38,15,23,.08)` |
| `grid-tile` emerald/amber/orange/red/teal (hardcoded) | raw Tailwind | `--success`/`--warning`/`--error`/`--info`/`--neutral` + `--accent` (running) | see status block | see status block |
| traffic-light dots | `#ff5f57/#febc2e/#28c840` | `--wc-red/yellow/green` | same | same (theme-independent) |
| `gradient-text` blue→indigo | `#60a5fa→#3b82f6→#818cf8` | drop for solid `--text` + orange highlighter; if kept: `--accent`→amber | `#FF4500→#FF8A3D→#FFB347` | `#FF4500→#FF8A3D→#FFB347` |

\*`--border-subtle` collapses into `--border`; keep one faint tier + `--border-strong`.

---

## 3. Component restyle guide

All classes below read from semantic tokens → work in both themes automatically. Per-theme call-outs are flagged **⚠︎ theme**.

### 3.1 Header / shell (`components/friday-shell.tsx`)
Target: crisp Browserbase infra bar — flat, hairline-bottom, mono wordmark left, live scoreboard center-right, theme toggle + actions right. Not glassy by default; glass only when it overlays scrolling content.
```
<header class="sticky top-0 z-40 h-14 flex items-center justify-between gap-4 px-5
  border-b border-border bg-bg/80 backdrop-blur-md shadow-inset-top">
  wordmark: font-mono text-xs tracking-[0.14em] uppercase text-text-subtle → "F.R.I.D.A.Y"
  scoreboard pills: rounded-pill bg-surface-2 border border-border px-2.5 py-1 text-xs tabular-nums text-text-muted
  actions: icon buttons (lucide) text-text-muted hover:bg-surface-2 hover:text-text + <ThemeToggle/>
```
Unify `/swarm` onto this same header (it currently rolls its own). `border-active` states → `border-accent`.

### 3.2 Session sidebar (`components/session-sidebar.tsx`)
Target: quiet directory, dot-leader/rows feel. `bg-surface border-r border-border`. Row: `rounded-md px-3 py-2 text-sm text-text-muted hover:bg-surface-2`. Active row: `bg-surface-2 text-text` + 2px `border-l border-l-accent`. "New Session" = primary button (§3.9). Skeletons use `--neutral-tint` shimmer. Relative timestamps `font-mono text-xs text-text-subtle`.

### 3.3 Mission log / live-run panel (`components/live-run-panel.tsx`, `mission-log.tsx`)
Target: the **operator step-rail** — pinned Goal card + streaming step cards, adopted from Open Operator and extended to swarm lanes.
- Pinned Goal card: `bg-info-tint border border-border rounded-md p-3` with mono `GOAL` eyebrow → text-text. (⚠︎ theme: `info-tint` swaps periwinkle-ish on light, cool-blue on dark — both AA behind text-text.)
- Step card (intentional **sharp** operator surface): `rounded-sharp border border-border bg-surface p-3`. Header row: mono `STEP {n}` `text-text-subtle` + tool badge.
- Tool badge (GOTO/ACT/EXTRACT/OBSERVE/CLOSE): `rounded-sm bg-surface-2 border border-border px-1.5 py-0.5 font-mono text-[11px] uppercase text-text-muted`.
- Action line `text-sm font-medium text-text`; `Reasoning:` subline `text-sm text-text-muted`.
- Streaming: `dotBounce` thinking indicator; steps enter with `blurScaleIn` + stagger.

### 3.4 Swarm grid + tile (`components/swarm-grid.tsx`, `grid-tile.tsx`)
Target: a **matrix of mini browser windows** — the single biggest way to beat Open Operator's one-browser view. Grid `gap-4 sm:grid-cols-2 lg:grid-cols-3`. Tile:
```
<article class="group rounded-lg border border-border bg-surface overflow-hidden shadow-inset-top
  transition-colors duration-200 ease-brand hover:border-border-strong">
  chrome bar: h-9 flex items-center gap-1.5 px-3 border-b border-border bg-surface-2
     → 3 dots bg-wc-red/yellow/green + label font-mono text-xs text-text-subtle + host pill
  viewport: aspect-video bg-surface-sunken (live iframe / frozen screenshot)
  footer: status dot + label + timer (tabular-nums)
```
**⚠︎ theme — swarm-tile status colors** (replace the hardcoded `STATUS_META`): tokenized, both-theme, AA. Status → tokens:
| Tile status | Dot/border | Text (`-fg`) | Row tint (`-tint`) |
|---|---|---|---|
| running/working | `--accent` | `--accent-text` | `--accent-pulse` (+ inset-glow pulse) |
| active/verified/done | `--success` | `--success-fg` | `--success-tint` |
| pending/queued | `--warning` | `--warning-fg` | `--warning-tint` |
| blocked | `--warning` | `--warning-fg` | `--warning-tint` |
| notfound/inactive | `--neutral` | `--neutral-fg` | `--neutral-tint` |
| error | `--error` | `--error-fg` | `--error-tint` |
Working tile: `ring-1 ring-accent/40` + inset accent-glow pulse. Focus overlay on hover: `bg-bg/40` + centered "Focus" button.

### 3.5 Browser / live-view chrome (`components/browser-modal.tsx`, `browser-preview.tsx`)
The embedded Browserbase iframe content is external and **cannot be themed** — theme only the surrounding chrome. Frame: `rounded-lg border border-border bg-surface shadow-overlay`, chrome bar as §3.4, iframe on `bg-surface-sunken` letterbox. **⚠︎ theme:** in light the chrome = white surface + warm border; in dark = `surface-2` + faint border. Keep `sandbox="allow-same-origin allow-scripts allow-forms"` + `referrerPolicy="no-referrer"`, and the devtools URL swap (`inspector.html` → `devtools-internal-compiled/index.html`) unchanged. Escape-to-close.

### 3.6 Artifact / report modal (`components/artifact-modal.tsx`)
This is the demo-defining deliverable — make it **print-grade branded**. Overlay `bg-bg/60 backdrop-blur-sm`; panel `max-w-3xl rounded-lg border border-border bg-surface shadow-overlay`. Header: mono eyebrow `VERIFICATION REPORT` + title. Segmented StatusBar uses status tokens (not raw Tailwind). ItemRows: verified rows `bg-success-tint`, needs-attention `bg-warning-tint`, both with `-fg` text. Replace emoji buttons (`⤓ Markdown`, `⎙ PDF`) with lucide `Download`/`Printer` in secondary buttons. **⚠︎ theme:** force the **PDF/print export to light** (`.light` scope on the print root) so exported documents are always the crisp white paper report regardless of app theme — reviewers screenshot these.

### 3.7 Voice orb (`components/agents-ui/agent-audio-visualizer-aura.tsx`, `audio-orb.tsx`)
Move the hardcoded `#3B82F6` uniform to the token: read `getComputedStyle(document.documentElement).getPropertyValue('--accent')` (and re-read on theme change) and feed it to the GLSL color uniform → the orb becomes **OrangeRed** in both themes. **⚠︎ theme — orb glow:** dark uses `--accent-glow rgba(255,69,0,.35)` (hot halo reads great on near-black); light drops to `rgba(255,69,0,.22)` and adds a faint periwinkle ambient ring so the orb doesn't blow out on cream. Idle = slow breathe; listening = concentric rings; speaking = amplitude-driven. This is FRIDAY's one signature motif — let everything else recede.

### 3.8 Planning loader (`components/planning-loader.tsx`)
"Assembling the swarm" radar: recolor sonar pings/orbiting nodes to `--accent` + `--accent-pulse`; core pulse `bg-accent shadow-glow`. Status line shimmer uses `--neutral-tint`. Single easing `ease-brand` throughout.

### 3.9 Buttons
```
Primary  : rounded-pill bg-accent text-accent-fg px-4 py-2 text-sm font-medium
           shadow-inset-top transition-[background-color,border-radius,transform] duration-200 ease-brand
           hover:bg-accent-hover hover:rounded-lg active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent
Secondary: rounded-pill border border-border bg-surface text-text hover:bg-surface-2
Ghost    : rounded-md text-text-muted hover:bg-surface-2 hover:text-text
```
The **radius-morph** (`hover:rounded-lg` on a pill) is the Browserbase tactile detail. Primary CTAs carry an inline `⌘↵` chip: `ml-2 rounded-sm bg-black/10 dark:bg-white/10 px-1 font-mono text-[11px]`.

### 3.10 Inputs
```
rounded-md bg-surface border border-border px-4 py-2.5 text-sm text-text
placeholder:text-text-subtle focus:border-border-accent focus:ring-2 focus:ring-accent
focus:outline-none transition-colors duration-200 ease-brand
```
Task box mirrors Open Operator: single input with an absolutely-positioned Run button (`pr-[110px]`) and `⌘↵` hint.

### 3.11 Glass cards (reserved — overlays/nav only)
`bg-glass border border-glass backdrop-blur-xl shadow-inset-top`. **⚠︎ theme:** dark glass = warm stone tint + light hairline (`rgba(245,243,240,.09)`); light glass = white tint + dark hairline (`rgba(38,15,23,.08)`). Do **not** put glass on every panel (the current failure); solid `bg-surface` is the default, glass is the exception for nav-over-content and modal scrims.

---

## 4. Landing page spec (`app/(marketing)/page.tsx` or `app/page.tsx`)

New route, ordered top→bottom. Copy is **direction**, not final prose. One loud accent, flat color-blocking, one signature hero effect.

1. **Announcement bar** — thin mono strip. Direction: "F.R.I.D.A.Y · voice-driven browser swarm on Browserbase · try the demo →". `bg-surface-2 border-b border-border`, mono `text-xs`. *Motion:* none (static, fast).
2. **Nav** — glass-over-content (§3.11), mono wordmark + `Try Friday` primary pill + GitHub ghost + theme toggle. *Motion:* scroll-linked bg/border alpha ramp (keep existing pattern, retune to tokens).
3. **Hero** — periwinkle-ish canvas (`--surface-2` light / `--bg` dark). Headline two-beat with orange highlighter on the payoff phrase: **"Don't run one browser. [Run fifty.]"** Subcopy direction: one line, plain voice — "Speak a command; watch a swarm of cloud browsers verify it in parallel; hear the answer." Dual CTAs: primary pill `Start a swarm →`, secondary `Watch it run`. *Signature motion:* **etch-trail hero** — a canvas that "draws in" a live 50-node swarm map / SoS grid (composite the aura orb + animated node reveal), `.webp` poster + `prefers-reduced-motion` static fallback. This is FRIDAY's owned hero effect.
4. **Live demo** — embed the actual product (task box → Run → live swarm tiles), the strongest proof for an agent app. Frame in traffic-light chrome. Direction eyebrow: "SEE IT WORK". *Motion:* real agent activity is the animation; tiles enter with `blurScaleIn` stagger.
5. **Bold statement** — single large manifesto line. Direction: reframe scale — "One voice. Fifty browsers. Zero tabs." *Motion:* IO rise-and-fade.
6. **How it works** — 3 numbered steps (`01 Speak → 02 Swarm → 03 Report`), each a mock visual (voice orb / grid / report). Mono step numerals. *Motion:* staggered rise-and-fade per card.
7. **Features (bento)** — Browse / Search / Extract / Converse / Runs-on-Browserbase. Flat cards `bg-surface border border-border shadow-inset-top`, mono labels, lucide icons in orange. *Motion:* subtle `bento-shine` sweep on hover, retuned to `--accent`.
8. **Social proof / telemetry** — **odometer** counter of a real number (browsers spawned / states verified / tasks completed) + a "Built on Browserbase" attribution chip (orange square + wordmark). *Motion:* rolling-digit odometer on scroll-into-view.
9. **CTA band** — centered, orange-forward. Direction: "Give your voice a swarm." primary pill + GitHub. *Motion:* radial `--accent-glow` breathe.
10. **Footer** — oversized brand stamp (giant orange `F` / wordmark block, echoing Browserbase's footer `B`) above link columns + MIT/showcase line. *Motion:* none.

Mount only intentional sections; delete/retire the orphan landing components (`social-proof` unmounted, `typewriter`, `ambient-glow`) or fold them in deliberately.

---

## 5. Execution plan (file-by-file, phased — app never breaks)

**Phase 1 — Tokens (both themes) + provider + toggle, no FOUC.** *Must land light AND dark palettes before any component migrates.*
- `app/globals.css` — replace `:root` block with the dark token set on `:root` + light overrides in `.light` (§2.2). Keep old `friday-*` vars temporarily aliased to the new ones so unmigrated components don't break. **Risk: high blast radius (every surface), but additive** — old classes still resolve via aliases.
- `tailwind.config.ts` — add semantic color/radius/shadow/font mappings (§2.3); keep `friday-*` colors until Phase 2 done. **Risk: low.**
- `app/components/providers/theme-provider.tsx` (new), `app/layout.tsx` — remove hardcoded `dark` on `<html>`, add `suppressHydrationWarning`, wrap in `ThemeProvider`, wire display/mono font vars. Add `next-themes` dep. **Risk: medium (hydration) — verify no FOUC in both themes + no console mismatch.**
- `app/components/theme-toggle.tsx` (new) → mount in `components/friday-shell.tsx` header. **Risk: low.**
- ✅ Gate: toggle flips dark↔light with no flash; existing pages still render via aliases.

**Phase 2 — Shared components → semantic tokens.** (No visual regressions; each file swaps `friday-*`/raw-hex/`white/[..]`→ tokens.)
- `components/friday-shell.tsx` (header/shell + unify `/swarm` header), `session-sidebar.tsx`, `live-run-panel.tsx` + `mission-log.tsx`, `swarm-grid.tsx` + `grid-tile.tsx` (kill hardcoded `STATUS_META` → status tokens), `browser-modal.tsx` + `browser-preview.tsx`, `artifact-modal.tsx` (+ `lib/report` print-light scope), `planning-loader.tsx`, `command-center.tsx` (fix `listening|listening` bug), `plan-review.tsx`, shared buttons/inputs. Voice orb: `agents-ui/agent-audio-visualizer-aura.tsx` + `audio-orb.tsx` (read `--accent` uniform, theme-aware glow). Replace emoji with lucide across all. **Risk: medium per file, isolated — migrate + eyeball each in both themes; grid-tile + artifact-modal are the highest-value/highest-risk.**
- ✅ Gate: every shared surface AA-checked in light + dark; remove `friday-*` aliases from globals once no references remain.

**Phase 3 — App pages.**
- `app/friday/page.tsx` (flagship), `app/workspace/page.tsx` (retire legacy CommandCenter path onto shell), `app/swarm/page.tsx` (drop bespoke header → FridayShell). **Risk: low-medium (composition only, components already migrated).**
- ✅ Gate: three surfaces visually unified, one shell/chrome/control-bar in both themes.

**Phase 4 — Landing.**
- `app/page.tsx` (or new `app/(marketing)/page.tsx`) + `components/landing/*`: retheme nav/hero/demo/bento/how-it-works/cta/footer to tokens; build etch-trail hero + odometer; mount only intentional sections, delete orphans; consolidate to one animation lib + `--ease`. **Risk: contained to marketing route.**
- ✅ Gate: landing renders correct in both themes; reduced-motion fallback verified.

---

## 6. "Sleek & cool" interaction wishlist (grounded in the motion study)

- **One easing token, everywhere:** `--ease: cubic-bezier(0.3,0,0.15,1)` on bg/color/transform/**border-radius**. This alone reads "expensive."
- **Pill radius-morph:** primary buttons transition `border-radius` on hover (pill → `lg`) alongside bg.
- **Etch-trail hero:** canvas that draws in the swarm/SoS map (composite orb + node reveal), poster `.webp` + `prefers-reduced-motion` static fallback — FRIDAY's owned signature.
- **Aurora/gradient restraint:** no rainbow. A single orange radial `--accent-glow` behind the orb and CTA band; optional faint periwinkle ambient in light mode only.
- **Grain/texture:** keep a subtle SVG grain (`.glass-noise`) but **only** on glass overlays, at low opacity per theme (lighter on light, heavier on dark) — not on every panel.
- **Glass — reserved:** backdrop-blur only for nav-over-content + modal scrims, with theme-specific tint/border (§3.11).
- **Hover/press feedback:** text/icons → `--accent` on hover (0.1s); primary darkens/brightens to `--accent-hover`; ghost fills `--surface-2`; `active:scale-[0.98]`.
- **Entrance/scroll:** IO-gated **rise-and-fade** (`opacity 0 + translateY(1rem)`), ~1rem travel, fast.
- **Results resolve into focus:** streaming KYB rows / swarm tiles use **`blurScaleIn`** (blur+scale ~0.22s) + staggered `fadeSlideIn` (0.32s/0.52s).
- **Depth without shadows:** hairline border + `shadow-inset-top` (periwinkle on light, faint white on dark). Real shadow only on overlays.
- **Telemetry odometer:** rolling-digit counter for live swarm metrics (browsers spawned, states verified).
- **AI thinking = `dotBounce`; loading = shimmer** skeletons sized to final content (no layout shift).
- **Keyboard-shortcut chip inside the primary button** (`Run ⌘↵`) and visible `kbd` chips (`⌘K`, `ESC`) for operator-tool credibility.

---

# Adversarial Critique (P1/P2 punch list)

# F.R.I.D.A.Y Redesign Spec — Prioritized Review Punch List

Reviewed spec §1–6 against all 6 research findings + current-app inventory. Contrast ratios below are computed, not asserted.

## Fidelity (spec vs. actual Browserbase)

- **P2 — Periwinkle is named "signature" but has no surface token.** §1.1 calls `#E2E9F3` "Browserbase's cool neutral"; §4 hero + §3.3 lean on it — but the token system only uses periwinkle as light `--highlight #C5D3E8`. Light `--surface-2` is `#FAF8F4` (cream), so the "periwinkle-ish hero canvas" (§4.3) is un-buildable. Fix: add a `--surface-accent`/periwinkle token (`#E2E9F3`) if the hero/Goal-card are meant to echo Browserbase.
- **P2 — "Browserbase never uses pure-gray zinc" is overstated.** Open Operator + docs (both BB properties) use cool Tailwind gray-50/200/900 and `#111827`. The warm-neutral rule is a *marketing-site* truth. Fix: soften the claim; it's brand *direction*, not universal.
- **P2 — "PP Supply Mono is literally what operator ships" is unsupported.** Repo source-of-truth (tailwind.config read) shows operator = Inter (body base) + PP Neue (headings) + PP Supply **Sans** (UI); "PP Supply Mono" is only a *visual inference* from the live study. Fix: label the mono choice `[INFERRED]`, keep Geist Mono as the real default.
- **P2 — inset-highlight direction inverted.** Research/quote is `#C5D3E8 0 -1px 0 0 inset` (bottom); spec implements `inset 0 1px 0 0` (top). Cosmetic but it's presented as "Browserbase's exact move." Fix: match `0 -1px 0 0 inset` or drop the "exact" framing.
- **P2 — dark-default cuts against the single most distinctive BB signal.** Every studied property is light/warm-paper by default ("editorial, not dark-mode" is called the brand tell). Defaulting FRIDAY to dark is defensible (it's an app), but "Browserbase-native + dark-first" is in tension. Fix: acknowledge explicitly; keep light truly first-class (it is).
- Accent/status **-fg tints** (`#FF6A33 #FF7A45 #C43700 #CC3700 #8FD24E #FF8A8A #7BC4F0 #4E7A24 #8A5A00 #2D7FB8`) are **invented for AA**, not Browserbase values — legitimate, but must be contrast-verified (see below), not assumed native. `#E5484D` is sourced as the *Incident* category color, not a general error red — fine, note the provenance.

## Light + Dark (token system)

- **P1 — `--info-fg` light `#2D7FB8` FAILS AA.** ≈3.9:1 on cream, ≈4.3:1 on white — under 4.5 for normal text/links. Fix: darken to ~`#1F6699` (`#1E6091`).
- **P1 — Primary button label fails AA.** §3.9 uses `text-accent-fg` (white) at `text-sm font-medium` (14px/500) on orange = **~3.4:1**; spec's own note says white-on-orange is "AA-large only." 14px/500 is not "large." Fix: use `--accent-fg-strong #1A0A00` for the label, or bump to ≥16px **bold**.
- **P1 — opacity modifiers on hex-valued CSS-var colors won't compile.** §3.1 `bg-bg/80`, §3.4 `bg-bg/40`, §3.6 `bg-bg/60`, §3.11 implied `bg-surface/60` — Tailwind can't apply `/xx` to `colors.bg = 'var(--bg)'` (produces `rgb(#0C0A09 / .8)`, invalid). §2.3 admits this yet three components rely on it. Fix: add dedicated `--scrim`/`--nav-bg` tokens (and `--bg-rgb` channel companions) for every translucent surface.
- **P2 — dark structural hairline is near-invisible.** `--border #262220` on `--bg #0C0A09` is barely lighter than the canvas; the current app used `white/[0.06–0.14]` precisely because solid dark borders vanish. Global `* { border-color }` makes every default border this faint. Fix: lift dark `--border` a step, or outline cards with `--border-strong`.
- **P2 — `text-subtle` lands on `--bg` in light in real components.** §3.1 wordmark + §3.2/§3.4 timestamps use `text-text-subtle`; light `#777170` = ~4.25:1 on cream and ~4.4:1 on `--surface-2`, both under 4.5 (spec's own note bans it off `--surface`). Fix: use `--text-muted` for these labels, reserve `text-subtle` for ≥18px/decorative.
- **P2 — `dark:` utilities won't fire on no-JS first paint.** `dark:bg-white/10` (CTA chip), etc., need class `dark`; tokens render dark via `:root` but `dark:` variants stay off until next-themes' script adds the class. Fine with JS; edge case without. Fix: express these via tokens, not `dark:`.
- FOUC/toggle/provider are **concretely and correctly specified** — dark on `:root`, light `.light` after it, `suppressHydrationWarning`, blocking inline script, `mounted` guard, remove hardcoded `dark`. This part is sound.
- **P2 — `blocked` and `pending` both map to `--warning`** → visually identical, losing the swarm's "needs attention vs queued" distinction (current app split orange/amber). Fix: give `blocked` its own token/icon (e.g., `--warning` + alert glyph, or `--error-tint`).

## Feasibility (Next 15 + Tailwind + framer-motion)

- **P1 — 50-state swarm × live iframes has no cap/virtualization.** Grid is `sm:2 / lg:3` cols; 50 live Browserbase iframes = 50 full page contexts → memory/CPU collapse (findings already saw one live iframe's WS fail). Fix: only stream N on-screen tiles live; render the rest as frozen screenshots; virtualize the grid; add a `dense` column mode.
- **P1 — animating `box-shadow` glow-pulse on every running tile.** §3.4/§6 pulse the inset accent-glow; box-shadow animation forces per-frame repaint across N tiles atop live iframes → jank. Fix: pulse a pseudo-element `opacity`/`transform` ring instead; gate to visible+running tiles.
- **P2 — orb `getComputedStyle('--accent')` needs plumbing.** Returns a hex string (possibly leading space) — must trim + parse hex→vec3 [0..1] for the GLSL uniform, and re-read on theme change via a `resolvedTheme` effect/MutationObserver, else color goes stale on toggle. Must be client-only. Fix: add parse + re-read hook.
- **P2 — licensed fonts.** GT Planar / PP Neue / PP Supply are all commercial; layout wires `neue`/`supply` loaders that need `.otf` files present. Fix: ship **Geist** as the real default (spec's fallback), gate PP behind a webfont license — don't reference undefined loaders.
- **P2 — two anim libs still installed** (framer-motion v11 + motion v12). Consolidate to one (spec says so — good) and use `initial={false}` where SSR markup differs to avoid hydration flashes.
- **P2 — odometer/etch-trail** must be client + IO-gated; odometer must SSR its final value to avoid layout shift/hydration mismatch; etch-trail (2-video canvas composite) is GPU-heavy — keep the `.webp` poster + reduced-motion path (spec has it), force poster on mobile.

## Sequencing (does the app stay working?)

- **P1 — light mode is visibly broken during the Phase 1→2 window.** Aliases only rescue *tokenized* `friday-*` values; unmigrated components using raw `white/[0.06]` borders, hardcoded `#3B82F6` orb, and grid-tile's emerald/amber/orange Tailwind `STATUS_META` will look wrong on cream until each file is migrated. App *renders* but light ≠ correct. Fix: keep the light toggle behind a flag/"beta" until Phase 2 gate passes; dark-default masks it in the meantime.
- **P2 — alias removal is a footgun.** Phase 2 gate removes `friday-*` aliases "once no references remain" — a stale reference in a Phase 3/4 file will break silently. Fix: `grep -r "friday-\|--bg-primary\|white/\[" ` must return zero before deleting aliases.
- **P2 — removing hardcoded `dark` class** is safe (findings: current `dark` is cosmetic), but audit for any existing `dark:` utility that assumed always-on dark before flipping to toggled.
- Phase ordering (tokens → shared components → pages → landing) is otherwise sound; grid-tile + artifact-modal correctly flagged highest-risk.

## Gaps

- **P1 — tile + swarm lifecycle states undefined.** Spec §3.4 defines *status colors* but not the *states*: queued → connecting → live → **stalled/WS-fail** (a known real failure) → done(frozen) → error; nor the swarm-level **empty** (pre-run) and **completed/results** transitions that Open Operator's EMPTY→ACTIVE→FINISHED research explicitly calls out. Fix: define these states + per-iframe connection-failure placeholder.
- **P2 — mobile behavior unspecified** for swarm grid (50 iframes on phone = untenable), right rail, and the `max-w-3xl` report modal. Fix: mobile = frozen thumbnails tap-to-live, right panel as drawer, modal as full-screen sheet.
- **P2 — report modal print/PDF light-scope won't inherit.** Forcing export to `.light` (§3.6) requires the print/PDF document to contain the `.light` token block — a print iframe/`html2pdf` context won't inherit the app's class. Fix: inject the light CSS-var block into the export document explicitly; verify screenshot output.
- **P2 — reduced-motion only handled for the hero.** Pervasive rise-and-fade, `blurScaleIn`, `dotBounce`, odometer, and tile pulse have no `prefers-reduced-motion` gate. Fix: global reduced-motion rule disabling entrance/pulse/roll animations.
- **P2 — orb has no reduced-motion / idle static fallback.** WebGL orb is "the one signature motif" but no still state for reduced-motion or WebGL-unavailable. Fix: static radial-glow fallback.
- **P2 — no favicon / OG / `theme-color` meta.** Findings note current layout ships none; a brand redesign should add the orange mark favicon, OG image, and a `<meta name="theme-color">` that swaps per theme. Fix: add to `layout.tsx` metadata.
- **P2 — iframe hygiene.** No `loading="lazy"`, no `title` (a11y), no X-Frame refused-to-connect fallback, no offscreen throttling — all compound the 50-tile P1. Fix: lazy + title + failure placeholder per iframe.

**Top 7 to fix first:** (1) scrim/glass tokens for all `bg-*/opacity`; (2) button + `--info-fg` light AA failures; (3) cap/virtualize live iframes for the 50-tile swarm; (4) don't animate box-shadow on tiles; (5) gate light toggle until Phase 2; (6) define tile/swarm lifecycle + iframe-fail states; (7) add the missing periwinkle surface token if the hero must read Browserbase.
