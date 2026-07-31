# Phase 1 Data Model — Selection Toolbar

Reactive entities owned by the component. Everything lives in
`src/lib/components/ui/selection-toolbar/selection-toolbar.svelte.ts` unless stated otherwise.

## 1. `SelectionRect`

Plain value type — the viewport-space box of the current selection, copied out of
`Range.getBoundingClientRect()` so later reads cannot mutate it (upstream 50-55).

| Field    | Type     | Notes                                     |
| -------- | -------- | ----------------------------------------- |
| `top`    | `number` | viewport coordinates (`strategy: "fixed"`) |
| `left`   | `number` |                                           |
| `width`  | `number` | becomes `--selection-toolbar-anchor-width` |
| `height` | `number` | becomes `--selection-toolbar-anchor-height`|

## 2. `SelectionToolbarRootState`

One instance per `<SelectionToolbar>`, published on context. Replaces upstream's external store
(57-207) and its four effects (457-521). Constructed during root initialisation because it owns an
`$effect`.

### Constructor props (`SelectionToolbarRootStateProps`) — all getters or writers, never snapshots

| Prop                  | Type                        | Purpose                                                        |
| --------------------- | --------------------------- | -------------------------------------------------------------- |
| `getOpen`             | `() => boolean`             | reads the caller's `open` binding                              |
| `setOpen`             | `(open: boolean) => void`   | writes the binding **and** calls `onOpenChange` — single path   |
| `getContainer`        | `() => HTMLElement \| null` | resolved `container` prop                                      |
| `isContainerScoped`   | `() => boolean`             | `container !== undefined` — upstream's `containerProp !== undefined` gate |
| `onSelectionChange`   | `(text: string) => void`    | fires on every text transition, including `""`                 |

### Reactive fields

| Field           | Rune                | Initial | Meaning                                            |
| --------------- | ------------------- | ------- | -------------------------------------------------- |
| `selectedText`  | `$state<string>`    | `""`    | trimmed `selection.toString()`                     |
| `selectionRect` | `$state<SelectionRect \| null>` | `null` | anchor box; `null` while closed          |
| `open`          | `$derived`          | —       | `getOpen()` — the caller's binding is the source of truth |
| `anchor`        | `$derived`          | —       | `Measurable` built from `selectionRect`, or `null` |

`anchor` is the virtual element handed to `Popover.Content`'s `customAnchor`:
`{ getBoundingClientRect: () => new DOMRect(left, top, width, height) }` (upstream 226-241).

### State transitions

| Method                | Effect                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| `updateSelection()`   | reads `window.getSelection()`; empty/collapsed → `closeToolbar()`; scoped and outside `container` → `closeToolbar()`; container scoped but unresolved → **no-op**; otherwise writes `selectedText`, `selectionRect` and `setOpen(true)` in one batch, only when something actually changed (upstream 390-445) |
| `closeToolbar()`      | when any of `open`/`selectedText`/`selectionRect` is set: clears all three and `setOpen(false)` (379-388)     |
| `clearSelection()`    | `selection.removeAllRanges()` then `closeToolbar()` (490-496) — the `Escape` and outside-pointer path         |
| `scheduleUpdate()`    | one pending `requestAnimationFrame`; re-reads only while open (447-455)                                       |

Callback ordering is upstream's: `onSelectionChange` fires on a text change, `onOpenChange` on an open
change, both from the same batched transition, never twice for one event.

### Lifecycle (`$effect` inside the constructor)

Attaches, on every change of the resolved container:

| Listener                              | Target                | Options            |
| ------------------------------------- | --------------------- | ------------------ |
| `mouseup` → rAF → `updateSelection()` | `container ?? document` | —                |
| `selectionchange` → close when empty  | `document`            | —                  |
| `scroll` → `scheduleUpdate()`         | `window`              | `{ passive: true }` |
| `resize` → `scheduleUpdate()`         | `window`              | `{ passive: true }` |

Teardown removes all four and cancels any pending frame (upstream 478-487). Nothing runs on the server:
`$effect` is browser-only.

## 3. Context

| Symbol                                  | Value                       |
| --------------------------------------- | --------------------------- |
| `Symbol('selection-toolbar')` (private) | `SelectionToolbarRootState` |

`setSelectionToolbarContext(state)` is called by the root; `getSelectionToolbarContext(consumerName)`
throws ``` `${consumerName}` must be used within `<SelectionToolbar>`. ``` when the key is absent
(FR-016). Consumers: `<SelectionToolbar.Item>` (needs `selectedText`), `<SelectionToolbar.Separator>`
(guard only, D-7), and any application component wanting upstream's `useSelectionToolbar` data (D-6).

## 4. Item-local state (`selection-toolbar-item.svelte`)

| Name          | Kind                 | Initial   | Purpose                                                     |
| ------------- | -------------------- | --------- | ----------------------------------------------------------- |
| `pointerType` | plain `let` (non-reactive) | `'touch'` | last observed pointer type; decides `pointerup` vs `click` activation and whether `pointerdown` is default-prevented (upstream 603-604) |

Non-reactive on purpose — it is a mutable box read inside handlers, never rendered (CLAUDE.md §10:
`useRef` for a mutable box → a plain `let`).

## 5. Constants

| Name                                    | Value                                     | Upstream           |
| --------------------------------------- | ----------------------------------------- | ------------------ |
| `SELECTION_TOOLBAR_SIDES`               | `['top', 'right', 'bottom', 'left']`      | `SIDE_OPTIONS` (28)  |
| `SELECTION_TOOLBAR_ALIGNMENTS`          | `['start', 'center', 'end']`              | `ALIGN_OPTIONS` (29) |
| `SELECTION_TOOLBAR_ITEM_SELECT`         | `'selectiontoolbar.select'`               | 612                |
| `SELECTION_TOOLBAR_ITEM_SELECT_OPTIONS` | `{ bubbles: true, cancelable: true }`     | 613-615            |
| `DEFAULT_SIDE_OFFSET` / `DEFAULT_ALIGN_OFFSET` | `8` / `0`                          | 127-129            |

## 6. Validation rules

- `selectedText` is always trimmed; an all-whitespace selection counts as empty and closes the toolbar.
- `selectionRect` is `null` if and only if the toolbar is closed by the tracker (a controlled
  `open={true}` with no selection therefore renders no surface — there is no anchor, matching upstream's
  `open && !!virtualElement` guard at 365).
- `collisionBoundary` accepts one element, an array, or `null` entries; `null`s are filtered before
  reaching the layer (upstream `isNotNull`, 46-48).
- `collisionPadding` accepts a number or a partial per-side record; both pass through unchanged.
