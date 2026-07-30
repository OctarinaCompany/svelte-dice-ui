---
description: 'Task list for the Phone Input port'
---

# Tasks: Port Phone Input Component

**Input**: Design documents from `specs/020-port-phone-input/` (plan.md, spec.md, research.md, data-model.md, contracts/component-api.md, contracts/phone-engine.md, quickstart.md)

**Tests**: MANDATORY (constitution Principle III / VII). Tests are written before the files they exercise, per `plan.md`'s Testing Plan table and `quickstart.md`'s load-bearing assertions.

**User stories** (from spec.md): US1 = type an international number and see it formatted (P1), US2 = pick a country from a searchable dropdown (P1), US3 = automatic country detection from a pasted/typed number (P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependency)
- **[Story]**: Which user story (US1–US3) this task serves; omitted for Setup/Verification tasks that serve all of them
- Every task names an exact repository-root-relative file path

## Phase order (per CLAUDE.md §11 / this command's requirements)

Setup → Tests → Core component files → Barrel and types → Demo route → Registry entry and docs polish → Verification

---

## Phase 1: Setup

- [X] T001 [P] Add a stub `registry:ui` entry named `phone-input` to `registry.json` (`name`, `type: "registry:ui"`, `title`, `description`, empty `registryDependencies: []`, `dependencies: []`, empty `files: []`) so the file exists as an anchor for T022 to fill in later.
- [X] T002 [P] Confirm the zero-new-dependency plan (plan.md Technical Context: `bits-ui` `Popover`/`Command`, `@lucide/svelte` `chevron-down`, and reuse of `getUnmaskedValue` from `src/lib/components/ui/mask-input/index.ts` and `FormControlState` from `src/lib/components/ui/checkbox-group/checkbox-group.svelte.ts`) by inspecting `package.json` at the repository root and both source files; make no edits if confirmed.

**Checkpoint**: Setup complete — test authoring can begin.

---

## Phase 2: Tests (MANDATORY — write first, confirm they fail before Phase 3)

> T004–T013 add `describe` blocks to the same file, `src/lib/components/ui/phone-input/phone-input.test.ts`, and therefore run sequentially against each other (never `[P]`). T003 creates a separate file and has no dependency on T004–T012, so it can run in parallel with them; T007, T011, T012, and T013 depend on T003 (they use the harness).

- [X] T003 [P] [US1] [US2] [US3] Create the composition-test harness `src/lib/components/ui/phone-input/phone-input.test.svelte` per the project's harness convention (see `mask-input.test.svelte`, `segmented-input.test.svelte`): a single component with a discriminated `mode` prop covering `'default'` (bare `Root` + `CountrySelect` + `Field`), `'controlled'` (`bind:value`, `bind:country`), `'function-binding'` (a `bind:value={() => v, (n) => {...}}` that can decline a write), `'form'` (wraps the parts in a plain `<form>` with a `name` prop), `'rtl'` (wraps the parts in a `dir="rtl"` ancestor), `'child'` (renders `PhoneInput.Root` with a `child` snippet that emits a caller-chosen element receiving the root's computed props), and `'bare-country-select'` / `'bare-field'` (render `PhoneInput.CountrySelect` / `PhoneInput.Field` with no `PhoneInput.Root` ancestor, for the provider-error tests). Not collected by Vitest and not listed in `registry.json`.
- [X] T004 [US1] [US3] In `src/lib/components/ui/phone-input/phone-input.test.ts`, write the engine unit tests (no component render — direct imports from `./phone-engine.js`), porting every row of `contracts/phone-engine.md`: `getCountries()` returns one entry per `COUNTRY_DATA` row (`expect(getCountries()).toHaveLength(COUNTRY_DATA.length)`, currently 239), each `code` unique and upper-case, every `dialCode` starting with `+`, sorted by `name.localeCompare`, and memoised (repeated calls return the same array reference, and the returned array is never mutated by the other functions); `getCountryName`/`getFlagEmoji` spot checks; `formatPhoneNumber` for every input/output pair in the contract table (`''`, `'+'`, `'+1'`, `'+14085551234'` → `'+1 408 555 123 4'`, `'14085551234'` → same, `'+442071234567'` → `'+44 207 123 456 7'`, `'+123'` → `'+1 23'` and `'+12'` → `'+1 2'` (both match the `+1` group and the `US` tie-break), plus the true no-match guesses `'+999'` → `'+999'` and `'+99'` → `'+99'` (3-digit `min(digits.length, 3)` guess, no country claims that prefix)); `detectCountryFromNumber` for every row (no leading `+`, `'+'`/`'+abc'` with no digits, no dial-code match, exactly one match, the `+1`→`US` tie-break, the shared non-`+1` dial-code case — `+442071234567` resolves to `GG`, the first of the four `+44` entries in display-name order, since the `US` tie-break only fires for `+1` — otherwise the longest match), asserting the input `countries` array is never mutated; `normalizePhoneInput` for every row in the contract table; and the pinned invariant `formatPhoneNumber(normalizePhoneInput(x).value, countries)` never throws for a handful of adversarial strings (`''`, `'+'`, `'abc'`, `'+++123'`, emoji, very long digit runs).
- [X] T005 [US1] [US2] [US3] In the same file, add the roles/ARIA/accessible-attributes tests: the root renders `role="group"` and `data-slot="phone-input"`; a caller-supplied `id` on the root lands on the root element, defaulting to a generated id when omitted; a `restProps`-supplied `role`/`data-*` on the root overrides the component's own default; the root's `placeholder` takes precedence over a `placeholder` passed directly to `PhoneInput.Field` (render `<PhoneInput.Root placeholder="Root ph"><PhoneInput.Field placeholder="Field ph" /></PhoneInput.Root>` and assert the field shows `Root ph`); rendering `PhoneInput.Root` with a `child` snippet emits the caller's element carrying `role="group"`, `data-slot="phone-input"`, and the `data-*` state attributes; the field renders `type="tel"`, `inputmode="tel"`, `data-slot="phone-input-field"`, and `aria-required`/`aria-invalid` reflecting the root's `required`/`invalid` props; the country-select trigger is a native `<button>` with `data-slot="phone-input-country-select"` and `aria-expanded` toggling with `open`; opening the dropdown exposes a searchable listbox with option roles (bits-ui `Command`); each part's accessible name is reachable via a consumer-supplied `<label for>`/`aria-label` (upstream ships none, so the port adds none of its own — assert only pass-through). Port upstream's rendering/ARIA assertions from `.reference/diceui/docs/registry/bases/radix/test/phone-input.test.tsx` if present, otherwise derive directly from `contracts/component-api.md`.
- [X] T006 [US1] In the same file, add the uncontrolled formatting-as-you-type tests: an empty, uncontrolled field seeded by `defaultValue` and `defaultCountry`; typing `14085551234` via `userEvent` displays `+1 408 555 123 4` while `onValueChange`'s last call carries the canonical `+14085551234`; pasting a punctuated number (`userEvent.paste`) strips non-digits and reformats; deleting characters (`{Backspace}`) recomputes formatting from the remaining digits rather than leaving stale separators; typing a letter never reaches the display and the DOM `<input>` value snaps back to the last valid formatted string (spec US1 AS-1..3, edge case "no recognizable dial code"); a caller's `oninput` prop that calls `event.preventDefault()` runs before the internal handler and cancels the edit — the canonical value does not move and the DOM `<input>` value snaps back to the previous formatted string.
- [X] T007 [US1] [US2] In the same file, using the `'controlled'` and `'function-binding'` harness modes from T003, add the controlled-mode tests: passing `value` + `onValueChange` makes the parent authoritative and the field never reformats on its own until the parent updates `value`; a function binding that declines the write leaves the displayed value unchanged; the same pair for `country` + `onCountryChange` (selecting a country in the dropdown does not move the selection unless the controlled `country` prop is updated); selecting a country does not itself alter the phone value's digits (FR-007).
- [X] T008 [US2] In the same file, add the country-select keyboard and search tests: `Space`/`Enter` and a pointer click each open the popover from the trigger; typing in the open list filters by country name, dial code, and ISO code (`value={`${name} ${dialCode} ${code}`}`), and shows the fixed `"No country found."` empty state when nothing matches; `ArrowDown`/`ArrowUp` move the highlighted item, `Home`/`End` jump to the first/last country; `Enter` on a highlighted item selects it, closes the popover, and moves focus to the field; `Escape` closes the popover leaving the selection unchanged and focus on the trigger; the previously selected country shows `data-checked="true"` when the list is reopened; `Tab` moves focus from the trigger to the field in that logical order; using the `'controlled'` harness mode from T003, `bind:open` opens/closes the popover programmatically, a caller `onOpenChange` fires alongside the internal handler, and a caller-supplied `open` wins over the internal state (spec US2 AS-1..4, FR-006, FR-011).
- [X] T009 [US3] In the same file, add the automatic-detection integration tests (through the rendered field, not the pure engine): typing `+33612345678` selects `FR` with no manual interaction; typing `+442071234567` selects `GG` (the first of the four `+44` entries — `gg`, `im`, `je`, `gb` — in display-name order, since the `US` tie-break is hard-coded to `+1` and never fires for `+44`), pinning that shared non-`+1` dial codes do not get a `GB`-favoring tie-break; typing `+1408…` selects `US` and not another `+1` country; typing 10+ digits with no leading `+` runs detection the same way; a partially typed number matching no country leaves the current selection unchanged; clearing the field back to empty never triggers detection and leaves the previously selected country as-is; a manual selection on an empty value sticks and is overwritten only once the value becomes independently detectable (data-model.md §3 "quirk 2"; spec US3 AS-1..4, edge cases).
- [X] T010 [US1] [US2] [US3] In the same file, add the guard-rail and remaining edge-case tests: `disabled` suppresses all interaction on both the field and the trigger and reflects `[data-disabled]` on the root; `readOnly` keeps the field focusable but suppresses edits and reflects `[data-readonly]` on the root, while the country trigger remains operable and a selection still changes the country (upstream never forwards `readOnly` to the trigger); `showFlag={false}` hides flags on the trigger and every list item; a caller-supplied `countries` list that omits the selected/detected country still shows that country's dial code in the field while the trigger renders the flag-less placeholder swatch; `invalid` reflects `[data-invalid]` on the root and `aria-invalid` on the field; `disabled`/`readOnly`/`required` set directly on `PhoneInput.Field` (and `disabled` set directly on `PhoneInput.CountrySelect`) are OR-ed with the root's own value rather than replacing it (spec Edge Cases; FR-008).
- [X] T011 [US1] [US2] [US3] In the same file, using the `'bare-country-select'` and `'bare-field'` harness modes from T003, add the provider-error tests: rendering `<PhoneInput.CountrySelect>` or `<PhoneInput.Field>` without an ancestor `<PhoneInput.Root>` each throw an error naming both the part and `PhoneInput.Root` (`expect(() => render(...)).toThrow(/must be used within/)`), matching every other compound component in this project (FR-012).
- [X] T012 [US2] In the same file, using the `'form'` harness mode from T003, add the form-integration tests: inside a `<form>` with `name="phone"`, a hidden `<input type="hidden" data-slot="phone-input-form-input">` carries the canonical (unformatted) value, updates it on every change, and dispatches a bubbling `input` event; with no ancestor `<form>`, no hidden input is rendered; the hidden input reflects `disabled`/`required`/`readonly` from the root (FR-009; data-model.md §5).
- [X] T013 [US1] [US2] [US3] In the same file, using the `'rtl'` harness mode from T003, add the RTL test: under `dir="rtl"` the trigger-then-field logical (start/end) order is preserved, and formatting, detection, and every keyboard interaction from T008 (`Tab`, `Space`/`Enter`, `Arrow*`, `Home`/`End`, `Enter`, `Escape`) behave identically to the LTR case, since the widget has no left/right arrow-key navigation to invert (FR-013).

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/phone-input/phone-input.test.ts` fails (missing `./phone-engine.js` / `./phone-input.svelte.js` / `./index.js`) — expected, proceed to implementation.

---

## Phase 3: Core component files

> T014 → T015 → T016 are sequential (import chain: engine → state → root). T017 and T018 both depend on T015+T016 (they read the root's context) but not on each other — different files, mark `[P]`. One task per exported subcomponent from the plan's Public API section: `Root` (T016), `CountrySelect` (T018), `Field` (T017).

- [X] T014 [US1] [US3] Implement `src/lib/components/ui/phone-input/phone-engine.ts`: the `Country` type; the 239-row `COUNTRY_DATA: readonly (readonly [string, string])[]` table transcribed verbatim from `.reference/diceui/docs/registry/bases/radix/ui/phone-input.tsx` (upstream order); `DEFAULT_PHONE_PLACEHOLDER = 'Enter phone number'`; `getCountryName(countryCode, locale = 'en')` via `Intl.DisplayNames`, falling back to `countryCode`; `getFlagEmoji(countryCode)` via the regional-indicator codepoint mapping; a memoised `getCountries()` (module-level cache, `name.localeCompare` sort, stable array reference across calls, never mutated); `detectCountryFromNumber(value, countries)` and `formatPhoneNumber(value, countries)` per `contracts/phone-engine.md`; `normalizePhoneInput(raw)` per the same contract, importing `getUnmaskedValue` from `$lib/components/ui/mask-input/index.js` for digit extraction (research R-02) and nothing else. No runes, no DOM access (SSR-safe). This must make T004's tests pass once T014 alone is in place.
- [X] T015 Implement `src/lib/components/ui/phone-input/phone-input.svelte.ts`: the `PhoneInputRootState` class per `data-model.md` §3 — `open`/`startsWithPlus`/`fieldElement` as `$state`; getter-function constructor inputs (`getValue`, `setValue`, `getCountry`, `setCountry`, `getCountries`, `getPlaceholder`, `getDisabled`, `getReadOnly`, `getRequired`, `getInvalid`, `getShowFlag`, `getName`, `id`) — never captured snapshots; `value`/`country`/`countries`/`displayValue`/`selectedCountry` as `$derived`; methods `setValueFromInput(raw)` (no-op while disabled/readOnly), `selectCountry(code)`, `detectCountry()` (the R-05 effect body), `focusField()`, `consumeSelectionClose()`; the `Symbol('phone-input')` context key; `setPhoneInputContext`, `getPhoneInputContext(consumerName)` (throws ``​`<${consumerName}>` must be used within `<PhoneInput.Root>`.``), and `hasPhoneInputContext()`, mirroring `checkbox-group`'s context pattern. Depends on T014 (imports `Country`/engine functions for typing).
- [X] T016 Implement `src/lib/components/ui/phone-input/phone-input.svelte` (Root): module-script `PhoneInputRootProps` (alias `PhoneInputProps`) and `PhoneInputChildProps` types with every prop's upstream JSDoc (incl. `@default`) copied per `contracts/component-api.md`; instance script destructuring `$props()` once (`ref = $bindable(null)`, `value = $bindable()`, `defaultValue = ''`, `onValueChange`, `country = $bindable()`, `defaultCountry = ''`, `onCountryChange`, `countries = getCountries()`, `name`, `placeholder = DEFAULT_PHONE_PLACEHOLDER`, `disabled = false`, `readOnly = false`, `required = false`, `invalid = false`, `showFlag = true`, `id = $props.id()`, `class: className`, `children`, `child`, `...restProps`); `value ??= untrack(() => defaultValue)` and `country ??= untrack(() => defaultCountry)`; instantiates `new PhoneInputRootState({...})` and calls `setPhoneInputContext(state)`; the detection `$effect` calling `state.detectCountry()` (R-05, runs only on non-empty `value`); composes `FormControlState` from `$lib/components/ui/checkbox-group/checkbox-group.svelte.ts` and renders the hidden `<input type="hidden" data-slot="phone-input-form-input" tabindex="-1">` (name/value/disabled/required/readonly) plus the bubbling `input`-event dispatch effect (R-10), only when a form ancestor is detected; renders `role="group"` `data-slot="phone-input"` with `data-disabled`/`data-invalid`/`data-readonly` (`? '' : undefined`) and `{#if child}{@render child({ props })}{:else}{@render children?.()}{/if}`. Depends on T015.
- [X] T017 [P] Implement `src/lib/components/ui/phone-input/phone-input-field.svelte`: module-script `PhoneInputFieldProps` type; instance script consuming `getPhoneInputContext('PhoneInput.Field')`, composing the repo's `<Input>` from `$lib/components/ui/input/index.js`, reproducing upstream's JSX order exactly: `type="tel"`, `inputmode="tel"`, `aria-required`, `aria-invalid`, `data-slot="phone-input-field"`, `disabled`, `readonly`, `required` are emitted **before** `...restProps` (caller-overridable), while `class`, `placeholder` (the root's), and `value={state.displayValue}` one-way bound (never `bind:value`) are emitted **after** it; local `disabled`/`readOnly`/`required` OR-ed with the root's; an `oninput` handler that runs the caller's `oninput` prop first, checks `event.defaultPrevented`, then calls `state.setValueFromInput(event.currentTarget.value)`; a DOM-only `$effect` that re-asserts `element.value = state.displayValue` whenever they diverge (R-09, the "controlled input snaps back" behaviour, no caret logic); registers its bound element with `state.fieldElement` via `bind:ref` for `focusField()`. Depends on T016.
- [X] T018 [P] Implement `src/lib/components/ui/phone-input/phone-input-country-select.svelte`: module-script `PhoneInputCountrySelectProps` type; instance script consuming `getPhoneInputContext('PhoneInput.CountrySelect')`, composing `Popover.Root`/`Popover.Trigger`/`Popover.Content` and `Command.Root`/`Command.Input`/`Command.List`/`Command.Empty`/`Command.Group`/`Command.Item` from `$lib/components/ui/popover/index.js` and `$lib/components/ui/command/index.js`; `open` bindable, defaulting to and syncing with `state.open`, composed (not replaced) with a caller `onOpenChange`; `onOpenChangeComplete` passed through to `Popover.Root`; trigger (`data-slot="phone-input-country-select"`) shows the selected country's flag when `showFlag` and a `flag` exists, else a `h-4 w-6 rounded-sm bg-muted/50` placeholder swatch, then a trailing `ChevronDown` from `@lucide/svelte/icons/chevron-down` (`size-4 opacity-50`); local `disabled` OR-ed with the root's; search input placeholder `"Search country..."`, empty state `"No country found."`; one `Command.Item` per country in `countries` order with `value={`${name} ${dialCode} ${code}`}`, `data-checked="true"` (a value-bearing exception to the project's presence-based `data-*` convention, required by the repo's `command-item` selector — R-07) on the selected entry, flag (when `showFlag`), name (`flex-1`), dial code (`text-muted-foreground`); selecting an item calls `state.selectCountry(code)`, fires the root's `onCountryChange`, and on close (`onCloseAutoFocus`) focuses the field when the close was selection-driven (`state.consumeSelectionClose()`) or the trigger otherwise. Depends on T016.

**Checkpoint**: engine + state + component files exist; T004 and most of T005–T013 still fail only on the missing barrel (`./index.js`).

---

## Phase 4: Barrel and types

- [X] T019 Create `src/lib/components/ui/phone-input/index.ts`: `import Root from './phone-input.svelte'`, `import CountrySelect from './phone-input-country-select.svelte'`, `import Field from './phone-input-field.svelte'`; re-export `PhoneInputRootState`, `setPhoneInputContext`, `getPhoneInputContext`, `hasPhoneInputContext`, `PhoneInputRootStateProps` (type) from `./phone-input.svelte.js`; re-export every engine export (`COUNTRY_DATA`, `getCountries`, `getCountryName`, `getFlagEmoji`, `detectCountryFromNumber`, `formatPhoneNumber`, `normalizePhoneInput`, `DEFAULT_PHONE_PLACEHOLDER`, `Country` type) from `./phone-engine.js`; re-export `PhoneInputRootProps`/`PhoneInputProps`/`PhoneInputChildProps` types from `./phone-input.svelte.js`, `PhoneInputCountrySelectProps` from `./phone-input-country-select.svelte`, `PhoneInputFieldProps` from `./phone-input-field.svelte`; export `Root`, `CountrySelect`, `Field` plus the aliases `Root as PhoneInput`, `CountrySelect as PhoneInputCountrySelect`, `Field as PhoneInputField`. Depends on T014–T018.

**Checkpoint**: run `pnpm run test:unit -- --run src/lib/components/ui/phone-input/phone-input.test.ts` — all of T004–T013's assertions should now pass. Fix `phone-engine.ts`/`phone-input.svelte.ts`/the three `.svelte` files (never the tests) until they do.

---

## Phase 5: Demo route

- [X] T020 [US1] [US2] [US3] Create `src/routes/docs/components/phone-input/+page.svelte` with three `<ComponentPreview>` sections, one per upstream demo file under `.reference/diceui/docs/registry/bases/radix/examples/phone-input-*.tsx`: **Default** (bare `Root` + `CountrySelect` + `Field`, mirrors `phone-input-demo.tsx`, note that the root's `placeholder` wins over the field's per R-12), **Custom Countries** (the four North-American entries, `defaultValue="+14085551234"`, `defaultCountry="US"`, mirrors `phone-input-custom-countries-demo.tsx`), **With Form** (a native `<form>` using `Field.FieldGroup`/`Field.Field`/`Field.FieldLabel`/`Field.FieldDescription` from `$lib/components/ui/field/index.js`, `bind:value` + `bind:country`, `required`, `invalid` on submit failure, and a `svelte-sonner` toast showing the submitted `{ country, phone }`, mirrors `phone-input-form-demo.tsx` per R-15 — no `react-hook-form`/`zod` equivalent added). Keep all demo state as page-local `$state`; no `+page.ts`. Also render one props table per part (`Root`, `CountrySelect`, `Field`) sourced from `contracts/component-api.md`. Depends on T019.

---

## Phase 6: Registry entry and docs polish

- [X] T021 Replace the T001 stub in `registry.json` with the full `phone-input` entry: `"registryDependencies": ["command", "input", "popover", "mask-input", "checkbox-group"]`, `"dependencies": ["bits-ui", "@lucide/svelte"]`, and `"files"` listing exactly `src/lib/components/ui/phone-input/index.ts`, `src/lib/components/ui/phone-input/phone-input.svelte`, `src/lib/components/ui/phone-input/phone-input-country-select.svelte`, `src/lib/components/ui/phone-input/phone-input-field.svelte`, `src/lib/components/ui/phone-input/phone-input.svelte.ts`, `src/lib/components/ui/phone-input/phone-engine.ts` (both test files and the test harness excluded), each `"type": "registry:ui"`. Depends on T019.
- [X] T022 [P] Run `pnpm run registry:build` and confirm `static/r/phone-input.json` is generated with six files and `$lib/...` imports rewritten to registry placeholders (`node -e "const r=require('./static/r/phone-input.json'); console.log(r.name, r.files.length, r.registryDependencies)"` should print `phone-input 6 [ 'command', 'input', 'popover', 'mask-input', 'checkbox-group' ]`). Depends on T021.
- [X] T023 Docs polish: verify every `<ComponentPreview>` added in T020 has a `description` naming its source upstream demo file, and that the three props tables match `contracts/component-api.md` exactly (prop names, types, defaults, bindability). Depends on T020.

---

## Phase 7: Verification (MANDATORY — Principle VII, final phase)

- [X] T024 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`, and fix everything that fails.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies — T001 and T002 run in parallel.
- **Tests (Phase 2)**: depends on Setup. T003 is independent of T004–T013 (different file) and may run in parallel with them; T004–T013 are strictly sequential (same file, `phone-input.test.ts`); T007, T011, T012, and T013 depend on T003 (they use the harness's `'controlled'`/`'function-binding'`, `'bare-*'`, `'form'`, and `'rtl'` modes) and on T004–T006/T010 having already established the file.
- **Core component files (Phase 3)**: depends on Tests existing (so they can be observed failing). T014 → T015 → T016 strictly sequential (import chain); T017 and T018 both depend on T016 but not on each other — parallel.
- **Barrel and types (Phase 4)**: T019 depends on T014, T015, T016, T017, and T018.
- **Demo route (Phase 5)**: T020 depends on T019.
- **Registry entry and docs polish (Phase 6)**: T021 depends on T019; T022 depends on T021; T023 depends on T020. T022 and T023 may run in parallel with each other.
- **Verification (Phase 7)**: T024 depends on every prior task.

### Behavioural-area → task map (for traceability against CLAUDE.md §7)

| Area                                    | Task |
| ---------------------------------------- | ---- |
| Roles/ARIA + accessible names            | T005 |
| Keyboard interaction (country dropdown)  | T008 |
| Controlled vs uncontrolled               | T006, T007 |
| RTL                                      | T013 |
| Guard rails / edge cases                 | T010 |
| Automatic country detection              | T009 |
| Provider (throwing context)              | T011 |
| Form integration (hidden input)          | T012 |
| Reusable engine (no rendering)           | T004 |

---

## Parallel Example

```bash
# Setup — run together:
Task: "Add registry.json stub entry (T001)"
Task: "Confirm no new npm dependency is required (T002)"

# Tests — T003 runs alongside the start of the sequential T004..T013 chain:
Task: "Create phone-input.test.svelte harness (T003)"
Task: "Write engine unit tests in phone-input.test.ts (T004)"

# Core component files — T017 and T018 once T016 lands:
Task: "Implement phone-input-field.svelte (T017)"
Task: "Implement phone-input-country-select.svelte (T018)"

# Registry/docs polish — run together once T021/T020 land:
Task: "Run pnpm run registry:build (T022)"
Task: "Verify demo descriptions and props tables (T023)"
```

---

## Implementation Strategy

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Tests) — confirm the suite fails only on missing imports, not on assertion logic errors that indicate a misunderstood spec.
3. Complete Phase 3 (Core component files) in order: engine → state → root, then field and country-select in parallel.
4. Complete Phase 4 (Barrel) — re-run the full test file; every scenario from `plan.md`'s Testing Plan table should now pass.
5. Complete Phase 5 (Demo route) and Phase 6 (Registry + docs polish).
6. Complete Phase 7 (Verification) — all four gates green, zero suppressions, then `pnpm run registry:build` output committed.

Do NOT run git write commands — the orchestrator owns the working tree (Principle X). Do not touch `.reference/`, `.specify/`, `.claude/`, `scripts/`, `.port-state.json`, or `.port-logs/`.

---

## Phase 8: Convergence

> Appended by `/speckit-converge` after auditing the implemented port against `spec.md`, `plan.md`,
> `tasks.md`, `contracts/`, `quickstart.md` and the upstream `phone-input.tsx` / `phone-input.mdx`.
> All four quality gates are green (`check` 0 errors, `lint` clean, 1416 unit tests passing, `build`
> succeeds), the registry entry and `static/r/phone-input.json` are complete, and all three upstream
> demos are on the docs page — the items below are the residual gaps.

- [X] T025 Make form-ancestor detection work when `<PhoneInput.Root>` renders through its `child` snippet: in `src/lib/components/ui/phone-input/phone-input.svelte`, `ref` is only bound on the internal `<div>`, so in `child` mode `FormControlState`'s `getElement()` stays `null`, `isFormControl` stays `true` forever, and the hidden `<input data-slot="phone-input-form-input">` is rendered even when there is no ancestor `<form>` — upstream composes its ref through `SlotPrimitive.Slot`, so its `asChild` path detects the form correctly. Give `PhoneInputChildProps` a way to hand the caller's element back to the root (e.g. an attachment included in the props the snippet spreads), and add tests in `src/lib/components/ui/phone-input/phone-input.test.ts` — using a `child`-mode harness rendered both inside and outside a `<form>` — asserting the hidden input appears only inside the form, per FR-009 (partial).
- [X] T026 Add the prop rows missing from the demo tables in `src/routes/docs/components/phone-input/+page.svelte`: `class` and `children` on the `PhoneInput.Root` table, and `...restProps` (`remaining Popover.RootProps`, spread onto `Popover.Root`) on the `PhoneInput.CountrySelect` table, so all three tables match `contracts/component-api.md` row for row, per SC-005 and T023 (partial).
- [X] T027 Correct the `PhoneInput.Field` props table in `src/routes/docs/components/phone-input/+page.svelte`: it states that `inputmode` "cannot be overridden", but `type`/`inputmode`/`aria-*`/`data-slot`/`disabled`/`readonly`/`required` are emitted **before** `...restProps` and are therefore caller-overridable (only `class`, `placeholder`, `value` and the internal `oninput` are owned; `value`, `type`, `readonly` and `files` are removed from the prop type altogether), per plan.md → Public API → `PhoneInputFieldProps` and SC-005 (contradicts).
- [X] T028 Extend the keyboard coverage in `src/lib/components/ui/phone-input/phone-input.test.ts` to the two keys of the `contracts/component-api.md` keyboard table that currently have no assertion: `Delete` in the field (re-formats from the remaining digits, like the existing `{Backspace}` case) and `Shift+Tab` (moves focus back from the field to the country trigger, the inverse of the existing `Tab` case), per CLAUDE.md §7's keyboard floor and FR-011 (partial).
- [X] T029 Fix the load-bearing assertion table in `specs/020-port-phone-input/quickstart.md`: the row for `+442071234567` expects country `GB`, but `+44` is shared by `gg`/`im`/`je`/`gb` and the `US` tie-break is hard-coded to `+1`, so the first entry in display-name order — `GG` — wins, as plan.md's Testing Plan, `contracts/phone-engine.md` and the passing tests all state, per plan: detection tie-break (contradicts).
- [X] T030 Fix the two statements in `specs/020-port-phone-input/contracts/component-api.md` that the implementation contradicts: the `countries` row says "218 built-in entries" where `COUNTRY_DATA` has 239 (asserted in `phone-input.test.ts`), and the `PhoneInput.Field` "Owned (caller cannot override)" list wrongly includes `type`, `inputmode`, `aria-required`, `aria-invalid` and `data-slot`, which are emitted before `...restProps` (plan.md → Public API), per FR-004 and FR-010 (contradicts).
