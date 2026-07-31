# Contract: Public API of `editable`

**Feature**: `023-port-editable` | Upstream: `docs/registry/bases/radix/ui/editable.tsx` @ `d9763d8`

The interface this registry item exposes to consumers. `plan.md` § "Public API" holds the prose
version with defaults and notes; this file is the exhaustive export list that `index.ts` must satisfy
and that the demo page's props tables must document.

## 1. `index.ts` — required exports

```ts
import Root from './editable.svelte';
import Label from './editable-label.svelte';
import Area from './editable-area.svelte';
import Preview from './editable-preview.svelte';
import Input from './editable-input.svelte';
import Trigger from './editable-trigger.svelte';
import Toolbar from './editable-toolbar.svelte';
import Cancel from './editable-cancel.svelte';
import Submit from './editable-submit.svelte';

export type { EditableProps, EditableRootProps } from './editable.svelte';
export type { EditableLabelChildProps, EditableLabelProps } from './editable-label.svelte';
export type { EditableAreaChildProps, EditableAreaProps } from './editable-area.svelte';
export type { EditablePreviewChildProps, EditablePreviewProps } from './editable-preview.svelte';
export type { EditableInputChildProps, EditableInputProps } from './editable-input.svelte';
export type { EditableTriggerChildProps, EditableTriggerProps } from './editable-trigger.svelte';
export type {
	EditableToolbarChildProps,
	EditableToolbarOrientation,
	EditableToolbarProps
} from './editable-toolbar.svelte';
export type { EditableCancelChildProps, EditableCancelProps } from './editable-cancel.svelte';
export type { EditableSubmitChildProps, EditableSubmitProps } from './editable-submit.svelte';

export {
	EditableRootState,
	getEditableContext,
	setEditableContext,
	type EditableRootStateProps,
	type EditableTriggerMode
} from './editable.svelte.js';

export {
	Root, Label, Area, Preview, Input, Trigger, Toolbar, Cancel, Submit,
	//
	Root as Editable,
	Label as EditableLabel,
	Area as EditableArea,
	Preview as EditablePreview,
	Input as EditableInput,
	Trigger as EditableTrigger,
	Toolbar as EditableToolbar,
	Cancel as EditableCancel,
	Submit as EditableSubmit
};
```

Both consumption styles must work:

```ts
import * as Editable from '$lib/components/ui/editable/index.js'; // Editable.Root, Editable.Preview
import { Editable, EditablePreview } from '$lib/components/ui/editable/index.js';
```

`EditableRootChildProps` is deliberately absent: the root's `child` payload is the plain div
attribute object with no component-specific keys, so it is typed inline as
`HTMLAttributes<HTMLDivElement> & { 'data-slot': 'editable' }` — declare and export it only if the
implementation finds it needs a name.

## 2. Upstream export ↔ our export

| Upstream (`editable.tsx:816-828`) | Here                                        |
| --------------------------------- | --------------------------------------------- |
| `Editable`                        | `Root` / `Editable`                           |
| `EditableLabel`                   | `Label` / `EditableLabel`                     |
| `EditableArea`                    | `Area` / `EditableArea`                       |
| `EditablePreview`                 | `Preview` / `EditablePreview`                 |
| `EditableInput`                   | `Input` / `EditableInput`                     |
| `EditableTrigger`                 | `Trigger` / `EditableTrigger`                 |
| `EditableToolbar`                 | `Toolbar` / `EditableToolbar`                 |
| `EditableCancel`                  | `Cancel` / `EditableCancel`                   |
| `EditableSubmit`                  | `Submit` / `EditableSubmit`                   |
| `type EditableProps`              | `EditableRootProps`, alias `EditableProps`    |
| `useStore as useEditable`         | **not ported** — `bind:value` / `bind:editing` (spec Assumptions, D-6) |

## 3. Prop-level parity table

Legend: **B** = `$bindable`. Every part additionally takes `ref` (`$bindable(null)`), `class`,
`child`, `children`, and any native attribute of its element through `...restProps`.

### Root

| Upstream prop     | Type                                 | Default   | B | Notes             |
| ----------------- | ------------------------------------ | --------- | - | ----------------- |
| `value`           | `string`                             | —         | ✅ |                   |
| `defaultValue`    | `string`                             | `''`      |   |                   |
| `onValueChange`   | `(value: string) => void`            | —         |   | change-guarded    |
| `editing`         | `boolean`                            | —         | ✅ |                   |
| `defaultEditing`  | `boolean`                            | `false`   |   |                   |
| `onEditingChange` | `(editing: boolean) => void`         | —         |   | change-guarded    |
| `onEdit`          | `() => void`                         | —         |   |                   |
| `onSubmit`        | `(value: string) => void`            | —         |   | always fires      |
| `onCancel`        | `() => void`                         | —         |   |                   |
| `onEnterKeyDown`  | `(event: KeyboardEvent) => void`     | —         |   | preventable       |
| `onEscapeKeyDown` | `(event: KeyboardEvent) => void`     | —         |   | preventable       |
| `triggerMode`     | `'click' \| 'dblclick' \| 'focus'`   | `'click'` |   |                   |
| `autosize`        | `boolean`                            | `false`   |   |                   |
| `maxLength`       | `number`                             | —         |   | D-2               |
| `placeholder`     | `string`                             | —         |   |                   |
| `name`            | `string`                             | —         |   | form input        |
| `disabled`        | `boolean`                            | `false`   |   |                   |
| `readOnly`        | `boolean`                            | `false`   |   |                   |
| `required`        | `boolean`                            | `false`   |   |                   |
| `invalid`         | `boolean`                            | `false`   |   |                   |
| `dir`             | `'ltr' \| 'rtl'`                     | inherited |   | direction-provider |
| `id`              | `string`                             | `$props.id()` | | always rendered — D-3 |
| `asChild`         | —                                    | —         |   | → `child` snippet |

### Other parts

| Part      | Own props                                | Presence rule                             |
| --------- | ---------------------------------------- | ----------------------------------------- |
| `Label`   | — (`child`, `children` only)              | always                                    |
| `Area`    | —                                        | always                                    |
| `Preview` | —                                        | `!editing && !readOnly`                   |
| `Input`   | `maxLength`, `disabled`, `readOnly`, `required` (each OR-ed with / falling back to the root's) | `editing \|\| readOnly` |
| `Trigger` | `forceMount` (`false`)                    | `forceMount \|\| (!editing && !readOnly)` |
| `Toolbar` | `orientation` (`'horizontal'`)            | always                                    |
| `Cancel`  | —                                        | `editing \|\| readOnly`                   |
| `Submit`  | —                                        | `editing \|\| readOnly`                   |

## 4. Snippets

| Snippet    | Signature                              | On                                                          |
| ---------- | -------------------------------------- | ------------------------------------------------------------- |
| `children` | `Snippet`                              | all nine parts (on `Preview`, overrides the default `{value \|\| placeholder}` text) |
| `child`    | `Snippet<[{ props: <Part>ChildProps }]>` | all nine parts — replaces upstream `asChild`. In `child` mode `children` is not rendered and `ref` stays `null`. |

## 5. Callbacks / events

The component dispatches no Svelte events (constitution I forbids `createEventDispatcher`). Every
notification is a callback prop on the root, listed in §3. Native DOM handlers passed to any part
(`onclick`, `ondblclick`, `onfocus`, `onkeydown`, `onblur`, `oninput`) run **before** the built-in
behaviour and can suppress it with `event.preventDefault()` (R-11).
