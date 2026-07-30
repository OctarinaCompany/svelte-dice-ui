# Contract: `timeline` public API

The externally observable surface of the `timeline` registry item: what the barrel exports, what each
part renders, which attributes consumers may select on, which CSS variables they may override, which
errors are thrown, and the test matrix that pins all of it. Prop tables live in
[`../plan.md#public-api`](../plan.md#public-api); this file is the attribute/DOM/error contract.

Consumer entry points:

```ts
import * as Timeline from '$lib/components/ui/timeline/index.js';
// Timeline.Root, Timeline.Item, Timeline.Dot, Timeline.Connector, Timeline.Content,
// Timeline.Header, Timeline.Title, Timeline.Description, Timeline.Time

import { Timeline, TimelineItem, TimelineDot } from '$lib/components/ui/timeline/index.js';
```

## 1. Barrel exports (`index.ts`)

| Kind        | Names                                                                                                                                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Components  | `Root`, `Item`, `Dot`, `Connector`, `Content`, `Header`, `Title`, `Description`, `Time`                                                                                                                                                                             |
| Aliases     | `Timeline`, `TimelineItem`, `TimelineDot`, `TimelineConnector`, `TimelineContent`, `TimelineHeader`, `TimelineTitle`, `TimelineDescription`, `TimelineTime`                                                                                                          |
| Prop types  | `TimelineRootProps` (+ `TimelineProps` alias), `TimelineItemProps`, `TimelineDotProps`, `TimelineConnectorProps`, `TimelineContentProps`, `TimelineHeaderProps`, `TimelineTitleProps`, `TimelineDescriptionProps`, `TimelineTimeProps`                                |
| Child types | `TimelineChildProps`, `TimelineItemChildProps`, `TimelineDotChildProps`, `TimelineConnectorChildProps`, `TimelineContentChildProps`, `TimelineHeaderChildProps`, `TimelineTitleChildProps`, `TimelineDescriptionChildProps`, `TimelineTimeChildProps`                 |
| Variants    | `timelineVariants`, `timelineItemVariants`, `timelineContentVariants`, `timelineDotVariants`, `timelineConnectorVariants`                                                                                                                                            |
| State       | `TimelineState`, `TimelineItemState`, `setTimelineContext`, `getTimelineContext`, `setTimelineItemContext`, `getTimelineItemContext`, `getTimelineItemStatus`, `sortByDocumentPosition`                                                                               |
| Value types | `TimelineOrientation`, `TimelineVariant`, `TimelineStatus`, `TimelineItemEntry`, `TimelineStateProps`, `TimelineItemStateProps`, `TIMELINE_ORIENTATIONS`, `TIMELINE_VARIANTS`, `TIMELINE_STATUSES`                                                                    |

The barrel must not re-export `Direction` (that belongs to `direction-provider`) and must not export
anything from `timeline.test.svelte`.

## 2. Rendered DOM contract

| Part          | Element  | Always-present attributes                                                          | Conditional attributes                                                     |
| ------------- | -------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `Root`        | `<ol>`   | `role="list"`, `aria-orientation`, `data-slot="timeline"`, `data-orientation`, `data-variant`, `dir` | —                                                                          |
| `Item`        | `<li>`   | `role="listitem"`, `data-slot="timeline-item"`, `data-status`, `data-orientation`, `id`, `dir` | `aria-current="step"` iff `status === 'active'`; `data-alternate-right=""` iff on the trailing side |
| `Dot`         | `<div>`  | `data-slot="timeline-dot"`, `data-status`, `data-orientation`                       | —                                                                          |
| `Connector`   | `<div>`  | `aria-hidden="true"`, `data-slot="timeline-connector"`, `data-status`, `data-orientation` | `data-completed=""` iff the next item is `completed` or `active`; **the element is absent entirely** when the owning item is last and `forceMount` is falsy |
| `Content`     | `<div>`  | `data-slot="timeline-content"`, `data-status`                                       | —                                                                          |
| `Header`      | `<div>`  | `data-slot="timeline-header"`                                                       | —                                                                          |
| `Title`       | `<div>`  | `data-slot="timeline-title"`                                                        | —                                                                          |
| `Description` | `<div>`  | `data-slot="timeline-description"`                                                  | —                                                                          |
| `Time`        | `<time>` | `data-slot="timeline-time"`                                                         | `datetime` iff `dateTime` (or native `datetime`) was supplied              |

Rules that hold for every part:

- Boolean data attributes are written `cond ? '' : undefined` — absent, never `="false"`.
- `...restProps` is spread **before** the computed `class`, so the caller's `class` (merged last
  through `cn()`) always wins on styling while any other attribute the caller passes wins over the
  component's default (matching upstream's `{...partProps} className={cn(...)}` ordering). The item's
  `dir` and `id` are emitted before the spread, so a caller may override them — upstream parity.
- The `child` snippet receives exactly the same merged object the default element would have been
  spread with. In `child` mode `ref` stays `null` and `children` is not rendered.

## 3. CSS variables

Declared on the root via its base class
(`[--timeline-connector-thickness:0.125rem] [--timeline-dot-size:0.875rem]`):

| Variable                        | Default              | Consumed by                                       |
| ------------------------------- | -------------------- | ------------------------------------------------- |
| `--timeline-dot-size`           | `0.875rem` (14 px)   | dot `size-*`; connector/dot offset `calc()`        |
| `--timeline-connector-thickness` | `0.125rem` (2 px)   | connector `w-*`/`h-*`; connector/dot offset `calc()` |

Overriding either on the root (`class="[--timeline-dot-size:2rem]"`, as the custom-dot demo does)
must resize the dot **and** re-centre every connector without any other override — FR-011.

## 4. Colour contract (semantic tokens only)

| State                                   | Token          |
| --------------------------------------- | -------------- |
| dot border, `completed` / `active`      | `border-primary` |
| dot border, `pending`                   | `border-border`  |
| dot fill (all states)                   | `bg-background`  |
| connector, completed transition         | `bg-primary`     |
| connector, pending transition           | `bg-border`      |
| description / time text                 | `text-muted-foreground` |

No raw palette colour, no `dark:` override, no new token needed in `src/app.css`.

## 5. Error contract

| Trigger                                                                                           | Message                                                              |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `Timeline.Item` rendered with no `Timeline.Root` ancestor                                          | `` `<Timeline.Item>` must be used within `<Timeline.Root>`.``          |
| `Timeline.Dot` / `.Connector` / `.Content` rendered with no `Timeline.Root` ancestor               | `` `<Timeline.Dot>` must be used within `<Timeline.Root>`.`` (part name substituted) |
| `Timeline.Dot` / `.Connector` / `.Content` rendered inside a `Root` but with no `Item` ancestor    | `` `<Timeline.Dot>` must be used within `<Timeline.Item>`.`` (part name substituted) |
| `Timeline.Header` / `.Title` / `.Description` / `.Time` rendered anywhere                          | no error — these read no context                                     |

Every message matches `/must be used within/`, which is the assertion the tests use.

## 6. Behavioural invariants

1. **Ordered-list semantics** — `getByRole('list')` finds the root; `getAllByRole('listitem')` returns
   one entry per `Timeline.Item`, in source order; zero items renders an empty list without throwing.
2. **Status derivation** — for `n` items and `activeIndex = k`: items `0..k-1` are `completed`, item
   `k` is `active` (and only that one carries `aria-current="step"`), items `k+1..n-1` are `pending`.
   `activeIndex` unset ⇒ all `pending`, no `aria-current`. `k < 0` ⇒ all `pending`. `k >= n` ⇒ all
   `completed`.
3. **Connector presence** — a connector renders for every item except the last; `forceMount` keeps the
   last one mounted. A single-item timeline renders no connector unless `forceMount`.
4. **Connector completion** — `data-completed` is present iff the **next** item's status is
   `completed` or `active`; `data-status` reflects the **owning** item's status.
5. **Live DOM order** — inserting or removing an item recomputes every remaining item's `data-status`
   and every connector's `data-completed`, with no per-item index prop. (Reordering already-mounted
   siblings in place is upstream's documented gap — research R-02.)
6. **Orientation/variant** — `data-orientation` and `data-variant` on the root and `data-orientation`
   on item/dot/connector reflect the props; the alternate variant marks odd-indexed items with
   `data-alternate-right=""` and leaves even-indexed items without it.
7. **Direction** — `dir` on the root and on every item equals the explicit `dir` prop when given,
   otherwise the nearest `<DirectionProvider>`'s direction, otherwise an ancestor `[dir]`, otherwise
   `'ltr'`. Logical utilities mean the alternate/horizontal layouts mirror under `rtl` with no extra
   markup.
8. **Inertness** — no keyboard or pointer interaction changes any attribute; the component registers
   no listeners.
9. **Teardown** — unmounting an item unregisters it; unmounting the root leaves no listener, observer
   or timer behind (there are none to leak).

## 7. Test matrix (`timeline.test.ts`)

Constitution Principle III requires all six areas; the ID column is what task descriptions cite.

| ID   | Area                     | Assertion                                                                                              |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| T-01 | roles / ARIA             | root is `role="list"`; three items are `listitem`s in source order; `aria-orientation` matches `orientation` |
| T-02 | roles / ARIA             | only the item at `activeIndex` has `aria-current="step"`; none has it when `activeIndex` is unset        |
| T-03 | roles / ARIA             | connectors carry `aria-hidden="true"` and are excluded from the accessibility tree                      |
| T-04 | accessible names         | `Title`/`Description`/`Time` text is reachable; `<time>` renders `datetime` distinct from its text      |
| T-05 | uncontrolled             | with no `activeIndex`, every `data-status` is `pending` and nothing changes on interaction              |
| T-06 | controlled               | `activeIndex={2}` over four items ⇒ `completed, completed, active, pending`; `rerender` to `0` recomputes all four |
| T-07 | controlled, out of range | `activeIndex={-1}` ⇒ all `pending`; `activeIndex={9}` ⇒ all `completed`; every item has a valid `data-status` |
| T-08 | connector               | three items ⇒ two connectors; the last item renders none; `forceMount` on the last renders one          |
| T-09 | connector               | `data-completed` present on the connectors whose next item is `completed`/`active`, absent otherwise; `data-status` is the owning item's |
| T-10 | live DOM order          | adding a fourth item, then removing the second, recomputes every `data-status` and connector count      |
| T-11 | orientation / variant   | all four combinations set `data-orientation`/`data-variant`; `data-alternate-right` present on odd items only, and only under `alternate` |
| T-12 | RTL                     | `dir="rtl"` lands on the root and every item; a wrapping `<DirectionProvider dir="rtl">` with no `dir` prop produces the same; explicit `dir` beats the provider |
| T-13 | RTL                     | alternate/horizontal classes are the logical ones (`ms-auto`, `pe-6`/`ps-6`, `text-end`, `-start-`/`-end-`) — no physical `ml-auto`/`pr-6`/`pl-6`/`text-right`/`-left-`/`-right-` survives |
| T-14 | guard rails             | each of `Item`, `Dot`, `Connector`, `Content` outside `Root` throws `/must be used within/`; `Dot`/`Connector`/`Content` inside `Root` but outside `Item` throws too |
| T-15 | guard rails             | `Header`/`Title`/`Description`/`Time` render standalone without throwing                                |
| T-16 | keyboard                | after clicking the timeline and pressing Arrow×4/Home/End/Enter/Escape/Tab, every `data-status`, `aria-current` and connector count is unchanged |
| T-17 | styling                 | every part carries its `data-slot`; a caller `class` survives on each part and wins over the default (merged last) |
| T-18 | styling                 | the root's class list carries both CSS-variable declarations; `class="[--timeline-dot-size:2rem]"` overrides without removing them |
| T-19 | composition             | `child` snippet on each part receives the merged props (spot-checked via `data-slot` + `data-status` on the caller's own element) and leaves `ref` `null` |
| T-20 | composition             | `bind:ref` yields the `<ol>` / `<li>` / `<div>` / `<time>` node per part                                 |
| T-21 | composition             | arbitrary `restProps` (`id`, `aria-label`, `data-testid`) reach the rendered element on every part       |
| T-22 | barrel                  | namespace import exposes all nine short names and the nine `Timeline*` aliases resolve to the same components |
| T-23 | pure helpers            | `getTimelineItemStatus` truth table and `sortByDocumentPosition` ordering (including the missing-element ⇒ `0` case) |
| T-24 | teardown                | unmounting an item removes it from the collection (observed through the remaining items' statuses); unmounting the root throws nothing |
| T-25 | edge case               | zero items renders a list with no `listitem`; a single item renders no connector                        |
