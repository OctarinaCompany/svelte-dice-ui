# Phase 1 Data Model: Checkbox Group

Everything reactive lives in `src/lib/components/ui/checkbox-group/checkbox-group.svelte.ts`.
Reactive inputs enter the classes as **getter functions** (CLAUDE.md §4); no class ever snapshots a
prop.

## Module-level constants and helpers

```ts
/** Every value `orientation` accepts, in upstream declaration order. */
export const CHECKBOX_GROUP_ORIENTATIONS = ['vertical', 'horizontal'] as const;
export type CheckboxGroupOrientation = (typeof CHECKBOX_GROUP_ORIENTATIONS)[number];

/** Return type of `onValidate`. Upstream `checkbox-group-root.tsx:50`. */
export type CheckboxGroupValidationResult = string | string[] | true | null | undefined;

/** Upstream `getDataState` (checkbox-group-item.tsx:121-123). */
export function getDataState(checked: boolean): 'checked' | 'unchecked';

/** Upstream's `Array.isArray(message) ? message.join(' ') : message` (checkbox-group-message.tsx:29). */
export function toValidationMessage(message: string | string[] | undefined): string | undefined;
```

## `CheckboxGroupRootState`

Owner of the group's value, validation, ids and part registrations. One instance per
`<CheckboxGroup.Root>`, published on `CHECKBOX_GROUP_CONTEXT_KEY`.

### Constructor props (all getters, except the id)

| Field             | Type                                                            | Source                                  |
| ----------------- | ---------------------------------------------------------------- | --------------------------------------- |
| `getValue`        | `() => string[]`                                                 | the root's `$bindable` `value`          |
| `setValue`        | `(value: string[]) => void`                                      | writes `value` then calls `onValueChange` |
| `getDefaultValue` | `() => string[]`                                                 | `defaultValue` (target of form reset)   |
| `getOnValidate`   | `() => ((value: string[]) => CheckboxGroupValidationResult) \| undefined` | `onValidate`                   |
| `getDisabled`     | `() => boolean`                                                  | `disabled`                              |
| `getInvalid`      | `() => boolean`                                                  | `invalid`                               |
| `getReadOnly`     | `() => boolean`                                                  | `readOnly`                              |
| `getRequired`     | `() => boolean`                                                  | `required`                              |
| `getName`         | `() => string \| undefined`                                      | `name`                                  |
| `getOrientation`  | `() => CheckboxGroupOrientation`                                 | `orientation`                           |
| `getDir`          | `() => Direction`                                                | `useDirection({ dir: () => dir }).current` |
| `id`              | `string`                                                         | `$props.id()`                           |

### Reactive state

| Member              | Rune                                    | Meaning                                                          |
| ------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| `validationMessage` | `$state<string \| string[] \| undefined>` | Last non-valid `onValidate` return. Upstream `useState`.         |
| `#hasLabel`         | `$state<boolean>`                       | A `Label` is currently rendered (R-08).                          |
| `#hasDescription`   | `$state<boolean>`                       | A `Description` is currently rendered (survives `hideOnError`).  |
| `#hasMessage`       | `$state<boolean>`                       | A `Message` is currently rendered.                               |

### Derived values

| Member           | Expression                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `value`          | `this.#props.getValue()` (never a copy — R-03)                                                  |
| `isInvalid`      | `getInvalid() \|\| this.validationMessage !== undefined`                                        |
| `disabled`, `readOnly`, `required`, `name`, `orientation`, `dir` | pass-through getters                            |
| `labelId`        | `` `${id}-label` ``                                                                             |
| `descriptionId`  | `` `${id}-description` ``                                                                       |
| `messageId`      | `` `${id}-message` ``                                                                           |
| `listId`         | `` `${id}-list` `` (upstream gives the list a generated id)                                     |
| `labelledBy`     | `#hasLabel ? labelId : undefined`                                                               |
| `describedBy`    | `[#hasDescription && descriptionId, isInvalid && #hasMessage && messageId].filter(Boolean).join(' ') \|\| undefined` |
| `messageContent` | `toValidationMessage(validationMessage)` — `undefined` ⇒ the `Message` falls back to its children |

### Methods

| Method                                | Behaviour                                                                                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isChecked(itemValue)`                | `this.value.includes(itemValue)`                                                                                                                          |
| `isItemRequired(ownRequired, checked)`| `(this.required && this.value.length === 0) \|\| (ownRequired && !checked)` — upstream `checkbox-group-item.tsx:48-50`                                     |
| `setItemChecked(itemValue, checked)`  | `if (readOnly) return;` → `next = checked ? [...value, itemValue] : value.filter(v => v !== itemValue)` → `validate(next)` → `setValue(next)`              |
| `validate(next)`                      | `const r = getOnValidate()?.(next); if (typeof r === 'string' \|\| Array.isArray(r)) message = r; else if (r === true \|\| r == null) message = undefined;` |
| `reset()`                             | `setValue(getDefaultValue())`; `validationMessage = undefined` — upstream `onReset`                                                                        |
| `registerLabel() / registerDescription() / registerMessage()` | Sets the flag, returns the unregister thunk (called from each part's `$effect` teardown)                                    |

**Ordering note.** Upstream validates inside `useControllableState`'s `onChange`, i.e. after the value
is committed but before `onValueChange`; `setItemChecked` reproduces that order (`validate` then
`setValue`, whose setter calls `onValueChange` last). `readOnly` short-circuits before both, so neither
`onValidate` nor `onValueChange` fires — spec US3 AS-7.

## `CheckboxGroupItemState`

One instance per `<CheckboxGroup.Item>`, published on `CHECKBOX_GROUP_ITEM_CONTEXT_KEY` for the
indicator.

| Member          | Kind                | Expression / meaning                                                              |
| --------------- | ------------------- | --------------------------------------------------------------------------------- |
| `element`       | `$state<HTMLButtonElement \| null>` | Set from the item's `$effect` (`ref`); feeds `FormControlState`.  |
| `value`         | derived             | `getValue()` — the required `value` prop                                          |
| `checked`       | derived             | `root.isChecked(this.value)`                                                      |
| `disabled`      | derived             | `getDisabled() \|\| root.disabled`                                                |
| `required`      | derived             | `root.isItemRequired(getRequired(), this.checked)`                                |
| `name`          | derived             | `getName() ?? root.name` (R-10)                                                   |
| `dataState`     | derived             | `getDataState(this.checked)`                                                      |
| `toggle()`      | method              | `root.setItemChecked(this.value, !this.checked)` (no-op while `disabled`)         |

## `FormControlState` (the reusable form primitive — deliverable 5)

Replaces upstream's `useFormControl` + `useFormReset`.

| Member          | Kind    | Expression / meaning                                                                                   |
| --------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `form`          | derived | `getElement()?.closest('form') ?? null`                                                                |
| `isFormControl` | derived | `getElement() ? this.form !== null : true` — `true` before mount, exactly like upstream's hook          |

The item pairs it with one `$effect`:

```ts
$effect(() => {
	const form = formControl.form;
	if (!form) return;
	const onReset = () => root.reset();
	form.addEventListener('reset', onReset);
	return () => form.removeEventListener('reset', onReset);
});
```

## Contexts

```ts
const CHECKBOX_GROUP_CONTEXT_KEY = Symbol('checkbox-group');
const CHECKBOX_GROUP_ITEM_CONTEXT_KEY = Symbol('checkbox-group-item');

export function setCheckboxGroupContext(state: CheckboxGroupRootState): CheckboxGroupRootState;
export function getCheckboxGroupContext(consumer: string): CheckboxGroupRootState; // throws
export function setCheckboxGroupItemContext(state: CheckboxGroupItemState): CheckboxGroupItemState;
export function getCheckboxGroupItemContext(consumer: string): CheckboxGroupItemState; // throws
```

Thrown messages (FR-023, one test each):

- `` `<CheckboxGroup.Item>` must be used within `<CheckboxGroup.Root>`. `` — and the same shape for
  `List`, `Label`, `Description`, `Message`.
- `` `<CheckboxGroup.Indicator>` must be used within `<CheckboxGroup.Item>`. ``

## Rendered elements, attributes and slots

Boolean data attributes are written `cond ? '' : undefined` (Principle VIII).

| Part            | Element                    | `data-slot`                     | Attributes                                                                                                                                              |
| --------------- | -------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Root**        | `<div>`                    | `checkbox-group`                | `role="group"`, `aria-labelledby`, `aria-describedby`, `aria-readonly`, `aria-orientation`, `aria-invalid`, `dir`, `data-orientation`, `data-disabled`, `data-invalid`, `data-readonly` |
| **Label**       | `Label.Root` → `<label>`   | `checkbox-group-label`          | `id={labelId}`, `data-disabled`                                                                                                                          |
| **List**        | `<div>`                    | `checkbox-group-list`           | `role="group"`, `id={listId}`, `data-orientation`, `data-invalid`, `data-disabled`                                                                        |
| **Item**        | `<button type="button">`   | `checkbox-group-item`           | `role="checkbox"`, `id`, `aria-checked`, `aria-disabled`, `aria-invalid`, `aria-required`, `disabled`, `data-state`, `data-orientation`, `data-disabled`, `data-invalid` |
| Item box        | `<span>`                   | `checkbox-group-item-box`       | decorative (`aria-hidden` not needed — it is inside the checkbox's own subtree and carries no text) |
| Item input      | `<input type="checkbox">`  | `checkbox-group-item-input`     | `aria-hidden="true"`, `tabindex="-1"`, `name`, `value`, `checked`, `disabled`, `required`, `readonly`, off-screen inline style; rendered only when `isFormControl` |
| **Indicator**   | `<span>`                   | `checkbox-group-indicator`      | `data-state`, `data-disabled`; rendered when `forceMount \|\| checked`                                                                                    |
| **Description** | `<div>`                    | `checkbox-group-description`    | `id={descriptionId}`, `aria-live`, `aria-invalid`, `aria-describedby={labelId}` (only when a label is registered), `data-disabled`, `data-invalid`; absent while `hideOnError && isInvalid` |
| **Message**     | `<div>`                    | `checkbox-group-message`        | `id={messageId}`, `aria-live`, `data-disabled`, `data-invalid`; renders only when `isInvalid` **and** there is content                                     |

`aria-orientation` on a `role="group"` is upstream behaviour (`checkbox-group-root.tsx:174`) and is
reproduced; `aria-required` on the item is added so the required state is exposed to assistive tech
without relying on the hidden input (Principle III), and mirrors what `bits-ui`'s checkbox emits.

## State transitions

| From                                   | Trigger                                     | To                                                                              |
| -------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------- |
| unchecked item                         | click / `Space` (not disabled, not readOnly) | `value = [...value, itemValue]`, `onValidate` runs, `onValueChange` fires        |
| checked item                           | click / `Space`                              | `value = value.filter(v => v !== itemValue)`, same callbacks                     |
| any                                    | `readOnly`                                   | no change, no callback                                                          |
| any                                    | `disabled` (group or item)                   | button is `disabled`: not focusable, no click                                    |
| valid                                  | `onValidate` returns `string \| string[]`    | `validationMessage` set ⇒ `isInvalid` ⇒ `data-invalid`/`aria-invalid`, message renders, `hideOnError` description unmounts |
| invalid                                | `onValidate` returns `true \| null \| undefined` | `validationMessage = undefined` ⇒ state clears (unless `invalid` prop is set) |
| any                                    | enclosing form `reset`                       | `value = defaultValue`, `validationMessage = undefined`                          |
| empty value + `required`               | any item checked                             | every item's hidden `required` clears (FR-007)                                   |
</content>
