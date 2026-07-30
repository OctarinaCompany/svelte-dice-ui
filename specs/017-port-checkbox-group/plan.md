# Implementation Plan: Checkbox Group

**Branch**: `017-port-checkbox-group` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-port-checkbox-group/spec.md`

**Upstream (pinned `d9763d82530416dfa4c81c462387b55d06bae4ec`)**:
`.reference/diceui/packages/checkbox-group/src/*.tsx` (7 part files — the behaviour),
`.reference/diceui/docs/registry/bases/radix/ui/checkbox-group.tsx` (117 lines — the shadcn styling),
`.reference/diceui/docs/types/radix/checkbox-group.ts` (the documented prop surface),
`.reference/diceui/docs/content/docs/components/radix/checkbox-group.mdx` (the API + data-attribute contract),
`.reference/diceui/packages/checkbox-group/test/checkbox-group.test.tsx` (270 lines, 11 tests),
`.reference/diceui/docs/registry/bases/radix/examples/checkbox-group{,-animated,-horizontal,-validation,-multi-selection}-demo.tsx`.

Supporting upstream plumbing read: `packages/shared/src/hooks/{use-controllable-state,use-form-control,use-form-reset,use-direction,use-id}.ts`,
`packages/shared/src/components/{visually-hidden-input,presence,primitive}.tsx`.

## Summary

Port Dice UI's `CheckboxGroup` — a `role="group"` container coordinating N `role="checkbox"` buttons
over one shared `string[]` value, with validation, read-only/disabled propagation, orientation, RTL,
and native form participation — to Svelte 5 runes as a shadcn-svelte registry item. This is the
project's **first form component**, so the hidden-input / `data-invalid` / `aria-describedby`
conventions it lands are the ones later form ports copy (§ "Form conventions established here").

Technical approach:

1. **One state class per compound level, on typed `Symbol` contexts.** `CheckboxGroupRootState` owns
   the value array, the validation message, the four shared ids and the label/description/message
   presence flags; `CheckboxGroupItemState` derives one item's checked / disabled / required /
   in-a-form state from the root plus its own props. Upstream's `createContext` pair, four `useId`
   calls, `useControllableState`, `useCallback`s and `useFormControl` all collapse into these two
   classes (R-01, R-02).
2. **`value` is `$bindable` with `value ??= defaultValue`**, the repo's established
   controlled/uncontrolled idiom (`speed-dial.svelte:91`). A parent that must stay authoritative and
   *decline* a change — spec US1 AS-5 — expresses that with Svelte's function binding
   `bind:value={get, set}`; the root never keeps a shadow copy of the value, so a setter that ignores
   the write leaves the rendered state untouched (R-03).
3. **The item is bespoke; everything it can borrow, it borrows.** `bits-ui`'s `Checkbox.Group` /
   `Checkbox.Root` were read line-for-line and rejected on four concrete, load-bearing gaps (see
   Principle IV justification below); the `<button role="checkbox">` and its visually-hidden
   `<input type="checkbox">` are therefore written here, while direction resolution composes this
   repo's `useDirection()` and the group label composes `bits-ui`'s `Label.Root` (R-04, R-05).
4. **Translate the React workarounds away instead of transliterating them.** Upstream's 50 ms
   click debounce exists because React's synthetic delegation can deliver the indicator's click twice;
   a Svelte listener bound to the button cannot, and a 50 ms window would instead swallow a genuine
   check→uncheck double-click (jsdom resolution makes that a live test failure, not a theoretical
   one). It is replaced by a proven one-toggle-per-click test (R-06). `useMemo`/`useCallback`/
   `useComposedRefs`/`Presence` are dropped outright (R-07).
5. **Fix the two upstream a11y defects rather than reproducing them.** Upstream emits
   `aria-describedby="<descriptionId> "` unconditionally — a dangling idref whenever no
   `Description` is rendered (and whenever `hideOnError` has removed it), which `axe`'s
   `aria-valid-attr-value` flags; and its registry item leaves the `<button>` nameless, relying on a
   wrapping `<label>` that HTML-AAM does not use to name a `button`. Parts register their ids while
   mounted so `aria-describedby`/`aria-labelledby` only ever reference rendered nodes, and the item
   renders its text *inside* the button (name from content) beside a dedicated
   `[data-slot="checkbox-group-item-box"]` (R-08, R-09).

Full rationale in [research.md](./research.md) (R-01…R-14); state classes, ids and data attributes in
[data-model.md](./data-model.md); the installable surface in
[contracts/public-api.md](./contracts/public-api.md); validation in [quickstart.md](./quickstart.md)
(V-1…V-12).

## Technical Context

**Language/Version**: TypeScript (strict, `verbatimModuleSyntax`), Svelte 5 with runes forced on
(`vite.config.ts`)

**Primary Dependencies**: SvelteKit 2, Tailwind CSS v4, `bits-ui@2.18.1` (`Label.Root` only),
`@lucide/svelte` (`check` icon), `clsx` + `tailwind-merge` via `cn()`. **No new npm dependency** —
nothing upstream needs one (`tailwind-variants` is not pulled in: every variant here is a
`data-*` selector, so `cn()` suffices).

**Storage**: N/A

**Testing**: Vitest (jsdom) + `@testing-library/svelte` + `@testing-library/user-event`,
`expect.requireAssertions` on, `globals: false`. Colocated at
`src/lib/components/ui/checkbox-group/checkbox-group.test.ts` with a
`checkbox-group.test.svelte` harness (the direction-provider precedent) for snippet composition,
function bindings, `<form>` wrapping and provider-less parts.

**Target Platform**: Browsers supporting Svelte 5 / Tailwind v4; SSR-safe (no DOM access at module
scope or component init — `closest('form')` runs from an effect/`$derived` on a bound element).

**Project Type**: shadcn-svelte registry component (source shipped to consumers) + one docs route.

**Performance Goals**: N/A — no measurement, no collection, no positioning. Every derived value is
O(items); membership is a single `Array.prototype.includes` per item per change.

**Constraints**: Constitution I/VI (runes only, no `any`, no suppressions); Principle VIII styling
(semantic tokens, `data-slot` on every part, boolean data attributes as `'' | undefined`); the four
quality gates green from a clean tree.

**Scale/Scope**: 7 public parts + 1 barrel + 1 state module = 9 registry files, ~40 test cases, 1 docs
route with 5 previews (one per upstream demo file) and 7 prop tables, 1 `registry.json` entry.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                    |
| ---- | ----------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$effect`/`$props`/`$bindable` + snippets only; all non-markup logic in `checkbox-group.svelte.ts`; reactive inputs passed as getter functions; no store, `export let`, dispatcher or slot. |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | All 7 part sources, the MDX, the types file, the 11-test suite and all 5 demos read at the pinned commit; every prop, data attribute and `aria-*` reproduced (contracts/public-api.md); 7 divergences recorded in spec Assumptions. |
| III  | Accessibility Is a MUST             | PASS    | `role="group"` + `aria-labelledby`/`aria-describedby`/`aria-readonly`/`aria-orientation`; items `role="checkbox"` with `aria-checked`/`aria-disabled`/`aria-invalid`; name from content; Tab+Space keyboard map (no roving tabindex, matching the MDX); RTL; all six required test areas scheduled (T-tests, quickstart V-1…V-12). |
| IV   | Composition Over Reimplementation   | PASS    | Composed: `useDirection()` from `$lib/components/ui/direction-provider`, `bits-ui` `Label.Root`, `@lucide/svelte` `check`. Bespoke button + hidden input justified in writing below.                          |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder `src/lib/components/ui/checkbox-group/`, one part per file, `index.ts` barrel with short + prefixed names + types, `.js` import extensions, exactly one `registry:ui` entry, no import from `src/routes/**` or `$lib/components/docs/**`. |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Props types exported from `<script lang="ts" module>`, derived from `WithElementRef<…>`; validation result typed `string \| string[] \| true \| null \| undefined`; no `any`, no ignore comment, no config change. |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit -- --run` → `build` scheduled as the final task; no `.skip`/`.todo`; jsdom form-validation risk carries a non-weakening mitigation (R-11).                            |
| VIII | Styling Discipline                  | PASS    | `cn()` with caller `class` merged last; semantic tokens only (`border-input`, `bg-primary`, `text-destructive`, `ring-ring`); `gap-*` not `space-*`; `size-4`; `data-slot` on all 8 rendered elements; booleans as `'' \| undefined`. |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/checkbox-group/+page.svelte` with one `<ComponentPreview>` per upstream demo file — **5**, including `checkbox-group-animated-demo.tsx` (spec FR-022 named 4; the animated example is added, and FR-022 amended, so the superset satisfies both). |
| X    | One Feature Directory Per Component | PASS    | All artefacts under `specs/017-port-checkbox-group/`; no git write command; no touch of `.reference/`, `scripts/`, `.port-state.json`.                                                                        |

**Bespoke behaviour justification (Principle IV)**: the item's `<button role="checkbox">` and its
visually-hidden `<input type="checkbox">` are hand-written. Primitives evaluated, and what each lacks:

1. **`bits-ui` `Checkbox.Group`** (`node_modules/bits-ui/dist/bits/checkbox/checkbox.svelte.js:11-70`,
   `components/checkbox-group.svelte`). Rejected on three counts.
   (a) **Ownership inversion.** The child owns `checked` and *pushes* into the group
   (`CheckboxRootState` `watch.pre` → `group.addValue/removeValue` → group writes `value.current`),
   so a change cannot be vetoed. Spec FR-006 (`readOnly` suppresses the change) and US1 AS-5
   (a controlled parent declines the change) both require a veto point *before* the value moves;
   restoring it after the fact needs a mirror `$state` plus a sync-back `$effect`, i.e. more bespoke
   code than the button it was meant to save.
   (b) **`required` semantics are inverted.** `trueRequired = group.required || own.required` marks
   *every* checkbox required, so native validation demands all of them; upstream (and FR-007)
   requires *at least one*, via `(group.required && value.length === 0) || (own.required && !checked)`.
   (c) **No validation surface at all** — no `onValidate`, `invalid`, message, `orientation` or `dir`;
   `aria-invalid`, `data-invalid` and `data-orientation` are absent from its emitted props.
2. **`bits-ui` `Checkbox.Root`** (same file, `CheckboxRootState`/`CheckboxInputState`). Same ownership
   inversion, plus: its hidden input renders **only when a `name` is set**
   (`shouldRender = Boolean(trueName)`), while upstream renders one whenever the control is inside a
   form so that `required` alone blocks submission — exactly the upstream test
   `"handles required field validation"`, which passes no `name` (FR-016, US3 AS-1); and its
   `HiddenInput` has **no form-`reset` hook**, which the spec's reset edge case requires (restore
   `defaultValue` *and* clear the validation message).
3. **`$lib/components/ui/checkbox`** — a `WithoutChildrenOrChild` styled wrapper over the same
   `Checkbox.Root`: no children (so no indicator, no item text), no group awareness, no item `value`.
   Inherits every gap above.
4. **`bits-ui` `Presence` / a transition primitive** for the indicator's `forceMount` — `bits-ui`
   exports none, and the port attaches no exit animation, so `{#if forceMount || checked}` is the
   complete translation of `<Presence present={forceMount || checked}>` (R-07).

**Composed, not rewritten**: `useDirection()` (upstream `useDirection` ⇒ this repo's
direction-provider, including the DOM `dir` fallback and its `MutationObserver`); `bits-ui`
`Label.Root` for the group label (also avoids authoring a raw control-less `<label>`, which
`svelte-check` would flag `a11y_label_has_associated_control` — an error we may not suppress);
`@lucide/svelte`'s `check` for the default indicator glyph; `cn()` for every class.

## Public API

Exact surface derived from `packages/checkbox-group/src/*.tsx` + `docs/types/radix/checkbox-group.ts`.
Every part additionally takes `ref` (`$bindable`, `HTMLElement | null`), `class`, and spreads
`...restProps` onto its rendered element. Full types, data attributes and the `index.ts` barrel are in
[contracts/public-api.md](./contracts/public-api.md).

### `CheckboxGroup.Root` — `checkbox-group.svelte` → `<div role="group">`

| Prop            | Type                                                              | Default      | Bindable | Notes                                                                     |
| --------------- | ----------------------------------------------------------------- | ------------ | -------- | ------------------------------------------------------------------------- |
| `value`         | `string[]`                                                        | `undefined`  | **yes**  | Controlled checked values. Function binding = an authoritative parent.     |
| `defaultValue`  | `string[]`                                                        | `[]`         | no       | Seeds the uncontrolled value; also the target of a native form `reset`.    |
| `onValueChange` | `(value: string[]) => void`                                       | —            | no       | Fires on every change in both modes.                                       |
| `onValidate`    | `(value: string[]) => string \| string[] \| true \| null \| undefined` | —        | no       | `string`/`string[]` ⇒ invalid + message; `true`/nullish ⇒ valid.           |
| `disabled`      | `boolean`                                                         | `false`      | no       | Propagates to every item; `data-disabled` on group, list, label, parts.    |
| `invalid`       | `boolean`                                                         | `false`      | no       | Forces invalid; effective invalid = `invalid \|\| message !== undefined`.  |
| `readOnly`      | `boolean`                                                         | `false`      | no       | Vetoes every change; items stay focusable; `aria-readonly` on the group.   |
| `required`      | `boolean`                                                         | `false`      | no       | While the value is empty, every item's hidden input is `required`.         |
| `name`          | `string`                                                          | `undefined`  | no       | Field name for every item's hidden input. **Added** (upstream: item-only). |
| `dir`           | `'ltr' \| 'rtl'`                                                  | `useDirection()` | no   | Explicit ⇒ wins; otherwise the nearest `DirectionProvider`, then DOM, then `'ltr'`. |
| `orientation`   | `'vertical' \| 'horizontal'`                                      | `'vertical'` | no       | `data-orientation` + `aria-orientation`.                                   |
| `children`      | `Snippet`                                                         | —            | —        |                                                                            |

### `CheckboxGroup.Label` — `checkbox-group-label.svelte` → `bits-ui` `Label.Root` (`<label>`)

No own props. Registers `labelId` while mounted; exposes `data-disabled`.

### `CheckboxGroup.List` — `checkbox-group-list.svelte` → `<div role="group">`

No own props. Exposes `data-orientation`, `data-invalid`, and its own generated `id` (upstream parity).

### `CheckboxGroup.Item` — `checkbox-group-item.svelte` → `<button type="button" role="checkbox">`

| Prop        | Type      | Default     | Bindable | Notes                                                                        |
| ----------- | --------- | ----------- | -------- | ---------------------------------------------------------------------------- |
| `value`     | `string`  | — **req.**  | no       | Identifies the item inside the group's value array.                          |
| `disabled`  | `boolean` | `false`     | no       | ORed with the group's.                                                       |
| `required`  | `boolean` | `false`     | no       | Individually required while unchecked; ORed with the group's empty-value rule. |
| `name`      | `string`  | `undefined` | no       | Overrides the group's `name` for this item's hidden input.                    |
| `indicator` | `Snippet` | `<Indicator/>` | —     | Rendered inside `[data-slot="checkbox-group-item-box"]`.                      |
| `children`  | `Snippet` | —           | —        | The item's visible text — rendered inside the button (accessible name).       |

Callbacks/events: none of its own; the caller's `onclick`/`onkeydown` are composed with the
component's (caller first; `event.defaultPrevented` suppresses the built-in, matching upstream's
`composeEventHandlers`).

### `CheckboxGroup.Indicator` — `checkbox-group-indicator.svelte` → `<span>`

| Prop         | Type      | Default        | Bindable | Notes                                                              |
| ------------ | --------- | -------------- | -------- | ------------------------------------------------------------------ |
| `forceMount` | `boolean` | `false`        | no       | Keep mounted while unchecked; `data-state` still reports the truth. |
| `children`   | `Snippet` | `check` icon   | —        | The glyph.                                                         |

### `CheckboxGroup.Description` — `checkbox-group-description.svelte` → `<div>`

| Prop          | Type      | Default | Notes                                                       |
| ------------- | --------- | ------- | ----------------------------------------------------------- |
| `announce`    | `boolean` | `false` | `aria-live="polite"` when true, `"off"` when false.         |
| `hideOnError` | `boolean` | `false` | Removed from the document while the group is invalid.       |

### `CheckboxGroup.Message` — `checkbox-group-message.svelte` → `<div>`

| Prop       | Type      | Default | Notes                                                                    |
| ---------- | --------- | ------- | ------------------------------------------------------------------------ |
| `announce` | `boolean` | `false` | As above.                                                                |
| `children` | `Snippet` | —       | Fallback text when `onValidate` supplied no message. Renders only while invalid. |

### Also exported from the barrel (deliverable 5 — reusable by later form ports)

`CheckboxGroupRootState`, `CheckboxGroupItemState`, `FormControlState`, `getDataState()`,
`toValidationMessage()`, `CHECKBOX_GROUP_ORIENTATIONS`, the `set*/get*Context` helpers and every
`*Props` type. `FormControlState` + `getDataState` + `toValidationMessage` are the pieces the next
form port copies; see "Form conventions established here" below.

## Project Structure

### Documentation (this feature)

```text
specs/017-port-checkbox-group/
├── plan.md              # This file
├── research.md          # Phase 0 — R-01…R-14
├── data-model.md        # Phase 1 — state classes, contexts, ids, data attributes
├── quickstart.md        # Phase 1 — V-1…V-12 validation scenarios + gate commands
├── contracts/
│   └── public-api.md    # Phase 1 — installable surface: types, attributes, barrel
├── checklists/
│   └── requirements.md  # from /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/checkbox-group/
├── index.ts                            # barrel: short names + prefixed aliases + prop types + state exports
├── checkbox-group.svelte               # Root      ← packages/checkbox-group/src/checkbox-group-root.tsx
├── checkbox-group-label.svelte         # Label     ← src/checkbox-group-label.tsx
├── checkbox-group-list.svelte          # List      ← src/checkbox-group-list.tsx
├── checkbox-group-item.svelte          # Item      ← src/checkbox-group-item.tsx + registry ui/checkbox-group.tsx
├── checkbox-group-indicator.svelte     # Indicator ← src/checkbox-group-indicator.tsx
├── checkbox-group-description.svelte   # Descr.    ← src/checkbox-group-description.tsx
├── checkbox-group-message.svelte       # Message   ← src/checkbox-group-message.tsx
├── checkbox-group.svelte.ts            # state classes + Symbol contexts ← createContext, useControllableState,
│                                       #   useFormControl, useFormReset, getDataState
├── checkbox-group.test.svelte          # test harness (NOT in registry.json)
└── checkbox-group.test.ts              # colocated tests (NOT in registry.json)

src/routes/docs/components/checkbox-group/
├── +page.svelte                        # 5 <ComponentPreview> sections + 7 prop tables
└── shift-multi-select.svelte.ts        # page-level shift-range helper ← the demo's useShiftMultiSelect

registry.json                           # append exactly one registry:ui entry (9 files)
```

**Structure Decision**: part files map 1:1 onto the upstream package's part files, with the upstream
*registry* file's Tailwind folded into the same components (this repo ships one component, not a
primitive plus a wrapper). The hidden `<input type="checkbox">` is an element inside
`checkbox-group-item.svelte`, not a component, so the one-part-per-file rule is unaffected. Demo route
segment `checkbox-group` == folder slug == `registry.json` `name`. `shift-multi-select.svelte.ts`
lives under `src/routes/**` because it is demo logic, not component API (spec Assumptions) — the
component never imports it, so the docs→component dependency arrow is preserved.

## Form conventions established here (deliverable 5)

Later form ports MUST follow these, and may copy the named code verbatim:

1. **Hidden native input per control.** One visually-hidden `<input type="checkbox">` per item,
   rendered only when the control is inside a `<form>` (`FormControlState.isFormControl`, which
   defaults to `true` before mount exactly like upstream's `useFormControl`). It is `aria-hidden`,
   `tabindex="-1"`, and positioned off-screen with inline styles — never `display:none`/`hidden`,
   which would exclude it from constraint validation.
2. **`name`/`required`/`disabled`/`readOnly` propagation.** Group-level props are the default, the
   item's own prop is the override (`item.name ?? group.name`, `item.disabled || group.disabled`).
   `required` is *field*-level, not control-level: derived as
   `(group.required && group.value.length === 0) || (own.required && !checked)`.
3. **Validation state is dual-surfaced.** `data-invalid` (`'' | undefined`) on the group, list, item,
   description and message for styling; `aria-invalid` on the group, description and each control —
   per `.agents/skills/shadcn-svelte/rules/forms.md`.
4. **Label/description/message wiring.** The root owns the ids; each part *registers* its id while it
   is actually rendered, and the root derives `aria-labelledby` / `aria-describedby` from the
   registrations, so no attribute ever points at a missing node.
5. **Form `reset` restores `defaultValue` and clears validation.** A `reset` listener on the closest
   form, owned by an `$effect` teardown.

## Complexity Tracking

> No Constitution violation is carried forward. Principle IV's bespoke item is justified in writing
> above (that is what the principle requires, not an exception), and Principle IX is over-satisfied
> (5 demos where the spec named 4).

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | none      | —          | —                                      |

## Post-Design Constitution Re-Check

Re-evaluated after research.md, data-model.md, contracts/public-api.md and quickstart.md were written:
**all ten principles still PASS**, with two design outcomes worth recording:

- **IV** hardened rather than weakened: the design composes `useDirection()`, `Label.Root` and `cn()`,
  and the bespoke surface shrank to one `<button>`, one `<input>` and one `closest('form')` check
  (`FormControlState`) — each justified above with the primitive's specific missing capability.
- **III** gained two fixes beyond upstream (name-from-content, no dangling idrefs, R-08/R-09), both
  covered by scheduled assertions (quickstart V-2, V-9) rather than left as prose.
</content>
</invoke>
