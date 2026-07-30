# Phase 1 Data Model: Phone Input

**Feature**: `020-port-phone-input` | **Date**: 2026-07-30

Two entities from the spec (`Country`, *phone value*) plus the runtime state that carries them.

---

## 1. `Country` — one selectable dropdown entry

Declared in `phone-engine.ts`, re-exported from the barrel. Identical to upstream's `Country`
interface, JSDoc included.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `code` | `string` | yes | ISO 3166-1 alpha-2, **upper-case** (`getCountries()` upper-cases the table's `iso2`) |
| `name` | `string` | yes | `Intl.DisplayNames(['en'], { type: 'region' }).of(code)`, falling back to `code` |
| `dialCode` | `string` | yes | `+`-prefixed calling code, e.g. `"+1"`, `"+44"`, `"+1684"` |
| `flag` | `string \| undefined` | no | Regional-indicator emoji derived from `code`; a caller-supplied list may omit it |

**Validation rules**

- Not validated at runtime — upstream accepts any `Country[]` the caller passes (the custom-countries
  demo hand-writes four entries).
- `code` comparisons are strict `===` against the selected-country string, so a caller mixing case
  simply never matches (upstream behaviour).
- Duplicate `dialCode`s are expected (`+1` is shared by 20+ entries, `+44` by 4, `+590` by 3).

**Built-in list** — `getCountries()`

- Source: the 218-row `COUNTRY_DATA: [iso2, dialCode][]` table transcribed from upstream.
- Derivation: `code = iso2.toUpperCase()`, `name = getCountryName(code)`, `dialCode = "+" + dialCode`,
  `flag = getFlagEmoji(code)`.
- Ordering: `sort((a, b) => a.name.localeCompare(b.name))` — display-name order (FR-004).
- Memoised in a module-level cache (R-01); the returned array is the same reference on every call, so
  the root's `countries` default is reference-stable across instances.

## 2. Phone value — canonical vs. display

Two distinct strings; only the canonical one is ever reported to the caller or submitted.

| | Canonical (`value`) | Display (field's `value` attribute) |
| --- | --- | --- |
| Shape | `""`, `"+"`, or `"+"` followed by digits only | `""`, `"+"`, or `"+<dialCode> <ddd> <ddd> …"` |
| Owner | root state / the caller's binding | derived, never stored |
| Produced by | `normalizePhoneInput(raw)` | `formatPhoneNumber(value, countries)` |
| Reported through | `value` binding, `onValueChange`, hidden form input | nothing — display only |

**Normalisation** (`normalizePhoneInput`, upstream `PhoneInputField.onChange` lines 769-775)

```
startsWithPlus = raw.startsWith('+')
digits         = raw with every non-digit removed
value          = digits ? '+' + digits : startsWithPlus ? '+' : ''
```

So `"(408) 555-1234"` → `"+4085551234"`, `"+"` → `"+"`, `"abc"` → `""`.

**Formatting** (`formatPhoneNumber`, upstream lines 344-373)

1. `""` → `""`.
2. Prepend `+` if missing; strip non-digits from the remainder. No digits → `"+"`.
3. Detect the country from `"+" + digits`; `dialCodeLength` = the detected dial code's digit count, or
   `min(digits.length, 3)` when nothing matches.
4. `"+" + digits.slice(0, dialCodeLength)`, then, if a remainder exists, a space and the remainder
   grouped in threes separated by spaces.

Examples pinned by the tests: `"+14085551234"` → `"+1 408 555 123 4"`; `"+442071234567"` →
`"+44 207 123 456 7"`; `"+123"` → `"+123"` (no country match, 3-digit guess, no remainder).

**Detection** (`detectCountryFromNumber`, upstream lines 313-342)

1. Returns `undefined` unless the argument starts with `+` and has at least one digit after it.
2. Candidate countries are those whose `dialCode` (minus `+`) is a prefix of the digits, scanned over a
   copy of `countries` sorted by **descending** `dialCode` length — longest match first.
3. No candidate → `undefined` (the current selection is left alone, spec US3 AS-4).
4. More than one candidate **and** the best match is `+1` → prefer the entry whose `code` is `US`
   (spec US3 AS-3); otherwise the first (longest) match wins.

## 3. `PhoneInputRootState` — the runtime state (`phone-input.svelte.ts`)

Replaces upstream's `Store` + `StoreContext` + `PhoneInputContext` (R-03). Constructed by the root,
shared through a `Symbol` context key.

### Reactive fields

| Field | Rune | Initial | Written by |
| --- | --- | --- | --- |
| `open` | `$state<boolean>` | `false` | country select (trigger, item select, escape/outside) |
| `startsWithPlus` | `$state<boolean>` | `initialValue.startsWith('+')` | field input handler only (R-06) |
| `fieldElement` | `$state<HTMLInputElement \| null>` | `null` | field (`bind:ref`), read for focus return |

### Getter-backed inputs (passed in as functions, never snapshots)

`getValue`, `setValue`, `getCountry`, `setCountry`, `getCountries`, `getPlaceholder`, `getDisabled`,
`getReadOnly`, `getRequired`, `getInvalid`, `getShowFlag`, `getName`, `id`.

### Derived

| Member | Type | Definition |
| --- | --- | --- |
| `value` | `string` | `getValue()` |
| `country` | `string` | `getCountry()` |
| `countries` | `Country[]` | `getCountries()` |
| `displayValue` | `string` | `formatPhoneNumber(value, countries)` |
| `selectedCountry` | `Country \| undefined` | `countries.find((c) => c.code === country)` |

### Methods

| Method | Behaviour |
| --- | --- |
| `setValueFromInput(raw)` | no-op while `disabled \|\| readOnly`; sets `startsWithPlus`, then `setValue(normalizePhoneInput(raw))` |
| `selectCountry(code)` | `setCountry(code)`, closes the popover, flags the close as selection-driven |
| `detectCountry()` | the effect body in R-05, called from the root's single `$effect` |
| `focusField()` | focuses `fieldElement` if present |
| `consumeSelectionClose()` | returns and clears the "closed by selection" flag, used by `onCloseAutoFocus` |

### State transitions

```
                     type digits / paste            select country
   value "" ──────────────────────────────▶ value "+…" ──────────────▶ country = code
        ▲                                     │                            │
        │ clear field                         │ $effect: detect            │ $effect re-runs;
        └─────────────────────────────────────┘ (only when                 │ a detectable value
                                                 startsWithPlus            └─▶ may snap country
                                                 or digits ≥ 10)               back (R-05 quirk 2)

   open false ──trigger click / Space / Enter──▶ open true
   open true  ──Escape / outside click────────▶ open false, focus → trigger
   open true  ──item select─────────────────▶ open false, focus → field
```

## 4. Context

| Key | Value | Consumers | Error when missing |
| --- | --- | --- | --- |
| `Symbol('phone-input')` | `PhoneInputRootState` | `PhoneInputCountrySelect`, `PhoneInputField` | ``​`<PhoneInput.CountrySelect>` must be used within `<PhoneInput.Root>`.`` (part name substituted) |

`getPhoneInputContext(consumerName)` throws; `hasPhoneInputContext()` is exported for callers that want
to branch. Both mirror `checkbox-group`.

## 5. Form data

| Element | Rendered when | Attributes |
| --- | --- | --- |
| `<input type="hidden" data-slot="phone-input-form-input">` | `FormControlState.isFormControl` (no element yet, or an ancestor `<form>` exists) | `name`, `value` = canonical value, `disabled`, `required`, `readonly`, `tabindex="-1"` |

On every canonical-value change the root re-asserts `element.value` and dispatches a bubbling `input`
event, so form libraries observing the form see the change (R-10).
