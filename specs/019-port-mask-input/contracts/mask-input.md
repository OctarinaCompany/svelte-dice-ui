# Public Contract: `mask-input`

**Feature**: `019-port-mask-input` | **Upstream**: `docs/registry/bases/radix/ui/mask-input.tsx`

This is the exported surface of `src/lib/components/ui/mask-input/index.ts`. It is the authority for
the implementation and for the demo page's props table.

---

## 1. Components

### `Root` (aliases: `MaskInput`)

`src/lib/components/ui/mask-input/mask-input.svelte`. Renders exactly one `<input>` (or nothing but
the `child` snippet). It is **not** a compound component — there are no sub-parts and no context.

**Type**: `MaskInputRootProps` (alias `MaskInputProps`) extends
`WithElementRef<HTMLInputAttributes, HTMLInputElement>`.

| Prop                  | Type                                                          | Default     | Bindable | Upstream                        |
| --------------------- | ------------------------------------------------------------- | ----------- | -------- | ------------------------------- |
| `ref`                 | `HTMLInputElement \| null`                                    | `null`      | ✅        | `ref` (`useComposedRefs`)       |
| `value`               | `string`                                                      | `undefined` | ✅        | `value`                         |
| `defaultValue`        | `string`                                                      | `''`        | —        | `defaultValue`                  |
| `onValueChange`       | `(maskedValue: string, unmaskedValue: string) => void`        | `undefined` | —        | `onValueChange`                 |
| `onValidate`          | `(isValid: boolean, unmaskedValue: string) => void`           | `undefined` | —        | `onValidate`                    |
| `validationMode`      | `'onChange' \| 'onBlur' \| 'onSubmit' \| 'onTouched' \| 'all'` | `'onChange'` | —      | `validationMode`                |
| `mask`                | `MaskPatternKey \| MaskPattern`                               | `undefined` | —        | `mask`                          |
| `maskPlaceholder`     | `string`                                                      | `undefined` | —        | `maskPlaceholder`               |
| `currency`            | `string`                                                      | `'USD'`     | —        | `currency`                      |
| `locale`              | `string`                                                      | `'en-US'`   | —        | `locale`                        |
| `invalid`             | `boolean`                                                     | `false`     | —        | `invalid`                       |
| `withoutMask`         | `boolean`                                                     | `false`     | —        | `withoutMask`                   |
| `disabled`            | `boolean`                                                     | `false`     | —        | `disabled`                      |
| `readonly`            | `boolean`                                                     | `false`     | —        | `readOnly` (**D-03**)           |
| `required`            | `boolean`                                                     | `false`     | —        | `required`                      |
| `placeholder`         | `string`                                                      | `undefined` | —        | `placeholder`                   |
| `inputMode`           | `HTMLInputAttributes['inputmode']`                            | derived     | —        | `inputMode`                     |
| `maxlength`           | `number`                                                      | derived     | —        | `maxLength`                     |
| `min` / `max`         | `string \| number`                                            | `undefined` | —        | `min` / `max`                   |
| `class`               | `string`                                                      | `undefined` | —        | `className`                     |
| `child`               | `Snippet<[{ props: MaskInputChildProps }]>`                   | `undefined` | —        | `asChild` (**D-04**)            |
| `oninput`             | `(e: InputEvent & { currentTarget: HTMLInputElement }) => void` | `undefined` | —      | `onChange` (**D-02**)           |
| `onfocus`             | `FocusEventHandler<HTMLInputElement>`                         | `undefined` | —        | `onFocus`                       |
| `onblur`              | `FocusEventHandler<HTMLInputElement>`                         | `undefined` | —        | `onBlur`                        |
| `onkeydown`           | `KeyboardEventHandler<HTMLInputElement>`                      | `undefined` | —        | `onKeyDown`                     |
| `onpaste`             | `ClipboardEventHandler<HTMLInputElement>`                     | `undefined` | —        | `onPaste`                       |
| `oncompositionstart`  | `CompositionEventHandler<HTMLInputElement>`                   | `undefined` | —        | `onCompositionStart`            |
| `oncompositionend`    | `CompositionEventHandler<HTMLInputElement>`                   | `undefined` | —        | `onCompositionEnd`              |
| …rest                 | any `HTMLInputAttributes` (`id`, `name`, `aria-*`, `data-*`)  | —           | —        | `...inputProps`                 |

**Snippets**: `child` only. An `<input>` is a void element, so there is no `children` snippet.

**Callbacks**: `onValueChange`, `onValidate`, plus the six intercepted DOM handlers above. No
`createEventDispatcher`, no custom events.

**Emitted attributes**

| Attribute                     | When                                              |
| ----------------------------- | ------------------------------------------------- |
| `data-slot="mask-input"`      | always                                            |
| `aria-invalid`                | always (`"true"` / `"false"`), from `invalid`     |
| `data-invalid=""`             | `invalid === true`                                |
| `data-disabled=""`            | `disabled === true`                               |
| `data-readonly=""`            | `readonly === true`                               |
| `data-required=""`            | `required === true`                               |
| `maxlength`                   | when the active pattern has a fixed slot count    |
| `inputmode`                   | per research R-11                                 |
| `placeholder`                 | per §6 below; **absent** when it resolves to `undefined` |

**Caller `class` is merged last** through `cn()`.

---

## 2. Engine exports (`mask-engine.ts`, re-exported from the barrel)

These are the FR-017 / US5 reuse surface consumed by the future `phone-input` port. Signatures are
byte-identical to upstream.

```ts
export const MASK_PATTERNS: Record<MaskPatternKey, MaskPattern>;

export function applyMask(opts: {
	value: string;
	pattern: string;
	currency?: string;
	locale?: string;
	mask?: MaskPatternKey | MaskPattern;
}): string;

export function applyCurrencyMask(opts: { value: string; currency?: string; locale?: string }): string;

export function applyPercentageMask(value: string): string;

export function getUnmaskedValue(opts: {
	value: string;
	currency?: string;
	locale?: string;
	transform?: (value: string, opts?: TransformOptions) => string;
}): string;

export function toUnmaskedIndex(opts: { masked: string; pattern: string; caret: number }): number;

export function fromUnmaskedIndex(opts: { masked: string; pattern: string; unmaskedIndex: number }): number;
```

Also exported (needed by the component and useful to a re-implementer, all present upstream as
module-private helpers — exporting them is additive, not a rename):

```ts
export const DEFAULT_CURRENCY: 'USD';
export const DEFAULT_LOCALE: 'en-US';
export const MASK_PATTERN_KEYS: readonly MaskPatternKey[];
export function isCurrencyMask(opts: { mask?: MaskPatternKey | MaskPattern; pattern?: string }): boolean;
export function isCurrencyAtEnd(opts: TransformOptions): boolean;
export function getCurrencyCaretPosition(opts: { … }): number;
export function getPatternCaretPosition(opts: { … }): number;
export function resolveMaskPattern(mask: MaskPatternKey | MaskPattern | undefined): MaskPattern | undefined;
```

## 3. Types exported from the barrel

`MaskInputProps`, `MaskInputRootProps`, `MaskInputChildProps`, `MaskPattern`, `MaskPatternKey`,
`TransformOptions`, `ValidateOptions`, `MaskInputValidationMode`, `MaskInputState`,
`MaskInputStateProps`.

## 4. Barrel shape

```ts
import Root from './mask-input.svelte';

export type { MaskInputChildProps, MaskInputProps, MaskInputRootProps } from './mask-input.svelte';
export { MaskInputState, type MaskInputStateProps, type MaskInputValidationMode,
         MASK_INPUT_VALIDATION_MODES } from './mask-input.svelte.js';
export { /* every engine export above */ } from './mask-engine.js';

export {
	Root,
	//
	Root as MaskInput
};
```

Both import styles must work:

```ts
import * as MaskInput from '$lib/components/ui/mask-input/index.js'; // MaskInput.Root
import { MaskInput, MASK_PATTERNS } from '$lib/components/ui/mask-input/index.js';
```

## 5. Keyboard contract (upstream MDX "Keyboard Interactions")

| Key                | Behaviour                                                                            |
| ------------------ | ------------------------------------------------------------------------------------ |
| `Tab` / `Shift+Tab`| Standard focus in/out. Never trapped.                                                 |
| `Backspace`        | Removes the slot **before** the caret in unmasked space, reformats, places the caret after the removed slot's new position. Skipped for currency/percentage/`ipv4`, and when there is a non-collapsed selection. |
| `Delete`           | Removes the slot **at** the caret, reformats, caret unchanged. Same exclusions.        |
| `Ctrl/Cmd + V`     | Replaces the selection with the pasted text, reformats the whole value, caret after the last pasted slot. Skipped for `ipv4`. |
| `Ctrl/Cmd + A`     | Native select-all. Not intercepted.                                                   |
| printable keys     | Handled through `input`, not `keydown`.                                               |

## 6. Placeholder resolution

| `withoutMask` | `placeholder` | `maskPlaceholder` | unfocused       | focused           |
| ------------- | ------------- | ----------------- | --------------- | ----------------- |
| `true`        | any           | any               | `placeholder`   | `placeholder`     |
| `false`       | set           | set               | `placeholder`   | `maskPlaceholder` |
| `false`       | unset         | set               | *absent*        | `maskPlaceholder` |
| `false`       | set           | unset             | `placeholder`   | `placeholder`     |
| `false`       | unset         | unset             | *absent*        | *absent*          |

## 7. Recorded divergences from upstream

| ID   | Upstream                       | Here                                                | Reason                       |
| ---- | ------------------------------ | --------------------------------------------------- | ---------------------------- |
| D-01 | `isControlled = value !== undefined` | `$bindable value` + `defaultValue`; a function binding is how a parent stays authoritative | No React-style controlled detection in Svelte (research R-05) |
| D-02 | `onChange`, `onFocus`, `onBlur`, `onKeyDown`, `onPaste`, `onComposition*` | `oninput`, `onfocus`, `onblur`, `onkeydown`, `onpaste`, `oncomposition*` | Svelte 5 DOM event naming (R-06) |
| D-03 | `readOnly`                     | `readonly`                                          | `HTMLInputAttributes` spelling (R-07) |
| D-04 | `asChild` + Radix `Slot`       | `child` snippet                                     | Spec Assumptions; repo pattern (R-08) |
| D-05 | handlers read `inputRef.current` | handlers read `event.currentTarget`               | Makes `child` mode behaviour-complete (R-08) |
| D-06 | `react-hook-form` + `zod` form demo | plain `<form>` + `Field.*` + `$state` + `svelte-sonner` | Zero new npm deps (R-13) |
| D-07 | `useComposedRefs` / `lib/compose-refs.ts` | `ref = $bindable(null)` + `bind:this`      | Spec Assumptions             |
| D-08 | `onKeyDown` / `onPaste` run regardless of `disabled` / `readOnly` | both `return` immediately when `disabled` or `readonly` is true | Upstream would rewrite a read-only field's value, breaking FR-012 |
| D-09 | a caller `onChange` is silently dropped (overridden after the `...inputProps` spread) | `oninput` is forwarded first and gated on `event.defaultPrevented`, like the other six handlers | Consistency; a caller can opt a change out of masking |
| D-10 | the Backspace/Delete branches call `onValueChangeProp` without writing state; the currency and percentage paste branches write neither | one `#commit(masked, unmasked)` assigns `value` **then** notifies, and both symbol paste branches assign `value` **without** notifying (upstream returns before its callback, and the tests assert that) | `bind:value` and `displayValue` must not go stale behind the element |
| D-11 | `value={displayValue}` is a React-controlled attribute, and React restores it after an event | the displayed value is applied by an attachment that writes `element.value` **only when it differs**, re-armed by a commit generation | Both of Svelte's attribute writers assign `element.value` whenever their own record changed — they never compare against the element — so the flush after a handler would rewrite the identical string and knock the caret to the end. The generation restores the element when a controlled parent declines a write, which is React's behaviour. `MaskInputChildProps` therefore carries the attachment instead of a `value` key. |
