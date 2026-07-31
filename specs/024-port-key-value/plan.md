# Implementation Plan: Key Value

**Branch**: `024-port-key-value` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-port-key-value/spec.md`

## Summary

Port Dice UI's `key-value` — a dynamic list of key/value rows with multi-format paste expansion,
per-row validation and duplicate-key detection — to Svelte 5 as a shadcn-svelte registry item.

Upstream is a single 867-line React file built on a hand-rolled `useSyncExternalStore` store, Radix
`Slot`, and always-open `<Input>` / `<Textarea>` controls. The port replaces the store with two
rune-based state classes behind `Symbol`-keyed contexts (research R-01), replaces
`React.Children.toArray` inside `value.map(...)` with a snippet rendered once per row by an internal
context provider (R-02), and — per FR-020 — composes the already-ported `editable` component for both
fields instead of raw inputs, which is also what makes the upstream MDX's documented `Enter` → submit
and `Escape` → cancel keyboard rows real rather than aspirational (R-03).

Behaviour that is genuinely upstream's — the paste grammar, the four-step validation routine, the
splice-and-truncate insertion rule, `minItems` / `maxItems` gating — is ported line-for-line and pulled
into pure, directly testable functions where possible. Thirteen deliberate divergences are enumerated
in [`contracts/public-api.md`](./contracts/public-api.md#complete-divergence-register); all are
recorded in the spec's Assumptions section and cross-indexed there.

Zero new npm dependencies.

## Technical Context

**Language/Version**: TypeScript 5 (strict, `verbatimModuleSyntax`), Svelte 5 with runes forced on
repo-wide in `vite.config.ts`

**Primary Dependencies**: SvelteKit 2, Tailwind CSS v4, `@lucide/svelte`; in-repo
`$lib/components/ui/{editable,button,direction-provider,checkbox-group}`. `bits-ui` is available but
**not used** here — no bits-ui primitive models a key/value row list (R-15).

**Storage**: N/A — component state only; optional native form participation via a clipped
`type="text"` input (R-10)

**Testing**: Vitest (jsdom) + `@testing-library/svelte` + `@testing-library/user-event`,
`globals: false`, `expect.requireAssertions` on; colocated at
`src/lib/components/ui/key-value/key-value.test.ts` with a `key-value.test.svelte` harness

**Target Platform**: browsers with SSR-safe rendering (SvelteKit); no `crypto.randomUUID` dependency
(R-11)

**Project Type**: component library shipped as source through a shadcn-svelte registry

**Performance Goals**: N/A beyond the framework's — per-row `$derived` reads mean a keystroke in row 2
does not invalidate row 1 (data-model §3)

**Constraints**: constitution Principles I–X; zero new npm dependencies; no suppressions of any kind;
`.reference/` and `scripts/` read-only; no git write commands

**Scale/Scope**: 8 public parts + 1 internal provider + 1 state module + 1 barrel; ~30 test scenarios
(quickstart §3); 4 demo sections

No `NEEDS CLARIFICATION` items remain — every unknown was resolved in Phase 0 and recorded in
`research.md`.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                             |
| ---- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$effect`/`$props`/`$bindable` + snippets only; all reactive logic in `key-value.svelte.ts` as `KeyValueRootState` / `KeyValueItemState` taking getter functions. No stores, `export let`, `createEventDispatcher`, `$:` or legacy slots. |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | `key-value.tsx` + `key-value.mdx` + all four `key-value-*-demo.tsx` read at pin `d9763d8`; upstream ships no test file. Every documented prop, callback, data attribute and keyboard row is reproduced (see contract). All 13 divergences recorded in the spec's Assumptions section and cross-indexed in the divergence register; JSDoc `@default` tags copied onto the prop types. |
| III  | Accessibility Is a MUST             | PASS    | `role="list"` / `role="listitem"`; `role="alert"` on errors; `aria-invalid` + `aria-describedby` → the error id on both the control **and** its preview; `aria-disabled` on disabled previews. Keyboard map `Tab`/`Enter`/`Escape`/`Ctrl+V` driven through `user-event`. All six mandatory test areas scheduled in Phase 3 below; RTL asserted. |
| IV   | Composition Over Reimplementation   | PASS    | `editable` composed for both fields (FR-020, R-03), `button` for add/remove, `direction-provider` for RTL, `checkbox-group`'s `FormControlState` for form detection. Remaining bespoke code justified below. |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder `src/lib/components/ui/key-value/`, one part per file, `key-value.svelte.ts`, `index.ts` barrel with short names + prefixed aliases + types, `.js` extensions on every intra-repo import, exactly one `registry:ui` entry, no import from `src/routes/**` or `$lib/components/docs/**`. |
| VI   | TypeScript Strict, No Suppressions  | PASS    | No `any` anywhere; props typed from `WithElementRef<HTMLAttributes<…>>` / `HTMLInputAttributes` / `HTMLTextareaAttributes`; every `Props` type exported from `<script lang="ts" module>`. No `@ts-ignore` / `@ts-expect-error` / `eslint-disable` / `svelte-ignore`; no config loosened. R-09 removes an upstream ARIA attribute rather than silencing the warning it causes. |
| VII  | Green Gate Before Commit            | PASS    | Phase 5 runs `format` → `check` → `lint` → `test:unit --run` → `build`. No `.skip` / `.todo` / `.only`; `expect.requireAssertions` means every `it` asserts. |
| VIII | Styling Discipline                  | PASS    | `cn()` everywhere, caller `class` merged last; semantic tokens only (`text-destructive`, `border-input`, `text-muted-foreground` — upstream uses no palette colours here); no `dark:`, no `space-*`, no manual `z-index`; `data-slot` on every part; booleans written `cond ? '' : undefined`. `tv()` not needed — no part has variants. |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/key-value/+page.svelte` with exactly four `<ComponentPreview>` sections, one per `key-value-*-demo.tsx`, plus per-part props tables and the keyboard table, matching the `editable` page's layout. No `+page.ts`. |
| X    | One Feature Directory Per Component | PASS    | All artifacts under `specs/024-port-key-value/`; no other feature directory touched, no renumbering, no git write commands, nothing written under `.reference/`, `scripts/`, `.port-*`. |

**Bespoke behaviour justification (Principle IV)**: four pieces of hand-written behaviour, each with the
primitive that was evaluated and what it lacks.

1. **The row store, paste parser and validation routine** (`key-value.svelte.ts`). Evaluated:
   `bits-ui` (no primitive models an editable list of key/value rows, and none exposes `KEY=VALUE`
   clipboard parsing or per-row validators) and `$lib/components/ui/tags-input` (single-string items,
   no second field, no per-item error record). This *is* the component; there is nothing to compose.
2. **Focus transfer on add / remove / paste** (`KeyValueRootState.focusRequestId` + the consuming
   `$effect` in `KeyValue.KeyInput`). Evaluated: `editable` — it owns focus *within* one field
   (`editable-input.svelte:87-98`) but has no concept of a sibling field, so moving focus from a
   removed row to its neighbour cannot come from it. Upstream sets `focusedId` and never focuses
   anything, so FR-002 and US1.3 are unmet upstream and must be added (R-08).
3. **Focus-and-select for the value `<textarea>`** (~4 lines). `Editable.Input`'s `child` mode is
   documented to hand `ref` — "and with it the focus-and-select-on-edit-start behaviour" — back to the
   caller (`editable-input.svelte:38-44`). Using `child` is mandatory because `Editable.Input` renders
   an `<input>` and FR-018 requires a growing `<textarea>` (R-04).
4. **Trailing-whitespace push-back** (~2 lines per field). With `trim` on, a keystroke the state
   rejects leaves the DOM ahead of the state because Svelte skips an unchanged attribute;
   `editable-input.svelte:112-128` documents the identical hazard but only guards its own
   disabled/read-only case (R-13).

**Post-Phase-1 re-check**: re-evaluated after `research.md`, `data-model.md`,
`contracts/public-api.md` and `quickstart.md` were written. All ten verdicts stand; no verdict changed
and **Complexity Tracking stays empty**. The two design decisions that could have become violations
were resolved in favour of the constitution rather than against it: dropping upstream's unsupported
`aria-orientation` (R-09) instead of suppressing the resulting `svelte-check` warning, and composing
`editable` through its sanctioned `child` snippet (R-04) instead of editing the already-shipped
`editable` folder, which Principle X would have forbidden.

## Project Structure

### Documentation (this feature)

```text
specs/024-port-key-value/
├── plan.md                  # This file
├── spec.md                  # Input
├── research.md              # Phase 0 — R-01 … R-15
├── data-model.md            # Phase 1 — value types, state classes, parsers, contexts
├── quickstart.md            # Phase 1 — validation guide, 30-scenario checklist
├── contracts/
│   └── public-api.md        # Phase 1 — every export, prop, snippet, callback, divergence
├── checklists/
│   └── requirements.md      # from /speckit-specify
└── tasks.md                 # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/key-value/
├── index.ts                          # barrel: short names + prefixed aliases + prop types + state exports
├── key-value.svelte                  # Root            ← KeyValue          (key-value.tsx:168-322)
├── key-value-list.svelte             # List            ← KeyValueList      (:328-359)
├── key-value-item-provider.svelte    # internal per-row context provider   (replaces :352 ItemContext.Provider)
├── key-value-item.svelte             # Item            ← KeyValueItem      (:375-392)
├── key-value-key-input.svelte        # KeyInput        ← KeyValueKeyInput  (:398-589)
├── key-value-value-input.svelte      # ValueInput      ← KeyValueValueInput(:597-712)
├── key-value-remove.svelte           # Remove          ← KeyValueRemove    (:716-764)
├── key-value-add.svelte              # Add             ← KeyValueAdd       (:766-824)
├── key-value-error.svelte            # Error           ← KeyValueError     (:830-853)
├── key-value.svelte.ts               # KeyValueRootState + KeyValueItemState + contexts
│                                     #   ← Store/StoreContext/KeyValueContext (:54-138, :206-291)
│                                     #   + removeQuotes (:41-52) + paste parser (:487-525)
│                                     #   + getErrorId (:37-39) + id minting (:209)
├── key-value.test.svelte             # test harness (snippet plumbing), like editable/tags-input
└── key-value.test.ts                 # colocated tests — NOT listed in registry.json

src/routes/docs/components/key-value/
└── +page.svelte                      # 4 <ComponentPreview> sections + props tables + keyboard table

registry.json                         # append exactly one registry:ui entry named "key-value"
```

**Structure Decision**: eleven files ship, ten of them public parts plus the state module; the
`key-value-item-provider.svelte` is internal (shipped, not exported) and exists only because Svelte
context must be set during a component's initialisation, so the per-row provider cannot be
`KeyValueItem` (R-02). Folder slug `key-value` == demo route segment `key-value` == registry item name
`key-value`. `key-value.test.ts` and `key-value.test.svelte` are excluded from the registry entry.

## Public API

Full detail — every prop's type, default, bindability, snippets, callbacks, data attributes, thrown
errors and the divergence register — is in **[`contracts/public-api.md`](./contracts/public-api.md)**.
Summary:

| Component            | Own props (beyond DOM + `ref` + `...restProps`)                                                                                                                                                                                                                                                                          | Snippets   | Callbacks                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------- |
| `KeyValue.Root`      | `value` **(bindable)**, `defaultValue` = one empty row, `maxItems`, `minItems` = `0`, `keyPlaceholder` = `"Key"`, `valuePlaceholder` = `"Value"`, `allowDuplicateKeys` = `false`, `enablePaste` = `true`, `trim` = `true`, `stripQuotes` = `true`, `disabled` = `false`, `readOnly` = `false`, `required` = `false`, `name`, `id`, `dir` | `children` | `onValueChange`, `onPaste`, `onAdd`, `onRemove`, `onKeyValidate`, `onValueValidate` |
| `KeyValue.List`      | `orientation` = `"vertical"`                                                                                                                                                                                                                                                                                             | `children` (the row template, rendered once per row) | — |
| `KeyValue.Item`      | —                                                                                                                                                                                                                                                                                                                        | `children` | —                                                                             |
| `KeyValue.KeyInput`  | `disabled`, `readOnly`, `required` (each OR-ed with the root's)                                                                                                                                                                                                                                                          | —          | `onpaste` (caller's runs first; `preventDefault()` suppresses the built-in)   |
| `KeyValue.ValueInput`| `maxRows`, `disabled`, `readOnly`, `required`                                                                                                                                                                                                                                                                            | —          | —                                                                             |
| `KeyValue.Remove`    | inherits `ButtonProps`; `variant="outline" size="icon" type="button"`                                                                                                                                                                                                                                                    | `children` = `<XIcon />` | `onclick` (runs first, does not suppress removal — upstream parity) |
| `KeyValue.Add`       | inherits `ButtonProps`; `variant="outline" type="button"`                                                                                                                                                                                                                                                                | `children` = `<PlusIcon /> Add` | `onclick` (same)                                       |
| `KeyValue.Error`     | `field: "key" \| "value"`                                                                                                                                                                                                                                                                                                | —          | —                                                                             |

`value` is the only bindable prop besides each part's `ref`. Exported types:
`KeyValueRootProps` (+ `KeyValueProps` alias), `KeyValueListProps`, `KeyValueItemProps`,
`KeyValueKeyInputProps`, `KeyValueValueInputProps`, `KeyValueRemoveProps`, `KeyValueAddProps`,
`KeyValueErrorProps`, plus `KeyValueItemData`, `KeyValueField`, `KeyValueOrientation`,
`KeyValueItemErrors`, `KeyValueErrors`, `KeyValueRootStateProps`.

Exported runtime values (the module this port must publish for later components to reuse):
`KeyValueRootState`, `KeyValueItemState`, `setKeyValueContext` / `getKeyValueContext`,
`setKeyValueItemContext` / `getKeyValueItemContext`, `createKeyValueItemId`, and the two pure parsers
`parseKeyValueText` / `stripSurroundingQuotes`. `getKeyValueContext` is this port's replacement for
upstream's exported `useKeyValueStore`.

## Implementation Phases

Ordering for `/speckit-tasks`; every phase is verifiable on its own.

**Phase 1 — state module.** `key-value.svelte.ts`: value types, `createKeyValueItemId`,
`stripSurroundingQuotes`, `parseKeyValueText`, `KeyValueRootState`, `KeyValueItemState`, both contexts
with throwing getters. Pure functions land first so their tests can run before any component exists.

**Phase 2 — parts.** Root → List + internal provider → Item → KeyInput → ValueInput → Remove → Add →
Error → `index.ts`. KeyInput before ValueInput because the latter reuses its `Editable` wiring with the
`child`-snippet textarea on top.

**Phase 3 — tests** (`key-value.test.ts` + `key-value.test.svelte`), covering all six constitution
areas plus the 30 scenarios in [`quickstart.md`](./quickstart.md#3-scenario-checklist):
roles/ARIA · accessible names · keyboard through `user-event` · RTL · uncontrolled `defaultValue` ·
controlled `value` + `onValueChange` · `disabled`/`readOnly` guard rails · each part's
out-of-provider throw · paste grammar (unit, on the pure parser) · duplicate-key rules including the
empty-key exemption · add/remove focus destinations · `minItems`/`maxItems` gating · error clearing on
remove · form serialisation.

**Phase 4 — docs route and registry.** `src/routes/docs/components/key-value/+page.svelte` with the
four `<ComponentPreview>` sections, per-part props tables and the keyboard table; then the
`registry.json` entry (`registryDependencies: ["editable", "button", "direction-provider",
"checkbox-group"]`, `dependencies: ["@lucide/svelte"]`, all eleven non-test files) and
`pnpm run registry:build`.

**Phase 5 — quality gates.** `pnpm run format` → `check` → `lint` → `test:unit -- --run` → `build`,
all green, nothing suppressed.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

**Empty — no principle violations are carried forward.** All ten verdicts are PASS both before Phase 0
and after Phase 1 design. Bespoke behaviour under Principle IV is justified in writing above, which is
what that principle requires and is not itself a violation.
