# Phase 1 Data Model: Mask Input

**Feature**: `019-port-mask-input` | **Date**: 2026-07-30

This component stores no persistent data. The "entities" below are the runtime types and reactive
state that make up its contract. Each maps to a named type in `mask-engine.ts`,
`mask-input.svelte.ts`, or `mask-input.svelte`.

---

## 1. `MaskPattern` — the mask definition

Module: `mask-engine.ts`. Upstream `mask-input.tsx:182-186`.

| Field       | Type                                                    | Required | Notes                                                                     |
| ----------- | ------------------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| `pattern`   | `string`                                                | yes      | `#` = one fillable slot; every other character is a literal.               |
| `transform` | `(value: string, opts?: TransformOptions) => string`    | no       | Cleans raw input → unmasked. Default when absent: strip all non-digits.    |
| `validate`  | `(value: string, opts?: ValidateOptions) => boolean`    | no       | Judges the **unmasked** value. Absent ⇒ `onValidate` never fires.          |

**Validation rules**

- A pattern containing `$` or `€` routes to `applyCurrencyMask` regardless of its `#` layout.
- A pattern containing `%` routes to `applyPercentageMask`.
- Both routes bypass slot-filling entirely, so `#` counts in those patterns are decorative.

## 2. `TransformOptions` / `ValidateOptions`

| Type               | Field      | Type     | Default   | Source                                       |
| ------------------ | ---------- | -------- | --------- | -------------------------------------------- |
| `TransformOptions` | `currency` | `string` | `'USD'`   | component `currency` prop                    |
| `TransformOptions` | `locale`   | `string` | `'en-US'` | component `locale` prop                      |
| `ValidateOptions`  | `min`      | `number` | —         | component `min` attribute, `parseFloat`'d    |
| `ValidateOptions`  | `max`      | `number` | —         | component `max` attribute, `parseFloat`'d    |

`min`/`max` arrive as `string | number` from `HTMLInputAttributes` and are normalised with
`typeof v === 'string' ? Number.parseFloat(v) : v` (upstream lines 977-983).

## 3. `MaskPatternKey` and `MASK_PATTERNS`

`MaskPatternKey` is a 15-member string union; `MASK_PATTERNS` is
`Record<MaskPatternKey, MaskPattern>`. Declaration order is preserved from upstream.

| Key                | Pattern                | Transform             | Validate (on unmasked)                                    |
| ------------------ | ---------------------- | --------------------- | ---------------------------------------------------------- |
| `phone`            | `(###) ###-####`       | digits only           | exactly 10 digits                                          |
| `ssn`              | `###-##-####`          | digits only           | exactly 9 digits                                           |
| `date`             | `##/##/####`           | digits only           | 8 digits, real calendar date, year ∈ [now−120, now+10]     |
| `time`             | `##:##`                | digits only           | 4 digits, `hh ≤ 23`, `mm ≤ 59`                             |
| `creditCard`       | `#### #### #### ####`  | digits only           | 13–19 digits **and** Luhn checksum ≡ 0 (mod 10)            |
| `creditCardExpiry` | `##/##`                | digits only           | 4 digits, `01 ≤ mm ≤ 12`, not past, ≤ now+50y, `yy≤75`⇒20xx |
| `zipCode`          | `#####`                | digits only           | exactly 5 digits                                           |
| `zipCodeExtended`  | `#####-####`           | digits only           | exactly 9 digits                                           |
| `currency`         | `$###,###.##`          | locale-aware decimals | `^\d+(\.\d{1,2})?$` and `≥ 0`                              |
| `percentage`       | `##.##%`               | digits + one `.`, 2dp | numeric and `min ≤ n ≤ max` (defaults 0 / 100)             |
| `licensePlate`     | `###-###`              | `[^A-Z0-9]`→"", upper | `^[A-Z0-9]{6}$`                                            |
| `ipv4`             | `###.###.###.###`      | digits and `.` only   | dotted: ≤4 segments each ≤255; bare: ≤12 digits, 3-chunks   |
| `macAddress`       | `##:##:##:##:##:##`    | `[^A-Z0-9]`→"", upper | `^[A-F0-9]{12}$`                                           |
| `isbn`             | `###-#-###-#####-#`    | digits only           | exactly 13 digits                                          |
| `ein`              | `##-#######`           | digits only           | exactly 9 digits                                           |

**State transition (formatting pipeline)**, applied on every commit:

```
raw DOM text ──transform()──▶ unmasked ──applyMask()──▶ masked ──▶ element.value + onValueChange
                                  │
                                  └──validate(opts)──▶ onValidate  (gated by validationMode)
```

`ipv4` short-circuits `applyMask` (returns the cleaned value unchanged) and is excluded from the
`keydown` and `paste` interception paths — the user types their own dots.

## 4. `ValidationMode` — when `onValidate` fires

Union: `'onChange' | 'onBlur' | 'onSubmit' | 'onTouched' | 'all'`. Default `'onChange'`.

The gate is `shouldValidate(trigger)`, which returns `false` up front unless **both** `onValidate` and
`maskPattern.validate` exist:

| Mode        | `trigger === 'change'`   | `trigger === 'blur'` |
| ----------- | ------------------------ | -------------------- |
| `onChange`  | ✅                        | ❌                    |
| `onBlur`    | ❌                        | ✅                    |
| `onSubmit`  | ❌                        | ❌                    |
| `onTouched` | only once `touched`      | ✅                    |
| `all`       | ✅                        | ✅                    |

`touched` flips to `true` on the **first** blur, and the flip happens **before** the blur's own
`shouldValidate('blur')` call is evaluated in upstream order (lines 1130-1146: `setTouched(true)` is
queued, then `shouldValidate('blur')` reads the pre-flip value — in `onTouched` that read is
`trigger === 'blur'` ⇒ `true` either way, so the ordering is not observable). The port sets `touched`
first and keeps the same observable outcome.

## 5. Component reactive state (`MaskInputState`, `mask-input.svelte.ts`)

| Member                 | Kind        | Initial   | Purpose                                                                 |
| ---------------------- | ----------- | --------- | ----------------------------------------------------------------------- |
| `focused`              | `$state`    | `false`   | Drives `placeholderValue` swapping.                                     |
| `composing`            | `$state`    | `false`   | IME guard: suppresses masking + `onValueChange` mid-composition.        |
| `touched`              | `$state`    | `false`   | `onTouched` gate.                                                       |
| `maskPattern`          | `$derived`  | —         | `typeof mask === 'string' ? MASK_PATTERNS[mask] : mask`.                |
| `transformOpts`        | `$derived`  | —         | `{ currency, locale }`.                                                 |
| `validateOpts`         | `$derived`  | —         | normalised `{ min, max }`.                                              |
| `placeholderValue`     | `$derived`  | —         | See table in §6 of the contract.                                        |
| `displayValue`         | `$derived`  | `''`      | `withoutMask \|\| !maskPattern \|\| !value ? value ?? '' : mask(unmask(value))`. |
| `tokenCount`           | `$derived`  | —         | `undefined` for no-mask or `€$%` patterns; else count of `#`.           |
| `calculatedMaxLength`  | `$derived`  | —         | `tokenCount ? pattern.length : maxLength`.                              |
| `calculatedInputMode`  | `$derived`  | —         | R-11 table.                                                             |

All reactive inputs (`value`, `mask`, `currency`, `locale`, `min`, `max`, `maxLength`, `inputMode`,
`placeholder`, `maskPlaceholder`, `withoutMask`, `validationMode`, and every callback) enter the class
as **getter functions** on its constructor props object — never as captured snapshots.

The class is *not* placed in a Svelte context (research R-02): the root instantiates it and consumes
it directly.

## 6. `MaskInputChildProps` — the `child` snippet payload

The exact attribute bag the default `<input>` receives, so `{...props}` on a caller's element is
behaviour-complete:

| Key                                    | Type                          |
| -------------------------------------- | ----------------------------- |
| `data-slot`                            | `'mask-input'`                |
| `data-disabled` / `-invalid` / `-readonly` / `-required` | `'' \| undefined` |
| `aria-invalid`                         | `boolean`                     |
| `class`                                | `string`                      |
| `value`                                | `string`                      |
| `placeholder`                          | `string \| undefined`         |
| `disabled` / `readonly` / `required`   | `boolean`                     |
| `maxlength`                            | `number \| undefined`         |
| `inputmode`                            | `'numeric' \| 'decimal' \| undefined` |
| `min` / `max`                          | `string \| number \| undefined` |
| `oninput` / `onfocus` / `onblur` / `onkeydown` / `onpaste` / `oncompositionstart` / `oncompositionend` | event handlers |
| …`restProps`                           | `Record<string, unknown>`     |

Handlers resolve their element from `event.currentTarget`, never from `ref` (research R-08), so the
`child` path behaves identically to the default path.

## 7. Caret model

Two coordinate spaces, converted by the engine:

- **masked index** — a character offset into the displayed string (what `selectionStart` speaks).
- **unmasked index** — how many fillable slots precede the caret.

`toUnmaskedIndex({ masked, pattern, caret })` → unmasked index.
`fromUnmaskedIndex({ masked, pattern, unmaskedIndex })` → masked index **after** that slot.

Round-trip invariant asserted by tests: for `pattern = "(###) ###-####"`,
`toUnmaskedIndex(caret: 9) === 6` and `fromUnmaskedIndex(unmaskedIndex: 6) === 9`.

Caret solvers, selected by pattern shape:

| Pattern contains | Solver                      | Rule                                                                  |
| ---------------- | --------------------------- | --------------------------------------------------------------------- |
| `€ $ %`          | `getCurrencyCaretPosition`  | Preserve the digit count before the old caret; else end (or before a trailing currency glyph when the locale puts it last). |
| anything else    | `getPatternCaretPosition`   | Map the old caret to an unmasked index, clamp to the new unmasked length, map back. |

Post-solve clamps (upstream lines 1068-1084), applied in this order:

1. currency mask ⇒ `max(1, pos)` (skip a leading symbol), except when the locale puts the symbol last;
2. `%` pattern ⇒ `min(newValue.length - 1, pos)` (stay left of the `%`);
3. always ⇒ `min(pos, newValue.length)`.
