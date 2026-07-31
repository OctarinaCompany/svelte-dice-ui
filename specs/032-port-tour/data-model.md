# Phase 1 Data Model: Tour

**Feature**: `032-port-tour` | **Date**: 2026-07-31

All reactive state lives in `src/lib/components/ui/tour/tour.svelte.ts`. Two classes, two Symbol
contexts, one step registry, and four pure functions with no reactive dependencies at all.

---

## 1. Value types

```ts
export const TOUR_SIDES = ['top', 'right', 'bottom', 'left'] as const;
export const TOUR_ALIGNS = ['start', 'center', 'end'] as const;

export type TourSide = (typeof TOUR_SIDES)[number];
export type TourAlign = (typeof TOUR_ALIGNS)[number];

/** Upstream `ScrollOffset` (tour.tsx:59-64) — per-edge viewport insets, in pixels. */
export type TourScrollOffset = {
	top?: number;
	bottom?: number;
	left?: number;
	right?: number;
};

/** The spotlight cut-out in viewport coordinates. Upstream `StoreState['spotlightRect']` (309). */
export type TourSpotlightRect = { x: number; y: number; width: number; height: number };

/** What `computeSpotlight` returns: both halves of upstream's `updateMask` (412-429). */
export type TourSpotlightGeometry = { maskPath: string; rect: TourSpotlightRect };

/** Anything a step may name as its target. Upstream also accepts a React ref — no Svelte analogue. */
export type TourTarget = string | HTMLElement;
```

**Constants** (upstream lines 51–53, 372–377):

| Name                         | Value                                       | Upstream |
| ---------------------------- | ------------------------------------------- | -------- |
| `DEFAULT_ALIGN_OFFSET`       | `0`                                         | line 51  |
| `DEFAULT_SIDE_OFFSET`        | `16`                                        | line 52  |
| `DEFAULT_SPOTLIGHT_PADDING`  | `4`                                         | line 53  |
| `DEFAULT_SCROLL_OFFSET`      | `{ top: 100, bottom: 100, left: 0, right: 0 }` | 372-377 |

**Custom event types** (upstream lines 522–527), reproduced verbatim so `preventDefault()` keeps its
documented meaning (research R-07):

```ts
export type TourPointerDownOutsideEvent = CustomEvent<{ originalEvent: PointerEvent }>;
export type TourInteractOutsideEvent = CustomEvent<{ originalEvent: PointerEvent | FocusEvent }>;
export type TourOpenAutoFocusEvent = CustomEvent<Record<string, never>>;
export type TourCloseAutoFocusEvent = CustomEvent<Record<string, never>>;
```

---

## 2. Entity: `TourStepData`

One record per registered `Tour.Step`. Mirrors upstream's `StepData` (lines 287–302) field for
field; every field is a snapshot of the step's resolved props, taken at registration and refreshed
whenever they change.

| Field               | Type                                        | Notes                                             |
| ------------------- | ------------------------------------------- | ------------------------------------------------- |
| `target`            | `TourTarget`                                | resolved lazily — never stored as an element      |
| `side`              | `TourSide`                                  | default `'bottom'`                                |
| `sideOffset`        | `number`                                    | step's own value, else the root's                 |
| `align`             | `TourAlign`                                 | default `'center'`                                |
| `alignOffset`       | `number`                                    | step's own value, else the root's                 |
| `collisionBoundary` | `Element \| null \| (Element \| null)[]`    | default `[]`                                      |
| `collisionPadding`  | `number \| Partial<Record<TourSide, number>>` | default `0` (**not** `bits-ui`'s `8`)           |
| `arrowPadding`      | `number`                                    | default `0`                                       |
| `sticky`            | `'partial' \| 'always'`                     | default `'partial'`                               |
| `hideWhenDetached`  | `boolean`                                   | default `false`                                   |
| `avoidCollisions`   | `boolean`                                   | default `true`                                    |
| `required`          | `boolean`                                   | stored, never read — inert upstream too (spec Assumptions) |
| `onStepEnter`       | `(() => void) \| undefined`                 | fired by `setValue`                               |
| `onStepLeave`       | `(() => void) \| undefined`                 | fired by `setValue`                               |

**Validation**: none at registration — an unresolvable `target` is a render-time condition
(FR-019), not a registration error. Registration never throws.

---

## 3. Entity: `TourStepRegistry` (internal to `TourRootState`)

Upstream's `stepIdsMapRef` + `stepIdCounterRef` + `state.steps` triple (lines 598–599, 687–712).

- Storage is a **plain, non-reactive** array of `{ id: string; data: TourStepData }`, plus two
  `$state` fields: `version` (bumped on every membership change) and `count`.
- `register(data): string` — appends, returns a fresh `step-N` id, bumps.
- `update(id, data): void` — replaces a record in place; bumps only when something actually changed.
- `unregister(id): void` — removes and renumbers, so the indices of later steps shift down by one
  (upstream lines 695–712). No-op for an unknown id.
- `at(index): TourStepData | undefined`, `indexOf(id): number`.

**Why not a `SvelteMap`/`$state` array**: the registering `$effect` in each step both writes to the
registry and (through `count`) is read by siblings; a reactive container would make every register
call invalidate every sibling's effect and loop. The version counter is *assigned* from a plain
private counter, never read-modify-written. This is the `SectionRegistry` pattern from `scroll-spy`
(research R-09).

---

## 4. Entity: `TourRootState`

One instance per `<Tour.Root>`, published on `TOUR_CONTEXT_KEY`.

**Constructor input** — all reactive values arrive as getter functions, never snapshots:

```ts
export type TourRootStateProps = {
	getOpen: () => boolean;
	setOpen: (open: boolean) => void;          // assigns the $bindable + calls onOpenChange
	getValue: () => number;
	setValue: (value: number) => void;         // assigns the $bindable + calls onValueChange
	readonly isOpenControlled: boolean;        // captured before the `??=` seed (research R-04)
	readonly isValueControlled: boolean;
	getDir: () => Direction;
	getSideOffset: () => number;
	getAlignOffset: () => number;
	getSpotlightPadding: () => number;
	getDismissible: () => boolean;
	getModal: () => boolean;
	getAutoScroll: () => boolean;
	getScrollBehavior: () => ScrollBehavior;
	getScrollOffset: () => TourScrollOffset | undefined;
	getStepFooter: () => Snippet | undefined;
	getOnComplete: () => (() => void) | undefined;
	getOnSkip: () => (() => void) | undefined;
	getOnPointerDownOutside: () => ((e: TourPointerDownOutsideEvent) => void) | undefined;
	getOnInteractOutside: () => ((e: TourInteractOutsideEvent) => void) | undefined;
	getOnOpenAutoFocus: () => ((e: TourOpenAutoFocusEvent) => void) | undefined;
	getOnCloseAutoFocus: () => ((e: TourCloseAutoFocusEvent) => void) | undefined;
};
```

**Reactive members**:

| Member           | Kind                          | Meaning                                              |
| ---------------- | ----------------------------- | ---------------------------------------------------- |
| `open`           | `$derived`                    | FR-001                                               |
| `value`          | `$derived`                    | FR-002                                               |
| `stepCount`      | `$derived` (registry `count`) | drives `Tour.StepCounter` and `Next`'s "Finish"      |
| `isLastStep`     | `$derived`                    | `value === stepCount - 1`                            |
| `canGoPrev`      | `$derived`                    | `value > 0` — FR-005                                 |
| `maskPath`       | `$state<string>` (`''`)       | upstream `StoreState.maskPath`                       |
| `spotlightRect`  | `$state<TourSpotlightRect \| null>` (`null`) | upstream `StoreState.spotlightRect`   |
| `dir`, `sideOffset`, `alignOffset`, `spotlightPadding`, `dismissible`, `modal`, `stepFooter` | `$derived` | pass-through of root props |

**Methods** (each reproduces one branch of upstream's `store.setState`):

| Method                          | Behaviour                                                                 |
| ------------------------------- | ------------------------------------------------------------------------- |
| `setOpenState(next)`            | §5 open transition                                                        |
| `setValueState(next)`           | §5 value transition                                                       |
| `goNext()`                      | `setValueState(value + 1)` — FR-004                                       |
| `goPrev()`                      | `if (value > 0) setValueState(value - 1)` — FR-005                        |
| `close()`                       | `setOpenState(false)` — used by `Close` and `Skip` — FR-006               |
| `registerStep` / `updateStep` / `unregisterStep` | delegate to the registry                                 |
| `stepAt(index)`                 | registry read                                                             |
| `setSpotlight(geometry)`        | assigns `maskPath` + `spotlightRect` together (one frame, no tearing)     |
| `clearSpotlight()`              | resets to `''` / `null` when the tour closes                              |

---

## 5. State transitions

### Open (upstream lines 626–642)

```
setOpenState(next):
  if Object.is(open, next) → return                       # no-op guard
  props.setOpen(next)                                     # $bindable + onOpenChange(next)
  if next === true:
      if stepCount > 0 and value >= stepCount → setValueState(0)   # Edge Case: out-of-range reopen
  else:
      if value < stepCount - 1 → onSkip?.()               # FR-006: early close ⇒ skip, not complete
```

Note the asymmetry that produces SC-006: `onComplete` is fired only by the *value* transition, and
the close it triggers happens when `value >= stepCount`, so the `onSkip` predicate
(`value < stepCount - 1`) is false and skip cannot also fire.

### Value (upstream lines 643–678)

```
setValueState(next):
  if Object.is(value, next) → return
  stepAt(value)?.onStepLeave?.()                          # FR-023
  stepAt(next)?.onStepEnter?.()                           # FR-023
  if next >= stepCount:                                   # "Next" on the last step
      onComplete?.()                                      # FR-004, exactly once
      if isValueControlled → props.setValue(next)         # controlled parents still see the index
      setOpenState(false)
      return
  props.setValue(next)                                    # $bindable + onValueChange(next)
  if isValueControlled → return                           # controlled: parent owns the move, no auto-scroll
  if autoScroll and target resolves → scrollTargetIntoView(...)   # FR-016
```

### Spotlight (upstream lines 1038–1070, owned by the active `Tour.Step`)

```
open && isCurrentStep && targetElement
  → setSpotlight(computeSpotlight(target.getBoundingClientRect(), spotlightPadding, viewport))
  → subscribe: window 'resize'  → recompute immediately
               window 'scroll'  → recompute inside one rAF, coalesced (passive)
  → teardown: remove both listeners, cancelAnimationFrame any pending frame     # FR-018
```

---

## 6. Entity: `TourStepState`

One instance per **rendered** `<Tour.Step>`, published on `TOUR_STEP_CONTEXT_KEY` so `Tour.Arrow`
and `Tour.Footer` can find it. Replaces upstream's `StepContext` (lines 465–483).

| Member                | Kind                          | Meaning                                                   |
| --------------------- | ----------------------------- | --------------------------------------------------------- |
| `hasOwnFooter`        | `$state<boolean>` (`false`)   | set by a `Tour.Footer` rendered as the step's own child    |
| `registerFooter()` / `unregisterFooter()` | methods   | upstream's `onFooterChange` (line 472)                    |
| `isDefaultFooter`     | `$state<boolean>`             | upstream's `DefaultFooterContext` (line 485) — a footer rendered from the root's `stepFooter` snippet must not register itself |

Arrow positioning (`arrowX`, `arrowY`, `placedSide`, `placedAlign`, `shouldHideArrow`) is **not**
carried here: `bits-ui`'s floating layer owns it and `Popover.Arrow` consumes it directly through
its own context (research R-01). `Tour.Arrow` keeps the step-context lookup solely to throw the
documented error when used outside a step (FR-026).

---

## 7. Contexts

```ts
const TOUR_CONTEXT_KEY = Symbol('tour');
const TOUR_STEP_CONTEXT_KEY = Symbol('tour-step');

export function setTourContext(state: TourRootState): TourRootState;
export function getTourContext(consumer: string): TourRootState;      // throws
export function setTourStepContext(state: TourStepState): TourStepState;
export function getTourStepContext(consumer: string): TourStepState;  // throws
```

Error messages, matching upstream's `\`${consumerName}\` must be used within \`${ROOT_NAME}\``
(lines 436, 460, 480) in this repo's `<Part>` spelling — FR-026, and asserted by tests:

- `` `<Tour.Step>` must be used within `<Tour.Root>`. ``
- `` `<Tour.Arrow>` must be used within `<Tour.Step>`. ``

Every non-root part passes its own name, so the message always identifies both sides.

---

## 8. Pure functions (no runes, directly unit-testable — research R-10)

| Function                                                  | Upstream       | Returns / effect                                                                  |
| --------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------- |
| `resolveTarget(target)`                                   | 345-358        | `HTMLElement \| null`; `document.querySelector` for a string (first match), the element itself otherwise, `null` when absent or during SSR |
| `computeSpotlight(rect, padding, viewport)`               | 412-429        | `TourSpotlightGeometry`; clamps `x`/`y` at `0` and `width`/`height` to the viewport, then builds the 10-point `polygon(...)` |
| `getDefaultScrollBehavior()`                              | 360-365        | `'auto'` under `prefers-reduced-motion: reduce`, else `'smooth'`; `'smooth'` during SSR — FR-016 |
| `isTargetInViewport(rect, offset, viewport)`              | 383-387        | `boolean`, per-edge — FR-017                                                       |
| `scrollTargetIntoView(element, behavior, scrollOffset)`   | 367-398        | scrolls the window when out of view, clamped at `0`; no-op when already in view    |
