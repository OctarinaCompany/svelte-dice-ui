# Phase 1 Data Model: Speed Dial

**Feature**: `016-port-speed-dial` | **Date**: 2026-07-30

Everything here lives in `src/lib/components/ui/speed-dial/speed-dial.svelte.ts` unless a different
file is named. Line references point at
`.reference/diceui/docs/registry/bases/radix/ui/speed-dial.tsx` at the pinned commit.

## 1. Constants

| Export                          | Value   | Upstream                                        |
| ------------------------------- | ------- | ----------------------------------------------- |
| `DEFAULT_GAP`                   | `8`     | `DEFAULT_GAP` (24)                              |
| `DEFAULT_OFFSET`                | `8`     | `DEFAULT_OFFSET` (25)                           |
| `DEFAULT_ITEM_DELAY`            | `50`    | `DEFAULT_ITEM_DELAY` (26)                       |
| `DEFAULT_HOVER_CLOSE_DELAY`     | `100`   | `DEFAULT_HOVER_CLOSE_DELAY` (27)                |
| `DEFAULT_ANIMATION_DURATION`    | `200`   | `DEFAULT_ANIMATION_DURATION` (28)               |
| `DEFAULT_HOVER_OPEN_DELAY`      | `250`   | `delay = 250` default (158)                     |
| `SPEED_DIAL_SIDES`              | `['top','right','bottom','left'] as const` | `Side` (30)  |
| `SPEED_DIAL_ACTIVATION_MODES`   | `['click','hover'] as const`               | `ActivationMode` (31) |
| `ACTION_SELECT_EVENT`           | `'speedDial.actionSelect'`                 | `ACTION_SELECT` (20)  |
| `INTERACT_OUTSIDE_EVENT`        | `'speedDial.interactOutside'`              | `INTERACT_OUTSIDE` (21) |

Derived types: `SpeedDialSide`, `SpeedDialActivationMode`.

Pure helpers (no runes, exported):

```ts
getDataState(open: boolean): 'open' | 'closed'            // (48-50)
getTransformOrigin(side: SpeedDialSide): string           // (52-63) top→'bottom center', bottom→'top center', left→'right center', right→'left center'
getOrientation(side: SpeedDialSide): 'horizontal' | 'vertical'   // (557-558) top|bottom → vertical
getContentPosition(side, offset): string                  // R-04 — the four CSS declaration pairs
getItemDelay(index, count, animating): number             // (822-824)
```

`getItemDelay` is upstream's expression, extracted so it is unit-testable:

```
animating ? index * DEFAULT_ITEM_DELAY : (count - index - 1) * DEFAULT_ITEM_DELAY
```

## 2. `DomOrderedCollection<TMeta>` — `speed-dial-collection.svelte.ts`

The reusable export (research R-16). Replaces upstream `getNodes()` (213-229).

| Member                                  | Kind        | Notes                                                                 |
| --------------------------------------- | ----------- | --------------------------------------------------------------------- |
| `#entries: SvelteMap<string, Entry>`    | reactive    | `Entry = { element: HTMLElement; meta: TMeta }`                        |
| `register(id, element, meta): void`     | method      | idempotent; called from an item's `$effect`                            |
| `unregister(id): void`                  | method      | called from that effect's teardown                                     |
| `ordered: readonly Entry[]`             | `$derived.by` | sorted by `compareDocumentPosition`; detached elements filtered out  |
| `indexById: ReadonlyMap<string, number>`| `$derived.by` | built once from `ordered`; each consumer does a single `get` (R-01)  |
| `size: number`                          | `$derived`  | `ordered.length`                                                       |
| `elements(): HTMLElement[]`             | method      | non-reactive snapshot for event handlers (R-06)                        |

Sort comparator, verbatim from upstream (216-228):

```
position = a.compareDocumentPosition(b)
DOCUMENT_POSITION_FOLLOWING → -1 ; DOCUMENT_POSITION_PRECEDING → 1 ; else 0
```

**Complexity.** One sort per structural change, shared by every reader → O(n log n) total, not
O(n² log n). This is the property SC-004 and upstream's `O(n²)` regression test measure.

## 3. `SpeedDialRootState` — context `Symbol('speed-dial')`, **required**

Replaces `StoreContext` + `SpeedDialContextValue` (65-137, 263-288).

### Inputs (getter functions, per `CLAUDE.md` §4)

| Getter               | Type                          |
| -------------------- | ----------------------------- |
| `getOpen`            | `() => boolean`               |
| `setOpen`            | `(open: boolean) => void`     |
| `getSide`            | `() => SpeedDialSide`         |
| `getActivationMode`  | `() => SpeedDialActivationMode` |
| `getDelay`           | `() => number`                |
| `getDisabled`        | `() => boolean`               |
| `contentId`          | `string` (`$props.id()` in the root) |

### Fields

| Field                | Kind                             | Purpose                                            |
| -------------------- | -------------------------------- | -------------------------------------------------- |
| `open`               | `$derived` → `getOpen()`         | single source of truth                             |
| `side`, `activationMode`, `delay`, `disabled` | `$derived`      | pass-through                                       |
| `orientation`        | `$derived`                       | `getOrientation(side)`                             |
| `nodes`              | `DomOrderedCollection<{ getDisabled: () => boolean }>` | trigger + actions (Tab exit)  |
| `items`              | `DomOrderedCollection`           | items (stagger index)                              |
| `triggerElement`     | `$state<HTMLElement \| null>`    | for `Escape` focus restore (R-07)                  |
| `rootElement`        | `$state<HTMLElement \| null>`    | `contains()` check in outside dismissal            |
| `#pointerInsideTree` | plain field (**not** `$state`)   | nothing renders from it (247-261, 705-738)         |
| `#hoverCloseTimer`   | plain field                      | shared by trigger and content (`hoverCloseTimerRef`) |

### Methods

| Method                              | Behaviour                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| `setOpen(next)`                     | short-circuits on `Object.is` equality (194), then assigns + `onOpenChange` (R-08) |
| `toggle()`                          | `setOpen(!open)`                                                                 |
| `focusTrigger()`                    | `triggerElement?.focus()` — `Escape` restore (R-07)                              |
| `enabledNodeElements()`             | `nodes.elements()` filtered by `!meta.getDisabled()` — evaluated at keydown time  |
| `markPointerInsideTree(target)`     | capture handler: `nodes.elements().some(el => el.contains(target))`               |
| `consumePointerInsideTree()`        | reads then resets the flag (mirrors 738)                                          |
| `scheduleHoverClose(ms)` / `cancelHoverClose()` | owns `#hoverCloseTimer` for both trigger and content              |
| `destroy()`                         | clears the hover-close timer; called from the root's `$effect` teardown           |

## 4. `SpeedDialContentState` — context `Symbol('speed-dial-content')`, **optional**

Replaces `SpeedDialItemImplContext` (454-487) and `renderState` (571-622). Optional by design
(research R-10): an `Item` outside a `Content` must still render.

| Member                | Kind                       | Notes                                                            |
| --------------------- | -------------------------- | ----------------------------------------------------------------- |
| `animating`           | `$state(false)`            | drives `data-state` on content and items                         |
| `exiting`             | `$state(false)`            | keeps the content mounted through the exit stagger               |
| `#wasOpen`            | plain field                | suppresses a phantom exit on the first closed render (R-03)      |
| `mounted`             | `$derived`                 | `forceMount \|\| open \|\| exiting`                              |
| `itemCount`           | `$derived`                 | `root.items.size`                                                |
| `delayFor(id)`        | method                     | `getItemDelay(root.items.indexById.get(id) ?? 0, itemCount, animating)` |
| `exitDuration`        | `$derived`                 | `(itemCount - 1) * 50 + 200` (605-608, with the registry count)  |
| `open`                | `$derived`                 | `root.open` — items read `data-state` from `animating`, not this |

### Lifecycle (one `$effect` in `speed-dial-content.svelte`)

```
open === true                         open === false
  cancel unmount timer                  animating = false
  #wasOpen = true                       if (forceMount || !#wasOpen) return
  raf → animating = true                exiting = true
  teardown: cancelAnimationFrame        timer(exitDuration) → exiting = false
                                        teardown: clearTimeout
```

Both branches return a teardown, per `CLAUDE.md` §4. Two further effects on the content:

- `open`-gated `keydown` on `ownerDocument` → `Escape` (+ focus restore) and `Tab`/`Shift+Tab` exit.
- `open`-gated outside-dismissal, registered after `setTimeout(…, 0)` (R-05), tearing down the
  `pointerdown` listener *and* any pending one-shot `click` listener.

## 5. `SpeedDialItemState` — context `Symbol('speed-dial-item')`, **required**

Replaces `SpeedDialItemContextValue` (876-890). Two ids only, both from `$props.id()`:

| Field      | Consumed by                                       |
| ---------- | ------------------------------------------------- |
| `actionId` | `Action`'s `id` (unless the caller supplies one)   |
| `labelId`  | `Label`'s `id` and `Action`'s `aria-labelledby`    |

This is the FR-012 association: the label is programmatically tied to its sibling action whether or
not it is visually hidden.

## 6. Style variants (`tv()`, exported)

### `speedDialContentVariants` ← `cva` (489-504)

```
base: 'absolute z-50 flex gap-[var(--speed-dial-gap)] data-[state=closed]:pointer-events-none'
side: top → 'flex-col-reverse items-end'
      bottom → 'flex-col items-end'
      left → 'flex-row-reverse items-center'
      right → 'flex-row items-center'
defaultVariants: { side: 'top' }
```

### `speedDialItemVariants` ← `cva` (841-874)

```
base: 'flex items-center gap-2 transition-all
       [transition-delay:var(--speed-dial-delay)]
       [transition-duration:var(--speed-dial-animation-duration)]
       data-[state=open]:translate-x-0 data-[state=open]:translate-y-0
       data-[state=closed]:opacity-0 data-[state=open]:opacity-100'
side: top → 'justify-end' | bottom → 'justify-end'
      left → 'flex-row-reverse justify-start' | right → 'justify-start'
compound: top → 'data-[state=closed]:translate-y-2'
          bottom → 'data-[state=closed]:-translate-y-2'
          left → 'data-[state=closed]:translate-x-2'
          right → 'data-[state=closed]:-translate-x-2'
```

`z-50` is retained deliberately — see research R-12 for the justification and the in-file comment.

## 7. CSS custom properties (the MDX contract, mdx:225-275)

| Variable                          | Set on    | Value                                    |
| --------------------------------- | --------- | ---------------------------------------- |
| `--speed-dial-gap`                | content   | `{gap}px` (default `8`)                  |
| `--speed-dial-offset`             | content   | `{offset}px` (default `8`)               |
| `--speed-dial-transform-origin`   | content   | `getTransformOrigin(side)`               |
| `--speed-dial-animation-duration` | item      | `200ms`                                  |
| `--speed-dial-delay`              | item      | `{delayFor(id)}ms`                       |

The caller's own `style` is merged **after** these, exactly as upstream does (784-793, 908-915), so a
consumer can override any of them.

## 8. Rendered tree, roles and data attributes

```
div[data-slot=speed-dial][data-state][data-disabled]        role: none      onpointerdowncapture
├── button[data-slot=speed-dial-trigger][data-state]        role=button     aria-haspopup=menu
│                                                                           aria-expanded aria-controls=<contentId>
└── div#<contentId>[data-slot=speed-dial-content]           role=menu       aria-orientation
    [data-state][data-orientation][data-side]                               style: --speed-dial-*, position
    └── div[data-slot=speed-dial-item][data-state][data-side]  role=none    style: --speed-dial-delay/-duration
        ├── div[data-slot=speed-dial-label]#<labelId>       (no role)
        └── button[data-slot=speed-dial-action]#<actionId>  role=menuitem   aria-labelledby=<labelId>
```

`data-state` is `'open' | 'closed'` on root, trigger, content and item. On the **root and trigger**
it tracks `open`; on the **content and item** it tracks `animating`, so the CSS transition has a
frame to start from (807, 830). `data-disabled` on the root is written `disabled ? '' : undefined`
(Principle VIII) — note this is a deliberate fix of upstream, which writes `data-disabled={false}`
and therefore emits the attribute permanently (298).

## 9. State transitions

| From    | Event                                                    | To      | Side effects                                  |
| ------- | -------------------------------------------------------- | ------- | --------------------------------------------- |
| closed  | trigger `click` (any mode, unless disabled)              | open    | cancel both hover timers; `onOpenChange(true)` |
| closed  | trigger `mouseenter`, mode `hover`, after `delay` ms     | open    | cancel hover-close timer                       |
| open    | trigger `click`                                          | closed  | cancel both hover timers                       |
| open    | trigger `mouseleave`, mode `hover`, after 100 ms         | closed  | cancelled by content `mouseenter`              |
| open    | content `mouseleave`, mode `hover`, after 100 ms         | closed  |                                               |
| open    | `Escape` (not prevented by `onEscapeKeyDown`)            | closed  | focus returns to the trigger (R-07)            |
| open    | `Tab` on last enabled node                               | closed  | focus proceeds natively                        |
| open    | `Shift+Tab` on first enabled node (the trigger)          | closed  | focus proceeds natively                        |
| open    | `pointerdown` outside a registered node                  | closed  | `onInteractOutside` first **iff** outside the root; touch defers to `click` (R-05) |
| open    | action `click` (not prevented by `onSelect`)             | closed  | `onSelect` fires before the close              |
| open    | action `click`, `onSelect` calls `preventDefault()`      | open    | dial stays open                                |
| any     | `disabled` on the root                                   | —       | trigger is `disabled`; no transition possible  |

## 10. Edge cases (spec § Edge Cases) and where they are handled

| Edge case                                   | Handling                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| Zero items                                  | `itemCount === 0` → `exitDuration = -50 + 200 = 150` ms; content still renders `role="menu"`. Guarded with `Math.max(itemCount - 1, 0)` so the timeout is never negative. |
| Rapid toggle                                | `setOpen` short-circuits on equality; every listener/timer is owned by an `$effect` teardown, so three clicks produce exactly three `onOpenChange` calls (upstream test:191-210). |
| `onSelect` prevents default                 | §9 row 11.                                                                |
| Disabled action                             | Excluded from `enabledNodeElements()`; the native `disabled` button emits no `click`, so `onSelect` never fires. |
| Dozens of actions                           | R-01/§2 complexity; SC-004.                                               |
| RTL                                         | No direction code at all — `side` is absolute (FR-017). `flex-row-reverse` is a *visual* order, unaffected by `dir`; DOM/tab order is unchanged. |
| Touch dismissal                             | R-05 step 3.                                                              |
