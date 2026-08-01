# Contract: `$lib/components/ui/listbox` public surface

The interface this registry item exposes to consumers. Anything not listed here is private to the folder.

## Import styles (both must work)

```ts
import * as Listbox from '$lib/components/ui/listbox/index.js';
// Listbox.Root, Listbox.Group, Listbox.GroupLabel, Listbox.Item, Listbox.ItemIndicator

import { Listbox, ListboxItem, ListboxItemIndicator } from '$lib/components/ui/listbox/index.js';
```

## `index.ts` barrel

```ts
import Root from './listbox.svelte';
import Group from './listbox-group.svelte';
import GroupLabel from './listbox-group-label.svelte';
import Item from './listbox-item.svelte';
import ItemIndicator from './listbox-item-indicator.svelte';

export type { ListboxRootChildProps, ListboxRootProps } from './listbox.svelte';
export type { ListboxGroupChildProps, ListboxGroupProps } from './listbox-group.svelte';
export type { ListboxGroupLabelChildProps, ListboxGroupLabelProps } from './listbox-group-label.svelte';
export type { ListboxItemChildProps, ListboxItemProps } from './listbox-item.svelte';
export type {
	ListboxItemIndicatorChildProps,
	ListboxItemIndicatorProps
} from './listbox-item-indicator.svelte';

export {
	ListboxCollection,
	ListboxGroupState,
	ListboxItemState,
	ListboxRootState,
	ListboxTypeahead,
	calculateGridLayout,
	findEnabledItem,
	getListboxContext,
	getListboxGroupContext,
	getListboxItemContext,
	getMaxItemValue,
	getMinItemValue,
	hasListboxGroupContext,
	setListboxContext,
	setListboxGroupContext,
	setListboxItemContext,
	type ListboxGroupStateProps,
	type ListboxItemData,
	type ListboxItemStateProps,
	type ListboxMountedItem,
	type ListboxOrientation,
	type ListboxRootStateProps,
	type ListboxValue
} from './listbox.svelte.js';

export {
	Root,
	Group,
	GroupLabel,
	Item,
	ItemIndicator,
	//
	Root as Listbox,
	Group as ListboxGroup,
	GroupLabel as ListboxGroupLabel,
	Item as ListboxItem,
	ItemIndicator as ListboxItemIndicator
};
```

## Component signatures

```svelte
<Listbox.Root
	bind:ref
	bind:value
	{defaultValue}
	{onValueChange}
	{dir}
	{disabled}
	{loop}
	{multiple}
	{orientation}
	{virtual}
	{name}
	class="…"
>…</Listbox.Root>

<Listbox.Group bind:ref class="…">…</Listbox.Group>
<Listbox.GroupLabel bind:ref class="…">…</Listbox.GroupLabel>
<Listbox.Item bind:ref {value} {disabled} {onSelect} class="…">…</Listbox.Item>
<Listbox.ItemIndicator bind:ref {forceMount} class="…">…</Listbox.ItemIndicator>
```

Prop types, defaults and bindability: see `plan.md` §Public API (the normative table). Each part also
accepts `child?: Snippet<[{ props }]>` in place of `children`, and spreads any remaining native attributes
onto its element.

## Rendered contract (what tests assert)

| Selector                                    | Guarantees                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `[data-slot="listbox"]`                     | `role="listbox"`; `aria-multiselectable="true"` iff `multiple`; `data-orientation`; `dir`; `tabindex="0"` unless `disabled` |
| `[data-slot="listbox-item"]`                | `role="option"`; `aria-selected="true"\|"false"`; `tabindex="-1"` unless disabled; `data-selected` / `data-highlighted` / `data-disabled` / `data-focused` present only when true |
| `[data-slot="listbox-group"]`               | `role="group"`; `id`; `aria-labelledby` == the group label's `id`                               |
| `[data-slot="listbox-group-label"]`         | `id` referenced by its group's `aria-labelledby`                                                |
| `[data-slot="listbox-item-indicator"]`      | present only when the item is selected or `forceMount`; `aria-hidden="true"`                    |
| `[data-slot="listbox-form-input"]`          | rendered only inside a `<form>`; one per submitted value under `multiple`; `name`; `disabled`   |

## Errors (part of the API — each has a test)

| Situation                                | Message                                                          |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `Item` / `Group` outside `Root`          | `` `<Listbox.Item>` must be used within `<Listbox.Root>`. ``     |
| `GroupLabel` outside `Group`             | `` `<Listbox.GroupLabel>` must be used within `<Listbox.Group>`. `` |
| `ItemIndicator` outside `Item`           | `` `<Listbox.ItemIndicator>` must be used within `<Listbox.Item>`. `` |
| `Item` with `value=""`                   | `ListboxItem value cannot be an empty string`                    |

## Callback timing

- `onValueChange` fires **after** the item's own `onSelect`, with the fully-computed next value (a `string`
  in single mode, a `string[]` under `multiple`) — never with the previous one.
- A `bind:value` that declines the write leaves the rendered selection where it was, while `onValueChange`
  still fires (the repo-wide function-binding contract).
- No callback fires while the root is `disabled`, or for a `disabled` item.

## Registry contract

```jsonc
{
	"name": "listbox",
	"type": "registry:ui",
	"title": "Listbox",
	"description": "A component for creating keyboard-navigable selection lists and grids.",
	"registryDependencies": ["direction-provider", "checkbox-group"],
	"dependencies": ["@lucide/svelte"],
	"files": [
		{ "path": "src/lib/components/ui/listbox/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/listbox/listbox.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/listbox/listbox-group.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/listbox/listbox-group-label.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/listbox/listbox-item.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/listbox/listbox-item-indicator.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/listbox/listbox.svelte.ts", "type": "registry:ui" }
	]
}
```

`listbox.test.ts` and `listbox.test.svelte` are deliberately absent from `files`.
