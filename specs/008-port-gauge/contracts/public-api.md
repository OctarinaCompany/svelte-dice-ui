# Contract — Gauge public API

**Feature**: `008-port-gauge`. Derived line by line from
`.reference/diceui/docs/registry/bases/radix/ui/gauge.tsx` and
`.reference/diceui/docs/content/docs/components/radix/gauge.mdx` at the pinned commit.

This is the machine-checkable surface: every row below is asserted by
`src/lib/components/ui/gauge/gauge.test.ts`.

---

## 1. Barrel — `src/lib/components/ui/gauge/index.ts`

### Components

| Short name  | Prefixed alias   | File                       | Upstream                |
| ----------- | ---------------- | -------------------------- | ----------------------- |
| `Root`      | `Gauge`          | `gauge.svelte`             | `Gauge`                 |
| `Indicator` | `GaugeIndicator` | `gauge-indicator.svelte`   | `GaugeIndicator`        |
| `Track`     | `GaugeTrack`     | `gauge-track.svelte`       | `GaugeTrack`            |
| `Range`     | `GaugeRange`     | `gauge-range.svelte`       | `GaugeRange`            |
| `ValueText` | `GaugeValueText` | `gauge-value-text.svelte`  | `GaugeValueText`        |
| `Label`     | `GaugeLabel`     | `gauge-label.svelte`       | `GaugeLabel`            |
| `Combined`  | `GaugeCombined`  | `gauge-combined.svelte`    | `GaugeCombined`         |

Both import styles must work:

```ts
import * as Gauge from '$lib/components/ui/gauge/index.js'; // Gauge.Root, Gauge.Track
import { Gauge, GaugeTrack } from '$lib/components/ui/gauge/index.js';
```

### Types

`GaugeRootProps`, `GaugeIndicatorProps`, `GaugeTrackProps`, `GaugeRangeProps`,
`GaugeValueTextProps`, `GaugeLabelProps`, `GaugeCombinedProps`, `GaugeChildProps`,
`GaugeValueTextChildProps`, `GaugeLabelChildProps`, `GaugeState`, `Point`.

### Values

| Export                                                        | From                          |
| ------------------------------------------------------------- | ----------------------------- |
| `GaugeRootState`                                              | `gauge.svelte.ts`             |
| `setGaugeContext`, `getGaugeContext`, `hasGaugeContext`       | `gauge.svelte.ts`             |
| `getDefaultGaugeValueText`                                    | `gauge.svelte.ts`             |
| `DEFAULT_GAUGE_SIZE` (120), `DEFAULT_GAUGE_THICKNESS` (8), `DEFAULT_START_ANGLE` (0), `DEFAULT_END_ANGLE` (360) | `gauge.svelte.ts` |
| `getRingGeometry`, `getNormalizedAngle`, `polarToCartesian`, `describeArc`, `getArcLength`, `getArcCenterY` | re-exported from `circular-progress.svelte.ts` |
| `resolveProgressBounds`, `clampProgressValue`, `getProgressPercentage`, `getProgressState`, `DEFAULT_MIN`, `DEFAULT_MAX` | re-exported from `circular-progress.svelte.ts` |

---

## 2. `Gauge` (Root) — `gauge.svelte`

Renders a `<div>`, or the caller's element through `child`.

| Prop           | Type                                                  | Default                    | Bindable | Notes                                                    |
| -------------- | ----------------------------------------------------- | -------------------------- | -------- | -------------------------------------------------------- |
| `ref`          | `HTMLDivElement \| null`                              | `null`                     | **yes**  | `bind:this`; stays `null` in `child` mode.               |
| `value`        | `number \| null \| undefined`                         | `null`                     | no       | `null`/`undefined` ⇒ indeterminate; out of range clamps. |
| `getValueText` | `(value: number, min: number, max: number) => string` | `getDefaultGaugeValueText` | no       | Default returns `"45"` — **no** `%` suffix.              |
| `min`          | `number`                                              | `0`                        | no       | Non-finite ⇒ `0`.                                        |
| `max`          | `number`                                              | `100`                      | no       | Non-finite or `<= 0` ⇒ `100`; `<= min` ⇒ `min + 1`.      |
| `size`         | `number`                                              | `120`                      | no       | SVG width/height/viewBox, px.                            |
| `thickness`    | `number`                                              | `8`                        | no       | `stroke-width` of track and range, px.                   |
| `startAngle`   | `number`                                              | `0`                        | no       | Degrees clockwise from 12 o'clock.                       |
| `endAngle`     | `number`                                              | `360`                      | no       | Degrees clockwise from 12 o'clock.                       |
| `class`        | `ClassValue`                                          | —                          | no       | Merged **last** through `cn()`.                          |
| `children`     | `Snippet`                                             | —                          | no       | The composed parts.                                      |
| `child`        | `Snippet<[{ props: GaugeChildProps }]>`               | —                          | no       | Replaces upstream `asChild`; `children` not rendered.    |
| `…restProps`   | `HTMLAttributes<HTMLDivElement>`                      | —                          | —        | Spread before `class` (upstream order).                  |

**Snippets**: `children`, `child`. **Callbacks/events**: none — the component is display-only and never
writes `value`. DOM handlers pass through `restProps`.

**Emitted attributes**

| Attribute          | `indeterminate` (`value == null`) | `loading` / `complete`      |
| ------------------ | --------------------------------- | --------------------------- |
| `role`             | `meter`                           | `meter`                     |
| `aria-valuemin`    | resolved `min`                    | resolved `min`              |
| `aria-valuemax`    | resolved `max`                    | resolved `max`              |
| `aria-valuenow`    | **absent**                        | clamped `value`             |
| `aria-valuetext`   | **absent**                        | `getValueText(...)`         |
| `aria-describedby` | **absent**                        | `${uid}-value-text`         |
| `aria-labelledby`  | `${uid}-label` **iff** a `Gauge.Label` is rendered | same       |
| `data-slot`        | `gauge`                           | `gauge`                     |
| `data-state`       | `indeterminate`                   | `loading` \| `complete`     |
| `data-value`       | **absent**                        | clamped `value`             |
| `data-min`         | resolved `min`                    | resolved `min`              |
| `data-max`         | resolved `max`                    | resolved `max`              |
| `data-percentage`  | **absent**                        | decimal in `[0, 1]`         |

**Base class**: `relative inline-flex w-fit flex-col items-center justify-center`.

**Dev-only diagnostics** (`import.meta.env.DEV`, once per instance):

- `console.error` — invalid `max`: `` Invalid prop `max` of value `<v>` supplied to `Gauge`. Only numbers greater than 0 are valid. Defaulting to 100. ``
- `console.error` — invalid `value`: `` Invalid prop `value` of value `<v>` supplied to `Gauge`. The `value` prop must be a number between `min` and `max` (inclusive), or `null`/`undefined` for indeterminate state. The value will be clamped to the valid range. ``
- `console.warn` — `thickness >= size`: `` Gauge: thickness (<t>) should be less than size (<s>) for proper rendering. ``

---

## 3. `GaugeIndicator` — `gauge-indicator.svelte`

Renders `<svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 {size} {size}">`.

| Prop         | Type                           | Default | Bindable | Notes                              |
| ------------ | ------------------------------ | ------- | -------- | ---------------------------------- |
| `ref`        | `SVGSVGElement \| null`        | `null`  | **yes**  | Declared locally, not `WithElementRef`. |
| `class`      | `ClassValue`                   | —       | no       | Merged last onto `transform`.      |
| `children`   | `Snippet`                      | —       | no       | Normally `Track` + `Range`.        |
| `…restProps` | `SVGAttributes<SVGSVGElement>` | —       | —        |                                    |

**Attributes**: `data-slot="gauge-indicator"`, `data-state`, `data-value`\*, `data-min`, `data-max`,
`data-percentage`\*. **Base class**: `transform` (no rotation — see research.md R-10).

---

## 4. `GaugeTrack` — `gauge-track.svelte`

Renders `<path d={arcPath} fill="none" stroke="currentColor" stroke-width={thickness}
stroke-linecap="round" vector-effect="non-scaling-stroke">`.

| Prop         | Type                            | Default | Bindable |
| ------------ | ------------------------------- | ------- | -------- |
| `ref`        | `SVGPathElement \| null`        | `null`  | **yes**  |
| `class`      | `ClassValue`                    | —       | no       |
| `…restProps` | `SVGAttributes<SVGPathElement>` | —       | —        |

**Attributes**: `data-slot="gauge-track"`, `data-state`. **Base class**: `text-muted-foreground/20`.
No children (upstream renders none).

---

## 5. `GaugeRange` — `gauge-range.svelte`

Same `d`/stroke setup as `Track`, plus:

| Attribute            | Value                                                                     |
| -------------------- | ------------------------------------------------------------------------- |
| `stroke-dasharray`   | `arcLength`                                                               |
| `stroke-dashoffset`  | `indeterminate` → `0`; else `arcLength - percentage · arcLength`; `percentage === null` → `arcLength` |

| Prop         | Type                            | Default | Bindable |
| ------------ | ------------------------------- | ------- | -------- |
| `ref`        | `SVGPathElement \| null`        | `null`  | **yes**  |
| `class`      | `ClassValue`                    | —       | no       |
| `…restProps` | `SVGAttributes<SVGPathElement>` | —       | —        |

**Attributes**: `data-slot="gauge-range"`, `data-state`, `data-value`\*, `data-min`, `data-max`.
**Base class**: `text-primary transition-[stroke-dashoffset] duration-700 ease-out`.

---

## 6. `GaugeValueText` — `gauge-value-text.svelte`

Renders `<div id={valueTextId} style="top: {arcCenterY}px;{caller style}">` containing
`children ?? valueText`.

| Prop         | Type                                            | Default | Bindable | Notes                                        |
| ------------ | ----------------------------------------------- | ------- | -------- | -------------------------------------------- |
| `ref`        | `HTMLDivElement \| null`                        | `null`  | **yes**  |                                              |
| `class`      | `ClassValue`                                    | —       | no       |                                              |
| `style`      | `string \| undefined \| null`                   | —       | no       | Appended after `top:` so the caller wins.    |
| `children`   | `Snippet`                                       | —       | no       | Takes precedence over the computed text.     |
| `child`      | `Snippet<[{ props: GaugeValueTextChildProps }]>`| —       | no       | Replaces upstream `asChild`.                 |
| `…restProps` | `HTMLAttributes<HTMLDivElement>`                | —       | —        |                                              |

**Attributes**: `id`, `data-slot="gauge-value-text"`, `data-state`. **Base class**:
`absolute right-0 left-0 flex -translate-y-1/2 items-center justify-center text-2xl font-semibold`.

---

## 7. `GaugeLabel` — `gauge-label.svelte`

Renders `<div id={labelId}>` with the caller's children. Registers itself with the root so the root
emits `aria-labelledby` (research.md R-06).

| Prop         | Type                                        | Default | Bindable |
| ------------ | ------------------------------------------- | ------- | -------- |
| `ref`        | `HTMLDivElement \| null`                    | `null`  | **yes**  |
| `class`      | `ClassValue`                                | —       | no       |
| `children`   | `Snippet`                                   | —       | no       |
| `child`      | `Snippet<[{ props: GaugeLabelChildProps }]>`| —       | no       |
| `…restProps` | `HTMLAttributes<HTMLDivElement>`            | —       | —        |

**Attributes**: `id`, `data-slot="gauge-label"`, `data-state`. **Base class**:
`mt-2 text-sm font-medium text-muted-foreground`.

---

## 8. `GaugeCombined` — `gauge-combined.svelte`

`GaugeCombinedProps = WithoutChildrenOrChild<GaugeRootProps>`; renders

```text
Root > Indicator > (Track, Range)
     > ValueText
```

`ref` is forwarded and bindable. No `label` prop — upstream's MDX shows `<GaugeCombined label="…" />`
but neither `GaugeProps` nor the source accepts it (spec §Assumptions); compose `Gauge.Label` instead.

---

## 9. Errors

Rendering `Indicator`, `Track`, `Range`, `ValueText` or `Label` outside a `Gauge.Root` throws:

```text
`<GaugeIndicator>` must be used within `<Gauge>`.
```

(matching `/must be used within `<Gauge>`/`, and the shared `/within/` assertion used across this repo),
with the consumer name substituted per part.

## 10. Geometry reference values (independent check)

For `size = 120`, `thickness = 8` ⇒ `radius = 56`, `center = 60`.

| Sweep         | `arcLength`                | `d` shape                                    | `arcCenterY` |
| ------------- | -------------------------- | -------------------------------------------- | ------------ |
| `0 → 360`     | `2π·56` ≈ `351.858`        | `M … A … A …` (two chained arcs)              | `60`         |
| `-90 → 90`    | `2π·56 · 180/360` ≈ `175.929` | `M 4 60 A 56 56 0 0 1 116 60` (flag `0`)   | `60`         |
| `-135 → 135`  | `2π·56 · 270/360` ≈ `263.894` | single `A`, large-arc flag `1`             | `60`         |
| `0 → 90`      | `2π·56 · 90/360` ≈ `87.965`   | single `A`, flag `0`                       | `60`         |
| `40 → 40`     | `0`                        | single `A`, start == end                      | `60`         |

`stroke-dashoffset` at `value = 45`, `min = 0`, `max = 100`, full circle:
`351.858 - 0.45 · 351.858` ≈ `193.522`.
