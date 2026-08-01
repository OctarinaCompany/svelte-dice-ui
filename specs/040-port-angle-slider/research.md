# Phase 0 Research: Port Angle Slider

**Feature**: `040-port-angle-slider` | **Date**: 2026-08-01

**Upstream, read at the pinned commit `d9763d8`:**

| Artifact          | Path                                                                    |
| ----------------- | ----------------------------------------------------------------------- |
| Component source  | `.reference/diceui/docs/registry/bases/radix/ui/angle-slider.tsx`       |
| Hidden input      | `.reference/diceui/docs/registry/bases/radix/components/visually-hidden-input.tsx` |
| API contract      | `.reference/diceui/docs/content/docs/components/radix/angle-slider.mdx` |
| Demos (5)         | `.reference/diceui/docs/registry/bases/radix/examples/angle-slider-{,controlled-,range-,themes-,form-}demo.tsx` |
| Upstream tests    | none — no `angle-slider` test file exists upstream. Our test file has no floor to port; it is written from the MDX contract and the six areas of `CLAUDE.md` §7. |

There were no `[NEEDS CLARIFICATION]` markers in `spec.md`. The research below resolves the
implementation unknowns and records every deliberate divergence from the upstream source.

---

## R-01 — Pointer → value arithmetic (ported verbatim)

**Decision**: Port `getValueFromPointer` character-for-character into a pure exported function:

```ts
const centerX = rect.left + rect.width / 2;
const centerY = rect.top + rect.height / 2;
let angle = (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI;
if (angle < 0) angle += 360;
angle = (angle - startAngle + 360) % 360;
const totalAngle = ((endAngle - startAngle + 360) % 360) || 360;
let percent = angle / totalAngle;
if (inverted) percent = 1 - percent;
return min + percent * (max - min);
```

**Rationale**: `atan2` is measured from the +x axis with +y pointing *down* in screen coordinates, so
raw `0°` is 3 o'clock and raw `90°` is 6 o'clock. The `- startAngle` rotation is what makes the
default `startAngle = -90` put value `min` at 12 o'clock and sweep clockwise. Getting the sign or the
rotation order wrong is invisible in a unit test written against the same wrong formula and glaring in
a browser, which is why the arithmetic is lifted rather than re-derived.

**Quadrant table under the defaults (`startAngle = -90`, `endAngle = 270`, `min = 0`, `max = 360`)** —
this is the table the tests assert against:

| Pointer, relative to centre | raw `atan2` | after rotation | percent | value  |
| --------------------------- | ----------- | -------------- | ------- | ------ |
| Directly above (12 o'clock) | `270°`      | `0°`           | `0`     | `0`    |
| Directly right (3 o'clock)  | `0°`        | `90°`          | `0.25`  | `90`   |
| Directly below (6 o'clock)  | `90°`       | `180°`         | `0.5`   | `180`  |
| Directly left (9 o'clock)   | `180°`      | `270°`         | `0.75`  | `270`  |
| Up-and-right (1:30)         | `315°`      | `45°`          | `0.125` | `45`   |

**Alternatives rejected**: re-deriving with `atan2(deltaX, -deltaY)` to get a "12 o'clock = 0" formula
directly. It produces identical output only for `startAngle = -90` and diverges for every other
`startAngle`, so it is not a refactor, it is a different component.

**Consequence for `spec.md`**: acceptance scenarios US1-1 and US1-2 asserted `0°` for "directly right"
and `90°` for "directly below". Under the upstream formula with the defaults those are `90°` and
`180°`. The spec's scenarios were corrected in this phase and an Assumption recording the correction
was added — writing the test against the spec's original numbers would have encoded a 90° phase error.

---

## R-02 — Value snapping, clamping and multi-thumb ordering (ported verbatim)

**Decision**: Port `updateValue` and its four helpers as pure functions:

```ts
const decimalCount = (String(step).split('.')[1] ?? '').length;
const snapped = round((Math.round((value - min) / step) * step + min), decimalCount);
const next = Math.min(max, Math.max(min, snapped));
const nextValues = [...values]; nextValues[atIndex] = next; nextValues.sort((a, b) => a - b);
if (hasMinStepsBetweenValues(nextValues, minStepsBetweenThumbs * step)) { … }
```

**Rationale**: the decimal-count rounding is what keeps `step = 0.5` from emitting
`44.999999999999993` (spec Edge Cases). The *sort after write* is what lets a dragged thumb hand its
identity over to the neighbouring index when it passes it, and `valueIndexToChange` is re-derived as
`nextValues.indexOf(next)` so the drag keeps following the same physical thumb. The separation guard
is measured in **value units** (`minStepsBetweenThumbs * step`), not in steps — with `step = 5` and
`minStepsBetweenThumbs = 2` the thumbs stop 10 apart, which is exactly spec scenario US2-2.

**Rejection semantics**: when the guard fails, upstream drops the update entirely — no state write, no
callback. Ported as-is: this is what makes a drag "stop" at the separation boundary instead of
snapping past it.

---

## R-03 — Angle → position arithmetic and the dial's coordinate frame

**Decision**: Port `getAngleFromValue` and `getPositionFromAngle` verbatim, including the constant
`20`px halo that upstream adds around the dial:

- `centre = size + 20` (in local SVG/CSS pixels), track radius `= size`
- root box `= (size * 2 + 40) × (size * 2 + 40)` px
- thumb offset `= { x: size·cos(θ), y: size·sin(θ) }`, placed at `left: centre + x`, `top: centre + y`
  with `translate(-50%, -50%)`

**Rationale**: `size` is a *radius*, not a width — a naming trap worth stating once. The `20`px margin
is what stops the thumb (which straddles the track) from being clipped by the root's bounds. Keeping
the exact constant keeps every upstream `size={60}` / `size={80}` demo pixel-identical.

**Note on not reusing `circular-progress`**: `circular-progress.svelte.ts` already exports
`polarToCartesian` / `describeArc`, but its geometry is `radius = (size - thickness) / 2` with
`centre = size / 2` and a 0° = 12 o'clock convention. Reusing it would silently change the dial's
dimensions and its zero direction, and would add a registry dependency on a display-only component.
The arc helpers are therefore re-derived in `angle-slider.svelte.ts` against upstream's own frame.

---

## R-04 — The React store (`useSyncExternalStore`) → one runes state class

**Decision**: Replace the hand-rolled `subscribe/getState/setState/notify` store plus
`React.useSyncExternalStore` with a single `AngleSliderRootState` class in `angle-slider.svelte.ts`,
published on context under a `Symbol` key, with reactive inputs passed in as getter functions.

**Rationale**: the store exists purely because React has no fine-grained reactivity — every field it
holds (`min`, `max`, `step`, `size`, `thickness`, `startAngle`, `endAngle`, `disabled`, `inverted`) is
just a prop of the root mirrored into a mutable ref and re-synced by a layout effect. In Svelte those
are read straight through getters and the two `useIsomorphicLayoutEffect` prop-sync blocks
(`angle-slider.tsx:343-394`) disappear entirely, taking the whole class of "state drifted from props"
bugs with them. Only genuinely local state stays as `$state`: `values` (when uncontrolled),
`valueIndexToChange`, the thumb registry, and the pre-drag snapshot.

**Alternatives rejected**: a store-shaped port with a `Set` of listeners. It would work and would be a
transliteration — explicitly forbidden by the task constraints and by Principle I.

---

## R-05 — Direction resolution and RTL arrow inversion

**Decision**: resolve direction with the repo's existing
`useDirection({ dir: () => dirProp, element: () => ref })` from
`$lib/components/ui/direction-provider/index.js`, which already implements
`explicit prop ?? nearest provider ?? nearest DOM [dir] ?? 'ltr'` with a `MutationObserver`.
`ArrowLeft` / `ArrowRight` are then swapped when the resolved direction is `rtl`; `ArrowUp` /
`ArrowDown` / `PageUp` / `PageDown` / `Home` / `End` are unaffected.

**Rationale**: this is Principle IV in its literal form — an existing component under
`src/lib/components/ui/*` covers the behaviour, so nothing is written. bits-ui's own direction context
is already what `direction-provider` wraps, and eleven ported components use this reader.

**Divergence D-01 (RTL inversion is additive)**: upstream reads `dir` only to stamp it on the root
element — its `onKeyDown` never consults direction, so `ArrowRight` increases in RTL exactly as in
LTR. Spec FR-011 and Constitution III both require horizontal navigation to invert under `dir="rtl"`,
and the WAI-ARIA slider pattern agrees. The inversion is therefore implemented and recorded as an
additive divergence. It cannot break an upstream consumer who never used RTL.

---

## R-06 — Keyboard direction: the MDX and the source contradict each other

**Decision**: follow the MDX table (and spec FR-010, and WAI-ARIA):

| Key                     | Δ                       |
| ----------------------- | ----------------------- |
| `ArrowUp`, `ArrowRight` | `+1 step`               |
| `ArrowDown`, `ArrowLeft`| `-1 step`               |
| `PageUp`                | `+10 steps`             |
| `PageDown`              | `-10 steps`             |
| `Shift` + any arrow     | `±10 steps`, same sign as the bare arrow |
| `Home`                  | active thumb → `min`    |
| `End`                   | active thumb → `max`    |

Then `inverted` multiplies the sign by `-1`; then RTL swaps `ArrowLeft` / `ArrowRight` (R-05).

**Rationale**: `angle-slider.tsx:473-476` computes
`isDecreaseKey = ["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)`, i.e. in the source
`ArrowUp` and `PageUp` *decrease*. The MDX keyboard table says both increase. Three of the four
authorities agree against the source: Constitution II names the MDX as *the* contract, spec FR-010
enumerates the MDX behaviour and demands it "exactly", and the WAI-ARIA Authoring Practices slider
pattern specifies Up/Right increase and PageUp increase. A slider whose Up arrow decreases is also a
screen-reader defect under Principle III, which admits no exception.

**Divergence D-02** recorded in `spec.md` Assumptions.

**Divergence D-03 (`Home` / `End` act on the active thumb)**: upstream hardcodes
`updateValue(min, 0)` for `Home` and `updateValue(max, values.length - 1)` for `End` — index `0` and
the last index, regardless of which thumb is focused. Spec FR-010 says "the active thumb", which is
also the WAI-ARIA behaviour (the key acts on the focused slider). For the single-thumb case that every
upstream demo uses, the two are identical; they differ only for a focused thumb `1` in a range. The
spec wins.

---

## R-07 — Pointer capture, drag lifecycle, and `onValueCommit`

**Decision**: port the three handlers onto the **root** element, guarded by
`disabled || readOnly`, and calling the caller's own handler first with a `defaultPrevented` bail-out:

1. `pointerdown` → `target.setPointerCapture(e.pointerId)`, `preventDefault()`, snapshot
   `valuesBeforeSlideStart`. If the target is inside a registered thumb, focus that thumb and make it
   active; otherwise compute the pointer value, pick the closest value index, and update.
2. `pointermove` → only when `target.hasPointerCapture(e.pointerId)`; update the active index.
3. `pointerup` → only when `target.hasPointerCapture(e.pointerId)`; release capture, then fire
   `onValueCommit(values)` **iff** the active index's value differs from the snapshot.

**Rationale**: capture on the *target* (not the root) is what keeps the drag alive when the pointer
leaves the dial's box (spec Edge Cases), and it is why `pointermove` is a cheap `hasPointerCapture`
test rather than a global listener with a teardown. `onValueCommit` fires once per drag from the
snapshot comparison; keyboard paths pass `{ commit: true }` so a key press commits immediately
(FR-014).

**No `$effect` is involved in any of this** — all three are DOM event handlers. FR-020's feedback-loop
hazard ("never write the value back into the element you read the pointer from inside the same
effect") is therefore structurally impossible here: the bounding box is read inside an event handler
from the live DOM, and nothing subscribes to it. This is stated in the plan as the deliberate design,
not as an accident.

---

## R-08 — Degenerate pointer geometry

**Decision**: return the active thumb's current value unchanged when
`rect.width === 0 || rect.height === 0` or when the pointer is exactly at the centre
(`deltaX === 0 && deltaY === 0`).

**Rationale**: `Math.atan2(0, 0)` is `0` in JavaScript, not `NaN`, so upstream silently snaps the value
to whatever `startAngle` maps to when you click the exact centre — a visible jump. The spec's Edge
Cases require "the last valid angle is retained", so the guard is added. The zero-size guard matters
twice: jsdom's `getBoundingClientRect()` returns all zeros unless stubbed (so every pointer test must
stub it — see `quickstart.md`), and a dial inside a `display: none` ancestor would otherwise emit a
bogus value on the first pointer event.

**Divergence D-04**, recorded in `spec.md` Assumptions.

---

## R-09 — `VisuallyHiddenInput` → `angle-slider-hidden-input.svelte`

**Decision**: port it as a part file inside this component's folder, exported from the barrel as
`HiddenInput` / `AngleSliderHiddenInput` with its props type. Three React mechanisms map as follows:

| Upstream                                                        | Here                                                                 |
| --------------------------------------------------------------- | -------------------------------------------------------------------- |
| `useLayoutEffect` + `ResizeObserver` mirroring the control's box | `$effect` observing `control`, writing two `$state` numbers, `return () => observer.disconnect()` |
| `prevValueRef` + native `HTMLInputElement` value setter + manual `dispatchEvent(new Event('input', { bubbles }))` | an `$effect` that writes the DOM value through the same native setter and dispatches the same event — it reads the `value` prop and writes only to the DOM node, never to reactive state |
| `type = "hidden"` default, `aria-hidden={isCheckInput}`          | same default; the thumb passes `type="number"`, and `aria-hidden="true"` + `tabindex="-1"` are set unconditionally |

**Rationale for keeping the native-setter dance**: assigning `input.value` in Svelte updates the DOM
but fires no event; form libraries that listen for `input` on their own subtree would never see the
change. Going through
`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` and dispatching is the
portable way to make a programmatic write look like a user write. It writes to a DOM node and reads a
prop, so it cannot self-invalidate.

**Divergence D-05 (`aria-hidden` on the hidden input)**: upstream leaves `aria-hidden` false for
non-checkbox inputs, which puts an unlabelled `<input type="number">` into the accessibility tree next
to every thumb. `tags-input.svelte` in this repo already sets `aria-hidden="true"` + `tabindex="-1"`
on its form mirror; this port follows the established repo precedent.

**Promotion path**: if a second component needs it, the file moves to
`src/lib/components/ui/visually-hidden-input/` and becomes a `registryDependencies` entry. Until then,
duplicating it into one folder is cheaper than a registry item that exists for one consumer — and the
task guidance explicitly asks for it to live inside this component.

---

## R-10 — `asChild` / `Slot` → the `child` snippet

**Decision**: `AngleSlider`, `AngleSliderThumb` and `AngleSliderValue` (the three parts upstream makes
polymorphic) each take a `child?: Snippet<[{ props: … }]>`. When `child` is supplied, the part renders
nothing itself and hands the caller the fully merged attribute payload — role, every `aria-*`, every
`data-*`, the computed `class` and `style` — to spread onto their own element.

**Rationale**: the pattern is already established in this repo by `circular-progress.svelte` and
`gauge.svelte`, whose `child` payload types (`CircularProgressChildProps`) are exported for callers.
It is Principle II's "React-only escape hatch replaced by a snippet".

**Trade-off, stated**: in `child` mode `ref` stays `null` and the part cannot register itself with the
root. For `AngleSliderThumb` that would break pointer hit-testing and focus management, so the thumb's
`child` payload includes the element registration hook via `bind:this` on the caller's side being
unavailable — resolved by having the thumb's *wrapper* `<span>` (which the thumb always owns) carry
the registration, and the `child` payload carry only the interactive attributes. Documented in
`contracts/angle-slider.api.md`.

---

## R-11 — Controlled vs uncontrolled

**Decision**: follow the repo convention exactly (`checkbox-group.svelte:92-125`,
`tags-input.svelte:128-171`):

```ts
let { value = $bindable(), defaultValue = [0], onValueChange } = $props();
value ??= untrack(() => defaultValue);           // one-shot seed, never a reactive read
function setValue(next: number[]) { value = next; onValueChange?.(next); }
```

Three caller modes, all documented on the `value` JSDoc:

| Caller writes                                    | Who is authoritative |
| ------------------------------------------------ | -------------------- |
| `defaultValue={[45]}`                            | the component        |
| `bind:value={angle}`                             | shared — the component moves the caller's state |
| `bind:value={() => angle, (next) => …}`          | the caller — a setter that declines the write leaves the dial where it was |

**Rationale**: spec's edge case "`value` supplied without `onValueChange` must not move on its own" is
React's controlled-component contract; Svelte's equivalent is the **function binding**, which is what
the controlled test asserts against. Reading `defaultValue` bare instead of through `untrack` would
capture it reactively and re-seed on every parent invalidation.

---

## R-12 — `readOnly`

**Decision**: `readOnly` suppresses `pointerdown`/`pointermove`/`keydown` value changes, keeps
`tabindex={0}` on the thumb, sets `aria-readonly="true"` on each thumb and `data-readonly` on every
part, and leaves the hidden input enabled so the value still submits. `disabled` additionally removes
`tabindex`, sets `aria-disabled="true"`, and disables the hidden input.

**Rationale**: FR-013 and the WAI-ARIA distinction between `aria-disabled` and `aria-readonly`.
Already recorded in `spec.md` Assumptions as an additive divergence (upstream has no `readOnly`).
`aria-disabled` is likewise additive — upstream relies on the missing `tabindex` alone, which leaves a
screen-reader user with a `role="slider"` that announces no state at all.

---

## R-13 — Demos: replacing two React-only dependencies

| Upstream demo             | Upstream dependency          | Here                                                                          |
| ------------------------- | ---------------------------- | ------------------------------------------------------------------------------- |
| `angle-slider-controlled` | `motion/react` `animate()`   | a `requestAnimationFrame` loop in the demo page with upstream's own cubic-bezier `[0.25, 0.46, 0.45, 0.94]` and 400 ms duration, including the shortest-path `±180°` wrap. Cancelled on unmount by the `$effect` teardown. |
| `angle-slider-form`       | `react-hook-form` + `zod`    | a native `<form>` + `Field.FieldGroup`/`Field.Field` from `$lib/components/ui/field`, submitted with `svelte-sonner`'s `toast.success`. FR-016's hidden inputs already carry the values, so no synchronisation code is needed — which is the point the demo exists to prove. |
| `angle-slider-themes`     | raw palette colours          | the repo's semantic tokens: `stroke-primary`, `stroke-success`, `stroke-warning`, `stroke-destructive`, `stroke-info`, plus `stroke-muted-foreground/20`. Principle VIII forbids `stroke-green-500` and the `dark:` overrides upstream pairs with them. Eight upstream swatches map onto five tokens plus three token opacities. |

**Zero new npm dependencies.** `svelte-sonner`, `@lucide/svelte`, `tailwind-variants` and `bits-ui`
are already project dependencies; nothing else is added.

---

## Divergence register (all recorded in `spec.md` Assumptions)

| ID   | Divergence                                                        | Direction  |
| ---- | ------------------------------------------------------------------ | ---------- |
| D-01 | RTL inverts `ArrowLeft`/`ArrowRight`                               | additive   |
| D-02 | `ArrowUp`/`PageUp` **increase** (MDX + WAI-ARIA), not decrease     | corrective |
| D-03 | `Home`/`End` act on the active thumb, not on index `0` / last      | corrective |
| D-04 | Centre-of-dial and zero-size pointer events retain the value       | additive   |
| D-05 | Hidden input is `aria-hidden="true"`                               | additive   |
| D-06 | `readOnly` prop + `aria-readonly` + `data-readonly`                | additive (already in spec) |
| D-07 | `aria-disabled="true"` on a disabled thumb                         | additive   |
| D-08 | `asChild` → `child` snippet; store → state class; ref hooks dropped | mechanical (already in spec) |
| D-09 | Spec acceptance scenarios US1-1/US1-2 corrected to the upstream formula's quadrants | corrective |
