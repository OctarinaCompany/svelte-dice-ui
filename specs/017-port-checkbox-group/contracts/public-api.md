# Contract: Checkbox Group public API

The installable surface of `registry:ui` item **`checkbox-group`**. This is what a consumer gets after
`npx shadcn-svelte@latest add <registry>/checkbox-group`, and what the tests assert against.

Every part: `ref` is `$bindable(null)`, `class` is merged **last** through `cn()`, and `...restProps`
is spread onto the rendered element. All prop types are exported from the barrel.

## Imports

```ts
// Namespace style.
import * as CheckboxGroup from '$lib/components/ui/checkbox-group/index.js';
// CheckboxGroup.Root / .Label / .List / .Item / .Indicator / .Description / .Message

// Prefixed style.
import {
	CheckboxGroup,
	CheckboxGroupLabel,
	CheckboxGroupList,
	CheckboxGroupItem,
	CheckboxGroupIndicator,
	CheckboxGroupDescription,
	CheckboxGroupMessage
} from '$lib/components/ui/checkbox-group/index.js';
```

## Types

```ts
type Direction = 'ltr' | 'rtl';
type CheckboxGroupOrientation = 'vertical' | 'horizontal';
type CheckboxGroupValidationResult = string | string[] | true | null | undefined;

export type CheckboxGroupRootProps = WithElementRef<
	Omit<HTMLAttributes<HTMLDivElement>, 'dir'>,
	HTMLDivElement
> & {
	/** Controlled value. Bindable — `bind:value`, or `bind:value={get, set}` to stay authoritative. */
	value?: string[];
	/** Initial value when uncontrolled. Also the value a native form `reset` restores. @default [] */
	defaultValue?: string[];
	/** Callback when value changes. */
	onValueChange?: (value: string[]) => void;
	/** Callback when value is validated. A string/array marks the group invalid and becomes the message. */
	onValidate?: (value: string[]) => CheckboxGroupValidationResult;
	/** Whether the checkbox group is disabled. @default false */
	disabled?: boolean;
	/** Whether the checkbox group is invalid. @default false */
	invalid?: boolean;
	/** Whether the checkbox group is read-only. @default false */
	readOnly?: boolean;
	/** Whether the checkbox group is required in a form context. @default false */
	required?: boolean;
	/** Field name used by every item's hidden input during form submission. */
	name?: string;
	/** The reading direction of the checkbox group. @default resolved from `DirectionProvider`, else "ltr" */
	dir?: Direction;
	/** The orientation of the checkbox group. @default "vertical" */
	orientation?: CheckboxGroupOrientation;
	children?: Snippet;
};

/** Alias kept for upstream parity (`CheckboxGroupRootProps` is the canonical name). */
export type CheckboxGroupProps = CheckboxGroupRootProps;

export type CheckboxGroupLabelProps = WithElementRef<HTMLLabelAttributes, HTMLLabelElement>;

export type CheckboxGroupListProps = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;

export type CheckboxGroupItemProps = WithElementRef<
	Omit<HTMLButtonAttributes, 'value' | 'type' | 'disabled' | 'name'>,
	HTMLButtonElement
> & {
	/** Value of the checkbox. */
	value: string;
	/** Whether the checkbox is disabled. @default false */
	disabled?: boolean;
	/** Whether the checkbox is required. @default false */
	required?: boolean;
	/** Field name for this item's hidden input; overrides the group's `name`. */
	name?: string;
	/** Rendered inside the checkbox box. @default a `<CheckboxGroup.Indicator />` */
	indicator?: Snippet;
	/** The item's visible label — rendered inside the button, so it is the accessible name. */
	children?: Snippet;
};

export type CheckboxGroupIndicatorProps = WithElementRef<
	HTMLAttributes<HTMLSpanElement>,
	HTMLSpanElement
> & {
	/** Whether the indicator should always be rendered. @default false */
	forceMount?: boolean;
	/** The glyph. @default the `check` icon */
	children?: Snippet;
};

export type CheckboxGroupDescriptionProps = WithElementRef<
	HTMLAttributes<HTMLDivElement>,
	HTMLDivElement
> & {
	/** Announce immediately on render (`aria-live="polite"`). @default false */
	announce?: boolean;
	/** Hide the description while the checkbox group is in an error state. @default false */
	hideOnError?: boolean;
};

export type CheckboxGroupMessageProps = WithElementRef<
	HTMLAttributes<HTMLDivElement>,
	HTMLDivElement
> & {
	/** Announce immediately on render (`aria-live="polite"`). @default false */
	announce?: boolean;
	/** Fallback content when `onValidate` supplied no message. */
	children?: Snippet;
};
```

## Barrel (`index.ts`)

```ts
import Root from './checkbox-group.svelte';
import Label from './checkbox-group-label.svelte';
import List from './checkbox-group-list.svelte';
import Item from './checkbox-group-item.svelte';
import Indicator from './checkbox-group-indicator.svelte';
import Description from './checkbox-group-description.svelte';
import Message from './checkbox-group-message.svelte';

export type { CheckboxGroupProps, CheckboxGroupRootProps } from './checkbox-group.svelte';
export type { CheckboxGroupLabelProps } from './checkbox-group-label.svelte';
export type { CheckboxGroupListProps } from './checkbox-group-list.svelte';
export type { CheckboxGroupItemProps } from './checkbox-group-item.svelte';
export type { CheckboxGroupIndicatorProps } from './checkbox-group-indicator.svelte';
export type { CheckboxGroupDescriptionProps } from './checkbox-group-description.svelte';
export type { CheckboxGroupMessageProps } from './checkbox-group-message.svelte';

export {
	CHECKBOX_GROUP_ORIENTATIONS,
	CheckboxGroupItemState,
	CheckboxGroupRootState,
	FormControlState,
	getCheckboxGroupContext,
	getCheckboxGroupItemContext,
	getDataState,
	setCheckboxGroupContext,
	setCheckboxGroupItemContext,
	toValidationMessage,
	type CheckboxGroupOrientation,
	type CheckboxGroupValidationResult
} from './checkbox-group.svelte.js';

export {
	Root,
	Label,
	List,
	Item,
	Indicator,
	Description,
	Message,
	//
	Root as CheckboxGroup,
	Label as CheckboxGroupLabel,
	List as CheckboxGroupList,
	Item as CheckboxGroupItem,
	Indicator as CheckboxGroupIndicator,
	Description as CheckboxGroupDescription,
	Message as CheckboxGroupMessage
};
```

## Composition

```svelte
<CheckboxGroup.Root bind:value name="tricks" onValidate={validate}>
	<CheckboxGroup.Label>Tricks</CheckboxGroup.Label>
	<CheckboxGroup.List>
		<CheckboxGroup.Item value="kickflip">Kickflip</CheckboxGroup.Item>
		<CheckboxGroup.Item value="heelflip">
			{#snippet indicator()}
				<CheckboxGroup.Indicator><FlameIcon /></CheckboxGroup.Indicator>
			{/snippet}
			Heelflip
		</CheckboxGroup.Item>
	</CheckboxGroup.List>
	<CheckboxGroup.Description hideOnError>Select grab tricks</CheckboxGroup.Description>
	<CheckboxGroup.Message />
</CheckboxGroup.Root>
```

## Data attributes (the styling contract)

| Selector                                            | Present when                                    |
| --------------------------------------------------- | ----------------------------------------------- |
| `[data-slot="checkbox-group"][data-invalid]`        | group is invalid                                |
| `[data-slot="checkbox-group"][data-disabled]`       | group is disabled                               |
| `[data-slot="checkbox-group"][data-readonly]`       | group is read-only                              |
| `[data-orientation="vertical" \| "horizontal"]`     | root, list, item                                |
| `[data-slot="checkbox-group-item"][data-state]`     | `"checked"` / `"unchecked"`                     |
| `[data-slot="checkbox-group-item"][data-disabled]`  | item or group disabled                          |
| `[data-slot="checkbox-group-item"][data-invalid]`   | group is invalid                                |
| `[data-slot="checkbox-group-indicator"][data-state]`| `"checked"` / `"unchecked"` (with `forceMount`) |
| `[data-slot="checkbox-group-description"][data-invalid]` / `[data-disabled]` | as the group        |
| `[data-slot="checkbox-group-message"][data-invalid]` / `[data-disabled]`     | as the group        |

## Keyboard contract

| Key     | Result                                                                            |
| ------- | --------------------------------------------------------------------------------- |
| `Tab`   | Moves to the next item — every enabled item is its own tab stop (no roving index). |
| `Space` | Toggles the focused item (native `<button>` activation).                           |
| `Enter` | Does nothing: no toggle, no form submission (`preventDefault`, upstream parity).    |

RTL (`dir="rtl"`) changes visual order only; no key changes meaning (this widget has no arrow-key
navigation — see spec Assumptions).

## `registry.json` entry

```jsonc
{
	"name": "checkbox-group",
	"type": "registry:ui",
	"title": "Checkbox Group",
	"description": "A group of checkboxes that allows multiple selections with support for validation and accessibility.",
	"registryDependencies": ["direction-provider"],
	"dependencies": ["bits-ui", "@lucide/svelte"],
	"files": [
		{ "path": "src/lib/components/ui/checkbox-group/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/checkbox-group/checkbox-group.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/checkbox-group/checkbox-group-label.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/checkbox-group/checkbox-group-list.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/checkbox-group/checkbox-group-item.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/checkbox-group/checkbox-group-indicator.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/checkbox-group/checkbox-group-description.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/checkbox-group/checkbox-group-message.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/checkbox-group/checkbox-group.svelte.ts", "type": "registry:ui" }
	]
}
```

Test files are deliberately absent. `registryDependencies` lists `direction-provider` because
`checkbox-group.svelte` imports `useDirection()` from it (R-05); `dependencies` names the two npm
packages the CLI cannot infer from a `$lib` rewrite.
</content>
