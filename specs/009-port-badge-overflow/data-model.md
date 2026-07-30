# Phase 1 Data Model — Badge Overflow

**Feature**: `009-port-badge-overflow` | **Source of truth**:
`.reference/diceui/docs/registry/bases/radix/ui/badge-overflow.tsx` @ pinned commit `d9763d8`

The component holds no domain state. It holds **six measured metrics** (written only by the measurement
pass) and derives everything else. There is no context, no provider and no shared store.

## Constants (exported from `badge-overflow.svelte.ts`)

| Name                            | Value | Upstream origin                                             |
| ------------------------------- | ----- | ----------------------------------------------------------- |
| `DEFAULT_LINE_COUNT`            | `1`   | `lineCount = 1` default                                     |
| `DEFAULT_BADGE_GAP`             | `4`   | `useState(4)` — `gap-1`                                     |
| `DEFAULT_BADGE_HEIGHT`          | `20`  | `useState(20)` — `h-5`                                      |
| `DEFAULT_OVERFLOW_BADGE_WIDTH`  | `40`  | `useState(40)` — approximate `+N` width                     |
| `OVERFLOW_SAMPLE_COUNT`         | `99`  | `renderOverflow(99)` in the measurement row — the widest `+N` |

## Entities

### 1. `BadgeOverflowItem<T>` (value object)

One entry of `items`. `T` is the caller's type; the component never inspects it beyond label
resolution.

| Field   | Type     | Derivation                                              |
| ------- | -------- | ------------------------------------------------------- |
| `item`  | `T`      | as supplied                                             |
| `label` | `string` | `resolveBadgeLabel(item, getBadgeLabel)` — see below    |

`resolveBadgeLabel<T>(item, getBadgeLabel?)`, verbatim from upstream's `getBadgeLabel` callback:

| Condition                                         | Result                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| `typeof item === 'object'` and no `getBadgeLabel`  | **throws** ``Error('`getBadgeLabel` is required when using array of objects')`` |
| `getBadgeLabel` supplied                          | `getBadgeLabel(item)`                                                           |
| otherwise                                         | `item` coerced to `string`                                                      |

Note the upstream quirk, reproduced: `typeof null === 'object'`, so a `null` item without a
`getBadgeLabel` throws too. Numbers and booleans fall through to the coercion branch.

**Invariant**: the label is the *identity key* for width lookup. Two items with the same label share one
measured width — upstream's `Map<string, number>` has the same property. Duplicate labels are therefore
measured once; this is upstream behaviour and is asserted in the tests.

### 2. `ContainerMetrics` (value object)

Produced by `readContainerMetrics(el)` in one batched read of the visible container:

| Field          | Type     | Derivation                                                                       |
| -------------- | -------- | -------------------------------------------------------------------------------- |
| `gap`          | `number` | `parseFloat(getComputedStyle(el).gap)`, falling back to `DEFAULT_BADGE_GAP` when non-finite (research R-02) |
| `padding`      | `number` | `parseFloat(paddingLeft) + parseFloat(paddingRight)`, each `0` when non-finite   |
| `contentWidth` | `number` | `el.clientWidth - padding`                                                       |

### 3. `MeasuredMetrics` (the only mutable state — fields of `BadgeOverflowState<T>`)

| Field                | Rune         | Seed                           | Written by                                        |
| -------------------- | ------------ | ------------------------------ | ------------------------------------------------- |
| `containerWidth`     | `$state`     | `0`                            | `measure()` ← `ContainerMetrics.contentWidth`     |
| `badgeGap`           | `$state`     | `DEFAULT_BADGE_GAP` (`4`)      | `measure()` ← `ContainerMetrics.gap`              |
| `badgeHeight`        | `$state`     | `DEFAULT_BADGE_HEIGHT` (`20`)  | `measure()` ← `row.children[0].offsetHeight \|\| 20` |
| `overflowBadgeWidth` | `$state`     | `DEFAULT_OVERFLOW_BADGE_WIDTH` (`40`) | `measure()` ← `row.children[items.length].offsetWidth \|\| 40` |
| `badgeWidths`        | `$state.raw` | empty `Map`                    | `measure()` ← `label → row.children[i].offsetWidth`, replaced only when the contents differ (research R-06) |
| `isMeasured`         | `$state`     | `false`                        | `measure()` — set `true` at the end of the first successful pass, never reset |

**State transition** — there is exactly one, and it is one-way:

```text
placeholder (isMeasured === false)  ──first measure()──▶  measured (isMeasured === true)
```

Subsequent `measure()` calls update the metrics but never return to `placeholder`, matching upstream
(`setIsMeasured(true)` with no reset). `items` changing does **not** reset it — the previous split stays
on screen for the frame between the DOM update and the effect, which is what upstream does.

### 4. `VisibleSplit<T>` (value object)

Produced by the pure `computeVisibleSplit<T>({ items, labels, badgeWidths, containerWidth, badgeGap,
overflowBadgeWidth, lineCount })`, transliterated from upstream lines 127–182:

| Field          | Type     | Meaning                                       |
| -------------- | -------- | --------------------------------------------- |
| `visibleItems` | `T[]`    | ordered prefix-ish subset that fits           |
| `hiddenCount`  | `number` | `max(0, items.length - visibleItems.length)`  |

**Short circuit** (upstream, verbatim): when `containerWidth` is falsy, `items.length === 0`, or
`badgeWidths.size === 0`, the result is `{ visibleItems: items, hiddenCount: 0 }` — every item is shown
and no indicator renders.

**Algorithm** (verbatim; `currentLineWidth` starts `0`, `currentLine` starts `1`):

```text
for i in 0 … items.length - 1:
    badgeWidth = badgeWidths.get(labels[i])
    if badgeWidth is undefined:  continue                    # not measured yet — skipped, not counted as hidden
    widthWithGap  = badgeWidth + badgeGap
    isLastLine    = currentLine === lineCount
    hasMoreItems  = i < items.length - 1
    available     = (isLastLine && hasMoreItems)
                        ? containerWidth - overflowBadgeWidth - badgeGap
                        : containerWidth
    if currentLineWidth + widthWithGap <= available:
        currentLineWidth += widthWithGap ; visible.push(item)
    else if currentLine < lineCount:
        currentLine++ ; currentLineWidth = widthWithGap ; visible.push(item)
    else:
        break
```

Consequences that are upstream behaviour and are asserted as such:

- **Non-last lines do not reserve indicator space** — only the last line does, and only while more
  items remain (`hasMoreItems`).
- **The final item never reserves space for the indicator.** If item `n-1` is the one that would
  overflow, the last line is packed as though no indicator followed, so the indicator can wrap onto an
  extra line. Upstream ships this; the unused `use-badge-overflow.ts` hook has a `pop()` correction that
  is deliberately not adopted (research R-05).
- **A badge wider than the whole container** is pushed onto a fresh line while `currentLine < lineCount`
  and only breaks the loop on the last line — matching upstream.
- **Unmeasured labels are skipped, not hidden**, so `hiddenCount` can undercount for one frame after
  `items` grows. Self-corrects on the next measurement pass.

### 5. `PlaceholderView` (value object — pre-measurement / SSR)

| Field    | Type  | Derivation                                                                    |
| -------- | ----- | ----------------------------------------------------------------------------- |
| `count`  | `number` | `getPlaceholderCount(n, lineCount) = Math.min(n, lineCount * 3 - (lineCount > 1 ? 1 : 0))` |
| `height` | `number` | `getPlaceholderHeight(badgeHeight, badgeGap, lineCount) = badgeHeight * lineCount + badgeGap * (lineCount - 1)` |

Worked values with the seeds (`badgeHeight = 20`, `badgeGap = 4`):

| `lineCount` | placeholder items (of 15) | `min-height` |
| ----------- | ------------------------- | ------------ |
| `1`         | `3`                       | `20px`       |
| `2`         | `5`                       | `44px`       |
| `3`         | `8`                       | `68px`       |

No overflow indicator renders in this state — upstream's placeholder branch emits only the slice.

## Derived members of `BadgeOverflowState<T>`

| Member              | Rune          | Expression                                                           |
| ------------------- | ------------- | -------------------------------------------------------------------- |
| `items`             | `$derived`    | `props.getItems()`                                                   |
| `lineCount`         | `$derived`    | `props.getLineCount()`                                               |
| `labels`            | `$derived.by` | `items.map((i) => resolveBadgeLabel(i, props.getGetBadgeLabel()))`   |
| `split`             | `$derived.by` | `computeVisibleSplit({ … })`                                         |
| `visibleItems`      | `$derived`    | `split.visibleItems`                                                 |
| `hiddenCount`       | `$derived`    | `split.hiddenCount`                                                  |
| `placeholderItems`  | `$derived.by` | `items.slice(0, getPlaceholderCount(items.length, lineCount))`       |
| `placeholderHeight` | `$derived`    | `getPlaceholderHeight(badgeHeight, badgeGap, lineCount)`             |
| `isEmpty`           | `$derived`    | `items.length === 0`                                                 |

All reactive inputs reach the class as **getter functions** (`getItems`, `getLineCount`,
`getGetBadgeLabel`), never as constructor snapshots — CLAUDE.md §4.

## Reactivity graph (why there is no `$effect` loop)

```text
props.items ─┐
props.getBadgeLabel ─┼─▶ labels ─┐
props.lineCount ─────┘           │
                                 ├─▶ split ─▶ visible badges + indicator ─▶ DOM
measured metrics ────────────────┘                                            │
        ▲                                                                     │
        └────────── measure()  ◀── $effect ◀── ResizeObserver ◀───────────────┘
                                     │
                                     └── tracked reads: items, getBadgeLabel  (NOT the metrics)
```

The `$effect`'s **read set** (`items`, `getBadgeLabel`, the two element refs) and its **write set** (the
six metrics) are disjoint, so a measurement never re-schedules its own effect and `untrack()` is not
needed. The write set does feed the DOM, and a DOM size change can legitimately re-trigger the observer
— identical to upstream, and damped by the equal-value and `sameWidths` short circuits.

## Attribute contract

### Visible container (`data-slot="badge-overflow"`)

| Attribute           | Present when                    | Value                                    |
| ------------------- | ------------------------------- | ---------------------------------------- |
| `data-slot`         | always                          | `"badge-overflow"`                       |
| `data-measured`     | `isMeasured`                    | `""`                                     |
| `data-line-count`   | always                          | `String(lineCount)`                      |
| `data-hidden-count` | always                          | `String(hiddenCount)` (`"0"` when none)  |
| `data-empty`        | `items.length === 0`            | `""`                                     |
| `class`             | always                          | `cn('flex flex-wrap', className)`        |
| `style`             | always                          | `gap: {badgeGap}px` + `min-height: {placeholderHeight}px` when not measured, then the caller's `style` appended last |

### Measurement row (`data-slot="badge-overflow-measure"`)

| Attribute     | Value                                                    |
| ------------- | -------------------------------------------------------- |
| `data-slot`   | `"badge-overflow-measure"`                               |
| `aria-hidden` | `"true"` (research R-08)                                 |
| `class`       | `'pointer-events-none invisible absolute flex flex-wrap'` (upstream verbatim) |
| `style`       | `gap: {badgeGap}px`                                      |

### Default indicator (`data-slot="badge-overflow-indicator"`)

| Attribute    | Value                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------- |
| `data-slot`  | `"badge-overflow-indicator"`                                                                  |
| `data-count` | `String(count)`                                                                               |
| `class`      | `cn('inline-flex h-5 shrink-0 items-center rounded-md border px-1.5 text-xs font-semibold', className)` (upstream verbatim, Prettier-Tailwind reordered) |

Boolean data attributes use `cond ? '' : undefined` so they are absent when false (Principle VIII).
