# Contract: `key-value` Public API

**Feature**: `024-port-key-value` | **Date**: 2026-07-31

The consumer-facing surface of `$lib/components/ui/key-value/index.js`. Derived from
`.reference/diceui/docs/registry/bases/radix/ui/key-value.tsx` and
`.../docs/content/docs/components/radix/key-value.mdx` at the pinned commit.

Conventions used below:

- **B** = the prop is `$bindable`.
- Every part also accepts `ref` (`$bindable`, `HTMLElement | null`, bound with `bind:this`) and
  spreads `...restProps` onto its rendered element, with the caller's `class` merged **last**.
- `WithElementRef<HTMLAttributes<…>>` comes from `$lib/utils.js`.

---

## Barrel

```ts
import * as KeyValue from '$lib/components/ui/key-value/index.js';
// KeyValue.Root, KeyValue.List, KeyValue.Item, KeyValue.KeyInput,
// KeyValue.ValueInput, KeyValue.Remove, KeyValue.Add, KeyValue.Error

import { KeyValue, KeyValueList, KeyValueItem, KeyValueKeyInput,
         KeyValueValueInput, KeyValueRemove, KeyValueAdd, KeyValueError }
  from '$lib/components/ui/key-value/index.js';
```

| Short name  | Prefixed alias       | File                          | Upstream export       |
| ----------- | -------------------- | ----------------------------- | --------------------- |
| `Root`      | `KeyValue`           | `key-value.svelte`            | `KeyValue`            |
| `List`      | `KeyValueList`       | `key-value-list.svelte`       | `KeyValueList`        |
| `Item`      | `KeyValueItem`       | `key-value-item.svelte`       | `KeyValueItem`        |
| `KeyInput`  | `KeyValueKeyInput`   | `key-value-key-input.svelte`  | `KeyValueKeyInput`    |
| `ValueInput`| `KeyValueValueInput` | `key-value-value-input.svelte`| `KeyValueValueInput`  |
| `Remove`    | `KeyValueRemove`     | `key-value-remove.svelte`     | `KeyValueRemove`      |
| `Add`       | `KeyValueAdd`        | `key-value-add.svelte`        | `KeyValueAdd`         |
| `Error`     | `KeyValueError`      | `key-value-error.svelte`      | `KeyValueError`       |

`key-value-item-provider.svelte` is internal: shipped in the registry entry, **not** exported.

### Types exported from the barrel

```ts
export type {
  KeyValueRootProps, KeyValueProps,          // key-value.svelte  (KeyValueProps = alias)
  KeyValueListProps,                         // key-value-list.svelte
  KeyValueItemProps,                         // key-value-item.svelte
  KeyValueKeyInputProps,                     // key-value-key-input.svelte
  KeyValueValueInputProps,                   // key-value-value-input.svelte
  KeyValueRemoveProps,                       // key-value-remove.svelte
  KeyValueAddProps,                          // key-value-add.svelte
  KeyValueErrorProps                         // key-value-error.svelte
};

export {
  KeyValueRootState, KeyValueItemState,
  getKeyValueContext, setKeyValueContext,
  getKeyValueItemContext, setKeyValueItemContext,
  createKeyValueItemId, parseKeyValueText, stripSurroundingQuotes,
  type KeyValueRootStateProps, type KeyValueItemData, type KeyValueField,
  type KeyValueOrientation, type KeyValueItemErrors, type KeyValueErrors
} from './key-value.svelte.js';
```

`getKeyValueContext` is this port's answer to upstream's exported `useKeyValueStore`
(`key-value.tsx:866`) — same purpose (read the list state from outside a part), Svelte shape.

---

## `KeyValue.Root`

`WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'onpaste' | 'dir'>, HTMLDivElement> & {…}`

| Prop                 | Type                                                                       | Default      | B | Upstream                            |
| -------------------- | -------------------------------------------------------------------------- | ------------ | - | ----------------------------------- |
| `value`              | `KeyValueItemData[]`                                                       | —            | ✔ | `value`                             |
| `defaultValue`       | `KeyValueItemData[]`                                                       | one empty row| ✖ | `defaultValue`                      |
| `onValueChange`      | `(value: KeyValueItemData[]) => void`                                      | —            | ✖ | `onValueChange`                     |
| `onPaste`            | `(event: ClipboardEvent, items: KeyValueItemData[]) => void`               | —            | ✖ | `onPaste`                           |
| `onAdd`              | `(value: KeyValueItemData) => void`                                        | —            | ✖ | `onAdd`                             |
| `onRemove`           | `(value: KeyValueItemData) => void`                                        | —            | ✖ | `onRemove`                          |
| `onKeyValidate`      | `(key: string, value: KeyValueItemData[]) => string \| undefined`          | —            | ✖ | `onKeyValidate`                     |
| `onValueValidate`    | `(value: string, key: string, items: KeyValueItemData[]) => string \| undefined` | —      | ✖ | `onValueValidate`                   |
| `maxItems`           | `number`                                                                   | `undefined`  | ✖ | `maxItems`                          |
| `minItems`           | `number`                                                                   | `0`          | ✖ | `minItems`                          |
| `keyPlaceholder`     | `string`                                                                   | `"Key"`      | ✖ | `keyPlaceholder`                    |
| `valuePlaceholder`   | `string`                                                                   | `"Value"`    | ✖ | `valuePlaceholder`                  |
| `allowDuplicateKeys` | `boolean`                                                                  | `false`      | ✖ | `allowDuplicateKeys`                |
| `enablePaste`        | `boolean`                                                                  | `true`       | ✖ | `enablePaste`                       |
| `trim`               | `boolean`                                                                  | `true`       | ✖ | `trim`                              |
| `stripQuotes`        | `boolean`                                                                  | `true`       | ✖ | `stripQuotes`                       |
| `disabled`           | `boolean`                                                                  | `false`      | ✖ | `disabled`                          |
| `readOnly`           | `boolean`                                                                  | `false`      | ✖ | `readOnly`                          |
| `required`           | `boolean`                                                                  | `false`      | ✖ | `required`                          |
| `name`               | `string`                                                                   | —            | ✖ | `name`                              |
| `id`                 | `string`                                                                   | `$props.id()`| ✖ | `id`                                |
| `dir`                | `Direction` (`'ltr' \| 'rtl'`)                                             | inherited    | ✖ | **added** (repo convention, D-10)   |
| `children`           | `Snippet`                                                                  | —            | ✖ | `children`                          |

`value ??= defaultValue` seeds the uncontrolled case exactly once, through `untrack`; when neither is
given the seed is `[{ id: createKeyValueItemId(), key: '', value: '' }]` (upstream `:208-210`).

**Snippets**: `children`. **Callbacks**: the seven `on*` props above; there is no `child` snippet on the
root (upstream's `asChild` — spec Assumptions).

**Data attributes**: `data-slot="key-value"`, `data-disabled`, `data-invalid`, `data-readonly`
(each `'' | undefined`).

**Form**: when a `<form>` ancestor exists, a clipped `type="text"` input carrying `name`, `disabled`,
`required`, `readonly` and `value={JSON.stringify(rows)}` is rendered as a sibling (research R-10).

---

## `KeyValue.List`

`WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {…}`

| Prop          | Type                  | Default      | B | Upstream      |
| ------------- | --------------------- | ------------ | - | ------------- |
| `orientation` | `KeyValueOrientation` | `"vertical"` | ✖ | `orientation` |
| `children`    | `Snippet`             | —            | ✖ | `children`    |

`children` is the **row template** and is rendered once per row inside a per-row context provider
(research R-02). Writing it once is the whole point — do not wrap it in an `{#each}`.

**Data attributes**: `data-slot="key-value-list"`, `data-orientation="vertical" | "horizontal"`.
**Roles**: `role="list"`. `aria-orientation` is deliberately **not** emitted (research R-09, D-6).

Throws ``<KeyValue.List> must be used within <KeyValue.Root>.`` when there is no root context
(upstream `key-value.tsx:72-73` via `useStore`).

---

## `KeyValue.Item`

`WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & { children?: Snippet }`

No own props beyond the DOM ones. **Roles**: `role="listitem"`.
**Data attributes**: `data-slot="key-value-item"`, `data-highlighted` (`'' | undefined`, present when
`root.focusedId` is this row).

Throws ``<KeyValue.Item> must be used within <KeyValue.List>.`` when there is no row context.

---

## `KeyValue.KeyInput`

`WithElementRef<Omit<HTMLInputAttributes, 'value' | 'dir'>, HTMLInputElement> & {…}`

| Prop          | Type      | Default              | B | Upstream                                                             |
| ------------- | --------- | -------------------- | - | --------------------------------------------------------------------- |
| `disabled`    | `boolean` | inherits root        | ✖ | `disabled` (OR-ed with the root's)                                    |
| `readOnly`    | `boolean` | inherits root        | ✖ | `readOnly` (OR-ed)                                                    |
| `required`    | `boolean` | inherits root        | ✖ | `required` (OR-ed)                                                    |
| `placeholder` | `string`  | root's `keyPlaceholder` | ✖ | `placeholder` (caller wins — spread lands after the default, `key-value.tsx:582-583`) |

`ref` binds the underlying `<input>`. `placeholder` defaults to the root's `keyPlaceholder` and is
overridden by a caller-supplied `placeholder`, matching upstream's prop order. Event/DOM props passed
through `...restProps` (e.g. `oninput`, `onblur`, `data-testid`, `aria-label`) land on the control
(the `<input>`); layout props such as `class` land on the wrapper (`Editable.Area`) per R-05.

Internally: `<Editable.Root triggerMode="focus" …>` → `<Editable.Area>` → `<Editable.Preview>` +
`<Editable.Input>` (research R-03). Writes go through `KeyValueRootState.setField(id, 'key', text)`.

**Attributes on the control**: `autocapitalize="off"`, `autocomplete="off"`, `autocorrect="off"`,
`spellcheck="false"`, `aria-invalid`, `aria-describedby` → the key error id when invalid.
The preview carries the same `aria-invalid` / `aria-describedby` so the association survives while the
row is not being edited.

**Data attributes**: `data-slot="key-value-key-input"` on the field wrapper,
`key-value-key-input-preview` on the preview, `key-value-key-input-control` on the `<input>`
(research R-05, D-3).

**Paste**: `onpaste` intercepts multi-line clipboard text (FR-006). A caller-supplied `onpaste` runs
first and `preventDefault()` suppresses the built-in handling (upstream `:484-485`).

**Keyboard**: `Tab` focuses the field and enters edit mode; `Enter` submits; `Escape` cancels and
restores the value edit mode started with — all inherited from `editable`.

Throws ``<KeyValue.KeyInput> must be used within <KeyValue.List>.``

---

## `KeyValue.ValueInput`

`WithElementRef<Omit<HTMLTextareaAttributes, 'value' | 'rows' | 'dir'>, HTMLTextAreaElement> & {…}`

| Prop          | Type      | Default                   | B | Upstream            |
| ------------- | --------- | -------------------------- | - | -------------------- |
| `maxRows`     | `number`  | `undefined`                | ✖ | `maxRows`            |
| `disabled`    | `boolean` | inherits root              | ✖ | `disabled` (OR-ed)   |
| `readOnly`    | `boolean` | inherits root              | ✖ | `readOnly` (OR-ed)   |
| `required`    | `boolean` | inherits root              | ✖ | `required` (OR-ed)   |
| `placeholder` | `string`  | root's `valuePlaceholder`  | ✖ | `placeholder`        |

`maxRows` sets `style="max-height: calc({maxRows} * 1.5em + 1rem)"` and adds `overflow-y-auto`
(upstream `:623`, `:699-707`). The control is a `<textarea class="field-sizing-content min-h-9
resize-none">` rendered through `Editable.Input`'s `child` snippet (research R-04). `placeholder`
defaults to the root's `valuePlaceholder` and is overridden by a caller-supplied `placeholder`.
Event/DOM props passed through `...restProps` land on the `<textarea>` control; layout props such as
`class` land on the wrapper (`Editable.Area`) per R-05.

**Data attributes**: `data-slot="key-value-value-input"` / `-preview` / `-control`, as for the key
field.

**Divergence D-2**: `Enter` submits the edit instead of inserting a newline (the MDX keyboard table
documents `Enter` as submit). Multi-line values still arrive by paste and still wrap and scroll.

Throws ``<KeyValue.ValueInput> must be used within <KeyValue.List>.``

---

## `KeyValue.Remove`

`ButtonProps` (from `$lib/components/ui/button/index.js`), defaulted to
`type="button" variant="outline" size="icon"`.

| Prop         | Type      | Default              | B | Upstream                        |
| ------------ | --------- | -------------------- | - | ------------------------------- |
| `children`   | `Snippet` | `<XIcon />`          | ✖ | `children ?? <XIcon />`         |
| `aria-label` | `string`  | `"Remove"`           | ✖ | **added** (D-13)                |

`disabled` is forced when `root.disabled || root.readOnly || count <= minItems`
(upstream had no `readOnly` term — divergence D-9, research R-12). A caller-supplied `onclick` runs
first; `preventDefault()` does **not** suppress removal upstream, and does not here either — upstream
calls `propsRef.current.onClick?.(event)` and then proceeds unconditionally (`:729-749`), so parity is
kept.

**Data attributes**: `data-slot="key-value-remove"`.

**Focus**: after removal, focus moves to the next row's key field, or the previous row's when the
removed row was last (FR-003 / US1.3, research R-08).

Throws ``<KeyValue.Remove> must be used within <KeyValue.List>.``

---

## `KeyValue.Add`

`ButtonProps`, defaulted to `type="button" variant="outline"`.

| Prop       | Type      | Default                       | B | Upstream                            |
| ---------- | --------- | ----------------------------- | - | ----------------------------------- |
| `children` | `Snippet` | `<PlusIcon data-icon="inline-start" /> Add` | ✖ | `children ?? <><PlusIcon />Add</>` |

`disabled` is forced when `root.disabled || root.readOnly || (maxItems !== undefined && count >= maxItems)`
(the `readOnly` term is divergence D-9).

**Data attributes**: `data-slot="key-value-add"`.
**Focus**: the newly appended row's key field is focused and enters edit mode (FR-002).

Throws ``<KeyValue.Add> must be used within <KeyValue.Root>.`` — note the ancestor is the **root**, not
the list: `Add` sits outside `<KeyValue.List>` in every upstream example.

---

## `KeyValue.Error`

`WithElementRef<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement> & {…}`

| Prop    | Type            | Default | B | Upstream |
| ------- | --------------- | ------- | - | -------- |
| `field` | `KeyValueField` | —       | ✖ | `field`  |

Renders **nothing** when the row has no error for `field` (upstream `:839`). Otherwise a
`<span role="alert" id={errorId(itemId, field)}>` containing the message, classed
`font-medium text-destructive text-sm`.

**Data attributes**: `data-slot="key-value-error"`, `data-field={field}`.

Throws ``<KeyValue.Error> must be used within <KeyValue.List>.``

---

## Keyboard contract (MDX `key-value.mdx:230-249`)

| Keys       | Behaviour                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------- |
| `Tab`      | Move between key fields, value fields, remove buttons and the add button. Landing on a field enters edit mode and selects its text. |
| `Enter`    | Submit the field currently being edited (leaves edit mode, keeps the typed text).                 |
| `Escape`   | Cancel the field currently being edited (leaves edit mode, restores the text edit mode started with). |
| `Ctrl`+`V` | Paste. Multi-line clipboard text in the key field expands into one row per line.                  |

Nothing in the component keys off visual direction, so the table is identical under `dir="rtl"`; only
the visual order of a row's key field / value field / remove button mirrors (FR-014).

---

## Complete divergence register

| #    | Divergence                                                                       | Where recorded |
| ---- | -------------------------------------------------------------------------------- | -------------- |
| D-1  | Fields show a preview until focused instead of a permanently-open input          | spec Assumptions, R-03 |
| D-2  | `Enter` in the value field submits rather than inserting a newline               | R-04           |
| D-3  | `data-slot="key-value-{key,value}-input"` marks the wrapper; `-preview` / `-control` added | R-05 |
| D-4  | Paste additionally suppressed when `disabled` / `readOnly`                       | R-06           |
| D-5  | Focus actually moves on add / remove / paste (upstream only set `focusedId`)     | spec Assumptions, R-08 |
| D-6  | `aria-orientation` omitted from `KeyValue.List`                                  | R-09           |
| D-7  | Form value is `JSON.stringify(rows)`                                             | R-10           |
| D-8  | Row ids are `key-value-item-N`, not UUIDs                                        | spec Assumptions, R-11 |
| D-9  | `readOnly` disables the add and remove buttons                                   | R-12           |
| D-10 | A `dir` prop is added to the root (`tags-input` / `editable` convention)         | this contract  |
| D-11 | `asChild` replaced by direct composition; no `child` snippet is added            | spec Assumptions |
| D-12 | The "With Form" demo uses runes + `$lib/components/ui/field` instead of react-hook-form + zod | spec Assumptions, R-14 |
| D-13 | `KeyValue.Remove` gets a default `aria-label="Remove"` (upstream has no accessible name) | spec Assumptions, this contract |
