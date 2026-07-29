# Phase 1 Data Model — Circular Progress

**Feature**: `007-port-circular-progress` | **Date**: 2026-07-29

This component has no persistent storage and no mutable state. Its "data model" is a single derivation
pipeline from six root props to one context object that five parts read.

## Entities

### 1. `ProgressState` (value object)

```ts
export const PROGRESS_STATES = ['indeterminate', 'loading', 'complete'] as const;
export type ProgressState = (typeof PROGRESS_STATES)[number];
```

| Value             | Condition                          | Consumers                                                        |
| ----------------- | ---------------------------------- | ---------------------------------------------------------------- |
| `indeterminate`   | clamped `value === null`           | omits `aria-valuenow`/`aria-valuetext`/`data-value`/`data-percentage`; range spins, `stroke-dashoffset = circumference * 0.75` |
| `complete`        | `value === max`                    | full ring (`stroke-dashoffset = 0`)                               |
| `loading`         | any other determinate value        | proportional ring                                                 |

State transitions are pure re-derivations on prop change; there is no transition side effect, no timer and
no animation state to track. `getProgressState(value, max)` is the single source.

### 2. `ProgressBounds` (value object)

Produced by `resolveProgressBounds(minProp, maxProp)`.

| Field | Type     | Derivation                                                                  |
| ----- | -------- | --------------------------------------------------------------------------- |
| `min` | `number` | `isValidNumber(minProp) ? minProp : 0`                                       |
| `max` | `number` | `rawMax = isValidMaxNumber(maxProp) ? maxProp : 100`; then `rawMax <= min ? min + 1 : rawMax` |

Validation rules (FR-008):

- `isValidNumber(v)` ⇔ `typeof v === 'number' && Number.isFinite(v)`
- `isValidMaxNumber(v)` ⇔ `isValidNumber(v) && v > 0`
- Post-condition, always true: `max > min`. This is what makes the `max === min` division-by-zero branch
  unreachable through the component (it is still implemented and unit-tested in the helper, because the
  helper is exported for reuse).

### 3. `ProgressReading` (value object)

Produced by `clampProgressValue(valueProp, min, max)` and `getProgressPercentage(value, min, max)`.

| Field        | Type              | Derivation                                                                                                    |
| ------------ | ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `value`      | `number \| null`  | in-range ⇒ itself; `> max` ⇒ `max`; `< min` ⇒ `min`; non-finite / `null` / `undefined` ⇒ `null` (FR-007)          |
| `percentage` | `number \| null`  | `value === null` ⇒ `null`; `max === min` ⇒ `1`; else `(value - min) / (max - min)` — a decimal in `[0, 1]`      |
| `valueText`  | `string \| undefined` | `value === null` ⇒ `undefined`; else `getValueText(value, min, max)`, default `` `${Math.round(pct * 100)}%` `` |

`getDefaultValueText(value, min, max)` uses `max === min ? 100 : ((value - min) / (max - min)) * 100`,
rounded — upstream verbatim.

### 4. `RingGeometry` (value object)

Produced by `getRingGeometry(size, thickness)`.

| Field           | Type     | Derivation                        | Notes                                        |
| --------------- | -------- | --------------------------------- | -------------------------------------------- |
| `radius`        | `number` | `Math.max(0, (size - thickness) / 2)` | Floors at 0 so `thickness >= size` renders instead of producing a negative `r`. |
| `center`        | `number` | `size / 2`                        | `cx`/`cy` of both circles.                    |
| `circumference` | `number` | `2 * Math.PI * radius`            | `stroke-dasharray` of the range.              |

### 5. `CircularProgressState` (runes state class, published on context)

Constructed once by the root with getter functions, so every member stays reactive:

```ts
type CircularProgressStateProps = {
	readonly getValue: () => number | null | undefined;
	readonly getGetValueText: () => (value: number, min: number, max: number) => string;
	readonly getMin: () => number;
	readonly getMax: () => number | undefined;
	readonly getSize: () => number;
	readonly getThickness: () => number;
	readonly getValueTextId: () => string;
};
```

Exposed members (all `$derived`), matching upstream's `CircularProgressContextValue` field for field:

| Member          | Type                  | Upstream field  |
| --------------- | --------------------- | --------------- |
| `value`         | `number \| null`      | `value`         |
| `valueText`     | `string \| undefined` | `valueText`     |
| `min`           | `number`              | `min`           |
| `max`           | `number`              | `max`           |
| `state`         | `ProgressState`       | `state`         |
| `radius`        | `number`              | `radius`        |
| `thickness`     | `number`              | `thickness`     |
| `size`          | `number`              | `size`          |
| `center`        | `number`              | `center`        |
| `circumference` | `number`              | `circumference` |
| `percentage`    | `number \| null`      | `percentage`    |
| `valueTextId`   | `string`              | `valueTextId`   |

Plus two derived-for-markup conveniences that are not on the upstream context because JSX computes them
inline in the range component:

| Member              | Type     | Derivation                                                                                          |
| ------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `strokeDasharray`   | `number` | `circumference`                                                                                      |
| `strokeDashoffset`  | `number` | `state === 'indeterminate' ? circumference * 0.75 : percentage !== null ? circumference - percentage * circumference : circumference` |

## Context

```ts
const CIRCULAR_PROGRESS_CONTEXT_KEY = Symbol('circular-progress');

export function setCircularProgressContext(state: CircularProgressState): CircularProgressState;
export function hasCircularProgressContext(): boolean;
export function getCircularProgressContext(consumerName?: string): CircularProgressState;
```

`getCircularProgressContext` throws
`` `<CircularProgressIndicator>` must be used within `<CircularProgress>`. `` (consumer name
substituted; falls back to `` `<CircularProgress>` part `` when omitted), mirroring upstream's
`useCircularProgressContext(consumerName)` and satisfying FR-016. The four consumer names are
`CircularProgressIndicator`, `CircularProgressTrack`, `CircularProgressRange`,
`CircularProgressValueText` — the same constants upstream defines.

## Derivation pipeline

```text
props { value, min, max, size, thickness, getValueText }
   │
   ├─ resolveProgressBounds(min, max) ──────────────► { min, max }   (max > min guaranteed)
   │                                                      │
   ├─ clampProgressValue(value, min, max) ────────────────┼─► value: number | null
   │                                                      │        │
   ├─ getProgressPercentage(value, min, max) ─────────────┘        ├─► percentage: number | null
   │                                                                │
   ├─ getProgressState(value, max) ─────────────────────────────────┼─► state
   │                                                                │
   ├─ getValueText(value, min, max)  (only when value !== null) ────┴─► valueText: string | undefined
   │
   └─ getRingGeometry(size, thickness) ──────────────► { radius, center, circumference }
                                                              │
                                                              └─► strokeDasharray / strokeDashoffset
```

Every arrow is a `$derived`. No `$effect`, no `$state` that the component writes, no async step.

## Attribute projection

| Consumer     | Attributes fed from the context                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------- |
| Root         | `aria-valuemin=min`, `aria-valuemax=max`, `aria-valuenow=value?`, `aria-valuetext=valueText?`, `aria-describedby=valueText ? valueTextId : undefined`, `data-state`, `data-value?`, `data-min`, `data-max`, `data-percentage?` |
| Indicator    | `width=size`, `height=size`, `viewBox="0 0 size size"`, `data-state`, `data-value?`, `data-min`, `data-max`, `data-percentage?` |
| Track        | `cx=center`, `cy=center`, `r=radius`, `stroke-width=thickness`, `data-state`                        |
| Range        | Track's set, plus `stroke-dasharray`, `stroke-dashoffset`, `data-value?`, `data-min`, `data-max`     |
| ValueText    | `id=valueTextId`, `data-state`, text content `children ?? valueText`                                 |

`?` marks attributes omitted (rendered `undefined`) in the indeterminate state.
