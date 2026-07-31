# Phase 1 Data Model: Color Picker

Entities are runtime types, not persisted records. Everything below lives in
`src/lib/components/ui/color-picker/color.ts` (pure) or `color-picker.svelte.ts` (reactive).

## 1. `RgbaColor` — `color.ts`

```ts
type RgbaColor = { r: number; g: number; b: number; a: number };
```

| Field | Range     | Validation                                   |
| ----- | --------- | -------------------------------------------- |
| `r`   | `0..255`  | integer; clamped on write, rounded on convert |
| `g`   | `0..255`  | as above                                     |
| `b`   | `0..255`  | as above                                     |
| `a`   | `0..1`    | float; the inputs work in `0..100` percent   |

Invariant: an out-of-range channel is **rejected**, never clamped, when it arrives from an input
field (upstream: `if (!Number.isNaN(value) && value >= 0 && value <= max)`). Clamping applies only to
values computed internally (pointer geometry, arrow steps).

## 2. `HsvaColor` — `color.ts`

```ts
type HsvaColor = { h: number; s: number; v: number; a: number };
```

| Field | Range     | Notes                                              |
| ----- | --------- | -------------------------------------------------- |
| `h`   | `0..360`  | integer degrees; hue slider position               |
| `s`   | `0..100`  | integer percent; the area's **x** axis             |
| `v`   | `0..100`  | integer percent; the area's **y** axis (inverted)  |
| `a`   | `0..1`    | mirrors `RgbaColor.a`                              |

## 3. `HslColor` — `color.ts`

```ts
type HslColor = { h: number; s: number; l: number };
```

Derived on demand for the `hsl` input fields and for `colorToString(color, 'hsl')`. Never stored.

## 4. `ColorFormat` — `color.ts`

```ts
const COLOR_FORMATS = ['hex', 'rgb', 'hsl', 'hsb'] as const;
type ColorFormat = (typeof COLOR_FORMATS)[number];
```

`isColorFormat(value: unknown): value is ColorFormat` narrows an untyped runtime value (the Select
hands back `string`). Anything else falls back to `'hex'`.

## 5. `ColorPickerInputField` — `color.ts`

The channel model that replaces upstream's four near-identical input components.

```ts
type ColorPickerInputChannel = 'hex' | 'r' | 'g' | 'b' | 'h' | 's' | 'l' | 'v' | 'a';

type ColorPickerInputField = {
	channel: ColorPickerInputChannel;
	label: string;                              // the exact upstream aria-label
	value: string;                              // canonical display value
	placeholder: string;
	numeric: boolean;                           // adds inputMode/pattern/min/max
	min?: number;
	max?: number;
	position: 'first' | 'middle' | 'last' | 'isolated';
};

function getInputFields(input: {
	format: ColorFormat;
	rgb: RgbaColor;
	hsv: HsvaColor;
	withoutAlpha: boolean;
}): ColorPickerInputField[];
```

Field sets (labels are byte-for-byte upstream's):

| Format          | Fields                                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `hex`           | `hex` "Hex color value" (`#000000`, `isolated` when `withoutAlpha` else `first`) · `a` "Alpha transparency percentage" (0–100, `last`)         |
| `rgb`           | `r`/`g`/`b` "Red\|Green\|Blue color component (0-255)" · `a` "Alpha transparency percentage"                                                   |
| `hsl`           | `h` "Hue degree (0-360)" · `s` "Saturation percentage (0-100)" · `l` "Lightness percentage (0-100)" · `a`                                      |
| `hsb`           | `h` "Hue degree (0-360)" · `s` "Saturation percentage (0-100)" · `v` "Brightness percentage (0-100)" · `a`                                     |

`position` is `first` for index 0, `last` for the final field, `middle` between, and `isolated` when
the set has exactly one field.

## 6. `ColorPickerRootState` — `color-picker.svelte.ts`

The single reactive entity. Constructed by `color-picker.svelte`, published on
`Symbol('color-picker')`, read by all ten parts through `getColorPickerContext(consumerName)`.

### Constructor input (all reactive values arrive as getters)

```ts
type ColorPickerRootStateProps = {
	getValue: () => string | undefined;
	setValue: (value: string) => void;          // writes $bindable + calls onValueChange
	getOpen: () => boolean;
	setOpen: (open: boolean) => void;
	getFormat: () => ColorFormat;
	setFormat: (format: ColorFormat) => void;
	getDir: () => Direction;
	getInline: () => boolean;
	getDisabled: () => boolean;
	getReadOnly: () => boolean;
	getRequired: () => boolean;
	getName: () => string | undefined;
};
```

### State

| Member         | Kind                | Notes                                                             |
| -------------- | ------------------- | ----------------------------------------------------------------- |
| `#rgb`         | `$state<RgbaColor>` | authoritative RGBA; seeded from `value ?? defaultValue` (R-02)     |
| `#hsv`         | `$state<HsvaColor>` | authoritative HSVA; seeded from `rgbToHsv(#rgb)`                   |
| `rgb`          | getter              | read-only view                                                    |
| `hsv`          | getter              | read-only view                                                    |
| `hue`          | `$derived`          | `#hsv.h`                                                          |
| `saturation`   | `$derived`          | `#hsv.s`                                                          |
| `brightness`   | `$derived`          | `#hsv.v`                                                          |
| `alpha`        | `$derived`          | `#rgb.a`                                                          |
| `alphaPercent` | `$derived`          | `Math.round(alpha * 100)`                                         |
| `hex`          | `$derived`          | `rgbToHex(#rgb)` — what the hidden form input submits             |
| `formatted`    | `$derived`          | `colorToString(#rgb, format)` — what `onValueChange` emits        |
| `valueText`    | `$derived`          | `describeColor(#rgb, #hsv, format)` — the area's `aria-valuetext` |
| `inputFields`  | `$derived`          | `getInputFields({ format, rgb, hsv, withoutAlpha })`              |
| `dir` / `disabled` / `readOnly` / `required` / `inline` / `open` / `format` / `name` | getters | pass-throughs |

### State transitions

| Method                                   | Effect                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| `setFromRgb(rgb)`                        | `#rgb = rgb`; `#hsv = { ...rgbToHsv(rgb), a: rgb.a }`; emits `setValue(colorToString(rgb, format))` |
| `setFromHsv(hsv)`                        | `#hsv = hsv`; `#rgb = hsvToRgb(hsv)`; emits                                                    |
| `setHue(h)`                              | `setFromHsv({ ...hsv, h })`                                                                    |
| `setSaturationBrightness(s, v)`          | `setFromHsv({ ...hsv, s, v })` — the area's only mutator                                       |
| `setAlpha(a)`                            | writes `a` on **both** `#rgb` and `#hsv`; emits                                                |
| `commitField(channel, raw)`              | validates per the field's bounds, returns `boolean`; on `true` routes to the right mutator     |
| `setFormat(format)`                      | pass-through; **touches no colour state** (FR-003, R-14)                                       |
| `setOpen(open)`                          | pass-through to the `$bindable` + `onOpenChange`                                               |
| `syncFromValue(value)`                   | called from a `$derived` read of the controlled prop: `parseColorString(value) ?? hexToRgb(value, alpha)` (R-03) |

Guard: every mutator returns early when `disabled` or `readOnly` (FR-015).

`commitField` routing:

| Channel     | Route                                                                             |
| ----------- | --------------------------------------------------------------------------------- |
| `hex`       | `parseColorString(raw)` → `setFromRgb({ ...parsed, a: alpha })`; `null` ⇒ reject   |
| `r\|g\|b`   | integer `0..255` ⇒ `setFromRgb({ ...rgb, [ch]: n })`                               |
| `h`         | integer `0..360` ⇒ `hsl`/`hsb` branch per the active format                        |
| `s`         | integer `0..100` ⇒ `hsl`: `hslToRgb({ ...hsl, s }, alpha)`; `hsb`: `setFromHsv`    |
| `l`         | integer `0..100` ⇒ `hslToRgb({ ...hsl, l }, alpha)`                                |
| `v`         | integer `0..100` ⇒ `setFromHsv({ ...hsv, v })`                                     |
| `a`         | integer `0..100` ⇒ `setAlpha(n / 100)`                                             |

## 7. `ColorPickerAreaState` — `color-picker.svelte.ts`

Owns only what the area needs; reads the colour through the root state.

| Member                          | Kind                             | Notes                                                   |
| ------------------------------- | -------------------------------- | ------------------------------------------------------- |
| `isDragging`                    | `$state<boolean>`                | drives `data-dragging`                                  |
| `backgroundColor`               | `$derived`                       | `hsvToRgb({ h: hue, s: 100, v: 100, a: 1 })` — the hue-locked base layer |
| `thumbLeft` / `thumbTop`        | `$derived`                       | `${s}%` / `${100 - v}%`                                 |
| `updateFromPointer(x, y, rect)` | method                           | `sx = clamp01((x - rect.left) / rect.width)`, inverted under RTL; `sv = clamp01(1 - (y - rect.top) / rect.height)`; writes `setSaturationBrightness(round(sx*100), round(sv*100))` |
| `onKeydown(event)`              | method                           | the R-04 key table; returns `true` when it handled the key |

## 8. Open state

`open: boolean`, `$bindable` on the root, seeded from `defaultOpen` (`false`), forwarded to
`Popover.Root`. Ignored entirely when `inline`.

## Relationships

```text
color-picker.svelte  ──setContext(Symbol('color-picker'))──►  ColorPickerRootState
        │                                                          ▲
        │ renders                                                  │ getColorPickerContext(name)
        ▼                                                          │
   Trigger · Content ── Area (owns ColorPickerAreaState) ──────────┤
                     ├─ HueSlider · AlphaSlider ───────────────────┤
                     ├─ Swatch (composes ColorSwatch.Root) ────────┤
                     ├─ EyeDropper · FormatSelect ─────────────────┤
                     └─ Input ── InputField × n ───────────────────┘
```

Every part throws ``\`<ColorPicker.X>\` must be used within `<ColorPicker.Root>`.`` when the context
is absent (FR-017).
