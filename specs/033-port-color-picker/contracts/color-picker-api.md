# Contract: `color-picker` public interface

This is the interface the registry item exposes to consumers. It is the acceptance surface for
`/speckit-analyze` and for the colocated tests. Types are TypeScript as written in the barrel.

## Barrel — `src/lib/components/ui/color-picker/index.ts`

```ts
import Root from './color-picker.svelte';
import Trigger from './color-picker-trigger.svelte';
import Content from './color-picker-content.svelte';
import Area from './color-picker-area.svelte';
import HueSlider from './color-picker-hue-slider.svelte';
import AlphaSlider from './color-picker-alpha-slider.svelte';
import Swatch from './color-picker-swatch.svelte';
import EyeDropper from './color-picker-eye-dropper.svelte';
import FormatSelect from './color-picker-format-select.svelte';
import Input from './color-picker-input.svelte';
import InputField from './color-picker-input-field.svelte';

export type { ColorPickerRootProps, ColorPickerProps, ColorPickerChildProps } from './color-picker.svelte';
export type { ColorPickerTriggerProps, ColorPickerTriggerChildProps } from './color-picker-trigger.svelte';
export type { ColorPickerContentProps } from './color-picker-content.svelte';
export type { ColorPickerAreaProps, ColorPickerAreaChildProps } from './color-picker-area.svelte';
export type { ColorPickerHueSliderProps } from './color-picker-hue-slider.svelte';
export type { ColorPickerAlphaSliderProps } from './color-picker-alpha-slider.svelte';
export type { ColorPickerSwatchProps, ColorPickerSwatchChildProps } from './color-picker-swatch.svelte';
export type { ColorPickerEyeDropperProps } from './color-picker-eye-dropper.svelte';
export type { ColorPickerFormatSelectProps } from './color-picker-format-select.svelte';
export type { ColorPickerInputProps } from './color-picker-input.svelte';
export { colorPickerInputVariants, type ColorPickerInputFieldProps } from './color-picker-input-field.svelte';

export {
	ColorPickerRootState,
	ColorPickerAreaState,
	getColorPickerContext,
	setColorPickerContext,
	type ColorPickerRootStateProps
} from './color-picker.svelte.js';

export {
	COLOR_FORMATS,
	isColorFormat,
	clampChannel,
	hexToRgb,
	rgbToHex,
	rgbToHsv,
	hsvToRgb,
	rgbToHsl,
	hslToRgb,
	colorToString,
	parseColorString,
	getInputFields,
	describeColor,
	type ColorFormat,
	type RgbaColor,
	type HsvaColor,
	type HslColor,
	type ColorPickerInputChannel,
	type ColorPickerInputField
} from './color.js';

export {
	Root, Trigger, Content, Area, HueSlider, AlphaSlider, Swatch, EyeDropper, FormatSelect, Input, InputField,
	//
	Root as ColorPicker,
	Trigger as ColorPickerTrigger,
	Content as ColorPickerContent,
	Area as ColorPickerArea,
	HueSlider as ColorPickerHueSlider,
	AlphaSlider as ColorPickerAlphaSlider,
	Swatch as ColorPickerSwatch,
	EyeDropper as ColorPickerEyeDropper,
	FormatSelect as ColorPickerFormatSelect,
	Input as ColorPickerInput,
	InputField as ColorPickerInputField
};
```

## Composition contract

```svelte
<ColorPicker.Root bind:value bind:format defaultValue="#3b82f6" name="primaryColor">
	<ColorPicker.Trigger>
		<ColorPicker.Swatch />
	</ColorPicker.Trigger>
	<ColorPicker.Content>
		<ColorPicker.Area />
		<div class="flex items-center gap-2">
			<ColorPicker.EyeDropper />
			<div class="flex flex-1 flex-col gap-2">
				<ColorPicker.HueSlider />
				<ColorPicker.AlphaSlider />
			</div>
		</div>
		<div class="flex items-center gap-2">
			<ColorPicker.FormatSelect />
			<ColorPicker.Input />
		</div>
	</ColorPicker.Content>
</ColorPicker.Root>
```

Inline: drop `Trigger`, set `inline` on the root, keep or drop `Content`.

## Rendered DOM contract

| Part           | Element                        | `data-slot`                          | Role / semantics                                      |
| -------------- | ------------------------------ | ------------------------------------ | ----------------------------------------------------- |
| Root           | `div`                          | `color-picker`                       | `data-disabled` `data-readonly` `data-inline`         |
| Trigger        | `button[type=button]`          | `color-picker-trigger`               | `aria-expanded`, `data-state`, `data-disabled`        |
| Content        | popover content / `div`        | `color-picker-content`               | `role="dialog"` when popover; `data-inline` when inline |
| Area           | `div`                          | `color-picker-area`                  | `role="slider"`, `aria-valuemin/max/now/text`, `tabindex` |
| Area thumb     | `div`                          | `color-picker-area-thumb`            | decorative                                            |
| HueSlider      | bits-ui `Slider.Root`          | `color-picker-hue-slider`            | thumb `role="slider"`, `aria-label="Hue"`             |
| AlphaSlider    | bits-ui `Slider.Root`          | `color-picker-alpha-slider`          | thumb `role="slider"`, `aria-label="Alpha"`           |
| Swatch         | `ColorSwatch.Root` (`div`)     | `color-picker-swatch`                | `role="img"`, `aria-label="Current color: …"`         |
| EyeDropper     | `button` or nothing            | `color-picker-eye-dropper`           | `aria-label="Pick a color from the screen"`           |
| FormatSelect   | `Select.Trigger`/`Content`     | `color-picker-format-select[-trigger]` | combobox + listbox with 4 options                   |
| Input          | `div`                          | `color-picker-input-wrapper`         | container                                             |
| InputField     | `input`                        | `color-picker-input`                 | `data-channel`, per-field `aria-label`                |
| Form input     | `input[type=hidden]`           | `color-picker-form-input`            | only inside a `<form>`                                |

Boolean data attributes are written `cond ? '' : undefined`.

## Behavioural contract

1. `value` absent ⇒ uncontrolled from `defaultValue` (`"#000000"`). `value` present ⇒ the binding is
   authoritative; a function binding that declines the write leaves the display unchanged.
2. `onValueChange` fires with `colorToString(next, format)` on every colour change from any part, in
   both modes; it does **not** fire when only `format` or `open` changes.
3. `format` changes the displayed/edited notation only. Round-tripping hex → rgb → hsl → hsb → hex
   returns the original within ±1 per channel.
4. `open`/`defaultOpen`/`onOpenChange` govern the popover; `inline` disables the popover entirely.
5. `Escape` closes and returns focus to the trigger; `Enter`/`Space` on the trigger opens.
6. Area keyboard: `ArrowLeft/Right` = saturation (RTL-inverted), `ArrowUp/Down` = brightness,
   `Shift` = `shiftStep`, `Home`/`End` = saturation `0`/`100`, `PageUp`/`PageDown` = brightness
   ±`shiftStep`. All clamped `0..100`.
7. Hue slider spans `0..360` step `1`; alpha slider spans `0..100` step `1` (percent).
8. Invalid or out-of-range input is rejected; the field resynchronises to the canonical value on blur.
9. `disabled`/`readOnly` suppress every pointer and keyboard mutation and are reflected as
   `aria-disabled` + `data-disabled` / `data-readonly`.
10. `EyeDropper` renders nothing without `window.EyeDropper`; on success it preserves the current alpha.
11. Inside a `<form>`, a hidden input carries `rgbToHex(color)` under `name`; outside one it is absent.
12. Every part rendered outside `<ColorPicker.Root>` throws
    ``\`<ColorPicker.X>\` must be used within `<ColorPicker.Root>`.``

## `color.ts` function contract

| Function                                          | Contract                                                                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `hexToRgb(hex, alpha?)`                           | 6-digit hex (with or without `#`) → `RgbaColor`; anything else → `{r:0,g:0,b:0,a:alpha??1}` |
| `rgbToHex(color)`                                 | `#rrggbb`, lowercase, zero-padded; alpha dropped                                          |
| `rgbToHsv(color)` / `hsvToRgb(hsv)`               | integer-rounded, alpha carried through                                                    |
| `rgbToHsl(color)` / `hslToRgb(hsl, alpha?)`       | integer-rounded                                                                           |
| `colorToString(color, format)`                    | `#rrggbb` · `rgb(a)(r, g, b[, a])` · `hsl(a)(h, s%, l%[, a])` · `hsb(a)(h, s%, v%[, a])`; the `a` suffix appears only when `a < 1` |
| `parseColorString(value)`                         | 3- or 6-digit hex, `rgb()`/`rgba()`, `hsl()`/`hsla()`, `hsb()`/`hsba()` → `RgbaColor`; otherwise `null` |
| `isColorFormat(value)`                            | type guard over `COLOR_FORMATS`                                                          |
| `clampChannel(n, min, max)`                       | clamps and rounds                                                                        |
| `getInputFields(input)`                           | the table in data-model.md §5                                                             |
| `describeColor(rgb, hsv, format)`                 | `"Saturation {s}%, brightness {v}%, {colorToString(rgb, format)}"`                        |

All are pure: no DOM, no runes, no globals.
