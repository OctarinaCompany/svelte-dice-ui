# Public API Contract: Speed Dial

**Feature**: `016-port-speed-dial` | **Date**: 2026-07-30

Authoritative surface of `$lib/components/ui/speed-dial`. Derived from
`.reference/diceui/docs/types/radix/speed-dial.ts` (the documented API),
`.reference/diceui/docs/registry/bases/radix/ui/speed-dial.tsx` (behaviour) and
`.reference/diceui/docs/content/docs/components/radix/speed-dial.mdx` (data attributes, CSS
variables, keyboard table), all at the pinned commit `d9763d8`.

Conventions shared by every part:

- `ref?: HTMLElement | null` — **bindable**, applied with `bind:this`; `null` when `child` is used.
- `class?: string` — merged **last** through `cn()`.
- `child?: Snippet<[{ props: <Part>ChildProps }]>` — replaces `asChild` (research R-11). When
  supplied, the part renders no element of its own and `children` is not rendered by the part.
- All remaining `HTMLAttributes` / `HTMLButtonAttributes` are spread onto the rendered element.
- Upstream JSDoc, including every `@default`, is copied onto the prop.

---

## 1. `SpeedDial` (`.Root`) — `speed-dial.svelte` ← upstream `SpeedDial` (149-307)

| Prop             | Type                                            | Default     | Bindable |
| ---------------- | ----------------------------------------------- | ----------- | -------- |
| `open`           | `boolean \| undefined`                          | `undefined` | **yes**  |
| `defaultOpen`    | `boolean`                                       | `false`     | no       |
| `onOpenChange`   | `(open: boolean) => void`                       | `undefined` | no       |
| `side`           | `'top' \| 'right' \| 'bottom' \| 'left'`        | `'top'`     | no       |
| `activationMode` | `'click' \| 'hover'`                            | `'click'`   | no       |
| `delay`          | `number` (ms before opening on hover)           | `250`       | no       |
| `disabled`       | `boolean`                                       | `false`     | no       |
| `ref`            | `HTMLDivElement \| null`                        | `null`      | **yes**  |
| `class`          | `string`                                        | `undefined` | no       |
| `children`       | `Snippet`                                       | `undefined` | no       |
| `child`          | `Snippet<[{ props: SpeedDialChildProps }]>`     | `undefined` | no       |
| …`HTMLAttributes<HTMLDivElement>` | —                              | —           | no       |

- **Callbacks**: `onOpenChange(next)` on every transition, in both modes (research R-08).
- **Attributes**: `data-slot="speed-dial"`, `data-state="open"|"closed"`,
  `data-disabled` (present only when disabled).
- **Classes**: `relative flex flex-col items-end` + the caller's `class`.
- **Note**: `onpointerdowncapture` is installed by the part; a caller-supplied
  `onpointerdowncapture` is invoked first and `preventDefault()` suppresses the internal logic,
  exactly as upstream (247-261).

## 2. `SpeedDialTrigger` (`.Trigger`) — `speed-dial-trigger.svelte` ← upstream (309-452)

| Prop        | Type                                              | Default       | Bindable |
| ----------- | ------------------------------------------------- | ------------- | -------- |
| `disabled`  | `boolean \| undefined`                            | `undefined`   | no       |
| `id`        | `string \| undefined`                             | `$props.id()` | no       |
| `variant`   | `ButtonVariant`                                   | `'default'`   | no       |
| `size`      | `ButtonSize`                                      | `'icon'`      | no       |
| `ref`       | `HTMLButtonElement \| null`                       | `null`        | **yes**  |
| `children`  | `Snippet`                                         | `undefined`   | no       |
| `child`     | `Snippet<[{ props: SpeedDialTriggerChildProps }]>`| `undefined`   | no       |
| …`ButtonProps` (`onclick`, `onmouseenter`, `onmouseleave`, `class`, …) | — | —   | no       |

- **Effective disabled** = `disabled || root.disabled` (335).
- **ARIA**: `role="button"`, `aria-haspopup="menu"`, `aria-expanded={open}`,
  `aria-controls={contentId}`.
- **Attributes**: `data-slot="speed-dial-trigger"`, `data-state`.
- **Classes**: `size-11 rounded-full` + caller's `class`.
- **Handlers**: caller's `onclick`/`onmouseenter`/`onmouseleave` run first; `defaultPrevented`
  aborts the internal behaviour (366-430).
- Registers itself in the root's node collection, so it is the **first** Tab-exit boundary (R-06).

## 3. `SpeedDialContent` (`.Content`) — `speed-dial-content.svelte` ← upstream (516-839)

| Prop                | Type                                                    | Default     | Bindable |
| ------------------- | ------------------------------------------------------- | ----------- | -------- |
| `offset`            | `number` (px from the trigger)                          | `8`         | no       |
| `gap`               | `number` (px between items)                             | `8`         | no       |
| `forceMount`        | `boolean`                                               | `false`     | no       |
| `onEscapeKeyDown`   | `(event: KeyboardEvent) => void`                        | `undefined` | no       |
| `onInteractOutside` | `(event: SpeedDialInteractOutsideEvent) => void`        | `undefined` | no       |
| `ref`               | `HTMLDivElement \| null`                                | `null`      | **yes**  |
| `children`          | `Snippet`                                               | `undefined` | no       |
| `child`             | `Snippet<[{ props: SpeedDialContentChildProps }]>`      | `undefined` | no       |
| …`HTMLAttributes<HTMLDivElement>` (incl. `style`, `onmouseenter`, `onmouseleave`) | — | — | no |

```ts
export type SpeedDialInteractOutsideEvent = CustomEvent<{ originalEvent: PointerEvent }>;
```

- **ARIA**: `role="menu"`, `aria-orientation` = `vertical` for `top`/`bottom`, `horizontal` for
  `left`/`right`.
- **Attributes**: `data-slot="speed-dial-content"`, `data-state` (tracks the animation, not `open`),
  `data-orientation`, `data-side`.
- **CSS variables**: `--speed-dial-gap`, `--speed-dial-offset`, `--speed-dial-transform-origin`,
  plus the four positioning declarations; the caller's `style` wins over all of them.
- **Presence**: absent from the DOM while closed, kept through the exit stagger, always present with
  `forceMount` (data-model §4).
- Both callbacks are cancelable: `preventDefault()` keeps the dial open.

## 4. `SpeedDialItem` (`.Item`) — `speed-dial-item.svelte` ← upstream (892-934)

| Prop       | Type                                            | Default     | Bindable |
| ---------- | ----------------------------------------------- | ----------- | -------- |
| `ref`      | `HTMLDivElement \| null`                        | `null`      | **yes**  |
| `children` | `Snippet`                                       | `undefined` | no       |
| `child`    | `Snippet<[{ props: SpeedDialItemChildProps }]>` | `undefined` | no       |
| …`HTMLAttributes<HTMLDivElement>` (incl. `style`) | —                        | —           | no       |

- **ARIA**: `role="none"` (the item is a layout wrapper; the action carries `menuitem`).
- **Attributes**: `data-slot="speed-dial-item"`, `data-state`, `data-side`.
- **CSS variables**: `--speed-dial-animation-duration: 200ms`, `--speed-dial-delay: {n}ms`.
- Provides `actionId` / `labelId` to its `Action` and `Label`.
- Requires a `SpeedDial` ancestor; tolerates the absence of a `SpeedDialContent` ancestor
  (`delay = 0`, `data-state="closed"`) — research R-10.

## 5. `SpeedDialAction` (`.Action`) — `speed-dial-action.svelte` ← upstream (941-1025)

| Prop        | Type                                               | Default              | Bindable |
| ----------- | -------------------------------------------------- | -------------------- | -------- |
| `onSelect`  | `(event: SpeedDialActionSelectEvent) => void`      | `undefined`          | no       |
| `disabled`  | `boolean \| undefined`                             | `undefined`          | no       |
| `id`        | `string \| undefined`                              | item's `actionId`    | no       |
| `variant`   | `ButtonVariant`                                    | `'outline'`          | no       |
| `size`      | `ButtonSize`                                       | `'icon'`             | no       |
| `ref`       | `HTMLButtonElement \| null`                        | `null`               | **yes**  |
| `children`  | `Snippet`                                          | `undefined`          | no       |
| `child`     | `Snippet<[{ props: SpeedDialActionChildProps }]>`  | `undefined`          | no       |
| …`ButtonProps` minus `onSelect`                     | —                    | —        | no       |

```ts
export type SpeedDialActionSelectEvent = CustomEvent<never>;   // bubbles, cancelable
```

- **ARIA**: `role="menuitem"`, `aria-labelledby={labelId}`, `id={actionId}`.
- **Attributes**: `data-slot="speed-dial-action"`.
- **Classes**: `size-11 shrink-0 rounded-full bg-accent shadow-md` + caller's `class`.
- **Selection order** (980-1003): caller `onclick` → if not prevented, dispatch
  `speedDial.actionSelect` on the button (bubbling, cancelable) with a one-shot listener that calls
  `onSelect` → if not prevented, close the dial.
- Registers itself in the root's node collection with its `disabled` state (Tab exit, FR-011).
- Requires both a `SpeedDial` and a `SpeedDialItem` ancestor.

## 6. `SpeedDialLabel` (`.Label`) — `speed-dial-label.svelte` ← upstream (1027-1043)

| Prop       | Type                                             | Default     | Bindable |
| ---------- | ------------------------------------------------ | ----------- | -------- |
| `ref`      | `HTMLDivElement \| null`                         | `null`      | **yes**  |
| `children` | `Snippet`                                        | `undefined` | no       |
| `child`    | `Snippet<[{ props: SpeedDialLabelChildProps }]>` | `undefined` | no       |
| …`HTMLAttributes<HTMLDivElement>` | —                                 | —           | no       |

- `id={labelId}`, `data-slot="speed-dial-label"`.
- **Classes**: `pointer-events-none whitespace-nowrap rounded-md bg-popover px-2 py-1 text-sm text-popover-foreground shadow-md`
  + caller's `class`. `class="sr-only"` is the documented way to keep the name without the visual
  chip (four of the five upstream demos do this).
- Requires a `SpeedDialItem` ancestor.

## 7. Module exports — `speed-dial.svelte.ts` and `speed-dial-collection.svelte.ts`

```ts
// constants + pure helpers
DEFAULT_GAP, DEFAULT_OFFSET, DEFAULT_ITEM_DELAY, DEFAULT_HOVER_CLOSE_DELAY,
DEFAULT_ANIMATION_DURATION, DEFAULT_HOVER_OPEN_DELAY,
SPEED_DIAL_SIDES, SPEED_DIAL_ACTIVATION_MODES,
ACTION_SELECT_EVENT, INTERACT_OUTSIDE_EVENT,
getDataState, getTransformOrigin, getOrientation, getContentPosition, getItemDelay

// variants
speedDialContentVariants, speedDialItemVariants

// state + context
SpeedDialRootState,    setSpeedDialContext,        getSpeedDialContext(consumerName)
SpeedDialContentState, setSpeedDialContentContext, getSpeedDialContentContext() // optional → | undefined
SpeedDialItemState,    setSpeedDialItemContext,    getSpeedDialItemContext(consumerName)

// types
SpeedDialSide, SpeedDialActivationMode, SpeedDialOrientation,
SpeedDialRootStateProps, SpeedDialContentStateProps

// reusable (research R-16)
DomOrderedCollection
```

`getSpeedDialContext` / `getSpeedDialItemContext` throw
`` `<SpeedDial.Trigger>` must be used within `<SpeedDial.Root>`. `` and
`` `<SpeedDial.Action>` must be used within `<SpeedDial.Item>`. `` respectively (FR-020).
`getSpeedDialContentContext` returns `undefined` rather than throwing (research R-10).

## 8. `index.ts` barrel

```ts
import Root from './speed-dial.svelte';
import Trigger from './speed-dial-trigger.svelte';
import Content from './speed-dial-content.svelte';
import Item from './speed-dial-item.svelte';
import Action from './speed-dial-action.svelte';
import Label from './speed-dial-label.svelte';

export type { SpeedDialChildProps, SpeedDialProps, SpeedDialRootProps } from './speed-dial.svelte';
export type { SpeedDialTriggerChildProps, SpeedDialTriggerProps } from './speed-dial-trigger.svelte';
export type {
  SpeedDialContentChildProps,
  SpeedDialContentProps,
  SpeedDialInteractOutsideEvent
} from './speed-dial-content.svelte';
export type { SpeedDialItemChildProps, SpeedDialItemProps } from './speed-dial-item.svelte';
export type {
  SpeedDialActionChildProps,
  SpeedDialActionProps,
  SpeedDialActionSelectEvent
} from './speed-dial-action.svelte';
export type { SpeedDialLabelChildProps, SpeedDialLabelProps } from './speed-dial-label.svelte';

export { /* everything from §7 */ } from './speed-dial.svelte.js';
export { DomOrderedCollection } from './speed-dial-collection.svelte.js';

export {
  Root, Trigger, Content, Item, Action, Label,
  //
  Root as SpeedDial,
  Trigger as SpeedDialTrigger,
  Content as SpeedDialContent,
  Item as SpeedDialItem,
  Action as SpeedDialAction,
  Label as SpeedDialLabel
};
```

Both usages work, matching every other component in the repo:

```ts
import * as SpeedDial from '$lib/components/ui/speed-dial/index.js'; // SpeedDial.Root, .Action
import { SpeedDial, SpeedDialAction } from '$lib/components/ui/speed-dial/index.js';
```

## 9. `registry.json` entry (appended as the 17th item)

```jsonc
{
  "name": "speed-dial",
  "type": "registry:ui",
  "title": "Speed Dial",
  "description": "A floating action button that reveals a set of actions when triggered.",
  "registryDependencies": ["button"],
  "dependencies": ["tailwind-variants"],
  "files": [
    { "path": "src/lib/components/ui/speed-dial/index.ts", "type": "registry:ui" },
    { "path": "src/lib/components/ui/speed-dial/speed-dial.svelte", "type": "registry:ui" },
    { "path": "src/lib/components/ui/speed-dial/speed-dial-trigger.svelte", "type": "registry:ui" },
    { "path": "src/lib/components/ui/speed-dial/speed-dial-content.svelte", "type": "registry:ui" },
    { "path": "src/lib/components/ui/speed-dial/speed-dial-item.svelte", "type": "registry:ui" },
    { "path": "src/lib/components/ui/speed-dial/speed-dial-action.svelte", "type": "registry:ui" },
    { "path": "src/lib/components/ui/speed-dial/speed-dial-label.svelte", "type": "registry:ui" },
    { "path": "src/lib/components/ui/speed-dial/speed-dial.svelte.ts", "type": "registry:ui" },
    { "path": "src/lib/components/ui/speed-dial/speed-dial-collection.svelte.ts", "type": "registry:ui" }
  ]
}
```

`speed-dial.test.ts` and `speed-dial.test.svelte` are deliberately absent (Principle V).
`bits-ui` is **not** listed: this component composes no bits-ui primitive (research R-04, R-05).

## 10. Divergences from upstream (all mirrored into `spec.md` → Assumptions)

| # | Upstream                                              | Here                                                          | Why |
| - | ----------------------------------------------------- | ------------------------------------------------------------- | --- |
| 1 | `asChild` on all six parts                            | `child` snippet on all six parts                              | `CLAUDE.md` §10; no Svelte `Slot` (R-11) |
| 2 | `Store` + `useSyncExternalStore`                      | one runes state class on a `Symbol` context                   | undocumented internal layer (R-02) |
| 3 | `React.Children.map` stagger                          | items self-register into a document-ordered collection        | no children introspection in Svelte (R-01) |
| 4 | `open` prop + internal store                          | `open` is `$bindable` **and** `onOpenChange` still fires      | FR-002 (R-08) |
| 5 | `Escape` only closes                                  | `Escape` closes **and** restores focus to the trigger         | the MDX keyboard table says so; Principle III (R-07) |
| 6 | content positioned only while open                    | always positioned                                             | matters only under `forceMount`; upstream's gating is a React artifact (R-04) |
| 7 | `data-disabled={false}` always emitted                | `data-disabled` present only when disabled                    | Principle VIII boolean-attribute rule |
| 8 | `useComposedRefs` / `useAsRef` / `useLazyRef` / `useIsomorphicLayoutEffect` | `bind:this`, closures, class fields, `$effect` | React-only utilities (R-02) |
| 9 | four extra `hooks/*` files to copy on install         | none                                                          | folded into the two `.svelte.ts` modules |
