# Phase 1 Data Model: Editable

**Feature**: `023-port-editable` | **Date**: 2026-07-31

This component has no persisted data. The "data model" is its reactive state: one class, one context,
three transitions.

---

## 1. Entities

### 1.1 `EditableRootState` (`editable.svelte.ts`)

Replaces upstream's `Store` + `EditableContextValue` + the three `useCallback` transitions
(`editable.tsx:36-107`, `:240-262`). One instance per root, created in `editable.svelte` and published
through the context.

**Constructor props** — every reactive input arrives as a getter function so it stays live
(CLAUDE.md §4):

| Field                | Type                                                | Source                                        |
| -------------------- | --------------------------------------------------- | --------------------------------------------- |
| `getValue`           | `() => string`                                      | root's `$bindable` `value`                    |
| `setValue`           | `(value: string) => void`                           | writes the bindable, then `onValueChange`      |
| `getEditing`         | `() => boolean`                                     | root's `$bindable` `editing`                  |
| `setEditing`         | `(editing: boolean) => void`                        | writes the bindable, then `onEditingChange`    |
| `getOnEdit`          | `() => (() => void) \| undefined`                   | root prop                                     |
| `getOnSubmit`        | `() => ((value: string) => void) \| undefined`      | root prop                                     |
| `getOnCancel`        | `() => (() => void) \| undefined`                   | root prop                                     |
| `getOnEnterKeyDown`  | `() => ((event: KeyboardEvent) => void) \| undefined` | root prop                                   |
| `getOnEscapeKeyDown` | `() => ((event: KeyboardEvent) => void) \| undefined` | root prop                                   |
| `getTriggerMode`     | `() => EditableTriggerMode`                         | root prop, default `'click'`                  |
| `getAutosize`        | `() => boolean`                                     | root prop, default `false`                    |
| `getMaxLength`       | `() => number \| undefined`                         | root prop                                     |
| `getPlaceholder`     | `() => string \| undefined`                         | root prop                                     |
| `getDisabled`        | `() => boolean`                                     | root prop, default `false`                    |
| `getReadOnly`        | `() => boolean`                                     | root prop, default `false`                    |
| `getRequired`        | `() => boolean`                                     | root prop, default `false`                    |
| `getInvalid`         | `() => boolean`                                     | root prop, default `false`                    |
| `getDir`             | `() => Direction`                                   | `useDirection(...).current`                   |
| `id`                 | `string`                                            | one-shot `id ?? $props.id()` (read via `untrack`) |

**Reactive fields**:

| Field           | Kind                        | Notes                                                                                          |
| --------------- | --------------------------- | ---------------------------------------------------------------------------------------------- |
| `inputElement`  | `$state<HTMLInputElement \| HTMLTextAreaElement \| null>` | Set by the input part; the focus/select/autosize target.        |
| `previewElement`| `$state<HTMLElement \| null>` | Set by the preview part; the fallback focus-restore target (D-1).                              |

**Non-reactive fields** (plain private fields — a `$state` here would be a false dependency):

| Field           | Notes                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| `#restoreValue` | The value captured when edit mode was entered. Seeded from `defaultValue`. Upstream `previousValueRef`.   |
| `#trigger`      | The element that started the current edit (an `EditableTrigger`, else the preview). Powers D-1.           |

**Derived (all `$derived`)**: `value`, `editing`, `triggerMode`, `autosize`, `maxLength`,
`placeholder`, `disabled`, `readOnly`, `required`, `invalid`, `dir`, plus the id helpers
`rootId = id`, `inputId = `${id}-input``, `labelId = `${id}-label``, and `isEmpty = value === ''`.

**Methods**:

| Method                        | Behaviour                                                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `edit(trigger?: HTMLElement)` | No-op when `disabled \|\| readOnly`. Captures `#restoreValue = value`, `#trigger = trigger ?? previewElement`, sets `editing = true`, calls `onEdit`. |
| `submit(next: string)`        | Sets `value = next` (callback fires only on an actual change), sets `editing = false`, calls `onSubmit(next)` **unconditionally** (FR-006).        |
| `cancel()`                    | Sets `value = #restoreValue`, sets `editing = false`, calls `onCancel`, then `await tick()` and focuses `#trigger` (falling back to `previewElement`) if it is still connected — D-1. |
| `setText(next: string)`       | The `oninput` path: no-op when `disabled \|\| readOnly`; otherwise `value = next`.                                                                  |
| `autosizeElement(target)`     | R-13: `textarea` → `height = 0` then `scrollHeight`px; else `width = 0` then `scrollWidth + 4`px. No-op when `autosize` is false.                  |
| `isBlurCommitting(related)`   | R-15: `false` when `related` is an `HTMLElement` inside `[data-slot="editable-trigger"]` or `[data-slot="editable-cancel"]`, else `true`.          |

**Equality guard**: `setValue` / `setEditing` on the root return early when the next value is
`Object.is`-equal to the current one, so `onValueChange` / `onEditingChange` fire only on a real
change — upstream `editable.tsx:204`.

### 1.2 Context

One `Symbol` key, one setter, one throwing getter (constitution §5 / CLAUDE.md §5):

```ts
const EDITABLE_CONTEXT_KEY = Symbol('editable');

export function setEditableContext(state: EditableRootState): EditableRootState;
export function getEditableContext(consumerName: string): EditableRootState;
// throws: `${consumerName}` must be used within `<Editable.Root>`
```

Consumer names passed by each part: `<Editable.Label>`, `<Editable.Area>`, `<Editable.Preview>`,
`<Editable.Input>`, `<Editable.Trigger>`, `<Editable.Toolbar>`, `<Editable.Cancel>`,
`<Editable.Submit>` — satisfying FR-018 (the message names both the part and the required ancestor)
and the `/within/` assertion in the test plan.

### 1.3 Value objects

| Type                         | Definition                       | Where                    |
| ---------------------------- | -------------------------------- | ------------------------ |
| `EditableTriggerMode`        | `'click' \| 'dblclick' \| 'focus'` | `editable.svelte.ts`   |
| `EditableToolbarOrientation` | `'horizontal' \| 'vertical'`     | `editable-toolbar.svelte` module script |
| `Direction`                  | reused from `direction-provider` | imported                 |

---

## 2. State transitions

```
                    edit(trigger)                     submit(value)
  ┌──────────┐  ── preview click/dblclick/focus ──▶  ┌──────────┐ ── Enter ─────────▶ ┌──────────┐
  │ PREVIEW  │  ── preview Enter ────────────────▶   │ EDITING  │ ── Submit click ──▶ │ PREVIEW  │
  │ editing  │  ── Trigger click/dblclick ───────▶   │ editing  │ ── blur* ─────────▶ │ (new     │
  │ = false  │                                       │ = true   │                      │  value)  │
  └──────────┘                                       └──────────┘                      └──────────┘
       ▲                                                   │
       │                       cancel()                    │
       └──── Escape / Cancel click ── revert value ────────┘
                                └── focus → #trigger (D-1)
```

`*` blur commits **unless** `relatedTarget` is inside the trigger or the cancel button (R-15).

| From      | Trigger                                            | Guard                                            | Effects                                                                                     |
| --------- | -------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `PREVIEW` | preview `click`                                    | `triggerMode === 'click'`, not disabled/readOnly  | capture restore value + trigger element, `editing = true`, `onEditingChange(true)`, `onEdit()` |
| `PREVIEW` | preview `dblclick`                                 | `triggerMode === 'dblclick'`, not disabled/readOnly | same                                                                                        |
| `PREVIEW` | preview `focus`                                    | `triggerMode === 'focus'`, not disabled/readOnly  | same                                                                                          |
| `PREVIEW` | preview `keydown Enter`                            | any `triggerMode`; `onEnterKeyDown` may `preventDefault()` | same (FR-008)                                                                        |
| `PREVIEW` | trigger `click` / `dblclick`                       | per D-4; not disabled/readOnly                    | same, with `#trigger` = the trigger button                                                    |
| `EDITING` | (mount)                                            | not disabled/readOnly                             | rAF → `focus()`, `select()`, `autosizeElement()` (R-03)                                        |
| `EDITING` | input `input`                                      | not disabled/readOnly                             | `value = next`, `onValueChange(next)` if changed, `autosizeElement(target)`                    |
| `EDITING` | input `keydown Enter`                              | not disabled/readOnly                             | `submit(value)`                                                                                |
| `EDITING` | input `keydown Escape`                             | `onEscapeKeyDown` may `preventDefault()`          | `cancel()`                                                                                     |
| `EDITING` | input `blur`                                       | `relatedTarget` not trigger/cancel (R-15)         | `submit(value)`                                                                                |
| `EDITING` | submit `click`                                     | not disabled/readOnly                             | `submit(value)`                                                                                |
| `EDITING` | cancel `click`                                     | not disabled/readOnly                             | `cancel()`                                                                                     |
| any       | `readOnly` set                                     | —                                                 | preview and trigger never render; input always renders, inert (FR-005, spec Edge Cases)        |
| any       | `disabled` set                                     | —                                                 | every transition above is a no-op                                                              |

**Controlled mode**: each transition writes through the `$bindable`. A caller using the function
binding `bind:value={() => v, (next) => …}` who declines the write leaves the rendered value where it
was, while the callback still fires — this is what makes the parent authoritative (FR-002, R-02, spec
Edge Cases).

---

## 3. Validation rules

| Rule                                                                                    | Source                       |
| --------------------------------------------------------------------------------------- | ---------------------------- |
| Submitting an unchanged value still calls `onSubmit` and exits edit mode                | FR-006, spec Edge Cases      |
| `onValueChange` / `onEditingChange` fire only on an actual change                       | upstream `setState` guard    |
| `disabled` short-circuits `edit` / `submit` / `cancel` / `setText`                       | FR-003, FR-010, FR-016       |
| `readOnly` short-circuits the same set and pins the input's DOM value (R-12)             | FR-005, FR-010               |
| An empty `required` field fails native constraint validation via the clipped form input | FR-017, R-09 (D-5)           |
| `maxLength` caps input length natively; the part's own prop wins over the root's        | FR-012, D-2                  |

---

## 4. Relationships

```
Editable (root) ── owns ──▶ EditableRootState ── published via Symbol context ──▶ all 8 other parts
   │                              │
   │                              ├─ inputElement   ◀── bind:this in Input
   │                              └─ previewElement ◀── bind:this in Preview
   │
   ├── useDirection(direction-provider) ──▶ state.dir ──▶ Area[dir], Input[dir], Toolbar[dir]
   └── FormControlState(checkbox-group) ──▶ isFormControl ──▶ {#if} clipped form input
```

Ownership is strictly one-way: parts read the state class and call its methods; the state class never
reaches into a part except through the two element references it is handed.
