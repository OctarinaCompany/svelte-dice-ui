# Contract — `tags-input` public interface

The interface this feature exposes to consumers: the barrel export surface, each part's props, the DOM
and ARIA contract, the keyboard contract, and the registry contract. Derived from
`.reference/diceui/packages/tags-input/src`, the registry component and
`docs/content/docs/components/radix/tags-input.mdx` at the pinned commit. Deviations are marked
**D-n** and explained in [../plan.md](../plan.md) and [../research.md](../research.md).

## 1. Barrel — `src/lib/components/ui/tags-input/index.ts`

```ts
import Root from './tags-input.svelte';
import Label from './tags-input-label.svelte';
import Input from './tags-input-input.svelte';
import Item from './tags-input-item.svelte';
import ItemText from './tags-input-item-text.svelte';
import ItemDelete from './tags-input-item-delete.svelte';
import Clear from './tags-input-clear.svelte';

export type { TagsInputProps, TagsInputRootProps } from './tags-input.svelte';
export type { TagsInputLabelProps } from './tags-input-label.svelte';
export type { TagsInputInputProps } from './tags-input-input.svelte';
export type { TagsInputItemProps } from './tags-input-item.svelte';
export type { TagsInputItemTextProps } from './tags-input-item-text.svelte';
export type { TagsInputItemDeleteProps } from './tags-input-item-delete.svelte';
export type { TagsInputClearChildProps, TagsInputClearProps } from './tags-input-clear.svelte';

export {
	findAdjacentIndex,
	getTagsInputContext,
	getTagsInputItemContext,
	setTagsInputContext,
	setTagsInputItemContext,
	splitByDelimiter,
	TagsInputItemState,
	TagsInputRootState,
	type TagsInputBlurBehavior,
	type TagsInputItemStateProps,
	type TagsInputRootStateProps
} from './tags-input.svelte.js';

export {
	Root, Label, Input, Item, ItemText, ItemDelete, Clear,
	//
	Root as TagsInput,
	Label as TagsInputLabel,
	Input as TagsInputInput,
	Item as TagsInputItem,
	ItemText as TagsInputItemText,
	ItemDelete as TagsInputItemDelete,
	Clear as TagsInputClear
};
```

Both import styles must work:

```ts
import * as TagsInput from '$lib/components/ui/tags-input/index.js'; // TagsInput.Root, TagsInput.Item
import { TagsInput, TagsInputItem } from '$lib/components/ui/tags-input/index.js';
```

`tags-input-item-edit.svelte` is internal: shipped in `registry.json`, absent from the barrel, exactly
as upstream keeps `TagsInputEditableItemText` unexported.

## 2. Composition contract

```svelte
<TagsInput.Root bind:value>
	<TagsInput.Label>Tricks</TagsInput.Label>
	<div class="…"> <!-- upstream TagsInputList; a plain div here (D-2) -->
		{#each value as trick (trick)}
			<TagsInput.Item value={trick}>
				<TagsInput.ItemText />
				<TagsInput.ItemDelete />
			</TagsInput.Item>
		{/each}
		<TagsInput.Input placeholder="Add trick…" />
	</div>
	<TagsInput.Clear>Clear</TagsInput.Clear>
</TagsInput.Root>
```

`<TagsInput.ItemText />` with no children renders `displayValue(item.value)`.
`<TagsInput.ItemDelete />` with no children renders an `X` icon from `@lucide/svelte`.

Each of `Label`, `Input`, `Item`, `ItemText`, `ItemDelete`, `Clear` throws when rendered without a
`<TagsInput.Root>` ancestor; `ItemText` and `ItemDelete` additionally throw without a `<TagsInput.Item>`
ancestor. Message shape: `` `<TagsInput.Item>` must be used within `<TagsInput.Root>`. `` (FR-017).

## 3. Props

See the **Public API** section of [../plan.md](../plan.md) for the full per-part tables with types,
defaults and bindability. Summary of what is component-specific (everything else is standard element
attributes forwarded through `...restProps`):

| Part         | Component-specific props                                                                                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Root`       | `value`✳ `defaultValue` `onValueChange` `onValidate` `onInvalid` `displayValue` `addOnPaste` `addOnTab` `disabled` `editable` `loop` `blurBehavior` `delimiter` `max` `required` `readOnly` `name` `dir` `id` `ref`✳ `children` |
| `Label`      | `ref`✳ `children`                                                                                                                                                                |
| `Input`      | `ref`✳                                                                                                                                                                           |
| `Item`       | `value` (required) `disabled` `ref`✳ `children`                                                                                                                                  |
| `ItemText`   | `ref`✳ `children`                                                                                                                                                                |
| `ItemDelete` | `ref`✳ `children`                                                                                                                                                                |
| `Clear`      | `forceMount` `child` `ref`✳ `children`                                                                                                                                           |

✳ bindable.

## 4. DOM, `data-slot` and data-attribute contract

| Part                | Element    | `data-slot`               | State attributes                                                                        |
| ------------------- | ---------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| Root                | `div`      | `tags-input`              | `data-disabled`, `data-invalid`, `data-readonly`, `dir`                                   |
| Label               | `label`    | `tags-input-label`        | `data-disabled`                                                                           |
| Input               | `input`    | `tags-input-input`        | `data-invalid`                                                                            |
| Item                | `div`      | `tags-input-item`         | `data-state="active\|inactive"`, `data-highlighted`, `data-editing`, `data-editable`, `data-disabled` |
| ItemText            | `span`     | `tags-input-item-text`    | —                                                                                         |
| ItemEdit (internal) | `input`    | `tags-input-item-edit`    | —                                                                                         |
| ItemDelete          | `button`   | `tags-input-item-delete`  | `data-state="active\|inactive"`, `data-disabled`                                          |
| Clear               | `button`   | `tags-input-clear`        | `data-state="visible\|invisible"`, `data-disabled`                                        |
| hidden form input   | `input`    | `tags-input-form-input`   | —                                                                                         |

Every boolean data attribute is written `condition ? '' : undefined`, so it is absent when false.

## 5. ARIA contract

| Element    | Attributes                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------- |
| Label      | `id={labelId}`, `for={inputId}`                                                                                      |
| Input      | `id={inputId}`, `aria-labelledby={labelId}` **while a Label is mounted** (D-6), `aria-readonly={readOnly}`, `disabled`, `readonly` |
| Item       | `id={itemId}`, `aria-labelledby={textId}`, `aria-current={isHighlighted}`, `aria-disabled={disabled}`                |
| ItemText   | `id={textId}`                                                                                                        |
| ItemEdit   | `aria-describedby={textId}`, autofocused with its content selected                                                   |
| ItemDelete | `type="button"`, `tabindex={disabled ? undefined : -1}`, `aria-labelledby={textId}`, `aria-controls={itemId}`, `aria-current={isHighlighted}` |
| Clear      | `type="button"`, `aria-disabled={disabled}`                                                                          |

## 6. Keyboard contract (from the MDX Keyboard Interactions table)

| Key                        | Behaviour                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Enter`                    | Input has text ⇒ add a tag. A tag is highlighted and `editable` ⇒ enter edit mode. Inside the edit field ⇒ commit.      |
| `Escape`                   | Clear highlight and edit mode, reset the caret to position 0. Inside the edit field ⇒ discard, re-highlight the tag.    |
| `Backspace`                | Caret at 0: with a highlight ⇒ remove it and highlight the previous tag; with no highlight ⇒ highlight the last tag.    |
| `Delete`                   | Caret at 0 with a highlight ⇒ remove it and highlight the adjacent tag.                                                 |
| `ArrowLeft`                | Caret at 0: move the highlight toward the start; from none, highlight the last tag. Inverted under `dir="rtl"`.         |
| `ArrowRight`               | Move the highlight toward the end; past the last tag (without `loop`) the highlight clears and the caret returns to 0. Inverted under `dir="rtl"`. |
| `Home` / `End`             | With a highlight, jump to the first / last enabled tag.                                                                 |
| `Tab`                      | `addOnTab` and the input has text ⇒ add a tag and stay. Otherwise move focus normally.                                  |
| any printable character    | Clears the highlight; typing continues in the input.                                                                    |

Navigation skips per-item-`disabled` tags (D-5) and wraps only when `loop` is set. Arrow navigation
engages only when the caret is at position 0.

## 7. Form contract

Inside a `<form>`, the root renders one clipped, form-associated `<input type="text">` (D-7) carrying
`name`, `required`, `disabled`, `readonly` and the comma-joined tag list, and dispatches a native
`input` event on every change. Consequences:

- `new FormData(form).get(name)` returns the joined tag list.
- A `required` tags input with zero tags fails native form validation and blocks submission.
- Outside a `<form>`, no hidden input is rendered.
- A native form `reset` does not restore `defaultValue` — upstream parity (research R-11).

## 8. Registry contract

```jsonc
{
	"name": "tags-input",
	"type": "registry:ui",
	"title": "Tags Input",
	"description": "Display a list of tags in an input field with the ability to add, edit, and remove them.",
	"registryDependencies": ["direction-provider", "checkbox-group"],
	"dependencies": ["@lucide/svelte"],
	"files": [
		/* index.ts, tags-input.svelte, tags-input-label.svelte, tags-input-input.svelte,
		   tags-input-item.svelte, tags-input-item-text.svelte, tags-input-item-edit.svelte,
		   tags-input-item-delete.svelte, tags-input-clear.svelte, tags-input.svelte.ts
		   — each { "path": …, "type": "registry:ui" } */
	]
}
```

`name` == folder slug == demo route segment `src/routes/docs/components/tags-input/`. Test files are
excluded. `pnpm run registry:build` regenerates `static/r/tags-input.json`.
