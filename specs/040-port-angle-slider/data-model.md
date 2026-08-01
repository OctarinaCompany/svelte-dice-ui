# Phase 1 Data Model: `angle-slider`

The component holds no persisted data. The "model" is the reactive state owned by
`AngleSliderRootState` in `src/lib/components/ui/angle-slider/angle-slider.svelte.ts`, plus the two
pure value objects the arithmetic operates on. Entity names map to the three Key Entities in
`spec.md`.

---

## Entity 1 — Value set (`values: number[]`)

| Field       | Type       | Source                                   | Reactivity                                                   |
| ----------- | ---------- | ---------------------------------------- | ------------------------------------------------------------- |
| `values`    | `number[]` | root's `value` / `defaultValue` prop      | read through `getValue()`, written through `setValue()` — the state class never owns it |
| `sorted`    | `number[]` | derived                                   | `$derived([...values].sort((a, b) => a - b))`, used by Range and Value |

**Invariants** (enforced in `updateValue`, R-02):

1. Every entry is a multiple of `step` from `min`: `round((v - min) / step) * step + min`.
2. Every entry is rounded to `getDecimalCount(step)` decimal places.
3. Every entry lies in `[min, max]`.
4. The array is sorted ascending after any write.
5. Adjacent entries differ by at least `minStepsBetweenThumbs * step`. A write that would violate
   this is **discarded whole** — no state change and no callback.
6. `values.length` is caller-controlled and never changed by the component.

**Transitions**

| From          | Trigger                                  | To                                                        |
| ------------- | ---------------------------------------- | ---------------------------------------------------------- |
| any           | `pointerdown` on the track                | closest index becomes active, then invariants 1–5 applied  |
| any           | `pointermove` while captured              | active index updated, invariants 1–5 applied               |
| any           | arrow / page key on a focused thumb       | active index `± step · multiplier`, invariants 1–5, commit |
| any           | `Home` / `End`                            | active index → `min` / `max`, commit                       |
| any           | invariant 5 violated                      | **unchanged** — no `onValueChange`, no `onValueCommit`     |

**Callbacks**: `onValueChange` on every accepted write; `onValueCommit` on `pointerup` when the active
index's value differs from the pre-drag snapshot, and on every accepted key press.

---

## Entity 2 — Dial geometry (`AngleSliderGeometry`)

A plain, non-reactive value object passed into the pure functions so they stay unit-testable without
a component:

```ts
type AngleSliderGeometry = {
	min: number;        // default 0
	max: number;        // default 100
	inverted: boolean;  // default false
	startAngle: number; // default -90  (12 o'clock)
	endAngle: number;   // default 270
};
```

Derived on the state class from the root's props:

| Derived                | Formula                                          | Used by                     |
| ---------------------- | ------------------------------------------------ | ---------------------------- |
| `totalAngle`           | `((endAngle - startAngle + 360) % 360) \|\| 360`  | pointer↔value, arcs          |
| `isFullCircle`         | `totalAngle >= 359`                              | Track rail `<circle>` vs `<path>` |
| `centre`               | `size + 20`                                      | Track, Thumb, Value          |
| `trackRadius`          | `size`                                           | Track, Range, Thumb          |
| `boxSize`              | `size * 2 + 40`                                  | root `style`, Track `width`/`height` |
| `angleFor(value)`      | `startAngle + percent · totalAngle`, `percent` inverted when `inverted` | Thumb, Range |
| `positionFor(angle)`   | `{ x: size·cos θ, y: size·sin θ }`               | Thumb                        |

`size` is a **radius**, and `20` is a fixed halo so a thumb straddling the track is not clipped (R-03).

---

## Entity 3 — Active thumb & the thumb registry

| Field                    | Type                          | Reactivity     | Purpose                                                    |
| ------------------------ | ----------------------------- | -------------- | ----------------------------------------------------------- |
| `valueIndexToChange`     | `number`                      | `$state`, init `0` | Which entry pointer/keyboard interaction targets           |
| `thumbs`                 | `SvelteMap<number, ThumbData>`| `$state` map   | Registered thumbs, keyed by `index`                          |
| `valuesBeforeSlideStart` | `number[]`                    | plain `let`    | Pre-drag snapshot for the `onValueCommit` comparison — deliberately non-reactive |

```ts
type ThumbData = { id: string; element: HTMLElement; index: number };
```

**Registration**: each thumb registers in an `$effect` keyed on its element and index, and
**unregisters in the effect's teardown**. The register call is wrapped in `untrack` — writing to a
`SvelteMap` inside an `$effect` that also reads it self-invalidates and makes every sibling thumb
re-register on each pass. `value` is intentionally *not* part of `ThumbData` (upstream stores it and
never reads it), so a value change does not churn the map.

**Transitions of `valueIndexToChange`**

| Trigger                                    | New value                                       |
| ------------------------------------------ | ------------------------------------------------ |
| `focus` on a thumb                          | that thumb's `index`                             |
| `pointerdown` inside a registered thumb     | that thumb's `index`, and the thumb is focused   |
| `pointerdown` elsewhere on the dial          | `getClosestValueIndex(values, pointerValue)`     |
| accepted `updateValue`                       | `nextValues.indexOf(nextValue)` — follows the thumb across a reorder |

---

## Entity 4 — Form projection (per thumb)

| Field          | Derivation                                                        |
| -------------- | ------------------------------------------------------------------ |
| `isFormControl`| `root.form != null \|\| thumbElement?.closest('form') != null`; `true` before the element resolves |
| `name`         | `root.name === undefined ? undefined : root.name + (values.length > 1 ? '[]' : '')` |
| `value`        | `String(values[index])`                                            |
| `disabled`     | `root.disabled` — `readOnly` deliberately does **not** disable it (FR-013) |
| `min`/`max`/`step` | mirrored from the root for native constraint validation        |

One `<input type="number">` per rendered thumb, clipped and `aria-hidden`.

---

## Reactivity map (what is `$state`, `$derived`, and `$effect`)

| Concern                                    | Mechanism                                             |
| ------------------------------------------ | ------------------------------------------------------ |
| `min`/`max`/`step`/`size`/`thickness`/`startAngle`/`endAngle`/`disabled`/`readOnly`/`inverted` | getter functions into the state class — **no mirrored `$state`, no sync effect** (R-04) |
| `values`                                   | the root's `$bindable` prop, reached through `getValue`/`setValue` |
| `valueIndexToChange`, `thumbs`             | `$state` on the state class                            |
| `sorted`, `totalAngle`, `centre`, arc `d` strings, thumb positions, display text | `$derived` / `$derived.by` |
| Direction                                  | `useDirection()` from `direction-provider` (its own `$derived` + `MutationObserver`) |
| Thumb registration                         | `$effect` with an unregister teardown                  |
| Hidden-input DOM write + `input` event     | `$effect` writing to the DOM node only                 |
| Hidden-input size mirroring                | `$effect` + `ResizeObserver`, disconnected in teardown  |
| Pointer geometry                           | **no effect at all** — read from `getBoundingClientRect()` inside the event handler (FR-020, R-07) |

There is exactly one place where a naive port would create the feedback loop FR-020 warns about:
measuring the dial in an `$effect` and writing the value from it. This design never measures in an
effect, so the loop cannot form.
