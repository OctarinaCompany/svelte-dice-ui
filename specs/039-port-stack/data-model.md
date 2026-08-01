# Phase 1 Data Model: Stack

**Feature**: `039-port-stack` | **Date**: 2026-08-01

No persistence, no network, no serialisation. The "data model" is the reactive state owned by
`StackState` in `src/lib/components/ui/stack/stack.svelte.ts`, the per-item entity it tracks, and the
derived values every item reads back out.

---

## Entity: `StackItemEntry`

One registered `<Stack.Item>`. Created on mount, removed on unmount.

| Field     | Type          | Source                                               | Notes                                                       |
| --------- | ------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| `id`      | `string`      | `$props.id()` in `stack-item.svelte`                 | Stable for the component instance's lifetime; never a prop.  |
| `element` | `HTMLElement` | `bind:this` on the wrapper `<div>`                   | Used for document-order sorting and for measurement.         |
| `index`   | `number`      | derived — `DomOrderedCollection.indexById.get(id)`   | 0 = front. Recomputed whenever the registry changes.         |
| `size`    | `number`      | measured once on mount, stored in `StackState.#sizes` | Natural (unscaled) block size in px. `0` until measured.     |

**Lifecycle**

```text
mount ─▶ register(id, element)      (DomOrderedCollection, in $effect)
      ─▶ measure(id, element)       (rect.height / (1 - index * scale), untracked write)
      ─▶ …renders, index/derived values track the registry…
unmount ─▶ unregister(id) + releaseSize(id)   (same $effect teardown)
```

**Validation rules**

- `index` is always `0 … size - 1`; an element detached without unregistering is filtered out by
  `DomOrderedCollection.ordered` (`element.isConnected`).
- `size` is clamped to `>= 0`; a `0` measurement (jsdom, `display:none` ancestor) is stored as `0` and
  simply contributes nothing to the expanded offsets.
- Registration is idempotent — re-registering the same `id` replaces the entry.

---

## Entity: `StackState`

One instance per `<Stack.Root>`, published on context under a module-private `Symbol`.

### Inputs (getter functions supplied by the root — never snapshots)

| Getter                  | Type                  | Default from root |
| ----------------------- | --------------------- | ----------------- |
| `getSide`               | `() => StackSide`     | `'bottom'`        |
| `getItemCount`          | `() => number`        | `3`               |
| `getExpandedItemCount`  | `() => number \| undefined` | `undefined` |
| `getGap`                | `() => number`        | `8`               |
| `getScale`              | `() => number`        | `0.05`            |
| `getOffset`             | `() => number`        | `10`              |
| `getExpandOnHover`      | `() => boolean`       | `false`           |

### Owned reactive state

| Field           | Rune                          | Meaning                                                              |
| --------------- | ----------------------------- | -------------------------------------------------------------------- |
| `expanded`      | `$state(false)`               | Upstream `isExpanded`. Drives `data-state` / `data-expanded`.         |
| `interacting`   | `$state(false)`               | Upstream `isInteracting`. A pointer is held down inside the stack.    |
| `#items`        | `DomOrderedCollection<void>`  | The document-ordered registry (research R-02).                        |
| `#sizes`        | `SvelteMap<string, number>`   | Natural block size per item id (research R-05).                       |

### Derived values

| Name           | Expression                                                | Upstream counterpart              |
| -------------- | --------------------------------------------------------- | --------------------------------- |
| `itemsCount`   | `this.#items.size`                                        | `childrenCount`                   |
| `visibleCount` | `getExpandedItemCount() ?? itemsCount`                    | `effectiveExpandedItemCount`      |
| `dataState`    | `expanded ? 'expanded' : 'collapsed'`                     | `getDataState(isExpanded)`        |
| `styleProps`   | `--gap: {gap}px; --offset: {offset}px; --scale: {scale};` | root inline `style`               |

### Per-item computations (pure methods taking `index`)

| Method             | Formula                                                          | Upstream line       |
| ------------------ | ---------------------------------------------------------------- | ------------------- |
| `isFront(i)`       | `i === 0`                                                        | `isFront`           |
| `isVisible(i)`     | `expanded ? i < visibleCount : i < getItemCount()`               | `isVisible`         |
| `sizeBefore(i)`    | `Σ size(j) for every registered j with index j < i`              | `itemsSizeBefore`   |
| `itemScale(i)`     | `expanded ? 1 : 1 - i * scale`                                   | `itemScale`         |
| `translate(i)`     | `expanded ? i * gap + sizeBefore(i) : i * offset`                | `translateValue`    |
| `zIndex(i)`        | `itemsCount - i`                                                 | `zIndex`            |
| `opacity(i)`       | `!isVisible(i) ? 0 : expanded ? 1 : 1 - i * 0.15`                | `opacity`           |

### Commands (state transitions)

| Command             | Guard                                   | Effect                    |
| ------------------- | --------------------------------------- | ------------------------- |
| `onPointerEnter()`  | `getExpandOnHover()`                    | `expanded = true`         |
| `onPointerMove()`   | `getExpandOnHover()`                    | `expanded = true`         |
| `onPointerLeave()`  | `getExpandOnHover() && !interacting`    | `expanded = false`        |
| `onPressStart()`    | —                                       | `interacting = true`      |
| `onPressEnd()`      | —                                       | `interacting = false`     |

All five are called **after** the caller's own handler and only when `event.defaultPrevented` is
false (FR-013 / research R-07). `onPressEnd()` is additionally invoked from the document-level
`pointerup`/`pointercancel` listener the root installs while `interacting` is true (research R-06).

### State machine

```text
                 pointerenter / pointermove  (expandOnHover)
   ┌───────────┐ ─────────────────────────────────────────▶ ┌──────────┐
   │ collapsed │                                             │ expanded │
   └───────────┘ ◀───────────────────────────────────────── └──────────┘
                 pointerleave  (expandOnHover && !interacting)

   pointerdown anywhere in the root  ─▶ interacting = true   (defers the collapse)
   pointerup / pointercancel, on the root OR on document ─▶ interacting = false
   expandOnHover === false ─▶ no transition ever fires; state stays "collapsed"
```

---

## Context contract

| Item              | Value                                                                    |
| ----------------- | ------------------------------------------------------------------------ |
| Key               | `const STACK_CONTEXT_KEY = Symbol('stack')` — module-private              |
| Setter            | `setStackContext(state: StackState): StackState`                          |
| Getter            | `getStackContext(): StackState`                                           |
| Error when absent | ``throw new Error('`<Stack.Item>` must be used within `<Stack.Root>`.')`` |

Upstream's message is `` `StackItemWrapper` must be used within `Stack` ``; the port names the public
parts instead, because `StackItemWrapper` is not a public export here (research R-01). The message is
asserted by a test (Principle III).
