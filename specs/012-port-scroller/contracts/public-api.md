# Contract: Scroller public API

The exported surface of `$lib/components/ui/scroller`. This is the contract a consumer installs; it
is what the tests assert and what the demo page documents. Derived from
`.reference/diceui/docs/registry/bases/radix/ui/scroller.tsx` and
`.reference/diceui/docs/types/radix/scroller.ts` at the pinned commit.

---

## Barrel — `src/lib/components/ui/scroller/index.ts`

```ts
import Root from './scroller.svelte';

export { type ScrollerChildProps, type ScrollerProps, type ScrollerRootProps } from './scroller.svelte';
export { type ScrollerButtonProps } from './scroller-button.svelte';

export {
	AUTO_SCROLL_INTERVAL,
	getScrollerContext,
	SCROLL_DIRECTIONS,
	SCROLLER_ORIENTATIONS,
	SCROLLER_TRIGGER_MODES,
	ScrollerState,
	setScrollerContext,
	type ScrollDirection,
	type ScrollerOrientation,
	type ScrollerStateProps,
	type ScrollerTriggerMode
} from './scroller.svelte.js';

export {
	computeAxisOverflow,
	EMPTY_SCROLL_METRICS,
	observeScrollPosition,
	readScrollMetrics,
	ScrollPositionState,
	type AxisOverflow,
	type ScrollAxis,
	type ScrollMetrics
} from './scroll-position.svelte.js';

export {
	Root,
	//
	Root as Scroller
};
```

Both import styles must work:

```ts
import * as Scroller from '$lib/components/ui/scroller/index.js'; // Scroller.Root
import { Scroller } from '$lib/components/ui/scroller/index.js';  // <Scroller>
```

`scroller-button.svelte` is **not** exported as a component (spec Assumption: upstream's
`ScrollButton` is unexported and undocumented). Its props type is exported so consumers reading the
source can type against it.

---

## `<Scroller.Root>` — props

```ts
export type ScrollerRootProps = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
	/**
	 * The scroll direction of the container.
	 * @default "vertical"
	 */
	orientation?: ScrollerOrientation;
	/**
	 * Whether to hide the scrollbar.
	 * @default false
	 */
	hideScrollbar?: boolean;
	/**
	 * Size of the scroll shadow in pixels.
	 * @default 40
	 */
	size?: number;
	/**
	 * Offset for scroll shadow visibility.
	 * @default 0
	 */
	offset?: number;
	/**
	 * Whether to show navigation buttons.
	 * @default false
	 */
	withNavigation?: boolean;
	/**
	 * Amount to scroll when using navigation buttons.
	 *
	 * When `withNavigation` is false, this prop is ignored.
	 * @default 40
	 */
	scrollStep?: number;
	/**
	 * How navigation buttons trigger scrolling.
	 * - `press`: Continuous scrolling while button is pressed
	 * - `hover`: Continuous scrolling while hovering
	 * - `click`: Single scroll step per click
	 *
	 * When `withNavigation` is false, this prop is ignored.
	 * @default "press"
	 */
	scrollTriggerMode?: ScrollerTriggerMode;
	/**
	 * Explicit text direction. When omitted, resolves the nearest `<DirectionProvider>`, then an
	 * ancestor `[dir]`, then `"ltr"`. Horizontal edge cues and navigation buttons follow the
	 * content's visual start/end (divergence D-01 — upstream has no direction awareness).
	 */
	dir?: Direction;
	/**
	 * Render the scroller onto your own element instead of the default `<div>`. The snippet receives
	 * the merged props to spread onto that element; the spread also registers the element for
	 * measurement, so edge cues and navigation keep working.
	 *
	 * Replaces upstream's `asChild` (Radix `Slot`), which has no Svelte equivalent. In `child` mode
	 * `children` is not rendered and `ref` stays `null`.
	 */
	child?: Snippet<[{ props: ScrollerChildProps }]>;
};

/** Upstream-parity alias of {@link ScrollerRootProps}. */
export type ScrollerProps = ScrollerRootProps;
```

`ref` comes from `WithElementRef` and is `$bindable(null)`. `class` is destructured as
`class: className` and merged last through `cn()`. `style` is appended after
`--scroll-shadow-size`, so a caller-supplied custom property wins.

### `ScrollerChildProps`

The exact payload handed to the `child` snippet — attributes plus the registration attachment:

```ts
export type ScrollerChildProps = {
	'data-slot': 'scroller';
	'data-orientation': ScrollerOrientation;
	'data-hide-scrollbar': '' | undefined;
	'data-top-scroll': 'true' | undefined;
	'data-bottom-scroll': 'true' | undefined;
	'data-top-bottom-scroll': 'true' | undefined;
	'data-left-scroll': 'true' | undefined;
	'data-right-scroll': 'true' | undefined;
	'data-left-right-scroll': 'true' | undefined;
	dir: Direction;
	style: string;
	class: string;
} & Record<string, unknown>;
```

The `Record<string, unknown>` tail carries `restProps` and the `createAttachmentKey()` entry (a
`symbol` key, which is why the index signature is required).

---

## Rendered structure

**Without navigation** (`withNavigation = false`) — a single element, nothing wrapped:

```html
<div data-slot="scroller" data-orientation="vertical" dir="ltr" style="--scroll-shadow-size: 40px;" class="overflow-y-auto …">
  <!-- children -->
</div>
```

**With navigation** — upstream's `relative w-full` wrapper, buttons before the scroller in DOM order:

```html
<div data-slot="scroller-wrapper" class="relative w-full">
  <button data-slot="scroller-button" data-direction="up" data-trigger-mode="press" type="button" aria-label="Scroll up" class="absolute top-2 left-1/2 …">
    <svg aria-hidden="true" …/>   <!-- chevron-up -->
  </button>
  <button data-slot="scroller-button" data-direction="down" …>…</button>
  <div data-slot="scroller" …>…</div>
</div>
```

Only directions with hidden content render a button (`visibleDirections`).

---

## Data attributes (styling contract)

| Element                     | Attribute                | Values                        | Meaning                                        |
| --------------------------- | ------------------------ | ----------------------------- | ---------------------------------------------- |
| `[data-slot="scroller"]`    | `data-orientation`       | `vertical` \| `horizontal`    | active scroll axis                             |
|                             | `data-hide-scrollbar`    | `""` \| absent                | native scrollbar hidden                        |
|                             | `data-top-scroll`        | `"true"` \| absent            | hidden content above (only end open)           |
|                             | `data-bottom-scroll`     | `"true"` \| absent            | hidden content below (only end open)           |
|                             | `data-top-bottom-scroll` | `"true"` \| absent            | hidden content above **and** below             |
|                             | `data-left-scroll`       | `"true"` \| absent            | hidden content to the physical left            |
|                             | `data-right-scroll`      | `"true"` \| absent            | hidden content to the physical right           |
|                             | `data-left-right-scroll` | `"true"` \| absent            | hidden content on both horizontal sides        |
|                             | `dir`                    | `ltr` \| `rtl`                | resolved direction                             |
| `[data-slot="scroller-wrapper"]` | —                   | —                             | present only when `withNavigation`             |
| `[data-slot="scroller-button"]`  | `data-direction`    | `up`\|`down`\|`left`\|`right` | which way this button scrolls                  |
|                                  | `data-trigger-mode` | `press`\|`hover`\|`click`     | active trigger mode                            |

The `"true"` value (rather than `""`) is required: upstream's mask selectors are
`data-[top-scroll=true]:…`. The attribute is absent when false.

## CSS variables

| Variable                | Default | Set by | Consumed by                                  |
| ----------------------- | ------- | ------ | -------------------------------------------- |
| `--scroll-shadow-size`  | `40px`  | `size` | every `mask-image` gradient stop in `scrollerVariants` |

---

## Reusable module — `scroll-position.svelte.ts` (FR-010)

The API `scroll-spy` and `tour` (wave 3) import. It has **no** dependency on any Scroller part, on
`direction-provider`, or on any markup.

```ts
export type ScrollAxis = 'vertical' | 'horizontal';

export type ScrollMetrics = {
	scrollTop: number;
	scrollLeft: number;
	clientWidth: number;
	clientHeight: number;
	scrollWidth: number;
	scrollHeight: number;
};

/** All-zero seed used before the first measurement. */
export const EMPTY_SCROLL_METRICS: ScrollMetrics;

/** Read all six values in one pass. Pure; no layout writes. */
export function readScrollMetrics(element: HTMLElement): ScrollMetrics;

export type AxisOverflow = {
	scrollable: boolean;
	startDistance: number;
	endDistance: number;
	atStart: boolean;
	atEnd: boolean;
};

export type ComputeAxisOverflowOptions = {
	/** Hidden content must exceed this many pixels to count. @default 0 */
	offset?: number;
	/** Resolved direction; only affects the horizontal axis. @default 'ltr' */
	dir?: 'ltr' | 'rtl';
};

/** Pure reduction of a snapshot to one axis' logical overflow state. */
export function computeAxisOverflow(
	metrics: ScrollMetrics,
	axis: ScrollAxis,
	options?: ComputeAxisOverflowOptions
): AxisOverflow;

/**
 * Subscribe to everything that can change the metrics: the element's `scroll`, a `ResizeObserver` on
 * the element and its element children (kept current by a `MutationObserver` on `childList`), and
 * `window`'s `resize`. Measures once eagerly. SSR-guarded; returns a teardown that removes all four.
 */
export function observeScrollPosition(
	element: HTMLElement,
	onChange: (metrics: ScrollMetrics) => void
): () => void;

/** Optional runes wrapper: assign `.element`, read `.metrics` / `.vertical` / `.horizontal`. */
export class ScrollPositionState {
	element: HTMLElement | null;
	readonly metrics: ScrollMetrics;
	readonly vertical: AxisOverflow;
	readonly horizontal: AxisOverflow;
	constructor(options?: { getOffset?: () => number; getDir?: () => 'ltr' | 'rtl' });
	measure(): void;
}
```

**Stability promise to wave 3**: `readScrollMetrics`, `computeAxisOverflow` and
`observeScrollPosition` are the reuse surface; `scroll-spy` and `tour` must not need to copy any part
of it. Any later change to their signatures is a breaking change for those ports.

---

## Registry entry (`registry.json`)

```jsonc
{
	"name": "scroller",
	"type": "registry:ui",
	"title": "Scroller",
	"description": "A scrollable container with customizable scroll shadows and navigation buttons.",
	"registryDependencies": ["direction-provider"],
	"dependencies": ["tailwind-variants", "@lucide/svelte"],
	"files": [
		{ "path": "src/lib/components/ui/scroller/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/scroller/scroller.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/scroller/scroller-button.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/scroller/scroller.svelte.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/scroller/scroll-position.svelte.ts", "type": "registry:ui" }
	]
}
```

Test files (`scroller.test.ts`, `scroller.test.svelte`) are deliberately absent from `files`.
`@lucide/svelte` is declared explicitly rather than left to CLI inference, because the chevrons are a
hard runtime import of the component source.
