# Feature Specification: Scroller

**Feature Branch**: `012-port-scroller`

**Created**: 2026-07-30

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Scroller\" (slug: scroller) to this
SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Scroll a long list with clear edge cues (Priority: P1)

A developer wraps a long or overflowing block of content (a card list, a settings panel, a table) in the
component so it becomes independently scrollable within a fixed-size area. As the user scrolls, a soft
shadow/fade appears at whichever edge still has more content hidden beyond it, and disappears once that
edge is fully scrolled into view, so the user always has a visual cue of how much more content exists in
each direction without needing a scrollbar to be visible.

**Why this priority**: This is the core reason the component exists — a self-contained scrollable region
with edge-aware affordances. Every other capability (hidden scrollbar, navigation buttons) is a refinement
of this same base case, so a consumer can ship value with just this behaviour.

**Independent Test**: Render the component around content taller than its container and confirm (a) the
container scrolls independently of the page, (b) a bottom edge cue is present before scrolling and a top
edge cue appears once scrolled down, and (c) both cues disappear once the content is scrolled to its
respective boundary.

**Acceptance Scenarios**:

1. **Given** a vertical scroller with content taller than its container, **When** it first renders at the
   top, **Then** only the trailing (bottom) edge cue is present.
2. **Given** the same scroller scrolled to somewhere in the middle of its content, **When** the scroll
   position is read, **Then** both the leading (top) and trailing (bottom) edge cues are present
   simultaneously.
3. **Given** the same scroller scrolled all the way to the bottom, **When** the scroll position is read,
   **Then** only the leading (top) edge cue is present.
4. **Given** content that is shorter than or equal to the container's size, **When** it renders, **Then**
   neither edge cue is present because there is nothing to scroll.

---

### User Story 2 - Navigate with dedicated buttons instead of a scrollbar or drag gesture (Priority: P2)

A user who cannot or prefers not to use a trackpad/scrollbar/touch gesture (e.g. a mouse-only user facing a
touch-oriented layout, or someone who wants larger, more discoverable controls) clicks, presses-and-holds,
or hovers a directional button placed over the scrollable area to move its content, without needing to
target the scrollbar or perform a drag/swipe.

**Why this priority**: Navigation buttons are an explicit, documented opt-in capability that meaningfully
broadens who can operate the component, but the component is fully usable via native scrolling without
them, so this ranks below the base scrolling behaviour.

**Independent Test**: Render the component with navigation enabled around content that overflows in one
direction and confirm (a) only the button(s) pointing toward remaining content are shown, (b) clicking a
button moves the content by the configured step, (c) press-and-hold repeats the scroll continuously until
released, and (d) hovering repeats the scroll continuously while the pointer remains over the button when
that trigger mode is selected.

**Acceptance Scenarios**:

1. **Given** a scroller with navigation enabled and content that overflows only toward the end, **When**
   it renders, **Then** only the "toward end" button is shown, not the "toward start" button.
2. **Given** navigation buttons in the default trigger mode, **When** a user presses and holds a button,
   **Then** the content scrolls continuously in that direction until the pointer is released or leaves the
   button, at which point scrolling stops immediately.
3. **Given** navigation buttons configured for the hover trigger mode, **When** a user hovers a button
   without pressing it, **Then** the content scrolls continuously while the pointer remains over the
   button and stops the instant the pointer leaves.
4. **Given** navigation buttons configured for the click trigger mode, **When** a user clicks a button
   once, **Then** the content scrolls by exactly one configured step and no further, requiring a new click
   to scroll again.
5. **Given** the user scrolls the content (by any means) past the point where a direction is exhausted,
   **When** the scroll position updates, **Then** the corresponding navigation button is removed, and it
   reappears once content in that direction becomes available again.

---

### User Story 3 - Adapt orientation, hidden scrollbar, and RTL layout to the surrounding page (Priority: P3)

A developer switches the component to scroll horizontally instead of vertically for a card carousel or
filmstrip layout, optionally hides the native scrollbar affordance while keeping the area fully scrollable
(e.g. via touch, wheel, or the navigation buttons), and places it inside a right-to-left page, where the
edge cues and any navigation buttons still refer to the correct visual start/end of the content.

**Why this priority**: These are documented, real capabilities and are required for full parity, but they
are refinements of the same scrolling/edge-cue behaviour covered by User Story 1, so a consumer already
gets core value without them.

**Independent Test**: Render the component with `orientation="horizontal"` around content wider than its
container and confirm it scrolls horizontally with leading/trailing edge cues on the left/right instead of
top/bottom; separately, render it with the scrollbar hidden and confirm scrolling still works by wheel and
by the navigation buttons; separately, render it under a right-to-left ambient direction and confirm the
edge cues and navigation buttons reflect the RTL-correct start/end of the content.

**Acceptance Scenarios**:

1. **Given** `orientation="horizontal"`, **When** the scroller renders with content wider than its
   container, **Then** it scrolls along the horizontal axis and the edge cues appear on the left/right
   edges instead of the top/bottom edges.
2. **Given** the scrollbar-hiding option is enabled, **When** the component renders, **Then** the native
   scrollbar affordance is not visually shown, but the content remains fully scrollable by wheel, touch,
   (if enabled) the navigation buttons, and — once the consumer forwards `tabindex`, `role` and an
   accessible name — the keyboard.
3. **Given** an ambient right-to-left direction (from the project's shared direction context) and
   `orientation="horizontal"`, **When** the user scrolls toward the start of the content, **Then** the
   edge cue and navigation button that represent "more content toward the start" appear on the
   RTL-correct (right) side rather than the left.

---

### Edge Cases

- What happens when the container's content exactly fills the container with no overflow? No edge cues are
  shown in that axis and no navigation buttons are shown for that axis, even if navigation is enabled.
- What happens when both ends of the scrollable axis have hidden content at once (content longer than the
  configured shadow-size offset on both sides)? Both edge cues are shown together with a combined mask so
  the fade is continuous across both open edges, rather than two independent fades overlapping oddly.
- What happens when a non-zero `offset` is configured? A leading or trailing edge cue, and the leading
  navigation button, only appear once the hidden content on that side exceeds the offset; the trailing
  navigation button ignores the offset and appears whenever any hidden content remains in that direction
  (upstream's asymmetry, pinned by test rather than "fixed").
- What happens when the container or its content is resized at runtime (window resize, content added or
  removed, images loading)? The edge cues and navigation button visibility recompute without a page reload
  or explicit consumer action.
- What happens when navigation is disabled? No navigation buttons render regardless of scroll position, and
  the `scrollStep`/trigger-mode settings have no effect.
- What happens when a press-and-hold or hover-triggered scroll reaches the end of the content while still
  held/hovered? The button for that direction disappears (per User Story 2, Acceptance Scenario 5) and any
  in-progress continuous scroll for that direction stops since there is nothing left to scroll toward.
- What happens when the component is unmounted while a press-and-hold or hover scroll is in progress? The
  continuous-scroll timer is cleared so it cannot fire against a removed element.
- What happens when a consumer wants to render the scrollable behaviour onto their own element instead of
  the component's default container? The component supports rendering its behaviour, attributes, and
  styling onto a caller-provided child element instead of its own default element.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST render a container that becomes independently scrollable along a
  configurable orientation (`vertical`, default, or `horizontal`) once its content exceeds the container's
  size in that direction.
- **FR-002**: The component MUST detect, on initial render and on every scroll or resize of the container
  or its content, whether hidden content exists toward the start and/or the end of the scroll axis, and
  expose that state so a leading and/or trailing edge-fade visual cue can render accordingly; when hidden
  content exists on both ends simultaneously the applied visual treatment MUST be a single continuous fade
  rather than two independently-overlapping ones.
- **FR-003**: The component MUST support a configurable pixel size for the edge-fade cue and a configurable
  pixel offset, each with the same default values as upstream (size 40px, offset 0px). The offset MUST gate
  the leading edge cue, the trailing edge cue and the leading navigation button, and MUST NOT gate the
  trailing navigation button — reproducing upstream's asymmetric predicates exactly, so with a 40px offset
  and 30px of hidden content remaining the trailing cue is absent while the trailing navigation button is
  still shown.
- **FR-004**: The component MUST support optionally hiding the native scrollbar affordance while the
  container remains fully scrollable by wheel, touch, the navigation buttons described in FR-005, and —
  once the consumer makes the container focusable by forwarding `tabindex`, `role` and an accessible name
  through FR-009's attribute pass-through — by keyboard.
- **FR-005**: The component MUST support an opt-in navigation mode that renders directional buttons (one
  pair for the active orientation: start/end) positioned over the scrollable container, each button
  visible only while hidden content exists in that direction (reusing the detection from FR-002) and
  hidden once that direction is fully scrolled into view.
- **FR-006**: Each navigation button MUST move the container's scroll position by a configurable step
  amount toward its direction, and MUST support three trigger modes: continuous scrolling while the button
  is pressed and held (default), continuous scrolling while the button is hovered, and a single step per
  discrete click — selectable via a single setting, with continuous modes stopping immediately when the
  press/hover ends or when the button is removed because its direction is exhausted.
- **FR-007**: The component MUST resolve its layout direction from the project's shared direction context
  (falling back to the ambient DOM direction, then left-to-right) and, for horizontal orientation, MUST
  report edge-cue and navigation-button visibility in terms of the content's visual start/end rather than
  a fixed left/right, so right-to-left layouts show the correct side.
- **FR-008**: The component MUST expose an escape hatch equivalent to upstream's `asChild`, so a consumer
  can render the component's scrollable behaviour, attributes, and styling onto a child element of their
  own choosing instead of the component's default container element.
- **FR-009**: The component MUST forward unrecognised attributes (including `class` and inline styles) to
  its rendered element, merging consumer-provided classes after the component's own classes so callers can
  always override layout, and MUST expose its scroll-edge state (start/end/both, per axis) as data
  attributes so consumers can style against it directly.
- **FR-010**: The scroll-position and overflow-detection logic MUST be implemented as a standalone,
  reusable module independent of this component's markup, so that other components in this project
  (a future scroll-spy component and a future tour component) can reuse the same detection logic without
  depending on this component's parts.
- **FR-011**: The component MUST be distributed as installable source under the project's UI component
  directory, with a public barrel export, and MUST be listed in the project's component registry so it can
  be installed the same way as any other first-party component.
- **FR-012**: A documentation page MUST exist that demonstrates every example shown on the upstream
  documentation page: the default vertical scroller, a horizontal scroller, a scroller with the scrollbar
  hidden, and a scroller with navigation buttons enabled.
- **FR-013**: Every navigation button MUST be operable without a pointer and MUST be identifiable by
  assistive technology: each button MUST be a real button element carrying a direction-specific accessible
  name ("Scroll up", "Scroll down", "Scroll left", "Scroll right"), its directional icon MUST be hidden
  from assistive technology, its focus indicator MUST remain visible, and the continuous trigger modes MUST
  start and stop from the keyboard — `Enter`/`Space` keydown starts and keyup/blur stops in the press
  mode, focus starts and blur stops in the hover mode, and a single `Enter` performs exactly one step in
  the click mode.

### Key Entities

- **Scroller**: The scrollable container. Owns the resolved orientation, hidden-scrollbar flag, edge-fade
  size and offset, navigation flag, scroll step, and navigation trigger mode; measures its own scroll
  position and size (and that of its content) to derive which edges currently have hidden content.
- **Scroll navigation button**: A directional (start/end) control rendered over the scroller when
  navigation is enabled and that direction currently has hidden content; moves the scroller's scroll
  position by the configured step using the configured trigger mode.
- **Scroll-edge detection state**: The reusable, non-visual result of measuring a scrollable element —
  which edges (start/end, per axis) currently have hidden content beyond the configured offset — shared
  between this component and future consumers of the same detection logic (FR-010).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer can make any block of overflowing content independently scrollable, with
  correct edge-fade cues, by wrapping it in the component with no additional scroll-position or
  overflow-detection code of their own.
- **SC-002**: 100% of the upstream component's documented props, data attributes, and interaction modes
  (press-and-hold, hover, click navigation) are reproduced and covered by automated tests.
- **SC-003**: The edge-cue and navigation-button visibility state recomputes synchronously within the same
  scroll, resize, or content-change notification that triggered it — no polling, and no stale cue left
  showing once its edge is fully scrolled into view.
- **SC-004**: Touch-only users can fully scroll, and, where navigation is enabled, fully operate the
  directional controls without a mouse. Keyboard-only users can fully operate the navigation controls
  without a mouse, and can scroll the container itself once the consumer makes it focusable by forwarding
  `tabindex`, `role` and an accessible name (FR-004, FR-009).
- **SC-005**: The documentation page exhibits all four upstream examples (default, horizontal, hidden
  scrollbar, navigation buttons), and each one visibly demonstrates its distinguishing behaviour.
- **SC-006**: The component installs through the project's own registry command in the same way as any
  other already-ported component, requiring no manual post-install steps beyond what the registry entry
  declares.
- **SC-007**: A scroller placed in a right-to-left page shows edge cues and navigation buttons on the
  content's true start/end sides in 100% of manual RTL checks against the horizontal-orientation demo.

## Assumptions

- **Only the Radix-flavoured upstream variant is ported.** Dice UI publishes both a `base` and a `radix`
  build of Scroller; the `radix` build is the one referenced by this task's upstream paths and is
  functionally identical to `base` (both wrap a plain `div`, the only difference being the `asChild`
  primitive used internally), so this port targets that one implementation rather than shipping two
  parallel components.
- **`asChild` becomes a `child` snippet.** React's `Slot`-based `asChild` has no direct Svelte 5
  equivalent; per this project's established translation table, the escape hatch in FR-008 is implemented
  as a typed `child` snippet, matching every other ported component's convention.
- **RTL handling is a divergence, added deliberately.** Upstream's source has no direction-awareness at
  all — it reads raw `scrollLeft`/`scrollWidth` and treats "left" and "right" as fixed physical sides, so a
  horizontal scroller under a right-to-left page would show edge cues and navigation buttons on the wrong
  side. Per this task's binding internationalisation requirement, this port resolves direction through the
  project's existing `direction-provider` context (the same primitive already composed by Marquee) and
  reinterprets "left/right" as "start/end" for cue and button visibility (divergence D-01, addition — no
  upstream behaviour is removed, only extended to be direction-aware).
- **Content-change observation is widened (divergence D-02, addition).** Upstream listens only to the
  container's `scroll` event and `window`'s `resize`; this port additionally observes the container and its
  element children with a `ResizeObserver` kept current by a `childList` `MutationObserver`, so late-loading
  or added/removed content recomputes the cues (FR-002, SC-003). For the same robustness reason
  `pointercancel` is added alongside upstream's `pointerup`/`pointerleave` as a stop trigger. Nothing
  upstream does is removed.
- **The navigation button's `data-slot` value is renamed (divergence D-03, rename).** Upstream emits
  `data-slot="scroll-button"`; this port emits `data-slot="scroller-button"`, and additionally exposes
  `data-slot="scroller-wrapper"` on the navigation wrapper plus `data-orientation`, `data-hide-scrollbar`,
  `data-direction` and `data-trigger-mode`, because the project's distribution model requires
  `data-slot="<slug>-<part>"` and every piece of state to be exposed as a `data-*` attribute. A consumer
  styling upstream's `[data-slot=scroll-button]` must update that one selector.
- **Navigation buttons gain keyboard operation (divergence D-04, addition).** Upstream wires `press` and
  `hover` modes to pointer events only and overrides `onClick` with a no-op, so a keyboard user activating a
  button does nothing. This port starts the repeat on `Enter`/`Space` `keydown` and stops it on
  `keyup`/`blur` in `press` mode, and starts/stops on `focus`/`blur` in `hover` mode; `click` mode is
  already keyboard-operable. No upstream behaviour is removed.
- **Navigation buttons gain an accessible name and a visible focus ring (divergence D-05, addition).**
  Upstream renders a bare `<button>` containing only a chevron `<svg>`, with no `aria-label` and no focus
  style. This port adds a direction-specific `aria-label` ("Scroll up"/"Scroll down"/"Scroll left"/"Scroll
  right"), `aria-hidden` on the icon, and a `focus-visible` ring.
- **An explicit `dir` prop is added (divergence D-06, addition).** Upstream has no direction prop. `dir` is
  the highest-priority input to the D-01 direction resolution (`dir` prop → nearest `<DirectionProvider>` →
  ancestor `[dir]` → `ltr`) and is inert for the vertical axis.
- **The reusable detection module (FR-010) is an internal `.svelte.ts` module, not a new public part.**
  Per this task's component-specific guidance, the scroll-position/overflow detection is factored out of
  the component's markup into its own module so `scroll-spy` and `tour` (both wave-3 ports) can import it
  directly; it is not itself listed in the component registry, since it is a shared implementation detail
  rather than an installable UI part (consistent with how `direction-provider` and other shared primitives
  are already organised in this project).
- **Continuous press/hover scrolling is implemented as a fixed-interval repeat**, matching upstream's
  documented behaviour (a timer re-invoking the scroll-by-step function), rather than a variable-speed or
  physics-based scroll, since upstream documents no acceleration curve.
- **The internal navigation-button sub-part is not exposed as a separately importable, styleable piece.**
  Upstream's `ScrollButton` is an unexported, internal function component; this port keeps it internal to
  the root component's implementation (rendered only through the `withNavigation` prop) rather than adding
  it to the public barrel, since upstream never documents it as an independent API surface.
- **Default prop values match upstream exactly**: `orientation="vertical"`, `hideScrollbar=false`,
  `size=40`, `offset=0`, `withNavigation=false`, `scrollStep=40`, `scrollTriggerMode="press"` — no defaults
  are changed by this port.
- **The scroll container is not focusable by default (divergence D-07, documented omission).** Upstream
  sets no `tabindex`, and adding one would create an unnamed focus stop on every scroller; keyboard
  scrolling of the container is therefore opt-in via forwarded `tabindex`/`role`/`aria-label`, which the
  navigation example on the documentation page demonstrates.
