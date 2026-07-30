# Contract: Marquee public API

The exported surface of `src/lib/components/ui/marquee/index.ts`. This is the contract a consumer
installs and the contract the tests assert. Every prop, default and JSDoc line is traceable to
`.reference/diceui/docs/registry/bases/radix/ui/marquee.tsx` or
`.reference/diceui/docs/types/radix/marquee.ts` at the pinned commit; the seven deliberate
divergences are marked **[D-nn]** and explained in [../research.md](../research.md).

---

## Import styles

Both must work, per `CLAUDE.md` §3:

```ts
import * as Marquee from '$lib/components/ui/marquee/index.js'; // Marquee.Root, Marquee.Content
import { Marquee, MarqueeContent, MarqueeItem, MarqueeEdge } from '$lib/components/ui/marquee/index.js';
```

Layout, mirroring the upstream MDX:

```svelte
<Marquee.Root>
	<Marquee.Content>
		<Marquee.Item>…</Marquee.Item>
	</Marquee.Content>
	<Marquee.Edge side="left" />
	<Marquee.Edge side="right" />
</Marquee.Root>
```

---

## `Marquee.Root` / `Marquee`

`src/lib/components/ui/marquee/marquee.svelte`

```ts
export type MarqueeRootProps = Omit<WithElementRef<HTMLAttributes<HTMLDivElement>>, 'dir'> & {
	/**
	 * The direction of the marquee animation.
	 * @default "left"
	 */
	side?: MarqueeSide;
	/**
	 * Explicit text direction. When omitted, resolves the nearest `<DirectionProvider>`, then an
	 * ancestor `[dir]`, then `"ltr"`.
	 */
	dir?: Direction;
	/**
	 * The speed of the animation in pixels per second.
	 * @default 50
	 */
	speed?: number;
	/**
	 * Seconds to wait before the animation starts.
	 * @default 0
	 */
	delay?: number;
	/**
	 * Number of animation iterations.
	 * - `0` (default): Infinite loop
	 * - `Infinity`: Infinite loop
	 * - `> 0`: Loop the specified number of times then stop
	 * @default 0
	 */
	loopCount?: number;
	/**
	 * The gap between marquee items. Accepts CSS length values or numbers (in pixels).
	 * @default "1rem"
	 */
	gap?: string | number;
	/**
	 * Automatically duplicate content to fill the container width/height.
	 * When enabled, content will be repeated until it fills the visible area.
	 * @default false
	 */
	autoFill?: boolean;
	/**
	 * Whether to pause the animation on hover. Also pauses while focus is inside the marquee, so
	 * the pause is reachable without a pointer.
	 * @default false
	 */
	pauseOnHover?: boolean;
	/**
	 * Whether the marquee can be paused with keyboard controls (Space key).
	 * @default true
	 */
	pauseOnKeyboard?: boolean;
	/**
	 * Whether to reverse the animation direction.
	 * @default false
	 */
	reverse?: boolean;
	/**
	 * Render the root onto your own element instead of the default `<div>`. The snippet receives
	 * the merged props to spread onto that element.
	 *
	 * Replaces upstream's `asChild` (Radix `Slot`), which has no Svelte equivalent. In `child`
	 * mode `children` is not rendered and `ref` stays `null`.
	 */
	child?: Snippet<[{ props: MarqueeChildProps }]>;
};

/** Upstream-parity alias of {@link MarqueeRootProps}. */
export type MarqueeProps = MarqueeRootProps;
```

`dir` is `Omit`-ed from the base attributes and re-declared so it is narrowed to `Direction`
(`HTMLAttributes` types it as `string`) — the same treatment `TimelineRootProps` gives it.

**`MarqueeChildProps`** — the payload handed to `child`, and exactly the attribute set spread onto
the default `<div>`:

```ts
export type MarqueeChildProps = {
	role: 'marquee';
	'aria-live': 'off';
	'data-slot': 'marquee';
	'data-orientation': MarqueeOrientation;
	'data-side': MarqueeSide;
	'data-paused': '' | undefined;
	'data-pause-on-hover': '' | undefined;
	dir: Direction;
	tabindex: 0 | undefined;
	style: string;
	class: string;
	onkeydown: (event: KeyboardEvent) => void;
} & Record<string, unknown>;
```

| Guarantee                | Assertion                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Live region              | `role="marquee"` and `aria-live="off"` are always present. **[R-05]**                                       |
| Wrapper                  | A `div[data-slot="marquee-wrapper"].grid` always wraps the root element.                                    |
| Orientation              | `data-orientation` is `vertical` for `side="top" \| "bottom"`, else `horizontal`.                           |
| Direction                | `dir` equals `dir` prop → `<DirectionProvider>` → ancestor `[dir]` → `'ltr'`, in that order.                |
| Tab order                | `tabindex="0"` **iff** `pauseOnKeyboard`; the attribute is absent otherwise.                                |
| Pause state              | `data-paused` present (empty string) while paused, absent otherwise.                                        |
| Custom properties        | `style` always declares `--marquee-duration`, `--marquee-gap`, `--marquee-delay`, `--marquee-loop-count`, followed by any caller `style`. |
| Class order              | Caller `class` merged last through `cn()`.                                                                  |
| Attribute forwarding     | Every unrecognised attribute in `restProps` reaches the element; a caller `onkeydown` is composed, not dropped. **[D-06]** |
| Keyboard                 | Space toggles pause and calls `preventDefault()` **iff** `pauseOnKeyboard`; no other key does anything.     |

---

## `Marquee.Content` / `MarqueeContent`

`src/lib/components/ui/marquee/marquee-content.svelte`

```ts
export type MarqueeContentProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
	/** Render the announced track onto your own element. Replaces upstream's `asChild`. */
	child?: Snippet<[{ props: MarqueeContentChildProps }]>;
};

export type MarqueeContentChildProps = {
	'data-slot': 'marquee-content';
	'data-orientation': MarqueeOrientation;
	style: string;
	class: string;
} & Record<string, unknown>;
```

| Guarantee              | Assertion                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two tracks             | Exactly two `[data-slot="marquee-content"]` elements render per `Marquee.Content`.                                                                    |
| Announced vs. clone    | The second carries `data-clone=""`, `role="presentation"` and `aria-hidden="true"`; the first carries neither. **FR-002**                             |
| No duplicated identity | `restProps` (and therefore any `id`) lands only on the announced track. **[D-03]**                                                                    |
| Copy count             | `children` renders `2 × multiplier` times; `multiplier` is `1` unless `autoFill` and the content is smaller than the container.                       |
| Measured element       | `bind:ref` resolves to the inner track holding a single copy of `children` — not the animated wrapper.                                                |
| Animation              | Inline `animation-duration`/`-delay`/`-iteration-count` read the root's custom properties; `animation-direction` is `reverse` iff `reverse`.          |
| Reduced motion         | Both tracks carry `motion-reduce:animate-none`. **[D-02]**                                                                                            |
| Hover / focus pause    | With `pauseOnHover`, both tracks carry `group-hover:[animation-play-state:paused]` and `group-focus-within:[animation-play-state:paused]`. **[D-04]** |
| RTL                    | `side="left"` + `dir="rtl"` ⇒ `animate-marquee-left-rtl`; `side="right"` + `dir="rtl"` ⇒ `animate-marquee-right-rtl`.                                 |
| Gutter                 | `mb-(--marquee-gap)` when vertical, `ml-(--marquee-gap)` when horizontal RTL, `mr-(--marquee-gap)` when horizontal LTR.                               |
| Guard rail             | Rendering outside `Marquee.Root` throws `` `<Marquee.Content>` must be used within `<Marquee.Root>`. ``                                               |

---

## `Marquee.Item` / `MarqueeItem`

`src/lib/components/ui/marquee/marquee-item.svelte`

```ts
export type MarqueeItemProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
	/** Render the item onto your own element. Replaces upstream's `asChild`. */
	child?: Snippet<[{ props: MarqueeItemChildProps }]>;
};

export type MarqueeItemChildProps = {
	'data-slot': 'marquee-item';
	class: string;
} & Record<string, unknown>;
```

| Guarantee     | Assertion                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------- |
| Slot + class  | `data-slot="marquee-item"`, base class `shrink-0`, caller `class` merged last.                    |
| Context-free  | Renders standalone without throwing — it reads no context, matching upstream. **[R-07]**          |
| Composition   | `child` receives the payload above; three of the four upstream demos use it.                      |

---

## `Marquee.Edge` / `MarqueeEdge`

`src/lib/components/ui/marquee/marquee-edge.svelte`

```ts
export type MarqueeEdgeProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
	/**
	 * Which side to apply the edge gradient effect.
	 */
	side: MarqueeSide;
	/**
	 * The size of the edge gradient effect.
	 * - `sm`: 1/6 of container width/height
	 * - `default`: 1/4 of container width/height
	 * - `lg`: 1/3 of container width/height
	 * @default "default"
	 */
	size?: MarqueeEdgeSize;
	/** Render the edge onto your own element. Replaces upstream's `asChild`. */
	child?: Snippet<[{ props: MarqueeEdgeChildProps }]>;
};

export type MarqueeEdgeChildProps = {
	'data-slot': 'marquee-edge';
	'data-side': MarqueeSide;
	'data-size': MarqueeEdgeSize;
	'aria-hidden': 'true';
	class: string;
} & Record<string, unknown>;
```

| Guarantee    | Assertion                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| Required     | `side` has no default and is a required prop — TypeScript rejects `<Marquee.Edge />`.                 |
| Data         | `data-side` and `data-size` always present; `data-size` defaults to `default`.                        |
| Decorative   | `aria-hidden="true"` **[D-05]** and `pointer-events-none`; never receives focus or pointer events.    |
| Sizing       | `sm`/`default`/`lg` map to `1/6`, `1/4`, `1/3` along the axis implied by `side`.                      |
| Context-free | Renders standalone without throwing, matching upstream. **[R-07]**                                    |

---

## Non-component exports

```ts
// values
export { Root, Content, Item, Edge, Marquee, MarqueeContent, MarqueeItem, MarqueeEdge };
export { marqueeContentVariants } from './marquee-content.svelte';
export { marqueeEdgeVariants } from './marquee-edge.svelte';
export {
	MARQUEE_SIDES,
	MARQUEE_ORIENTATIONS,
	MARQUEE_EDGE_SIZES,
	MarqueeState,
	setMarqueeContext,
	getMarqueeContext,
	sideToOrientation,
	resolveGap,
	resolveLoopCount,
	computeMarqueeDuration,
	computeAutoFillMultiplier,
	observeMarqueeSizes
} from './marquee.svelte.js';

// types
export type {
	MarqueeSide,
	MarqueeOrientation,
	MarqueeEdgeSize,
	MarqueeSizes,
	DurationInput,
	MarqueeStateProps
} from './marquee.svelte.js';
```

**Stability note (deliverable 5).** `observeMarqueeSizes` and the five pure helpers are the pieces a
later size-driven port should reuse. They are DOM-agnostic apart from `observeMarqueeSizes`'s two
element arguments, they have no marquee-specific naming in their signatures beyond the prefix, and
they are covered by direct unit tests so a future consumer can rely on them without re-deriving the
arithmetic.

---

## CSS contract

Shipped with the registry item as `cssVars.theme` + `css`, and added to `src/app.css`:

| Theme variable                 | Value                                                                    |
| ------------------------------ | ------------------------------------------------------------------------ |
| `--animate-marquee-left`       | `marquee-left var(--marquee-duration) linear var(--marquee-loop-count)`       |
| `--animate-marquee-right`      | `marquee-right var(--marquee-duration) linear var(--marquee-loop-count)`      |
| `--animate-marquee-left-rtl`   | `marquee-left-rtl var(--marquee-duration) linear var(--marquee-loop-count)`   |
| `--animate-marquee-right-rtl`  | `marquee-right-rtl var(--marquee-duration) linear var(--marquee-loop-count)`  |
| `--animate-marquee-up`         | `marquee-up var(--marquee-duration) linear var(--marquee-loop-count)`         |
| `--animate-marquee-down`       | `marquee-down var(--marquee-duration) linear var(--marquee-loop-count)`       |

| Keyframes            | `0%`                                              | `100%`                                            |
| -------------------- | ------------------------------------------------- | ------------------------------------------------- |
| `marquee-left`       | `translateX(0%)`                                  | `translateX(calc(-100% - var(--marquee-gap)))`    |
| `marquee-right`      | `translateX(calc(-100% - var(--marquee-gap)))`    | `translateX(0%)`                                  |
| `marquee-left-rtl`   | `translateX(0%)`                                  | `translateX(calc(100% + var(--marquee-gap)))`     |
| `marquee-right-rtl`  | `translateX(calc(100% + var(--marquee-gap)))`     | `translateX(0%)`                                  |
| `marquee-up`         | `translateY(0%)`                                  | `translateY(calc(-100% - var(--marquee-gap)))`    |
| `marquee-down`       | `translateY(calc(-100% - var(--marquee-gap)))`    | `translateY(0%)`                                  |

| Consumer-settable custom property | Default      | Documented meaning                                            |
| --------------------------------- | ------------ | ------------------------------------------------------------- |
| `--marquee-duration`              | computed     | Animation duration in seconds, derived from content and speed. |
| `--marquee-gap`                   | `1rem`       | Gap between items and between loop repetitions.                |
| `--marquee-delay`                 | `0s`         | Delay before the animation starts.                             |
| `--marquee-loop-count`            | `infinite`   | Iteration count; a number or `infinite`.                       |

---

## Registry contract

```jsonc
{
	"name": "marquee",
	"type": "registry:ui",
	"title": "Marquee",
	"description": "An animated scrolling component that continuously moves content horizontally or vertically.",
	"registryDependencies": ["direction-provider"],
	"dependencies": ["tailwind-variants"],
	"cssVars": { "theme": { "--animate-marquee-left": "…", "…": "…" } },
	"css": { "@keyframes marquee-left": { "0%": { "transform": "…" }, "100%": { "transform": "…" } } },
	"files": [
		{ "path": "src/lib/components/ui/marquee/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/marquee/marquee.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/marquee/marquee-content.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/marquee/marquee-item.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/marquee/marquee-edge.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/marquee/marquee.svelte.ts", "type": "registry:ui" }
	]
}
```

- `name` == folder slug == demo route segment == `marquee`.
- Test files (`marquee.test.ts`, `marquee.test.svelte`) are **not** listed.
- `registryDependencies: ["direction-provider"]` because `marquee.svelte` imports `useDirection`.
- `dependencies: ["tailwind-variants"]` because both variant objects use `tv()` — the same
  declaration `timeline` makes. No other npm dependency is added by this port.
</content>
