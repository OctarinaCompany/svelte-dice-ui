# Implementation Plan: Port Tags Input

**Branch**: `022-port-tags-input` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-port-tags-input/spec.md`

## Summary

Port Dice UI's `TagsInput` to Svelte 5 as the registry item `tags-input`. The port is the **union** of
the two upstream sources: `.reference/diceui/packages/tags-input` supplies the behaviour (controllable
value, add/validate/dedupe/max pipeline, paste splitting, delimiter-on-type, `addOnTab`, `blurBehavior`,
in-place editing, the caret-aware keyboard state machine, form control) and
`.reference/diceui/docs/registry/bases/radix/ui/tags-input.tsx` supplies the default styling that each
part carries, re-expressed in this project's semantic tokens.

Technical approach: one `TagsInputRootState` class in `tags-input.svelte.ts` holds every reactive input
as a getter function and owns the add / update / remove / navigate logic; a `TagsInputItemState` class
holds per-item derivations; both are published through `Symbol`-keyed contexts whose getters throw the
documented error. Direction resolution reuses `$lib/components/ui/direction-provider`; form association
reuses `FormControlState` from `$lib/components/ui/checkbox-group`. No new npm dependency.

## Technical Context

**Language/Version**: TypeScript 5 (strict, `verbatimModuleSyntax`) on Svelte 5 (runes forced on in
`vite.config.ts`) / SvelteKit 2

**Primary Dependencies**: `@lucide/svelte` (the `X` icon that `<TagsInput.ItemDelete>` renders by
default, matching the upstream registry component). Existing registry items reused:
`direction-provider` (`useDirection`) and `checkbox-group` (`FormControlState`). **Zero new npm
dependencies** — `bits-ui` ships no tags-input primitive and nothing else in the port needs one.

**Storage**: N/A — component state only; the tag list lives in the caller's runes state or in the root's
`$bindable` prop.

**Testing**: Vitest (jsdom, `globals: false`, `expect.requireAssertions`) + `@testing-library/svelte` +
`@testing-library/user-event`, with a `tags-input.test.svelte` harness for the compositions a `.ts` spec
cannot express (`bind:value`, a `<form>` ancestor, a part rendered with no provider).

**Target Platform**: Browsers supported by SvelteKit 2; SSR-safe (no DOM access during
initialisation — every DOM read happens in an event handler or `$effect`).

**Project Type**: shadcn-svelte registry component (source-distributed) plus its docs route.

**Performance Goals**: No measurable regression against the other ported components. Navigation and
validation are O(n) over the tag list, which is bounded by `max`; there is no observer, timer or
document-level listener in the component.

**Constraints**: Constitution v1.0.0 — runes only, upstream parity, WAI-ARIA + full keyboard + RTL,
composition over reimplementation, strict TypeScript with no suppressions, semantic tokens only, one
`<ComponentPreview>` per upstream example, all four quality gates green.

**Scale/Scope**: 9 component files + 1 state module + 1 barrel, ~7 public parts, 4 demo sections,
1 registry entry.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                                            |
| ---- | ----------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$effect`/`$props`/`$bindable` + snippets only; all non-markup logic in `tags-input.svelte.ts` as state classes fed by getter functions. No store, no `export let`, no `createEventDispatcher`, no `<slot>`.      |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | Both upstream sources, the MDX, all four demos and the upstream test file read at the pinned commit; every prop, data attribute and key is reproduced (see Public API). Eight deliberate divergences, all already in spec Assumptions, are tabled below. |
| III  | Accessibility Is a MUST             | PASS    | Label ↔ input association, `aria-labelledby`/`aria-controls`/`aria-current`/`aria-disabled`/`aria-readonly` wiring per the MDX; the full key set (`Enter` `Escape` `Backspace` `Delete` `ArrowLeft` `ArrowRight` `Home` `End` `Tab`) driven through `user-event`; RTL inversion; all six §7 test areas planned. |
| IV   | Composition Over Reimplementation   | PASS    | `useDirection` (direction-provider) and `FormControlState` (checkbox-group) composed instead of re-porting `useDirection`/`useFormControl`; `@lucide/svelte` for the icon. Bespoke behaviour justified below.                          |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder `src/lib/components/ui/tags-input/`, one part per file, `index.ts` barrel with short names + prefixed aliases + types, one `registry:ui` entry listing all 10 non-test files, `.js` extensions on every intra-repo import, no import from `src/routes/**` or `$lib/components/docs/**`. |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Every part's props type declared and exported from `<script lang="ts" module>`, derived from `WithElementRef<…>`; no `any`, no ignore comment, no config change.                                                                      |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit -- --run` → `build` scheduled as the final task; no test skipped, `.todo`-ed or emptied.                                                                                                     |
| VIII | Styling Discipline                  | PASS    | `cn()` with the caller's `class` merged last; upstream's `zinc-*`/`dark:` classes mapped to `border-input`/`bg-accent`/`text-accent-foreground`/`ring-ring`/`text-muted-foreground`; `data-slot` on every part; every state exposed as a `data-*` attribute written `cond ? '' : undefined`. |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/tags-input/+page.svelte` with one `<ComponentPreview>` per upstream demo file (`tags-input-demo`, `tags-input-editable-demo`, `tags-input-validation-demo`, `tags-input-sortable-demo`) plus per-part props tables (SC-005). |
| X    | One Feature Directory Per Component | PASS    | All planning artifacts written to `specs/022-port-tags-input/` only; no git write command is run by any task.                                                                                                                        |

**Bespoke behaviour justification (Principle IV)**:

| Bespoke piece                                                                | Primitive evaluated                                                                          | Capability it lacks                                                                                                                                                              |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The whole tags widget (root/item/input/clear + add-validate-dedupe pipeline) | `bits-ui` (full export surface reviewed), `$lib/components/ui/*` (58 folders reviewed)       | Neither ships a tags-input / token-input primitive at all. Nothing to compose; the behaviour is the component.                                                                    |
| Caret-aware highlight state machine (`TagsInputRootState.onInputKeydown`)    | `bits-ui` roving-focus internals, `segmented-input`'s `SegmentNavigation`                    | Both move DOM focus between focusable children. Here focus never leaves the text input — the "highlight" is a `data-*` state on a non-focusable `<div>`, gated on `selectionStart === 0`. |
| Per-item disabled tracking (`getEnabledItems` replacement)                   | `bits-ui` collection helpers, a DOM query over `[data-slot="tags-input-item"]`               | The tags input's items *are* its value array; a DOM collection adds an ordering/timing dependency for information the root already holds. Registration by tag value is exact and SSR-safe. |
| Clear-button presence (`forceMount`)                                         | upstream `Presence`, `bits-ui` `Presence`/`Portal`                                           | `bits-ui`'s presence utilities are bound to its own open-state primitives. `{#if forceMount \|\| count > 0}` reproduces the documented behaviour exactly; `forceMount` remains the escape hatch for exit animations. |
| Hidden form-associated input                                                 | `bits-ui` `HiddenInput`, `checkbox-group`'s per-item input                                   | `FormControlState` from `checkbox-group` **is** composed (form detection); only the markup — one clipped input carrying the joined value — is written here, exactly as `phone-input` does. |

**Deliberate divergences from upstream (Principle II — all pre-recorded in spec Assumptions)**:

| #   | Upstream                                                                                             | Here                                                                                          | Why                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 | `children` may be `({ value }) => ReactNode`                                                         | plain `Snippet`                                                                               | Svelte reactivity re-renders a consumer's `{#each value}` without threading the value through a render prop — the render prop's only purpose. |
| D-2 | `TagsInputList` (styled `<div>` in the registry component)                                           | not a part; the demo reproduces its classes inline                                            | Carries no state or behaviour; spec Assumptions §2.                                                                                          |
| D-3 | `onItemUpdate` stores `displayValue(trimmed)`                                                        | stores the raw trimmed value                                                                  | Spec Edge Cases + FR-013: `displayValue` is render-only. Upstream leaks the display transform into the value on edit.                         |
| D-4 | Upstream's own test asserts editing **appends** a second tag                                         | editing **replaces** the tag in place                                                          | Spec US4 AS-2 / FR-009 and the MDX both document replace; the append is an upstream blur-ordering defect encoded in its test.                 |
| D-5 | `findNextEnabledIndex` maps enabled *positions* onto value *indices*                                 | navigates real value indices, skipping disabled ones                                          | Identical when no item is disabled (every upstream demo); upstream's mapping is off-by-shift once one is. FR-008 + spec Assumptions.          |
| D-6 | `aria-labelledby={labelId}` on the input unconditionally                                             | emitted only while a `<TagsInput.Label>` is mounted                                            | Otherwise the input's accessible name resolves to a dangling id and any caller `aria-label` is shadowed. Same `registerLabel` pattern as `checkbox-group`. |
| D-7 | `VisuallyHiddenInput` renders `type="hidden"`                                                        | a clipped `type="text"` input                                                                  | `type="hidden"` is barred from constraint validation, so FR-016's native `required` block is unreachable. Matches `checkbox-group`'s clipped input. |
| D-8 | `TagsInputItem` highlights on `click` for touch/pen and on `pointerup` for mouse                     | a single `onpointerup` handler for every pointer type                                          | Svelte pointer events already normalise touch/pen/mouse; a split `onclick`/`onmousedown` pair would race the root's `onmousedown` `preventDefault()` (D-6/R-16 focus-stealing guard). |

None of these is a Constitution violation: II requires divergences to be *recorded*, and each is in the
spec's Assumptions section with its upstream name and reason. Complexity Tracking is therefore empty.

## Public API

Every part exports its props type from `<script lang="ts" module>`; all types are re-exported from
`index.ts`. `ref` is `$bindable(null)` on every part and applied with `bind:this`. Every part spreads
`...restProps` onto its element and merges the caller's `class` last.

### `Root` — `tags-input.svelte` (`TagsInput`, `TagsInputRootProps`, alias `TagsInputProps`)

Base: `WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'dir'>, HTMLDivElement>`.

| Prop            | Type                                    | Default                     | Bindable | Notes                                                                                     |
| --------------- | --------------------------------------- | --------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| `value`         | `string[]`                              | —                           | **yes**  | Controlled tag list. `bind:value`, or the function binding to stay authoritative.          |
| `defaultValue`  | `string[]`                              | `[]`                        | no       | Seeds `value` once when uncontrolled (`value ??= untrack(() => defaultValue)`).            |
| `onValueChange` | `(value: string[]) => void`             | —                           | no       | Fires on every committed change, controlled or not.                                        |
| `onValidate`    | `(value: string) => boolean`            | —                           | no       | Returning `false` rejects the tag.                                                         |
| `onInvalid`     | `(value: string) => void`               | —                           | no       | Called for every rejection: over-`max`, `onValidate` false, duplicate.                     |
| `displayValue`  | `(value: string) => string`             | `(value) => value.toString()` | no     | Render-only (D-3).                                                                         |
| `addOnPaste`    | `boolean`                               | `false`                     | no       | Paste splits on `delimiter` instead of inserting natively.                                 |
| `addOnTab`      | `boolean`                               | `false`                     | no       | `Tab` with text adds instead of moving focus.                                              |
| `disabled`      | `boolean`                               | `false`                     | no       | Suppresses every interaction.                                                              |
| `editable`      | `boolean`                               | `false`                     | no       | Enables in-place editing.                                                                  |
| `loop`          | `boolean`                               | `false`                     | no       | Wraps navigation last↔first.                                                               |
| `blurBehavior`  | `'add' \| 'clear' \| undefined`         | `undefined`                 | no       | Unset leaves the typed text in the input.                                                  |
| `delimiter`     | `string`                                | `','`                       | no       | Splits pasted text; typing it also commits the tag.                                        |
| `max`           | `number`                                | `Number.POSITIVE_INFINITY`  | no       | Cap on tag count.                                                                          |
| `required`      | `boolean`                               | `false`                     | no       | Form validity; an empty required list blocks submit.                                       |
| `readOnly`      | `boolean`                               | `false`                     | no       | Focusable and selectable, but no add/remove/clear/edit.                                    |
| `name`          | `string`                                | —                           | no       | Field name of the hidden form input.                                                       |
| `dir`           | `Direction` (`'ltr' \| 'rtl'`)          | provider → DOM `[dir]` → `'ltr'` | no  | Inverts horizontal keys.                                                                   |
| `id`            | `string`                                | `$props.id()`               | no       | Root id; `inputId`/`labelId` derive from it.                                               |
| `ref`           | `HTMLDivElement \| null`                | `null`                      | **yes**  |                                                                                            |
| `children`      | `Snippet`                               | —                           | no       | D-1.                                                                                       |

Handlers: `onclick` (focus the text input when `getIsClickedInEmptyRoot(target)`), `onmousedown`
(`preventDefault()` in the same case so the root never steals focus), `onblur` (clear `highlightedIndex`
when `event.relatedTarget` is neither the input nor inside the root). Each composes the caller's handler
first and honours `defaultPrevented` (research R-16).

Data attributes: `data-slot="tags-input"`, `data-disabled`, `data-invalid`, `data-readonly`, plus `dir`.

### `Label` — `tags-input-label.svelte` (`TagsInputLabel`, `TagsInputLabelProps`)

Base: `WithElementRef<HTMLLabelAttributes, HTMLLabelElement>`. No component-specific props. Renders
`id={labelId} for={inputId}`; registers itself with the root for the duration of its mount (D-6).
Data attributes: `data-slot="tags-input-label"`, `data-disabled`.

### `Input` — `tags-input-input.svelte` (`TagsInputInput`, `TagsInputInputProps`)

Base: `WithElementRef<Omit<HTMLInputAttributes, 'value' | 'type' | 'disabled' | 'readonly' | 'dir'>, HTMLInputElement>`.
No component-specific props (the typed text is uncontrolled DOM state, as upstream). Emits
`id={inputId}`, `type="text"`, `autocapitalize="off"`, `autocomplete="off"`, `autocorrect="off"`,
`spellcheck="false"`, `aria-labelledby` (while a Label is mounted), `aria-readonly`, `disabled`,
`readonly`, `dir`. Handlers: `oninput` (delimiter commit), `onkeydown` (Enter / Tab / navigation /
typing clears the highlight), `onpaste` (`addOnPaste`), `onblur` (`blurBehavior`). Each composes the
caller's handler first and honours `defaultPrevented`.
Data attributes: `data-slot="tags-input-input"`, `data-invalid`.

### `Item` — `tags-input-item.svelte` (`TagsInputItem`, `TagsInputItemProps`)

Base: `WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement>`.

| Prop       | Type      | Default | Bindable | Notes                                                       |
| ---------- | --------- | ------- | -------- | ------------------------------------------------------------- |
| `value`    | `string`  | —       | no       | **Required.** Identifies the tag; index is `value.indexOf()`. |
| `disabled` | `boolean` | `false` | no       | Independent of the root's `disabled`.                        |
| `children` | `Snippet` | —       | no       | Normally `<ItemText>` + `<ItemDelete>`.                      |

ARIA (spread as an object to stay out of the compiler's static role/aria analysis, exactly as
`checkbox-group.svelte` does): `aria-labelledby={textId}`, `aria-current`, `aria-disabled`.
Data attributes: `data-slot="tags-input-item"`, `data-state="active|inactive"`, `data-highlighted`,
`data-editing`, `data-editable`, `data-disabled`.

### `ItemText` — `tags-input-item-text.svelte` (`TagsInputItemText`, `TagsInputItemTextProps`)

Base: `WithElementRef<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>`. `children?: Snippet` falls
back to the item's `displayValue`. While the item is editing (and the root is `editable` and the item
is not disabled) it renders `tags-input-item-edit.svelte` instead.
Data attribute: `data-slot="tags-input-item-text"`, `id={textId}`.

### `ItemDelete` — `tags-input-item-delete.svelte` (`TagsInputItemDelete`, `TagsInputItemDeleteProps`)

Base: `WithElementRef<Omit<HTMLButtonAttributes, 'type'>, HTMLButtonElement>`. `children?: Snippet`
falls back to an `X` icon from `@lucide/svelte` (the registry component's content). Renders nothing
while its item is editing. Emits `type="button"`, `tabindex={disabled ? undefined : -1}` (upstream's
inversion, preserved), `aria-labelledby={textId}`, `aria-controls={itemId}`, `aria-current`.
Data attributes: `data-slot="tags-input-item-delete"`, `data-state`, `data-disabled`.

### `Clear` — `tags-input-clear.svelte` (`TagsInputClear`, `TagsInputClearProps`)

Base: `WithElementRef<Omit<HTMLButtonAttributes, 'type'>, HTMLButtonElement>`.

| Prop         | Type                                          | Default | Bindable | Notes                                                                        |
| ------------ | --------------------------------------------- | ------- | -------- | ------------------------------------------------------------------------------ |
| `forceMount` | `boolean`                                     | `false` | no       | Keeps the button mounted while the list is empty.                             |
| `child`      | `Snippet<[{ props: TagsInputClearChildProps }]>` | —     | no       | Replaces upstream `asChild`; used by the Editable demo to render a `Button`.  |
| `children`   | `Snippet`                                     | —       | no       | Not rendered in `child` mode.                                                 |

Emits `type="button"`, `aria-disabled`. Data attributes: `data-slot="tags-input-clear"`,
`data-state="visible|invisible"`, `data-disabled`.

### Internal (not exported from the barrel)

`tags-input-item-edit.svelte` — the inline edit field, upstream's `TagsInputEditableItemText`. It is a
separate file precisely so its `editValue = $state(displayValue)` re-initialises every time editing
starts. Listed in `registry.json` (Principle V), no public type.

### Module exports (`tags-input.svelte.ts`, re-exported by the barrel)

`TagsInputRootState`, `TagsInputItemState`, their `…StateProps` types,
`setTagsInputContext` / `getTagsInputContext(consumerName)`,
`setTagsInputItemContext` / `getTagsInputItemContext(consumerName)`,
and two pure helpers written to be reused by later collection-shaped ports (Combobox, Mention):
`splitByDelimiter(text, delimiter): string[]` and
`findAdjacentIndex({ current, count, direction, loop, isEnabled }): number | null` — **deliverable 5**.

## Project Structure

### Documentation (this feature)

```text
specs/022-port-tags-input/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── tags-input-api.md
├── checklists/
│   └── requirements.md  # from /speckit-specify
├── spec.md
└── tasks.md             # /speckit-tasks output — NOT created here
```

### Source Code (repository root)

```text
src/lib/components/ui/tags-input/
├── index.ts                        # barrel: short names + prefixed aliases + prop types + state module
├── tags-input.svelte               # Root
├── tags-input-label.svelte         # Label
├── tags-input-input.svelte         # Input
├── tags-input-item.svelte          # Item
├── tags-input-item-text.svelte     # ItemText
├── tags-input-item-edit.svelte     # internal inline edit field
├── tags-input-item-delete.svelte   # ItemDelete
├── tags-input-clear.svelte         # Clear
├── tags-input.svelte.ts            # state classes + Symbol contexts + pure helpers
├── tags-input.test.svelte          # harness (NOT in registry.json, not collected by Vitest)
└── tags-input.test.ts              # colocated tests (NOT in registry.json)

src/routes/docs/components/tags-input/
└── +page.svelte                    # 4 <ComponentPreview> sections + 7 props tables

registry.json                       # append exactly one registry:ui entry named "tags-input"
```

**Structure Decision**: folder slug `tags-input` == demo route segment == registry item name. Upstream
mapping:

| File                            | Upstream counterpart                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `tags-input.svelte`             | `packages/tags-input/src/tags-input-root.tsx` + registry `TagsInput` wrapper                       |
| `tags-input-label.svelte`       | `packages/tags-input/src/tags-input-label.tsx` + registry `TagsInputLabel`                         |
| `tags-input-input.svelte`       | `packages/tags-input/src/tags-input-input.tsx` + registry `TagsInputInput`                         |
| `tags-input-item.svelte`        | `packages/tags-input/src/tags-input-item.tsx` + registry `TagsInputItem`                           |
| `tags-input-item-text.svelte`   | `packages/tags-input/src/tags-input-item-text.tsx` (`TagsInputItemText`)                           |
| `tags-input-item-edit.svelte`   | `packages/tags-input/src/tags-input-item-text.tsx` (`TagsInputEditableItemText`)                   |
| `tags-input-item-delete.svelte` | `packages/tags-input/src/tags-input-item-delete.tsx` + registry `ItemDelete` styling and `X` icon  |
| `tags-input-clear.svelte`       | `packages/tags-input/src/tags-input-clear.tsx` + registry `TagsInputClear`                         |
| `tags-input.svelte.ts`          | root's `useState`/`useCallback` block, `useControllableState`, `useItemCollection`, `createContext` |
| demo route                      | `docs/registry/bases/radix/examples/tags-input-{,editable-,validation-,sortable-}demo.tsx`         |
| _(not ported — D-2)_            | registry `TagsInputList`                                                                           |

Registry entry: `registryDependencies: ["direction-provider", "checkbox-group"]` (the two cross-component
imports, as required by the import/registryDependency verifier), `dependencies: ["@lucide/svelte"]`,
`files`: the 10 non-test files above.

## Implementation Phases

Ordered so each phase is independently verifiable; `/speckit-tasks` expands these into tasks.

1. **State module** — `tags-input.svelte.ts`: `splitByDelimiter`, `findAdjacentIndex`,
   `TagsInputRootState` (value accessors, `highlightedIndex`, `editingIndex`, `isInvalidInput`,
   label/item registration, `addItem`, `updateItem`, `removeItem`, `leaveItem`, `onInputKeydown`),
   `TagsInputItemState`, both Symbol contexts with throwing getters.
2. **Tests** — `tags-input.test.svelte` harness + `tags-input.test.ts` covering the six §7 areas; every
   upstream test assertion ported first (adjusted for D-3/D-4/D-5 with a one-line reason), then the
   Svelte-specific ones. Written and confirmed failing before the Parts phase begins (test-first, per
   Principles III/VII).
3. **Parts** — Root (context, direction, form input) → Label → Input → Item → ItemText → ItemEdit →
   ItemDelete → Clear → `index.ts` barrel.
4. **Demo route** — 4 `<ComponentPreview>` sections + 7 props tables.
5. **Registry** — append the entry, run `pnpm run registry:build`.
6. **Gates** — `format` → `check` → `lint` → `test:unit -- --run` → `build`.

## Complexity Tracking

> No Constitution violation is carried forward. Every divergence from upstream is recorded in the
> spec's Assumptions section and tabled under Constitution Check above, which is what Principle II
> requires; Principles IV and IX are satisfied rather than waived.

_(intentionally empty)_
