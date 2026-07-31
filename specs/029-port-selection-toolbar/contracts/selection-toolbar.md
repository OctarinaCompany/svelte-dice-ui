# Contract — `selection-toolbar` public API

The interface a consumer installs from the registry. Anything not listed here is internal. Upstream
line references are `.reference/diceui/docs/registry/bases/radix/ui/selection-toolbar.tsx` @ `d9763d8`.

## Import surface

```ts
import * as SelectionToolbar from '$lib/components/ui/selection-toolbar/index.js';
// SelectionToolbar.Root | .Item | .Separator
import {
	SelectionToolbar as SelectionToolbarRoot,
	SelectionToolbarItem,
	SelectionToolbarSeparator,
	getSelectionToolbarContext,
	SELECTION_TOOLBAR_ITEM_SELECT,
	type SelectionToolbarProps,
	type SelectionToolbarItemProps,
	type SelectionToolbarSeparatorProps
} from '$lib/components/ui/selection-toolbar/index.js';
```

Barrel exports: `Root`, `Item`, `Separator` plus the `SelectionToolbar*` prefixed aliases; the state
class, context helpers and constants from `selection-toolbar.svelte.ts`; every `*Props`, `*ChildProps`,
`SelectionToolbarSide`, `SelectionToolbarAlign`, `SelectionRect` and `SelectionToolbarItemSelectEvent`
type. `selection-toolbar-portal.svelte` is internal and not exported (upstream has no `Portal` part).

## Composition

```svelte
<SelectionToolbar.Root container={editor} onSelectionChange={(text) => (count = text.length)}>
	<SelectionToolbar.Item onSelect={(text) => bold(text)}><BoldIcon /></SelectionToolbar.Item>
	<SelectionToolbar.Separator />
	<SelectionToolbar.Item onSelect={(text) => navigator.clipboard.writeText(text)}>
		<CopyIcon />
	</SelectionToolbar.Item>
</SelectionToolbar.Root>
```

## `SelectionToolbar.Root`

Props — see `plan.md` §Public API for the full table. Contract guarantees:

| Guarantee                                                                                                   | Source        |
| ----------------------------------------------------------------------------------------------------------- | ------------- |
| Renders nothing while closed; the surface is portalled (default `document.body`)                            | 526, 532      |
| `role="toolbar"`, `aria-label="Text formatting toolbar"` (overridable), `data-slot="selection-toolbar"`      | 549-551       |
| `data-state` is `"open"` or `"closed"`                                                                      | 552, MDX      |
| Position tracks the selection rect on `side`/`align` with `sideOffset`/`alignOffset`                        | 336-377       |
| Collisions: flips and shifts by default; `sticky`, `collisionBoundary`, `collisionPadding` configure it     | 336-362       |
| `hideWhenDetached` hides (does not close) when the anchor is out of view                                    | 349-350       |
| `updatePositionStrategy="always"` repositions every animation frame                                         | 369-373       |
| The four `--selection-toolbar-*` variables are readable from the surface                                    | 308-334, MDX  |
| `onOpenChange` fires on every transition; `onSelectionChange` on every text change including `""`           | 174-181       |
| `container` scopes tracking; selections outside it are ignored                                              | 403-418       |
| `Escape` and outside pointer press clear the browser selection and close                                    | 498-521       |
| `child` snippet renders the caller's element with the merged props (replaces `asChild`)                     | 528, D-2      |

Behavioural invariant: the component never moves focus, and never calls `preventDefault()` on a
non-mouse pointer event (FR-014).

## `SelectionToolbar.Item`

| Guarantee                                                                                        | Source  |
| ------------------------------------------------------------------------------------------------ | ------- |
| Renders `<button type="button" data-slot="selection-toolbar-item">`, ghost/icon, `size-8`         | 665-677 |
| Dispatches bubbling, cancelable `selectiontoolbar.select` with `detail.text`                      | 612-626 |
| `onSelect(text, event)` receives the text selected at activation time                             | 620     |
| Mouse: `pointerdown` default-prevented, activation on `pointerup`                                 | 629-639 |
| Touch/pen/keyboard (`Enter`, `Space`): activation on `click`                                      | 641-651 |
| A caller `onclick`/`onpointerdown`/`onpointerup` that calls `preventDefault()` suppresses activation | 644, 656 |
| `disabled` suppresses activation (native button semantics)                                        | Button  |
| Throws ``` `<SelectionToolbar.Item>` must be used within `<SelectionToolbar>`. ``` outside the root | 73-79   |

## `SelectionToolbar.Separator`

| Guarantee                                                                                             | Source |
| ------------------------------------------------------------------------------------------------------ | ------ |
| Renders `role="separator" aria-orientation="vertical" aria-hidden="true" data-slot="selection-toolbar-separator"` | 687-692 |
| Classes `mx-0.5 h-6 w-px bg-border`, caller `class` merged last                                       | 693    |
| `child` snippet supported (replaces `asChild`)                                                        | 684    |
| Throws ``` `<SelectionToolbar.Separator>` must be used within `<SelectionToolbar>`. ```                | D-7    |

## Context API (replaces `useSelectionToolbar`, D-6)

```ts
const toolbar = getSelectionToolbarContext('<MyPart>');
toolbar.open; // boolean
toolbar.selectedText; // string
toolbar.selectionRect; // SelectionRect | null
```

Reads are reactive (`$derived`/`$state` fields). Mutation is not part of the contract: `setOpen` exists
for the parts, and consumer-side control goes through the root's `open` binding.

## Registry contract

```jsonc
{
	"name": "selection-toolbar",
	"type": "registry:ui",
	"title": "Selection Toolbar",
	"description": "A floating toolbar that appears on text selection with formatting and utility actions.",
	"registryDependencies": ["button", "direction-provider"],
	"dependencies": ["bits-ui"],
	"files": [
		"src/lib/components/ui/selection-toolbar/index.ts",
		"src/lib/components/ui/selection-toolbar/selection-toolbar.svelte",
		"src/lib/components/ui/selection-toolbar/selection-toolbar-portal.svelte",
		"src/lib/components/ui/selection-toolbar/selection-toolbar-item.svelte",
		"src/lib/components/ui/selection-toolbar/selection-toolbar-separator.svelte",
		"src/lib/components/ui/selection-toolbar/selection-toolbar.svelte.ts"
	]
}
```

(`files` entries carry `"type": "registry:ui"`; the test file and harness are excluded.)
