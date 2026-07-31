# Contract: DOM surface of `editable`

**Feature**: `023-port-editable` | Source of truth: upstream MDX `DataAttributesTable` blocks +
`editable.tsx`

Every attribute a consumer may style against or a test may assert on. Boolean data attributes are
written `cond ? '' : undefined`, so they are **absent** when false (constitution VIII).

## Per part

### `[data-slot="editable"]` — Root (`<div>`)

| Attribute | Value                        |
| --------- | ---------------------------- |
| `id`      | `id ?? $props.id()` — always rendered (D-3) |

Classes: `flex min-w-0 flex-col gap-2`. No state attributes (upstream sets none).

### `[data-slot="editable-form-input"]` — the clipped form input (`<input type="text">`)

Rendered only inside a `<form>` (`FormControlState.isFormControl`). Carries `name`, `value`,
`disabled`, `required`, `readonly`, `aria-hidden="true"`, `tabindex="-1"` and the clip style. Not part
of the public styling API, but it is what makes native `required` validation work (FR-017, D-5).

### `[data-slot="editable-label"]` — Label (`<label>`)

| Attribute       | Present when       |
| --------------- | ------------------ |
| `id`            | always — `${rootId}-label` |
| `for`           | always — `${rootId}-input` |
| `data-disabled` | root `disabled`    |
| `data-invalid`  | root `invalid`     |
| `data-required` | root `required`    |

Classes: `text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70 data-required:after:ml-0.5 data-required:after:text-destructive data-required:after:content-['*']`.

### `[data-slot="editable-area"]` — Area (`<div>`)

| Attribute       | Present when     |
| --------------- | ---------------- |
| `role`          | always — `group` |
| `dir`           | always           |
| `data-disabled` | root `disabled`  |
| `data-editing`  | `editing`        |

Classes: `relative inline-block min-w-0 data-disabled:cursor-not-allowed data-disabled:opacity-50`.

### `[data-slot="editable-preview"]` — Preview (`<div>`)

Rendered only when `!editing && !readOnly`.

| Attribute       | Value / present when                              |
| --------------- | -------------------------------------------------- |
| `role`          | always — `button`                                  |
| `tabindex`      | `0` unless `disabled \|\| readOnly` (then omitted) |
| `aria-disabled` | `disabled \|\| readOnly`                           |
| `data-empty`    | value is `''`                                      |
| `data-disabled` | root `disabled`                                    |
| `data-readonly` | root `readOnly` (unreachable in practice — kept for parity, spec FR-010) |

Content: `children` if supplied, else `value || placeholder`.
Classes: `cursor-text truncate rounded-sm border border-transparent py-1 text-base focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden data-disabled:cursor-not-allowed data-disabled:opacity-50 data-empty:text-muted-foreground data-readonly:cursor-default md:text-sm`.

### `[data-slot="editable-input"]` — Input (`<input>`)

Rendered only when `editing || readOnly`.

| Attribute         | Value / present when                    |
| ----------------- | ----------------------------------------- |
| `id`              | `${rootId}-input`                         |
| `aria-labelledby` | `${rootId}-label`                         |
| `aria-required`   | `required` (own prop OR root's)           |
| `aria-invalid`    | root `invalid`                            |
| `dir`             | always                                    |
| `disabled`        | own prop OR root's                        |
| `readonly`        | own prop OR root's                        |
| `required`        | own prop OR root's                        |
| `maxlength`       | own prop, else root's (D-2)               |
| `placeholder`     | root's `placeholder`                      |
| `value`           | current value (not `bind:value` — R-12)   |

Classes: `flex rounded-sm border border-input bg-transparent py-1 text-base shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 md:text-sm`
plus `w-auto` when `autosize`, else `w-full`.

### `[data-slot="editable-trigger"]` — Trigger (`<button>`)

Rendered when `forceMount || (!editing && !readOnly)`.

| Attribute       | Value / present when       |
| --------------- | ---------------------------- |
| `type`          | always — `button`            |
| `aria-controls` | always — `rootId`            |
| `aria-disabled` | `disabled \|\| readOnly`     |
| `data-disabled` | root `disabled`              |
| `data-readonly` | root `readOnly`              |

Unstyled by default (upstream adds no classes) — the demos style it through the `child` snippet with
`<Button>`.

### `[data-slot="editable-toolbar"]` — Toolbar (`<div>`)

| Attribute          | Value                          |
| ------------------ | ------------------------------ |
| `role`             | always — `toolbar`             |
| `aria-controls`    | always — `rootId`              |
| `aria-orientation` | `orientation`                  |
| `data-orientation` | `orientation`                  |
| `dir`              | always                         |

Classes: `flex items-center gap-2` plus `flex-col` when vertical.

### `[data-slot="editable-cancel"]` / `[data-slot="editable-submit"]` — Cancel / Submit (`<button>`)

Rendered when `editing || readOnly`.

| Attribute       | Value / present when     |
| --------------- | ------------------------ |
| `type`          | always — `button`        |
| `aria-controls` | always — `rootId`        |
| `data-disabled` | root `disabled`          |
| `data-readonly` | root `readOnly`          |

Unstyled by default, like the trigger.

**These two `data-slot` values are load-bearing behaviour, not just styling hooks**: the input's blur
handler suppresses its commit when `relatedTarget` is inside `[data-slot="editable-trigger"]` or
`[data-slot="editable-cancel"]` (R-15). They must survive the `child` snippet, which they do — the
attribute is part of the spread `props` payload.

## Keyboard contract (upstream MDX `KeyboardShortcutsTable` + `editable.tsx`)

| Key      | Target  | Behaviour                                                                          |
| -------- | ------- | ------------------------------------------------------------------------------------ |
| `Enter`  | Preview | Enters edit mode, whatever `triggerMode` is; `onEnterKeyDown` may `preventDefault()`. |
| `Enter`  | Input   | Submits the current text.                                                            |
| `Escape` | Input   | Cancels, reverts, restores focus to the trigger (D-1); `onEscapeKeyDown` may `preventDefault()`. |
| `Tab`    | any     | Native focus movement. Leaving the input commits (blur-submit), unless focus lands on the trigger or cancel button. |

No key inverts under `dir="rtl"` — the component has no horizontal navigation (FR-019).

## Roles summary (for `getByRole` queries)

| Role      | Element                              |
| --------- | ------------------------------------ |
| `button`  | Preview, Trigger, Cancel, Submit     |
| `group`   | Area                                 |
| `toolbar` | Toolbar                              |
| `textbox` | Input                                |
