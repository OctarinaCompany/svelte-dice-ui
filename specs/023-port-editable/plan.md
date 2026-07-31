# Implementation Plan: Port Editable

**Branch**: `023-port-editable` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/023-port-editable/spec.md`

## Summary

Port Dice UI's `Editable` to Svelte 5 as the registry item `editable`: a nine-part compound
inline-edit field (root, label, area, preview, input, trigger, toolbar, cancel, submit) where
activating the preview swaps it for a focused, fully-selected text input, `Enter`/blur/submit commits
the value, and `Escape`/cancel reverts it and returns focus to whatever started the edit.

Upstream source is `.reference/diceui/docs/registry/bases/radix/ui/editable.tsx` (the `radix` base
only, per spec Assumptions). Technical approach: upstream's hand-rolled `useSyncExternalStore` `Store`
collapses into a single `EditableRootState` class in `editable.svelte.ts` holding `value` and `editing`
as `$state`, every other reactive input as a getter function, and the edit/submit/cancel/autosize
methods; it is published through one `Symbol`-keyed context whose getter throws the documented error.
`value` and `editing` are both `$bindable` with `defaultValue`/`defaultEditing` seeds. Direction
reuses `$lib/components/ui/direction-provider`; form association reuses `FormControlState` from
`$lib/components/ui/checkbox-group`. `asChild` becomes the `child` snippet on all nine parts. **Zero
new npm dependencies.**

## Technical Context

**Language/Version**: TypeScript 5 (strict, `verbatimModuleSyntax`) on Svelte 5 (runes forced on in
`vite.config.ts`) / SvelteKit 2.

**Primary Dependencies**: none new. Existing registry items composed: `direction-provider`
(`useDirection`) and `checkbox-group` (`FormControlState`). `@lucide/svelte` is used by the demo page
only (todo-list icons), not by the component, so it is not a registry dependency here. `bits-ui`
ships no inline-edit primitive (see the Principle IV table).

**Storage**: N/A — component state only. The text value lives in the caller's runes state or in the
root's `$bindable` props.

**Testing**: Vitest (jsdom, `globals: false`, `expect.requireAssertions`) + `@testing-library/svelte`
+ `@testing-library/user-event`, with an `editable.test.svelte` harness for the compositions a `.ts`
spec cannot express (`bind:value`, `bind:editing`, a `<form>` ancestor, `child` snippets, a part with
no provider). See research R-16.

**Target Platform**: Browsers supported by SvelteKit 2; SSR-safe — no DOM access during
initialisation, every DOM read/write happens in an event handler or an effect.

**Project Type**: shadcn-svelte registry component (source-distributed) plus its docs route.

**Performance Goals**: No measurable regression against the other ported components. There is no
observer, timer, or document-level listener; the only scheduled work is one `requestAnimationFrame`
per edit-mode entry (research R-03), cancelled on teardown.

**Constraints**: Constitution v1.0.0 — runes only, upstream parity, WAI-ARIA + full keyboard + RTL,
composition over reimplementation, strict TypeScript with no suppressions, semantic tokens only, one
`<ComponentPreview>` per upstream example, all four quality gates green.

**Scale/Scope**: 9 part files + 1 state module + 1 barrel = 11 registry files; 1 test spec + 1 test
harness; 5 demo sections + 9 props tables + 1 keyboard table; 1 registry entry.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                                                                                                          |
| ---- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$effect.pre`/`$props`/`$props.id()`/`$bindable` + snippets only; all non-markup logic in `editable.svelte.ts` as one state class fed by getter functions. No store, no `export let`, no `createEventDispatcher`, no `$:`, no `<slot>`. Upstream's `Store` is dropped (R-01).   |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | Source, MDX, all 5 demos and the 15-test upstream spec read at the pinned commit `d9763d8`. Every prop, callback, data attribute, ARIA attribute and key reproduced (see Public API). Nine deliberate divergences tabled below; all nine are recorded in the spec's Assumptions section per Principle II. |
| III  | Accessibility Is a MUST             | PASS    | `role="button"` preview / `role="group"` area / `role="toolbar"` toolbar, `aria-controls`/`aria-labelledby`/`aria-disabled`/`aria-invalid`/`aria-required`/`aria-orientation` per the MDX; label `for` ↔ input `id`; `Enter`/`Escape`/`Tab` driven through `user-event`; RTL asserted; focus restored on cancel (D-1). All six §7 test areas planned. |
| IV   | Composition Over Reimplementation   | PASS    | `useDirection` (direction-provider) replaces `DirectionPrimitive.useDirection`; `FormControlState` (checkbox-group) replaces upstream's `closest('form')` detection. `radix-ui`'s `Slot` replaced by the repo's `child` snippet. Remaining bespoke behaviour justified below.                        |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder `src/lib/components/ui/editable/`, one part per file, `index.ts` barrel with short names + prefixed aliases + types, one `registry:ui` entry listing all 11 non-test files, `.js` on every intra-repo import, no import from `src/routes/**` or `$lib/components/docs/**`.               |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Every part's props type declared and exported from `<script lang="ts" module>`, derived from `WithElementRef<…>`; `child` payload types exported too; no `any`, no ignore comment, no config change.                                                                                               |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit -- --run` → `build` scheduled as the final task; no test skipped, `.todo`-ed or emptied.                                                                                                                                                                  |
| VIII | Styling Discipline                  | PASS    | `cn()` with the caller's `class` merged last; upstream's classes map onto existing semantic tokens with no new token needed (`border-input`, `ring-ring`, `text-muted-foreground`, `text-destructive`, `bg-transparent`); `data-slot` on all 9 parts; every state exposed as `data-*` written `cond ? '' : undefined`. |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/editable/+page.svelte` with one `<ComponentPreview>` per upstream demo (`editable-demo`, `editable-double-click-demo`, `editable-autosize-demo`, `editable-todo-list-demo`, `editable-form-demo`) plus nine per-part props tables and the keyboard table (SC-005).      |
| X    | One Feature Directory Per Component | PASS    | All planning artifacts written to `specs/023-port-editable/` only; no task runs a git write command.                                                                                                                                                                                              |

**Bespoke behaviour justification (Principle IV)**:

| Bespoke piece                                                       | Primitive evaluated                                                              | Capability it lacks                                                                                                                                                                             |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The inline-edit state machine itself (`EditableRootState`)          | `bits-ui` full export surface; all 58 folders under `src/lib/components/ui/*`     | Neither ships an inline-edit / click-to-edit primitive. There is nothing to compose — the state machine *is* the component.                                                                       |
| Preview ↔ input swap and part presence (`{#if}` on 5 parts)         | `bits-ui` `Presence`, the `Collapsible`/`Dialog` open-state primitives            | Those bind presence to their own open state and add exit-animation deferral the spec does not ask for. FR-005/FR-016 require genuine removal from the DOM, which a plain `{#if}` states directly. |
| Focus + select on edit start (`$effect.pre` + rAF)                  | `bits-ui` focus-scope utilities; the `autofocus` attribute                        | Neither selects the input's content, and `autofocus` is unreliable for an element mounted into an already-focused document. Upstream's own rAF-and-cancel is the ported shape (R-03).             |
| Autosize measurement                                                | `bits-ui`; `textarea` component; CSS `field-sizing`                               | No primitive exposes it; `field-sizing: content` is not yet baseline and would silently no-op, whereas the upstream contract is a measured pixel width. Verbatim upstream algorithm (R-13).       |
| Blur-submit exception for trigger/cancel                            | `bits-ui` dismissible-layer `onFocusOutside`                                      | That primitive is about closing overlays on outside focus; here the requirement is the inverse — *suppressing* a commit for two specific in-widget targets, keyed on `data-slot` (R-15).          |
| Hidden form-associated input markup                                 | `bits-ui` `HiddenInput`; `checkbox-group`'s per-item input                        | `FormControlState` from `checkbox-group` **is** composed for form detection; only the markup (one clipped input) is written here, as `tags-input`/`phone-input`/`time-picker` already do (R-09).  |

**Deliberate divergences from upstream (Principle II — each recorded with its upstream name and reason)**:

| #   | Upstream                                                                                             | Here                                                                                       | Why                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 | Cancel leaves focus on `<body>` (the input just unmounted); no restoration anywhere in `editable.tsx` | `cancel()` restores focus to the element that started the edit (trigger, else preview)     | Spec FR-007 + SC-003 require it and constitution III requires predictable focus order. An **addition** — no upstream behaviour is removed. Research R-04.                                                       |
| D-2 | Root `maxLength` is put in context (`:274`) and never read; `EditableInput` uses only its own prop     | input applies `maxLength ?? root.maxLength`                                                | Spec FR-012 and the MDX both document `maxLength` as a root prop; upstream's wiring makes it dead. Research R-05.                                                                                               |
| D-3 | Root renders `id={id}` but hands `rootId = id ?? useId()` to four parts as `aria-controls`             | root always renders `id={id ?? $props.id()}`                                                | Otherwise `aria-controls` dangles whenever the caller passes no `id` — an ARIA reference that resolves to nothing. Research R-06.                                                                               |
| D-4 | `EditableTrigger` gets no handler at all when `triggerMode="focus"` (`:692-693`) — an inert button      | trigger activates on click for `"click"` **and** `"focus"`, on double click for `"dblclick"` | Spec FR-014 requires exactly this. A rendered "Edit" button that does nothing is a defect. Research R-07.                                                                                                       |
| D-5 | `VisuallyHiddenInput type="hidden"`                                                                    | a clipped `<input type="text" data-slot="editable-form-input">`                              | `type="hidden"` is excluded from constraint validation, making FR-017's native `required` block unreachable. Pre-recorded in spec Assumptions; matches `tags-input`/`phone-input`/`time-picker`. Research R-09. |
| D-6 | `asChild` (`Slot`) on every part; `useEditable` exported as a public hook; internal `Store`             | `child` snippet on every part; no `useEditable`; `EditableRootState` + `$state`             | All three pre-recorded in spec Assumptions: no Svelte equivalent for `Slot`; `bind:value`/`bind:editing` covers `useEditable`; `$state` already gives the granularity the store existed to provide. R-01, R-10. |
| D-7 | `EditableToolbar` sets only `aria-orientation` (`:719`) | also emits `data-orientation={orientation}` | Constitution VIII requires every piece of component state to be exposed as a `data-*` attribute so consumers can style it. An addition. |
| D-8 | `EditableCancel`/`EditableSubmit` emit no state data attributes (`:763-770`, `:805-812`) | both emit `data-disabled` / `data-readonly` | Same Principle VIII rule; both buttons render while `readOnly`, so both states are reachable. An addition. |
| D-9 | `Enter` in the input submits without `preventDefault()` (`:600-602`) | `Enter` calls `event.preventDefault()` before submitting | Inside a `<form>` the un-prevented `Enter` also triggers implicit native form submission, double-handling the commit. FR-017 puts the field inside a form by design. |

None of these is a constitution violation — Principle II requires divergences to be *recorded*, which
they are (here and, in full, in the spec's Assumptions). **Complexity Tracking is therefore empty.**

## Public API

Every part exports its props type (and, where it has one, its `child` payload type) from
`<script lang="ts" module>`; all are re-exported from `index.ts`. On every part `ref` is
`$bindable(null)` applied with `bind:this`, `...restProps` is spread onto the element, and the
caller's `class` is merged last through `cn()`. Every part accepts
`child?: Snippet<[{ props: … }]>` (upstream `asChild`, D-6) and, unless noted, `children?: Snippet`.

### `Root` — `editable.svelte` (`Editable`; `EditableRootProps`, alias `EditableProps`)

Base: `WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'dir'>, HTMLDivElement>`.

| Prop              | Type                                    | Default     | Bindable | Notes                                                                                                                       |
| ----------------- | --------------------------------------- | ----------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `value`           | `string`                                | —           | **yes**  | Controlled text value. `bind:value`, or the function binding `bind:value={() => v, (next) => …}` to stay authoritative.        |
| `defaultValue`    | `string`                                | `''`        | no       | Seeds `value` once when uncontrolled; also the initial restore-on-cancel value.                                                |
| `onValueChange`   | `(value: string) => void`               | —           | no       | Fires only when the value actually changes (upstream's `Object.is` guard, R-01).                                               |
| `editing`         | `boolean`                               | —           | **yes**  | Controlled edit-mode state.                                                                                                    |
| `defaultEditing`  | `boolean`                               | `false`     | no       | Seeds `editing` once when uncontrolled.                                                                                        |
| `onEditingChange` | `(editing: boolean) => void`            | —           | no       | Fires only when edit mode actually changes.                                                                                    |
| `onEdit`          | `() => void`                            | —           | no       | After edit mode is entered and the restore value captured.                                                                     |
| `onSubmit`        | `(value: string) => void`               | —           | no       | On `Enter`, submit button, or blur. Fires **even when the value is unchanged** (FR-006).                                        |
| `onCancel`        | `() => void`                            | —           | no       | After the value is reverted and edit mode left.                                                                                |
| `onEnterKeyDown`  | `(event: KeyboardEvent) => void`        | —           | no       | Runs before the preview's built-in `Enter`→edit; `preventDefault()` skips it (FR-008).                                         |
| `onEscapeKeyDown` | `(event: KeyboardEvent) => void`        | —           | no       | Runs before the input's built-in `Escape`→cancel; `preventDefault()` skips it (FR-009).                                        |
| `triggerMode`     | `'click' \| 'dblclick' \| 'focus'`      | `'click'`   | no       | Which preview interaction enters edit mode.                                                                                    |
| `autosize`        | `boolean`                               | `false`     | no       | Input grows to fit its content; also switches the input class `w-full` → `w-auto`.                                             |
| `maxLength`       | `number`                                | —           | no       | Native character cap on the input (D-2).                                                                                       |
| `placeholder`     | `string`                                | —           | no       | Shown by the preview when the value is empty (with `data-empty`), and as the input's native placeholder.                       |
| `name`            | `string`                                | —           | no       | Field name on the hidden form-associated input (FR-017).                                                                       |
| `disabled`        | `boolean`                               | `false`     | no       | Suppresses every interaction on every part.                                                                                    |
| `readOnly`        | `boolean`                               | `false`     | no       | Input permanently rendered and inert; preview and trigger never render.                                                        |
| `required`        | `boolean`                               | `false`     | no       | `data-required` on the label, `required`/`aria-required` on the input and the form input.                                      |
| `invalid`         | `boolean`                               | `false`     | no       | `data-invalid` on the label, `aria-invalid` on the input.                                                                      |
| `dir`             | `Direction`                             | nearest `<DirectionProvider>`, else DOM `[dir]`, else `'ltr'` | no | Rendered on the area and the input.                                                        |
| `id`              | `string`                                | `$props.id()` | no     | Always rendered on the root; `aria-controls` targets it (D-3). Input id is `${id}-input`, label id `${id}-label`.               |
| `children`        | `Snippet`                               | —           | no       | The composed parts.                                                                                                            |

Element: `<div data-slot="editable" class="flex min-w-0 flex-col gap-2">`, plus the clipped form input
(rendered when inside a `<form>`, R-09). No `data-*` state on the root itself (upstream sets none);
state lives on the parts.

### `Label` — `editable-label.svelte` (`EditableLabel`; `EditableLabelProps`, `EditableLabelChildProps`)

Base: `WithElementRef<HTMLLabelAttributes, HTMLLabelElement>`. No own props beyond `child`/`children`.

Emits `id={labelId}`, `for={inputId}`, `data-slot="editable-label"`, and `data-disabled` /
`data-invalid` / `data-required` mirroring the root.

### `Area` — `editable-area.svelte` (`EditableArea`; `EditableAreaProps`, `EditableAreaChildProps`)

Base: `WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'dir'>, HTMLDivElement>`. No own props.

Emits `role="group"`, `dir`, `data-slot="editable-area"`, `data-disabled`, `data-editing`.

### `Preview` — `editable-preview.svelte` (`EditablePreview`; `EditablePreviewProps`, `EditablePreviewChildProps`)

Base: `WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement>`. No own props. Renders
`{value || placeholder}` when `children` is not supplied.

Rendered only when `!editing && !readOnly`. Emits `role="button"`, `tabindex={disabled || readOnly ? undefined : 0}`,
`aria-disabled`, `data-slot="editable-preview"`, `data-empty`, `data-disabled`, `data-readonly`.
Composes `onclick` / `ondblclick` / `onfocus` / `onkeydown` (R-11); `Enter` enters edit mode via
`onEnterKeyDown` regardless of `triggerMode` (FR-008).

### `Input` — `editable-input.svelte` (`EditableInput`; `EditableInputProps`, `EditableInputChildProps`)

Base: `WithElementRef<Omit<HTMLInputAttributes, 'value' \| 'dir'>, HTMLInputElement>`.

| Prop        | Type      | Default            | Bindable | Notes                                                    |
| ----------- | --------- | ------------------ | -------- | -------------------------------------------------------- |
| `maxLength` | `number`  | root's `maxLength` | no       | Own prop wins over the root's (D-2).                     |
| `disabled`  | `boolean` | root's `disabled`  | no       | OR-ed with the root's, as upstream does.                 |
| `readOnly`  | `boolean` | root's `readOnly`  | no       | OR-ed with the root's.                                   |
| `required`  | `boolean` | root's `required`  | no       | OR-ed with the root's.                                   |

Rendered only when `editing || readOnly`. Emits `id={inputId}`, `aria-labelledby={labelId}`,
`aria-required`, `aria-invalid`, `dir`, `placeholder`, `value`, `data-slot="editable-input"`, native
`disabled` / `readonly` / `required` / `maxlength`. Composes `onblur` / `oninput` / `onkeydown`
(R-11): `Enter` submits, `Escape` cancels through `onEscapeKeyDown`, blur submits except toward the
trigger or cancel (R-15). Focus + select + autosize on edit start (R-03). Not `bind:value` — R-12.

### `Trigger` — `editable-trigger.svelte` (`EditableTrigger`; `EditableTriggerProps`, `EditableTriggerChildProps`)

Base: `WithElementRef<Omit<HTMLButtonAttributes, 'type'>, HTMLButtonElement>`.

| Prop         | Type      | Default | Bindable | Notes                                                    |
| ------------ | --------- | ------- | -------- | -------------------------------------------------------- |
| `forceMount` | `boolean` | `false` | no       | Keeps the trigger mounted while editing / read-only.     |

Rendered when `forceMount || (!editing && !readOnly)`. Emits `type="button"`, `aria-controls={rootId}`,
`aria-disabled`, `data-slot="editable-trigger"`, `data-disabled`, `data-readonly`. Activation per D-4.
Records itself as the focus-restore target (D-1).

### `Toolbar` — `editable-toolbar.svelte` (`EditableToolbar`; `EditableToolbarProps`, `EditableToolbarChildProps`)

Base: `WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'dir'>, HTMLDivElement>`.

| Prop          | Type                          | Default        | Bindable | Notes                                            |
| ------------- | ----------------------------- | -------------- | -------- | ------------------------------------------------ |
| `orientation` | `'horizontal' \| 'vertical'`  | `'horizontal'` | no       | `aria-orientation` + `flex-col` when vertical.   |

Always rendered. Emits `role="toolbar"`, `aria-controls={rootId}`, `aria-orientation`, `dir`,
`data-slot="editable-toolbar"`, `data-orientation`.

### `Cancel` — `editable-cancel.svelte` (`EditableCancel`; `EditableCancelProps`, `EditableCancelChildProps`)

Base: `WithElementRef<Omit<HTMLButtonAttributes, 'type'>, HTMLButtonElement>`. No own props.

Rendered when `editing || readOnly`. Emits `type="button"`, `aria-controls={rootId}`,
`data-slot="editable-cancel"`, `data-disabled`, `data-readonly`. `onclick` composes the caller's
handler then cancels; no-ops while `disabled` or `readOnly`.

### `Submit` — `editable-submit.svelte` (`EditableSubmit`; `EditableSubmitProps`, `EditableSubmitChildProps`)

Base: `WithElementRef<Omit<HTMLButtonAttributes, 'type'>, HTMLButtonElement>`. No own props.

Rendered when `editing || readOnly`. Emits `type="button"`, `aria-controls={rootId}`,
`data-slot="editable-submit"`, `data-disabled`, `data-readonly`. `onclick` composes the caller's
handler then submits the current value; no-ops while `disabled` or `readOnly`.

### Non-component exports (from `index.ts`)

`EditableRootState`, `setEditableContext`, `getEditableContext`, and the types
`EditableRootStateProps`, `EditableTriggerMode`, `EditableToolbarOrientation` — mirroring how
`tags-input` and `checkbox-group` publish their state classes. **No new shared module is created**:
this port *consumes* `useDirection` (direction-provider) and `FormControlState` (checkbox-group),
which are already the repo's shared form/direction primitives, and adds nothing later components would
need to reuse beyond its own state class.

## Project Structure

### Documentation (this feature)

```text
specs/023-port-editable/
├── plan.md                      # This file
├── research.md                  # Phase 0 output — 17 decisions
├── data-model.md                # Phase 1 output — state, context, transitions
├── quickstart.md                # Phase 1 output — validation guide
├── contracts/
│   ├── public-api.md            # exported surface, part by part
│   ├── data-attributes.md       # every data-*/aria-* a consumer may style or assert on
│   └── upstream-test-map.md     # the 15 upstream assertions → our cases
├── checklists/
│   └── requirements.md          # from /speckit-specify
└── tasks.md                     # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/editable/
├── index.ts                     # barrel: short names + prefixed aliases + prop types + state exports
├── editable.svelte              # Root            ← editable.tsx:134-332  (Editable)
├── editable-label.svelte        # Label           ← editable.tsx:338-362  (EditableLabel)
├── editable-area.svelte         # Area            ← editable.tsx:368-390  (EditableArea)
├── editable-preview.svelte      # Preview         ← editable.tsx:396-498  (EditablePreview)
├── editable-input.svelte        # Input           ← editable.tsx:505-661  (EditableInput)
├── editable-trigger.svelte      # Trigger         ← editable.tsx:668-696  (EditableTrigger)
├── editable-toolbar.svelte      # Toolbar         ← editable.tsx:703-731  (EditableToolbar)
├── editable-cancel.svelte       # Cancel          ← editable.tsx:737-772  (EditableCancel)
├── editable-submit.svelte       # Submit          ← editable.tsx:778-814  (EditableSubmit)
├── editable.svelte.ts           # EditableRootState + Symbol context  ← editable.tsx:36-107, 240-262
├── editable.test.ts             # the spec           (NOT in registry.json)
└── editable.test.svelte         # render harness     (NOT in registry.json, not collected by Vitest)

src/routes/docs/components/editable/
└── +page.svelte                 # 5 <ComponentPreview> sections + 9 props tables + keyboard table

registry.json                    # append exactly one registry:ui entry named "editable"
```

**Structure Decision**: nine parts, one file each, named `editable-<part>.svelte` with the root at
`editable.svelte`, mapped to their upstream counterparts in the tree above. Upstream's `Store` /
`useStore` / `useStoreContext` / `useEditableContext` (`editable.tsx:36-107`) and the three
`useCallback` transitions (`:240-262`) all land in `editable.svelte.ts`. The folder slug `editable`
equals the demo route segment `src/routes/docs/components/editable/` and the registry item name
`editable`.

## Implementation Phases (what `/speckit-tasks` will expand)

| # | Deliverable                                                                                              | Gates on                     |
| - | -------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 1 | `editable.svelte.ts` — `EditableRootState`, `Symbol` context, throwing getter                             | research R-01, R-04, R-13    |
| 2 | `editable.svelte` root — bindables, ids, direction, context, clipped form input                          | 1                            |
| 3 | Label / Area / Toolbar (stateless presentation parts, `child` snippet each)                              | 2                            |
| 4 | Preview + Input — the trigger modes, keyboard, blur rules, focus/select/autosize effect                  | 2                            |
| 5 | Trigger / Cancel / Submit — presence rules, activation, focus-restore recording                          | 2                            |
| 6 | `index.ts` barrel                                                                                        | 1–5                          |
| 7 | `editable.test.svelte` harness + `editable.test.ts` covering all six CLAUDE.md §7 areas and every mapped upstream assertion | 1–6        |
| 8 | `src/routes/docs/components/editable/+page.svelte` — 5 previews + 9 props tables + keyboard table        | 6                            |
| 9 | `registry.json` entry + `pnpm run registry:build`                                                        | 6                            |
| 10 | Quality gates: `format` → `check` → `lint` → `test:unit -- --run` → `build`                              | 1–9                          |

Registry entry shape:

```jsonc
{
  "name": "editable",
  "type": "registry:ui",
  "title": "Editable",
  "description": "An accessible inline editable component for editing text content in place.",
  "registryDependencies": ["direction-provider", "checkbox-group"],
  "dependencies": [],
  "files": [ /* the 11 non-test files listed in the tree above */ ]
}
```

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1 (`data-model.md`, `contracts/`, `quickstart.md`): **all ten principles
still PASS**, with no verdict changed by the design.

- **I** — the design introduces exactly one class, one `Symbol` context, `$effect.pre` for the
  focus/select frame and `$effect` for the form-input dispatch; no legacy idiom appears anywhere in
  `data-model.md`.
- **II** — `contracts/public-api.md` and `contracts/data-attributes.md` enumerate the full upstream
  surface; `contracts/upstream-test-map.md` shows all 15 upstream tests mapped, none dropped. The
  divergence count is nine, all recorded in the spec's Assumptions section.
- **III** — `contracts/data-attributes.md` fixes the ARIA wiring; the focus-restore contract (D-1) is
  specified in `data-model.md`'s transition table and is a required test case.
- **IV** — Phase 1 confirmed no additional primitive is available for any of the six bespoke pieces.
- **V/IX** — file list, barrel, single registry entry and five demo sections are fixed above; the
  component imports nothing from the docs app.
- **VI** — every exported type is named in `contracts/public-api.md`; none is `any`.
- **VII/X** — gates scheduled as phase 10; no artifact outside `specs/023-port-editable/` and the
  source tree above is touched, and no git write command appears in any phase.

**Complexity Tracking**: empty — no violation to carry forward.
