# Phase 1 Data Model: Masonry

**Feature**: `013-port-masonry` | **Date**: 2026-07-30

All types below are TypeScript-strict, `any`-free, and live in the files named in each heading.
"Reactive" means declared with `$state` / `$derived`; everything else is a plain field.

---

## 1. `masonry-interval-tree.ts` — pure, no runes

Direct port of upstream lines 8–426 (red-black interval tree). Not reactive; mutation is the point.

```ts
type NodeColor = 0 | 1 | 2; // RED | BLACK | SENTINEL
type NodeOperation = 0 | 1; // REMOVE | PRESERVE

interface ListNode {
	index: number;
	high: number;
	next: ListNode | null;
}

interface TreeNode {
	max: number;
	low: number;
	high: number;
	color: NodeColor;
	parent: TreeNode;
	right: TreeNode;
	left: TreeNode;
	list: ListNode;
}

export interface IntervalTree {
	insert(low: number, high: number, index: number): void;
	remove(index: number): void;
	search(low: number, high: number, onCallback: (index: number, low: number) => void): void;
	readonly size: number;
}

export function createIntervalTree(): IntervalTree;
```

`ListNode` / `TreeNode` / `NodeColor` / `NodeOperation` stay module-private. Only `IntervalTree` and
`createIntervalTree` are exported (and re-exported from the barrel — research R-10).

**Invariants**

- `size` counts *intervals*, not tree nodes: several indices may share one `low`.
- `insert` with an index already present at that `low` is a no-op (`addInterval` returns `false`).
- `remove(index)` for an unknown index is a no-op.
- `search(low, high, cb)` invokes `cb(index, node.low)` for every interval overlapping `[low, high]`,
  in tree-traversal order — **not** in index order. Callers must not assume ordering.

---

## 2. `masonry-positioner.ts` — pure, no runes

Port of upstream lines 548–799 with the React `useRef`/`useCallback` shell removed.

```ts
export interface PositionerItem {
	/** Distance from the top of the viewport container, in px. */
	top: number;
	/** Offset from the *leading* inline edge, in px. Direction-agnostic (research R-07). */
	left: number;
	/** Last measured height, in px. */
	height: number;
	/** Which column this item was assigned to, 0-based from the leading edge. */
	columnIndex: number;
}

export interface PositionerOptions {
	/** Measured container width, in px. */
	width: number;
	/** @default 200 */
	columnWidth?: number;
	/** @default 0 */
	columnGap?: number;
	/** Falls back to `columnGap` when omitted. */
	rowGap?: number;
	/** Explicit column count; overrides the computed one. */
	columnCount?: number;
	/** Caps the computed column count. Ignored when `columnCount` is set. */
	maxColumnCount?: number;
	/** @default false */
	linear?: boolean;
}

export interface Positioner {
	readonly columnCount: number;
	readonly columnWidth: number;
	set(index: number, height?: number): void;
	get(index: number): PositionerItem | undefined;
	update(updates: number[]): void;
	range(low: number, high: number, onItemRender: (index: number, left: number, top: number) => void): void;
	size(): number;
	estimateHeight(itemCount: number, defaultItemHeight: number): number;
	shortestColumn(): number;
	all(): PositionerItem[];
}

export function resolveColumnCount(options: PositionerOptions): number;
export function resolveColumnWidth(options: PositionerOptions): number;
export function createPositioner(options: PositionerOptions): Positioner;
```

**Derivation rules** (verbatim from upstream lines 610–619):

```
columnCount = explicitColumnCount
            || min(floor((width + columnGap) / (columnWidth + columnGap)), maxColumnCount ?? +Infinity)
            || 1
columnWidth = floor((width - columnGap * (columnCount - 1)) / columnCount)
```

The trailing `|| 1` is what makes FR/edge-case "container narrower than one column ⇒ still 1 column"
true, because `floor(...)` evaluates to `0` there and `0 || 1 === 1`.

**`set(index, height)` column choice**

| `linear` | Rule                                                                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `false`  | first index of the minimum of `columnHeights` (ties → lowest column index)                                                                               |
| `true`   | `preferred = index % columnCount`; use it when `columnHeights[preferred] + height <= shortestHeight + height * 2.5`, otherwise use the shortest column. |

Then: `top = columnHeights[c]`; `columnHeights[c] = top + height + (rowGap ?? columnGap)`;
`items[index] = { left: c * (columnWidth + columnGap), top, height, columnIndex: c }`;
`intervalTree.insert(top, top + height, index)`.

**Ordering invariant (research R-04).** `set` is only ever called with
`index === positioner.size()`. `MasonryState` enforces this.

**`update(updates)`** takes a flat `[index, height, index, height, …]` pairs array, rewrites those
heights, and re-flows every later item in each affected column, keeping `columnItems[c]` ascending so
its binary search stays valid.

**`estimateHeight(itemCount, defaultItemHeight)`** returns `tallestColumn` when every item is
measured, else `tallestColumn + ceil((itemCount − size) / columnCount) * defaultItemHeight`.

---

## 3. `masonry.svelte.ts` — reactive state

### 3.1 Module-private helpers (not exported from the barrel)

| Helper                              | Replaces (upstream)          | Shape                                                                                                     |
| ----------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `createThrottle<T>(fps, leading)`   | `useThrottle` (1085–1149)    | `(value: T) => void` gate + `cancel()`; leading call fires immediately, trailing coalesces at `1000/fps` ms |
| `createRafSchedule<A>(fn)`          | `onRafSchedule` (913–936)    | `(…args: A) => void` with `.cancel()`; coalesces to one `requestAnimationFrame`                             |
| `observeWindowSize(state, delayMs)` | `useDebouncedWindowSize`     | attaches `resize` / `orientationchange` / `visualViewport.resize`, 300 ms debounce; returns teardown         |
| `observeWindowScroll(state, fps)`   | `useScroller` (1020–1083)    | attaches passive `scroll`, throttled at `fps`; drives `isScrolling` off a `40 + 1000/fps` ms RAF timeout     |

`createRafSchedule` **fixes an upstream bug**: upstream's `onRafSchedule` guards with `if (frameId)`,
so the very first call (when `frameId` is `null`) never schedules anything. The port uses
`if (frameId === null)`, which is the evident intent — otherwise the resize-driven re-flow (FR-012)
would only ever fire from the second resize onward. Recorded as a divergence.

### 3.2 `MasonryStateProps`

Every reactive input arrives as a getter (`CLAUDE.md` §4).

```ts
export type MasonryStateProps = {
	getColumnWidth: () => number;
	getColumnCount: () => number | undefined;
	getMaxColumnCount: () => number | undefined;
	getGap: () => number | { column: number; row: number };
	getItemHeight: () => number;
	getDefaultWidth: () => number | undefined;
	getDefaultHeight: () => number | undefined;
	getOverscan: () => number;
	getScrollFps: () => number;
	getLinear: () => boolean;
	getDir: () => Direction;
};
```

### 3.3 `MasonryState`

| Member                | Kind                | Type                            | Meaning                                                                          |
| --------------------- | ------------------- | ------------------------------- | -------------------------------------------------------------------------------- |
| `rootElement`         | `$state`            | `HTMLDivElement \| null`        | published by the root after `bind:this`; `null` in `child` mode                  |
| `mounted`             | `$state`            | `boolean`                       | `false` until the root's `$effect.pre` runs; gates the fallback (R-08)           |
| `windowSize`          | `$state.raw`        | `{ width: number; height: number }` | debounced document size; seeded from `defaultWidth`/`defaultHeight`          |
| `containerPosition`   | `$state.raw`        | `{ offset: number; width: number }` | offsetTop chain sum + `offsetWidth` (upstream 1243–1263)                     |
| `scrollY`             | `$state`            | `number`                        | throttled `window.scrollY`                                                       |
| `isScrolling`         | `$state`            | `boolean`                       | true between a scroll tick and its `40 + 1000/fps` ms settle                     |
| `layoutVersion`       | `$state`            | `number`                        | RAF-driven invalidation token; surfaced as `data-version`                        |
| `#tokens`             | `$state.raw`        | `symbol[]`                      | registration order of live items (R-02)                                          |
| `#pendingHeights`     | plain               | `Map<number, number>`           | out-of-order height reports awaiting sequential drain (R-04)                     |
| `#observer`           | plain               | `ResizeObserver \| null`        | one per positioner instance                                                      |
| `#elementIndex`       | plain               | `WeakMap<Element, number>`      | observed element → index                                                         |
| `columnGap` / `rowGap`| `$derived`          | `number`                        | normalised from `gap` (`number` ⇒ both; object ⇒ each)                           |
| `width`               | `$derived`          | `number`                        | `containerPosition.width \|\| windowSize.width`                                  |
| `positioner`          | `$derived.by`       | `Positioner`                    | recreated on any of the 7 layout inputs; replays measured heights (R-05)         |
| `columnWidth`         | `$derived`          | `number`                        | `positioner.columnWidth`                                                         |
| `columnCount`         | `$derived`          | `number`                        | `positioner.columnCount`                                                         |
| `itemCount`           | `$derived`          | `number`                        | `#tokens.length`                                                                 |
| `measuredCount`       | `$derived`          | `number`                        | `positioner.size()` (read through `layoutVersion`)                               |
| `scrollTop`           | `$derived`          | `number`                        | `max(0, scrollY − containerPosition.offset)`                                     |
| `overscanPixels`      | `$derived`          | `number`                        | `windowSize.height * overscan`                                                   |
| `rangeStart`          | `$derived`          | `number`                        | `max(0, scrollTop − overscanPixels / 2)`                                         |
| `rangeEnd`            | `$derived`          | `number`                        | `scrollTop + overscanPixels`                                                     |
| `layoutOutdated`      | `$derived`          | `boolean`                       | `positioner.shortestColumn() < rangeEnd && measuredCount < itemCount`            |
| `batchSize`           | `$derived`          | `number`                        | upstream 1431–1438                                                               |
| `visibleIndices`      | `$derived.by`       | `Map<number, PositionerItem>`   | result of `positioner.range(rangeStart, rangeEnd, …)`                            |
| `estimatedHeight`     | `$derived`          | `number`                        | upstream 1479–1492                                                               |

**Methods**

| Method                                     | Purpose                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `registerItem(token: symbol): void`        | append to `#tokens`                                                                                        |
| `unregisterItem(token: symbol): void`      | remove from `#tokens`, drop pending height, reset measurement so later items re-flow (edge case: mid-list removal) |
| `indexOf(token: symbol): number`           | position in `#tokens`, or `-1`                                                                             |
| `getItem(index): PositionerItem \| undefined` | positioner lookup, invalidated by `layoutVersion`                                                       |
| `isVisible(index): boolean`                | `visibleIndices.has(index)`                                                                                |
| `isMeasuring(index): boolean`              | `mounted && layoutOutdated && measuredCount <= index < measuredCount + batchSize`                          |
| `observeItem(index, element): () => void`  | register in `#elementIndex`, `observer.observe`, seed `reportHeight(index, offsetHeight)`; returns teardown |
| `reportHeight(index, height): void`        | buffer into `#pendingHeights`, then drain sequentially (R-04)                                              |
| `bumpLayout(): void`                       | RAF-coalesced `layoutVersion++`                                                                            |

**Context**

```ts
const MASONRY_CONTEXT_KEY = Symbol('masonry');
export function setMasonryContext(state: MasonryState): MasonryState;
export function hasMasonryContext(): boolean;
export function getMasonryContext(): MasonryState; // throws when absent
```

Error text: `` `<Masonry.Item>` must be used within `<Masonry.Root>`. ``

---

## 4. Component-level entities

### `MasonryChildProps` (`masonry.svelte`)

```ts
export type MasonryChildProps = {
	'data-slot': 'masonry';
	'data-scrolling': '' | undefined;
	dir: Direction;
	style: string;
	class: string;
} & Record<string, unknown>;
```

### `MasonryItemChildProps` (`masonry-item.svelte`)

```ts
export type MasonryItemChildProps = {
	'data-slot': 'masonry-item';
	'data-index': number;
	'data-column-index': number | undefined;
	'data-measuring': '' | undefined;
	style: string;
	class: string;
} & Record<string, unknown>;
```

Boolean data attributes are written `cond ? '' : undefined` (Principle VIII).

### Inline styles (exact, from upstream)

| Element                       | Style                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Root                          | `position:relative;width:100%;height:100%;` + caller `style`                                                                       |
| Viewport                      | `position:relative;width:100%;max-width:100%;height:{ceil(est)}px;max-height:{ceil(est)}px;` + `will-change:contents;pointer-events:none;` while scrolling |
| Item — positioned             | `position:absolute;writing-mode:horizontal-tb;visibility:visible;width:{columnWidth}px;top:{top}px;inset-inline-start:{left}px;` + `transform:translateZ(0);will-change:transform;` while scrolling |
| Item — measuring (hidden)     | `position:absolute;writing-mode:horizontal-tb;visibility:hidden;width:{columnWidth}px;z-index:-1000;`                              |

Caller `style` is appended last in every case, so a caller declaration wins — matching upstream's
`...child.props.style` spread order.

---

## 5. State transitions

```
                 SSR / first client pass
                 mounted = false
                 ├── fallback provided ──▶ render fallback only
                 └── no fallback ────────▶ render viewport, height 0, no items
                                │
                     $effect.pre: mounted = true, measure containerPosition
                                │
                                ▼
        ┌──────────────── measuring ◀──────────────────┐
        │   layoutOutdated && measuredCount<itemCount  │
        │   ⇒ render batch [measuredCount, +batchSize) │
        │      hidden; each reports offsetHeight       │
        │   ⇒ reportHeight → drain in index order      │
        │   ⇒ RAF bumpLayout()                         │
        └───────────────────┬──────────────────────────┘
                            │ measuredCount === itemCount
                            ▼
                        settled  ── scroll ───▶ recompute range (throttled @ scrollFps)
                            │      resize ───▶ debounce 300ms → new windowSize
                            │                  → new positioner → replay heights → measuring
                            │      item resize ▶ observer → positioner.update() → bumpLayout
                            │      item added  ▶ #tokens grows → itemCount ↑ → measuring
                            └──── item removed ▶ #tokens shrinks → indices shift → re-flow
```
