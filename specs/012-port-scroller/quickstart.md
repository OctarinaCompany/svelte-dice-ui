# Quickstart: validating the Scroller port

How to prove the port works end to end. Run from the repository root. Every command is
non-interactive and terminates.

## Prerequisites

- Node + `pnpm`, dependencies installed (`pnpm install`). **No new npm dependency is introduced by
  this feature** — `tailwind-variants`, `@lucide/svelte`, `bits-ui` and the testing stack are already
  in `package.json`.
- `src/lib/components/ui/direction-provider/` present (already ported; the only first-party
  dependency).

## 1. Quality gates (the definition of done)

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

All five must be clean, with no suppression comment, no `.skip`/`.todo`, and no config change
anywhere (constitution VI/VII). `format` runs first because generated/registry output is not
Prettier-formatted.

To iterate on this component alone while working:

```bash
pnpm run test:unit -- --run src/lib/components/ui/scroller
```

## 2. Registry build

```bash
pnpm run registry:build
```

Expected: `static/r/scroller.json` is produced, contains all five component files (no test files),
and every `$lib/...` import has been rewritten to a registry placeholder. Verify the item appears in
the docs index at `/docs/components` (it is filtered on `type === "registry:ui"`).

## 3. Manual validation of the demo route

`pnpm run build` compiles the route; for a visual pass use a preview server (started manually,
outside an unattended run):

```bash
pnpm run build && pnpm run preview
```

Then open `/docs/components/scroller` and check, one section per upstream example:

| Section (upstream demo)                | What must be visible                                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Default (`scroller-demo.tsx`)          | 100 cards in a fixed-height box; fade at the bottom only at rest, top **and** bottom mid-scroll, top only at the end. |
| Horizontal (`scroller-horizontal-demo.tsx`) | Rendered through the `child` snippet onto the consumer's flex row; fades on the right, then both, then left. Proves `child` mode still measures (research R-05). |
| Hidden scrollbar (`scroller-hidden-demo.tsx`) | No native scrollbar in any browser; wheel, touch and keyboard scrolling still work.                  |
| Navigation (`scroller-navigation-demo.tsx`)   | Only the down chevron at rest; press-and-hold scrolls continuously and stops on release; the chevron disappears at the end and the up chevron appears. |

RTL check (SC-007): wrap the horizontal section in `<DirectionProvider dir="rtl">` (the demo page
includes an RTL example toggle) and confirm the fade and the navigation buttons sit on the content's
true start/end — at rest the fade is on the **left** and the button pointing at hidden content is the
one on the left.

Keyboard check (SC-004): `Tab` to a navigation button, hold `Enter` — the content scrolls
continuously; release — it stops.

## Test coverage matrix

`src/lib/components/ui/scroller/scroller.test.ts` must cover every row. jsdom does no layout, so
metrics are installed with `Object.defineProperty` on the rendered element and a `scroll` event is
dispatched; `scrollTop`/`scrollLeft` are backed by accessor properties so writes are observable
(research "Testing environment notes").

| # | Area                     | Assertions                                                                                                                                 |
| - | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 | Rendering & slots        | Root renders one element with `data-slot="scroller"`; children render; `withNavigation` adds `[data-slot="scroller-wrapper"]` and buttons before the scroller. |
| 2 | Every prop               | `orientation` (both values → `data-orientation` + overflow class), `hideScrollbar` (attribute + scrollbar classes), `size` (→ `--scroll-shadow-size: Npx`), `offset` (gates cues), `withNavigation`, `scrollStep` (exact pixel delta), `scrollTriggerMode` (all three), `dir`, `class` merged last, `style` appended after the custom property, arbitrary `restProps` forwarded. |
| 3 | Edge detection           | At top → `data-bottom-scroll` only; mid → `data-top-bottom-scroll` only (neither single attribute present); at bottom → `data-top-scroll` only; no overflow → none of the six. Horizontal equivalents. Recomputes on `scroll`. |
| 4 | `offset` asymmetry (R-03) | With `offset={40}` and 30 px left below: bottom mask absent **but** the down button still rendered. Pinned deliberately as upstream behaviour. |
| 5 | Upstream quirk (R-09)    | A `vertical` scroller with horizontal overflow still gets `data-left-scroll`/`data-right-scroll`.                                            |
| 6 | Navigation visibility    | Only directions with hidden content render; a direction disappears once exhausted and reappears when content becomes available again.        |
| 7 | Trigger modes            | `click`: one click → exactly one `scrollStep`. `press`: `pointerdown` → repeats every 50 ms (fake timers), stops on `pointerup`, on `pointerleave`, on `pointercancel`. `hover`: `pointerenter` repeats, `pointerleave` stops. |
| 8 | Timer teardown           | Unmounting mid-press clears the interval (no further scroll writes after `advanceTimersByTime`); a direction becoming exhausted unmounts its button and stops its repeat. |
| 9 | Keyboard (D-04)          | `press` mode: Enter and Space `keydown` start the repeat, `keyup` and `blur` stop it. `hover` mode: `focus` starts, `blur` stops. `click` mode: Enter fires exactly one step. |
| 10 | Roles & accessible names | Buttons are `type="button"`, exposed as `getByRole('button', { name: 'Scroll down' })` etc.; the chevron is `aria-hidden`; the container exposes no bogus role; consumer-supplied `role`/`aria-label` on the root are forwarded. |
| 11 | RTL (D-01)               | With `dir="rtl"` (prop) and via `<DirectionProvider dir="rtl">`: horizontal leading content maps to `data-right-scroll` and the right-hand button; scrolled to the RTL end maps to `data-left-scroll`. Vertical is unaffected by `dir`. |
| 12 | `child` snippet          | The snippet receives the full attribute payload; spreading it registers the element, so cues appear on the consumer's element and navigation scrolls it; `children` is not rendered in `child` mode. |
| 13 | `bind:ref`               | `ref` is populated with the rendered element in default mode and stays `null` in `child` mode.                                               |
| 14 | Guard rail               | `<Scroller.Button>` rendered with no `<Scroller.Root>` ancestor throws ``/must be used within `<Scroller.Root>`/``.                          |
| 15 | Module unit tests        | `readScrollMetrics` on a stubbed element; `computeAxisOverflow` for vertical/horizontal × LTR/RTL × offset 0/40 × scrollable/not, including the `startDistance + endDistance` invariant; `observeScrollPosition` measures eagerly, reacts to `scroll`, and its teardown removes the listeners (asserted through `addEventListener`/`removeEventListener` spies, since `ResizeObserver` is a no-op stub); SSR guard returns a no-op teardown. |

Every `it` asserts at least once (`expect.requireAssertions`). Anything needing a real parent
component — `child` snippets, `bind:ref`, the bare-button guard rail, the `<DirectionProvider>`
wrapper — goes through `scroller.test.svelte`, which Vitest does not collect (`include` is
`.{js,ts}`) and which is not listed in `registry.json`.

## Requirement traceability

| Requirement | Validated by                                                                 |
| ----------- | ---------------------------------------------------------------------------- |
| FR-001      | Coverage rows 1, 2 (`orientation`); demo sections Default + Horizontal        |
| FR-002      | Rows 3, 15; SC-003 via the eager measure + `scroll` recompute                 |
| FR-003      | Row 2 (`size`, `offset`), row 4                                              |
| FR-004      | Row 2 (`hideScrollbar`); demo section Hidden scrollbar                        |
| FR-005      | Rows 1, 6; demo section Navigation                                           |
| FR-006      | Rows 7, 8, 9                                                                 |
| FR-007      | Row 11; manual RTL check above                                               |
| FR-008      | Rows 12, 13; demo section Horizontal (uses `child`)                          |
| FR-009      | Row 2 (`class`/`style`/restProps), row 3 (data attributes)                   |
| FR-010      | Row 15 + the module contract in `contracts/public-api.md`                    |
| FR-011      | Step 2 (`registry:build`) + the barrel import styles                         |
| FR-012      | Step 3 (all four demo sections)                                              |
