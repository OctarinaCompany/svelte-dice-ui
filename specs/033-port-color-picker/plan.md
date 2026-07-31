# Implementation Plan: Color Picker

**Branch**: `033-port-color-picker` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/033-port-color-picker/spec.md`

## Summary

Port Dice UI's React `color-picker` (a ten-part compound colour picker: root, trigger, popover
content, 2D saturation/brightness area, hue slider, alpha slider, swatch, eyedropper, format select
and per-channel text input) to Svelte 5 runes, shipped as one shadcn-svelte registry item.

Technical approach: a single `ColorPickerRootState` class in `color-picker.svelte.ts` replaces
upstream's hand-rolled `useSyncExternalStore` pub/sub store and is published on a `Symbol`-keyed
context; the pure numeric colour maths upstream inlines moves to a colocated, side-effect-free
`color.ts` (the module this feature exports for reuse); popover behaviour composes
`$lib/components/ui/popover`, the two 1D sliders compose the `bits-ui` `Slider` primitive, the
format select composes `$lib/components/ui/select`, the swatch composes `$lib/components/ui/color-swatch`,
direction resolution composes `useDirection` from `direction-provider`, and form detection composes
`FormControlState` from `checkbox-group`. Only three behaviours are genuinely bespoke: the 2D area's
pointer geometry, its keyboard model (which upstream does not have at all), and the per-field draft
buffer that lets an invalid keystroke be rejected without the caret jumping.

## Technical Context

**Language/Version**: TypeScript 6 (strict), Svelte 5.56 with runes forced on repo-wide

**Primary Dependencies**: `bits-ui@2.18.1` (Popover, Select, **Slider**), `@lucide/svelte@1.27`
(`PipetteIcon`), `tailwind-variants@3.3` (`tv()`), `tailwind-merge`/`clsx` via `cn()`. **No new npm
dependency.** Upstream's `radix-ui`, `class-variance-authority`, `@hookform/resolvers`,
`react-hook-form` and `zod` all map onto packages already installed here.

**Storage**: N/A — component state only.

**Testing**: Vitest 4 (jsdom, `globals: false`, `expect.requireAssertions`) +
`@testing-library/svelte@5` + `@testing-library/user-event@14`, colocated at
`src/lib/components/ui/color-picker/color-picker.test.ts` with a `.test.svelte` harness for
`bind:`, snippets and provider-wrapped variants. Pure maths gets its own `color.test.ts`, matching
the `color-swatch` precedent.

**Target Platform**: Browsers (SvelteKit SSR + hydration). The `EyeDropper` part is Chromium-only by
platform limitation; it renders nothing elsewhere.

**Project Type**: shadcn-svelte registry component inside a SvelteKit docs site.

**Performance Goals**: Pointer drag on the area and both sliders must stay smooth (one state write
per `pointermove`, no layout thrash — geometry is read from a single `getBoundingClientRect()` per
move). No measurable regression to `pnpm run build`.

**Constraints**: No `any`, no suppression comments, no `shadcn-svelte add`, no manual `z-index`,
semantic tokens only, `.js` extensions on intra-repo imports, no import from `src/routes/**` or
`$lib/components/docs/**`.

**Scale/Scope**: 12 `.svelte` part files + 2 `.ts` modules + 1 barrel; 1 demo route with 4 preview
sections and 10 props tables; 1 registry entry; ~60 unit tests across two spec files.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                     |
| ---- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$effect`/`$props`/`$bindable` + snippets only; all non-markup logic in `color-picker.svelte.ts` (`ColorPickerRootState`) with getter-function inputs. No stores, `export let` or dispatchers. |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | `color-picker.tsx`, `color-picker.mdx` and all four `color-picker-*-demo.tsx` read at the pinned commit; every prop, callback, `data-slot` and format reproduced. Six divergences recorded in spec Assumptions.  |
| III  | Accessibility Is a MUST             | PASS    | APG Slider pattern on the area (`role="slider"` + `aria-valuetext` + arrows/Shift/Home/End/PageUp/Down) which upstream lacks entirely; bits-ui Slider supplies APG keyboard for hue/alpha; RTL inverts both.     |
| IV   | Composition Over Reimplementation   | PASS    | Popover, Select, Input, Button, ColorSwatch, `useDirection`, `FormControlState` and bits-ui `Slider` composed; three bespoke behaviours justified below.                                                        |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder `src/lib/components/ui/color-picker/`, one part per file, `index.ts` barrel with short names + prefixed aliases + types, one `registry:ui` entry, `.js` import extensions, zero docs-app imports.    |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Props types exported from `<script lang="ts" module>`, derived from `WithElementRef<HTMLAttributes<…>>`; `Window.EyeDropper` typed via `declare global` in `color-picker.svelte.ts` instead of a cast.          |
| VII  | Green Gate Before Commit            | PASS    | Phase 5 of the task plan runs `format` → `check` → `lint` → `test:unit --run` → `build`; no `.skip`/`.todo`, every `it` asserts.                                                                                |
| VIII | Styling Discipline                  | PASS    | `cn()` everywhere, `tv()` for the input-field position variants, `data-slot` on all ten parts, boolean state as `cond ? '' : undefined`, semantic tokens, no `z-index` (Popover owns stacking).                 |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/color-picker/+page.svelte` with one `<ComponentPreview>` per upstream demo file (default, inline, controlled, form) plus per-part props tables.                                     |
| X    | One Feature Directory Per Component | PASS    | All artifacts under `specs/033-port-color-picker/`; no git write commands run by any phase.                                                                                                                    |

**Bespoke behaviour justification (Principle IV)**:

1. **The 2D area's pointer geometry and keyboard model.** Evaluated `bits-ui` `Slider` (1D only — it
   models a single value on a single axis and offers no way to drive two channels from one pointer
   position) and `$lib/components/ui/*` (nothing 2D exists). No primitive in either layer exposes a
   two-axis value, so the area's `getBoundingClientRect()` → `{s, v}` mapping, its pointer capture,
   and its arrow-key model are written by hand. ~90 lines, all in `ColorPickerAreaState`.
2. **The per-field input draft buffer.** Evaluated `$lib/components/ui/input` and
   `$lib/components/ui/input-group`: both are presentational and neither owns a
   "reject-invalid-keystroke-but-keep-the-caret" model. React re-renders a controlled input back to
   its last valid value for free; Svelte will not re-write a DOM value the state never changed, so a
   small per-field `draft` + `onblur` resynchronise is required to honour the spec's "keeps showing
   the last valid value once it loses focus" edge case (research R-06).
3. **The colour maths (`color.ts`).** Evaluated `color-swatch`'s `color.ts`: it exports only
   background/checkerboard helpers (`normalizeColorValue`, `isCssColor`, `hasAlpha`,
   `getColorBackgroundStyle`) and no numeric conversion. `getColorBackgroundStyle` **is** composed
   (through `ColorSwatch.Root`); the hex/RGB/HSL/HSV conversions upstream inlines are ported
   verbatim into this component's own `color.ts` because no existing module owns them.

## Project Structure

### Documentation (this feature)

```text
specs/033-port-color-picker/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── color-picker-api.md
├── checklists/
│   └── requirements.md
├── spec.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/color-picker/
├── index.ts                              # barrel: short names + ColorPicker* aliases + all prop types + color.ts re-exports
├── color.ts                              # PURE colour maths — the shared module this feature exports (§ "Shared module")
├── color-picker.svelte.ts                # ColorPickerRootState + ColorPickerAreaState + Symbol context + EyeDropper global type
├── color-picker.svelte                   # Root                    ← ColorPicker + ColorPickerImpl
├── color-picker-trigger.svelte           # Trigger                 ← ColorPickerTrigger
├── color-picker-content.svelte           # Content                 ← ColorPickerContent
├── color-picker-area.svelte              # Area                    ← ColorPickerArea
├── color-picker-hue-slider.svelte        # HueSlider               ← ColorPickerHueSlider
├── color-picker-alpha-slider.svelte      # AlphaSlider             ← ColorPickerAlphaSlider
├── color-picker-swatch.svelte            # Swatch                  ← ColorPickerSwatch
├── color-picker-eye-dropper.svelte       # EyeDropper              ← ColorPickerEyeDropper
├── color-picker-format-select.svelte     # FormatSelect            ← ColorPickerFormatSelect
├── color-picker-input.svelte             # Input                   ← ColorPickerInput + Hex/Rgb/Hsl/HsbInput
├── color-picker-input-field.svelte       # InputField (one channel) ← InputGroupItem
├── color-picker.test.ts                  # component tests         (NOT in registry.json)
├── color-picker.test.svelte              # harness for bind:/snippets/RTL (NOT in registry.json)
└── color.test.ts                         # pure-maths tests        (NOT in registry.json)

src/routes/docs/components/color-picker/
└── +page.svelte                          # 4 <ComponentPreview> sections + 10 props tables

registry.json                             # append exactly one registry:ui entry named "color-picker"
```

**Structure Decision**

- Upstream's `ColorPicker` + `ColorPickerImpl` split exists only to let the store provider sit above
  the consumer that reads it; Svelte's `setContext` runs during the root's own initialisation, so
  the two collapse into a single `color-picker.svelte`. No behaviour is lost — the layout effects
  that synchronise `valueProp`/`openProp` become `$derived` reads of `$bindable` props.
- Upstream's four inner input components (`HexInput`, `RgbInput`, `HslInput`, `HsbInput`) and its
  `InputGroupItem` collapse into `color-picker-input.svelte` (which renders an `{#each}` over a
  derived channel model) plus `color-picker-input-field.svelte` (one channel). The channel model is
  a pure function in `color.ts`, so all four formats are covered by data instead of by four
  near-identical components — same rendered DOM, same `aria-label`s, same validation bounds.
- `angle-slider.tsx` is **not** ported: no upstream color-picker part imports it (spec Assumptions).
- Demo route segment `color-picker` == folder slug `color-picker` == registry item name
  `color-picker`. Confirmed.

### Shared module exported for later components

`src/lib/components/ui/color-picker/color.ts` — pure, rune-free, DOM-free, tree-shakeable:

| Export                                                              | Purpose                                                                 |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `COLOR_FORMATS`, `type ColorFormat`                                 | `['hex','rgb','hsl','hsb']` and its union                               |
| `type RgbaColor`, `type HsvaColor`, `type HslColor`                 | `{r,g,b,a}`, `{h,s,v,a}`, `{h,s,l}`                                     |
| `hexToRgb`, `rgbToHex`                                              | hex ⇄ RGB (alpha carried in, dropped out — upstream shape)              |
| `rgbToHsv`, `hsvToRgb`, `rgbToHsl`, `hslToRgb`                      | the four numeric conversions                                            |
| `colorToString(color, format)`                                      | RGBA → `#rrggbb` / `rgb(a)()` / `hsl(a)()` / `hsb(a)()`                 |
| `parseColorString(value)`                                           | any of the four notations → `RgbaColor \| null`                         |
| `clampChannel`, `isColorFormat`                                     | shared bounds check + runtime narrowing used by the input and the select |
| `getInputFields({ format, rgb, hsv, withoutAlpha })`                | the derived channel model driving `color-picker-input.svelte`           |
| `describeColor(rgb, hsv, format)`                                   | the `aria-valuetext` / swatch accessible-name string builder            |

`color-swatch`'s `getColorBackgroundStyle` is **not** duplicated here — the swatch composes
`ColorSwatch.Root`, which already owns it.

## Public API

Namespace import: `import * as ColorPicker from '$lib/components/ui/color-picker/index.js';`
Barrel exports both short names (`Root`, `Trigger`, …) and prefixed aliases (`ColorPicker`,
`ColorPickerTrigger`, …), plus every `*Props` and `*ChildProps` type and the whole of `color.ts`.

Conventions used in the tables: **B** = `$bindable`. Every part additionally accepts `ref`
(`$bindable(null)`), `class`, `children` where it renders content, `child` where upstream had
`asChild`, and spreads `...restProps` onto its element.

### `ColorPicker.Root` — `color-picker.svelte` (upstream `ColorPicker`)

| Prop            | Type                                    | Default     | B   | Notes                                                            |
| --------------- | --------------------------------------- | ----------- | --- | ---------------------------------------------------------------- |
| `value`         | `string`                                | —           | ✔   | Current colour as a CSS string in the active format               |
| `defaultValue`  | `string`                                | `"#000000"` |     | Seeds once when uncontrolled                                     |
| `onValueChange` | `(value: string) => void`               | —           |     | Fires with `colorToString(next, format)`                         |
| `open`          | `boolean`                               | —           | ✔   | Popover open state; ignored when `inline`                        |
| `defaultOpen`   | `boolean`                               | `false`     |     |                                                                  |
| `onOpenChange`  | `(open: boolean) => void`               | —           |     |                                                                  |
| `modal`         | `boolean`                               | `false`     |     | Forwarded to `Popover.Root`                                      |
| `format`        | `ColorFormat`                           | —           | ✔   | `'hex' \| 'rgb' \| 'hsl' \| 'hsb'`                               |
| `defaultFormat` | `ColorFormat`                           | `"hex"`     |     |                                                                  |
| `onFormatChange`| `(format: ColorFormat) => void`         | —           |     |                                                                  |
| `dir`           | `Direction`                             | resolved    |     | `'ltr' \| 'rtl'`; falls back to provider → DOM `[dir]` → `'ltr'` |
| `inline`        | `boolean`                               | `false`     |     | No popover/portal/overlay at all                                 |
| `name`          | `string`                                | —           |     | Hidden form input name                                           |
| `disabled`      | `boolean`                               | `false`     |     | Inherited by every part                                          |
| `readOnly`      | `boolean`                               | `false`     |     | Inherited by every part                                          |
| `required`      | `boolean`                               | `false`     |     | Mirrored onto the hidden input                                   |
| `children`      | `Snippet`                               | —           |     |                                                                  |
| `child`         | `Snippet<[{ props: ColorPickerChildProps }]>` | —      |     | Replaces `asChild`                                               |

Data attributes: `data-slot="color-picker"`, `data-disabled`, `data-readonly`, `data-inline`.

### `ColorPicker.Trigger` — upstream `ColorPickerTrigger`

| Prop       | Type                                                 | Default | B   | Notes                                      |
| ---------- | ---------------------------------------------------- | ------- | --- | ------------------------------------------ |
| `disabled` | `boolean`                                            | `false` |     | OR-ed with the root's `disabled`           |
| `children` | `Snippet`                                            | —       |     | Typically `<ColorPicker.Swatch />`         |
| `child`    | `Snippet<[{ props: ColorPickerTriggerChildProps }]>` | —       |     | Replaces `asChild`                         |

Renders `Popover.Trigger` (a real `<button type="button">`) styled with `buttonVariants`.
Data attributes: `data-slot="color-picker-trigger"`, `data-disabled`; `data-state`/`aria-expanded`
come from `Popover.Trigger`. Callbacks: all native button handlers via `restProps`.

### `ColorPicker.Content` — upstream `ColorPickerContent`

Props: every `Popover.Content` prop (`side` `"bottom"`, `align` `"start"`, `sideOffset` `4`,
`onOpenAutoFocus`, `onEscapeKeydown`, `onInteractOutside`, `portalProps`, `forceMount`, `child`, …)
plus `children`. When the root is `inline` it renders a plain `<div>` and silently ignores the
positioning props (upstream does the same). Class base: `flex w-[340px] flex-col gap-4 p-4`.
Data attribute: `data-slot="color-picker-content"`, `data-inline`.

### `ColorPicker.Area` — upstream `ColorPickerArea`

| Prop          | Type                                              | Default                       | B   | Notes                                     |
| ------------- | ------------------------------------------------- | ----------------------------- | --- | ----------------------------------------- |
| `step`        | `number`                                          | `1`                           |     | Arrow-key increment (% points)            |
| `shiftStep`   | `number`                                          | `10`                          |     | Increment while `Shift` is held           |
| `aria-label`  | `string`                                          | `"Saturation and brightness"` |     | Overridable                               |
| `onpointerdown` / `onpointermove` / `onpointerup` | handlers        | —                             |     | Called first; `preventDefault()` opts out |
| `child`       | `Snippet<[{ props: ColorPickerAreaChildProps }]>` | —                             |     | Replaces `asChild`                        |

ARIA (added by this port — upstream has none): `role="slider"`, `tabindex="0"` (`-1` when disabled),
`aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow={saturation}`,
`aria-valuetext="Saturation 76%, brightness 96%, #3b82f6"`, `aria-disabled`, `aria-orientation="horizontal"`.
Keyboard: `ArrowLeft`/`ArrowRight` → saturation ∓/± `step` (inverted under RTL); `ArrowUp`/`ArrowDown`
→ brightness ±`step`; `Shift`+arrow → `shiftStep`; `Home`/`End` → saturation `0`/`100`;
`PageUp`/`PageDown` → brightness ±`shiftStep`. All clamped to `[0, 100]`, all `preventDefault()`.
Data attributes: `data-slot="color-picker-area"`, `data-disabled`, `data-dragging`.

### `ColorPicker.HueSlider` / `ColorPicker.AlphaSlider`

Props: every single-value `bits-ui` `Slider.Root` prop except `value`/`onValueChange`/`type`/`min`/
`max`/`dir`/`disabled`, which the component owns (hue `0–360` step `1`; alpha `0–100` step `1`; both
take `dir` and `disabled` from the root). Accepts `aria-label` (defaults `"Hue"` / `"Alpha"`) and
`class`. Thumb carries `aria-valuetext` — `"217 degrees"` / `"60%"`.
Data attributes: `data-slot="color-picker-hue-slider"` / `"color-picker-alpha-slider"`,
`data-disabled`; the thumb adds `data-slot="…-thumb"`.

### `ColorPicker.Swatch` — upstream `ColorPickerSwatch`

| Prop                  | Type                                               | Default     | B   | Notes                                    |
| --------------------- | -------------------------------------------------- | ----------- | --- | ---------------------------------------- |
| `size`                | `'default' \| 'sm' \| 'lg'`                        | `'default'` |     | From `ColorSwatch`                       |
| `withoutTransparency` | `boolean`                                          | `false`     |     | From `ColorSwatch`                       |
| `child`               | `Snippet<[{ props: ColorPickerSwatchChildProps }]>`| —           |     | Replaces `asChild`                       |

Composes `ColorSwatch.Root`. `role="img"`, `aria-label="Current color: <formatted>"` (upstream's
exact string) or `"No color selected"`. Data attributes: `data-slot="color-picker-swatch"` plus
`ColorSwatch`'s `data-size`/`data-disabled`/`data-transparent`/`data-empty`.

### `ColorPicker.EyeDropper` — upstream `ColorPickerEyeDropper`

Props: every `Button` prop (`variant` defaults `"outline"`, `size` defaults `"icon"` when there is
no `children` else `"default"`), plus `disabled` (OR-ed with the root) and `children` (defaults to
`<PipetteIcon />`). Renders **nothing** when `window.EyeDropper` is absent. On success it applies
`hexToRgb(sRGBHex, currentAlpha)` — alpha preserved. Errors are swallowed with `console.warn`,
matching upstream. `aria-label="Pick a color from the screen"` when icon-only (added: upstream's
icon-only button has no accessible name).
Data attributes: `data-slot="color-picker-eye-dropper"`, `data-disabled`.

### `ColorPicker.FormatSelect` — upstream `ColorPickerFormatSelect`

Props: `Select.Root`'s props minus `value`/`onValueChange`/`type`, plus `size` (`'sm' \| 'default'`,
default `'sm'`), `disabled` (OR-ed with the root), `class` (forwarded to the trigger) and
`aria-label` (default `"Color format"`). Renders `Select.Root` → `Select.Trigger` → `Select.Content`
→ `Select.Group` → four `Select.Item`s labelled `HEX`, `RGB`, `HSL`, `HSB`.
Data attributes: `data-slot="color-picker-format-select"` and `"color-picker-format-select-trigger"`.

### `ColorPicker.Input` — upstream `ColorPickerInput`

| Prop           | Type      | Default | B   | Notes                                             |
| -------------- | --------- | ------- | --- | ------------------------------------------------- |
| `withoutAlpha` | `boolean` | `false` |     | Omits the alpha field in every format             |

Plus every `Input` prop except `value`/`oninput`/`color`. Renders a `data-slot="color-picker-input-wrapper"`
`<div>` containing one `ColorPicker.InputField` per channel of the active format:

| Format | Fields (`aria-label`, bounds)                                                                                                                |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `hex`  | `Hex color value` (text, `#000000`) · `Alpha transparency percentage` (0–100)                                                                 |
| `rgb`  | `Red color component (0-255)` · `Green color component (0-255)` · `Blue color component (0-255)` · `Alpha transparency percentage` (0–100)     |
| `hsl`  | `Hue degree (0-360)` · `Saturation percentage (0-100)` · `Lightness percentage (0-100)` · `Alpha transparency percentage` (0–100)              |
| `hsb`  | `Hue degree (0-360)` · `Saturation percentage (0-100)` · `Brightness percentage (0-100)` · `Alpha transparency percentage` (0–100)             |

`withoutAlpha` + `hex` renders a single isolated field (upstream's exact branch).
Data attribute on each field: `data-slot="color-picker-input"`, `data-channel="<r|g|b|h|s|l|v|a|hex>"`,
`data-disabled`, `data-readonly`.

### `ColorPicker.InputField` — internal-but-exported (upstream `InputGroupItem`)

Props: `Input` props + `position` (`'first' \| 'middle' \| 'last' \| 'isolated'`, default
`'isolated'`) driving the `colorPickerInputVariants` `tv()` join classes, exported from the barrel so
consumers can rebuild the row themselves.

### Not exported

Upstream's `useStore as useColorPicker` selector hook has no Svelte analogue (runes subscribe
automatically). Its replacement is `getColorPickerContext(consumerName)`, exported from
`color-picker.svelte.ts` and re-exported by the barrel, returning the reactive
`ColorPickerRootState`.

## Deliverables & phasing

| Phase | Deliverable                                                                                                      |
| ----- | ----------------------------------------------------------------------------------------------------------------- |
| 1     | `color.ts` (pure maths + channel model + `describeColor`) and `color.test.ts`                                     |
| 2     | `color-picker.svelte.ts` — `ColorPickerRootState`, `ColorPickerAreaState`, Symbol context, `EyeDropper` global    |
| 3     | Root, Trigger, Content (US1 popover path) + form input + inline branch (US2) + controlled paths (US3)             |
| 4     | Area, HueSlider, AlphaSlider, Swatch, EyeDropper, FormatSelect, Input, InputField                                 |
| 5     | `index.ts` barrel                                                                                                 |
| 6     | `color-picker.test.svelte` + `color-picker.test.ts` (roles/ARIA, all props, controlled + uncontrolled, keyboard, RTL, guard rails, provider errors) |
| 7     | `src/routes/docs/components/color-picker/+page.svelte` — 4 previews + 10 props tables                             |
| 8     | `registry.json` entry + `pnpm run registry:build`                                                                 |
| 9     | Quality gates: `format` → `check` → `lint` → `test:unit -- --run` → `build`                                       |

### Registry entry (Phase 8)

```jsonc
{
	"name": "color-picker",
	"type": "registry:ui",
	"title": "Color Picker",
	"description": "A color picker component that allows users to select colors using various input methods.",
	"registryDependencies": ["button", "input", "popover", "select", "color-swatch", "checkbox-group", "direction-provider"],
	"dependencies": ["bits-ui", "@lucide/svelte"],
	"files": [ /* the 14 non-test files listed in Project Structure */ ]
}
```

`checkbox-group` is listed because `FormControlState` lives there — the same edge `time-picker`,
`editable` and `phone-input` already declare.

## Test plan (constitution III floor)

Upstream ships **no** test file for `color-picker`, so the floor is the six mandated areas plus
composition coverage for the `child` snippet escape hatch:

1. **Roles/ARIA** — trigger is a `button` with `aria-expanded`; content is a `dialog`; area is a
   `slider` with valuemin/max/now/text; hue and alpha thumbs are `slider`s with `aria-valuetext`;
   format select is a `combobox`/listbox with four options; each input field has its documented
   `aria-label`; the swatch is `img` with `Current color: …`.
2. **Keyboard** — `Enter`/`Space` open, `Escape` closes and returns focus to the trigger; area
   arrows/`Shift`+arrows/`Home`/`End`/`PageUp`/`PageDown`; hue and alpha arrows/`Home`/`End`; `Tab`
   order across the content.
3. **Uncontrolled** — `defaultValue`, `defaultOpen`, `defaultFormat` each seed and then move
   internally.
4. **Controlled** — `value` + `onValueChange`, `open` + `onOpenChange`, `format` + `onFormatChange`;
   a function binding that declines the write leaves the rendered colour where it was.
5. **RTL** — under `<DirectionProvider dir="rtl">` and under `dir="rtl"`, `ArrowRight` on the area
   *decreases* saturation and the hue/alpha sliders invert.
6. **Guard rails** — `disabled` and `readOnly` suppress pointer and keyboard on every part; each of
   the ten parts rendered outside `<ColorPicker.Root>` throws `/must be used within/`.
7. **Composition** — every `child` snippet receives the documented props payload (FR-019).

Plus port-specific: format switching preserves the colour round-trip (SC-004), invalid input is
rejected and the field resynchronises on blur, alpha `0` still renders the checkerboard, the hidden
form input carries the value under `name` and is absent outside a `<form>`, and `EyeDropper` renders
nothing when `window.EyeDropper` is stubbed away (and updates the colour, preserving alpha, when it
is stubbed in).

## Complexity Tracking

> No constitution violations. Table intentionally empty.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | —         | —          | —                                      |

## Post-design Constitution re-check

Re-evaluated after Phase 1 (data-model, contracts, quickstart): **all ten principles still PASS.**
The design added no new dependency, no suppression, no docs-app import and no bespoke behaviour
beyond the three already justified. The one thing the design surfaced that the pre-check did not is
the input draft buffer (research R-06), which is recorded above as bespoke justification #2 and in
the spec's Assumptions.
