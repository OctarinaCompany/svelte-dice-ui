# Public API Contract — Badge Overflow

**Feature**: `009-port-badge-overflow` | **Upstream**:
`.reference/diceui/docs/registry/bases/radix/ui/badge-overflow.tsx` +
`.reference/diceui/docs/types/radix/badge-overflow.ts` @ pinned commit `d9763d8`

This file is the machine-checkable contract. Anything here that the implementation does not satisfy is
a defect, not a design choice.

## 1. Barrel — `src/lib/components/ui/badge-overflow/index.ts`

```ts
import Indicator from './badge-overflow-indicator.svelte';
import Root from './badge-overflow.svelte';

export {
	type BadgeOverflowChildProps,
	type BadgeOverflowProps,
	type BadgeOverflowRootProps
} from './badge-overflow.svelte';
export {
	type BadgeOverflowIndicatorChildProps,
	type BadgeOverflowIndicatorProps
} from './badge-overflow-indicator.svelte';
export {
	BadgeOverflowState,
	type BadgeOverflowSplit,
	type BadgeOverflowStateProps,
	type ContainerMetrics,
	computeVisibleSplit,
	getPlaceholderCount,
	getPlaceholderHeight,
	observeResize,
	readContainerMetrics,
	resolveBadgeLabel,
	DEFAULT_BADGE_GAP,
	DEFAULT_BADGE_HEIGHT,
	DEFAULT_LINE_COUNT,
	DEFAULT_OVERFLOW_BADGE_WIDTH,
	OVERFLOW_SAMPLE_COUNT
} from './badge-overflow.svelte.js';

export {
	Root,
	Indicator,
	//
	Root as BadgeOverflow,
	Indicator as BadgeOverflowIndicator
};
```

Both import styles must work:

```ts
import * as BadgeOverflow from '$lib/components/ui/badge-overflow/index.js'; // BadgeOverflow.Root
import { BadgeOverflow, BadgeOverflowIndicator } from '$lib/components/ui/badge-overflow/index.js';
```

`BadgeOverflowProps<T>` is an alias of `BadgeOverflowRootProps<T>`, present for parity with upstream's
exported type name (same convention as `ColorSwatchProps`).

## 2. Prop-by-prop mapping — Root

| Upstream prop     | Upstream type                             | Port prop       | Port type                                        | Default | Bindable |
| ----------------- | ----------------------------------------- | --------------- | ------------------------------------------------ | ------- | -------- |
| `items`           | `T[]`                                     | `items`         | `T[]`                                            | —       | no       |
| `getBadgeLabel`   | `(item: T) => string`, conditional        | `getBadgeLabel` | `(item: T) => string`, conditional (research R-03) | —     | no       |
| `lineCount`       | `number`                                  | `lineCount`     | `number`                                         | `1`     | no       |
| `renderBadge`     | `(item: T, label: string) => ReactNode`   | `badge`         | `Snippet<[item: T, label: string]>`              | —       | no       |
| `renderOverflow`  | `(count: number) => ReactNode`            | `overflow`      | `Snippet<[count: number]>`                       | —       | no       |
| `asChild`         | `boolean`                                 | `child`         | `Snippet<[{ props: BadgeOverflowChildProps; content: Snippet }]>` | — | no |
| `ref`             | `Ref<HTMLDivElement>` (`useComposedRefs`) | `ref`           | `HTMLDivElement \| null`                         | `null`  | **yes**  |
| `className`       | `string`                                  | `class`         | `ClassValue`                                     | —       | no       |
| `style`           | `CSSProperties`                           | `style`         | `string`                                         | —       | no       |
| `...rootProps`    | `ComponentProps<'div'>`                   | `...restProps`  | `HTMLAttributes<HTMLDivElement>`                 | —       | —        |
| `children`        | (inherited from `ComponentProps<'div'>`, unused) | — | **removed** via `WithoutChildren<…>`             | —       | —        |

**Merge order (must match upstream `{...rootProps} className={cn(…)} style={{ gap, ...style }}`)**:
computed data attributes → `...restProps` → computed `class` → computed `style` (with the caller's
`style` string appended last inside it). A caller can therefore override `role`/`aria-*`/`data-*`
through `restProps`, but not `class`/`style`, which are destructured out and merged.

## 3. Type shapes

```ts
interface GetBadgeLabel<T> {
	/**
	 * Function to extract the label string from each badge item.
	 *
	 * Optional for primitive arrays (strings, numbers).
	 * Required for object arrays.
	 */
	getBadgeLabel: (item: T) => string;
}

/** The merged attribute payload handed to the `child` snippet. */
export type BadgeOverflowChildProps = {
	'data-slot': 'badge-overflow';
	'data-measured'?: '';
	'data-line-count': string;
	'data-hidden-count': string;
	'data-empty'?: '';
	class: string;
	style: string;
} & Record<string, unknown>;

type BadgeOverflowOwnProps<T> = {
	/** Array of items to display as badges. */
	items: T[];
	/**
	 * Maximum number of lines to display badges across.
	 * @default 1
	 */
	lineCount?: number;
	/** Render snippet for each badge item. Replaces upstream `renderBadge`. Must render one element. */
	badge: Snippet<[item: T, label: string]>;
	/** Render snippet for the overflow indicator badge. Replaces upstream `renderOverflow`. */
	overflow?: Snippet<[count: number]>;
	/** Render the container onto your own element. Replaces upstream `asChild`. */
	child?: Snippet<[{ props: BadgeOverflowChildProps; content: Snippet }]>;
};

export type BadgeOverflowRootProps<T = string> = WithoutChildren<
	WithElementRef<HTMLAttributes<HTMLDivElement>>
> &
	BadgeOverflowOwnProps<T> &
	Partial<GetBadgeLabel<T>> &
	(T extends object ? GetBadgeLabel<T> : object);

export type BadgeOverflowProps<T = string> = BadgeOverflowRootProps<T>;
```

```ts
export type BadgeOverflowIndicatorChildProps = {
	'data-slot': 'badge-overflow-indicator';
	'data-count': string;
	class: string;
} & Record<string, unknown>;

export type BadgeOverflowIndicatorProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
	/** The number of hidden items, rendered as `+{count}`. */
	count: number;
	child?: Snippet<[{ props: BadgeOverflowIndicatorChildProps }]>;
};
```

## 4. Rendered DOM

```html
<!-- sibling 1: the measurement row, always rendered -->
<div
	data-slot="badge-overflow-measure"
	aria-hidden="true"
	class="pointer-events-none invisible absolute flex flex-wrap"
	style="gap: 4px"
>
	<!-- one badge snippet per item, in order -->
	<!-- then exactly one overflow sample rendered with count = 99 -->
</div>

<!-- sibling 2: the visible container -->
<div
	data-slot="badge-overflow"
	data-measured=""
	data-line-count="1"
	data-hidden-count="7"
	class="flex flex-wrap"
	style="gap: 4px"
>
	<!-- visibleItems badges, then the indicator when hiddenCount > 0 -->
</div>
```

Invariants the tests assert:

1. The measurement row always has exactly `items.length + 1` element children (the `badge` snippet must
   render one element — upstream's own contract, since measurement indexes `children[i]`).
2. `children[items.length]` of the row is the overflow sample, rendered with `OVERFLOW_SAMPLE_COUNT`
   (`99`) so the reserved width is the widest realistic `+N`.
3. Exactly zero or one indicator renders in the visible container, always **after** the last badge.
4. `Number(container.dataset.hiddenCount) === items.length - visibleBadgeCount`.
5. Before the first measurement, the container has no `data-measured`, holds
   `getPlaceholderCount(items.length, lineCount)` badges, no indicator, and a `min-height` declaration.

## 5. Error contract

| Trigger                                                                      | Behaviour                                                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| an item is a non-null `object` (or `null`) and `getBadgeLabel` is not supplied | throws ``Error('`getBadgeLabel` is required when using array of objects')`` — message verbatim from upstream |
| `items` is empty                                                             | no badges, no indicator, `data-empty` present, container occupies only its own padding |
| the container has no definite width                                          | documented prerequisite only — no warning, no fallback (spec §Assumptions)      |

## 6. Registry entry (append to `registry.json`, exactly one item)

```jsonc
{
	"name": "badge-overflow",
	"type": "registry:ui",
	"title": "Badge Overflow",
	"description": "A component that intelligently manages badge overflow by measuring available space and displaying only what fits with an overflow indicator.",
	"registryDependencies": [],
	"dependencies": [],
	"files": [
		{ "path": "src/lib/components/ui/badge-overflow/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/badge-overflow/badge-overflow.svelte", "type": "registry:ui" },
		{
			"path": "src/lib/components/ui/badge-overflow/badge-overflow-indicator.svelte",
			"type": "registry:ui"
		},
		{ "path": "src/lib/components/ui/badge-overflow/badge-overflow.svelte.ts", "type": "registry:ui" }
	]
}
```

`registryDependencies` is empty because the component imports no shadcn primitive — the default
indicator inlines upstream's own markup rather than importing `Badge` (spec §Assumptions).
`dependencies` is empty because the port adds no npm package: the only external import is `cn()` from
`$lib/utils.js`, which the registry builder rewrites to `$UTILS$.js`. The test file and the
`.test.svelte` harness are **not** listed.

`title` and `description` are taken verbatim from the upstream MDX frontmatter and drive the docs index
card and the sidebar entry produced by `getComponentItems()`.

## 7. Usage contract (must compile as written)

```svelte
<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as BadgeOverflow from '$lib/components/ui/badge-overflow/index.js';

	const tags = ['React', 'TypeScript', 'Next.js', 'Tailwind CSS'];
	type Tag = { label: string; value: string };
	let objects = $state<Tag[]>([{ label: 'React', value: 'react' }]);
</script>

<!-- primitive items: getBadgeLabel omitted -->
<div class="w-64 rounded-md border p-3">
	<BadgeOverflow.Root items={tags}>
		{#snippet badge(_item, label)}
			<Badge variant="secondary">{label}</Badge>
		{/snippet}
	</BadgeOverflow.Root>
</div>

<!-- object items: getBadgeLabel required by the type, custom overflow snippet -->
<div class="w-64 rounded-md border p-3">
	<BadgeOverflow.Root items={objects} getBadgeLabel={(tag) => tag.label} lineCount={2}>
		{#snippet badge(tag, label)}
			<Badge variant="secondary">{label}</Badge>
		{/snippet}
		{#snippet overflow(count)}
			<Badge variant="outline" class="bg-muted">+{count} more</Badge>
		{/snippet}
	</BadgeOverflow.Root>
</div>

<!-- child mode: caller owns the element, renders the generated content inside it -->
<BadgeOverflow.Root items={tags}>
	{#snippet badge(_item, label)}
		<Badge>{label}</Badge>
	{/snippet}
	{#snippet child({ props, content })}
		<section {...props}>{@render content()}</section>
	{/snippet}
</BadgeOverflow.Root>
```
