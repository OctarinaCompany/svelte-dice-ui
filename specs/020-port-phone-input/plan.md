# Implementation Plan: Port Phone Input

**Branch**: `020-port-phone-input` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-port-phone-input/spec.md`

## Summary

Port Dice UI's `phone-input` (radix base) to Svelte 5 as a three-part compound component: a root that
owns the canonical phone value and the selected country, a country picker composed from the repo's
`popover` + `command`, and a `tel` field that formats as you type. Upstream's `Store` +
`useSyncExternalStore` plumbing collapses into one `PhoneInputRootState` class shared through a
`Symbol`-keyed context; the pure country/format/detect logic moves into a rune-free `phone-engine.ts`
that reuses `mask-input`'s digit extraction and becomes the reuse surface for later ports. No new npm
dependency: the country table is upstream's own inline `[iso2, dialCode]` transcription plus
`Intl.DisplayNames`, exactly as upstream (research R-01).

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`), Svelte 5.56 with runes forced on

**Primary Dependencies**: SvelteKit 2, `bits-ui` 2.18 (`Popover`, `Command`), `@lucide/svelte`
(`chevron-down`), Tailwind CSS v4, `tailwind-merge`/`clsx` via `cn()`. Repo components composed:
`popover`, `command`, `input`, and `mask-input` + `checkbox-group` for their exported helpers.
**Zero new npm packages.**

**Storage**: N/A

**Testing**: Vitest 4 (jsdom, `globals: false`, `expect.requireAssertions`) +
`@testing-library/svelte` 5 + `@testing-library/user-event` 14, colocated at
`src/lib/components/ui/phone-input/phone-input.test.ts` with a `phone-input.test.svelte` harness

**Target Platform**: Browser (SSR-safe: `phone-engine.ts` touches no DOM; the root's form detection and
DOM writes live in `$effect`, which never runs on the server)

**Project Type**: shadcn-svelte registry component (source-distributed) inside a SvelteKit docs app

**Performance Goals**: 239-item dropdown filters and scrolls without jank — bits-ui `Command` owns
filtering/virtual highlight; `getCountries()` is memoised so the 239 `Intl.DisplayNames` lookups happen
once per page, not once per render (research R-01)

**Constraints**: No `any`, no suppressions, no `dark:` classes, no new dependencies, no git writes; the
demo route must build; all four quality gates green

**Scale/Scope**: 3 components + 1 state module + 1 engine module + 1 barrel; 239-row country table;
1 demo route with 3 examples + 3 props tables; 1 registry entry

## Constitution Check

_GATE: passed before Phase 0 research; re-checked after Phase 1 design (see Post-Design Re-check)._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                        |
| ---- | ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$effect`/`$props`/`$bindable` + snippets only; behaviour in `phone-input.svelte.ts` (state class, getter-function inputs); no stores, `export let`, dispatchers or slots |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | All of `phone-input.tsx`, the MDX, `types/radix/phone-input.ts`, all three demo files and `visually-hidden-input.tsx` read at `d9763d8`; every prop, callback, data attribute and keyboard key mapped in `contracts/component-api.md`; nine divergences recorded (spec Assumptions + research R-04, R-07, R-08, R-09, R-10, R-11, R-12, R-13, R-15) |
| III  | Accessibility Is a MUST             | PASS    | `role="group"` root, native `<button>` trigger, bits-ui `Command` listbox/option roles, `aria-required`/`aria-invalid` on the field; keyboard table reproduced key-for-key (R-07); RTL via logical properties; tests cover roles, keyboard, controlled/uncontrolled, guard rails, and the throwing context |
| IV   | Composition Over Reimplementation   | PASS    | `popover` + `command` + `input` for the whole dropdown and field; `FormControlState` from `checkbox-group`; `getUnmaskedValue` from `mask-input`; bespoke list below |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder, one part per file, `<slug>.svelte.ts`, `index.ts` barrel with short + prefixed names and types, `.js` extensions on intra-repo imports, one `registry:ui` entry, no import from `src/routes/**` or `$lib/components/docs/**` |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Prop types in `<script lang="ts" module>` built on `WithElementRef<HTMLAttributes<…>>`; no `any`, no ignore comments, no config edits |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit -- --run` → `build` scheduled as the final task; no skipped/`.todo` tests |
| VIII | Styling Discipline                  | PASS    | `cn()` only, semantic tokens only, **zero `dark:` classes** (R-13), `data-slot` on every part, presence-based `data-*` (with one documented exception: `data-checked="true"` on the selected country item, R-07, required by the repo's existing `command-item` selector), caller `class` merged last |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/phone-input/+page.svelte` with one `<ComponentPreview>` per upstream example (`phone-input-demo`, `phone-input-custom-countries-demo`, `phone-input-form-demo`) plus props tables |
| X    | One Feature Directory Per Component | PASS    | All planning artifacts in `specs/020-port-phone-input/`; no git write commands; no writes to `.reference/`, `scripts/`, `.port-*` |

**Bespoke behaviour justification (Principle IV)** — four items, each with the primitive evaluated:

1. **Country detection + international formatting** (`phone-engine.ts`). Evaluated
   `mask-input`'s engine: `applyMask` formats against a *static* slot pattern, but the split point here
   is the detected country's dial-code length and the remainder is unbounded, so no `MaskPattern` can
   express it. Only digit extraction overlaps, and that is reused via `getUnmaskedValue` (R-02).
   bits-ui has no phone/number-formatting primitive.
2. **Country metadata table**. No primitive supplies ISO/dial-code data; upstream inlines it and so do
   we (R-01).
3. **Hidden form input + value-change dispatch**. Evaluated bits-ui `HiddenInput`: it has no
   ancestor-`<form>` detection and does not dispatch a native `input` event on change, which form
   libraries rely on. `FormControlState` from `checkbox-group` — written for exactly this reuse — is
   composed rather than re-authored; only the `<input type="hidden">` element and its sync effect are
   local (R-10).
4. **One-way value re-assertion on the field**. Evaluated `bind:value`: a second writer cannot reproduce
   React's "controlled input snaps back" behaviour for rejected characters. A DOM-only `$effect`
   re-asserts `element.value` (R-09). No caret logic is added — upstream has none.

Everything else — popover positioning, dismissal, focus scope, list filtering, highlight movement,
`Home`/`End`, portal, scroll lock — is bits-ui's.

## Project Structure

### Documentation (this feature)

```text
specs/020-port-phone-input/
├── plan.md                      # This file
├── spec.md                      # Input
├── research.md                  # Phase 0 — R-01…R-15
├── data-model.md                # Phase 1 — Country, phone value, state class, context, form data
├── contracts/
│   ├── component-api.md         # Phase 1 — public component contract (props, data attrs, keyboard)
│   └── phone-engine.md          # Phase 1 — pure reuse-surface contract
├── quickstart.md                # Phase 1 — how to validate the port end to end
├── checklists/requirements.md   # from /speckit-specify
└── tasks.md                     # Phase 2 — /speckit-tasks, NOT created here
```

### Source Code (repository root)

```text
src/lib/components/ui/phone-input/
├── index.ts                          # barrel: components + aliases + types + state + engine
├── phone-input.svelte                # Root       ← PhoneInput            (phone-input.tsx:463-633)
├── phone-input-country-select.svelte # Country    ← PhoneInputCountrySelect (phone-input.tsx:642-729)
├── phone-input-field.svelte          # Field      ← PhoneInputField       (phone-input.tsx:731-805)
├── phone-input.svelte.ts             # PhoneInputRootState + Symbol context
│                                     #   ← Store/StoreContext/PhoneInputContext (phone-input.tsx:377-443)
├── phone-engine.ts                   # COUNTRY_DATA + pure helpers, rune-free
│                                     #   ← phone-input.tsx:31-373
├── phone-input.test.svelte           # harness (bindings, form ancestor, RTL, bare parts) — not in registry
└── phone-input.test.ts               # colocated tests — not in registry

src/routes/docs/components/phone-input/
└── +page.svelte                      # 3 ComponentPreview sections + props tables

registry.json                         # append exactly one registry:ui entry
static/r/phone-input.json             # generated by `pnpm run registry:build`
```

**Structure Decision**: folder slug `phone-input` == demo route segment == registry item name. Upstream's
single 813-line file splits into three parts plus two modules, per Principle V. `visually-hidden-input.tsx`,
`compose-refs.ts`, `use-as-ref.ts`, `use-lazy-ref.ts` and `use-isomorphic-layout-effect.ts` have no ported
counterparts — they are React ref/effect plumbing replaced by `$bindable` + `$effect` (spec Assumptions),
and their one behavioural part (form-presence detection) is composed from `checkbox-group`'s
`FormControlState`.

## Public API

Full tables live in `contracts/component-api.md`; this is the authoritative summary derived from
`phone-input.tsx` and `docs/types/radix/phone-input.ts`.

### Exported components

| Barrel name | Alias | File | Renders |
| --- | --- | --- | --- |
| `Root` | `PhoneInput` | `phone-input.svelte` | `<div role="group" data-slot="phone-input">` + optional hidden form input |
| `CountrySelect` | `PhoneInputCountrySelect` | `phone-input-country-select.svelte` | `Popover` + `Command` dropdown, trigger `data-slot="phone-input-country-select"` |
| `Field` | `PhoneInputField` | `phone-input-field.svelte` | repo `<Input type="tel" data-slot="phone-input-field">` |

### `PhoneInputRootProps` (alias `PhoneInputProps`)

| Prop | Type | Default | Bindable |
| --- | --- | --- | --- |
| `value` | `string` | — | ✅ |
| `defaultValue` | `string` | `''` | — |
| `onValueChange` | `(value: string) => void` | — | — |
| `country` | `string` | — | ✅ |
| `defaultCountry` | `string` | `''` (upstream types say `"US"`; the source falls back to `""` — R-04) | — |
| `onCountryChange` | `(country: string) => void` | — | — |
| `countries` | `Country[]` | `getCountries()` | — |
| `name` | `string` | — | — |
| `placeholder` | `string` | `'Enter phone number'` | — |
| `disabled` | `boolean` | `false` | — |
| `readOnly` | `boolean` | `false` | — |
| `required` | `boolean` | `false` | — |
| `invalid` | `boolean` | `false` | — |
| `showFlag` | `boolean` | `true` | — |
| `id` | `string` | `$props.id()` | — |
| `ref` | `HTMLDivElement \| null` | `null` | ✅ |
| `class` | `string` | — | — |

**Snippets**: `children: Snippet` (the parts); `child: Snippet<[{ props: PhoneInputChildProps }]>`
(replaces `asChild`). **Callbacks**: `onValueChange`, `onCountryChange` — plus every
`HTMLAttributes<HTMLDivElement>` handler through `...restProps`.
**Data attributes**: `data-slot="phone-input"`, `data-disabled`, `data-invalid`, `data-readonly`.

### `PhoneInputCountrySelectProps`

| Prop | Type | Default | Bindable |
| --- | --- | --- | --- |
| `open` | `boolean` | root state (`false`) | ✅ |
| `onOpenChange` | `(open: boolean) => void` | — | — |
| `onOpenChangeComplete` | `(open: boolean) => void` | — | — |
| `disabled` | `boolean` | — | — |
| `ref` | `HTMLButtonElement \| null` | `null` | ✅ |
| `class` | `string` | — | — |

**Snippets**: none — upstream destructures `children` and discards it, and its documented `asChild`
is never read (R-11). **Callbacks**: `onOpenChange`, `onOpenChangeComplete`; selection fires the root's
`onCountryChange`.

### `PhoneInputFieldProps`

| Prop | Type | Default | Bindable |
| --- | --- | --- | --- |
| `disabled` | `boolean` | — | — |
| `readOnly` | `boolean` | — | — |
| `required` | `boolean` | — | — |
| `oninput` | `(event: Event & { currentTarget: HTMLInputElement }) => void` | — | — |
| `ref` | `HTMLInputElement \| null` | `null` | ✅ |
| `class` | `string` | — | — |

Applied **before** `...restProps` (caller-overridable): `type="tel"`, `inputmode="tel"`, `aria-required`,
`aria-invalid`, `data-slot="phone-input-field"`, `disabled`, `readonly`, `required`. Applied **after**
`...restProps` (owned, not overridable): `class` (merged via `cn()`), `placeholder` (the root's), and
`value` (the formatted display value, one-way bound, never `bind:value`). **Snippets**: none.
**Callbacks**: `oninput` runs before the internal handler and can cancel the edit with `preventDefault()`
(upstream's `defaultPrevented` check).

### Exported types and helpers

`Country`, `PhoneInputRootProps`, `PhoneInputProps`, `PhoneInputChildProps`,
`PhoneInputCountrySelectProps`, `PhoneInputFieldProps`, `PhoneInputRootStateProps`;
`PhoneInputRootState`, `setPhoneInputContext`, `getPhoneInputContext`, `hasPhoneInputContext`.

### Shared module exported for later components (deliverable 5)

`phone-engine.ts`, re-exported from the barrel and installable through the registry entry:
`COUNTRY_DATA`, `getCountries`, `getCountryName`, `getFlagEmoji`, `detectCountryFromNumber`,
`formatPhoneNumber`, `normalizePhoneInput`, `DEFAULT_PHONE_PLACEHOLDER`, `type Country`. Rune-free and
DOM-free, so a future country picker or international address field can import it without rendering a
phone field — the arrangement `mask-engine.ts` and `segment-navigation.svelte.ts` already use. Contract:
`contracts/phone-engine.md`.

## Implementation Sequence

Scheduled work, in dependency order (`/speckit-tasks` turns these into tasks):

1. **`phone-engine.ts`** — `COUNTRY_DATA` (239 rows, verbatim), `getCountryName`, `getFlagEmoji`,
   memoised `getCountries`, `detectCountryFromNumber`, `formatPhoneNumber`, `normalizePhoneInput`,
   `DEFAULT_PHONE_PLACEHOLDER`, importing `getUnmaskedValue` from `mask-input`.
2. **`phone-input.svelte.ts`** — `PhoneInputRootState` (fields, derived, methods per `data-model.md`),
   `Symbol('phone-input')` key, `setPhoneInputContext` / `getPhoneInputContext(consumerName)` (throws
   ``​`<X>` must be used within `<PhoneInput.Root>`.``) / `hasPhoneInputContext`.
3. **`phone-input.svelte`** — props + JSDoc copied from upstream's type file, `value ??= untrack(…)`
   seeding for both pairs, state construction, the detection `$effect` (R-05 verbatim), `FormControlState`
   + hidden input + `input`-event dispatch effect, root markup with `child` snippet support.
4. **`phone-input-field.svelte`** — composed `<Input>`, owned attributes after `...restProps`, input
   handler (guard → caller `oninput` → `defaultPrevented` → normalise), DOM re-assert effect,
   registration of its element with the root.
5. **`phone-input-country-select.svelte`** — `Popover` + `Command` composition, trigger content
   (flag / swatch / chevron), item list with `data-checked`, `onCloseAutoFocus` focus return.
6. **`index.ts`** — barrel exactly as in the Public API section.
7. **`phone-input.test.svelte` + `phone-input.test.ts`** — see Testing below.
8. **`src/routes/docs/components/phone-input/+page.svelte`** — three previews + props tables.
9. **`registry.json` entry + `pnpm run registry:build`**.
10. **Quality gates**: `pnpm run format`, `pnpm run check`, `pnpm run lint`,
    `pnpm run test:unit -- --run`, `pnpm run build` — all green, nothing suppressed.

## Testing Plan

`phone-input.test.ts` (Vitest, explicit imports) + `phone-input.test.svelte` harness. Areas, mapped to
constitution III and spec requirements:

| Area | Cases |
| --- | --- |
| Engine (pure) | every row of the tables in `contracts/phone-engine.md`: format, detect, `+1`→US tie-break, no-match → `undefined`, normalisation, `getCountries()` shape/ordering/memoisation, no argument mutation |
| Roles & ARIA | root `role="group"`; field `type="tel"`, `inputmode="tel"`, `aria-required`, `aria-invalid`; trigger is a button with `aria-expanded`; open list exposes options; `data-slot` on all three parts |
| Uncontrolled | `defaultValue` seeds the display; typing updates it; `defaultCountry` shows that flag |
| Controlled | `value` + `onValueChange` (parent authoritative, component does not move on its own); function binding that declines a write; `country` + `onCountryChange` |
| Formatting | type `14085551234` → display `+1 408 555 123 4`, canonical `+14085551234`; paste with punctuation; deletion re-formats; letters are rejected and the DOM value snaps back (R-09) |
| Detection | `+33612…` selects FR; `+44207…` selects `GG`, the first `+44` entry in display-name order (the `US` tie-break is hard-coded to `+1`, so shared non-`+1` dial codes resolve to the first equal-length match); `+1…` prefers US; unmatched prefix leaves the selection; empty value never detects; the `value.slice(1)` digit-count quirk (R-05 quirk 1); manual selection sticks on an empty value and is overwritten on a detectable one (R-05 quirk 2) |
| Keyboard | `Tab` order trigger → field; `Space`/`Enter` open; `ArrowDown`/`ArrowUp` move; `Home`/`End` jump; typing filters by name, dial code and ISO code; empty state; `Enter` selects, closes, focuses the field; `Escape` closes with the selection unchanged and focus on the trigger; controlled `open`/`onOpenChange` |
| Guard rails | `disabled` — trigger not activatable, field ignores input; `readOnly` — field focusable, edits ignored, country still changeable; `showFlag={false}` hides flags; a `countries` list missing the selected code renders the swatch; part-level `disabled`/`readOnly`/`required` OR-ed with the root's |
| Provider | `<PhoneInput.CountrySelect>` and `<PhoneInput.Field>` rendered bare each throw `/must be used within/` |
| Form | inside a `<form>`, the hidden input carries `name` + the canonical value and updates on change; with no form ancestor, no hidden input is rendered |
| RTL | `dir="rtl"` keeps trigger-then-field logical order and all key behaviour unchanged (FR-013) |
| Child snippet | rendering `PhoneInput.Root` with a `child` snippet emits the caller's element carrying `role="group"`, `data-slot="phone-input"`, and the `data-*` state attributes |

## Demo Route Plan

`src/routes/docs/components/phone-input/+page.svelte`, three `<ComponentPreview>` sections, one per
upstream example, plus props tables built from `$lib/components/ui/table` (the `mask-input` page's
pattern):

1. **Default** — mirrors `phone-input-demo.tsx`: bare `Root` + `CountrySelect` + `Field`. The section
   notes that the root's `placeholder` wins over the field's (R-12), which is why upstream's own demo
   shows "Enter phone number".
2. **Custom Countries** — mirrors `phone-input-custom-countries-demo.tsx`: the four North-American
   entries, `defaultValue="+14085551234"`, `defaultCountry="US"`.
3. **With Form** — mirrors `phone-input-form-demo.tsx`: a native `<form>` with `Field.FieldGroup` /
   `Field.Field` / `Field.FieldLabel` / `Field.FieldDescription`, `bind:value` + `bind:country`,
   `required`, `invalid` on submit failure, and a `svelte-sonner` toast showing the submitted
   `{ country, phone }` (R-15 — `react-hook-form`/`zod` are not repo dependencies and are not part of
   the component).

Plus a "Props" section: one table per part, columns Prop / Type / Default / Description.

## Registry Entry

```jsonc
{
	"name": "phone-input",
	"type": "registry:ui",
	"title": "Phone Input",
	"description": "A phone number input with country detection, international formatting and a searchable country picker.",
	"registryDependencies": ["command", "input", "popover", "mask-input", "checkbox-group"],
	"dependencies": ["bits-ui", "@lucide/svelte"],
	"files": [
		{ "path": "src/lib/components/ui/phone-input/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/phone-input/phone-input.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/phone-input/phone-input-country-select.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/phone-input/phone-input-field.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/phone-input/phone-input.svelte.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/phone-input/phone-engine.ts", "type": "registry:ui" }
	]
}
```

`mask-input` and `checkbox-group` appear as registry dependencies because the component imports
`getUnmaskedValue` and `FormControlState` from them — the `segmented-input → speed-dial` precedent.
Test files are excluded. `pnpm run registry:build` regenerates `static/r/`.

## Post-Design Re-check (after Phase 1)

Re-evaluated against the finished `data-model.md` and `contracts/*`: **all ten principles still PASS.**

- IV was the only one at risk. The design's four bespoke items are each justified above with the
  primitive evaluated; the dropdown, focus scope, dismissal, filtering and keyboard navigation are all
  bits-ui's, and the two helper classes are imported from sibling components rather than re-authored.
- VIII was re-checked against the upstream class strings: every `dark:` variant is dropped in favour of
  the composed `<Input>`'s own token classes, and left/right radii and borders become logical `s`/`e`
  utilities for RTL (R-13).
- II was re-checked prop by prop against `docs/types/radix/phone-input.ts`: the only gaps are the nine
  recorded divergences (spec Assumptions; research R-04, R-07, R-08, R-09, R-10, R-11, R-12, R-13, R-15)
  — root `asChild` → `child`; the country select's inert `asChild`/`children`; the field's ignored
  `value`/`onChange`; `defaultCountry`'s documented-vs-actual default; `data-checked="true"` in place of
  upstream's inline `Check` opacity toggle; focus return via `onCloseAutoFocus` instead of
  `requestAnimationFrame`; a DOM-only `$effect` re-assertion instead of a re-render-driven value snap-back;
  every `dark:` variant dropped plus logical `s`/`e` utilities for RTL; no `react-hook-form`/`zod`
  equivalent in the form demo — each written down here and in research.

## Complexity Tracking

No violations. Nothing to record.
