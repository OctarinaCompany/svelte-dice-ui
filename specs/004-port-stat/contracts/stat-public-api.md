# Contract: `stat` public API

**Feature**: `004-port-stat` | **Date**: 2026-07-29

This is the interface a consumer gets after `npx shadcn-svelte@latest add <registry>/stat`. It is the
acceptance surface for `stat.test.ts` and for the API tables on `/docs/components/stat`.

Import path (in-repo and after install):

```ts
import * as Stat from '$lib/components/ui/stat/index.js';
import { Stat as StatRoot, StatIndicator, StatTrend } from '$lib/components/ui/stat/index.js';
```

Contract IDs: `C-xx` container/part contracts, `V-xx` variant-table contracts, `B-xx` barrel
contracts. `tasks.md` and `stat.test.ts` reference these IDs.

---

## 1. Barrel (`src/lib/components/ui/stat/index.ts`)

| Export                        | Kind      | ID     | Notes                                     |
| ----------------------------- | --------- | ------ | ----------------------------------------- |
| `Root` / `Stat`               | component | B-01   | `stat.svelte`                             |
| `Label` / `StatLabel`         | component | B-02   | `stat-label.svelte`                       |
| `Indicator` / `StatIndicator` | component | B-03   | `stat-indicator.svelte`                   |
| `Value` / `StatValue`         | component | B-04   | `stat-value.svelte`                       |
| `Trend` / `StatTrend`         | component | B-05   | `stat-trend.svelte`                       |
| `Separator` / `StatSeparator` | component | B-06   | `stat-separator.svelte`                   |
| `Description` / `StatDescription` | component | B-07 | `stat-description.svelte`                 |
| `statIndicatorVariants`       | value     | B-08   | `tv()` table (replaces upstream `cva`)    |
| `statTrendVariants`           | value     | B-09   | `tv()` table                              |
| `STAT_INDICATOR_VARIANTS`     | value     | B-10   | `readonly ['default','icon','badge','action']` |
| `STAT_INDICATOR_COLORS`       | value     | B-11   | `readonly ['default','success','info','warning','error']` |
| `STAT_TREND_DIRECTIONS`       | value     | B-12   | `readonly ['up','down','neutral']`        |
| `resolveStatIndicatorVariant` | value     | B-13   | `(v?: string) => StatIndicatorVariant`    |
| `resolveStatIndicatorColor`   | value     | B-14   | `(v?: string) => StatIndicatorColor`      |
| `resolveStatTrendDirection`   | value     | B-15   | `(v?: string) => StatTrendDirection`      |
| `StatIndicatorVariant`, `StatIndicatorColor`, `StatTrendDirection` | type | B-16 | Unions derived from the tuples |
| `StatRootProps`, `StatLabelProps`, `StatIndicatorProps`, `StatValueProps`, `StatTrendProps`, `StatSeparatorProps`, `StatDescriptionProps` | type | B-17 | One per part |

Both naming styles must resolve: `Stat.Indicator` and `StatIndicator` are the same component (B-18).

---

## 2. Shared prop shape (every part)

```ts
type SharedPartProps = WithElementRef<HTMLAttributes<HTMLDivElement>>;
// → { ref?: HTMLDivElement | null } & HTMLAttributes<HTMLDivElement>
```

| Prop           | Type                             | Default | Bindable | ID   |
| -------------- | -------------------------------- | ------- | -------- | ---- |
| `ref`          | `HTMLDivElement \| null`         | `null`  | **yes**  | C-01 |
| `class`        | `ClassValue`                     | —       | no       | C-02 |
| `children`     | `Snippet`                        | —       | no       | C-03 |
| `...restProps` | `HTMLAttributes<HTMLDivElement>` | —       | no       | C-04 |

- **C-01** — `ref` is `$bindable(null)` and applied with `bind:this={ref}`; after mount the binding
  holds the rendered `HTMLDivElement`. (`StatSeparator`'s ref is forwarded with `bind:ref` to the
  composed `Separator`.)
- **C-02** — destructured as `class: className` and passed **last** to `cn()`, so a caller class wins
  on any conflicting Tailwind axis.
- **C-03** — rendered with `{@render children?.()}`; a part with no children renders an empty element
  rather than throwing.
- **C-04** — spread onto the rendered element, so `id`, `onclick`, `aria-*`, `data-*`, `style`, … all
  pass through unchanged.

No part declares a callback prop, a dispatched event, or a `child` snippet (C-05). No part reads or
writes context; each renders correctly outside `Stat.Root` (C-06).

---

## 3. Parts, elements and attributes

| ID   | Part              | Element                | `data-slot`        | Extra attributes                    |
| ---- | ----------------- | ---------------------- | ------------------ | ----------------------------------- |
| C-10 | `Stat`            | `div`                  | `stat`             | —                                   |
| C-11 | `StatLabel`       | `div`                  | `stat-label`       | —                                   |
| C-12 | `StatIndicator`   | `div`                  | `stat-indicator`   | `data-variant`, `data-color`        |
| C-13 | `StatValue`       | `div`                  | `stat-value`       | —                                   |
| C-14 | `StatTrend`       | `div`                  | `stat-trend`       | `data-trend` (omitted when unset)   |
| C-15 | `StatSeparator`   | `Separator` (`bits-ui`)| `stat-separator`   | `role`/`aria-orientation` from bits-ui |
| C-16 | `StatDescription` | `div`                  | `stat-description` | —                                   |

`data-slot` values are upstream's verbatim. No part carries a `role`, `aria-label`,
`aria-describedby` or `aria-live` of its own (C-17) — upstream documents none, and the label/value
text is already in the accessibility tree.

---

## 4. Part-specific props

### 4.1 `StatIndicator` (C-20)

```ts
export type StatIndicatorProps = Omit<WithElementRef<HTMLAttributes<HTMLDivElement>>, 'color'> & {
	/**
	 * The visual style of the indicator.
	 *
	 * - `"default"`: Simple icon without background
	 * - `"icon"`: Icon with bordered container
	 * - `"badge"`: Compact badge style with number or icon
	 * - `"action"`: Interactive button style with hover effects
	 *
	 * @default "default"
	 */
	variant?: StatIndicatorVariant;
	/**
	 * The color theme of the indicator.
	 *
	 * - `"default"`: Muted gray background
	 * - `"success"`: Green background for positive metrics
	 * - `"info"`: Blue background for informational metrics
	 * - `"warning"`: Orange background for warning metrics
	 * - `"error"`: Red background for error or critical metrics
	 *
	 * @default "default"
	 */
	color?: StatIndicatorColor;
};
```

- **C-21** — the `Omit<…, 'color'>` reproduces upstream's `Omit<React.ComponentProps<"div">, "color">`;
  without it the union would collide with the legacy HTML `color` attribute.
- **C-22** — `data-variant` and `data-color` always carry a value from `STAT_INDICATOR_VARIANTS` /
  `STAT_INDICATOR_COLORS`; an unrecognised runtime string is normalised to `"default"` before it is
  written (see V-30). Both attributes are always present, never omitted — upstream defaults both
  props, so neither can be `undefined`.
- **C-23** — JSDoc above is copied verbatim from `docs/types/radix/stat.ts`, `@default` included
  (Constitution II). The upstream JSDoc's colour names ("Green", "Blue", …) describe the semantics,
  not the tokens this port uses; the token mapping is in §5.2.

### 4.2 `StatTrend` (C-24)

```ts
export type StatTrendProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
	/**
	 * The trend direction to display with appropriate styling.
	 *
	 * - `"up"`: Shows positive trend with green color
	 * - `"down"`: Shows negative trend with red color
	 * - `"neutral"`: Shows neutral trend with muted color
	 */
	trend?: StatTrendDirection;
};
```

- **C-25** — `trend` has **no** default (upstream declares none). When it is `undefined`, the
  `data-trend` attribute is **absent** and the neutral class row is applied — upstream's
  `trend === "neutral" || !trend` branch.
- **C-26** — when `trend` is supplied, `data-trend` carries the **resolved** value, so it is always
  one of `up` / `down` / `neutral`.

### 4.3 `StatSeparator` (C-27)

```ts
export type StatSeparatorProps = SeparatorPrimitive.RootProps; // from 'bits-ui'
```

- **C-28** — renders `<Separator data-slot="stat-separator" class={cn('my-2', className)} bind:ref {...restProps} />`
  where `Separator` is `$lib/components/ui/separator/index.js`.
- **C-29** — `orientation` (`'horizontal'`) and `decorative` defaults are owned by `bits-ui` and are
  **not** restated by this part; passing `orientation="vertical"` reaches the primitive unchanged.
- **C-30** — a caller `class` merges with `my-2` rather than replacing it (documented refinement over
  upstream; research.md R3).

---

## 5. Class contract

Class **membership** is the contract; **order is not** — `prettier-plugin-tailwindcss` reorders the
literals and `tailwind-merge` may drop a conflicting duplicate. Tests assert membership per class,
the way `status.test.ts` does.

### 5.1 Container and text parts

| ID   | Part              | Classes                                                                                                                                                                                                                                                                                                                                                                                          |
| ---- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V-01 | `Stat`            | `grid` `grid-cols-[1fr_auto]` `gap-x-4` `gap-y-1` `rounded-lg` `border` `bg-card` `p-4` `text-card-foreground` `shadow-sm`                                                                                                                                                                                                                                                                        |
| V-02 | `Stat` (children) | `**:data-[slot=stat-label]:col-span-1` `**:data-[slot=stat-value]:col-span-1` `**:data-[slot=stat-indicator]:col-start-2` `**:data-[slot=stat-indicator]:row-span-2` `**:data-[slot=stat-indicator]:row-start-1` `**:data-[slot=stat-indicator]:self-start` `**:data-[slot=stat-description]:col-span-2` `**:data-[slot=stat-separator]:col-span-2` `**:data-[slot=stat-trend]:col-span-2` |
| V-03 | `StatLabel`       | `text-sm` `font-medium` `text-muted-foreground`                                                                                                                                                                                                                                                                                                                                                   |
| V-04 | `StatValue`       | `text-2xl` `font-semibold` `tracking-tight`                                                                                                                                                                                                                                                                                                                                                       |
| V-05 | `StatDescription` | `text-xs` `text-muted-foreground`                                                                                                                                                                                                                                                                                                                                                                 |
| V-06 | `StatSeparator`   | `my-2` (plus the base separator's own classes)                                                                                                                                                                                                                                                                                                                                                    |

V-01 and V-02 are upstream's four class-string arguments, verbatim — `**:` is already Tailwind v4
syntax and is used in the repo by `status.svelte`. **V-07**: `StatValue` must carry no `truncate`,
`whitespace-nowrap` or width class (spec Edge Cases — the value wraps and the card grows).

### 5.2 `statIndicatorVariants` (`tv()`)

Base (V-10): `flex` `shrink-0` `items-center` `justify-center` `[&_svg]:pointer-events-none`

`variants.variant` — declared **first** (V-11):

| Key       | Classes                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| `default` | `text-muted-foreground` `[&_svg:not([class*='size-'])]:size-5`                                             |
| `icon`    | `size-8` `rounded-md` `border` `[&_svg:not([class*='size-'])]:size-3.5`                                    |
| `badge`   | `h-6` `min-w-6` `rounded-sm` `border` `px-1.5` `text-xs` `font-medium` `[&_svg:not([class*='size-'])]:size-3` |
| `action`  | `size-8` `cursor-pointer` `rounded-md` `transition-colors` `hover:bg-muted/50` `[&_svg:not([class*='size-'])]:size-4` |

`variants.color` — declared **second**, so it wins the `text-*` conflict (V-12):

| Key       | Classes                                                    | Upstream replaced                                             |
| --------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| `default` | `bg-muted` `text-muted-foreground`                         | unchanged                                                     |
| `success` | `border-success/20` `bg-success/10` `text-success`         | `border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400` |
| `info`    | `border-info/20` `bg-info/10` `text-info`                  | `border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400`     |
| `warning` | `border-warning/20` `bg-warning/10` `text-warning`         | `border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400` |
| `error`   | `border-destructive/20` `bg-destructive/10` `text-destructive` | unchanged                                                 |

`defaultVariants` (V-13): `{ variant: 'default', color: 'default' }`.

**V-14** — the declaration order of the two groups is load-bearing: `variant` before `color`, exactly
as `cva`. **V-15** — no `dark:` utility appears anywhere; the tokens flip via `src/app.css`.

### 5.3 `statTrendVariants` (`tv()`)

Base (V-20): `inline-flex` `items-center` `gap-1` `text-xs` `font-medium`
`[&_svg:not([class*='size-'])]:size-3` `[&_svg]:pointer-events-none` `[&_svg]:shrink-0`

`variants.trend` (V-21):

| Key       | Classes                 | Upstream replaced                              |
| --------- | ----------------------- | ---------------------------------------------- |
| `up`      | `text-success`          | `text-green-600 dark:text-green-400`           |
| `down`    | `text-destructive`      | `text-red-600 dark:text-red-400`               |
| `neutral` | `text-muted-foreground` | unchanged                                      |

`defaultVariants` (V-22): `{ trend: 'neutral' }` — which is what makes an omitted `trend` render
muted.

### 5.4 Resolvers (V-30)

```ts
export function resolveStatIndicatorVariant(value?: string): StatIndicatorVariant;
export function resolveStatIndicatorColor(value?: string): StatIndicatorColor;
export function resolveStatTrendDirection(value?: string): StatTrendDirection;
```

Each returns `value` when it is a member of the corresponding tuple, and the axis default
(`'default'`, `'default'`, `'neutral'`) otherwise — including for `undefined` and `''`. The resolved
value feeds **both** the `tv()` call and the `data-*` attribute, so the two can never disagree
(V-31).

---

## 6. Composition contract

- **C-40** — `Stat` positions its children by `data-slot`, not by DOM order: any subset, in any
  order, renders without a broken grid (FR-002, FR-010).
- **C-41** — the "action" indicator composes as menu content, not as the trigger element:

  ```svelte
  <DropdownMenu.Trigger>
  	<Stat.Indicator variant="action"><EllipsisIcon /></Stat.Indicator>
  </DropdownMenu.Trigger>
  ```

  producing `<button data-slot="dropdown-menu-trigger">` wrapping
  `<div data-slot="stat-indicator" data-variant="action">` — upstream's DOM exactly (research.md R4).
  All focus, `aria-haspopup`/`aria-expanded`/`aria-controls` and `Enter`/`Space`/`ArrowDown`/`Escape`
  behaviour belongs to `bits-ui`'s trigger and is asserted through it.
- **C-42** — under `dir="rtl"` the grid mirrors with no code change (research.md R5); no part emits a
  physical-direction utility.
- **C-43** — `StatSeparator` renders correctly outside `Stat` (spec Edge Cases).

---

## 7. Registry entry

```jsonc
{
	"name": "stat",
	"type": "registry:ui",
	"title": "Stat",
	"description": "A card for a key metric — label, value, colour-themed indicator, trend, separator and description — laid out on a two-column grid that positions its parts by slot.",
	"registryDependencies": ["separator"],
	"dependencies": ["tailwind-variants"],
	"files": [
		{ "path": "src/lib/components/ui/stat/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/stat/stat.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/stat/stat-label.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/stat/stat-indicator.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/stat/stat-value.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/stat/stat-trend.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/stat/stat-separator.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/stat/stat-description.svelte", "type": "registry:ui" }
	]
}
```

`stat.test.ts` and `stat.test.svelte` are **not** listed (Principle V). `dropdown-menu` is **not** a
`registryDependency`: only the demo route imports it.
