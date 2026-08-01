# Public API Contract: `angle-slider`

**Derived from** `.reference/diceui/docs/registry/bases/radix/ui/angle-slider.tsx` and
`angle-slider.mdx` at the pinned commit `d9763d8`. Divergence IDs (`D-nn`) refer to
[`research.md`](../research.md).

Import surface:

```ts
import * as AngleSlider from '$lib/components/ui/angle-slider/index.js';
// AngleSlider.Root / .Track / .Range / .Thumb / .Value / .HiddenInput

import { AngleSlider, AngleSliderThumb } from '$lib/components/ui/angle-slider/index.js';
```

Composition (mirrors the MDX "Layout" section):

```svelte
<AngleSlider.Root defaultValue={[180]} min={0} max={360} step={1}>
	<AngleSlider.Track>
		<AngleSlider.Range />
	</AngleSlider.Track>
	<AngleSlider.Thumb />
	<AngleSlider.Value />
</AngleSlider.Root>
```

---

## 1. `AngleSlider.Root` — `angle-slider.svelte`

Renders a `<div>`. Type: `AngleSliderRootProps extends WithElementRef<HTMLAttributes<HTMLDivElement>>`.

| Prop                    | Type                                 | Default          | Bindable | Notes                                                     |
| ----------------------- | ------------------------------------ | ---------------- | -------- | ---------------------------------------------------------- |
| `ref`                   | `HTMLDivElement \| null`             | `null`           | **yes**  | `bind:this`; replaces `forwardRef`                         |
| `value`                 | `number[]`                           | —                | **yes**  | See the three caller modes below                           |
| `defaultValue`          | `number[]`                           | `[0]`            | no       | One-shot seed when `value` is absent                       |
| `onValueChange`         | `(value: number[]) => void`          | —                | no       | Every value change, pointer or keyboard                    |
| `onValueCommit`         | `(value: number[]) => void`          | —                | no       | Once per completed drag / per key press (FR-014)           |
| `min`                   | `number`                             | `0`              | no       |                                                            |
| `max`                   | `number`                             | `100`            | no       |                                                            |
| `step`                  | `number`                             | `1`              | no       | Decimal count drives the rounding precision                |
| `minStepsBetweenThumbs` | `number`                             | `0`              | no       | Guard distance is `minStepsBetweenThumbs * step`, in value units |
| `size`                  | `number`                             | `60`             | no       | Dial **radius** in px, not width                           |
| `thickness`             | `number`                             | `8`              | no       | Track stroke width in px                                   |
| `startAngle`            | `number`                             | `-90`            | no       | `-90` = 12 o'clock                                         |
| `endAngle`              | `number`                             | `270`            | no       | Sweep `= (endAngle - startAngle + 360) % 360 \|\| 360`     |
| `dir`                   | `'ltr' \| 'rtl'`                     | inherited        | no       | Overrides `<DirectionProvider>` / nearest DOM `[dir]`      |
| `form`                  | `string \| undefined`                | —                | no       | Forwarded to every hidden input                            |
| `name`                  | `string \| undefined`                | —                | no       | `name` for one thumb, `name[]` for two or more             |
| `disabled`              | `boolean`                            | `false`          | no       |                                                            |
| `readOnly`              | `boolean`                            | `false`          | no       | **D-06** — additive, no upstream equivalent                |
| `inverted`              | `boolean`                            | `false`          | no       | Reverses value→angle *and* arrow-key sign                  |
| `class`                 | `string`                             | —                | no       | Merged last through `cn()`                                 |
| `children`              | `Snippet`                            | —                | no       |                                                            |
| `child`                 | `Snippet<[{ props: AngleSliderChildProps }]>` | —       | no       | **D-08** — replaces `asChild`                              |
| `onkeydown`             | `(e: KeyboardEvent) => void`         | —                | no       | Called first; `preventDefault()` cancels the built-in handling |
| `onpointerdown`         | `(e: PointerEvent) => void`          | —                | no       | Same bail-out contract                                     |
| `onpointermove`         | `(e: PointerEvent) => void`          | —                | no       | Same bail-out contract                                     |
| `onpointerup`           | `(e: PointerEvent) => void`          | —                | no       | Same bail-out contract                                     |
| `...restProps`          | `HTMLAttributes<HTMLDivElement>`     | —                | no       | Spread onto the `<div>`                                    |

**`value` caller modes** (R-11) — documented verbatim on the prop's JSDoc:

| Written as                              | Authority                                                    |
| --------------------------------------- | ------------------------------------------------------------ |
| `defaultValue={[45]}`                   | the component                                                |
| `bind:value={angle}`                    | shared; the dial moves the caller's state                    |
| `bind:value={() => angle, (next) => …}` | the caller; a setter that declines leaves the dial in place  |

**Rendered attributes**

```
data-slot="angle-slider"
data-disabled            present when disabled
data-readonly            present when readOnly            (D-06)
dir                      resolved direction
style                    width/height = `${size * 2 + 40}px`
class                    cn('relative touch-none select-none', disabled && 'opacity-50', className)
```

**Emits**: `onValueChange`, `onValueCommit`. No `createEventDispatcher`.

---

## 2. `AngleSlider.Track` — `angle-slider-track.svelte`

Renders an `<svg>`. Type: `AngleSliderTrackProps extends WithElementRef<SVGAttributes<SVGSVGElement>>`.

| Prop           | Type                              | Default | Bindable |
| -------------- | --------------------------------- | ------- | -------- |
| `ref`          | `SVGSVGElement \| null`           | `null`  | **yes**  |
| `class`        | `string`                          | —       | no       |
| `children`     | `Snippet`                         | —       | no       |
| `...restProps` | `SVGAttributes<SVGSVGElement>`    | —       | no       |

Reads `disabled`, `size`, `thickness`, `startAngle`, `endAngle` from context. Renders the rail as a
`<circle>` when the sweep is `>= 359°`, otherwise as an arc `<path>`; then `{@render children?.()}`.

```
<svg  data-slot="angle-slider-track" data-disabled aria-hidden="true" focusable="false"
      width/height = (size + 20) * 2  class="absolute inset-0 …">
  <circle|path data-slot="angle-slider-track-rail" class="stroke-muted"
                stroke-width={thickness} stroke-linecap="round" vector-effect="non-scaling-stroke" />
```

---

## 3. `AngleSlider.Range` — `angle-slider-range.svelte`

Renders a `<path>`. Type: `AngleSliderRangeProps extends WithElementRef<SVGAttributes<SVGPathElement>>`.

| Prop           | Type                            | Default | Bindable |
| -------------- | ------------------------------- | ------- | -------- |
| `ref`          | `SVGPathElement \| null`        | `null`  | **yes**  |
| `class`        | `string`                        | —       | no       |
| `...restProps` | `SVGAttributes<SVGPathElement>` | —       | no       |

Spans `min → values[0]` for a single value, and `min(values) → max(values)` for two or more.
**Renders nothing when the two ends are equal** (upstream verbatim — a single-thumb dial at `min`
draws no range). `data-slot="angle-slider-range"`, `data-disabled`, `class="stroke-primary"`.

---

## 4. `AngleSlider.Thumb` — `angle-slider-thumb.svelte`

Renders a positioned `<span>` wrapper containing a `<div role="slider">` and, inside a form, one
hidden input. Type: `AngleSliderThumbProps extends WithElementRef<HTMLAttributes<HTMLDivElement>>`.

| Prop           | Type                                               | Default | Bindable | Notes                          |
| -------------- | -------------------------------------------------- | ------- | -------- | ------------------------------- |
| `ref`          | `HTMLDivElement \| null`                           | `null`  | **yes**  |                                 |
| `index`        | `number`                                           | `0`     | no       | Index into the value array      |
| `class`        | `string`                                           | —       | no       |                                 |
| `child`        | `Snippet<[{ props: AngleSliderThumbChildProps }]>` | —       | no       | **D-08**                        |
| `...restProps` | `HTMLAttributes<HTMLDivElement>`                   | —       | no       |                                 |

**Renders nothing when `values[index] === undefined`** (upstream verbatim; spec Edge Cases).

```
role="slider"
aria-valuemin={min}  aria-valuenow={value}  aria-valuemax={max}
aria-orientation="vertical"
aria-disabled="true"   when disabled     (D-07)
aria-readonly="true"   when readOnly     (D-06)
tabindex={disabled ? undefined : 0}
data-slot="angle-slider-thumb"  data-disabled  data-readonly  data-index={index}
```

Wrapper `<span>` is absolutely positioned at `left: centre + size·cos θ`, `top: centre + size·sin θ`,
`transform: translate(-50%, -50%)`, and owns the root registration, so registration survives `child`
mode (R-10).

---

## 5. `AngleSlider.Value` — `angle-slider-value.svelte`

Renders a `<div>` pinned to the dial's centre. Type:
`AngleSliderValueProps extends WithElementRef<HTMLAttributes<HTMLDivElement>>`.

| Prop           | Type                                               | Default | Bindable | Notes                                     |
| -------------- | -------------------------------------------------- | ------- | -------- | ------------------------------------------ |
| `ref`          | `HTMLDivElement \| null`                           | `null`  | **yes**  |                                            |
| `unit`         | `string`                                           | `'°'`   | no       |                                            |
| `formatValue`  | `(value: number \| number[]) => string`            | —       | no       | Receives a `number` for one thumb, the array for more |
| `class`        | `string`                                           | —       | no       |                                            |
| `style`        | `string`                                           | —       | no       | Merged after the positioning style          |
| `children`     | `Snippet`                                          | —       | no       | Overrides the computed text                |
| `child`        | `Snippet<[{ props: AngleSliderValueChildProps }]>` | —       | no       | **D-08**                                   |
| `...restProps` | `HTMLAttributes<HTMLDivElement>`                   | —       | no       |                                            |

Default text: `` `${values[0]}${unit}` `` for one value; `` `${min}${unit} - ${max}${unit}` `` over the
sorted values for two or more. `data-slot="angle-slider-value"`, `data-disabled`, `data-readonly`.

---

## 6. `AngleSlider.HiddenInput` — `angle-slider-hidden-input.svelte`

The port of upstream `components/visually-hidden-input.tsx` (R-09). Exported so a later component can
reuse it; promoted to its own registry item if a second consumer appears.

| Prop           | Type                                    | Default    | Bindable | Notes                                       |
| -------------- | --------------------------------------- | ---------- | -------- | -------------------------------------------- |
| `ref`          | `HTMLInputElement \| null`              | `null`     | **yes**  |                                              |
| `control`      | `HTMLElement \| null`                   | — (req.)   | no       | Element whose border box the input mirrors   |
| `value`        | `string \| string[] \| undefined`       | —          | no       | Arrays are `JSON.stringify`d, upstream verbatim |
| `checked`      | `boolean \| undefined`                  | —          | no       | Used only for check-like `type`s             |
| `bubbles`      | `boolean`                               | `true`     | no       | Of the synthesised `input` / `click` event   |
| `type`         | `HTMLInputTypeAttribute`                | `'hidden'` | no       | The thumb passes `'number'`                  |
| `...restProps` | `HTMLInputAttributes`                   | —          | no       | `name`, `form`, `min`, `max`, `step`, `disabled` |

Always renders `aria-hidden="true"` (**D-05**) and `tabindex="-1"`, clipped with
`clip-path: inset(50%)` at `1px × 1px`, sized from a `ResizeObserver` on `control` with an
`$effect` teardown that disconnects it.

---

## 7. Non-component exports (from `angle-slider.svelte.ts`, re-exported by `index.ts`)

Upstream exports `useStore as useAngleSlider`; the equivalent here is `getAngleSliderContext()`.

```ts
export class AngleSliderRootState { … }

export function setAngleSliderContext(state: AngleSliderRootState): AngleSliderRootState;
export function hasAngleSliderContext(): boolean;
export function getAngleSliderContext(consumerName?: string): AngleSliderRootState;
// throws: `<AngleSlider.Thumb>` must be used within `<AngleSlider>`.

// Pure, unit-testable arithmetic — the exact upstream formulas (R-01, R-02, R-03).
export function clamp(value: number, min: number, max: number): number;
export function getDecimalCount(value: number): number;
export function roundValue(value: number, decimalCount: number): number;
export function snapToStep(value: number, min: number, max: number, step: number): number;
export function getNextSortedValues(prev: number[], next: number, atIndex: number): number[];
export function getStepsBetweenValues(values: number[]): number[];
export function hasMinStepsBetweenValues(values: number[], minSteps: number): boolean;
export function getClosestValueIndex(values: number[], nextValue: number): number;
export function getTotalAngle(startAngle: number, endAngle: number): number;
export function getValueFromPointer(clientX, clientY, rect, geometry): number | null;
export function getAngleFromValue(value: number, geometry): number;
export function getPositionFromAngle(angle: number, size: number): { x: number; y: number };
export function describeAngleArc(centre, radius, startAngle, endAngle): string;

export type AngleSliderGeometry = {
	min: number; max: number; inverted: boolean; startAngle: number; endAngle: number;
};

export const DEFAULT_MIN, DEFAULT_MAX, DEFAULT_STEP, DEFAULT_SIZE,
             DEFAULT_THICKNESS, DEFAULT_START_ANGLE, DEFAULT_END_ANGLE,
             THUMB_HALO, PAGE_KEYS, ARROW_KEYS;
```

Every prop type above is re-exported from `index.ts`:
`AngleSliderRootProps`, `AngleSliderChildProps`, `AngleSliderTrackProps`, `AngleSliderRangeProps`,
`AngleSliderThumbProps`, `AngleSliderThumbChildProps`, `AngleSliderValueProps`,
`AngleSliderValueChildProps`, `AngleSliderHiddenInputProps`.

---

## 8. Keyboard contract (FR-010, R-06)

Handled on the **root**, acting on the active thumb (the last focused / last dragged index).

| Key                      | Δ before modifiers | `inverted` | `dir="rtl"`      |
| ------------------------ | ------------------ | ---------- | ----------------- |
| `ArrowUp`                | `+step`            | negated    | unchanged         |
| `ArrowRight`             | `+step`            | negated    | **swapped** (D-01)|
| `ArrowDown`              | `-step`            | negated    | unchanged         |
| `ArrowLeft`              | `-step`            | negated    | **swapped** (D-01)|
| `PageUp`                 | `+10 · step`       | negated    | unchanged         |
| `PageDown`               | `-10 · step`       | negated    | unchanged         |
| `Shift` + any arrow      | `×10`              | negated    | as the bare arrow |
| `Home`                   | active thumb → `min` (D-03) | —  | —                 |
| `End`                    | active thumb → `max` (D-03) | —  | —                 |

Every handled key calls `preventDefault()` and commits (`onValueCommit`). All are inert under
`disabled` or `readOnly`.

## 9. Data-attribute contract (FR-018, MDX `DataAttributesTable`)

| Attribute                              | On                       | Present when             |
| -------------------------------------- | ------------------------ | ------------------------- |
| `[data-slot="angle-slider"]`           | root                     | always                    |
| `[data-slot="angle-slider-track"]`     | track `<svg>`            | always                    |
| `[data-slot="angle-slider-track-rail"]`| rail `<circle>`/`<path>` | always                    |
| `[data-slot="angle-slider-range"]`     | range `<path>`           | ends differ               |
| `[data-slot="angle-slider-thumb"]`     | thumb                    | `values[index]` defined   |
| `[data-slot="angle-slider-value"]`     | value                    | always                    |
| `[data-disabled]`                      | all five parts           | `disabled`                |
| `[data-readonly]`                      | all five parts           | `readOnly` (D-06)         |
| `[data-index]`                         | thumb                    | always                    |
