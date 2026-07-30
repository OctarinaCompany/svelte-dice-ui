# Feature Specification: Timeline

**Feature Branch**: `010-port-timeline`

**Created**: 2026-07-30

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Timeline\" (slug: timeline) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Render a chronological list of events (Priority: P1)

A developer renders a sequence of events (an order history, a project's activity log, an onboarding
checklist) as a vertical timeline: each event has a dot marker, a connector line to the next event,
and content (a title, a timestamp, a description). Screen reader users hear the sequence announced as
an ordered list with a position and a total count, exactly as sighted users see a top-to-bottom
sequence.

**Why this priority**: This is the entire reason the component exists — every other behaviour
(orientation, variant, active state, RTL) is a variation on this same base list. Without it there is
nothing to ship.

**Independent Test**: Render the component with three items, each containing a dot, a connector and
content, and confirm (a) the container exposes list semantics with three list items, (b) each item's
dot and connector render in DOM order, and (c) the connector is absent after the last item.

**Acceptance Scenarios**:

1. **Given** three timeline items are rendered, **When** the page loads, **Then** the container
   exposes list semantics containing exactly three list items, in source order.
2. **Given** a timeline item is not the last item, **When** it renders, **Then** it renders a
   connector line joining it to the next item.
3. **Given** a timeline item is the last item, **When** it renders, **Then** no connector line is
   rendered after it (unless the consumer explicitly forces one to stay mounted).

---

### User Story 2 - Communicate progress through an active step (Priority: P1)

A developer building a multi-step process (an order-tracking page, a setup wizard's progress summary)
sets a single "active index" on the timeline and every item automatically becomes visually and
programmatically marked as completed, active, or pending relative to that index — without the
developer computing per-item state by hand.

**Why this priority**: Progress communication is the primary real-world use case shown in the upstream
docs (order tracking) and is independent of orientation/variant choices, so it ranks alongside the
base rendering story as core value.

**Independent Test**: Render four items with `activeIndex` set to 2 and confirm the first two items
are marked completed, the third is marked active (and identifies itself as the current step to
assistive technology), and the fourth is marked pending; then change `activeIndex` and confirm every
item's state recomputes.

**Acceptance Scenarios**:

1. **Given** `activeIndex` is `2` on a four-item timeline, **When** the items render, **Then** items
   at index 0 and 1 are marked completed, the item at index 2 is marked active and announced as the
   current step, and the item at index 3 is marked pending.
2. **Given** `activeIndex` is left unset, **When** the items render, **Then** every item is marked
   pending and none is announced as the current step.
3. **Given** the connector between a completed/active item and the next item, **When** the next item's
   status is completed or active, **Then** that connector is visually marked as completed; otherwise it
   is not.

---

### User Story 3 - Choose orientation, alternating layout and direction (Priority: P2)

A developer adapts the same timeline markup to a vertical sidebar layout, a horizontal process-bar
layout, an alternating (zig-zag) layout for a marketing/story page, and a right-to-left page direction
for RTL-language audiences — by setting props rather than rewriting markup.

**Why this priority**: Every upstream example demonstrates one of these combinations, and they are
documented, supported configurations, but the timeline is fully valuable in its default vertical,
non-alternating, LTR configuration first (Stories 1–2), so this configurability ranks after the core
behaviour.

**Independent Test**: Render the same item markup four times, once per combination
(`orientation="vertical"`, `orientation="horizontal"`, `variant="alternate"`, `dir="rtl"`), and confirm
each renders the layout, direction and alternating-side placement documented upstream, with horizontal
arrangement mirrored under `dir="rtl"`.

**Acceptance Scenarios**:

1. **Given** `orientation="horizontal"`, **When** items render, **Then** they lay out left-to-right (or
   right-to-left under `dir="rtl"`) instead of top-to-bottom, and each item's own content stacks below
   its dot.
2. **Given** `variant="alternate"` with vertical orientation, **When** items render, **Then**
   even-indexed items' content sits on the leading side and odd-indexed items' content sits on the
   trailing side of a shared centre line.
3. **Given** `variant="alternate"` with horizontal orientation, **When** items render, **Then**
   even-indexed items' content sits below the centre line and odd-indexed items' content sits above it.
4. **Given** `dir="rtl"` with horizontal orientation, **When** items render, **Then** the visual reading
   order of items is mirrored end-to-start instead of start-to-end.

---

### Edge Cases

- **No items rendered**: the root still exposes list semantics with zero list items; nothing throws.
- **Single item**: no connector renders, since there is no next item to connect to (`forceMount` on the
  connector is the documented escape hatch for keeping it mounted anyway).
- **`activeIndex` out of range** (negative, or beyond the last item's index): every item resolves to a
  valid status per the same completed/active/pending comparison rule — an index beyond the last item
  makes every item "completed", a negative index makes every item "pending" — with no invalid or
  missing `data-status`.
- **Items registered/unregistered dynamically** (conditional rendering, adding or removing items): each
  item's status and its connector's completed state are derived from live DOM order, not registration
  order, so inserting or removing an item recomputes every other item's position without a manual index
  prop. Reordering already-mounted items **in place** (a keyed `{#each}` move that does not remount)
  does not recompute positions — upstream behaves identically, because its store notifies only on
  register/unregister.
- **Custom dot content**: replacing the default dot's children with an icon or custom markup does not
  break the dot's status-driven border colour or positioning.
- **Item rendered outside the root, or a dot/connector/content rendered outside an item**: throws a
  descriptive, documented error naming the missing provider, exactly like every other compound component
  in this repository. Header, title, description and time render anywhere, because they read no context
  (upstream parity).
- **Right-to-left layout**: covered by User Story 3; horizontal arrangement and alternating sides both
  invert correctly, and the vertical connector/dot offsets mirror using direction-aware logical
  properties rather than hard-coded left/right values.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The root component MUST expose list semantics (an ordered list role with each item as a
  list item), so assistive technology announces each event's position and the total event count.
- **FR-002**: The root component MUST accept an `orientation` of `"vertical"` (default) or
  `"horizontal"`, and every part's layout MUST switch consistently between the two.
- **FR-003**: The root component MUST accept a `variant` of `"default"` (default) or `"alternate"`, and
  under `"alternate"`, items MUST alternate their content between the two sides of a shared centre line
  based on each item's resolved position among its siblings (the item at an even resolved index takes
  the default side — the leading side under vertical orientation and the **bottom** side under
  horizontal orientation; the item at an odd resolved index takes the opposite side — trailing under
  vertical, **top** under horizontal — and is the one marked with the alternate-side attribute).
- **FR-004**: The root component MUST accept a `dir` of `"ltr"` or `"rtl"`; when omitted, it MUST
  resolve from the project's existing ambient direction context, exactly like other ported components
  that support direction. Under `"rtl"`, horizontal layout and alternating placement MUST mirror.
- **FR-005**: The root component MUST accept an optional zero-based `activeIndex`. Each item's status
  (`"completed"`, `"active"`, `"pending"`) MUST be derived by comparing that item's own resolved
  position among its siblings to `activeIndex`: positions before it are `"completed"`, the position
  equal to it is `"active"`, positions after it (and every position when `activeIndex` is unset) are
  `"pending"`.
- **FR-006**: An item's resolved position among its siblings MUST be computed from live DOM order (not
  registration/mount order), so item status stays correct when items are inserted, removed or
  reordered.
- **FR-007**: An item marked `"active"` MUST identify itself as the current step to assistive
  technology (an ARIA "current step" designation).
- **FR-008**: Every part MUST expose the state it reflects as `data-*` attributes a consumer can select
  on for styling, matching the upstream data-attribute tables: the root its orientation and variant;
  each item its resolved status, its orientation and — under the alternate variant — which side it has
  been placed on; each dot its item's status and the orientation; each connector its owning item's
  status, the orientation and whether the transition it represents is completed; each content its item's
  status.
- **FR-009**: A connector MUST render between an item and the next item, except after the last item,
  unless the consumer explicitly opts to force it to stay mounted.
- **FR-010**: A connector MUST expose whether the transition it represents is completed (the following
  item's status is `"completed"` or `"active"`) as an attribute a consumer can select on for styling,
  and MUST be hidden from assistive technology since it is purely decorative.
- **FR-011**: The dot marker's size and the connector's thickness MUST both be configurable from a
  single pair of component-scoped custom properties, so a consumer can resize both without overriding
  component internals.
- **FR-012**: The dot marker MUST accept arbitrary children (an icon, initials, custom markup) in place
  of its default empty appearance, while continuing to reflect its item's resolved status.
- **FR-013**: The component MUST ship a content container, a header container, a title, a description
  and a semantic time element as distinct composable parts, matching the upstream part list, so a
  consumer can assemble an item's body from any subset of them.
- **FR-014**: The time part MUST render as a semantic `<time>` element accepting a machine-readable
  `dateTime` attribute distinct from its displayed text.
- **FR-015**: Every part MUST allow the consumer to merge additional CSS classes onto its rendered
  element, with the consumer's classes taking precedence over the part's own default classes, and MUST
  spread any additional standard element attributes the consumer supplies onto that element.
- **FR-016**: Every part MUST allow the consumer to render it as a different underlying element or
  component (the upstream `asChild` escape hatch) rather than being restricted to the part's default
  element, while preserving that part's data attributes and behaviour on whatever element is rendered.
- **FR-017**: Using `TimelineItem`, `TimelineDot`, `TimelineConnector` or `TimelineContent` outside a
  `Timeline` root — and using `TimelineDot`, `TimelineConnector` or `TimelineContent` outside a
  `TimelineItem` — MUST throw a descriptive, documented error naming both the offending part and the
  required ancestor. `TimelineHeader`, `TimelineTitle`, `TimelineDescription` and `TimelineTime` read no
  shared state and MUST render standalone without throwing, matching upstream.
- **FR-018**: The component and every part MUST carry a stable, documented markup identifier
  (`data-slot`) so consumers can target them with CSS/test selectors, matching the upstream slot names.

### Key Entities

- **Timeline root**: the ordered-list container; owns orientation, variant, direction and the active
  index shared by every descendant item.
- **Timeline item**: one event/step; owns a resolved sibling position, a derived status
  (completed/active/pending) and — under the alternate variant — a derived side (leading/trailing).
- **Timeline dot**: the visual marker for an item; reflects that item's status through its styling and
  may hold custom content.
- **Timeline connector**: the line between an item and its next sibling; reflects whether that
  transition is completed; absent after the last item unless forced.
- **Timeline content / header / title / description / time**: composable body parts for an item's
  textual content, with `time` carrying a machine-readable timestamp alongside its display text.
- **Alternate side**: an item at an odd resolved index is placed on the alternate side (trailing under
  vertical orientation, top under horizontal orientation) and carries the alternate-side attribute;
  even-indexed items take the default side (leading under vertical, bottom under horizontal).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A screen reader user navigating a rendered timeline hears each event's position and the
  total event count, and hears the current step explicitly identified when an active index is set —
  without the developer adding any manual ARIA markup.
- **SC-002**: Changing a single `activeIndex` value on the root updates every item's completed/active/
  pending state and every connector's completed state correctly, for any in-range or out-of-range
  index, with no per-item prop required from the developer.
- **SC-003**: The identical item markup renders correctly across all four documented configurations —
  vertical default, horizontal default, vertical alternate, horizontal alternate — and mirrors correctly
  under a right-to-left page direction, without the developer writing orientation- or direction-specific
  markup.
- **SC-004**: A developer can go from the documented layout skeleton to a working timeline using only
  the shipped parts (dot, connector, content, header, title, time, description), with no bespoke
  markup required to reproduce any of the six upstream examples.
- **SC-005**: The component installs and renders through this project's own component registry the same
  way every other already-ported component does, requiring no manual post-install edits by the
  consumer.
- **SC-006**: Every upstream demo file has a working equivalent `<ComponentPreview>` on this project's
  docs page: **Default** (`timeline-demo.tsx`), **Horizontal** (`timeline-horizontal-demo.tsx`), **RTL**
  (`timeline-rtl-demo.tsx`), **Alternate** (`timeline-alternate-demo.tsx`), **Horizontal Alternate**
  (`timeline-horizontal-alternate-demo.tsx`) and **Custom Dot** (`timeline-custom-dot-demo.tsx`).

## Assumptions _(mandatory)_

- **Upstream variant chosen**: two near-identical upstream implementations exist —
  `docs/registry/bases/radix/ui/timeline.tsx` (built on `radix-ui`'s `Direction`/`Slot` primitives) and
  `docs/registry/bases/base/ui/timeline.tsx` (the registry-only, dependency-free variant). Neither
  underlying React primitive library (`radix-ui`) is a dependency of this project. This port follows
  the **`radix` variant's documented API**
  (`.reference/diceui/docs/content/docs/components/radix/timeline.mdx`, linked from the task
  description) as the canonical prop surface to translate, per CLAUDE.md §2's rule for components that
  exist under both `bases/base` and `bases/radix`; the two are functionally the same component (same
  props, same data attributes, same six demos), so no behaviour is lost by reading the `radix` copy as
  the source of truth.
- **`asChild` → `child` snippet**: every part's `asChild` boolean escape hatch is replaced by a `child`
  snippet prop, matching this repository's existing convention (see `dialog-content.svelte` and
  CLAUDE.md §10: `asChild` / `Slot` → `child` snippet). This is a Svelte-idiomatic 1:1 behavioural
  replacement, not a capability drop; the default (non-`child`) render path keeps each part's default
  element (`div` for every part except `TimelineTime`, which defaults to `time`). For `TimelineItem` the
  `child` payload also carries the element-registration hook, because the item's DOM node is what feeds
  the live DOM-order collection (FR-006); a `child` item that does not attach it is unregistered, exactly
  as an upstream `asChild` item whose ref is not forwarded.
- **In-place reordering is out of scope (upstream parity)**: positions recompute when the set of
  registered items changes, not when already-mounted siblings are moved without remounting. This is
  upstream's own behaviour (its store notifies only from `onItemRegister`/`onItemUnregister`) and is
  carried over deliberately rather than silently fixed.
- **`DirectionPrimitive.useDirection` → project direction context**: upstream reads its `dir` prop
  through Radix's shared direction provider so a page-level `<DirectionProvider>` can supply a default.
  This project already has an equivalent ambient direction mechanism used by other ported/base
  components (bits-ui's direction context, consumed the same way `dir` is resolved elsewhere in this
  repo); `Timeline`'s `dir` prop resolves from that context when omitted, and otherwise the explicit
  prop wins — same contract as upstream, no new context introduced.
- **Store (`React.useSyncExternalStore` + a `Map` of item refs) → a `TimelineState` class**: upstream's
  hand-rolled pub/sub store exists solely to let `TimelineItem`/`TimelineConnector` read each item's
  live DOM-order position without prop-drilling an index. This is ported as a single `TimelineState`
  class in `timeline.svelte.ts`, holding a reactive `$state` array of registered item elements (keyed
  by a per-item id), with `register`/`unregister` methods mutating that array and `$derived` helpers
  recomputing sorted DOM order — Svelte's fine-grained reactivity replaces `useSyncExternalStore`, and
  the `compareDocumentPosition` sort is kept verbatim (it is a DOM API, not React-specific), since it is
  the only way to know true rendered order.
- **`useId()` → item id fallback**: upstream falls back to `React.useId()` when the consumer does not
  pass an explicit `id` to `TimelineItem`, purely to key the internal store's `Map`. The Svelte port
  uses `$props.id()` for the same internal key (falling back to it only when no `id` prop is supplied),
  matching CLAUDE.md §10's `useId()` → `$props.id()` translation; the visible `id` attribute behaviour
  (consumer-supplied `id` wins, otherwise the generated one is used) is preserved.
- **`useIsomorphicLayoutEffect` → `$effect`**: upstream registers/unregisters each item with the store
  in a layout effect purely so the store has the item's DOM node before its position is read via
  `compareDocumentPosition`. Svelte mounts synchronously and an `$effect` runs after this item's own
  element is attached to the DOM; a plain `$effect` (not `$effect.pre`, which would run before this
  item's own element exists) with a teardown that unregisters is the direct equivalent, per CLAUDE.md
  §10.
- **CSS custom properties kept as documented**: `--timeline-dot-size` (default `0.875rem`) and
  `--timeline-connector-thickness` (default `0.125rem`) are reproduced verbatim as component-scoped
  custom properties set on the root, exactly as upstream documents them, so consumers can override
  either without touching component internals.
- **Accessibility posture beyond upstream's own documented baseline**: upstream already documents
  `role="list"` on the root, `role="listitem"`/`aria-current="step"` on the active item, and
  `aria-hidden="true"` on connectors — this matches the WAI-ARIA Authoring Practices baseline
  for a linear, non-interactive step sequence (there is no dedicated APG "timeline" pattern; a
  read-only ordered list with a current-item indicator is the correct minimal pattern for
  non-interactive chronological content, so no additional roles or keyboard handling are added beyond
  what upstream ships). No part requires keyboard navigation, because timeline items are not
  individually focusable or interactive by default — matching upstream, which ships no keyboard handler
  for the timeline itself.
- **Additional `data-*` state attributes**: Constitution Principle VIII requires every piece of
  component state to be exposed as a `data-*` attribute. Upstream already exposes
  `data-slot`/`data-orientation`/`data-variant` (root), `data-slot`/`data-status`/`data-orientation`/
  `data-alternate-right` (item), `data-slot`/`data-status`/`data-orientation` (dot), `data-slot`/
  `data-completed`/`data-status`/`data-orientation` (connector) and `data-slot` (content, header, title,
  description, time) — this is already a complete state surface per part, so no additional attributes
  are introduced beyond upstream's own; this assumption exists only to record that the audit was
  performed.
- **Native list semantics instead of `<div role="list">`**: upstream renders the root as a `<div>` with
  `role="list"` and each item as a `<div>` with `role="listitem"`. This port renders a real `<ol>` and
  `<li>`, because native list semantics are what make a screen reader announce an item's position and
  the total count (SC-001) rather than relying entirely on an author-supplied role. The explicit
  `role="list"` / `role="listitem"` attributes are **kept** alongside the native elements — they are
  part of the documented upstream contract, they keep the `child` escape hatch correct when a consumer
  renders a `<div>`, and they defend against the Safari/VoiceOver behaviour where the `list-style: none`
  that Tailwind's preflight applies to every `<ol>` strips list semantics. `list-none` is added
  explicitly to the root's base classes for the same reason.
- **`aria-orientation` dropped from the root**: upstream sets `aria-orientation` on its `role="list"`
  root. ARIA does not support `aria-orientation` on `role="list"`, and Svelte's compiler emits
  `a11y_role_supports_aria_props` for it in every spelling — which this project's Quality Gates forbid
  and Principle VI forbids suppressing (no `svelte-ignore`). The attribute is therefore omitted;
  `data-orientation="vertical" | "horizontal"` on the root carries the same information and is the
  documented consumer hook.
- **Logical instead of physical layout utilities in the alternate variant**: upstream's `alternate`
  compound variants use physical CSS utilities (`-right-[…]`, `-left-[…]`, `left-3`, `pr-6`, `pl-6`,
  `ml-auto`, `text-right`), so its alternate layout does **not** mirror under `dir="rtl"` despite its
  own documentation claiming full RTL support. Each is replaced by its logical counterpart (`-end-[…]`,
  `-start-[…]`, `start-3`, `pe-6`, `ps-6`, `ms-auto`, `text-end`); upstream's `default` variants already
  used logical `start-*` and are unchanged. Under `dir="ltr"` every logical utility computes to the
  identical physical value, so this is a zero-visual-change substitution for LTR consumers and a
  correctness fix for FR-004 and SC-003.
- **`dateTime` accepted alongside native `datetime`**: upstream's `<time>` prop is React's camelCase
  `dateTime`, while `svelte/elements` types the attribute as the native lowercase `datetime`.
  `TimelineTime` accepts both — an explicit `dateTime` prop for upstream parity, emitted as the native
  `datetime` attribute, with a caller-supplied native `datetime` taking precedence. No capability is
  added or removed; only the spelling surface widens.
- **Registry dependency**: the component depends on no npm package beyond `tailwind-variants` (already
  a repo dependency, used for `tv()`), and on `bits-ui` not at all. Direction resolution composes the
  already-ported in-repo `direction-provider` item's `useDirection()` reader rather than re-deriving
  direction or adding a dependency, so the registry entry declares
  `registryDependencies: ["direction-provider"]` — the same bare-item-name convention the existing
  `stat` entry uses for `separator` — and `dependencies: ["tailwind-variants"]`, matching the `status`
  entry.
- **Scope boundary**: only the `radix`-documented variant described above is ported; the separate
  `base` (Base UI) implementation under `docs/registry/bases/base/ui/timeline.tsx` is not read as a
  second source of truth, per the upstream-variant-chosen assumption above.
