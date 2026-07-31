# Phase 1 Data Model: Action Bar

The component holds no persisted data. "Entities" here are the reactive state objects and the context
graph that carry behaviour between parts. Every class lives in a `.svelte.ts` module and receives its
reactive inputs as **getter functions**, never as constructor snapshots.

## Context graph

```text
<ActionBar>                          setActionBarContext(new ActionBarRootState({...}))
│   owns: open, side, align, offsets, orientation, loop, resolved dir, escape dismisser
│
├── <ActionBarSelection>             reads: nothing (presentational)
│   └── <ActionBarSeparator>         reads: ActionBarRootState.orientation
│
├── <ActionBarSeparator>             reads: ActionBarRootState.orientation
│
├── <ActionBarGroup>                 setRovingFocusContext(new RovingFocusGroupState({...}))
│   │                                reads: ActionBarRootState.{dir, orientation}
│   └── <ActionBarItem>              reads: ActionBarRootState.{setOpen, dir, orientation, loop}
│                                           RovingFocusGroupState.{tabStopId, register, navigate, …}
│
└── <ActionBarClose>                 reads: ActionBarRootState.setOpen
```

Two `Symbol` keys, two throwing getters (Principle §5 of CLAUDE.md):

| Key symbol             | Setter                    | Getter                                | Throws when missing                                                    |
| ---------------------- | ------------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| `Symbol('action-bar')` | `setActionBarContext`     | `getActionBarContext(consumerName)`   | `` `<ActionBar.X>` must be used within `<ActionBar>`. ``                |
| `Symbol('roving-focus')` | `setRovingFocusContext` | `getRovingFocusContext(consumerName)` | `` `<ActionBar.Item>` must be used within `<ActionBar.Group>`. ``       |

`consumerName` is passed by each part (`'<ActionBar.Group>'`, `'<ActionBar.Item>'`,
`'<ActionBar.Close>'`, `'<ActionBar.Separator>'`) so the thrown message names both the offending part
and the required ancestor (FR-014).

---

## Entity: `ActionBarRootState` (`action-bar.svelte.ts`)

One instance per `<ActionBar>`. Published on context.

**Constructor props** (all reactive inputs are getters):

| Field              | Type                             | Purpose                                              |
| ------------------ | -------------------------------- | ---------------------------------------------------- |
| `getOpen`          | `() => boolean`                  | Current open state (controlled or seeded)            |
| `setOpen`          | `(open: boolean) => void`        | Writes the binding **and** calls `onOpenChange`      |
| `getDir`           | `() => Direction`                | Resolved reading direction (from `useDirection()`)   |
| `getOrientation`   | `() => ActionBarOrientation`     | Layout + keyboard axis                               |
| `getLoop`          | `() => boolean`                  | Whether arrow navigation wraps                       |

**Exposed members**:

| Member        | Kind       | Notes                                                        |
| ------------- | ---------- | ------------------------------------------------------------ |
| `open`        | `$derived` | Read by parts that need to know if the bar is up             |
| `dir`         | `$derived` | `'ltr' \| 'rtl'`                                             |
| `orientation` | `$derived` | `'horizontal' \| 'vertical'`                                 |
| `loop`        | `$derived` | `boolean`                                                    |
| `setOpen`     | method     | The only path that changes open state (FR-002)               |

**Invariants**: the class never assigns to `open` itself — only `setOpen` does, and it always notifies
`onOpenChange`. No `$effect` in this class writes state it reads.

---

## Entity: `EscapeDismissState` (`action-bar-floating.svelte.ts`, shared)

Component-agnostic. One instance per floating surface.

**Constructor props**:

| Field              | Type                                  | Purpose                                                  |
| ------------------ | ------------------------------------- | -------------------------------------------------------- |
| `getEnabled`       | `() => boolean`                       | Listener is attached only while `true` (i.e. while open)  |
| `getOwnerDocument` | `() => Document`                      | `ref?.ownerDocument ?? document` — iframe-correct         |
| `onEscapeKeyDown`  | `((event: KeyboardEvent) => void)?`   | Called first; `preventDefault()` cancels dismissal        |
| `onDismiss`        | `() => void`                          | Called unless the event was default-prevented             |

**Behaviour**: a single `$effect` that returns a teardown removing the `keydown` listener. Nothing is
stored in `$state`; the effect is pure subscription (FR-006).

---

## Entity: `RovingFocusGroupState` (`action-bar-roving-focus.svelte.ts`, shared)

Component-agnostic implementation of the WAI-ARIA Toolbar roving-tabindex pattern. One instance per
`<ActionBarGroup>`. Published on the roving-focus context.

**Constructor props**:

| Field                 | Type                              | Purpose                                                   |
| --------------------- | --------------------------------- | ---------------------------------------------------------- |
| `getDir`              | `() => Direction`                 | Drives `getDirectionAwareKey`                                |
| `getOrientation`      | `() => FloatingOrientation`       | Chooses the arrow-key axis                                   |
| `getLoop`             | `() => boolean`                   | Wrap vs. stop at the ends                                    |
| `entryFocusEventName` | `string`                          | `'actionbarFocusGroup.onEntryFocus'` for this component      |

**State**:

| Member          | Kind                               | Initial | Notes                                                                  |
| --------------- | ---------------------------------- | ------- | ---------------------------------------------------------------------- |
| `#items`        | `DomOrderedCollection<RovingFocusItemMeta>` | empty   | Composed from `speed-dial`; document-ordered, `isConnected`-filtered |
| `tabStopId`     | `$state<string \| null>`           | `null`  | Identity of the item that owns the group's tab stop                    |
| `isTabbingBackOut` | `$state<boolean>`               | `false` | Set on item `Shift+Tab`, cleared on group `focusout`                   |
| `#isClickFocus` | plain private field (non-reactive) | `false` | "This focus came from the mousedown I just saw"                        |
| `focusableCount`| `$derived`                         | `0`     | Enabled, connected items — replaces upstream's manual counter (R-07)   |
| `tabIndex`      | `$derived`                         | `0`     | `isTabbingBackOut \|\| focusableCount === 0 ? -1 : 0`                  |

`RovingFocusItemMeta = { getDisabled: () => boolean }` — `disabled` is read **at event time**, so an
item that becomes disabled after registration is skipped without re-registering.

**Methods**:

| Method                                       | Behaviour                                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `register(id, element, meta)` / `unregister(id)` | Delegates to the collection; called from each item's `$effect` with teardown                                       |
| `isTabStop(id)`                              | `tabStopId === id`                                                                                                     |
| `onItemFocus(id)`                            | `tabStopId = id`                                                                                                       |
| `onItemShiftTab()`                           | `isTabbingBackOut = true`                                                                                              |
| `onGroupFocusIn(event)`                      | Only when `target === currentTarget`, focus was not a click, and not tabbing back out: dispatch the cancelable entry-focus event, then `focusFirst([current, ...enabled])`. Always clears `#isClickFocus` |
| `onGroupFocusOut()`                          | `isTabbingBackOut = false`                                                                                             |
| `onGroupMouseDown()`                         | `#isClickFocus = true`                                                                                                 |
| `navigate(intent, current)`                  | Builds the enabled-candidate list, applies the reverse/slice/wrap rules of R-10, then `queueMicrotask(() => focusFirst(candidates))` |

**State transitions** (group tab-stop lifecycle):

```text
mounted ─────────────────► tabStopId = null, tabIndex = 0 (if ≥1 enabled item)
   │ Tab into group        (focusin, keyboard) ──► entry-focus event ──► focus first enabled item
   │                                                                     └─► item focus ──► tabStopId = itemId
   │ Arrow / Home / End    ──► navigate() ──► focus another item ──► tabStopId = that item
   │ Shift+Tab on an item  ──► isTabbingBackOut = true ──► group tabIndex = -1 (Tab now skips it)
   │ focusout of group     ──► isTabbingBackOut = false ──► group tabIndex = 0 again
   └ last enabled item removed ──► focusableCount = 0 ──► tabIndex = -1
```

---

## Value objects and constants

| Name                                              | Module                          | Value                                                        |
| ------------------------------------------------- | ------------------------------- | ------------------------------------------------------------ |
| `FLOATING_SIDES`                                  | `action-bar-floating.svelte.ts` | `['top', 'bottom']`                                          |
| `FLOATING_ALIGNMENTS`                             | `action-bar-floating.svelte.ts` | `['start', 'center', 'end']`                                  |
| `FLOATING_ORIENTATIONS`                           | `action-bar-floating.svelte.ts` | `['horizontal', 'vertical']`                                  |
| `DEFAULT_SIDE_OFFSET` / `DEFAULT_ALIGN_OFFSET`    | `action-bar-floating.svelte.ts` | `16` / `0`                                                    |
| `ACTION_BAR_ITEM_SELECT`                          | `action-bar.svelte.ts`          | `'actionbar.itemSelect'`                                      |
| `ACTION_BAR_ENTRY_FOCUS`                          | `action-bar.svelte.ts`          | `'actionbarFocusGroup.onEntryFocus'`                          |
| `ACTION_BAR_EVENT_OPTIONS`                        | `action-bar.svelte.ts`          | `{ bubbles: false, cancelable: true }`                        |
| `ACTION_BAR_ITEM_SELECT_OPTIONS`                  | `action-bar.svelte.ts`          | `{ bubbles: true, cancelable: true }`                         |

Type aliases re-exported under Action Bar names for upstream parity:
`ActionBarSide = FloatingSide`, `ActionBarAlign = FloatingAlign`,
`ActionBarOrientation = FloatingOrientation`, `Direction` from `direction-provider`.

## Pure functions

| Function                                                     | Module                              | Contract                                                                            |
| ------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------ |
| `getViewportEdgeStyle({ side, sideOffset, align, alignOffset })` | `action-bar-floating.svelte.ts` | Returns CSS text: `<side>:<sideOffset>px` + `left:50%;translate:-50% 0` (center) / `left:<alignOffset>px` (start) / `right:<alignOffset>px` (end) |
| `focusFirst(candidates, preventScroll?)`                     | `action-bar-roving-focus.svelte.ts` | Focuses the first candidate that actually takes focus; no-op if the active element is already a candidate |
| `wrapArray(array, startIndex)`                               | `action-bar-roving-focus.svelte.ts` | Rotates the array so `startIndex` comes first                                        |
| `getDirectionAwareKey(key, dir)`                             | `action-bar-roving-focus.svelte.ts` | Swaps `ArrowLeft`↔`ArrowRight` when `dir === 'rtl'`, otherwise identity              |
| `getFocusIntent(key, orientation, dir)`                      | `action-bar-roving-focus.svelte.ts` | `'first' \| 'last' \| 'prev' \| 'next' \| undefined`                                 |

All five are exported from the barrel and unit-tested directly, so `selection-toolbar` inherits proven
helpers.

## Validation rules

- `open` is the only value-bearing prop; there is nothing to validate beyond the union types, which
  TypeScript enforces at compile time and the `*_SIDES` / `*_ALIGNMENTS` constants enumerate at runtime
  for the demo page and tests.
- `sideOffset` / `alignOffset` are unvalidated numbers, exactly as upstream (negative values are legal
  and pull the bar off-screen — the consumer's choice).
- A part rendered outside its provider throws immediately during initialisation (FR-014); it never
  renders a degraded fallback.
