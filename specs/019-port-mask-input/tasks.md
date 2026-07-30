---
description: 'Task list for the Mask Input port'
---

# Tasks: Port Mask Input Component

**Input**: Design documents from `specs/019-port-mask-input/` (plan.md, spec.md, research.md, data-model.md, contracts/mask-input.md, quickstart.md)

**Tests**: MANDATORY (constitution Principle III / VII). Tests are written before the files they exercise, per `research.md` R-15 and `quickstart.md`'s 19 scenario rows.

**User stories** (from spec.md): US1 = live formatting (P1), US2 = cursor-safe editing (P1), US3 = validation modes (P2), US4 = accessibility/keyboard/RTL (P2), US5 = standalone reusable engine (P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependency)
- **[Story]**: Which user story (US1–US5) this task serves; omitted for Setup/Verification tasks that serve all of them
- Every task names an exact repository-root-relative file path

## Phase order (per plan.md's Implementation Phases table)

Setup → Tests → Core component files → Barrel and types → Demo route → Registry entry and docs polish → Verification

---

## Phase 1: Setup

- [X] T001 [P] Add a stub `registry:ui` entry named `mask-input` to `registry.json` (`name`, `type: "registry:ui"`, `title`, `description`, empty `registryDependencies: []`, `dependencies: []`, empty `files: []`) so the file exists as an anchor for T017 to fill in later.
- [X] T002 [P] Confirm no new npm dependency is required (research R-14: only `cn()` from `$lib/utils.js` and the platform `Intl.NumberFormat` are used) by inspecting `package.json` at the repository root; make no edits if confirmed.

**Checkpoint**: Setup complete — test authoring can begin.

---

## Phase 2: Tests (MANDATORY — write first, confirm they fail before Phase 3)

> All of T004–T011 add `describe` blocks to the same file, `src/lib/components/ui/mask-input/mask-input.test.ts`, and therefore run sequentially against each other (never `[P]`). T003 creates a separate file and has no dependency on T004–T010, so it can run in parallel with them; T011 depends on T003 (it uses the harness).

- [X] T003 [P] [US2] [US5] Create the composition-test harness `src/lib/components/ui/mask-input/mask-input.test.svelte` per research R-15: a single component with a discriminated `mode` prop covering `'default'` (styled `<input>`), `'controlled'` (`bind:value`), `'function-binding'` (a `bind:value={() => v, (n) => {...}}` that can decline a change), `'child'` (renders a caller-supplied element via the `child` snippet), and `'form'` (wraps the field in a plain `<form>`). Not collected by Vitest and not listed in `registry.json`.
- [X] T004 [US5] In `src/lib/components/ui/mask-input/mask-input.test.ts`, write the engine unit tests (no component render — direct imports from `./mask-engine.js`): structural checks on `MASK_PATTERNS` (all 15 keys, `pattern`/`transform`/`validate` shape), `applyMask`, `applyCurrencyMask` (USD/EUR/GBP/JPY, empty value, invalid numeric input, large-number commas, partial decimal, incremental input, unknown-currency fallback to USD), `applyPercentageMask`, `getUnmaskedValue` (default digit-strip and custom transform), `toUnmaskedIndex`/`fromUnmaskedIndex` round-trips (`pattern = "(###) ###-####"`, `caret 9 ↔ unmaskedIndex 6`), and every pattern's `validate()` boundary case from upstream's "MASK_PATTERNS validation" block (phone, date, time, creditCard Luhn, creditCardExpiry, ipv4, currency, percentage), wrapping the date/creditCardExpiry assertions in `vi.useFakeTimers()` / `vi.setSystemTime(new Date(2025, 11, 15))` / `vi.useRealTimers()` in a `finally`. Port every assertion from `.reference/diceui/docs/registry/bases/radix/test/mask-input.test.tsx`'s "Utility Functions" and "MASK_PATTERNS validation" describe blocks — quickstart rows 10 and 19.
- [X] T005 [US4] In the same file, add the accessibility/roles/attributes tests: renders as a native textbox with `data-slot="mask-input"`; default and merged `class`; `ref` forwarding (`bind:ref`); `disabled`/`readonly`/`required`/`invalid` each reflected through the correct native/ARIA attribute (`aria-invalid` always present) **and** the matching `data-*` attribute (`data-disabled`/`data-readonly`/`data-required`/`data-invalid`, present only when true); `Tab`/`Shift+Tab` focus traversal via `userEvent`; `focus`/`blur` event callbacks fire; accessible-name reachability — render the field once inside a `<label for>` and once with `aria-label`, and assert `screen.getByLabelText(...)` resolves to the input, covering the `id`/`aria-*` pass-through from FR-001. Port upstream's "Basic Rendering" describe block and the focus/blur test from "User Interactions" — quickstart row 11.
- [X] T006 [US1] In the same file, add the live-formatting tests: for every one of the 15 built-in patterns (`phone`, `ssn`, `date`, `time`, `creditCard`, `creditCardExpiry`, `zipCode`, `zipCodeExtended`, `currency`, `percentage`, `licensePlate`, `ipv4`, `macAddress`, `isbn`, `ein`), type the documented raw digits via `userEvent` and assert the displayed value **and** the `onValueChange(masked, unmasked)` payload match the upstream example; a custom `MaskPattern` object (`{ pattern, transform, validate }`) applies identically to a built-in one; the currency locale matrix (USD default, EUR·`de-DE`, GBP·`en-GB`, JPY with zero decimals, and an unrecognized currency/locale pair falling back to USD/`en-US`); `withoutMask`/no-`mask` passthrough leaves typed text unformatted. Port upstream's "Built-in Mask Patterns", "Custom Mask Patterns", and the `withoutMask` case from "Edge Cases" — quickstart rows 1, 2, 3.
- [X] T007 [US2] In the same file, add the keyboard & caret-positioning tests — the hard problem: port every one of upstream's 12 "Cursor Positioning" tests verbatim (insert mid-credit-card, insert at the beginning, insert before a space separator, Backspace mid-phone-value, editing a date mask, cursor stays at end when typing at the end, insert in the middle of an SSN, rapid typing in the middle without cursor jumping, Backspace removing a character immediately before a literal, caret positioning with a controlled component, editing EUR currency mid-value, editing USD currency mid-value), each driving `setSelectionRange` + `userEvent.keyboard`/`{Backspace}`/`{Delete}` and asserting both the reformatted value **and** the exact `element.selectionStart`; plus the paste-over-a-selection cases: (a) the generic-pattern case (`userEvent.paste` with a non-collapsed selection, caret lands after the last pasted character), (b) a `currency` paste where the symbol trails the number (caret lands just before the trailing symbol) and one where the symbol leads it (caret lands at the very end), asserting `onValueChange` is **not** called for either (upstream returns before committing state on these two branches), and (c) a `percentage` paste (caret lands immediately before the trailing `%`, `onValueChange` not called); plus a `Ctrl+A`-then-`{Backspace}` case on a filled `creditCard` field asserting the component does not call `preventDefault()` on the native select-all deletion (matching upstream's non-collapsed-selection early return in the Backspace/Delete branch). Quickstart rows 4–8; SC-002.
- [X] T008 [US3] In the same file, add the validation-mode tests: for each of `onChange`/`onBlur`/`onSubmit`/`onTouched`/`all`, drive typing then `userEvent.tab()` and assert `onValidate(isValid, unmasked)` fires (or does not fire) at the documented moments with the documented boolean, plus the `onTouched`-fires-on-every-change-after-first-blur case; plus a `mask="percentage" min="10" max="20"` case asserting `onValidate(false, ...)` for `5` and `onValidate(true, ...)` for `15`, covering FR-022's `min`/`max` forwarding into the pattern's `validate` function. Port upstream's "Validation Modes" describe block (including its per-mode `createValidationTest` cases) exactly — quickstart row 9.
- [X] T009 [US2] [US4] In the same file, add the guard-rail and remaining edge-case tests: `disabled` and `readonly` each suppress typing, `Backspace`/`Delete`, and paste (value never changes); `maxlength`/`inputmode` derivation (`zipCode` → `maxlength="5"`, `phone` → `inputmode="numeric"`, `currency`/`percentage`/`ipv4` → `inputmode="decimal"` and no `maxlength`, a custom object mask → no `inputmode`); IME composition (`compositionstart` → `input` → `compositionend`: no `onValueChange` mid-composition, masked and notified once composition ends); `maskPlaceholder` focus/blur swapping across all 5 documented combinations from contracts/mask-input.md §6. Port upstream's `disabled`/`readOnly` cases from "Basic Rendering", the composition test from "User Interactions", "MaskPlaceholder Prop", and the `maxLength`/`inputMode` cases from "Edge Cases" — quickstart rows 12, 15, 16, 17.
- [X] T010 [US4] In the same file, add the RTL test: render the field inside a `dir="rtl"` ancestor and assert the `<input>` itself carries no own `dir` attribute, `getComputedStyle(input).direction === 'rtl'` (i.e. it inherits), and that typing/backspace/paste produce byte-identical masked values and caret positions to the equivalent LTR case — quickstart row 13; FR-019; research R-10.
- [X] T011 [US2] [US5] In the same file, using the harness from T003, add the controlled/uncontrolled and `child`-snippet tests: `defaultValue` seeds an uncontrolled field and internal edits update it; `bind:value` makes the parent authoritative and every edit calls `onValueChange`; a function binding that declines the write leaves the displayed value unchanged (does not move on its own); rendering with a `child` snippet onto a caller-supplied element still applies masking/caret behavior and the emitted handlers resolve the element via `event.currentTarget`. Quickstart rows 14, 18; FR-002; FR-018; research R-05, R-08.

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/mask-input/mask-input.test.ts` fails (missing `./mask-engine.js` / `./mask-input.svelte.js` / `./index.js`) — expected, proceed to implementation.

---

## Phase 3: Core component files

> Sequential: each file imports the previous one, so none of T012–T014 is `[P]`.

- [X] T012 [US1] [US2] [US3] [US5] Implement `src/lib/components/ui/mask-input/mask-engine.ts`: the `MASK_PATTERNS` table (all 15 keys per `data-model.md` §3, in upstream declaration order), the `REGEX_CACHE` plus the three module-level memo `Map`s (`formattersCache`, `currencyAtEndCache`, `currencySymbolsCache`), `getCachedFormatter`, `getCachedCurrencySymbols`, `isCurrencyAtEnd`, `isCurrencyMask`, `applyMask`, `applyCurrencyMask`, `applyPercentageMask`, `getUnmaskedValue`, `toUnmaskedIndex`, `fromUnmaskedIndex`, `getCurrencyCaretPosition`, `getPatternCaretPosition`, `resolveMaskPattern`, `DEFAULT_CURRENCY`, `DEFAULT_LOCALE`, `MASK_PATTERN_KEYS`, and the `MaskPattern`/`MaskPatternKey`/`TransformOptions`/`ValidateOptions` types — a 1:1 port of `.reference/diceui/docs/registry/bases/radix/ui/mask-input.tsx` lines 8–825 (per `plan.md`'s Structure Decision table), with every JSDoc comment copied. No runes, no DOM access (SSR-safe). This must make T004's tests pass once T012 alone is in place (they import only from `./mask-engine.js`).
- [X] T013 Implement `src/lib/components/ui/mask-input/mask-input.svelte.ts`: the `MaskInputState` class (`focused`/`composing`/`touched` as `$state`; `maskPattern`/`transformOpts`/`validateOpts`/`placeholderValue`/`displayValue`/`tokenCount`/`calculatedMaxLength`/`calculatedInputMode` as `$derived`; `shouldValidate`, `runValidate`, `oninput`, `onfocus`, `onblur`, `oncompositionstart`, `oncompositionend`, `onpaste`, `onkeydown` methods, each resolving the element from `event.currentTarget` per research R-08), plus the exported `MASK_INPUT_VALIDATION_MODES` array and `MaskInputValidationMode`/`MaskInputStateProps` types. All reactive constructor inputs are getter functions, never captured snapshots. No Svelte context (research R-02) — a 1:1 port of upstream lines 877–1463, **except divergence D-08**: `onkeydown` and `onpaste` `return` immediately when `disabled` or `readonly` is true (upstream omits this guard and would rewrite a read-only field's value, breaking FR-012 and T009), **and divergence D-10**: every commit path (`oninput`, `oncompositionend`, `onpaste`, and the `onkeydown` Backspace/Delete branches) goes through one setter that assigns `value` **and then** calls `onValueChange` — upstream skips the state write (calls `onValueChangeProp` only, never `setInternalValue`) in the keydown Backspace/Delete branches and in the currency/percentage paste branches; this port commits the value in all of them so `bind:value`/`state.displayValue` never goes stale. Both divergences are to be added to contracts/mask-input.md §7 as D-08/D-10 during implementation. Depends on T012 (`import ... from './mask-engine.js'`).
- [X] T014 Implement `src/lib/components/ui/mask-input/mask-input.svelte`: module-script `MaskInputRootProps` (alias `MaskInputProps`) and `MaskInputChildProps` types with every prop's upstream JSDoc (incl. `@default`) copied per `contracts/mask-input.md` §1; instance script destructuring `$props()` once (`ref = $bindable(null)`, `value = $bindable()`, `defaultValue = ''`, `onValueChange`, `onValidate`, `validationMode = 'onChange'`, `mask`, `maskPlaceholder`, `currency = 'USD'`, `locale = 'en-US'`, `invalid = false`, `withoutMask = false`, `disabled = false`, `readonly = false`, `required = false`, `placeholder`, `inputMode`, `maxlength`, `min`, `max`, `class: className`, `child`, the seven `on*` handler props, `...restProps`); `value ??= untrack(() => defaultValue)`; instantiates `new MaskInputState({...})`; builds the `MaskInputChildProps` attribute bag in this exact order — `data-slot` and the `data-*` state attributes first, then `{...restProps}`, then `class`/`value`/`placeholder`/`disabled`/`readonly`/`required`/`maxlength`/`inputmode`/`min`/`max` and the seven event handlers last — so a caller-supplied `value` or handler arriving through `restProps` can never clobber the mask, matching upstream's own attribute ordering (`data-*` before `{...inputProps}`, masking-critical props after it); `data-slot`/`data-invalid`/`-disabled`/`-readonly`/`-required` as `? '' : undefined`, `aria-invalid` always present, derived `maxlength`/`inputmode`; renders `{#if child}{@render child({ props })}{:else}` a bare `<input>` whose Tailwind class string is copied verbatim from `src/lib/components/ui/input/input.svelte` (with a `// Mirrors src/lib/components/ui/input/input.svelte` comment) merged last via `cn()`; the `<input>`'s `value` attribute is bound **one-way** to `state.displayValue` (never `bind:value`) per research R-03/R-04. Depends on T013.

**Checkpoint**: engine + state + component files exist; T004 and most of T005–T011 still fail only on the missing barrel (`./index.js`).

---

## Phase 4: Barrel and types

- [X] T015 Create `src/lib/components/ui/mask-input/index.ts`: `import Root from './mask-input.svelte'`; re-export `MaskInputState`, `MaskInputStateProps` (type), `MaskInputValidationMode` (type), `MASK_INPUT_VALIDATION_MODES` from `./mask-input.svelte.js`; re-export every engine export (`MASK_PATTERNS`, `applyMask`, `applyCurrencyMask`, `applyPercentageMask`, `getUnmaskedValue`, `toUnmaskedIndex`, `fromUnmaskedIndex`, `resolveMaskPattern`, `isCurrencyMask`, `isCurrencyAtEnd`, `getCurrencyCaretPosition`, `getPatternCaretPosition`, `DEFAULT_CURRENCY`, `DEFAULT_LOCALE`, `MASK_PATTERN_KEYS`) from `./mask-engine.js`; re-export the `MaskInputChildProps`/`MaskInputProps`/`MaskInputRootProps`/`MaskPattern`/`MaskPatternKey`/`TransformOptions`/`ValidateOptions` types from `./mask-input.svelte.js` and `./mask-engine.js`; export `Root` plus `Root as MaskInput`. Depends on T012–T014. This is the "one task per exported subcomponent" task for the Public API's single component (`Root`/`MaskInput` — there are no sub-parts).

**Checkpoint**: run `pnpm run test:unit -- --run src/lib/components/ui/mask-input/mask-input.test.ts` — all of T004–T011's assertions should now pass. Fix `mask-engine.ts`/`mask-input.svelte.ts`/`mask-input.svelte` (never the tests) until they do.

---

## Phase 5: Demo route

- [X] T016 [US1] Create `src/routes/docs/components/mask-input/+page.svelte` with five `<ComponentPreview>` sections, one per upstream demo file under `.reference/diceui/docs/registry/bases/radix/examples/mask-input-*.tsx`: **Default** (basic built-in patterns, mirrors `mask-input-demo.tsx`), **Custom pattern** (mirrors `mask-input-custom-pattern-demo.tsx`), **Validation modes** (all five `validationMode` values, mirrors `mask-input-validation-modes-demo.tsx`), **Card information** (multi-field composition using the installed `card`/`button`/`label` primitives and a `svelte-sonner` toast, mirrors `mask-input-card-information-demo.tsx`), **With form** (a plain `<form onsubmit>` with `Field.FieldGroup`/`Field.Field` per `.agents/skills/shadcn-svelte/rules/forms.md`, mirrors `mask-input-form-demo.tsx` per research R-13/divergence D-06 — no `react-hook-form`/`zod` equivalent added). Keep all demo state as page-local `$state`; no `+page.ts`. Also render a props table sourced from `contracts/mask-input.md` §1. Depends on T015.

---

## Phase 6: Registry entry and docs polish

- [X] T017 Replace the T001 stub in `registry.json` with the full `mask-input` entry: `"registryDependencies": []`, `"dependencies": []`, and `"files"` listing exactly `src/lib/components/ui/mask-input/index.ts`, `src/lib/components/ui/mask-input/mask-input.svelte`, `src/lib/components/ui/mask-input/mask-input.svelte.ts`, `src/lib/components/ui/mask-input/mask-engine.ts` (both test files excluded), each `"type": "registry:ui"`. Depends on T015.
- [X] T018 [P] Run `pnpm run registry:build` and confirm `static/r/mask-input.json` is generated with `$lib/...` imports rewritten to registry placeholders. Depends on T017.
- [X] T019 Docs polish: verify every `<ComponentPreview>` added in T016 has a `description` that names its source upstream demo file, and that the props table matches `contracts/mask-input.md` §1 exactly (prop names, types, defaults, bindability). Depends on T016.

---

## Phase 7: Verification (MANDATORY — Principle VII, final phase)

- [X] T020 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`, and fix everything that fails.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies — T001 and T002 run in parallel.
- **Tests (Phase 2)**: depends on Setup. T003 is independent of T004–T010 (different file) and may run in parallel with them; T004–T010 are strictly sequential (same file, `mask-input.test.ts`); T011 depends on T003 (uses the harness) and on T004–T010 having already established the file.
- **Core component files (Phase 3)**: depends on Tests existing (so they can be observed failing). T012 → T013 → T014, strictly sequential (import chain).
- **Barrel and types (Phase 4)**: T015 depends on T012, T013, and T014.
- **Demo route (Phase 5)**: T016 depends on T015.
- **Registry entry and docs polish (Phase 6)**: T017 depends on T015; T018 depends on T017; T019 depends on T016. T018 and T019 may run in parallel with each other.
- **Verification (Phase 7)**: T020 depends on every prior task.

### Behavioural-area → task map (for traceability against CLAUDE.md §7)

| Area                                  | Task |
| -------------------------------------- | ---- |
| Roles/ARIA + accessible names          | T005 |
| Keyboard interaction (incl. caret math)| T007 |
| Controlled vs uncontrolled             | T011 |
| RTL                                    | T010 |
| Guard rails / edge cases               | T009 |
| Live formatting (all patterns)         | T006 |
| Validation modes                       | T008 |
| Reusable engine (no rendering)         | T004 |

---

## Parallel Example

```bash
# Setup — run together:
Task: "Add registry.json stub entry (T001)"
Task: "Confirm no new npm dependency is required (T002)"

# Tests — T003 runs alongside the start of the sequential T004..T011 chain:
Task: "Create mask-input.test.svelte harness (T003)"
Task: "Write engine unit tests in mask-input.test.ts (T004)"

# Registry/docs polish — run together once T017/T016 land:
Task: "Run pnpm run registry:build (T018)"
Task: "Verify demo descriptions and props table (T019)"
```

---

## Implementation Strategy

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Tests) — confirm the suite fails only on missing imports, not on assertion logic errors that indicate a misunderstood spec.
3. Complete Phase 3 (Core component files) in order: engine → state → component.
4. Complete Phase 4 (Barrel) — re-run the full test file; every scenario from `quickstart.md`'s 19 rows should now pass.
5. Complete Phase 5 (Demo route) and Phase 6 (Registry + docs polish).
6. Complete Phase 7 (Verification) — all four gates green, zero suppressions, then `pnpm run registry:build` output committed.

Do NOT run git write commands — the orchestrator owns the working tree (Principle X). Do not touch `.reference/`, `.specify/`, `.claude/`, `scripts/`, `.port-state.json`, or `.port-logs/`.
