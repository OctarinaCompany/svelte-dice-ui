# Phase 1 Data Model: Scroller

The three entities named in the spec, expressed as the concrete types the port will declare. No
persistence, no network — every "entity" is either an immutable measurement snapshot or a runes-backed
state object with a component-scoped lifetime.

---

## 1. `ScrollMetrics` — one measurement snapshot (`scroll-position.svelte.ts`)

The complete set of numbers upstream reads off the container, captured in one pass so no derivation
can see a torn mixture of two frames.

| Field          | Type     | Source                  | Notes                                            |
| -------------- | -------- | ----------------------- | ------------------------------------------------ |
| `scrollTop`    | `number` | `element.scrollTop`     | ≥ 0                                              |
| `scrollLeft`   | `number` | `element.scrollLeft`    | negative under RTL in the CSS-standard model     |
| `clientWidth`  | `number` | `element.clientWidth`   | viewport width, padding included, border excluded |
| `clientHeight` | `number` | `element.clientHeight`  |                                                  |
| `scrollWidth`  | `number` | `element.scrollWidth`   | ≥ `clientWidth`                                  |
| `scrollHeight` | `number` | `element.scrollHeight`  | ≥ `clientHeight`                                 |

- `EMPTY_SCROLL_METRICS` — all six fields `0`; the pre-measurement seed. With it, every overflow
  predicate evaluates to `false`, so the first paint shows no cue and no button (correct: nothing is
  known to overflow yet).
- Immutable: `readScrollMetrics()` returns a fresh object; consumers replace, never mutate.

**Validation**: none is enforced at runtime — the values come from the DOM and are trusted, exactly
as upstream trusts them. `Number.isFinite` guards are unnecessary because these six properties are
specified to return finite numbers.

---

## 2. `AxisOverflow` — the reusable detection result (`scroll-position.svelte.ts`)

`computeAxisOverflow(metrics, axis, { offset, dir })` reduces a snapshot to one axis' logical state.
This is the value FR-010 makes reusable; `scroll-spy` and `tour` consume it without knowing anything
about masks.

| Field           | Type      | Definition                                                  |
| --------------- | --------- | ----------------------------------------------------------- |
| `scrollable`    | `boolean` | `scrollSize > clientSize`                                    |
| `startDistance` | `number`  | vertical: `scrollTop`; horizontal: `Math.abs(scrollLeft)`    |
| `endDistance`   | `number`  | `(scrollSize - clientSize) - startDistance`                  |
| `atStart`       | `boolean` | `startDistance <= offset`                                    |
| `atEnd`         | `boolean` | `endDistance <= offset`                                      |

where, for `axis === 'vertical'`, `scrollSize = scrollHeight` and `clientSize = clientHeight`; for
`'horizontal'`, `scrollWidth` / `clientWidth`. `dir` only affects the horizontal axis, and only
through the `Math.abs` normalisation described in research R-04.

**Invariants**: `startDistance + endDistance === max(0, scrollSize - clientSize)`;
`scrollable === false` ⟹ both distances are `0` and both `atStart`/`atEnd` are `true`.

---

## 3. `ScrollerState` — the component's state class (`scroller.svelte.ts`)

One instance per `<Scroller.Root>`, published on a `Symbol` context key. Reactive inputs arrive as
getter functions (never snapshots), matching `MarqueeState`.

### Constructor input — `ScrollerStateProps`

```ts
type ScrollerStateProps = {
  readonly getOrientation: () => ScrollerOrientation;    // 'vertical' | 'horizontal'
  readonly getOffset: () => number;
  readonly getScrollStep: () => number;
  readonly getWithNavigation: () => boolean;
  readonly getScrollTriggerMode: () => ScrollerTriggerMode; // 'press' | 'hover' | 'click'
  readonly getDir: () => Direction;                      // resolved by useDirection()
};
```

### Mutable fields (`$state`)

| Field     | Type                     | Written by                                                        |
| --------- | ------------------------ | ----------------------------------------------------------------- |
| `element` | `HTMLElement \| null`    | the root's `$effect` (default mode) or the `child` attachment      |
| `metrics` | `ScrollMetrics`          | `setMetrics()`, called from `observeScrollPosition`'s callback     |

These two are the only non-derived state in the component; everything below is `$derived`.

### Derivation table

| Derived member          | Expression                                                                       | Upstream line |
| ----------------------- | -------------------------------------------------------------------------------- | ------------- |
| `orientation`           | `getOrientation()`                                                                | L68           |
| `isVertical`            | `orientation === 'vertical'`                                                      | L126          |
| `isRtl`                 | `getDir() === 'rtl'`                                                              | D-01 addition |
| `vertical`              | `computeAxisOverflow(metrics, 'vertical', { offset, dir })`                       | L128–152      |
| `horizontal`            | `computeAxisOverflow(metrics, 'horizontal', { offset, dir })`                     | L168–190      |
| `hasTopScroll`          | `isVertical && vertical.startDistance > offset`                                   | L149          |
| `hasBottomScroll`       | `isVertical && vertical.endDistance > offset && vertical.scrollable`              | L150–152      |
| `hasStartScroll` (h)    | `horizontal.startDistance > offset`                                               | L188          |
| `hasEndScroll` (h)      | `horizontal.endDistance > offset && horizontal.scrollable`                        | L189–190      |
| `hasLeftScroll`         | `isRtl ? hasEndScroll : hasStartScroll`                                           | R-04          |
| `hasRightScroll`        | `isRtl ? hasStartScroll : hasEndScroll`                                           | R-04          |
| `edgeAttributes`        | see "Edge attribute state machine" below                                          | L154–203      |
| `navigation.up`         | `isVertical && vertical.startDistance > offset`                                   | L135          |
| `navigation.down`       | `isVertical && vertical.endDistance > 0`  ← **no `offset`** (research R-03)        | L136          |
| `navigation.left`       | `isRtl ? horizontal.endDistance > 0 : horizontal.startDistance > offset`          | L174 + R-04   |
| `navigation.right`      | `isRtl ? horizontal.startDistance > offset : horizontal.endDistance > 0`          | L175 + R-04   |
| `activeDirections`      | `!withNavigation ? [] : isVertical ? ['up','down'] : ['left','right']`             | L224–227      |
| `visibleDirections`     | `activeDirections.filter((d) => navigation[d])`                                    | L246–247      |
| `customProperty`        | `` `--scroll-shadow-size: ${size}px;` ``                                          | L216–222      |

`vertical` is computed unconditionally but only *consumed* under `isVertical`, reproducing upstream's
gate (L128) while keeping the horizontal axis ungated — research R-09.

### Edge attribute state machine (per axis)

Upstream's combined/separate branching, reproduced exactly:

```
if (hasLeading && hasTrailing && scrollable)
    → data-<axis>-both-scroll = "true"    (data-top-bottom-scroll | data-left-right-scroll)
      data-<leading>-scroll   = absent
      data-<trailing>-scroll  = absent
else
      data-<axis>-both-scroll = absent
      data-<leading>-scroll   = hasLeading  ? "true" : absent
      data-<trailing>-scroll  = hasTrailing && scrollable ? "true" : absent
```

Note the vertical combined branch tests `hasTopScroll && hasBottomScroll && isVerticallyScrollable`
where `hasBottomScroll` already includes `scrollable` — reproduced verbatim; the redundancy is
harmless.

Resulting attribute set on the root element:

| Attribute                  | Value           | When                                                     |
| -------------------------- | --------------- | -------------------------------------------------------- |
| `data-slot`                | `"scroller"`    | always                                                   |
| `data-orientation`         | `"vertical"` \| `"horizontal"` | always                                    |
| `data-hide-scrollbar`      | `""`            | `hideScrollbar` (plain boolean attribute — no selector keys off its value) |
| `dir`                      | `"ltr"` \| `"rtl"` | always (resolved)                                      |
| `data-top-scroll`          | `"true"`        | vertical, leading only                                   |
| `data-bottom-scroll`       | `"true"`        | vertical, trailing only                                  |
| `data-top-bottom-scroll`   | `"true"`        | vertical, both ends                                      |
| `data-left-scroll`         | `"true"`        | horizontal, physical-left content hidden                 |
| `data-right-scroll`        | `"true"`        | horizontal, physical-right content hidden                |
| `data-left-right-scroll`   | `"true"`        | horizontal, both ends                                    |

### Methods

| Method                      | Behaviour                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| `setMetrics(m)`             | Replaces `metrics`. The only writer, so no `untrack()` is ever needed.                              |
| `measure()`                 | `if (element) setMetrics(readScrollMetrics(element))` — used on mount and by tests.                 |
| `scrollByStep(direction)`   | `up: scrollTop -= step`, `down: scrollTop += step`, `left: scrollLeft -= step`, `right: scrollLeft += step` (upstream L97–104, direction-agnostic per R-04), then `measure()`. |

### Context

```ts
const SCROLLER_CONTEXT_KEY = Symbol('scroller');
setScrollerContext(state): ScrollerState
getScrollerContext(consumerName: string): ScrollerState
  // throws: `<Scroller.Button>` must be used within `<Scroller.Root>`.
```

---

## 4. Navigation-button local state (`scroller-button.svelte`)

Not an entity on context — deliberately per-button and non-reactive.

| Field          | Type              | Lifecycle                                                                  |
| -------------- | ----------------- | -------------------------------------------------------------------------- |
| `intervalId`   | `number \| null`  | Set by `start()`, cleared by `stop()` and by the `$effect` teardown (R-08). |

**State transitions** (`AUTO_SCROLL_INTERVAL = 50` ms):

| Trigger mode | Start                                        | Stop                                                    |
| ------------ | -------------------------------------------- | -------------------------------------------------------- |
| `press`      | `pointerdown`, `keydown` Enter/Space          | `pointerup`, `pointerleave`, `pointercancel`, `keyup`, `blur`, unmount |
| `hover`      | `pointerenter`, `focus`                       | `pointerleave`, `blur`, unmount                          |
| `click`      | — (no interval)                               | —                                                        |
| all          | one immediate `scrollByStep` on `click` in `click` mode | —                                              |

`start()` is idempotent (returns early when `intervalId !== null`), matching upstream's
`if (autoScrollTimer !== null) return`.

**Invariant**: no interval can outlive its button — the button unmounts as soon as its direction is
exhausted (`visibleDirections` drops it), which runs the teardown. This is the mechanism behind the
spec's "reaches the end while still held" and "unmounted mid-scroll" edge cases.
