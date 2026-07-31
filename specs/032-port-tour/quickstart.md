# Quickstart: validating the Tour port

**Feature**: `032-port-tour` | **Date**: 2026-07-31

How to prove the port works. Every command here is non-interactive and terminates.

## Prerequisites

- `pnpm install` already done; Node 20+.
- The vendored upstream at `.reference/diceui` (read-only) for cross-checking behaviour.
- No new dependency is needed — `bits-ui`, `@lucide/svelte` and `tailwind-variants` are installed.

## 1. Quality gates (the acceptance bar — constitution Principle VII)

Run in this order, from the repository root:

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

All five must be clean. A gate made to pass by `@ts-ignore`, `eslint-disable`, `svelte-ignore`,
`as any`, or a skipped/emptied test is an invalid result regardless of exit code.

To iterate on just this component's tests:

```bash
pnpm run test:unit -- --run src/lib/components/ui/tour/tour.test.ts
```

## 2. Scenario coverage map

Each spec user story maps to assertions in `src/lib/components/ui/tour/tour.test.ts`. The six
mandatory areas of `CLAUDE.md` §7 are the floor; the upstream repository ships **no** test file for
`tour`, so there is nothing further to port.

| Spec item                          | How it is proven                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| US1 — walkthrough (P1)             | open the tour, assert the first step's title/description render and the counter reads `1 / 3`; click `Next`, assert the second step's title; `Next` on the last step closes and calls `onComplete` exactly once |
| US2 — accessibility (P1)           | `userEvent.tab()` from the last control wraps to the first; `Shift+Tab` from the first wraps to the last; `Escape` closes; focus returns to the trigger that was focused before opening; `Enter`/`Space` activate the focused control |
| US3 — controlled (P2)              | render with `open` + `value` + change callbacks that do **not** write back; assert `onValueChange` fires with `1` while the rendered step stays on index `0`; then drive `value` externally and assert the step follows |
| US4 — skip / dismiss (P2)          | `Skip`, `Close`, `Escape`, and an outside `pointerup` each close once and fire `onSkip` with `onComplete` never called; with `dismissible={false}`, `Escape` and the outside interaction leave the tour open |
| US5 — styling / offsets / targets  | a caller class survives on `Tour.SpotlightRing` alongside the component's own; a step without `sideOffset` registers the root's value and one with its own registers that; `target` as a selector and as an `HTMLElement` resolve to the same node |
| RTL (FR-024, SC-005)               | with `dir="rtl"` the root, step, header and footer all carry `dir="rtl"`                                            |
| Guard rails (FR-026)               | `expect(() => render(TourStep)).toThrow(/within/)` and the same for `TourArrow` outside a step                       |
| Geometry (FR-016/017/018, SC-003)  | `computeSpotlight`, `isTargetInViewport` and `scrollTargetIntoView` called directly with synthetic rects, a stubbed `window.scrollTo` and a stubbed `matchMedia` — jsdom performs no layout, so this is the only honest way to assert the arithmetic |

Teardown assertions must not go vacuous: when asserting that a listener is removed on unmount, first
assert it *was* live (fire the event and observe the effect), then unmount and assert the second
event does nothing. A bare "callback not called after unmount" passes even when teardown is broken.

## 3. Manual check of the demo route

The demo page is also the acceptance evidence for Principle IX. Build it and inspect the two
sections:

```bash
pnpm run build          # must compile /docs/components/tour
```

`src/routes/docs/components/tour/+page.svelte` carries one `<ComponentPreview>` per upstream example
file:

| Section      | Mirrors                     | What to look for                                                                       |
| ------------ | --------------------------- | -------------------------------------------------------------------------------------- |
| `Default`    | `tour-demo.tsx`             | four steps over a dashboard mock, shared `stepFooter`, spotlight + ring, arrow from step 2 on |
| `Controlled` | `tour-controlled-demo.tsx`  | external Start / Prev / Next buttons, a fourth target that only appears at step 3, no `Tour.Portal` |

The MDX's two code-only examples ("Custom Spotlight Styling", "Global Offset Control") are not
separate upstream demo files; they are reproduced as the ring-class and offset variations exercised
inside the two sections above and documented in the page's prop tables.

## 4. Registry check

```bash
pnpm run registry:build
```

Then confirm `static/r/tour.json` exists, lists all 18 files, and that `registry.json` gained exactly
one entry whose `name` is `tour` — matching the folder slug and the route segment.

## 5. Fast smoke test of the built page

```bash
pnpm run preview --port 4173 &
# visit http://localhost:4173/docs/components/tour, then stop the process
```

Not part of the automated gate; use only when a placement or focus question cannot be settled in
jsdom.
