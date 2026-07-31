# Contract: Action Bar public API

The UI contract this registry item exposes to consumers. Every row is derived from
`.reference/diceui/docs/registry/bases/radix/ui/action-bar.tsx` and
`.reference/diceui/docs/types/radix/action-bar.ts` at the pinned commit; line references are to
`action-bar.tsx`. Divergences are marked **[svelte]** and are justified in `plan.md`
§"Assumption refinements" or in the spec's Assumptions.

## Barrel — `src/lib/components/ui/action-bar/index.ts`

```ts
import Root from './action-bar.svelte';
import Selection from './action-bar-selection.svelte';
import Group from './action-bar-group.svelte';
import Item from './action-bar-item.svelte';
import Close from './action-bar-close.svelte';
import Separator from './action-bar-separator.svelte';
import Portal from './action-bar-portal.svelte';

export {
	Root, Selection, Group, Item, Close, Separator, Portal,
	//
	Root as ActionBar,
	Selection as ActionBarSelection,
	Group as ActionBarGroup,
	Item as ActionBarItem,
	Close as ActionBarClose,
	Separator as ActionBarSeparator,
	Portal as ActionBarPortal
};
```

Both usage styles must work:

```ts
import * as ActionBar from '$lib/components/ui/action-bar/index.js'; // ActionBar.Root, ActionBar.Item
import { ActionBar, ActionBarItem } from '$lib/components/ui/action-bar/index.js';
```

Types exported from the barrel: `ActionBarRootProps`, `ActionBarProps` (alias),
`ActionBarChildProps`, `ActionBarSelectionProps`, `ActionBarSelectionChildProps`,
`ActionBarGroupProps`, `ActionBarGroupChildProps`, `ActionBarItemProps`,
`ActionBarItemChildProps`, `ActionBarItemSelectEvent`, `ActionBarCloseProps`,
`ActionBarCloseChildProps`, `ActionBarSeparatorProps`, `ActionBarSeparatorChildProps`,
`ActionBarPortalProps`, `ActionBarSide`, `ActionBarAlign`, `ActionBarOrientation`,
plus the shared `FloatingSide`, `FloatingAlign`, `FloatingOrientation`, `RovingFocusIntent`,
`RovingFocusItemMeta`.

Runtime values exported from the barrel: `ActionBarRootState`, `EscapeDismissState`,
`RovingFocusGroupState`, `setActionBarContext`, `getActionBarContext`, `setRovingFocusContext`,
`getRovingFocusContext`, `getViewportEdgeStyle`, `focusFirst`, `wrapArray`, `getDirectionAwareKey`,
`getFocusIntent`, `floatingSurfaceVariants`, `actionBarSeparatorVariants`, `FLOATING_SIDES`,
`FLOATING_ALIGNMENTS`, `FLOATING_ORIENTATIONS`, `DEFAULT_SIDE_OFFSET`, `DEFAULT_ALIGN_OFFSET`,
`ACTION_BAR_ITEM_SELECT`, `ACTION_BAR_ENTRY_FOCUS`, `ACTION_BAR_EVENT_OPTIONS`,
`ACTION_BAR_ITEM_SELECT_OPTIONS`.

---

## Common to every part

| Prop         | Type                                     | Default | Notes                                                            |
| ------------ | ---------------------------------------- | ------- | ---------------------------------------------------------------- |
| `ref`        | `HTMLElement \| null`                    | `null`  | `$bindable`, applied with `bind:this` — replaces `forwardRef`     |
| `class`      | `string`                                 | —       | Destructured as `class: className`, merged **last** through `cn()` |
| `children`   | `Snippet`                                | —       | Rendered with `{@render children?.()}`                            |
| `child`      | `Snippet<[{ props: …ChildProps }]>`       | —       | **[svelte]** replaces upstream `asChild`; when supplied, `children` is not rendered and `ref` stays `null` |
| `...restProps` | element attributes                     | —       | Always spread onto the rendered element                          |

---

## `ActionBar` (Root) — lines 112-235

`role="toolbar"`, `aria-orientation={orientation}`, `dir={resolvedDir}`. Renders nothing when `open`
is `false` (line 193).

| Prop              | Type                                            | Default          | Bindable | Upstream |
| ----------------- | ----------------------------------------------- | ---------------- | -------- | -------- |
| `open`            | `boolean`                                       | `false`          | **yes**  | 113, 128 |
| `defaultOpen`     | `boolean`                                       | `false`          | no       | **[svelte]** uncontrolled seed (CLAUDE.md §4) |
| `onOpenChange`    | `(open: boolean) => void`                       | —                | no       | 114      |
| `onEscapeKeyDown` | `(event: KeyboardEvent) => void`                | —                | no       | 115, 167-173 |
| `side`            | `'top' \| 'bottom'`                             | `'bottom'`       | no       | 118, 131 |
| `sideOffset`      | `number`                                        | `16`             | no       | 119, 134 |
| `align`           | `'start' \| 'center' \| 'end'`                  | `'center'`       | no       | 116, 133 |
| `alignOffset`     | `number`                                        | `0`              | no       | 117, 132 |
| `portalContainer` | `Element \| DocumentFragment \| string \| null` | `document.body`  | no       | 120, 190-191 (`string` is **[svelte]**, accepted by `bits-ui` `Portal`) |
| `dir`             | `'ltr' \| 'rtl'`                                | provider → DOM → `'ltr'` | no | 121, 156 |
| `orientation`     | `'horizontal' \| 'vertical'`                    | `'horizontal'`   | no       | 122, 137 |
| `loop`            | `boolean`                                       | `true`           | no       | 123, 138 |

**Data attributes** (MDX API reference): `data-slot="action-bar"`, `data-side="top|bottom"`,
`data-align="start|center|end"`, `data-orientation="horizontal|vertical"`.

**Inline style** (lines 220-229), applied before the caller's `style`:

| `align`  | Style produced                                        |
| -------- | ----------------------------------------------------- |
| any      | `<side>: <sideOffset>px`                              |
| `center` | `left: 50%; translate: -50% 0`                        |
| `start`  | `left: <alignOffset>px`                               |
| `end`    | `right: <alignOffset>px`                              |

**Classes** (lines 210-219): `fixed z-50 rounded-lg border bg-card shadow-lg outline-none`, the
transition recipe, and `flex flex-row items-center gap-2 px-2 py-1.5` (horizontal) or
`flex flex-col items-start gap-2 px-1.5 py-2` (vertical).

**Behaviour contract**

1. `open === false` → no DOM node, no portal, no listener.
2. `open === true` → the toolbar is mounted into the portal container and plays the enter transition.
3. `Escape` anywhere in the owner document → `onEscapeKeyDown(event)`; if not default-prevented,
   `onOpenChange(false)` (and the binding is updated).
4. The root never changes `open` on its own outside `setOpen`.

---

## `ActionBarSelection` — lines 237-252

No extra props. `data-slot="action-bar-selection"`. Classes:
`flex items-center gap-1 rounded-sm border px-2 py-1 font-medium text-sm tabular-nums`.

---

## `ActionBarGroup` — lines 254-418

`role="group"`, `dir={contextDir}`, `data-slot="action-bar-group"`,
`data-orientation={contextOrientation}`.

| Attribute  | Value                                                                    | Upstream |
| ---------- | ------------------------------------------------------------------------ | -------- |
| `tabindex` | `-1` when tabbing back out **or** there are zero enabled items; else `0` | 402      |

Classes: `flex gap-2 outline-none` + `items-center` (horizontal) or `w-full flex-col items-start`
(vertical).

**Handled events** — each runs the caller's handler first and early-returns when
`event.defaultPrevented`:

| Event                          | Behaviour                                                                                                          | Upstream |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ | -------- |
| `onfocusin` **[svelte]** (`onFocus`) | When `target === currentTarget`, focus is not a click-focus and not tabbing back out: dispatch the cancelable `actionbarFocusGroup.onEntryFocus` event; unless prevented, focus the current tab-stop item, else the first enabled item. Always clears the click-focus flag. | 328-358 |
| `onfocusout` **[svelte]** (`onBlur`) | `isTabbingBackOut = false`                                                                                     | 318-326  |
| `onmousedown`                  | `isClickFocus = true`                                                                                                | 360-368  |

Requires an `ActionBar` ancestor; otherwise throws
`` `<ActionBar.Group>` must be used within `<ActionBar>`. `` (line 84 equivalent).

---

## `ActionBarItem` — lines 420-591

Renders `$lib/components/ui/button` with `type="button"`, `data-slot="action-bar-item"`.

| Prop       | Type                                        | Default       | Bindable | Upstream |
| ---------- | ------------------------------------------- | ------------- | -------- | -------- |
| `onSelect` | `(event: ActionBarItemSelectEvent) => void` | —             | no       | 422, 468-492 |
| `variant`  | `ButtonVariant`                             | `'secondary'` | no       | 578      |
| `size`     | `ButtonSize`                                | `'sm'`        | no       | 579      |
| `disabled` | `boolean`                                   | `undefined`   | no       | 580      |
| `ref`      | `HTMLButtonElement \| null`                 | `null`        | **yes**  | 439      |

`ActionBarItemSelectEvent = CustomEvent<never>` — the bubbling, cancelable `actionbar.itemSelect`
event.

| Attribute  | Value                                        | Upstream |
| ---------- | -------------------------------------------- | -------- |
| `tabindex` | `0` when this item is the group's tab stop, else `-1` | 581 |
| `class`    | `w-full` added when the root orientation is vertical  | 583 |

**Handled events** — caller handler first, early-return on `defaultPrevented`:

| Event         | Behaviour                                                                                                                                   | Upstream |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `onclick`     | Attach a one-shot `actionbar.itemSelect` listener calling `onSelect`, dispatch the event, then `onOpenChange(false)` unless default-prevented | 468-492  |
| `onfocus`     | `onItemFocus(itemId)`                                                                                                                        | 494-503  |
| `onkeydown`   | `Shift+Tab` → `onItemShiftTab()` and return. Otherwise resolve a focus intent (R-10) and navigate                                             | 505-556  |
| `onmousedown` | `disabled` → `preventDefault()`; else `onItemFocus(itemId)`                                                                                  | 558-572  |

**Registration**: an `$effect` registers `{ id, element, meta: { getDisabled } }` with the group
collection and unregisters on teardown (lines 449-466).

Requires an `ActionBar` **and** an `ActionBarGroup` ancestor (lines 442-444); throws otherwise.

---

## `ActionBarClose` — lines 593-626

`<button type="button" data-slot="action-bar-close">`, its own tab stop (never registered with the
group). Classes:
`rounded-xs opacity-70 outline-none hover:opacity-100 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0`.

| Event     | Behaviour                                                              | Upstream |
| --------- | ---------------------------------------------------------------------- | -------- |
| `onclick` | Caller handler first; unless default-prevented, `onOpenChange(false)`   | 602-610  |

Requires an `ActionBar` ancestor; otherwise throws
`` `<ActionBar.Close>` must be used within `<ActionBar>`. ``

---

## `ActionBarSeparator` — lines 628-659

`role="separator"`, `aria-orientation={orientation}`, `aria-hidden="true"`,
`data-slot="action-bar-separator"`.

| Prop          | Type                         | Default                | Bindable | Upstream |
| ------------- | ---------------------------- | ---------------------- | -------- | -------- |
| `orientation` | `'horizontal' \| 'vertical'` | the root's orientation | no       | 629, 641 |

Classes:
`in-data-[slot=action-bar-selection]:ml-0.5 in-data-[slot=action-bar-selection]:h-4 in-data-[slot=action-bar-selection]:w-px bg-border`
plus `h-6 w-px` (horizontal) or `h-px w-full` (vertical).

Requires an `ActionBar` ancestor; otherwise throws
`` `<ActionBar.Separator>` must be used within `<ActionBar>`. ``

---

## `ActionBarPortal` — **[svelte]** addition

Not an upstream part. The portal host extracted for reuse by `selection-toolbar` (FR-016).

| Prop       | Type                                            | Default         |
| ---------- | ----------------------------------------------- | --------------- |
| `to`       | `Element \| DocumentFragment \| string \| null`  | `document.body` |
| `children` | `Snippet`                                       | —               |

Delegates to `bits-ui`'s `Portal` for `Element` / `string` / `null` / `undefined` targets; for a
`DocumentFragment` it appends a `display: contents` host element to the fragment (removed on teardown)
and portals into that host.

---

## Registry contract

```jsonc
{
	"name": "action-bar",
	"type": "registry:ui",
	"title": "Action Bar",
	"description": "A floating action bar that appears at the bottom or top of the viewport to display contextual actions for selected items.",
	"registryDependencies": ["button", "direction-provider", "speed-dial"],
	"dependencies": ["bits-ui", "tailwind-variants"],
	"files": [
		{ "path": "src/lib/components/ui/action-bar/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/action-bar/action-bar.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/action-bar/action-bar-portal.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/action-bar/action-bar-selection.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/action-bar/action-bar-group.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/action-bar/action-bar-item.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/action-bar/action-bar-close.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/action-bar/action-bar-separator.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/action-bar/action-bar.svelte.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/action-bar/action-bar-floating.svelte.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/action-bar/action-bar-roving-focus.svelte.ts", "type": "registry:ui" }
	]
}
```

Test files (`action-bar.test.ts`, `action-bar.test.svelte`) are deliberately absent from `files`.
`registry:build` must be re-run after appending the entry.
