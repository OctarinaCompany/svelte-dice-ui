# Contract: Combobox Public API

**Feature**: `026-port-combobox` | **Date**: 2026-07-31

This is the installable surface a consumer gets from
`src/lib/components/ui/combobox/index.ts`. It is the checkable form of the plan's "Public API"
section: anything here that the implementation does not honour is a defect.

---

## 1. Barrel exports

```ts
// components — short names (namespace import) …
export {
	Root, Label, Anchor, Trigger, Input, Cancel,
	BadgeList, BadgeItem, BadgeItemDelete,
	Portal, Content, Arrow, Loading, Empty,
	Group, GroupLabel, Item, ItemText, ItemIndicator, Separator,
	// … and prefixed aliases (named import)
	Root as Combobox,
	Label as ComboboxLabel,
	Anchor as ComboboxAnchor,
	Trigger as ComboboxTrigger,
	Input as ComboboxInput,
	Cancel as ComboboxCancel,
	BadgeList as ComboboxBadgeList,
	BadgeItem as ComboboxBadgeItem,
	BadgeItemDelete as ComboboxBadgeItemDelete,
	Portal as ComboboxPortal,
	Content as ComboboxContent,
	Arrow as ComboboxArrow,
	Loading as ComboboxLoading,
	Empty as ComboboxEmpty,
	Group as ComboboxGroup,
	GroupLabel as ComboboxGroupLabel,
	Item as ComboboxItem,
	ItemText as ComboboxItemText,
	ItemIndicator as ComboboxItemIndicator,
	Separator as ComboboxSeparator
};

// prop types — one per part
export type {
	ComboboxRootProps, ComboboxProps,
	ComboboxLabelProps, ComboboxAnchorProps, ComboboxTriggerProps,
	ComboboxInputProps, ComboboxCancelProps,
	ComboboxBadgeListProps, ComboboxBadgeItemProps, ComboboxBadgeItemDeleteProps,
	ComboboxPortalProps, ComboboxContentProps, ComboboxArrowProps,
	ComboboxLoadingProps, ComboboxEmptyProps,
	ComboboxGroupProps, ComboboxGroupLabelProps,
	ComboboxItemProps, ComboboxItemTextProps, ComboboxItemIndicatorProps,
	ComboboxSeparatorProps
};

// state + shared modules (reused by data-table / faceted)
export {
	ComboboxCollection, ComboboxRootState, ComboboxItemState,
	getComboboxContext, setComboboxContext,
	getComboboxItemContext, setComboboxItemContext,
	getComboboxGroupContext, setComboboxGroupContext,
	getComboboxBadgeListContext, setComboboxBadgeListContext,
	getComboboxBadgeItemContext, setComboboxBadgeItemContext,
	getComboboxContentContext, setComboboxContentContext,
	type ComboboxValue, type ComboboxHighlightDirection,
	type ComboboxItemData, type ComboboxRootStateProps, type ComboboxItemStateProps
} from './combobox.svelte.js';

export {
	createFilter, normalizeWithGaps, scoreItem, ComboboxFilterStore,
	type ComboboxFilter, type ComboboxFilterOptions, type ScoreItemOptions
} from './combobox-filter.js';
```

Both import styles must work:

```ts
import * as Combobox from '$lib/components/ui/combobox/index.js'; // Combobox.Root, Combobox.Item
import { Combobox, ComboboxItem } from '$lib/components/ui/combobox/index.js';
```

## 2. Root

```ts
export type ComboboxValue<Multiple extends boolean = false> = Multiple extends true
	? string[]
	: string;

export type ComboboxRootProps<Multiple extends boolean = false> = WithElementRef<
	Omit<HTMLAttributes<HTMLDivElement>, 'dir'>
> & {
	/** The current value of the combobox. */
	value?: ComboboxValue<Multiple>;
	/** The default value of the combobox. */
	defaultValue?: ComboboxValue<Multiple>;
	/** Event handler called when the value changes. */
	onValueChange?: (value: ComboboxValue<Multiple>) => void;
	/** Whether the combobox is open. */
	open?: boolean;
	/** Whether the combobox is open by default. @default false */
	defaultOpen?: boolean;
	/** Event handler called when the open state of the combobox changes. */
	onOpenChange?: (open: boolean) => void;
	/** The current input value of the combobox. */
	inputValue?: string;
	/** Event handler called when the input value changes. */
	onInputValueChange?: (value: string) => void;
	/** Event handler called when the filter is applied. Can be used to prevent the default filtering behavior. */
	onFilter?: (options: string[], inputValue: string) => string[];
	/** The reading direction of the combobox. @default "ltr" */
	dir?: Direction;
	/** Whether to automatically highlight the first visible item when filtering. @default false */
	autoHighlight?: boolean;
	/** Whether the combobox is disabled. @default false */
	disabled?: boolean;
	/** Whether the combobox uses exact string matching or fuzzy matching. @default false */
	exactMatch?: boolean;
	/** Whether the combobox should filter items externally. @default false */
	manualFiltering?: boolean;
	/** Whether the combobox loops through items. @default false */
	loop?: boolean;
	/** Whether the combobox is modal. @default false */
	modal?: boolean;
	/** Whether the combobox allows multiple values. @default false */
	multiple?: Multiple;
	/** Whether the combobox opens on input focus. @default false */
	openOnFocus?: boolean;
	/** Whether to preserve the input value when the input is blurred and no item is selected. @default false */
	preserveInputOnBlur?: boolean;
	/** Whether the combobox is read-only. @default false */
	readOnly?: boolean;
	/** Whether the combobox is required in a form context. @default false */
	required?: boolean;
	/** The name of the combobox for form submission. */
	name?: string;
	children?: Snippet;
};

/** Non-generic convenience alias for `ComboboxRootProps<boolean>`. */
export type ComboboxProps = ComboboxRootProps<boolean>;
```

`value`, `open` and `inputValue` are `$bindable`. `ref` is `$bindable(null)` on every part.

## 3. Rendered contract per part

| Part            | Element             | Required attributes                                                                                                                                                   | `data-slot`                   | State `data-*`                                            |
| --------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------- |
| Root            | `div`               | —                                                                                                                                                                       | `combobox`                    | `data-state`, `data-disabled`                              |
| Label           | `label`             | `id={labelId}`, `for={inputId}`                                                                                                                                         | `combobox-label`              | —                                                          |
| Anchor          | `div`               | `dir`                                                                                                                                                                   | `combobox-anchor`             | `data-state`, `data-anchor`, `data-disabled`, `data-focused` |
| Trigger         | `button[type=button]` | `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls={listId}`, `dir`, `tabindex="-1"` when enabled                                                              | `combobox-trigger`            | `data-state`, `data-disabled`                              |
| Input           | `input`             | `role="combobox"`, `id={inputId}`, `aria-expanded`, `aria-controls={listId}`, `aria-labelledby={labelId}`, `aria-autocomplete="list"`, `aria-activedescendant`, `aria-disabled`, `aria-readonly`, `autocapitalize/autocomplete/autocorrect="off"`, `spellcheck="false"`, `dir` | `combobox-input`              | —                                                          |
| Cancel          | `button[type=button]` | `aria-controls={inputId}`                                                                                                                                             | `combobox-cancel`             | `data-disabled`                                            |
| BadgeList       | `div`               | `role="listbox"`, `aria-multiselectable`, `aria-orientation`                                                                                                            | `combobox-badge-list`         | `data-orientation`                                         |
| BadgeItem       | `div`               | `role="option"`, `id`, `aria-selected`, `aria-disabled`, `aria-orientation`, `aria-posinset`, `aria-setsize`                                                            | `combobox-badge-item`         | `data-disabled`, `data-highlighted`, `data-orientation`    |
| BadgeItemDelete | `button[type=button]` | `aria-controls={badgeId}`, `aria-disabled`, `tabindex="-1"` when enabled                                                                                              | `combobox-badge-item-delete`  | `data-disabled`, `data-highlighted`                        |
| Content         | `div`               | `role="listbox"`, `id={listId}`, `dir`                                                                                                                                  | `combobox-content`            | `data-state`, `data-side`, `data-align`                    |
| Arrow           | `svg`               | —                                                                                                                                                                       | `combobox-arrow`              | `data-state`, `data-side`, `data-align`                    |
| Loading         | `div`               | `role="progressbar"`, `aria-valuemin="0"`, `aria-valuemax={max}`, `aria-valuenow` when numeric, `aria-label` when `label`                                               | `combobox-loading`            | `data-state`, `data-value`, `data-max`                     |
| Empty           | `div`               | `role="status"`, `aria-live="polite"`, `aria-atomic="true"`                                                                                                             | `combobox-empty`              | `data-state="empty"`                                       |
| Group           | `div`               | `role="group"`, `id`, `aria-labelledby={groupLabelId}`                                                                                                                  | `combobox-group`              | —                                                          |
| GroupLabel      | `div`               | `id={groupLabelId}`                                                                                                                                                     | `combobox-group-label`        | —                                                          |
| Item            | `div`               | `role="option"`, `id`, `aria-selected`, `aria-disabled`, `aria-labelledby={textId}`, `tabindex="-1"` when enabled, `data-dice-collection-item=""`                        | `combobox-item`               | `data-state="checked"\|"unchecked"`, `data-highlighted`, `data-disabled` |
| ItemText        | `span`              | `id={textId}`                                                                                                                                                           | `combobox-item-text`          | —                                                          |
| ItemIndicator   | `span`              | `aria-hidden="true"`                                                                                                                                                    | `combobox-item-indicator`     | —                                                          |
| Separator       | `div`               | `role="separator"`, `aria-hidden="true"`                                                                                                                                | `combobox-separator`          | —                                                          |

Every boolean `data-*` is written `condition ? '' : undefined`.

## 4. CSS variables exposed on `Combobox.Content`

| Variable                  | Meaning                                            |
| ------------------------- | -------------------------------------------------- |
| `--dice-transform-origin` | Transform origin for anchor positioning.           |
| `--dice-anchor-width`     | Width of the anchor element.                       |
| `--dice-anchor-height`    | Height of the anchor element.                      |
| `--dice-available-width`  | Available width in the viewport for the popover.   |
| `--dice-available-height` | Available height in the viewport for the popover.  |

## 5. Conditional rendering contract

| Part            | Renders nothing when …                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------- |
| Cancel          | `!forceMount && inputValue === ''`                                                                  |
| BadgeList       | `!forceMount && (!multiple || values.length === 0)`                                                 |
| Content         | `!forceMount && !open` (presence layer)                                                             |
| Arrow           | `!open`                                                                                             |
| Loading         | `!open || progressState === 'complete'`                                                             |
| Empty           | `!(open && (keepVisible || (itemCount === 0 && search.trim() !== '')))`                              |
| Group           | `!(forceMount || !search || groupHasVisibleItem)`                                                    |
| Item            | `!isItemVisible(value)`                                                                             |
| ItemIndicator   | `!forceMount && !isSelected`                                                                        |
| Separator       | `!keepVisible && search !== ''`                                                                     |

## 6. Errors (each covered by a test)

| Condition                                                | Message                                                             |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| `<Combobox.Item value="">`                               | `` `<Combobox.Item>` value cannot be an empty string. ``             |
| Label/Anchor/Trigger/Input/Cancel/BadgeList/Content/Empty/Group/Item/Separator/Loading outside Root | `` `<Combobox.X>` must be used within `<Combobox.Root>`. ``          |
| `<Combobox.GroupLabel>` outside `<Combobox.Group>`       | `` `<Combobox.GroupLabel>` must be used within `<Combobox.Group>`. `` |
| `<Combobox.ItemText>` / `<Combobox.ItemIndicator>` outside `<Combobox.Item>` | `` `<Combobox.X>` must be used within `<Combobox.Item>`. ``          |
| `<Combobox.BadgeItem>` outside `<Combobox.BadgeList>`    | `` `<Combobox.BadgeItem>` must be used within `<Combobox.BadgeList>`. `` |
| `<Combobox.BadgeItemDelete>` outside `<Combobox.BadgeItem>` | `` `<Combobox.BadgeItemDelete>` must be used within `<Combobox.BadgeItem>`. `` |
| `<Combobox.Arrow>` outside `<Combobox.Content>`          | `` `<Combobox.Arrow>` must be used within `<Combobox.Content>`. ``   |

## 7. Shared-module contract (consumed by `data-table` / `faceted`)

```ts
export type ComboboxFilterOptions = {
	/** Match strings with gaps between words. @default true */
	gapMatch?: boolean;
	/** Collator sensitivity. @default "base" */
	sensitivity?: Intl.CollatorOptions['sensitivity'];
};

export type ComboboxFilter = {
	startsWith(value: string, term: string): boolean;
	endsWith(value: string, term: string): boolean;
	contains(value: string, term: string): boolean;
	fuzzy(value: string, pattern: string): boolean;
};

export function createFilter(options?: ComboboxFilterOptions): ComboboxFilter;
export function normalizeWithGaps(value: string): string;

export type ScoreItemOptions = {
	exactMatch?: boolean;
	onFilter?: (options: string[], term: string) => string[];
};

/** 2 = exact, 1.5 = prefix, 1 = matcher hit, 0 = no match. Empty term scores 1. */
export function scoreItem(value: string, term: string, options?: ScoreItemOptions): number;
```

`ComboboxFilterStore` exposes `search`, `itemCount`, `items: Map<string, number>`,
`groups: Map<string, Set<string>>`, plus `run(items, groups, options)`, `isItemVisible(value)`,
`isListEmpty(manual?)` and `isGroupVisible(groupId, forceMount?)`.

## 8. Registry contract

```jsonc
{
	"name": "combobox",
	"type": "registry:ui",
	"title": "Combobox",
	"description": "An input with a popover that helps users filter through a list of options.",
	"registryDependencies": ["direction-provider", "checkbox-group"],
	"dependencies": ["bits-ui", "@lucide/svelte"],
	"files": [
		{ "path": "src/lib/components/ui/combobox/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox-label.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox-anchor.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox-trigger.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox-input.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox-cancel.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox-badge-list.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox-badge-item.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox-badge-item-delete.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox-portal.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox-content.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox-arrow.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox-loading.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox-empty.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox-group.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox-group-label.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox-item.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox-item-text.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox-item-indicator.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox-separator.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox.svelte.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/combobox/combobox-filter.ts", "type": "registry:ui" }
	]
}
```

23 files. `combobox.test.ts` and `combobox.test.svelte` are deliberately absent.
