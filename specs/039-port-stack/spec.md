# Feature Specification: Port Stack Component

**Feature Branch**: `039-port-stack`

**Created**: 2026-08-01

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Stack\" (slug: stack) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Browse a hover-expanding stack of cards (Priority: P1)

A developer drops a `Stack` of card-like items (e.g. notifications) into a page. Collapsed, the
items are visually stacked with only the front few peeking out, each slightly smaller and offset
behind the one in front. Hovering (or otherwise pointing at) the stack reveals every item, spaced
out with a gap, so the end user can read all of them; moving away collapses the stack back to its
resting state.

**Why this priority**: This is the component's entire reason to exist — the hover-expand
interaction is what upstream demonstrates as the primary example, and every other example is a
variation of it.

**Independent Test**: Render `Stack.Root` with `expandOnHover` and three `Stack.Item` children,
each with distinct text content. Verify the collapsed layout shows a `data-state="collapsed"` root
with items visually offset/scaled per index, then verify hovering sets `data-state="expanded"`,
un-offsets and un-scales the items, and that leaving the pointer restores the collapsed state.

**Acceptance Scenarios**:

1. **Given** a `Stack.Root` with `expandOnHover` and more items than the default visible count,
   **When** the pointer enters the stack, **Then** the root's expanded state attribute flips to
   expanded and every item becomes visible and un-scaled.
2. **Given** an expanded stack, **When** the pointer leaves the stack, **Then** the root returns to
   its collapsed state and items beyond the collapsed visible count return to reduced opacity and
   become non-interactive.
3. **Given** an expanded stack, **When** the pointer leaves the stack while a pointer button is
   still held down inside it (e.g. the user is dragging a text selection that started over an
   item), **Then** the stack stays expanded until the pointer is released.

---

### User Story 2 - Render a static stack with no hover interaction (Priority: P2)

A developer wants the purely visual stacked/cascaded card effect without any hover behaviour —
for example, as a decorative element that is always in its resting layout.

**Why this priority**: The second upstream example is dedicated to this variant, and it is the
default behaviour of the component (`expandOnHover` defaults to `false`), so it must work
correctly on its own without the developer opting into anything.

**Independent Test**: Render `Stack.Root` without `expandOnHover` (or with it explicitly `false`)
and confirm the stack never leaves its collapsed state, regardless of pointer events dispatched on
it.

**Acceptance Scenarios**:

1. **Given** a `Stack.Root` with `expandOnHover` omitted, **When** the pointer enters and moves
   over the stack, **Then** the root's state attribute remains collapsed and items keep their
   collapsed transform, scale and opacity.

---

### User Story 3 - Choose the direction items stack toward (Priority: P3)

A developer places a stack near the top of a container and wants items to cascade upward instead
of the default downward cascade, so the stack does not overflow the bottom of its container.

**Why this priority**: This is a configuration axis (the `side` prop) demonstrated in upstream's
third example; it changes visual orientation only and depends on User Story 1/2 already working.

**Independent Test**: Render two stacks side by side, one with `side="top"` and one with
`side="bottom"` (the default), and confirm each item's transform origin and translation direction
matches its configured side while every other behaviour (expand/collapse, scaling, item count)
stays identical between them.

**Acceptance Scenarios**:

1. **Given** a `Stack.Root` with `side="top"`, **When** rendered collapsed, **Then** each
   non-front item is translated upward (negative direction) from, and its origin anchored to, the
   top edge.
2. **Given** a `Stack.Root` with `side="bottom"` (the default, whether set explicitly or omitted),
   **When** rendered collapsed, **Then** each non-front item is translated downward from, and its
   origin anchored to, the bottom edge.

---

### Edge Cases

- **Fewer children than `itemCount`**: all items are visible and the collapsed layout degrades
  gracefully (no gaps, no crash) when there are fewer `Stack.Item` children than the configured
  collapsed `itemCount`.
- **`expandedItemCount` smaller than the total number of items**: expanding the stack reveals only
  that many items from the front; the remaining back items stay invisible and non-interactive even
  while expanded.
- **Zero or one child**: the stack renders without error; with one child there is nothing to
  cascade and no expand/collapse difference is visible.
- **Children added or removed at runtime**: the stack re-measures and re-lays-out items so indices,
  z-order and visibility stay consistent with the new child list.
- **`prefers-reduced-motion: reduce`**: expanding, collapsing and side changes apply instantly,
  with no animated transform/opacity/shadow transition.
- **`dir="rtl"`**: the stack's visual behaviour (cascade direction, hover expansion) is unaffected,
  because stacking only varies along the vertical axis; horizontal placement remains symmetric in
  both writing directions.
- **Pointer capture edge cases**: a `pointerdown` inside the stack followed by `pointerup` outside
  the stack still clears the "interacting" state so a subsequent pointer leave can collapse the
  stack.
- **Consumer overrides `onMouseEnter`/`onMouseLeave`/`onMouseMove`/`onPointerDown`/`onPointerUp`
  and calls `preventDefault()`**: the stack's own expand/collapse/interacting logic is skipped for
  that event, letting the consumer fully own the behaviour for that interaction.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The stack root MUST render its item children absolutely positioned within a
  relatively positioned container, each item scaled down and vertically offset in proportion to
  its position behind the front item, in collapsed state.
- **FR-002**: The stack root MUST support a `side` setting of `"top"` or `"bottom"` (default
  `"bottom"`) that controls both the edge items cascade from and the direction they translate
  toward when collapsed.
- **FR-003**: The stack root MUST support an `itemCount` setting (default `3`) controlling how many
  items — counted from the front — remain visible and interactive while collapsed; items beyond that
  count MUST be fully transparent and MUST NOT receive pointer interaction. While collapsed, each
  visible item MUST fade progressively with its distance from the front (front item fully opaque,
  each subsequent item 15% less opaque); while expanded, every visible item MUST be fully opaque.
- **FR-003a**: Items MUST be stacked front-to-back in painting order — the front item paints above
  every item behind it — for any number of children, and the order MUST update when children are
  added or removed.
- **FR-004**: The stack root MUST support an `expandedItemCount` setting controlling how many items
  — counted from the front — are visible while expanded; when not set, every child MUST be visible
  while expanded.
- **FR-005**: The stack root MUST support a `gap` setting (default `8`, in pixels) controlling the
  spacing between consecutive items while expanded.
- **FR-006**: The stack root MUST support a `scale` setting (default `0.05`) controlling how much
  smaller each subsequent item is scaled relative to the front item while collapsed.
- **FR-007**: The stack root MUST support an `offset` setting (default `10`, in pixels) controlling
  the vertical distance between consecutive items while collapsed.
- **FR-008**: The stack root MUST support an `expandOnHover` setting (default `false`). When `true`,
  pointer entry or movement over the root expands the stack, and pointer exit collapses it again
  unless the pointer is currently pressed down inside the stack.
- **FR-009**: The stack root MUST expose its expanded/collapsed state through **both** an enumerated
  state attribute (`expanded`/`collapsed`) and a boolean expansion attribute (`true`/`false`), so that
  both the selector the upstream source emits and the selector the upstream documentation publishes
  work against this port.
- **FR-010**: Each stack item wrapper MUST expose, at minimum, its position index, whether it is
  the front-most item, whether it is currently visible, and whether the stack is currently
  expanded, all through attributes consumers can select against.
- **FR-011**: `Stack.Item` MUST render as a self-contained card (rounded corners, border, background,
  padding, resting shadow that increases on hover) usable as the direct child of `Stack.Root`
  without any other required wrapper.
- **FR-012**: Both `Stack.Root` and `Stack.Item` MUST support rendering as a different underlying
  element/component supplied by the consumer, in place of their default container element, while
  preserving all state attributes and behaviour on the substituted element.
- **FR-013**: Both the stack root and each stack item MUST accept and forward standard container
  element attributes (including a caller-supplied `class`, merged after — never overriding — the
  component's own layout classes) and standard pointer/mouse event handlers, invoking any
  caller-supplied handler before applying its own expand/collapse logic, and skipping its own logic
  if the caller's handler calls `preventDefault()`.
- **FR-014**: All expand/collapse, scale and translation changes MUST be animated with a smooth,
  short transition by default, and MUST become instantaneous (no transition) when the user has
  requested reduced motion.
- **FR-015**: The stack's layout and interaction behaviour MUST be correct and unaffected by the
  ambient text direction (`ltr` or `rtl`).
- **FR-016**: The stack MUST recompute item layout (position, visible count, front item) whenever
  its children are added, removed or reordered, without requiring the consumer to force a remount.
- **FR-017**: The component MUST ship as installable source under this project's UI component alias
  directory with a public index barrel, and MUST be listed in this project's component registry so
  it can be installed the same way as any other first-party component.
- **FR-018**: A documentation demo page MUST exist exercising each of the three upstream examples:
  the default hover-expanding stack, the non-expanding static stack, and the side-by-side
  `side="top"` vs `side="bottom"` comparison.
- **FR-019**: Every item's content MUST remain reachable by assistive technology and by keyboard in
  both the collapsed and the expanded state: no item may be removed from the accessibility tree
  (`aria-hidden`) or from layout (`display: none`), and no `tabindex` may be applied to make focusable
  content inside an item unreachable. Items that are outside the visible count MAY be made visually
  transparent and non-interactive to pointer input only. The stack root MUST NOT claim an interactive
  ARIA role, because upstream assigns none and no WAI-ARIA pattern applies.
- **FR-020**: While expanded, the space between two consecutive items MUST remain part of the stack's
  hover region, so that moving the pointer from one expanded item to the next does not collapse the
  stack. This is achieved by each item wrapper rendering a `gap`-height bridge element on the side it
  cascades from, present only while expanded.
- **FR-021**: Rendering a stack item outside a stack root MUST throw immediately with an error naming
  both the part used and the provider required, rather than rendering in a broken, unpositioned state.

### Key Entities

- **Stack Item**: One child passed to `Stack.Root`, rendered through `Stack.Item` (or a substituted
  element). Carries a derived position index (front-to-back order among siblings, zero-based), a
  measured natural size (used to compute spacing while expanded), and derived visibility/front/
  expanded flags used for styling and interactivity.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer can add a working hover-expanding stack of at least three items to a page
  using only `Stack.Root` and `Stack.Item`, with no additional configuration, matching the default
  visual behaviour documented upstream.
- **SC-002**: Every prop, default value, data attribute and interaction documented for the upstream
  Stack component is reproduced and covered by an automated test, with zero undocumented
  behavioural differences.
- **SC-003**: Expand and collapse are driven by a declared CSS transition over transform and opacity
  (not an instant class swap) in default motion settings, and that transition is disabled — while the
  collapsed/expanded end state is preserved — when reduced motion is requested. Verified automatically
  by asserting the transition and `motion-reduce` utilities on the item wrapper and card, and the
  end-state attributes/custom properties in both states.
- **SC-004**: The component's layout and hover behaviour are visually and functionally identical
  whether the surrounding page is left-to-right or right-to-left.
- **SC-005**: The demo page presents all three upstream examples (default hover expansion, static
  no-expand stack, top/bottom side comparison) and each is interactive in the same way as upstream.
- **SC-006**: The component can be installed into a consuming project through this project's
  registry command, the same way every other existing component in this library can.

## Assumptions

- **Reference variant chosen**: Upstream ships two functionally-equivalent implementations of Stack
  — `docs/registry/bases/radix/ui/stack.tsx` (built on `radix-ui`'s `Slot`) and
  `docs/registry/bases/base/ui/stack.tsx` (built on `@base-ui/react`'s `useRender`/`mergeProps`).
  They differ only in how they implement the "render as a different element" escape hatch
  (`asChild` vs. a `render` prop); every prop, default, data attribute, layout and interaction
  calculation is identical. Per the task instructions the `radix` variant is treated as the primary
  reference; both collapse to the same Svelte port because this project already has one standard
  substitution mechanism (below).
- **`asChild` / `render` → `child` snippet**: Upstream's `asChild` (radix variant) and `render` prop
  (base variant) are both replaced by this project's existing `child` snippet convention (see
  CLAUDE.md §10 and `dialog-content.svelte`) on both `Stack.Root` and `Stack.Item`, matching how
  other ported components in this repository expose the same capability. This is a Svelte-idiomatic
  substitute, not a scope reduction — every attribute and state value upstream forwards to the
  substituted element is still made available to the snippet.
- **`class-variance-authority` → `tailwind-variants`**: Upstream's internal `stackItemWrapperVariants`
  (built with `cva`, varying on `side`, `isExpanded`, `isVisible`) is reproduced with `tv()` from
  `tailwind-variants`, declared in the module script of the component that owns the per-item
  wrapper, per CLAUDE.md §6. This is an internal implementation detail with no effect on the public
  API or documented variant axis (`side`).
- **Internal item wrapper is not a public part**: Upstream's `StackItemWrapper` is an internal,
  non-exported component that `Stack` uses to auto-wrap each child. It is not part of the public API
  (only `Stack`/`StackItem` are exported). Svelte cannot enumerate or wrap the children of a snippet,
  so the port cannot auto-wrap: instead each `Stack.Item` renders **both** elements upstream renders
  per child — the positioning wrapper (`data-slot="stack-item-wrapper"`) and the card
  (`data-slot="stack-item"`) — and self-registers with `Stack.Root` through context to obtain its
  document-order index. The emitted DOM, data attributes and layout formulas are unchanged, and the
  public surface stays exactly `Stack.Root` and `Stack.Item`.
- **Only `Stack.Item` children participate in the stack**: upstream wraps *every* valid element child
  (`React.Children.toArray(children).filter(React.isValidElement)`), including a bare `<div>`; here
  only a `Stack.Item` (or a `Stack.Item` rendered through its `child` snippet) is positioned by the
  stack, because self-registration is opt-in. Any other node inside `Stack.Root` is left untouched in
  normal flow.
- **Measured item sizes are keyed by a stable item id, not by index**: upstream stores
  `{ itemId: index, size }` with an `if (!existing)` reducer that never updates or removes an entry,
  so removing a child leaves a stale size attached to a now-different index. The port keys the
  measured natural size by the item's registration id and releases it on unmount — identical numbers
  for a static stack, correct numbers for a dynamic one (required by the "Children added or removed
  at runtime" edge case).
- **`pointerup` is also observed on `document`**: upstream listens for `onPointerUp` only on the root,
  so pressing inside the stack and releasing outside leaves its "interacting" flag stuck true and the
  stack can never collapse. While a pointer is held down inside the stack, the root additionally
  listens for `pointerup`/`pointercancel` on the document. Additive; no change to the documented API.
- **The root emits `data-expanded` as well as `data-state`**: the upstream MDX `DataAttributesTable`
  for `Stack.Root` documents `[data-expanded]` with values `["true", "false"]`, but the upstream source
  emits only `data-state`. Both are emitted so that the documented selector and the shipped selector
  both work.
- **Stale MDX prose names are not reproduced**: the MDX "Usage Notes" refer to `visibleItems` and
  `scaleFactor`; no such props exist in the upstream type contract. The real props `itemCount` and
  `scale` are used and no aliases are added.
- **No dedicated WAI-ARIA widget pattern applies**: Stack has no corresponding WAI-ARIA Authoring
  Practices pattern (it is a decorative, presentational cascading-cards layout, not a listbox,
  menu, tablist, or similar interactive widget) and upstream assigns it no interactive ARIA role.
  Accessibility parity is achieved by construction: every item stays in normal DOM flow at all
  times (never `display: none`, never `aria-hidden`), so assistive technology can reach every
  item's content regardless of the current hover/expand state; only pointer interaction and visual
  presentation are hover-driven, matching upstream exactly. No keyboard-triggered expand/collapse
  is added beyond upstream, because none is documented and there is no content that becomes
  unreachable without it.
- **RTL is a non-event for this component**: Stack only varies along the vertical axis (`side`:
  `"top"`/`"bottom"`); there is no horizontal cascade, no arrow-key navigation and no left/right
  variant to invert. RTL parity (constitution Principle III) is satisfied by using logical CSS
  properties (inline-start/inline-end) instead of physical `left`/`right` for the item wrapper's
  horizontal edges, so the existing direction context flips them automatically like every other
  ported component; no component-specific RTL logic is required.
- **`expandOnHover` default is `false`**: taken directly from the upstream type definition
  (`docs/types/radix/stack.ts`); the first upstream demo opts into `true` explicitly, but the
  component's own default leaves the stack static until a consumer asks for hover expansion.
  Reproduced as documented, not changed.
- **`expandedItemCount` "all items" default**: when left unset, the number of visible items while
  expanded equals the current number of `Stack.Item` children at render time (matching upstream's
  `expandedItemCount ?? childrenCount`), not a fixed literal — so it stays correct as children are
  added or removed.
- **Reduced-motion handling and animation tokens**: the transform/opacity/shadow transitions used
  for expand/collapse and side changes are declared as CSS custom properties and any required
  keyframes inside Tailwind's `@theme inline` block (not a plain `@theme` block), because per-item
  custom properties such as `--translate`/`--item-scale` only resolve on the actual element they
  are set on — publishing them from a plain `@theme` block instead exposes them only on `:root`,
  where they cannot vary per stack item, silently breaking the animation. `prefers-reduced-motion`
  is honoured by removing the transition duration (not the underlying transform/opacity end state),
  consistent with how motion-sensitive users still see the collapsed/expanded layout, just without
  the animated in-between frames.
- **Composition over reimplementation**: no existing project UI component or `bits-ui` primitive
  covers "measure children and lay them out as a scaled/offset absolute stack with hover
  expansion" — this is bespoke, purpose-built layout behaviour with no equivalent elsewhere in the
  project's dependencies, so it is implemented directly in a `<slug>.svelte.ts` state class per
  CLAUDE.md §4, exactly as upstream implements it directly in its own hook-free component body
  rather than via a shared `@diceui/shared` hook.
- **Scope boundary**: only the base (non-Radix-namespace-prefixed, i.e. not requiring the `radix-ui`
  npm package at runtime) rendering behaviour described above is ported; no `radix-ui` package
  dependency is introduced, since the `child` snippet substitution mechanism already used
  throughout this project replaces `Slot`-based composition without requiring that dependency.
