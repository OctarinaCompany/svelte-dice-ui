# Phase 0 Research: Color Picker

All unknowns in the Technical Context are resolved below. Upstream references are read at the pinned
commit `d9763d82530416dfa4c81c462387b55d06bae4ec` under `.reference/diceui`.

Primary sources:

- `.reference/diceui/docs/registry/bases/radix/ui/color-picker.tsx` (1678 lines — the whole component)
- `.reference/diceui/docs/content/docs/components/radix/color-picker.mdx` (the API contract)
- `.reference/diceui/docs/registry/bases/radix/examples/color-picker-{,inline-,controlled-,form-}demo.tsx`
- `.reference/diceui/docs/registry/bases/radix/ui/angle-slider.tsx` (read; unused — see R-11)

---

## R-01 — Replacing upstream's `useSyncExternalStore` store

**Decision**: One `ColorPickerRootState` class in `color-picker.svelte.ts`, published on a
`Symbol('color-picker')` context key, holding `#rgb` and `#hsv` as two `$state` fields.

**Rationale**: Upstream builds a hand-rolled pub/sub store (`listenersRef`, `subscribe`, `getState`,
`notify`) purely so that ten deeply-nested parts can each subscribe to one slice without re-rendering
the whole tree (`color-picker.tsx:414-450`). Runes give that for free: a part that reads
`root.hue` re-renders only when the hue moves. Porting the store would add ~80 lines that buy
nothing.

**Alternatives considered**: (a) a `.svelte.ts` module-level singleton — rejected, it would leak
across instances and across SSR requests; (b) plain `setContext` of a POJO of getters — rejected, the
class keeps the mutators and the derived reads in one reviewable place and matches every other port
in this repo (`tags-input`, `time-picker`, `editable`).

---

## R-02 — Why both RGBA **and** HSVA are stored, not one derived from the other

**Decision**: Keep both as authoritative `$state`, written together by `setFromRgb()` /
`setFromHsv()` / `setAlpha()`, exactly as upstream's `setColor`/`setHsv` pair does.

**Rationale**: Both conversions are lossy in one direction. `rgbToHsv` rounds `s` and `v` to whole
percents (`color-picker.tsx:105-140`), so `hsvToRgb(rgbToHsv({r:59,g:130,b:246}))` is **not**
`{r:59,g:130,b:246}`. If RGBA were derived from HSVA, typing `#3b82f6` would immediately redisplay as
a neighbouring hex, breaking SC-004 (round-trip accuracy) and the form demo. Conversely if HSVA were
derived from RGBA, hue would collapse to `0` whenever the user dragged the area to pure black or
pure white (`diff === 0` ⇒ `h = 0`), and the area's crosshair would jump. Upstream avoids both by
storing the pair; so does this port.

**Alternatives considered**: HSVA-only with RGBA derived (rejected — hex round-trip drift); RGBA-only
with HSVA derived (rejected — hue loss at the greyscale axis); storing a third "last user hue"
(rejected — no upstream analogue, extra surface).

**Consequence for the area**: because the area writes HSVA and derives RGBA from it, dragging to
`v = 0` keeps the hue. Typing a greyscale hex still zeroes the hue, exactly like upstream.

---

## R-03 — Controlled `value` parsing

**Decision**: parse an incoming controlled `value` with `parseColorString(value) ?? hexToRgb(value)`,
preserving the current alpha when the parsed notation carries none.

**Rationale**: Upstream parses the controlled prop with `hexToRgb(valueProp, currentAlpha)` only
(`color-picker.tsx:650-658`) while **emitting** `colorToString(value, format)` — i.e. `rgb(59, 130, 246)`
when the format is `rgb`. A consumer who wires `value`/`onValueChange` together (which is exactly
what `color-picker-controlled-demo.tsx` and `color-picker-form-demo.tsx` do) therefore feeds a string
back in that upstream's own parser cannot read, and `hexToRgb` returns black. With `bind:value` this
port would hit that on the first non-hex interaction. `parseColorString` already exists in the same
file and understands all four notations, so using it is a one-word fix to an upstream defect.

**Divergence**: recorded in the spec's Assumptions.

**Alternatives considered**: faithful `hexToRgb` (rejected — the controlled demo cannot work);
forcing `format="hex"` on controlled use (rejected — contradicts FR-003).

---

## R-04 — 2D area accessibility (the deliverable this port is judged on)

**Decision**: `role="slider"` + `tabindex=0` + `aria-valuemin=0` / `aria-valuemax=100` /
`aria-valuenow={saturation}` / `aria-valuetext="Saturation {s}%, brightness {v}%, {formatted}"`, with
this keyboard model:

| Key                              | Effect                                                     |
| -------------------------------- | ---------------------------------------------------------- |
| `ArrowRight` / `ArrowLeft`       | saturation ± `step` (default `1`); **inverted under RTL**  |
| `ArrowUp` / `ArrowDown`          | brightness ± `step`                                        |
| `Shift` + any arrow              | uses `shiftStep` (default `10`) instead                    |
| `Home` / `End`                   | saturation → `0` / `100`                                   |
| `PageUp` / `PageDown`            | brightness ± `shiftStep`                                   |

All values clamp to `[0, 100]`; every handled key calls `preventDefault()`; nothing fires while
`disabled` or `readOnly`.

**Rationale**: Upstream's `ColorPickerArea` (`color-picker.tsx:777-911`) is a bare `<div>` — no role,
no `tabindex`, no `aria-*`, no `keydown` handler. It is unusable by keyboard and announces as
nothing. The WAI-ARIA APG has no dedicated 2D-picker pattern, and its guidance for two-dimensional
widgets is to expose the primary axis through the standard slider properties and describe the whole
state through `aria-valuetext`. Constitution Principle III requires following the APG where upstream
is weaker, so the primary axis is saturation (`aria-valuenow`) and `aria-valuetext` carries
saturation, brightness and the resulting colour together. Shift-for-coarse-step follows the APG's
"large step" recommendation and matches the repo's other ported sliders.

**Alternatives considered**: (a) two nested `role="slider"` elements, one per axis — rejected, it
doubles the tab stops and no shipped colour picker does it, so it would surprise both users and
consumers; (b) `role="application"` — rejected, it suppresses AT reading modes and gives no value
semantics; (c) `role="group"` around two visually-hidden `<input type="range">` — rejected, it
changes the rendered DOM contract (`data-slot`, `child` payload) that consumers style against.

---

## R-05 — Hue and alpha sliders: bits-ui `Slider`, not a hand-rolled track

**Decision**: compose `Slider.Root type="single"` + `Slider.Range` + `Slider.Thumb` from `bits-ui`
(2.18.1, already a dependency), styling `Slider.Root` as the track.

**Rationale**: Principle IV order — no `src/lib/components/ui/slider` exists and
`shadcn-svelte add` is forbidden mid-port, so the next source is the bits-ui primitive, which is
exactly what upstream uses (`SliderPrimitive.Root/Track/Range/Thumb` from `radix-ui`). bits-ui's
slider already implements the APG keyboard set (arrows, `Home`, `End`, `PageUp`, `PageDown`),
`dir="rtl"` inversion, pointer capture, `disabled`, and the `role="slider"`/`aria-valuenow` wiring on
the thumb. bits-ui has **no** `Slider.Track` component — `Slider.Root` *is* the track — so upstream's
`Track` classes move onto `Root` and the gradient backgrounds stay identical.

**Verified**: `node_modules/bits-ui/dist/bits/slider/exports.d.ts` exports `Root`, `Range`, `Thumb`,
`Tick`, `TickLabel`, `ThumbLabel`; `SliderSingleRootProps` accepts `type: 'single'`, `value`
(bindable `number`), `min`, `max`, `step`, `dir`, `disabled`, `orientation`.

**Alternatives considered**: hand-rolling both tracks (rejected — re-implements audited keyboard,
RTL and pointer-capture logic for no gain); running `shadcn-svelte add slider` (forbidden by
CLAUDE.md §1 and Principle IV).

**Added on top**: `aria-label` (`"Hue"` / `"Alpha"`) and `aria-valuetext` (`"217 degrees"` / `"60%"`)
on the thumbs — upstream's thumbs announce as unnamed sliders reading a bare number.

---

## R-06 — Rejecting an invalid keystroke without moving the caret

**Decision**: each `color-picker-input-field.svelte` keeps a local `draft = $state<string>()`; `oninput`
writes the draft and attempts a commit; a commit that fails leaves the colour untouched; `onblur`
(and any external colour change while the field is unfocused) resets the draft to the canonical
value.

**Rationale**: React re-renders a controlled `<input value={…}>` back to its last valid value for
free, which is how upstream's "if (parsedColor) …" branches (`color-picker.tsx:1292-1311`) discard
bad input. Svelte only writes the DOM when the bound expression changes, so rejecting `#3b82f` by
doing nothing would leave the half-typed text in the field indefinitely — and force-writing it back
on every keystroke would make the field impossible to edit (the caret would jump to the end after
each character). A draft buffer reconciled on blur gives upstream's outcome and honours the spec's
edge case "the input keeps showing the last valid value once it loses focus".

**Alternatives considered**: `bind:value` with a `$effect` snap-back (rejected — effect writes to
state it reads, and the caret jumps); debounced commit (rejected — introduces a timer and a
divergent commit moment).

---

## R-07 — `EyeDropper` feature detection under SSR

**Decision**: `let supported = $state(false)` plus `$effect(() => { supported = typeof window !== 'undefined' && !!window.EyeDropper; })`,
and `{#if supported}` around the button. `Window.EyeDropper` is typed with a `declare global` block in
`color-picker.svelte.ts` (a module, so the augmentation is scoped and needs no cast).

**Rationale**: Upstream's `typeof window !== "undefined" && !!window.EyeDropper` runs on every render
and returns `false` during SSR. Evaluating the same expression during Svelte component
initialisation would return `false` on the server and `true` during hydration on Chromium, producing
a hydration mismatch. Seeding `false` and promoting in an effect makes the first client render match
the server and the button appear immediately afterwards. It also makes the part trivially testable:
a test stubs `window.EyeDropper` before render and asserts the button appears, or deletes it and
asserts nothing renders.

**Alternatives considered**: `browser` from `$app/environment` (rejected — Principle V forbids a
registry component depending on SvelteKit-app modules); rendering a disabled button (rejected —
FR-010 and the upstream MDX both say render nothing).

---

## R-08 — Popover vs. `inline`

**Decision**: the root renders `<Popover.Root bind:open>` around its children when `inline` is false
and renders the children bare when `inline` is true; `Content` mirrors the same branch, rendering
`Popover.Content` or a plain `<div>` with the same classes and `data-slot`.

**Rationale**: This is upstream's exact shape (`ColorPickerImpl` returns an early inline branch,
`ColorPickerContent` an early inline branch). Composing `$lib/components/ui/popover` brings the
portal, dismissible layer, focus scope, escape handling and stacking that Principle VIII forbids
re-implementing, and `time-picker.svelte` already establishes the `bind:open={() => root.open, (next) => root.setOpen(next)}`
function-binding shape used here.

**Note**: `Trigger` is still rendered inside the `inline` branch if a consumer includes one; it will
simply have no popover to open. Upstream behaves the same way (`PopoverTrigger` outside a `Popover`
throws in Radix; bits-ui's throws too), so `Trigger` documents that it belongs to the non-inline path.

---

## R-09 — Native form submission

**Decision**: reuse `FormControlState` from `$lib/components/ui/checkbox-group/index.js` to detect a
`<form>` ancestor, and render `<input type="hidden" data-slot="color-picker-form-input" {name} value={hexValue} …>`
when inside one. The element is captured through both `ref` and an attachment key so `child` mode
keeps working (the `time-picker` pattern).

**Rationale**: Upstream ships a `VisuallyHiddenInput` helper with `type="hidden"`; this repo already
has the ported equivalent inline in `time-picker`, `editable`, `tags-input` and `checkbox-group`, and
Principle IV says reuse before re-implementation. `type="hidden"` (rather than `editable`'s clipped
text input) is correct here because the colour value is never empty — `defaultValue` is `#000000` —
so the constraint-validation gap that forced the clipped input elsewhere cannot arise. `required` is
therefore mirrored for parity but can never block a submit; that is upstream's behaviour too and is
documented rather than "fixed".

**Value emitted**: `rgbToHex(color)`, matching upstream's `useStore((state) => rgbToHex(state.color))`
— the hidden field always submits hex regardless of the display format.

---

## R-10 — RTL

**Decision**: resolve direction with `useDirection({ dir: () => dir, element: () => ref ?? mountedElement })`
from `direction-provider`; pass the resolved value to both bits-ui sliders as `dir`; invert the
area's horizontal arrow keys **and** its pointer-x mapping (`x = 1 - x`) when it is `'rtl'`.

**Rationale**: Upstream calls Radix's `DirectionPrimitive.useDirection(dirProp)` and forwards nothing
to the area at all — its pointer maths and (non-existent) keyboard are LTR-only. FR-016 and
Principle III require inversion, and `useDirection` is the established repo primitive for the
provider → DOM `[dir]` → `'ltr'` fallback chain. Inverting the pointer mapping as well as the keys
keeps the crosshair under the finger in an RTL layout, where the gradient itself is mirrored.

**Divergence**: recorded in the spec's Assumptions.

---

## R-11 — `angle-slider.tsx`

**Decision**: not ported, not referenced.

**Rationale**: `.reference/diceui/docs/registry/bases/radix/ui/angle-slider.tsx` is a standalone
circular-angle input. Nothing in `color-picker.tsx` imports it — the hue control is the linear
`SliderPrimitive`. It is a separate registry item with its own upstream docs page and belongs to its
own feature directory. Reading it confirmed there is no shared helper to extract.

---

## R-12 — Trigger element type

**Decision**: `Trigger` renders `Popover.Trigger`, i.e. a real `<button type="button">`, styled with
`buttonVariants`, with the swatch (or any content) as its children. The `child` snippet remains for
full control.

**Rationale**: Upstream's demos use `<ColorPickerTrigger asChild><ColorPickerSwatch /></ColorPickerTrigger>`,
which makes Radix's `Slot` merge the trigger props onto the swatch's `<div role="img">`. The result is
a non-focusable, non-activatable trigger with `role="img"` — a keyboard user cannot open the picker
at all, which contradicts the upstream MDX's own keyboard table (`Enter`/`Space` open the picker) and
FR-018/SC-002. Rendering a button and nesting the swatch inside it produces the same visual result
with correct semantics.

**Divergence**: recorded in the spec's Assumptions.

---

## R-13 — Where the numeric colour maths lives

**Decision**: `src/lib/components/ui/color-picker/color.ts`, pure and rune-free, with its own
`color.test.ts`.

**Rationale**: `color-swatch/color.ts` exports only background helpers, so there is nothing to import
for `hexToRgb`/`rgbToHsv`/`hsvToRgb`/`rgbToHsl`/`hslToRgb`/`colorToString`/`parseColorString`. Keeping
them out of `color-picker.svelte.ts` follows the `color-swatch` precedent exactly (pure module +
dedicated spec), keeps the state module free of 200 lines of arithmetic, and lets later components
import the conversions without dragging in a rune-bearing module. The swatch's checkerboard
rendering is **not** duplicated — that part composes `ColorSwatch.Root`.

---

## R-14 — Format switching must not change the colour

**Decision**: `format` drives only `colorToString()`, the channel model returned by
`getInputFields()`, and the `aria-valuetext`/swatch label strings. No mutator reads it.

**Rationale**: FR-003 and SC-004. Upstream already has this property (its `setFormat` touches nothing
but `format`), and this port preserves it by construction: `#rgb`/`#hsv` are the only state, and
`setFormat` writes neither. The one place format leaks into behaviour is `onValueChange`, which emits
in the *previous* format at the moment of the change — upstream reads `prevState.format` explicitly
(`color-picker.tsx:541-546`); this port reads the current format at emit time, which is the same
value because a format change never emits `onValueChange`.
