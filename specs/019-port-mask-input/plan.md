# Implementation Plan: Port Mask Input Component

**Branch**: `019-port-mask-input` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-port-mask-input/spec.md`

## Summary

Port Dice UI's `MaskInput` — a single `<input>` that formats text live against a mask pattern
(phone, date, credit card, currency, …), keeps the caret where a human expects it while editing, and
reports validity under one of five validation modes — to Svelte 5 runes.

The port splits upstream's 1515-line single file into four: a **pure engine** (`mask-engine.ts`,
patterns + `Intl` caches + mask/unmask/caret math, exported so the future `phone-input` can import it
without rendering anything — FR-017), a **rune state class** (`mask-input.svelte.ts`), the **root
component** (`mask-input.svelte`), and the **barrel**. No Svelte context is introduced: upstream is
not a compound component and has none (research R-02).

The single hard problem — caret position after programmatic reformatting — is solved by making the
component the *only* writer of `element.value`: the value is bound **one-way**
(`value={state.displayValue}`, never `bind:value`), the `input` handler synchronously rewrites the
element and calls `setSelectionRange`, and Svelte's `set_value` equality guard then skips the
redundant write on the following flush (research R-03, R-04). This is also why the repo's `Input`
component is not composed here — the one thing it adds, `bind:value`, is the one thing that breaks
this (justified under Principle IV below).

## Technical Context

**Language/Version**: TypeScript 5 (strict, `verbatimModuleSyntax`), Svelte 5 with runes forced on in
`vite.config.ts`

**Primary Dependencies**: SvelteKit 2, Tailwind CSS v4, `tailwind-merge` via `cn()` from
`$lib/utils.js`. **No new npm dependency** (research R-14). No `bits-ui` primitive is used — none
covers masked text entry (R-03). Currency formatting uses the platform `Intl.NumberFormat`.

**Storage**: N/A — no persistence. Three module-level `Map` memo caches for `Intl` objects (R-09).

**Testing**: Vitest (jsdom) + `@testing-library/svelte` + `@testing-library/user-event`;
`globals: false`, `expect.requireAssertions` on. Colocated at
`src/lib/components/ui/mask-input/mask-input.test.ts`, with a non-collected
`mask-input.test.svelte` harness for `bind:value`, function bindings, `child`, and `<form>`
compositions (R-15). `vi.useFakeTimers()` around the date/expiry validation assertions (R-12).

**Target Platform**: Modern browsers via SvelteKit; SSR-safe (the engine touches no DOM and its
caches hold only `Intl` instances and primitives).

**Project Type**: shadcn-svelte registry component (source distribution) + one docs demo route.

**Performance Goals**: Formatting is O(pattern length) per keystroke on strings ≤ 20 chars; the
`Intl` formatters are memoised per `locale|currency|minFrac|maxFrac` exactly as upstream. No
measurable budget beyond "no jank while typing".

**Constraints**: Caret must land within one character of the intuitive position in 100% of the
upstream Cursor Positioning cases (SC-002) — asserted, not eyeballed. Zero suppressions. Zero new
dependencies. No writes outside this feature directory, the component folder, the demo route, and
`registry.json`.

**Scale/Scope**: 1 component, 0 sub-parts, 15 built-in patterns, 6 engine functions in the public
reuse surface, 5 demo sections, ~19 test scenario groups.

**Unknowns**: none. Every ambiguity was resolved in [research.md](./research.md) (R-01…R-15); no
unresolved-clarification markers remain in this plan.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Initial evaluation (pre-Phase 0): PASS** — all ten principles, with Principle IV carrying the
written justification below.

**Post-design re-evaluation (after Phase 1): PASS, unchanged.** The design artifacts introduced no
new bespoke behaviour, no new dependency, and no new API beyond the contract; Principle IV's
justification is the only entry, and it is recorded rather than waived.

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                       |
| ---- | ----------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$props`/`$bindable`/`untrack` only; behaviour in `MaskInputState` (`mask-input.svelte.ts`) with getter-function inputs; `child` is a snippet. No stores, `export let`, `$:`, dispatcher, or `<slot>`. |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | Source, test file and MDX read in full at the pinned commit (research header). Every prop, callback, data attribute, pattern, caret clamp and validation-mode rule reproduced; JSDoc incl. `@default` copied. Ten divergences D-01…D-10 recorded in [contracts/mask-input.md §7](./contracts/mask-input.md) and the spec's Assumptions (D-08: `onkeydown`/`onpaste` guard disabled/readonly; D-09: `oninput` gated by `defaultPrevented` where upstream drops the caller's `onChange` entirely; D-10: Backspace/Delete and currency/percentage paste branches commit `value`, where upstream leaves state stale). |
| III  | Accessibility Is a MUST             | PASS    | Native `<input>` semantics (`role=textbox`); `aria-invalid` always emitted; `disabled`/`readonly`/`required` native + `data-*`. Keyboard map: Tab/Shift+Tab, Backspace, Delete, Ctrl/Cmd+V, Ctrl/Cmd+A ([contract §5](./contracts/mask-input.md)). RTL asserted by inheritance (R-10). Tests cover roles/ARIA, keyboard via `user-event`, RTL, uncontrolled, controlled, guard rails. **No provider-error test — this component has no context or sub-parts (R-02)**; the guard-rail slot is filled by `disabled`/`readonly` suppression. |
| IV   | Composition Over Reimplementation   | PASS    | `cn()` from `$lib/utils.js` reused; `Intl.NumberFormat` used instead of hand-rolled number formatting; demo composes installed `label`/`card`/`button`/`field`/`svelte-sonner`. The `<input>` element itself is bespoke — justified below.                                                                                                     |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder `src/lib/components/ui/mask-input/`, root `mask-input.svelte`, logic in `mask-input.svelte.ts`, engine in `mask-engine.ts`, `index.ts` barrel with short name + prefixed alias + types, all intra-repo imports carry `.js`. Exactly one `registry:ui` entry named `mask-input`, listing all four sources and neither test file; `pnpm run registry:build` scheduled. Zero imports from `src/routes/**` or `$lib/components/docs/**`. |
| VI   | TypeScript Strict, No Suppressions  | PASS    | No `any` anywhere (event targets are narrowed via `event.currentTarget`, typed `HTMLInputElement`, not cast). Props types exported from `<script lang="ts" module>`, derived from `WithElementRef<HTMLInputAttributes, HTMLInputElement>`. No `@ts-*`, `eslint-disable`, `svelte-ignore`, or config edits. |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit -- --run` → `build` (+ `registry:build`) scheduled as the final task phase; every `it` asserts; nothing skipped. |
| VIII | Styling Discipline                  | PASS    | Single visual variant ⇒ plain `cn()`, no `tv()` needed. Semantic tokens only (`border-input`, `bg-transparent`, `text-foreground`, `placeholder:text-muted-foreground`, `ring-ring/50`, `aria-invalid:border-destructive`), mirrored verbatim from `src/lib/components/ui/input/input.svelte` so the field matches the repo's other inputs. Caller `class` merged last. `data-slot="mask-input"`; all four states as `data-*` written `cond ? '' : undefined`. |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/mask-input/+page.svelte` with five `<ComponentPreview>` sections, one per upstream `mask-input-*-demo.tsx`, plus a props table. Demo state held with runes; no `+page.ts`. |
| X    | One Feature Directory Per Component | PASS    | All planning output stays in `specs/019-port-mask-input/`. No git write commands; no touching `.port-state.json`, `.port-logs/**`, `scripts/**`, `.specify/scripts/**`, `.claude/settings*.json`, or `.reference/`. |

**Bespoke behaviour justification (Principle IV)**:

1. **The `<input>` element is rendered directly rather than through
   `$lib/components/ui/input/input.svelte`.** Primitive evaluated: that `Input` component. Capability
   it lacks — and actively conflicts with: it renders `<input bind:value>`, a **second writer** of
   `element.value` whose `input` listener ordering relative to a spread `oninput` is a compiler
   detail, not a guarantee. This component must, inside its own `input` handler, read
   `element.value` + `selectionStart`, write the reformatted string, and call `setSelectionRange`
   synchronously; a competing `bind:value` write after that handler moves the caret to the end and
   breaks SC-002 and twelve upstream Cursor Positioning assertions. `Input` also exposes no `child`
   snippet, so FR-018 (upstream `asChild`) is unreachable through it, and it cannot be patched
   because Principle V forbids a registry item from depending on a locally modified base component.
   Mitigation: the class string is copied verbatim from `input.svelte` with a comment naming the
   source file, so styling stays identical and drift is greppable. Full analysis: research R-03/R-04.
2. **The mask/format/caret engine is hand-written.** Primitive evaluated: `bits-ui`. It ships no
   masked or pattern-formatted text input (`PinInput` is a fixed-cell OTP widget with no
   pattern/transform/validate API and no caret arithmetic). There is no `@diceui/shared` module
   behind this component either — upstream's registry file is self-contained. The engine is a
   1:1 translation of upstream's own logic, not an invention.

## Project Structure

### Documentation (this feature)

```text
specs/019-port-mask-input/
├── plan.md                  # This file
├── spec.md                  # Input (already written)
├── research.md              # Phase 0 output — R-01…R-15, zero unknowns left
├── data-model.md            # Phase 1 output — types, state, caret model
├── quickstart.md            # Phase 1 output — run + 19 validation scenarios
├── contracts/
│   └── mask-input.md        # Phase 1 output — the exact public API
├── checklists/
│   └── requirements.md      # from /speckit-specify
└── tasks.md                 # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/mask-input/
├── index.ts                    # barrel: Root + MaskInput alias, engine re-exports, all prop types
├── mask-input.svelte           # Root — the only rendered part; <input> or `child` snippet
├── mask-input.svelte.ts        # MaskInputState (runes) + MASK_INPUT_VALIDATION_MODES; no context
├── mask-engine.ts              # pure engine: MASK_PATTERNS, apply*/unmask/caret math, Intl caches
├── mask-input.test.svelte      # harness: bind:value, function binding, child, <form> (not in registry)
└── mask-input.test.ts          # colocated tests (NOT listed in registry.json)

src/routes/docs/components/mask-input/
└── +page.svelte                # 5 <ComponentPreview> sections + props table

registry.json                   # append exactly one registry:ui entry
```

**Structure Decision** — every file mapped to its upstream counterpart in
`.reference/diceui/docs/registry/bases/radix/ui/mask-input.tsx`:

| Local file                | Upstream lines | Contents                                                                                                                             |
| ------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `mask-engine.ts`          | 8–825          | constants, `REGEX_CACHE`, the three `Map` caches, `getCachedFormatter`, `getCachedCurrencySymbols`, `isCurrencyAtEnd`, `isCurrencyMask`, `MASK_PATTERNS`, `applyMask`, `applyCurrencyMask`, `applyPercentageMask`, `getUnmaskedValue`, `toUnmaskedIndex`, `fromUnmaskedIndex`, `getCurrencyCaretPosition`, `getPatternCaretPosition`, plus `resolveMaskPattern` (upstream's inline `useMemo`, lines 887–892) and the `MaskPattern` / `MaskPatternKey` / `TransformOptions` / `ValidateOptions` types (172–203) |
| `mask-input.svelte.ts`    | 877–1463       | `MaskInputState`: `$state` `focused`/`composing`/`touched`; `$derived` `maskPattern`/`transformOpts`/`validateOpts`/`placeholderValue`/`displayValue`/`tokenCount`/`calculatedMaxLength`/`calculatedInputMode`; methods `shouldValidate`, `runValidate`, `oninput`, `onfocus`, `onblur`, `oncompositionstart`, `oncompositionend`, `onpaste`, `onkeydown` |
| `mask-input.svelte`       | 829–842, 1465–1501 | `MaskInputRootProps` + `MaskInputChildProps` in the module script; `$props()` destructure; instantiates `MaskInputState`; builds the attribute bag; renders `{#if child}` / `<input>` |
| `index.ts`                | 1503–1514      | the export block, expanded to the repo's barrel shape                                                                                |
| `mask-input.test.ts`      | test file      | every upstream assertion, plus the repo's controlled/uncontrolled, RTL and `child` additions                                          |
| `+page.svelte`            | 5 demo files   | one `<ComponentPreview>` each                                                                                                        |

Slug consistency: folder `mask-input` = demo route segment `mask-input` = registry item name
`mask-input` = upstream slug.

## Public API

Authoritative version, with rationale, lives in [`contracts/mask-input.md`](./contracts/mask-input.md).
Reproduced here as the plan requires.

### Exported component: `Root` (alias `MaskInput`)

Renders one `<input>`. **No sub-components, no snippets other than `child`, no context.**

**Props** — `MaskInputRootProps` (alias `MaskInputProps`) extends
`WithElementRef<HTMLInputAttributes, HTMLInputElement>`:

| Prop                 | Type                                                             | Default     | Bindable |
| -------------------- | ---------------------------------------------------------------- | ----------- | -------- |
| `ref`                | `HTMLInputElement \| null`                                       | `null`      | ✅ yes    |
| `value`              | `string`                                                         | `undefined` | ✅ yes    |
| `defaultValue`       | `string`                                                         | `''`        | no       |
| `onValueChange`      | `(maskedValue: string, unmaskedValue: string) => void`           | `undefined` | no       |
| `onValidate`         | `(isValid: boolean, unmaskedValue: string) => void`              | `undefined` | no       |
| `validationMode`     | `'onChange' \| 'onBlur' \| 'onSubmit' \| 'onTouched' \| 'all'`   | `'onChange'`| no       |
| `mask`               | `MaskPatternKey \| MaskPattern`                                  | `undefined` | no       |
| `maskPlaceholder`    | `string`                                                         | `undefined` | no       |
| `currency`           | `string`                                                         | `'USD'`     | no       |
| `locale`             | `string`                                                         | `'en-US'`   | no       |
| `invalid`            | `boolean`                                                        | `false`     | no       |
| `withoutMask`        | `boolean`                                                        | `false`     | no       |
| `disabled`           | `boolean`                                                        | `false`     | no       |
| `readonly`           | `boolean`                                                        | `false`     | no       |
| `required`           | `boolean`                                                        | `false`     | no       |
| `placeholder`        | `string`                                                         | `undefined` | no       |
| `inputMode`          | `HTMLInputAttributes['inputmode']`                               | derived     | no       |
| `maxlength`          | `number`                                                         | derived     | no       |
| `min` / `max`        | `string \| number`                                               | `undefined` | no       |
| `class`              | `string`                                                         | `undefined` | no       |
| `child`              | `Snippet<[{ props: MaskInputChildProps }]>`                      | `undefined` | no       |
| `oninput`            | `(event: Event & { currentTarget: HTMLInputElement }) => void`   | `undefined` | no       |
| `onfocus` / `onblur` | `FocusEventHandler<HTMLInputElement>`                            | `undefined` | no       |
| `onkeydown`          | `KeyboardEventHandler<HTMLInputElement>`                         | `undefined` | no       |
| `onpaste`            | `ClipboardEventHandler<HTMLInputElement>`                        | `undefined` | no       |
| `oncompositionstart` / `oncompositionend` | `CompositionEventHandler<HTMLInputElement>` | `undefined` | no       |
| …rest                | any `HTMLInputAttributes` (`id`, `name`, `aria-*`, `data-*`)     | —           | —        |

**Snippets**: `child` only (`<input>` is void — no `children`).

**Callbacks / events**: `onValueChange(masked, unmasked)`, `onValidate(isValid, unmasked)`, plus
seven intercepted DOM handlers, each called **before** the component's own logic and each able to
cancel it with `preventDefault()`. Six of them (`onfocus`, `onblur`, `onkeydown`, `onpaste`,
`oncompositionstart`, `oncompositionend`) reproduce upstream's `event.defaultPrevented` gate
verbatim; `oninput` adds this same gate as an intentional divergence (D-09) — upstream never forwards
or gates a caller `onChange` at all (it is silently overridden after the `...inputProps` spread), so
extending the first-call + `defaultPrevented` contract to `oninput` is this port's own decision, not
a reproduction of upstream behaviour.

**Emitted attributes**: `data-slot="mask-input"`, `aria-invalid` (always),
`data-invalid` / `data-disabled` / `data-readonly` / `data-required` (present-when-true),
plus derived `maxlength` and `inputmode`.

### Exported engine functions (FR-017 reuse surface for `phone-input`)

`MASK_PATTERNS`, `applyMask`, `applyCurrencyMask`, `applyPercentageMask`, `getUnmaskedValue`,
`toUnmaskedIndex`, `fromUnmaskedIndex` — signatures byte-identical to upstream — plus
`resolveMaskPattern`, `isCurrencyMask`, `isCurrencyAtEnd`, `getCurrencyCaretPosition`,
`getPatternCaretPosition`, `MASK_PATTERN_KEYS`, `DEFAULT_CURRENCY`, `DEFAULT_LOCALE`.

### Exported types

`MaskInputProps`, `MaskInputRootProps`, `MaskInputChildProps`, `MaskPattern`, `MaskPatternKey`,
`TransformOptions`, `ValidateOptions`, `MaskInputValidationMode`, `MaskInputState`,
`MaskInputStateProps`.

## Implementation Phases (what `/speckit-tasks` will expand)

| Phase | Deliverable                                                                                                     | Gates it must satisfy      |
| ----- | --------------------------------------------------------------------------------------------------------------- | -------------------------- |
| A     | `mask-engine.ts` — all 15 patterns, `Intl` caches, mask/unmask/caret helpers, full JSDoc from upstream            | FR-004/005/008/009/017     |
| B     | Engine-only tests (upstream "Utility Functions" + "MASK_PATTERNS validation" blocks, fake timers for date/expiry) | US5, SC-005, R-12          |
| C     | `mask-input.svelte.ts` — `MaskInputState`, derived display/placeholder/inputMode/maxLength, all event methods     | FR-001/003/010/011/013/014/015 |
| D     | `mask-input.svelte` — props types + JSDoc, attribute bag, `{#if child}` branch, one-way `value=`                  | FR-001/002/012/018, VIII   |
| E     | `index.ts` barrel                                                                                                | FR-020, V                  |
| F     | `mask-input.test.svelte` harness + `mask-input.test.ts` — all 19 quickstart scenarios, upstream assertions first  | III, VII, SC-002/003/004/007 |
| G     | `src/routes/docs/components/mask-input/+page.svelte` — 5 sections + props table                                   | FR-021, SC-006, IX         |
| H     | `registry.json` entry + `pnpm run registry:build`                                                                | FR-020, V                  |
| I     | Four quality gates to green, no suppressions                                                                     | VI, VII                    |

Ordering constraint: A → B and A → C → D → E → F; G depends on E; H depends on D+E; I is last.
B is independent of C–E and can run as soon as A lands.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

**No violations.** Principle IV is satisfied, not waived: both pieces of bespoke behaviour carry the
written justification the principle demands (primitive evaluated + specific capability lacking), which
is the compliant path, so nothing is carried forward here. Principles II, VI and VII — which admit no
exception — are PASS.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | none      | —          | —                                      |
