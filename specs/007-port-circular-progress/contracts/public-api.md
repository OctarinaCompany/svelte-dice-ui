# Contract — `circular-progress` public API

**Feature**: `007-port-circular-progress` | **Date**: 2026-07-29

The interface this feature exposes is (a) the Svelte component API of the barrel
`$lib/components/ui/circular-progress/index.js` and (b) the DOM/ARIA output those components produce.
Both are contracts: consumers install the source and style it through the emitted `data-*` attributes.

---

## 1. Barrel exports

```ts
import * as CircularProgress from '$lib/components/ui/circular-progress/index.js';
// CircularProgress.Root | .Indicator | .Track | .Range | .ValueText | .Combined

import {
	CircularProgress,
	CircularProgressIndicator,
	CircularProgressTrack,
	CircularProgressRange,
	CircularProgressValueText,
	CircularProgressCombined
} from '$lib/components/ui/circular-progress/index.js';
```

| Short name  | Prefixed alias              | File                                  |
| ----------- | --------------------------- | ------------------------------------- |
| `Root`      | `CircularProgress`          | `circular-progress.svelte`            |
| `Indicator` | `CircularProgressIndicator` | `circular-progress-indicator.svelte`  |
| `Track`     | `CircularProgressTrack`     | `circular-progress-track.svelte`      |
| `Range`     | `CircularProgressRange`     | `circular-progress-range.svelte`      |
| `ValueText` | `CircularProgressValueText` | `circular-progress-value-text.svelte` |
| `Combined`  | `CircularProgressCombined`  | `circular-progress-combined.svelte`   |

### Exported types

`CircularProgressRootProps`, `CircularProgressChildProps`, `CircularProgressIndicatorProps`,
`CircularProgressTrackProps`, `CircularProgressRangeProps`, `CircularProgressValueTextProps`,
`CircularProgressValueTextChildProps`, `CircularProgressCombinedProps`, `ProgressState`, `RingGeometry`,
`CircularProgressState`.

### Exported runtime helpers (reusable by later ports)

`PROGRESS_STATES`, `DEFAULT_MIN`, `DEFAULT_MAX`, `DEFAULT_SIZE`, `DEFAULT_THICKNESS`, `isValidNumber`,
`isValidMaxNumber`, `isValidValueNumber`, `getProgressState`, `getDefaultValueText`,
`resolveProgressBounds`, `clampProgressValue`, `getProgressPercentage`, `getRingGeometry`,
`CircularProgressState`, `setCircularProgressContext`, `hasCircularProgressContext`,
`getCircularProgressContext`.

---

## 2. Prop contract

### `Root` / `Combined`

```ts
export type CircularProgressRootProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
	/**
	 * The current progress value as a number between the min and max values.
	 * Set to `null` or `undefined` for indeterminate progress.
	 */
	value?: number | null | undefined;
	/**
	 * A function that returns the accessible text representation of the current value.
	 * Useful for providing custom formatting or localization.
	 *
	 * @default (value, min, max) => Math.round(((value - min) / (max - min)) * 100) + "%"
	 */
	getValueText?: (value: number, min: number, max: number) => string;
	/**
	 * The maximum allowed value for the progress.
	 * Must be a positive number greater than 0.
	 * @default 100
	 */
	max?: number;
	/**
	 * The minimum allowed value for the progress.
	 * @default 0
	 */
	min?: number;
	/**
	 * The size of the circular progress in pixels.
	 * This determines both the width and height of the component.
	 * @default 48
	 */
	size?: number;
	/**
	 * The thickness of the progress track and range in pixels.
	 * A larger value creates a thicker progress ring.
	 * @default 4
	 */
	thickness?: number;
	/** Visible label rendered inside the root and wired via `aria-labelledby`. */
	label?: string;
	/** Replaces upstream's `asChild`. In `child` mode `children`/`label` are not rendered and `ref` stays `null`. */
	child?: Snippet<[{ props: CircularProgressChildProps }]>;
};

export type CircularProgressCombinedProps = WithoutChildrenOrChild<CircularProgressRootProps>;
```

### Parts

```ts
export type CircularProgressIndicatorProps = SVGAttributes<SVGSVGElement> & {
	ref?: SVGSVGElement | null;
};
export type CircularProgressTrackProps = SVGAttributes<SVGCircleElement> & {
	ref?: SVGCircleElement | null;
};
export type CircularProgressRangeProps = SVGAttributes<SVGCircleElement> & {
	ref?: SVGCircleElement | null;
};
export type CircularProgressValueTextProps = WithElementRef<
	HTMLAttributes<HTMLSpanElement>,
	HTMLSpanElement
> & {
	child?: Snippet<[{ props: CircularProgressValueTextChildProps }]>;
};
```

Defaults: `value = null`, `min = 0`, `max = 100`, `size = 48`, `thickness = 4`,
`getValueText = getDefaultValueText`. `ref` on every part is `$bindable(null)`.

---

## 3. DOM contract

Reference composition:

```svelte
<CircularProgress.Root value={50} size={48} thickness={4}>
	<CircularProgress.Indicator>
		<CircularProgress.Track />
		<CircularProgress.Range />
	</CircularProgress.Indicator>
	<CircularProgress.ValueText />
</CircularProgress.Root>
```

produces (attribute order irrelevant; `class` shown abbreviated):

```html
<div
	role="progressbar"
	aria-describedby="«uid»-value-text"
	aria-valuemin="0"
	aria-valuemax="100"
	aria-valuenow="50"
	aria-valuetext="50%"
	data-slot="circular-progress"
	data-state="loading"
	data-value="50"
	data-min="0"
	data-max="100"
	data-percentage="0.5"
	class="relative inline-flex w-fit items-center justify-center"
>
	<svg
		aria-hidden="true"
		focusable="false"
		viewBox="0 0 48 48"
		width="48"
		height="48"
		data-slot="circular-progress-indicator"
		data-state="loading"
		data-value="50"
		data-min="0"
		data-max="100"
		data-percentage="0.5"
		class="-rotate-90 transform"
	>
		<circle
			data-slot="circular-progress-track"
			data-state="loading"
			cx="24" cy="24" r="22"
			fill="none" stroke="currentColor" stroke-width="4"
			stroke-linecap="round" vector-effect="non-scaling-stroke"
			class="text-muted-foreground/20"
		/>
		<circle
			data-slot="circular-progress-range"
			data-state="loading"
			data-value="50" data-min="0" data-max="100"
			cx="24" cy="24" r="22"
			fill="none" stroke="currentColor" stroke-width="4"
			stroke-linecap="round" vector-effect="non-scaling-stroke"
			stroke-dasharray="138.23007675795088"
			stroke-dashoffset="69.11503837897544"
			class="origin-center text-primary transition-all duration-300 ease-in-out"
		/>
	</svg>
	<span
		id="«uid»-value-text"
		data-slot="circular-progress-value-text"
		data-state="loading"
		class="absolute inset-0 flex items-center justify-center text-sm font-medium"
	>50%</span>
</div>
```

With `label="Upload"` the root additionally renders `aria-labelledby="«uid»-label"` and, as its **last**
child, `<div id="«uid»-label">Upload</div>`.

### ARIA matrix (the FR-003 / FR-004 contract)

| Attribute (on root) | Determinate (`value` valid)      | Indeterminate (`value` null/undefined/non-finite) |
| ------------------- | -------------------------------- | -------------------------------------------------- |
| `role`              | `"progressbar"`                  | `"progressbar"`                                     |
| `aria-valuemin`     | `min`                            | `min`                                               |
| `aria-valuemax`     | `max`                            | `max`                                               |
| `aria-valuenow`     | clamped `value`                  | **absent**                                          |
| `aria-valuetext`    | `getValueText(value, min, max)`  | **absent**                                          |
| `aria-describedby`  | `«uid»-value-text`               | **absent**                                          |
| `aria-labelledby`   | `«uid»-label` iff `label` is set | `«uid»-label` iff `label` is set                    |
| `tabindex`          | **absent** (non-focusable)       | **absent**                                          |

### Data-attribute matrix

| Attribute         | Root | Indicator | Track | Range | ValueText | Value                                             |
| ----------------- | :--: | :-------: | :---: | :---: | :-------: | -------------------------------------------------- |
| `data-slot`       |  ✓   |     ✓     |   ✓   |   ✓   |     ✓     | `circular-progress[-indicator\|-track\|-range\|-value-text]` |
| `data-state`      |  ✓   |     ✓     |   ✓   |   ✓   |     ✓     | `indeterminate \| loading \| complete`              |
| `data-value`      |  ✓   |     ✓     |   —   |   ✓   |     —     | clamped value; absent when indeterminate           |
| `data-min`        |  ✓   |     ✓     |   —   |   ✓   |     —     | effective `min`                                    |
| `data-max`        |  ✓   |     ✓     |   —   |   ✓   |     —     | effective `max`                                    |
| `data-percentage` |  ✓   |     ✓     |   —   |   —   |     —     | `0`–`1`; absent when indeterminate                 |

### Geometry contract

| Attribute                  | Element         | Value                                                        |
| -------------------------- | --------------- | ------------------------------------------------------------ |
| `width` / `height`         | `svg`           | `size`                                                        |
| `viewBox`                  | `svg`           | `0 0 {size} {size}`                                           |
| `cx` / `cy`                | both `circle`s  | `size / 2`                                                    |
| `r`                        | both `circle`s  | `Math.max(0, (size - thickness) / 2)`                         |
| `stroke-width`             | both `circle`s  | `thickness`                                                   |
| `stroke-linecap`           | both `circle`s  | `round`                                                       |
| `vector-effect`            | both `circle`s  | `non-scaling-stroke`                                          |
| `fill` / `stroke`          | both `circle`s  | `none` / `currentColor`                                       |
| `stroke-dasharray`         | range `circle`  | `2 * Math.PI * r`                                             |
| `stroke-dashoffset`        | range `circle`  | indeterminate ⇒ `dasharray * 0.75`; else `dasharray * (1 - percentage)` |

### Error contract

Rendering `Indicator`, `Track`, `Range` or `ValueText` outside a `Root` throws:

```text
`<CircularProgressIndicator>` must be used within `<CircularProgress>`.
```

(with the consumer's own name substituted). Matched in tests by `/must be used within/`.

### Clamping and validation contract

| Input                             | Effective result                                           |
| --------------------------------- | ----------------------------------------------------------- |
| `value = 150`, `max = 100`        | `value → 100`, `state = complete`, `aria-valuenow="100"`     |
| `value = -20`, `min = 0`          | `value → 0`, `state = loading`, `aria-valuenow="0"`          |
| `value = NaN` / `Infinity`        | `value → null`, `state = indeterminate`                      |
| `value = null` / omitted          | `state = indeterminate`                                      |
| `max = 0` / `-5` / `NaN`          | `max → 100`                                                  |
| `max = 50`, `min = 80`            | `max → 81`                                                   |
| `min = NaN`                       | `min → 0`                                                    |
| `thickness = 12`, `size = 8`      | `r → 0`, renders without throwing                            |
| `value = 25`, `min = 0`, `max = 50` | `percentage = 0.5`, default value text `"50%"`             |

Each row of this table has a corresponding assertion in `circular-progress.test.ts`.

---

## 4. Registry contract

```jsonc
{
	"name": "circular-progress",
	"type": "registry:ui",
	"title": "Circular Progress",
	"description": "A circular progress indicator that displays completion progress in a ring format with support for indeterminate states.",
	"registryDependencies": [],
	"dependencies": [],
	"files": [
		{ "path": "src/lib/components/ui/circular-progress/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/circular-progress/circular-progress.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/circular-progress/circular-progress-indicator.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/circular-progress/circular-progress-track.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/circular-progress/circular-progress-range.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/circular-progress/circular-progress-value-text.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/circular-progress/circular-progress-combined.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/circular-progress/circular-progress.svelte.ts", "type": "registry:ui" }
	]
}
```

`registryDependencies` and `dependencies` are both empty: the component imports only `cn` from
`$lib/utils.js` (rewritten to a registry placeholder by `pnpm run registry:build`) and types from
`svelte`/`svelte/elements`. Test files are excluded.
