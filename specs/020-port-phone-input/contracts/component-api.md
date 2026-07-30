# Contract: `phone-input` public component API

**Feature**: `020-port-phone-input` | Derived from
`.reference/diceui/docs/registry/bases/radix/ui/phone-input.tsx`,
`docs/types/radix/phone-input.ts` and `docs/content/docs/components/radix/phone-input.mdx` @ `d9763d8`.

Import styles both supported:

```ts
import * as PhoneInput from '$lib/components/ui/phone-input/index.js'; // PhoneInput.Root, .CountrySelect, .Field
import { PhoneInput, PhoneInputCountrySelect, PhoneInputField } from '$lib/components/ui/phone-input/index.js';
```

Composition (upstream "Layout" section, unchanged):

```svelte
<PhoneInput.Root>
	<PhoneInput.CountrySelect />
	<PhoneInput.Field />
</PhoneInput.Root>
```

---

## `PhoneInput.Root` — `phone-input.svelte`

Renders `<div role="group" data-slot="phone-input">` plus, inside a `<form>`, one hidden input.

Type: `PhoneInputRootProps = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & { … }`
(alias `PhoneInputProps`, matching upstream's exported name).

| Prop | Type | Default | Bindable | Notes |
| --- | --- | --- | --- | --- |
| `value` | `string` | — | ✅ | Controlled canonical value (digits, `+`-prefixed) |
| `defaultValue` | `string` | `''` | — | Seeds `value` once when uncontrolled |
| `onValueChange` | `(value: string) => void` | — | — | Fires on every actual change, both modes |
| `country` | `string` | — | ✅ | Controlled ISO 3166-1 alpha-2 code |
| `defaultCountry` | `string` | `''` | — | Upstream's type file documents `"US"`; the implementation falls back to `""` (research R-04) |
| `onCountryChange` | `(country: string) => void` | — | — | Fires on manual selection **and** on auto-detection |
| `countries` | `Country[]` | `getCountries()` | — | 239 built-in entries (one per `COUNTRY_DATA` row), display-name sorted |
| `name` | `string` | — | — | Field name for the hidden form input |
| `placeholder` | `string` | `'Enter phone number'` | — | Wins over a `placeholder` set on `Field` (research R-12) |
| `disabled` | `boolean` | `false` | — | Disables trigger + field; sets `[data-disabled]` |
| `readOnly` | `boolean` | `false` | — | Field focusable but not editable; sets `[data-readonly]` |
| `required` | `boolean` | `false` | — | `aria-required` on the field, `required` on the hidden input |
| `invalid` | `boolean` | `false` | — | `aria-invalid` on the field; sets `[data-invalid]` |
| `showFlag` | `boolean` | `true` | — | Hides flags on trigger and list items when `false` |
| `id` | `string` | `$props.id()` | — | Applied to the root element |
| `ref` | `HTMLDivElement \| null` | `null` | ✅ | Replaces `forwardRef` |
| `class` | `string` | — | — | Merged last through `cn()` |
| `children` | `Snippet` | — | — | The parts |
| `child` | `Snippet<[{ props: PhoneInputChildProps }]>` | — | — | Replaces upstream `asChild` |
| `...restProps` | `HTMLAttributes<HTMLDivElement>` | — | — | Spread after `role`/`data-*`/`id`, so callers can override them |

Data attributes (upstream `DataAttributesTable`, presence-based):

| Attribute | Present when |
| --- | --- |
| `[data-slot="phone-input"]` | always |
| `[data-disabled]` | `disabled` |
| `[data-invalid]` | `invalid` |
| `[data-readonly]` | `readOnly` |

Hidden form input: `<input type="hidden" data-slot="phone-input-form-input" tabindex="-1">` carrying
`name`, the canonical value, `disabled`, `required`, `readonly`. Rendered only when the root is inside a
`<form>` (or before mount); a bubbling `input` event is dispatched on every value change.

## `PhoneInput.CountrySelect` — `phone-input-country-select.svelte`

Renders `Popover.Root` → `Popover.Trigger` (`data-slot="phone-input-country-select"`) → `Popover.Content`
→ `Command.Root` / `Command.Input` / `Command.List` / `Command.Empty` / `Command.Group` /
`Command.Item`.

| Prop | Type | Default | Bindable | Notes |
| --- | --- | --- | --- | --- |
| `open` | `boolean` | root state (`false`) | ✅ | A caller-supplied value overrides the internal state (upstream spread order, research R-12) |
| `onOpenChange` | `(open: boolean) => void` | — | — | Composed with the internal handler, never replaced |
| `onOpenChangeComplete` | `(open: boolean) => void` | — | — | Pass-through to `Popover.Root` |
| `disabled` | `boolean` | — | — | OR-ed with the root's `disabled` |
| `ref` | `HTMLButtonElement \| null` | `null` | ✅ | The trigger element |
| `class` | `string` | — | — | Merged last onto the trigger |
| `...restProps` | remaining `Popover.RootProps` | — | — | Spread onto `Popover.Root` |

Not ported: `children` (upstream destructures and discards it) and the `asChild` of its documented
`CompositionProps` (never read by the implementation) — research R-11.

Trigger contents: the selected country's flag when `showFlag` and a `flag` exist; otherwise a
`h-4 w-6 rounded-sm bg-muted/50` placeholder swatch when no country matches; always a trailing
`ChevronDown` (`@lucide/svelte/icons/chevron-down`, `size-4 opacity-50`).

List contents, one `Command.Item` per country, in `countries` order:
`value={`${name} ${dialCode} ${code}`}` (so search matches name, dial code or ISO code),
`data-checked` when it is the selected country (drives the shadcn check mark),
flag (when `showFlag`), name (`flex-1`), dial code (`text-muted-foreground`).
Search placeholder `"Search country..."`, empty state `"No country found."` — both fixed, as upstream.

Selecting an item sets the country, closes the popover and returns focus to the field.

## `PhoneInput.Field` — `phone-input-field.svelte`

Renders the repo's `<Input>` with `type="tel"`, `inputmode="tel"`, `data-slot="phone-input-field"`.

| Prop | Type | Default | Bindable | Notes |
| --- | --- | --- | --- | --- |
| `disabled` | `boolean` | — | — | OR-ed with the root's |
| `readOnly` | `boolean` | — | — | OR-ed with the root's |
| `required` | `boolean` | — | — | OR-ed with the root's |
| `oninput` | `(event: Event & { currentTarget: HTMLInputElement }) => void` | — | — | Upstream's `onChange`: runs first; if it calls `preventDefault()` the edit is discarded |
| `ref` | `HTMLInputElement \| null` | `null` | ✅ | Also registered with the root for focus return |
| `class` | `string` | — | — | Merged last |
| `...restProps` | `Omit<HTMLInputAttributes, 'value' \| 'type' \| 'readonly' \| 'files'>` | — | — | Spread *after* the overridable attributes and *before* the owned ones, matching upstream's JSX order |

Owned (caller cannot override): `class`, `value` (the formatted display value), `placeholder` (from the
root) and the internal `oninput` — all emitted after `...restProps`.

Overridable through `...restProps` (emitted *before* it): `inputmode`, `aria-required`, `aria-invalid`
and `data-slot`. `disabled`, `readonly` and `required` are emitted there too, but a caller reaches them
through the named props above — which are OR-ed with the root's, never replaced. `value`, `type`,
`readonly` and `files` are removed from `PhoneInputFieldProps` outright, so `type="tel"` is settled by
the type rather than by the spread order.

ARIA: `aria-required` from `required`, `aria-invalid` from the root's `invalid`. Accessible name comes
from the consumer's `<label for>` / `aria-label` — upstream ships none, so neither does the port.

## Keyboard contract (upstream `KeyboardShortcutsTable`)

| Key | Where | Result |
| --- | --- | --- |
| `Tab` / `Shift+Tab` | root | Moves between the country trigger and the field, in logical order |
| `Space`, `Enter` | trigger | Opens the dropdown |
| `Escape` | open dropdown | Closes it, selection unchanged, focus returns to the trigger |
| `ArrowDown` / `ArrowUp` | open dropdown | Moves the highlighted country |
| `Home` / `End` | open dropdown | Jumps to the first / last country |
| `Enter` | open dropdown | Selects the highlighted country, closes, focus moves to the field |
| printable characters | open dropdown | Filters by name, dial code or ISO code |
| any digit / `+` | field | Appends to the canonical value and re-formats the display |
| `Backspace` / `Delete` | field | Removes characters and re-formats from the remaining digits |

`dir="rtl"`: layout order follows logical `start`/`end` (`rounded-s-*`, `border-e`), and no key mapping
changes — the widget has no left/right navigation to invert (FR-013).

## Barrel exports (`index.ts`)

Components: `Root`, `CountrySelect`, `Field` and the aliases `PhoneInput`, `PhoneInputCountrySelect`,
`PhoneInputField`.

Types: `PhoneInputRootProps`, `PhoneInputProps`, `PhoneInputChildProps`,
`PhoneInputCountrySelectProps`, `PhoneInputFieldProps`, `Country`, `PhoneInputRootStateProps`.

State: `PhoneInputRootState`, `setPhoneInputContext`, `getPhoneInputContext`, `hasPhoneInputContext`.

Engine (the reuse surface — see `contracts/phone-engine.md`): `COUNTRY_DATA`, `getCountries`,
`getCountryName`, `getFlagEmoji`, `detectCountryFromNumber`, `formatPhoneNumber`,
`normalizePhoneInput`, `DEFAULT_PHONE_PLACEHOLDER`.
