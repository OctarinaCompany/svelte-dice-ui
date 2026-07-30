# Contract: `phone-engine.ts` — the pure reuse surface

**Feature**: `020-port-phone-input`

`src/lib/components/ui/phone-input/phone-engine.ts` holds the country table and every pure function the
component needs. It contains **no runes and no DOM access**, so it is safe on the server and importable
by a later port (a country picker, an international address field, a `phone-number` validator) without
rendering anything — the same arrangement `mask-input/mask-engine.ts` and
`segmented-input/segment-navigation.svelte.ts` established.

It imports `getUnmaskedValue` from `$lib/components/ui/mask-input/index.js` for digit extraction
(research R-02) and nothing else.

---

## Types

```ts
export type Country = {
	/** ISO 3166-1 alpha-2 country code */
	code: string;
	/** Country name */
	name: string;
	/** Country calling code (e.g., "+1" for US) */
	dialCode: string;
	/** Optional flag emoji */
	flag?: string;
};
```

## Constants

| Export | Type | Value |
| --- | --- | --- |
| `COUNTRY_DATA` | `readonly (readonly [string, string])[]` | Upstream's 218-row `[iso2, dialCode]` table, verbatim and in upstream order |
| `DEFAULT_PHONE_PLACEHOLDER` | `string` | `'Enter phone number'` |

## Functions

### `getCountryName(countryCode: string, locale?: string): string`

`Intl.DisplayNames([locale], { type: 'region' }).of(countryCode)`, returning `countryCode` when the
lookup returns `undefined` or throws. `locale` defaults to `'en'`, exactly as upstream (no prop exposes
it — spec Assumptions).

### `getFlagEmoji(countryCode: string): string`

Upper-cases the code and maps each char to `127397 + charCodeAt(0)`, returning
`String.fromCodePoint(...)` — the regional-indicator pair.

### `getCountries(): Country[]`

Maps `COUNTRY_DATA` to `Country` (upper-cased `code`, `Intl` `name`, `+`-prefixed `dialCode`, emoji
`flag`) and sorts by `name.localeCompare`. Memoised: repeated calls return the same array reference
(research R-01). Callers must not mutate it.

### `detectCountryFromNumber(value: string, countries: Country[]): Country | undefined`

| Input | Output |
| --- | --- |
| value not starting with `+` | `undefined` |
| `'+'` or `'+abc'` (no digits) | `undefined` |
| digits matching no dial code | `undefined` |
| exactly one prefix match | that country |
| several matches, best match `+1`, list contains `US` | the `US` entry |
| several matches, otherwise | the longest-dial-code match |

Matching scans a **copy** of `countries` sorted by descending `dialCode` length; the input array is
never mutated.

### `formatPhoneNumber(value: string, countries: Country[]): string`

| Input | Output |
| --- | --- |
| `''` | `''` |
| `'+'` / `'abc'` | `'+'` |
| `'+1'` | `'+1'` |
| `'+14085551234'` | `'+1 408 555 123 4'` |
| `'14085551234'` | `'+1 408 555 123 4'` (a missing `+` is prepended) |
| `'+442071234567'` | `'+44 207 123 456 7'` |
| `'+123'` (no match) | `'+123'` (3-digit dial-code guess, empty remainder) |
| `'+12'` (no match) | `'+12'` (guess is `min(digits.length, 3)`) |

Grouping is a space every three digits of the remainder — deliberately *not* a national format
(upstream applies no per-country grouping table).

### `normalizePhoneInput(raw: string): { value: string; startsWithPlus: boolean }`

The field's edit normalisation, extracted so it is testable without rendering:

| `raw` | `value` | `startsWithPlus` |
| --- | --- | --- |
| `''` | `''` | `false` |
| `'+'` | `'+'` | `true` |
| `'abc'` | `''` | `false` |
| `'(408) 555-1234'` | `'+4085551234'` | `false` |
| `'+1 408'` | `'+1408'` | `true` |

## Invariants the tests pin

1. Every function is pure: same inputs → same output, no argument mutated, no global touched.
2. `formatPhoneNumber(normalizePhoneInput(x).value, countries)` never throws for any string `x`.
3. `getCountries()` returns 218 entries, each with a unique `code`, all `dialCode`s starting with `+`.
4. `detectCountryFromNumber('+1' + rest, getCountries())?.code === 'US'` for every `rest` that does not
   itself match a longer `+1…` dial code.
