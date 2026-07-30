# Feature Specification: Masonry

**Feature Branch**: `013-port-masonry`

**Created**: 2026-07-30

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Masonry\" (slug: masonry) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Arrange items into a responsive, optimally-packed grid (Priority: P1)

A developer drops a list of items (cards, images, posts) into a masonry container and gets a
multi-column, Pinterest-style layout where each item is placed into whichever column is currently
shortest, without the developer computing column assignment or item height themselves. As the
browser window resizes, the number of columns and the position of every item recompute
automatically.

**Why this priority**: This is the entire reason the component exists — every other example on the
upstream docs page is a variation of this base layout. Without it there is no masonry component.

**Independent Test**: Render a `Masonry` root containing several `MasonryItem` children of differing
heights with no extra props. Verify items are distributed across multiple columns, that the shortest
column always receives the next item, and that resizing the container changes the column count and
re-flows items — all fully testable in isolation from any other user story.

**Acceptance Scenarios**:

1. **Given** a `Masonry` root with `columnWidth={200}` and six items of varying heights, **When** it
   mounts in a 620px-wide container, **Then** items are distributed across 3 columns, each new item
   is appended to the currently shortest column, and no column's items overlap.
2. **Given** a mounted `Masonry` root, **When** the container is resized to a width that fits only 2
   columns, **Then** the layout recomputes to 2 columns and every item's position updates
   accordingly.
3. **Given** a `Masonry` root with `columnCount={3}` explicitly set, **When** the container is wide
   enough for 5 columns, **Then** exactly 3 columns are rendered (the explicit value wins over the
   computed one).
4. **Given** a `Masonry` root with `gap={16}`, **When** items are laid out, **Then** both the
   horizontal (column) and vertical (row) spacing between items equals 16px; **Given** instead
   `gap={{ column: 16, row: 24 }}`, **Then** column spacing is 16px and row spacing is 24px.
5. **Given** a `MasonryItem` whose rendered content later changes height (e.g. an image finishes
   loading), **When** the height change is observed, **Then** the item's column re-flows to close the
   resulting gap without a full-page reload.

---

### User Story 2 - Preserve left-to-right item order with linear layout (Priority: P2)

A developer needs the visual order of items to stay predictable (e.g. a numbered gallery, a feed
where "item 5 is always after item 4") instead of being reshuffled by the shortest-column-first
algorithm. Setting `linear` keeps items assigned to columns in their original left-to-right,
round-robin order while still balancing height reasonably.

**Why this priority**: Documented as a first-class variant on the upstream docs page (`linear` demo)
and controlled by a single boolean prop; it's a smaller slice than the base layout but still a
distinct, independently demonstrable behaviour.

**Independent Test**: Render a `Masonry` root with `linear` set and items numbered 1–6; verify item
`n` is always placed in a column at or after the column of item `n-1`'s preferred (round-robin)
column, unless the preferred column would grow disproportionately taller than the shortest column —
in which case it falls back to the shortest column, matching the upstream algorithm.

**Acceptance Scenarios**:

1. **Given** a `Masonry` root with `linear` and four columns, **When** six items of equal height are
   provided, **Then** items are assigned to columns in round-robin order (0, 1, 2, 3, 0, 1).
2. **Given** `linear` is set and one column has grown much taller than the others, **When** the next
   item's round-robin column would exceed 2.5× the shortest column's height, **Then** the item is
   placed in the shortest column instead.
3. **Given** `linear` is **not** set (the default), **When** items are laid out, **Then** each item is
   placed in whichever column is currently shortest, regardless of item order.

---

### User Story 3 - Render a stable, SSR-safe fallback before measurement (Priority: P3)

A developer ships a page where the masonry grid is part of the first server-rendered paint. Because
column count and item position depend on measuring the browser container, the developer supplies
`fallback` content (and optionally `defaultWidth` / `defaultHeight`) so the very first paint — on the
server and during hydration — shows stable, non-measurement-dependent markup instead of a collapsed
or mispositioned layout, avoiding layout shift and hydration mismatches.

**Why this priority**: Documented as its own example (`masonry-ssr-demo`) and directly required by
the porting brief ("the first server-rendered paint must not depend on measurement"), but it is an
enhancement of Story 1's layout rather than a layout algorithm of its own.

**Independent Test**: Render a `Masonry` root with a `fallback` snippet and no client-side
measurement available (simulating SSR/first paint); verify the fallback content is what renders, and
that once the component measures its container the fallback is replaced by the positioned items with
no error and no flash of unstyled/overlapping content.

**Acceptance Scenarios**:

1. **Given** a `Masonry` root with `fallback` content and `defaultWidth`/`defaultHeight` set,
   **When** it is server-rendered (or rendered before mount/measurement completes), **Then** the
   `fallback` content is shown instead of the positioned item layout.
2. **Given** the same setup, **When** the component mounts and measures its container in the
   browser, **Then** the `fallback` content is replaced by the normally positioned items.
3. **Given** a `Masonry` root with no `fallback` provided, **When** it renders before measurement,
   **Then** it falls back to `defaultWidth`/`defaultHeight` (or `0` if neither is set) to estimate an
   initial layout rather than erroring.

### Edge Cases

- Zero `MasonryItem` children: the container renders with zero height and no error.
- Container narrower than a single `columnWidth`: at least one column is always rendered (column
  count never drops below 1).
- `columnCount` and `maxColumnCount` both provided: `columnCount` wins; `maxColumnCount` is ignored
  (matches upstream).
- An item is removed from the middle of the list: remaining items re-flow to fill the gap.
- Very large item counts (hundreds+): only items within the visible viewport plus the `overscan`
  margin are mounted into the DOM at once, keeping the page responsive.
- Page direction is `rtl`: column order mirrors right-to-left (column 0 renders on the right edge)
  with no other prop changes required.
- `gap` omitted entirely: behaves as `gap={0}`.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST provide a `Masonry` root that lays out its `MasonryItem` children
  into columns, placing each item into the column that keeps the overall layout most balanced
  (shortest-column-first) by default.
- **FR-002**: The root MUST accept a `columnWidth` (default `200`) controlling the preferred width of
  each column when column count is not explicitly set.
- **FR-003**: The root MUST accept an explicit `columnCount`; when set, it overrides the
  automatically computed column count.
- **FR-004**: The root MUST accept a `maxColumnCount` that caps the automatically computed column
  count; it MUST be ignored whenever `columnCount` is explicitly set.
- **FR-005**: The root MUST accept a `gap`, either a single number (applied to both column and row
  spacing) or an object `{ column, row }` for independent spacing, defaulting to `0`.
- **FR-006**: The root MUST accept an `itemHeight` (default `300`) used to estimate total layout
  height for items not yet measured.
- **FR-007**: The root MUST accept `defaultWidth` and `defaultHeight`, used as the initial container
  size before the real size can be measured (server render / first paint).
- **FR-008**: The root MUST accept an `overscan` (default `2`, expressed in viewport-height
  multiples) controlling how far outside the visible area items are still mounted, and a `scrollFps`
  (default `12`) capping how often scroll-driven recomputation runs.
- **FR-009**: The root MUST accept `fallback` content that renders in place of the positioned layout
  until the component has mounted and measured its container in the browser.
- **FR-010**: The root MUST accept a `linear` flag (default `false`); when set, items are assigned to
  columns in left-to-right round-robin order (falling back to the shortest column only when the
  preferred column would grow more than 2.5× taller than the shortest), instead of always using the
  shortest-column-first algorithm.
- **FR-011**: The component MUST recompute column count and item positions when the container is
  resized (including orientation changes), debounced so rapid resize events do not cause layout
  thrashing.
- **FR-012**: The component MUST re-measure an item's height whenever its rendered content changes
  size (e.g. image load, expanding text) and MUST re-flow later items in that column accordingly.
- **FR-013**: The component MUST only mount items that are within the visible viewport plus the
  `overscan` margin, unmounting/hiding items that scroll far outside that range, so the number of
  live DOM nodes does not grow linearly with total item count.
- **FR-014**: `MasonryItem` MUST render as a generic container (`div` by default) accepting arbitrary
  children and passing through standard HTML attributes.
- **FR-015**: Both `Masonry` and `MasonryItem` MUST support replacing their default rendered element
  with a caller-supplied element via the project's `child` snippet convention (the Svelte equivalent
  of upstream's `asChild`), while preserving the part's behaviour and data attributes.
- **FR-016**: Both parts MUST expose a `data-slot` attribute (`masonry` / `masonry-item`) for styling
  and testing hooks.
- **FR-017**: Using `MasonryItem` outside a `Masonry` root MUST throw a descriptive error naming both
  parts, consistent with every other ported compound component.
- **FR-018**: Under a right-to-left direction context, column order MUST mirror horizontally (the
  first column renders at the trailing/right edge) without any additional prop from the consumer.
- **FR-019**: The component MUST render usable, non-overlapping output with server-side rendering
  disabled entirely from the initial DOM measurement — i.e. the first paint MUST NOT require a
  browser layout pass to avoid producing broken markup (satisfied via `fallback` /
  `defaultWidth`/`defaultHeight` per FR-007/FR-009).

### Key Entities

- **Masonry Root**: The layout container. Owns the column count, column widths, gap configuration,
  scroll/viewport tracking, and the positions of all items.
- **Masonry Item**: One piece of content placed into a specific column at a specific vertical offset,
  with a measured or estimated height.
- **Column Positioner**: The internal layout algorithm state that tracks each column's current
  height and decides which column the next item is assigned to (shortest-first or linear/round-robin
  per FR-001/FR-010). Not directly exposed to consumers.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Given the same items, container width, and props, the Svelte port assigns every item to
  the same column and vertical position as the upstream React component would, for both the default
  and `linear` algorithms.
- **SC-002**: The first rendered paint (before any browser measurement occurs) shows only
  non-overlapping content — either the caller's `fallback` or an estimate-based layout — with zero
  instances of items rendered on top of one another.
- **SC-003**: After an item's content changes size, the layout visibly re-flows to close any resulting
  gap within one animation frame of the change being detected.
- **SC-004**: Resizing the container from a width that fits N columns to one that fits M columns
  results in exactly M columns being rendered, with no leftover items missing from the layout.
- **SC-005**: In a right-to-left page, the column order is visibly mirrored with no additional
  configuration beyond the page/context direction already being `rtl`.
- **SC-006**: All three upstream examples (default masonry grid, linear layout, SSR-safe fallback)
  are reproduced on the component's documentation page and behave identically to their written
  description.
- **SC-007**: The component is installable through the project's own registry with the same single
  command used for every other first-party component.
- **SC-008**: Scrolling through a masonry grid of at least 200 items keeps the count of live DOM
  item nodes bounded (proportional to viewport + overscan, not to total item count).

## Assumptions _(mandatory)_

- **Source variant**: Only the upstream `radix` base variant
  (`.reference/diceui/docs/registry/bases/radix/ui/masonry.tsx`, matching
  `docs/content/docs/components/radix/masonry.mdx`) is ported. The parallel `base` registry variant
  (`docs/registry/bases/base/ui/masonry.tsx`) is out of scope; the two are behaviourally identical,
  differing only in how upstream implements `asChild` (Radix `Slot` vs. a manual clone), a difference
  this port already collapses into the project's `child` snippet convention.
- **`asChild` → `child` snippet**: Upstream's `asChild` prop (backed by Radix `Slot`) has no direct
  Svelte 5 equivalent. Per `CLAUDE.md`'s translation table, both `Masonry` and `MasonryItem` expose a
  `child` snippet instead; `asChild` itself is dropped from the public API. This is a deliberate,
  documented API rename, not a capability loss — the SSR demo's plain (non-`asChild`) usage and the
  default demo's `asChild` usage are both reproducible through the same snippet.
- **`useIsomorphicLayoutEffect` → `$effect.pre`**: Upstream uses this hook purely to run its
  mount/measurement effect before paint on the client and as a no-op on the server. Svelte's
  `$effect.pre` (guarded so it only measures once mounted) provides the same before-paint timing
  without needing an isomorphic wrapper, because Svelte components do not execute effects during SSR
  at all.
- **`useComposedRefs` → `$bindable` ref**: Upstream composes a caller-supplied `ref` with an internal
  container ref via `useComposedRefs`. The Svelte port instead exposes a single `ref = $bindable(null)`
  bound with `bind:this`, per the project's standard ref pattern — there is only ever one DOM node to
  reference, so no composition utility is needed.
- **RTL support is an addition, not a straight port**: Upstream's algorithm computes a pixel `left`
  offset per column assuming left-to-right and has no direction awareness at all. Because Principle
  III (Accessibility) and the porting brief both require RTL parity, this port composes the project's
  existing `direction-provider` (`useDirection()` from
  `src/lib/components/ui/direction-provider/direction-provider.svelte.ts`) so that, under `rtl`, column
  `left` offsets are mirrored (column 0 anchored to the right edge) with no upstream prop to preserve
  or rename — this is new behaviour layered on top of the ported layout algorithm, resolving what
  upstream leaves undefined.
- **No dedicated ARIA role**: The WAI-ARIA Authoring Practices do not define a pattern for a generic
  masonry/grid-flow layout container, and upstream renders plain, role-less `div`s for both parts.
  This port keeps `Masonry` and `MasonryItem` as generic containers with no implicit ARIA role,
  matching upstream; any semantic role (e.g. `list`/`listitem`, `grid`) is left to the consumer's
  content, exactly as upstream leaves it.
- **`radix-ui` dependency dropped**: Upstream's `MasonryProps`/`MasonryItemProps` types extend
  `React.ComponentProps<typeof Slot.Root>` purely to type-check `asChild` pass-through. Since `asChild`
  is replaced by the `child` snippet (see above), the port has no dependency on `radix-ui` or any
  `bits-ui` primitive for this component — the layout, scroll-tracking, and resize-observing logic is
  bespoke per Principle IV, because no existing project component or `bits-ui` primitive provides
  masonry/virtualized-grid positioning.
- **Scroll/resize/observer logic ports as a state class**: Upstream's `usePositioner`,
  `useDebouncedWindowSize`, `useResizeObserver`, and `useScroller` hooks (and their supporting
  interval-tree/cache utilities) are internal implementation details with no public API surface. They
  are ported as private helpers inside `masonry.svelte.ts`, not exposed through `index.ts`, since
  Principle V's barrel contract only covers the public API (`Root`/`Item`, prop types).
- **Window-scroll tracking, not container-scroll**: Upstream tracks `window.scrollY` (not the
  container's own `scrollTop`) to decide which items are within the overscan range — i.e. it assumes
  the masonry grid scrolls with the page rather than living inside an internally-scrollable box. This
  port preserves that behaviour unchanged; a consumer wanting an internally-scrollable masonry would
  need to compose it inside a scroll container themselves, exactly as upstream requires.
- **Fallback replaces the entire viewport, not per-item**: Per upstream's `MasonryViewport`, when the
  component has not yet mounted, `fallback` replaces the *entire* positioned item list (not one
  fallback per item). This port preserves that behaviour; per-item skeletons (as shown in the SSR
  demo) are achieved by the caller passing a `fallback` that itself renders a grid of skeletons.

### Additional assumptions resolved during planning

Recorded per Principle II. Full rationale in `research.md` (references in brackets).

- **Inverted child architecture** [R-01]: upstream's `MasonryViewport` inspects `children` with
  `React.Children.toArray`, derives the item count from it, and `cloneElement`s the in-range subset
  with an injected `ref` and `style`; `MasonryItem` itself is a context-free `<div>`. Svelte 5 cannot
  introspect a `Snippet` (`CLAUDE.md` §10). The port therefore inverts control: each `MasonryItem`
  registers with the root's state, reads its own position from the shared positioner, and renders its
  own absolute-positioned element. The public composition `<Masonry><MasonryItem/></Masonry>` is
  unchanged; only the internal wiring differs.
- **`MasonryItem` now requires the provider** [R-01]: because it reads context, using it outside
  `<Masonry.Root>` throws `` `<Masonry.Item>` must be used within `<Masonry.Root>`. `` Upstream never
  throws here — its `MASONRY_ERROR.MasonryItem` string is dead code, since the item never calls
  `useMasonryContext`. The throw is required by Principle III's guard-rail clause and is tested.
- **`index` prop added to `MasonryItem`** [R-02]: layout index is derived from registration order,
  which equals source order on the initial render. An item inserted mid-list *after* mount would
  otherwise be appended last, so `MasonryItem` accepts an optional `index?: number` that wins over
  registration order. Upstream derives the same number from child position, which this port cannot
  observe.
- **Virtualization gate lives inside the item** [R-03]: the `{#if}` that unmounts out-of-range items
  wraps the item's own element inside `masonry-item.svelte`. The component instance always exists (so
  registration works) while its DOM subtree does not — the same cost model as upstream, where
  `React.Children.toArray` materialises every child element but mounts only the in-range ones.
- **Heights are drained in index order** [R-04]: `positioner.set` appends to the currently shortest
  column, so the resulting layout depends on call order. Upstream guarantees index order via its
  forward-growing measurement batch. With self-measuring items, the port buffers reported heights and
  applies them only when `index === positioner.size()`. This is what makes SC-001 hold.
- **RTL is implemented with a CSS logical property** [R-07]: the positioner emits `left` as an offset
  from the *leading* inline edge (identical numbers in both directions) and items render it as
  `inset-inline-start`; the root writes the direction resolved by `direction-provider` onto its own
  `dir`. Consequently `Masonry` gains a `dir?: 'ltr' | 'rtl'` prop (upstream has none) and `dir` is
  `Omit`ted from the inherited `HTMLAttributes`, exactly as `marquee.svelte` already does.
- **`onDeepMemo` / `Cache` dropped** [R-06]: upstream lines 428–539 exist only to memoise
  `ResizeObserver` creation across React re-renders. Svelte creates the observer once in a single
  `$effect` keyed to the positioner, so the 112-line cache has no purpose and is not ported. No
  behavioural difference.
- **`onRafSchedule`'s first call is fixed** [3.1 in `data-model.md`]: upstream guards with
  `if (frameId)`, so the initial call — when `frameId` is `null` — schedules nothing and the first
  item-resize re-flow is dropped. The port uses `if (frameId === null)`, the evident intent; without
  it FR-012 would only fire from the second resize onward.
- **`MasonryViewport` stays internal, and parts gain `data-*` state** [Principle VIII]: upstream
  exports only `Masonry`, `MasonryItem` and `MasonryProps`, so the viewport is rendered by the root
  and not exported here either. Principle VIII additionally requires component state to be
  externally styleable, so the port adds `data-slot` to all three parts plus `data-scrolling` (root),
  `data-version` (viewport), and `data-index` / `data-column-index` / `data-measuring` (item).
  Upstream carries only `data-slot` on the root and item and `data-version` on the viewport.
- **The positioner and interval tree are exported; the DOM hooks are not** [R-10]: refining the
  "internal implementation details" assumption above — `createPositioner`, `createIntervalTree`,
  `resolveColumnCount`, `resolveColumnWidth` and their types *are* exported from `index.ts` because
  they are generic, reusable and directly unit-testable, and a later virtualized component can depend
  on `masonry` for them. The scroll, resize-debounce and throttle helpers stay module-private, and no
  new shared folder is created (the repo has none; cross-component reuse goes through
  `registryDependencies`, as `direction-provider` already does).
- **No controlled/uncontrolled state exists** [R-11]: `Masonry` exposes no value-bearing prop and no
  callback, so Principle III's "controlled `value` + `onValueChange`" and "`disabled`/`readOnly`"
  clauses have no referent. The nearest analogue — an explicit `columnCount` overriding the
  width-derived one — is tested in their place, and the absence is recorded here rather than silently
  skipped.
