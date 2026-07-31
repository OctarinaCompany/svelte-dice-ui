# Implementation Plan: Tour

**Branch**: `032-port-tour` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/032-port-tour/spec.md`

## Summary

Port Dice UI's **Tour** — a spotlight-and-popover product walkthrough — to Svelte 5 as a 15-part
compound component under `src/lib/components/ui/tour/`.

Technical approach: the root owns `open` and `value` (each controlled *or* uncontrolled) plus the
registered step list in a `TourRootState` class; each `Tour.Step` composes **`bits-ui`'s
`Popover.Root` + `Popover.Content` anchored to its target through `customAnchor`**, which supplies —
prop for prop — the floating placement, collision avoidance, arrow, focus trap, focus restore,
Escape layer and outside-dismiss layer that upstream hand-rolls in 1701 lines of React (research
R-01). Only three things stay bespoke: the spotlight `clip-path` geometry, the target-rect tracking
loop, and the root-level scroll lock (research R-02, justified below). Layer ownership is split
deliberately: `Escape` is handled once at the root (`escapeKeydownBehavior="ignore"` on the content,
research R-05) because upstream's listener works even when no step content is mounted, while the
outside-interaction layer stays on the content and is gated with `interactOutsideBehavior`; the
content's `onOpenChange` is routed back to the root's `close()` so tour state is never bypassed.
Everything is exercised by a colocated test file, a two-example demo route, and one `registry:ui`
entry.

## Technical Context

**Language/Version**: TypeScript 6 (strict) on Svelte 5.56 / SvelteKit 2.63, runes forced on

**Primary Dependencies**: `bits-ui` ^2.18.1 (`Popover.Root`/`Content`/`Arrow`, `Portal`),
`@lucide/svelte` ^1.27 (`X`, `ChevronLeft`, `ChevronRight`), `tailwind-merge` + `clsx` via
`cn()`; in-repo `$lib/components/ui/button` and `$lib/components/ui/direction-provider`

**New npm dependencies**: **none**. Upstream's `@floating-ui/react-dom` and `radix-ui` are both
subsumed by `bits-ui`, which is already installed.

**Storage**: N/A

**Testing**: Vitest 4 (jsdom) + `@testing-library/svelte` 5 + `user-event` 14; `globals: false`,
`expect.requireAssertions` on; setup at `tests/setup.ts`

**Target Platform**: browsers; SSR-safe (portal and all measurement are client-guarded)

**Project Type**: shadcn-svelte registry component + docs route

**Performance Goals**: target-rect tracking coalesced into one `requestAnimationFrame` per scroll
burst (upstream lines 1050–1058); no observer or listener survives teardown

**Constraints**: no `any`, no suppressions, semantic tokens only, no manual `z-index` on the step
(the spotlight and ring keep upstream's `z-50` — see Styling note below); jsdom performs no layout,
so all geometry is verified through exported pure functions (research R-10)

**Scale/Scope**: 15 exported parts, 17 registry files, 2 demo sections, ~40 test cases

## Constitution Check

_Gate evaluated before Phase 0, and re-evaluated after Phase 1 design — verdicts unchanged._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                        |
| ---- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$effect`/`$props`/`$bindable` + snippets only; `TourRootState` and `TourStepState` live in `tour.svelte.ts`; reactive inputs enter as getter functions      |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | `tour.tsx` + `tour.mdx` + both demos read at the pinned commit; every prop, callback, default and `data-*` attribute reproduced (see Public API); 8 divergences recorded in spec |
| III  | Accessibility Is a MUST             | PASS    | Focus trap + focus restore + Escape + `Tab`/`Shift+Tab`/`Enter`/`Space` per the MDX table; RTL via `dir`; `aria-label` on all four controls; step card adds `role="dialog"` + `aria-modal` + `aria-labelledby`/`aria-describedby` (FR-011a, divergence recorded in spec Assumptions); all six §7 areas tested |
| IV   | Composition Over Reimplementation   | PASS    | Placement, collisions, arrow, focus trap/restore, escape, outside-dismiss, portal all composed from `bits-ui`; three bespoke behaviours justified in writing below              |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder, one part per file, `tour.svelte.ts`, `index.ts` barrel with short + prefixed names + types, `.js` imports, one `registry:ui` entry, zero imports from `src/routes`   |
| VI   | TypeScript Strict, No Suppressions  | PASS    | All prop types exported from `<script lang="ts" module>`, derived from `WithElementRef<HTMLAttributes<…>>`; no `any`, no ignore comments, no config edits                       |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit --run` → `build` scheduled as the final task; no skipped or `.todo` tests                                                              |
| VIII | Styling Discipline                  | PASS    | `cn()` everywhere, `tv()` for the step's placement variants, semantic tokens only, `data-slot` on all 14 rendered parts, booleans as `? '' : undefined`                         |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/tour/+page.svelte` with one `<ComponentPreview>` per upstream example **file** (`tour-demo`, `tour-controlled-demo`); the MDX's two code-only examples ("Custom Spotlight Styling", "Global Offset Control") are not separate demo files and are folded into those two sections as ring-class and offset variations, plus five API prop tables (SC-004, quickstart §3) |
| X    | One Feature Directory Per Component | PASS    | All artifacts under `specs/032-port-tour/`; no git write commands; no writes to `.reference/`, `scripts/`, `.port-*`                                                            |

**Bespoke behaviour justification (Principle IV)** — three items, each naming the primitive
evaluated and the capability it lacks (full reasoning in [research.md](./research.md) R-02):

1. **Spotlight geometry** (`computeSpotlight`, upstream `updateMask` lines 412–429). Evaluated
   `bits-ui` `Dialog.Overlay` / `Popover.Overlay`: both are plain full-bleed backdrops with no
   `clip-path` cut-out and no notion of a tracked third element. Written as a pure function so jsdom
   can test the arithmetic.
2. **Target-rect tracking** (`resize` + passive `scroll` + one rAF, upstream lines 1038–1070).
   Evaluated `bits-ui`'s floating auto-update: it tracks the *floating* element's own position and
   exposes no hook for an arbitrary reference element's rect. Also evaluated `observeSections` from
   `scroll-spy` and rejected — see the note below.
3. **Root-level scroll lock** (upstream `useScrollLock` lines 502–520). Evaluated
   `Popover.Content`'s `preventScroll`: it is scoped to content presence, whereas upstream locks on
   `open && modal` at the root so the lock holds even when the active step's target is missing and
   no content is mounted. Running both would give two owners of
   `document.body.style.overflow`. `preventScroll` is therefore left `false`.

**Note on the two anticipated reuses** — the spec's Assumptions expected `scroll-spy`'s
`observeSections` and `scroller`'s `readScrollMetrics` to be consumed here. Reading `tour.tsx` line
by line shows neither fits: upstream implements `hideWhenDetached` with floating-ui's
`hide({ strategy: "referenceHidden" })` middleware (which `bits-ui` exposes directly as the
`hideWhenDetached` prop, so an `IntersectionObserver` would be *both* bespoke and a divergence), and
`onScrollToElement` measures the window, never a scroll container. `getDefaultScrollBehavior` is a
three-line copy in `tour.svelte.ts` — upstream itself duplicates it per component — rather than a
`registryDependencies: ["scroll-spy"]` edge that would drag a five-part component into every Tour
install. The spec's Assumptions have been amended accordingly (research R-06). No shared module is
added or changed by this port.

## Public API

Derived from `.reference/diceui/docs/registry/bases/radix/ui/tour.tsx` at the pinned commit.
Every part additionally accepts the native attributes of its element (spread through `...restProps`),
`ref` (`$bindable(null)`), `class` (merged last), `children`, and a `child` snippet replacing
upstream's `asChild`. "B" marks a `$bindable` prop.

### `Tour` / `Tour.Root` — `tour.svelte` (`<div>`)

| Prop                   | Type                                          | Default                       | B   |
| ---------------------- | --------------------------------------------- | ----------------------------- | --- |
| `open`                 | `boolean`                                     | —                             | ✅  |
| `defaultOpen`          | `boolean`                                     | `false`                       |     |
| `onOpenChange`         | `(open: boolean) => void`                     | —                             |     |
| `value`                | `number`                                      | —                             | ✅  |
| `defaultValue`         | `number`                                      | `0`                           |     |
| `onValueChange`        | `(step: number) => void`                      | —                             |     |
| `onComplete`           | `() => void`                                  | —                             |     |
| `onSkip`               | `() => void`                                  | —                             |     |
| `onEscapeKeyDown`      | `(event: KeyboardEvent) => void`              | —                             |     |
| `onPointerDownOutside` | `(event: TourPointerDownOutsideEvent) => void` | —                             |     |
| `onInteractOutside`    | `(event: TourInteractOutsideEvent) => void`   | —                             |     |
| `onOpenAutoFocus`      | `(event: TourOpenAutoFocusEvent) => void`     | —                             |     |
| `onCloseAutoFocus`     | `(event: TourCloseAutoFocusEvent) => void`    | —                             |     |
| `dir`                  | `'ltr' \| 'rtl'`                              | resolved (provider → DOM → `'ltr'`) |     |
| `alignOffset`          | `number`                                      | `0`                           |     |
| `sideOffset`           | `number`                                      | `16`                          |     |
| `spotlightPadding`     | `number`                                      | `4`                           |     |
| `autoScroll`           | `boolean`                                     | `true`                        |     |
| `scrollBehavior`       | `ScrollBehavior`                              | `getDefaultScrollBehavior()`  |     |
| `scrollOffset`         | `TourScrollOffset`                            | `{top:100,bottom:100,left:0,right:0}` |     |
| `dismissible`          | `boolean`                                     | `true`                        |     |
| `modal`                | `boolean`                                     | `true`                        |     |
| `stepFooter`           | `Snippet`                                     | —                             |     |

Snippets: `children`, `stepFooter` (upstream's `stepFooter?: React.ReactElement`), `child`.
Renders `data-slot="tour"`, `dir`.

### `Tour.Portal` — `tour-portal.svelte` (no element)

| Prop        | Type                     | Default         |
| ----------- | ------------------------ | --------------- |
| `container` | `HTMLElement \| null`    | `document.body` |

Snippets: `children`. Composes `bits-ui`'s `Portal`; inert during SSR.

### `Tour.Spotlight` — `tour-spotlight.svelte` (`<div>`)

| Prop         | Type      | Default |
| ------------ | --------- | ------- |
| `forceMount` | `boolean` | `false` |

`data-slot="tour-spotlight"`, `data-state="open" \| "closed"`, inline `clip-path` from the mask.

### `Tour.SpotlightRing` — `tour-spotlight-ring.svelte` (`<div>`)

| Prop         | Type      | Default |
| ------------ | --------- | ------- |
| `forceMount` | `boolean` | `false` |

`data-slot="tour-spotlight-ring"`, `data-state`, inline `left/top/width/height` from the rect.
Renders nothing until a rect exists.

### `Tour.Step` — `tour-step.svelte` (`<div>`, via `Popover.Content`)

| Prop                | Type                                              | Default     |
| ------------------- | ------------------------------------------------- | ----------- |
| `target`            | `string \| HTMLElement`                           | — (required) |
| `side`              | `'top' \| 'right' \| 'bottom' \| 'left'`          | `'bottom'`  |
| `sideOffset`        | `number`                                          | root's `sideOffset` |
| `align`             | `'start' \| 'center' \| 'end'`                    | `'center'`  |
| `alignOffset`       | `number`                                          | root's `alignOffset` |
| `collisionBoundary` | `Element \| null \| (Element \| null)[]`          | `[]`        |
| `collisionPadding`  | `number \| Partial<Record<Side, number>>`         | `0`         |
| `arrowPadding`      | `number`                                          | `0`         |
| `sticky`            | `'partial' \| 'always'`                           | `'partial'` |
| `hideWhenDetached`  | `boolean`                                         | `false`     |
| `avoidCollisions`   | `boolean`                                         | `true`      |
| `required`          | `boolean`                                         | `false`     |
| `forceMount`        | `boolean`                                         | `false`     |
| `onStepEnter`       | `() => void`                                      | —           |
| `onStepLeave`       | `() => void`                                      | —           |

`data-slot="tour-step"`, `data-side`, `data-align`, `dir`, `tabindex="-1"`. Renders only when
`open && isCurrentStep && (targetResolved || forceMount)`.

### `Tour.Arrow` — `tour-arrow.svelte` (`<span><svg>`)

| Prop     | Type     | Default |
| -------- | -------- | ------- |
| `width`  | `number` | `10`    |
| `height` | `number` | `5`     |

`data-slot="tour-arrow"`. Must be inside a `Tour.Step`.

### `Tour.Header` / `Tour.Title` / `Tour.Description` / `Tour.Footer` — `<div>`

No own props beyond the shared set. `data-slot="tour-header" | "tour-title" | "tour-description" |
"tour-footer"`, each with `dir`. `Tour.Footer` registers itself with the step so a step that
declares its own footer suppresses the root's `stepFooter` snippet.

### `Tour.StepCounter` — `tour-step-counter.svelte` (`<div>`)

| Prop     | Type                                          | Default                             |
| -------- | --------------------------------------------- | ----------------------------------- |
| `format` | `(current: number, total: number) => string`  | ``(c, t) => `${c} / ${t}` ``        |

`data-slot="tour-step-counter"`. `children` overrides the formatted text.

### `Tour.Close` — `tour-close.svelte` (`<button>`)

`type="button"`, `aria-label="Close tour"`, `data-slot="tour-close"`, default child `<XIcon>`.
Click closes the tour (firing `onSkip` when not on the last step). An `onclick` that calls
`preventDefault()` suppresses the close.

### `Tour.Prev` / `Tour.Next` / `Tour.Skip` — `<button>` styled with `buttonVariants()`

| Part   | `aria-label`                       | `variant`   | `data-slot`  | Default content                          | Disabled when      |
| ------ | ----------------------------------- | ----------- | ------------ | ---------------------------------------- | ------------------ |
| `Prev` | `Previous step`                     | `'outline'` | `tour-prev`  | `<ChevronLeft /> Previous`               | `value === 0`      |
| `Next` | `Next step` / `Finish tour` (last)  | `'default'` | `tour-next`  | `Next <ChevronRight />` / `Finish` (last) | —                  |
| `Skip` | `Skip tour`                         | `'outline'` | `tour-skip`  | `Skip`                                   | —                  |

All three accept `variant`/`size` and every native `<button>` attribute, plus `children` to replace
the default content and a `child` snippet to replace the element itself (FR-025). They compose
`buttonVariants()` rather than `button.svelte` because that component renders `children` only and has
no `child` snippet, and the spec's Scope-boundary assumption forbids changing it. `Next` on the last
step fires `onComplete` and closes.

### Exported types and helpers (from `index.ts`)

`TourRootProps`, `TourProps` (alias), `TourPortalProps`, `TourSpotlightProps`,
`TourSpotlightRingProps`, `TourStepProps`, `TourArrowProps`, `TourHeaderProps`, `TourTitleProps`,
`TourDescriptionProps`, `TourFooterProps`, `TourStepCounterProps`, `TourCloseProps`,
`TourPrevProps`, `TourNextProps`, `TourSkipProps`, plus each part's `…ChildProps`;
`TourSide`, `TourAlign`, `TourScrollOffset`, `TourSpotlightRect`, `TourStepData`,
`TourPointerDownOutsideEvent`, `TourInteractOutsideEvent`, `TourOpenAutoFocusEvent`,
`TourCloseAutoFocusEvent`; `TourRootState`, `TourStepState`, `getTourContext`, `setTourContext`,
`getTourStepContext`, `setTourStepContext`; constants `TOUR_SIDES`, `TOUR_ALIGNS`,
`DEFAULT_SIDE_OFFSET` (16), `DEFAULT_ALIGN_OFFSET` (0), `DEFAULT_SPOTLIGHT_PADDING` (4),
`DEFAULT_SCROLL_OFFSET`; pure helpers `computeSpotlight`, `resolveTarget`,
`getDefaultScrollBehavior`, `isTargetInViewport`, `scrollTargetIntoView`.

### Callback ordering contract (upstream `store.setState`, lines 622–681)

- `setValue(next)`: `steps[current].onStepLeave?.()` → `steps[next].onStepEnter?.()` → if
  `next >= steps.length`: `onComplete()`, then `onValueChange(next)` **only when controlled**, then
  close → else `onValueChange(next)`, then auto-scroll **only when uncontrolled**.
- `setOpen(false)`: `onOpenChange(false)`, then `onSkip()` **only when** `value < steps.length - 1`.
- `setOpen(true)`: `onOpenChange(true)`, then reset `value` to `0` when it is out of range.
- Both are no-ops when the next value is `Object.is`-equal to the current one.
- Focus: the **root** captures the pre-open `document.activeElement` when `open` goes false→true, and
  on true→false fires `onCloseAutoFocus` and then restores that element unless the event was
  prevented. The step's `Popover.Content` focus scope owns open-focus and the trap only; its own
  close-restore is suppressed so it does not fire on every step transition.

## Project Structure

### Documentation (this feature)

```text
specs/032-port-tour/
├── plan.md              # This file
├── research.md          # Phase 0 — 10 decisions
├── data-model.md        # Phase 1 — entities, state, transitions
├── quickstart.md        # Phase 1 — how to validate the port
├── contracts/
│   └── tour-api.md      # Phase 1 — the public contract, part by part
├── checklists/
│   └── requirements.md  # from /speckit-specify
└── tasks.md             # Phase 2 — created by /speckit-tasks, not here
```

### Source Code (repository root)

```text
src/lib/components/ui/tour/
├── index.ts                       # barrel: short names + Tour*-prefixed aliases + types
├── tour.svelte                    # Root            ← tour.tsx Tour (555-833)
├── tour-portal.svelte             # Portal          ← TourPortal (1342-1365)
├── tour-spotlight.svelte          # Spotlight       ← TourSpotlight (1269-1300)
├── tour-spotlight-ring.svelte     # SpotlightRing   ← TourSpotlightRing (1306-1335)
├── tour-step.svelte               # Step            ← TourStep (853-1263)
├── tour-arrow.svelte              # Arrow           ← TourArrow (1373-1423)
├── tour-header.svelte             # Header          ← TourHeader (1425-1443)
├── tour-title.svelte              # Title           ← TourTitle (1445-1463)
├── tour-description.svelte        # Description     ← TourDescription (1465-1480)
├── tour-close.svelte              # Close           ← TourClose (1486-1522)
├── tour-footer.svelte             # Footer          ← TourFooter (1656-1682)
├── tour-step-counter.svelte       # StepCounter     ← TourStepCounter (1631-1654)
├── tour-prev.svelte               # Prev            ← TourPrev (1524-1560)
├── tour-next.svelte               # Next            ← TourNext (1562-1596)
├── tour-skip.svelte               # Skip            ← TourSkip (1598-1625)
├── tour.svelte.ts                 # TourRootState, TourStepState, Symbol contexts,
│                                  #   computeSpotlight/resolveTarget/scrollTargetIntoView
│                                  #   ← StoreState/Store (287-343), updateMask (412-429),
│                                  #     getTargetElement (345-358), onScrollToElement (367-398)
├── tour.test.svelte               # test harness (nested-snippet host; repo pattern)
└── tour.test.ts                   # colocated tests — NOT listed in registry.json

src/routes/docs/components/tour/
└── +page.svelte                   # 2 <ComponentPreview> sections + 5 API tables

registry.json                      # append exactly one registry:ui entry
```

**Structure Decision**: 15 part files + one state module, one part per file, each mapped to its
upstream counterpart above. Folder slug `tour` == demo route segment `tour` == registry item name
`tour`. The registry entry lists all 17 non-test files with
`"registryDependencies": ["button", "direction-provider"]` and
`"dependencies": ["bits-ui", "@lucide/svelte"]`; `pnpm run registry:build` runs afterwards.

### Implementation sequencing (for `/speckit-tasks`)

1. `tour.svelte.ts` — types, constants, pure helpers (`computeSpotlight`, `resolveTarget`,
   `getDefaultScrollBehavior`, `isTargetInViewport`, `scrollTargetIntoView`), `TourRootState`
   (step registry, `setOpen`/`setValue` with the exact callback ordering above), `TourStepState`,
   both Symbol contexts with throwing getters.
2. `tour.svelte` (root) — bindable `open`/`value`, controlled detection before the `??=` seed,
   `useDirection`, document Escape listener, bespoke scroll lock, `setTourContext`.
3. `tour-portal.svelte`, `tour-spotlight.svelte`, `tour-spotlight-ring.svelte`.
4. `tour-step.svelte` — registration effect, `Popover.Root`/`Popover.Content` composition,
   `customAnchor`, the outside/auto-focus event bridges (R-07, R-08), the rect-tracking effect,
   the `stepFooter` fallback.
5. Leaf parts: header, title, description, footer, step-counter, close, prev, next, skip, arrow.
6. `index.ts` barrel.
7. `tour.test.svelte` + `tour.test.ts` — the six `CLAUDE.md` §7 areas.
8. `src/routes/docs/components/tour/+page.svelte`.
9. `registry.json` entry + `pnpm run registry:build`.
10. The four quality gates, `pnpm run format` first.

## Styling note (Principle VIII)

`Tour.Step` carries no manual `z-index` — the floating layer owns its stacking. `Tour.Spotlight` and
`Tour.SpotlightRing` keep upstream's `z-50`: they are not overlay *components* with their own
stacking context but bare positioned `div`s that must sit above the page and below the step, so the
class is load-bearing rather than a manual override. Upstream's `bg-black/80` scrim is kept as-is:
`black` is not a theme palette colour but a fixed dimming layer, and it matches this repo's own
overlay precedent (`dialog-overlay.svelte` and `sheet-overlay.svelte` both use `bg-black/10`) —
`bg-foreground/80` would invert to a *light* scrim in dark mode, which is wrong.
`border-ring ring-[3px] ring-ring/50` and `bg-popover` / `text-popover-foreground` are already
semantic and carry over unchanged.

## Complexity Tracking

No constitution violations. The three bespoke behaviours are permitted under Principle IV with the
written justification given above, not carried as violations.
