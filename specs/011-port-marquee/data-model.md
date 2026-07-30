# Phase 1 Data Model: Marquee

The runtime shape of the component: one state class, one context, a handful of pure functions, and
the derived values that drive the CSS. Prop-level detail lives in
[contracts/public-api.md](./contracts/public-api.md); rationale lives in [research.md](./research.md).

---

## 1. Value types (`marquee.svelte.ts`)

Declared as `as const` tuples so the union type and the runtime list stay in sync — the pattern
`direction-provider` (`DIRECTIONS`) and `timeline` (`TIMELINE_ORIENTATIONS`) already use.

```ts
export const MARQUEE_SIDES = ['left', 'right', 'top', 'bottom'] as const;
export type MarqueeSide = (typeof MARQUEE_SIDES)[number];

export const MARQUEE_ORIENTATIONS = ['horizontal', 'vertical'] as const;
export type MarqueeOrientation = (typeof MARQUEE_ORIENTATIONS)[number];

export const MARQUEE_EDGE_SIZES = ['default', 'sm', 'lg'] as const;
export type MarqueeEdgeSize = (typeof MARQUEE_EDGE_SIZES)[number];
```

`Direction` (`'ltr' | 'rtl'`) is **imported** from
`$lib/components/ui/direction-provider/direction-provider.svelte.js`, never redeclared.

---

## 2. Pure functions

All five are total, side-effect free, DOM-free and exported — so they are unit-testable without a
render, and reusable by any later size-driven port.

| Function                                                              | Returns                | Contract                                                                                                                                                                       |
| --------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sideToOrientation(side: MarqueeSide)`                                | `MarqueeOrientation`   | `'top' \| 'bottom'` → `'vertical'`, otherwise `'horizontal'`. (upstream line 300)                                                                                              |
| `resolveGap(gap: string \| number)`                                   | `string`               | A number `n` → `` `${n}px` ``; a string passes through unchanged. (upstream passes the raw number — see research D-note on `gap`)                                               |
| `resolveLoopCount(loopCount: number)`                                 | `string`               | `0` or `Infinity` (or any non-finite value) → `'infinite'`; otherwise `String(loopCount)`. (upstream lines 349–352)                                                            |
| `computeMarqueeDuration(input: DurationInput)`                        | `number` (**seconds**) | See the table below. (upstream lines 323–342)                                                                                                                                  |
| `computeAutoFillMultiplier(rootSize, contentSize, autoFill: boolean)` | `number` (integer ≥ 1) | `!autoFill` or `contentSize === 0` → `1`; `contentSize < rootSize` → `Math.ceil(rootSize / contentSize)`; otherwise `1`. (upstream lines 501–508, with the same zero guard)     |

```ts
export type DurationInput = {
	/** The container's size along the scroll axis, in px. `0` means "not measured yet". */
	rootSize: number;
	/** The content track's size along the scroll axis, in px. `0` means "not measured yet". */
	contentSize: number;
	/** Pixels per second. */
	speed: number;
	autoFill: boolean;
};
```

`computeMarqueeDuration` reproduces upstream exactly, including the speed floor:

| Case                                                | Duration (seconds)                       |
| --------------------------------------------------- | ---------------------------------------- |
| any                                                 | `safeSpeed = Math.max(0.001, speed)`     |
| not measured (`rootSize === 0 \|\| contentSize === 0`), `autoFill` | `1000 / safeSpeed`      |
| not measured, no `autoFill`                         | `2000 / safeSpeed`                       |
| measured, `autoFill`                                | `(contentSize × multiplier) / safeSpeed` |
| measured, no `autoFill`, `contentSize < rootSize`   | `rootSize / safeSpeed`                   |
| measured, no `autoFill`, `contentSize ≥ rootSize`   | `contentSize / safeSpeed`                |

where `multiplier = computeAutoFillMultiplier(rootSize, contentSize, true)`. Upstream keys the
"not measured" branch on `dimensions === null` (no `ResizeObserver` entry yet); a zero size is the
Svelte-side equivalent and additionally covers the spec's "container has zero measured size" edge
case without dividing by zero.

---

## 3. Size observation

```ts
export type MarqueeSizes = {
	rootWidth: number;
	rootHeight: number;
	contentWidth: number;
	contentHeight: number;
};

export function observeMarqueeSizes(
	root: HTMLElement,
	content: HTMLElement,
	onResize: (sizes: MarqueeSizes) => void
): () => void;
```

- No-ops (returning a no-op teardown) when `window` or `ResizeObserver` is undefined — SSR and the
  jsdom default stub both hit this path.
- One `ResizeObserver` observing both elements; each callback reads `getBoundingClientRect()` on both
  and calls `onResize` once with all four numbers.
- Fires `onResize` **once eagerly** at setup with the current rects, so a static page that never
  resizes still measures (upstream does the same at the end of `observe()`).
- The returned teardown calls `observer.disconnect()`.

Both elements are needed simultaneously, and the caller wants sizes rather than a bare "something
changed" signal — this is why `badge-overflow`'s single-element `observeResize` is not reused (see
`plan.md`, Principle IV justification).

---

## 4. `MarqueeState`

One instance per `<Marquee.Root>`, published on context. Reactive inputs arrive as getter functions
(never snapshots), per `CLAUDE.md` §4.

```ts
export type MarqueeStateProps = {
	getSide: () => MarqueeSide;
	getDir: () => Direction;
	getSpeed: () => number;
	getDelay: () => number;
	getLoopCount: () => number;
	getGap: () => string | number;
	getAutoFill: () => boolean;
	getPauseOnHover: () => boolean;
	getPauseOnKeyboard: () => boolean;
	getReverse: () => boolean;
};
```

### Mutable state

| Field           | Rune            | Initial | Written by                                        | Meaning                                        |
| --------------- | --------------- | ------- | ------------------------------------------------- | ---------------------------------------------- |
| `paused`        | `$state`        | `false` | `togglePaused()` (Space key)                      | The keyboard pause flag. No public prop (R-08). |
| `rootWidth`     | `$state`        | `0`     | `setSizes()` from the `ResizeObserver` callback   | Measured container width, px.                  |
| `rootHeight`    | `$state`        | `0`     | idem                                              | Measured container height, px.                 |
| `contentWidth`  | `$state`        | `0`     | idem                                              | Measured track width, px.                      |
| `contentHeight` | `$state`        | `0`     | idem                                              | Measured track height, px.                     |

`setSizes(sizes: MarqueeSizes)` writes all four in one call and is the **only** writer, so the
content's `$effect` never reads a value it writes and needs no `untrack()`.

### Derived values

| Derived            | Expression                                                                          | Consumed by                                          |
| ------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `side`             | `getSide()`                                                                         | Root `data-side`, content variants                   |
| `dir`              | `getDir()`                                                                          | Root `dir`, content variants (RTL compound variants) |
| `orientation`      | `sideToOrientation(side)`                                                           | Root `data-orientation` + layout classes, content    |
| `isVertical`       | `orientation === 'vertical'`                                                        | Content gutter/flex-direction classes                |
| `isRtl`            | `dir === 'rtl'`                                                                     | Content gutter side                                  |
| `rootSize`         | `isVertical ? rootHeight : rootWidth`                                               | `duration`, `multiplier`                             |
| `contentSize`      | `isVertical ? contentHeight : contentWidth`                                         | `duration`, `multiplier`                             |
| `duration`         | `computeMarqueeDuration({ rootSize, contentSize, speed: getSpeed(), autoFill })`    | `--marquee-duration`                                 |
| `multiplier`       | `computeAutoFillMultiplier(rootSize, contentSize, getAutoFill())`                   | How many copies `Marquee.Content` renders            |
| `gapValue`         | `resolveGap(getGap())`                                                              | `--marquee-gap`                                      |
| `loopCountValue`   | `resolveLoopCount(getLoopCount())`                                                  | `--marquee-loop-count`                               |
| `pauseOnHover`     | `getPauseOnHover()`                                                                 | Root `group` class + `data-pause-on-hover`; content  |
| `pauseOnKeyboard`  | `getPauseOnKeyboard()`                                                              | Root `tabindex` + focus ring + key handler           |
| `reverse`          | `getReverse()`                                                                      | Content `animation-direction` + variant class        |
| `customProperties` | the four `--marquee-*` declarations, as a CSS string                                | Root inline `style`                                  |

`multiplier` is deliberately **not** memoised or cached — `$derived` recomputes only when a read
dependency actually changes, which is what upstream's `useMemo` was emulating. Per the plan prompt's
translation rules, no `useMemo`/`useCallback` is ported.

### Methods

| Method                                  | Behaviour                                                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `setSizes(sizes: MarqueeSizes): void`   | Assigns the four measured fields.                                                                                            |
| `togglePaused(): void`                  | `this.paused = !this.paused`.                                                                                                |
| `onkeydown(event: KeyboardEvent): void` | If `pauseOnKeyboard` and `event.key === ' '`: `event.preventDefault()` then `togglePaused()`. Otherwise nothing. (upstream 311–319) |

---

## 5. Context

```ts
const MARQUEE_CONTEXT_KEY = Symbol('marquee');

export function setMarqueeContext(state: MarqueeState): MarqueeState;
export function getMarqueeContext(consumerName: string): MarqueeState;
```

`getMarqueeContext` throws when the key is absent:

```text
`<Marquee.Content>` must be used within `<Marquee.Root>`.
```

`consumerName` is passed as the full part spelling (`'<Marquee.Content>'`) so the message names both
the part and its provider, matching upstream's `useMarqueeContext(consumerName)`. Only
`Marquee.Content` calls it — `Item` and `Edge` read no context and must keep working standalone
(research R-07).

Elements are passed to the state **not** through context but through the content's own `$effect`,
which has `bind:this` on the track and reads the root element from the state (the root registers
itself into a `rootElement` field during its own `$effect`). Keeping the elements out of the context
value avoids the React `RefObject`-in-context pattern, which has no Svelte counterpart.

---

## 6. Rendered tree and the copy count

`Marquee.Content` renders **two sibling tracks**, matching upstream lines 532–584:

```text
<div data-slot="marquee-wrapper" class="grid">           ← Root
  └── <div role="marquee" … data-slot="marquee">         ← Root element (ref, context provider)
        ├── <div data-slot="marquee-content" …>          ← announced track  (restProps land here)
        │     ├── <div bind:this={ref}>{children}</div>  ← the measured track (contentSize)
        │     └── children × (multiplier − 1)
        ├── <div data-slot="marquee-content" data-clone role="presentation" aria-hidden="true">
        │     └── children × multiplier                  ← decorative duplicate (FR-002)
        └── <div data-slot="marquee-edge" …>             ← zero or more Edges
```

Total rendered copies of `children`: `2 × multiplier`. With `autoFill` off, `multiplier === 1`, so
exactly two copies — the seamless-loop base case of FR-002 and User Story 1, acceptance scenario 1.

Only the **inner** div of the announced track is measured, because it holds exactly one copy of the
children; measuring the animated wrapper would include the extra `multiplier - 1` copies and inflate
the duration.

Rendering `children` `n` times is a plain `{#each Array.from({ length: n }) as _, i (i)}
{@render children?.()}{/each}` — Svelte snippets may be rendered any number of times, so upstream's
`React.Fragment`-keyed `onMultipliedChildrenRender` has no counterpart.

---

## 7. CSS custom properties (the contract the MDX documents)

Set on the **root** element, consumer `style` appended after so it can override (upstream line 353
spreads `styleProp` last too):

| Property               | Value                                | Default when unmeasured |
| ---------------------- | ------------------------------------ | ----------------------- |
| `--marquee-duration`   | `` `${duration}s` ``                 | `40s` (`2000 / 50`)     |
| `--marquee-gap`        | `resolveGap(gap)`                    | `1rem`                  |
| `--marquee-delay`      | `` `${delay}s` ``                    | `0s`                    |
| `--marquee-loop-count` | `resolveLoopCount(loopCount)`        | `infinite`              |

Consumed on the **content** tracks as inline longhands (so they beat the `animate-*` shorthand that
the utility class sets), with the consumer's `style` first and these after (upstream line 519):

```text
animation-duration: var(--marquee-duration);
animation-delay: var(--marquee-delay);
animation-iteration-count: var(--marquee-loop-count);
animation-direction: normal | reverse;
```

and as Tailwind arbitrary values in the class list: `gap-(--marquee-gap)`, plus
`mb-(--marquee-gap)` (vertical) / `ml-(--marquee-gap)` (horizontal RTL) / `mr-(--marquee-gap)`
(horizontal LTR) on the announced track.

---

## 8. Variant tables

### `marqueeContentVariants` (module script of `marquee-content.svelte`)

Base: `flex min-w-full shrink-0 gap-(--marquee-gap) motion-reduce:animate-none`

| Variant        | Value    | Classes                                             |
| -------------- | -------- | --------------------------------------------------- |
| `side`         | `left`   | `animate-marquee-left`                              |
|                | `right`  | `animate-marquee-right`                             |
|                | `top`    | `min-h-full min-w-auto animate-marquee-up flex-col` |
|                | `bottom` | `min-h-full min-w-auto animate-marquee-down flex-col` |
| `dir`          | `ltr`    | —                                                   |
|                | `rtl`    | —                                                   |
| `pauseOnHover` | `true`   | `group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]` |
|                | `false`  | —                                                   |
| `reverse`      | `true`   | `[animation-direction:reverse]`                     |
|                | `false`  | —                                                   |

Compound variants (upstream lines 442–453): `side: left` + `dir: rtl` → `animate-marquee-left-rtl`;
`side: right` + `dir: rtl` → `animate-marquee-right-rtl`. Defaults: `left`, `ltr`, `false`, `false`.

The `dir` variant has no classes of its own; it exists solely as a compound-variant key, exactly as
upstream declares it.

### `marqueeEdgeVariants` (module script of `marquee-edge.svelte`)

Base: `pointer-events-none absolute z-10`

| Variant | Value    | Classes                                                         |
| ------- | -------- | ----------------------------------------------------------------- |
| `side`  | `left`   | `top-0 left-0 h-full bg-gradient-to-r from-background to-transparent` |
|         | `right`  | `top-0 right-0 h-full bg-gradient-to-l from-background to-transparent` |
|         | `top`    | `top-0 left-0 w-full bg-gradient-to-b from-background to-transparent` |
|         | `bottom` | `bottom-0 left-0 w-full bg-gradient-to-t from-background to-transparent` |
| `size`  | `sm` / `default` / `lg` | — (carried by the compound variants)               |

Six compound variants, verbatim from upstream lines 618–649: horizontal sides get `w-1/6` / `w-1/4`
/ `w-1/3`, vertical sides get `h-1/6` / `h-1/4` / `h-1/3`. Default `size: 'default'`.
`from-background` is already a semantic token, so no colour substitution is needed here.

---

## 9. Root class composition (upstream lines 401–410)

```text
relative flex overflow-hidden motion-reduce:animate-none
  + vertical  → h-full flex-col
  + horizontal → w-full
  + paused    → [&_*]:[animation-play-state:paused]
  + pauseOnHover → group
  + pauseOnKeyboard → rounded-md focus-visible:border-ring focus-visible:outline-none
                      focus-visible:ring-[3px] focus-visible:ring-ring/50
  + className (last)
```

All tokens are semantic (`border-ring`, `ring-ring/50`); no palette colour and no `dark:` variant
appears anywhere in the component.
</content>
