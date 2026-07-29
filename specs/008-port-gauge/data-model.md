# Phase 1 Data Model — Gauge

**Feature**: `008-port-gauge` | **Source of truth**:
`.reference/diceui/docs/registry/bases/radix/ui/gauge.tsx` @ pinned commit

The gauge holds no mutable domain state: every value below is a pure derivation of the root's props.
The only mutable field in the whole component is a label-registration counter (research.md R-06).

## Entities

### 1. `GaugeState` (value object — union)

`'indeterminate' | 'loading' | 'complete'`, aliased from `ProgressState`
(`circular-progress.svelte.ts`). Derived by `getProgressState(value, max)`:

| Condition           | State           |
| ------------------- | --------------- |
| `value == null`     | `indeterminate` |
| `value === max`     | `complete`      |
| otherwise           | `loading`       |

Transitions are driven exclusively by the `value` / `max` props; the component never changes them.

### 2. `GaugeBounds` (value object)

`{ min: number; max: number }` from `resolveProgressBounds(minProp, maxProp)`:

| Input                                   | Result                       |
| --------------------------------------- | ---------------------------- |
| non-finite `min`                        | `min = 0`                    |
| non-finite or `<= 0` `max`              | `max = 100` (`DEFAULT_MAX`)  |
| resolved `max <= min`                   | `max = min + 1`              |

Invariant: `max > min` always holds downstream, so `percentage` never divides by zero.

### 3. `GaugeReading` (value object)

| Field        | Type              | Derivation                                                          |
| ------------ | ----------------- | ------------------------------------------------------------------- |
| `value`      | `number \| null`  | `clampProgressValue(valueProp, min, max)` — out of range clamps to the bound, non-finite/`null`/`undefined` → `null` |
| `percentage` | `number \| null`  | `getProgressPercentage(value, min, max)` → `null` when indeterminate, else `(value - min) / (max - min)` in `[0, 1]` |
| `state`      | `GaugeState`      | see above                                                            |
| `valueText`  | `string \| undefined` | `value === null ? undefined : getValueText(value, min, max)`     |

Default `getValueText` = `getDefaultGaugeValueText` → `Math.round(percentage).toString()`, i.e. a bare
`"45"` with **no** `%` suffix (upstream `getDefaultValueText`; differs from `circular-progress`).

### 4. `RingGeometry` (value object — reused)

`getRingGeometry(size, thickness)` → `{ radius: max(0, (size - thickness) / 2), center: size / 2,
circumference: 2πradius }`. Imported from `circular-progress.svelte.ts`; only `radius` and `center` are
consumed here.

### 5. `ArcGeometry` (value object — new, added to `circular-progress.svelte.ts`)

| Function                                                    | Returns  | Definition                                                                                     |
| ----------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `getNormalizedAngle(angle)`                                 | `number` | `((angle % 360) + 360) % 360`                                                                   |
| `polarToCartesian(cx, cy, r, angleDeg)`                     | `Point`  | `θ = (angleDeg - 90)·π/180`; `{ x: cx + r·cos θ, y: cy + r·sin θ }` — so 0° is 12 o'clock, clockwise |
| `describeArc(x, y, r, startAngle, endAngle)`                | `string` | `\|Δ\| >= 360` → two chained `A` segments (start → +180° → start); else `M sx sy A r r 0 flag 1 ex ey` with `flag = Δ <= 180 ? '0' : '1'` |
| `getArcLength(r, startAngle, endAngle)`                     | `number` | `(min(\|Δ\|, 360) / 360) · 2πr`                                                                 |
| `getArcCenterY(center, r, startAngle, endAngle)`            | `number` | full circle → `center`; else the midpoint of `[minY, maxY]` where the endpoint `y = center - r·cos(θ_rad)` bounds are widened to `center ∓ r` when the sweep crosses 270° / 90° (upstream verbatim — research.md R-03) |

`Point = { x: number; y: number }`.

### 6. `GaugeRootState` (runes state class, published on context)

One instance per `<Gauge.Root>`. All fields are `$derived`; reactive inputs arrive as getter functions.

| Member            | Kind           | Notes                                                              |
| ----------------- | -------------- | ------------------------------------------------------------------ |
| `min`, `max`      | `$derived`     | from `resolveProgressBounds`                                        |
| `value`           | `$derived`     | clamped, `number \| null`                                           |
| `percentage`      | `$derived`     | `number \| null`                                                    |
| `state`           | `$derived`     | `GaugeState`                                                        |
| `valueText`       | `$derived`     | `string \| undefined`                                               |
| `size`            | `$derived`     | px                                                                  |
| `thickness`       | `$derived`     | px                                                                  |
| `radius`          | `$derived`     | `getRingGeometry(...).radius`                                       |
| `center`          | `$derived`     | `getRingGeometry(...).center`                                       |
| `startAngle`      | `$derived`     | degrees                                                             |
| `endAngle`        | `$derived`     | degrees                                                             |
| `arcPath`         | `$derived`     | `describeArc(center, center, radius, startAngle, endAngle)` — shared by `Track` and `Range` so both draw the identical `d` |
| `arcLength`       | `$derived`     | `getArcLength(radius, startAngle, endAngle)`                        |
| `arcCenterY`      | `$derived`     | px, for `ValueText`'s inline `top`                                  |
| `strokeDasharray` | `$derived`     | `arcLength`                                                         |
| `strokeDashoffset`| `$derived`     | `indeterminate → 0`; else `arcLength - percentage·arcLength`; `percentage === null → arcLength` |
| `labelId`         | `$derived`     | `${uid}-label`                                                      |
| `valueTextId`     | `$derived`     | `${uid}-value-text`                                                 |
| `hasLabel`        | `$derived`     | `#labelCount > 0`                                                   |
| `#labelCount`     | `$state`       | **the only mutable field**; `registerLabel()` / `unregisterLabel()` |

Constructor props (all getters):
`getValue`, `getGetValueText`, `getMin`, `getMax`, `getSize`, `getThickness`, `getStartAngle`,
`getEndAngle`, `getLabelId`, `getValueTextId`.

## Context

| Item                            | Value                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------- |
| Key                             | `const GAUGE_CONTEXT_KEY = Symbol('gauge')` (module-private)                  |
| Publisher                       | `setGaugeContext(state)` — called by the root during initialisation           |
| Probe                           | `hasGaugeContext()`                                                           |
| Consumer                        | `getGaugeContext(consumerName?)` — throws ``` `<GaugeIndicator>` must be used within `<Gauge>`. ``` |
| Consumers                       | `Indicator`, `Track`, `Range`, `ValueText`, `Label`                           |

## Derivation pipeline

```text
props(min, max)      → resolveProgressBounds        → { min, max }
props(value) + bounds→ clampProgressValue           → value: number | null
value + bounds       → getProgressPercentage        → percentage: number | null
value + max          → getProgressState             → state
value + bounds + getValueText                       → valueText: string | undefined
props(size, thickness) → getRingGeometry            → { radius, center }
radius + angles      → describeArc                  → arcPath
radius + angles      → getArcLength                 → arcLength
center + radius + angles → getArcCenterY            → arcCenterY
arcLength + percentage + state                      → strokeDasharray / strokeDashoffset
$props.id()          → labelId, valueTextId
Label mount/unmount  → #labelCount                  → hasLabel
```

No `$effect` participates in the pipeline. The only `$effect` in the component is `Gauge.Label`'s
teardown that calls `unregisterLabel()`.

## Attribute projection

| Part        | Element  | `data-slot`        | State attributes                                                        |
| ----------- | -------- | ------------------ | ------------------------------------------------------------------------ |
| `Root`      | `div`    | `gauge`            | `data-state`, `data-value`\*, `data-max`, `data-min`, `data-percentage`\* |
| `Indicator` | `svg`    | `gauge-indicator`  | `data-state`, `data-value`\*, `data-max`, `data-min`, `data-percentage`\* |
| `Track`     | `path`   | `gauge-track`      | `data-state`                                                             |
| `Range`     | `path`   | `gauge-range`      | `data-state`, `data-value`\*, `data-max`, `data-min`                     |
| `ValueText` | `div`    | `gauge-value-text` | `data-state`                                                             |
| `Label`     | `div`    | `gauge-label`      | `data-state`                                                             |

\* omitted (`undefined`) while `state === 'indeterminate'`.

ARIA on the root: `role="meter"`, `aria-valuemin`, `aria-valuemax` always; `aria-valuenow` and
`aria-valuetext` only when `value !== null`; `aria-describedby` → `valueTextId` only when `valueText`
is defined; `aria-labelledby` → `labelId` only when `hasLabel` (FR-006, research.md R-06).
