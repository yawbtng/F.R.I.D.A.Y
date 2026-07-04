# Lessons

## "Reuse the existing shell" means MOUNT into it, not rebuild (2026-07-03)

**Mistake:** The locked Phase B plan said "FridayShell becomes THE app; swarm grid is the center."
When I speced the M4 build for a subagent, I wrote "CREATE a new page" with a single-column
layout. It produced a barebones `/friday` that silently dropped the whole command-center shell —
both sidebars (SessionSidebar, MissionLog) and the nicer aura orb. The user caught it immediately.

**Why it slipped:** `tsc` and unit tests were green the entire time — a missing shell is not a
type error. The verification gate (tsc + tests) can't see a visual/structural regression.

**Rules for next time:**
- When a plan locks "reuse component/shell X", the build spec must say **"mount the new logic
  INSIDE X and name the slots to fill"**, never "create a new page".
- Prefer a **non-breaking slot prop** (e.g. `FridayShell` gained optional `center` / `headerRight`)
  so the new surface renders through the existing shell and the old consumer is untouched.
- **Verify UI changes by actually rendering** (dev server + Playwright screenshot), not just tsc.
  A green typecheck told me nothing about the dropped shell.

## The LSP diagnostics in this repo LAG badly — trust a fresh `tsc` only (2026-07-03)

After dependency swaps / big edits, the injected editor diagnostics threw false "no exported
member" and "not assignable" / implicit-any errors 3+ times, each contradicted by a clean
`tsc --noEmit`. Always `rm -f apps/web/tsconfig.tsbuildinfo && npx tsc --noEmit -p apps/web/tsconfig.json`
and trust THAT, not the red squiggles. Subagents also claimed "tsc exit 0" while leaving real
errors — re-verify their typecheck claims yourself.
