# Public API Contract: Masonry

**Feature**: `013-port-masonry` | **Date**: 2026-07-30

This is the installable surface of `@svelte-dice-ui/masonry` — everything a consumer can import from
`$lib/components/ui/masonry/index.js`. Derived from
`.reference/diceui/docs/registry/bases/radix/ui/masonry.tsx` at the pinned commit.

Import styles, both supported:

```ts
import * as Masonry from '$lib/components/ui/masonry/index.js'; // Masonry.Root, Masonry.Item
import { Masonry, MasonryItem } from '$lib/components/ui/masonry/index.js';
```

---

## 1. `Masonry` / `Masonry.Root` — `masonry.svelte`

Renders a `<div>` (or the caller's element via `child`) with `data-slot="masonry"` that wraps an
internal viewport sizing container. Publishes the masonry context.

### Props

| Prop             | Type                                          | Default    | Bindable | Upstream | Notes                                                                                                       |
| ---------------- | --------------------------------------------- | ---------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `ref`            | `HTMLDivElement \| null`                      | `null`     | **yes**  | `ref`    | `bind:this` on the rendered `<div>`. Stays `null` in `child` mode.                                          |
| `columnWidth`    | `number`                                      | `200`      | no       | ✔        | Preferred column width in px, used when `columnCount` is not set.                                           |
| `columnCount`    | `number \| undefined`                         | `undefined`| no       | ✔        | Explicit column count. Overrides the computed one and makes `maxColumnCount` inert.                        |
| `maxColumnCount` | `number \| undefined`                         | `undefined`| no       | ✔        | Caps the computed column count. Ignored when `columnCount` is set.                                          |
| `gap`            | `number \| { column: number; row: number }`   | `0`        | no       | ✔        | A number applies to both axes; the object sets each independently.                                          |
| `itemHeight`     | `number`                                      | `300`      | no       | ✔        | Estimated height for not-yet-measured items; drives total-height estimation and batch sizing.               |
| `defaultWidth`   | `number \| undefined`                         | `undefined`| no       | ✔        | Container width assumed before measurement (server render / first paint). Effective `0`.                    |
| `defaultHeight`  | `number \| undefined`                         | `undefined`| no       | ✔        | Viewport height assumed before measurement. Effective `0`.                                                  |
| `overscan`       | `number`                                      | `2`        | no       | ✔        | How far beyond the viewport items stay mounted, in multiples of viewport height.                            |
| `scrollFps`      | `number`                                      | `12`       | no       | ✔        | Upper bound on scroll-driven recomputation, in frames per second.                                           |
| `linear`         | `boolean`                                     | `false`    | no       | ✔        | Round-robin column assignment instead of shortest-first (see §5).                                           |
| `fallback`       | `Snippet \| undefined`                        | `undefined`| no       | ✔ (node) | Rendered **instead of** the whole positioned list until the component has mounted and measured.             |
| `dir`            | `'ltr' \| 'rtl' \| undefined`                 | *resolved* | no       | **added**| Explicit direction. Falls back to nearest `<DirectionProvider>`, then ancestor `[dir]`, then `'ltr'`.       |
| `child`          | `Snippet<[{ props: MasonryChildProps }]>`     | `undefined`| no       | `asChild`| Render the root onto your own element. `children` is not rendered and `ref` stays `null` in this mode.      |
| `children`       | `Snippet \| undefined`                        | `undefined`| no       | ✔        | The `<Masonry.Item>` list.                                                                                  |
| `class`          | `string \| undefined`                         | `undefined`| no       | ✔        | Merged **last** through `cn()`.                                                                             |
| `style`          | `string \| undefined`                         | `undefined`| no       | ✔        | Appended after the component's own declarations, so a caller declaration wins.                              |
| *rest*           | `HTMLAttributes<HTMLDivElement>` less `dir`   | —          | no       | ✔        | Spread onto the rendered element.                                                                           |

**Dropped from upstream:** `asChild` (→ `child`). **Not present upstream:** `dir`, `child`.

### Snippets

| Snippet    | Payload                          | Rendered when                                            |
| ---------- | -------------------------------- | -------------------------------------------------------- |
| `children` | —                                | always, unless `child` is supplied                       |
| `fallback` | —                                | `!mounted` (SSR + first client pass) and `fallback` given |
| `child`    | `{ props: MasonryChildProps }`   | when supplied; replaces the default `<div>`              |

### Callbacks / events

**None.** Upstream exposes no callback prop and no controlled value; only native DOM handlers pass
through `restProps`.

### Data attributes

| Attribute         | Values          | Meaning                                     |
| ----------------- | --------------- | ------------------------------------------- |
| `data-slot`       | `"masonry"`     | styling / test hook                         |
| `data-scrolling`  | `""` / absent   | a throttled scroll tick is in flight        |
| `dir`             | `"ltr"`/`"rtl"` | resolved direction (also drives RTL mirroring) |

---

## 2. `MasonryItem` / `Masonry.Item` — `masonry-item.svelte`

Renders a `<div>` (or the caller's element via `child`) with `data-slot="masonry-item"`, absolutely
positioned by the root. **Must** be inside `<Masonry.Root>`.

### Props

| Prop       | Type                                          | Default     | Bindable | Upstream  | Notes                                                                                        |
| ---------- | --------------------------------------------- | ----------- | -------- | --------- | ------------------------------------------------------------------------------------------------ |
| `ref`      | `HTMLDivElement \| null`                      | `null`      | **yes**  | `ref`     | `null` while the item is virtualized out or in `child` mode.                                 |
| `index`    | `number \| undefined`                         | `undefined` | no       | **added** | Pins the item's position in the layout order. Defaults to registration (source) order.       |
| `child`    | `Snippet<[{ props: MasonryItemChildProps }]>` | `undefined` | no       | `asChild` | Render onto your own element; the snippet must spread `props` for positioning to apply.      |
| `children` | `Snippet \| undefined`                        | `undefined` | no       | ✔         | Item content.                                                                                |
| `class`    | `string \| undefined`                         | `undefined` | no       | ✔         | Merged last.                                                                                 |
| `style`    | `string \| undefined`                         | `undefined` | no       | ✔         | Appended after the positioning declarations, so a caller declaration wins (upstream order).  |
| *rest*     | `HTMLAttributes<HTMLDivElement>`              | —           | no       | ✔         | Spread onto the rendered element.                                                            |

### Snippets

| Snippet    | Payload                            | Rendered when                                                     |
| ---------- | ---------------------------------- | ------------------------------------------------------------------ |
| `children` | —                                  | the item is within the overscan range **or** in the measurement batch |
| `child`    | `{ props: MasonryItemChildProps }` | same condition, when supplied                                     |

### Callbacks / events

**None.** Native handlers pass through `restProps`.

### Data attributes

| Attribute           | Values                | Meaning                                                   |
| ------------------- | --------------------- | --------------------------------------------------------- |
| `data-slot`         | `"masonry-item"`      | styling / test hook                                       |
| `data-index`        | `number`              | resolved layout index                                     |
| `data-column-index` | `number` / absent     | assigned column, absent until measured                    |
| `data-measuring`    | `""` / absent         | rendered `visibility:hidden` purely to be measured        |

### Errors

Rendering `MasonryItem` with no `Masonry.Root` ancestor throws:

```
`<Masonry.Item>` must be used within `<Masonry.Root>`.
```

---

## 3. Internal part (not exported)

`masonry-viewport.svelte` — `data-slot="masonry-viewport"`, `data-version={layoutVersion}`. Sizes the
scroll area to `estimatedHeight` and swaps in `fallback` while unmounted. Upstream's `MasonryViewport`
is likewise not exported; it is rendered by the root with no prop pass-through.

---

## 4. Barrel exports — `index.ts`

```ts
// components
export { Root, Item, Root as Masonry, Item as MasonryItem };

// prop + payload types
export type { MasonryProps, MasonryRootProps, MasonryChildProps } from './masonry.svelte';
export type { MasonryItemProps, MasonryItemChildProps } from './masonry-item.svelte';

// reactive state + context
export {
	MasonryState,
	getMasonryContext,
	hasMasonryContext,
	setMasonryContext,
	type MasonryStateProps
} from './masonry.svelte.js';

// reusable layout primitives (research R-10)
export {
	createPositioner,
	resolveColumnCount,
	resolveColumnWidth,
	type Positioner,
	type PositionerItem,
	type PositionerOptions
} from './masonry-positioner.js';
export { createIntervalTree, type IntervalTree } from './masonry-interval-tree.js';
```

`MasonryProps` is an alias of `MasonryRootProps`, matching upstream's exported `MasonryProps` name and
the repo's marquee precedent.

**Not exported:** the scroll / resize / throttle helpers in `masonry.svelte.ts`, and
`masonry-viewport.svelte`.

---

## 5. Layout algorithm contract (SC-001)

Given `width`, `columnWidth`, `columnGap`, `rowGap`, `columnCount`, `maxColumnCount`, `linear`, and a
sequence of heights `h[0…n-1]` fed in index order, the port MUST produce, for every index, the same
`{ top, left, columnIndex }` as upstream.

```
columnCount = columnCount || min(floor((width + columnGap) / (columnWidth + columnGap)),
                                 maxColumnCount ?? +Infinity) || 1
columnWidth = floor((width - columnGap * (columnCount - 1)) / columnCount)

for index in 0..n-1:
    if linear:
        preferred = index % columnCount
        c = (columnHeights[preferred] + h[index] <= min(columnHeights) + h[index] * 2.5)
              ? preferred
              : argmin(columnHeights)
    else:
        c = argmin(columnHeights)            # ties → lowest index

    top  = columnHeights[c]
    left = c * (columnWidth + columnGap)     # offset from the LEADING edge
    columnHeights[c] = top + h[index] + (rowGap ?? columnGap)
```

`left` is rendered as `inset-inline-start`, so RTL mirroring is a CSS consequence of the root's `dir`
and the emitted numbers are direction-invariant.

---

## 6. Registry contract

```jsonc
{
	"name": "masonry",
	"type": "registry:ui",
	"title": "Masonry",
	"description": "A responsive masonry layout component for displaying items in a grid.",
	"registryDependencies": ["direction-provider"],
	"dependencies": [],
	"files": [
		{ "path": "src/lib/components/ui/masonry/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/masonry/masonry.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/masonry/masonry-viewport.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/masonry/masonry-item.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/masonry/masonry.svelte.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/masonry/masonry-positioner.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/masonry/masonry-interval-tree.ts", "type": "registry:ui" }
	]
}
```

Test files (`masonry.test.ts`, `masonry-positioner.test.ts`) and the harness (`masonry.test.svelte`)
are **not** listed.
