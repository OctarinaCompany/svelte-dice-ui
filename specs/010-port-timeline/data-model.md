# Phase 1 Data Model: Timeline

All state is client-side and reactive; nothing is persisted. Entities below live in
`src/lib/components/ui/timeline/timeline.svelte.ts` unless noted.

---

## Value types

```ts
/** Layout axis. Upstream `Orientation`. */
export const TIMELINE_ORIENTATIONS = ['vertical', 'horizontal'] as const;
export type TimelineOrientation = (typeof TIMELINE_ORIENTATIONS)[number];

/** Layout style. Upstream `Variant`. */
export const TIMELINE_VARIANTS = ['default', 'alternate'] as const;
export type TimelineVariant = (typeof TIMELINE_VARIANTS)[number];

/** An item's position relative to `activeIndex`. Upstream `Status`. */
export const TIMELINE_STATUSES = ['completed', 'active', 'pending'] as const;
export type TimelineStatus = (typeof TIMELINE_STATUSES)[number];
```

`Direction` (`'ltr' | 'rtl'`) is **not** redeclared — it is re-exported from
`$lib/components/ui/direction-provider/index.js`, keeping one definition per repo.

The `as const` tuple + indexed-access pattern follows `direction-provider`'s `DIRECTIONS` and
`stat-trend`'s `STAT_TREND_DIRECTIONS`, and gives the demo page and tests an iterable source of truth.

---

## Pure functions (no state, unit-testable without a DOM where possible)

### `getTimelineItemStatus(itemIndex: number, activeIndex?: number): TimelineStatus`

Upstream `getItemStatus`, verbatim.

| Condition                  | Result        |
| -------------------------- | ------------- |
| `activeIndex === undefined` | `'pending'`   |
| `itemIndex < activeIndex`  | `'completed'` |
| `itemIndex === activeIndex` | `'active'`    |
| otherwise                  | `'pending'`   |

No clamping — an out-of-range `activeIndex` still yields a valid status for every item (spec edge
case). `itemIndex === -1` (an id not yet registered) with `activeIndex === 0` yields `'completed'`,
which is upstream's behaviour on its own first render and is transient.

### `sortByDocumentPosition<T extends { element: Element | null }>(entries: T[]): T[]`

Upstream `getSortedEntries`, generalised over the entry shape and made non-mutating (returns a new
array; upstream sorts in place, which would mutate a `$state` array and re-trigger its own reader).
Comparator, verbatim:

- either element missing → `0`
- `a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING` → `-1`
- `& Node.DOCUMENT_POSITION_PRECEDING` → `1`
- otherwise → `0`

Exported for reuse by later order-sensitive ports (deliverable 5).

---

## Entity: `TimelineState` (root-owned, one per `<Timeline>`)

Merges upstream's `Store`/`StoreContext` **and** `TimelineContextValue`/`TimelineContext`
(research R-02).

### Constructor input — reactive values arrive as getters

```ts
export type TimelineStateProps = {
	readonly getOrientation: () => TimelineOrientation;
	readonly getVariant: () => TimelineVariant;
	readonly getDir: () => Direction;
	readonly getActiveIndex: () => number | undefined;
};
```

### Fields

| Member          | Kind                                | Source / meaning                                                                 |
| --------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| `#props`        | private                             | the getters above                                                                |
| `#items`        | `$state<TimelineItemEntry[]>([])`   | registered items, in registration order — upstream's `StoreState.items` `Map`     |
| `orientation`   | `$derived`                          | `#props.getOrientation()`                                                         |
| `variant`       | `$derived`                          | `#props.getVariant()`                                                            |
| `dir`           | `$derived`                          | `#props.getDir()` (already resolved by `useDirection` in the root)                |
| `activeIndex`   | `$derived`                          | `#props.getActiveIndex()`                                                        |
| `orderedIds`    | `$derived.by`                       | `sortByDocumentPosition(#items).map((e) => e.id)` — the live DOM order            |
| `count`         | `$derived`                          | `orderedIds.length` (used by tests and by the demo page)                          |

```ts
/** One registered item. `element` is the `<li>` (or the caller's `child` element). */
export type TimelineItemEntry = {
	readonly id: string;
	readonly element: HTMLElement;
};
```

### Methods

| Method                                              | Behaviour                                                                                                                                       |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `register(id: string, element: HTMLElement): void`   | replaces `#items` with a new array containing `{ id, element }`, dropping any prior entry with the same `id` — upstream `onItemRegister` + `Map.set` |
| `unregister(id: string): void`                       | replaces `#items` with the entries whose `id` differs — upstream `onItemUnregister` + `Map.delete`                                                |
| `getItemIndex(id: string): number`                   | `orderedIds.indexOf(id)`; `-1` when unregistered — upstream `getItemIndex`                                                                        |
| `getItemStatus(id: string): TimelineStatus`          | `getTimelineItemStatus(getItemIndex(id), activeIndex)`                                                                                            |
| `getNextItemStatus(id): TimelineStatus \| undefined` | `undefined` when the id is unknown or last; otherwise `getTimelineItemStatus(index + 1, activeIndex)` — upstream `getNextItemStatus`                |

`#items` is replaced, never mutated, so `orderedIds` invalidates exactly once per registration change
and no reader observes a half-sorted array.

### State transitions

There is no state machine. The only mutations are `register` / `unregister`, both driven by an item's
mount/unmount `$effect`; every other value is derived. Consequently:

- mounting an item shifts the derived index (and therefore status) of every later item;
- unmounting an item shifts them back and turns the new last item's connector into "last" (unmounted);
- changing `activeIndex` on the root re-derives every status and every `data-completed` with no
  registration churn.

---

## Entity: `TimelineItemState` (item-owned, one per `<TimelineItem>`)

Maps upstream `TimelineItemContextValue`.

```ts
export type TimelineItemStateProps = {
	readonly getId: () => string;
};
```

| Member             | Kind          | Source / meaning                                                                                             |
| ------------------ | ------------- | ------------------------------------------------------------------------------------------------------------ |
| `id`               | `$derived`    | `#props.getId()` — the consumer's `id` or the `$props.id()` fallback                                          |
| `index`            | `$derived`    | `#root.getItemIndex(this.id)`                                                                                 |
| `status`           | `$derived`    | `getTimelineItemStatus(this.index, #root.activeIndex)`                                                        |
| `isAlternateRight` | `$derived`    | `#root.variant === 'alternate' && this.index % 2 === 1` — upstream verbatim, including `index === -1` ⇒ `false` |
| `nextStatus`       | `$derived`    | `#root.getNextItemStatus(this.id)`; `undefined` ⇒ this is the last item                                        |
| `isLast`           | `$derived`    | `this.nextStatus === undefined`                                                                               |
| `isConnectorCompleted` | `$derived` | `nextStatus === 'completed' \|\| nextStatus === 'active'`                                                     |

`nextStatus`/`isLast`/`isConnectorCompleted` live on the item rather than in the connector so the
connector stays a pure renderer and so a `forceMount` connector and a normal one share one derivation.

The item holds a reference to its `TimelineState` (read from context at init) — not a copy of its
values — so root prop changes propagate without re-registration.

---

## Contexts

Two `Symbol`-keyed contexts, each with a throwing getter (CLAUDE.md §5, FR-017):

| Key symbol                                | Value               | Set by          | Read by                                                            |
| ----------------------------------------- | ------------------- | --------------- | ------------------------------------------------------------------ |
| `Symbol('timeline')`                      | `TimelineState`     | `Timeline` root | `TimelineItem`, `TimelineDot`, `TimelineConnector`, `TimelineContent` |
| `Symbol('timeline-item')`                 | `TimelineItemState` | `TimelineItem`  | `TimelineDot`, `TimelineConnector`, `TimelineContent`                |

```ts
export function setTimelineContext(state: TimelineState): TimelineState;
export function getTimelineContext(consumerName: string): TimelineState;
export function setTimelineItemContext(state: TimelineItemState): TimelineItemState;
export function getTimelineItemContext(consumerName: string): TimelineItemState;
```

Both getters take the consumer's part name (upstream passes `ITEM_NAME`/`DOT_NAME`/… for exactly this
reason) and throw:

- `` `<Timeline.Dot>` must be used within `<Timeline.Root>`.``
- `` `<Timeline.Dot>` must be used within `<Timeline.Item>`.``

`TimelineHeader`, `TimelineTitle`, `TimelineDescription` and `TimelineTime` read no context and
therefore never throw — upstream requires no provider for them either.

---

## Validation rules

There are none at runtime. `activeIndex` accepts any number (research R-09); `orientation`/`variant`
are compile-time unions with defaults; `dir` is resolved, never validated (the `direction-provider`
reader already treats an unrecognised DOM `dir` as absent). No prop can put the component into an
invalid state, so no guard, warning or dev-only assertion is introduced — upstream ships none either.
