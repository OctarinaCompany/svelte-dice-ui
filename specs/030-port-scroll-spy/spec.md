# Feature Specification: Scroll Spy

**Feature Branch**: `030-port-scroll-spy`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Scroll Spy\" (slug: scroll-spy) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Navigate a page with links that track scroll position (Priority: P1)

A person reads a long document (docs page, article, changelog) that has a navigation list of
section links alongside the content. As they scroll through the content — whether by mouse wheel,
trackpad, keyboard, or scrollbar drag — the link matching whichever section is currently at the top
of the view highlights itself automatically, with no click required.

**Why this priority**: This is the entire reason the component exists — passive, scroll-driven
navigation highlighting. Without it there is no independently useful component.

**Independent Test**: Render a navigation list of links next to a set of labelled content sections,
simulate the content sections intersecting the viewport in turn, and confirm the link matching the
topmost intersecting section is marked active while every other link is marked inactive.

**Acceptance Scenarios**:

1. **Given** a page with a navigation list and several content sections, **When** the page first
   renders, **Then** the link for the initial or default active section is marked active and every
   other link is marked inactive.
2. **Given** the user scrolls the tracked area so a different section becomes the topmost visible
   one, **Then** that section's link becomes active and the previously active link becomes
   inactive, without any click.
3. **Given** more than one tracked section is simultaneously visible, **Then** the link for
   whichever of them is closest to the top of the tracked area is the one marked active.

---

### User Story 2 - Click a link to jump straight to its section (Priority: P1)

A person clicks (or activates via keyboard) a navigation link. Instead of the browser's default
jump-to-anchor behaviour, the page scrolls smoothly to the corresponding section, and that link
becomes active immediately — it does not wait for the scroll to finish and does not flicker through
whichever sections happen to pass by on the way.

**Why this priority**: Click-to-navigate is the other half of the component's core value and is
demonstrated in every upstream example; a scroll-spy that only reacts passively but cannot be
driven by its own links would be an incomplete port.

**Independent Test**: Render the navigation and sections, click a link for a section other than the
currently active one, and confirm: the browser's default navigation is suppressed, the clicked
link's associated action fires, that link becomes active, and — while the resulting scroll is still
settling — passing scroll-position updates do not steal activation away from the clicked link.

**Acceptance Scenarios**:

1. **Given** a link for an inactive section, **When** the user clicks (or presses Enter while it
   is focused), **Then** default link navigation is suppressed, the section is scrolled into view,
   and the link becomes active immediately. `Space` is not intercepted (see FR-019 and Assumptions).
2. **Given** a click-triggered scroll is still in progress, **When** intermediate sections
   intersect the viewport during that scroll, **Then** they do not override the clicked section's
   active state until the programmatic scroll has settled.
3. **Given** a link has its own click handler supplied by the integrator, **When** the user clicks
   it, **Then** that handler runs in addition to the built-in navigation behaviour.

---

### User Story 3 - Control which section is active from outside the component (Priority: P2)

A person building a page (for example one with a "back to top" control, a tabbed table of
contents, or state synced to the URL) wants to set and read the active section themselves, rather
than always trusting the passive scroll observer.

**Why this priority**: Documented as the "Controlled State" example and needed for integrations
that must synchronize scroll-spy state with something else, but the component is fully usable
without an external controller (User Stories 1-2 cover the uncontrolled default).

**Independent Test**: Render the component with an externally owned active-section value and a
change callback; update the external value and confirm the corresponding link becomes active and
the page scrolls to that section; trigger a click on a different link and confirm the change
callback is notified with the new value.

**Acceptance Scenarios**:

1. **Given** an externally supplied active-section value, **When** that value changes, **Then**
   the matching link becomes active and the page scrolls to the matching section.
2. **Given** an externally supplied active-section value, **When** the user clicks a different
   link, **Then** the change callback fires with the new section identifier and the displayed
   active state waits for the external value to update rather than changing on its own.

---

### User Story 4 - Lay out navigation and content vertically or horizontally (Priority: P3)

A person building a page chooses whether the navigation list runs alongside vertically-stacked
content (a sidebar table of contents) or above horizontally side-scrolling content (a tab-like
strip). Both layouts get the same tracking and click-to-navigate behaviour.

**Why this priority**: Demonstrated as its own upstream example and affects layout classes and
layout-facing state, but it is a configuration of User Stories 1-2 rather than new tracking
behaviour.

**Independent Test**: Render the component with the alternate orientation setting and confirm the
layout-facing state attribute switches accordingly and both passive tracking and click-to-navigate
still work.

**Acceptance Scenarios**:

1. **Given** the component is configured for vertical orientation, **Then** its parts expose that
   orientation as inspectable state and lay out accordingly.
2. **Given** the component is configured for horizontal orientation (the default), **Then** its
   parts expose that orientation as inspectable state and lay out accordingly.

---

### Edge Cases

- No content section is currently intersecting the tracked area (e.g. between sections, or all
  sections are shorter than the viewport): the previously active link stays active rather than
  clearing to nothing.
- A section identifier used by a link has no matching content section (yet, or ever): clicking that
  link still records it as the active value so external state stays consistent, even though there
  is nothing to scroll to.
- Two links point at the same section identifier, or two content sections share an identifier:
  behaviour is undefined beyond "the last registered section wins" — this mirrors upstream's plain
  keyed-map registration and is not a case the component needs to guard against.
- The tracked scroll area is an explicit container element rather than the whole page: position
  tracking, offset calculation and the programmatic scroll all resolve relative to that container,
  not the window.
- The user has requested reduced motion at the operating-system level: the default scroll-to-section
  behaviour is instant rather than smoothly animated, unless the integrator explicitly overrides the
  scroll behaviour.
- The component (or an individual section) is removed from the page while a section is still being
  tracked: no error is raised and no further updates are attempted for the removed section.
- Right-to-left reading direction: the navigation's layout direction is honoured, consistent with
  how the rest of the component set resolves direction, and no left-to-right assumption leaks into
  measurement or scrolling math.
- Rapid repeated clicks on different links before any scroll settles: each click's active state
  takes precedence over the last, and only the most recently clicked section's settle timeout
  ultimately re-enables passive tracking.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST track, for a configurable set of content sections, which one is
  currently the topmost intersecting the visible (or configured) tracked area, and MUST expose that
  section's identifier as the single active value shared by every part.
- **FR-002**: The component MUST update the active value automatically as the user scrolls,
  without requiring any click, using a visibility threshold and margin around the tracked area that
  are both configurable by the integrator.
- **FR-003**: Every navigation link MUST expose, as inspectable state, whether it corresponds to
  the current active value ("active") or not ("inactive"), and MUST additionally expose that state
  to assistive technology by marking the active link as the current location (`aria-current`),
  absent on inactive links. The assistive-technology marking is additive to upstream (which exposes
  the state only for styling) and is required by Constitution Principle III; it renames and removes
  nothing from the upstream API.
- **FR-004**: Clicking (or activating via keyboard) a navigation link MUST: suppress the browser's
  default link-navigation behaviour, set the active value to that link's section, and smoothly
  scroll the tracked area so the corresponding section comes into view at the configured offset.
- **FR-005**: While a link-triggered scroll is settling, passive scroll tracking MUST NOT override
  the active value that the click just set, so intermediate sections passed during the scroll do
  not steal activation.
- **FR-006**: An integrator-supplied click handler on a link MUST still run when that link is
  activated, in addition to the component's built-in navigate-and-activate behaviour.
- **FR-007**: The active value MUST be usable both as an uncontrolled default (seeded once, then
  managed internally) and as a fully controlled value (owned externally, with every change —
  whether from a click or from passive tracking — reported through a change notification).
- **FR-008**: The component MUST support tracking either the whole page's scroll position or a
  specific scrollable container element supplied by the integrator; all position measurement and
  programmatic scrolling MUST resolve relative to whichever is configured.
- **FR-009**: The component MUST support both a horizontal and a vertical orientation, exposing the
  chosen orientation as inspectable state on every part, with layout adjusting accordingly.
- **FR-010**: The component MUST let the integrator configure the scroll behaviour used for
  click-triggered navigation (e.g. smooth or instant), defaulting to an instant jump when the
  user's operating system has requested reduced motion and to a smooth scroll otherwise.
- **FR-011**: The component MUST let the integrator configure a pixel offset applied when
  calculating both the topmost-intersecting-section threshold and the click-triggered scroll
  destination, so a fixed header or similar overlap can be compensated for.
- **FR-012**: A content section with no identifier, or whose identifier is falsy, MUST NOT be
  registered for tracking and MUST NOT be able to become the active value through passive scrolling
  (it may still be set as the active value directly, per the edge case above).
- **FR-013**: Each navigation link MUST render as (or be paired with) a standard link element whose
  href targets its section's identifier, so it remains a normal, accessible, keyboard-focusable
  link independent of the component's own behaviour.
- **FR-014**: Attempting to use a navigation link, a content section, the navigation container, or
  the viewport container outside of a scroll-spy instance MUST fail with a clear, documented error
  identifying both the part and the required parent.
- **FR-015**: Right-to-left reading direction MUST be supported, consistent with how the rest of
  the component set resolves direction, with no measurement or scroll-direction assumption tied to
  left-to-right layout.
- **FR-016**: The navigation container, the navigation link, the viewport container, and the
  content section MUST each support rendering the caller's own element in place of the default one,
  receiving the component's merged attributes, so the markup can be substituted without losing
  behaviour (upstream `asChild`).
- **FR-017**: The component and its parts MUST be distributed as installable source through the
  project's own component registry, with a documented usage example for every behaviour above,
  including at minimum: the default horizontal layout, the vertical layout, and the controlled
  active-value example.
- **FR-018**: The visibility-tracking mechanism used for passive activation MUST be established and
  torn down cleanly whenever the set of tracked sections changes or the component is removed from
  the page, leaking no observers, timers, or pending animation-frame callbacks.
- **FR-019**: The component MUST reproduce the upstream-documented keyboard interactions: `Tab` /
  `Shift+Tab` MUST move focus between navigation links in document order with a visible focus
  indicator; `Enter` on a focused link MUST activate it, producing exactly the FR-004 behaviour
  (default navigation suppressed, active value set, section scrolled into view at the configured
  offset). `Space` MUST NOT be intercepted — the browser's native page-scroll behaviour for anchors
  is preserved, which is a documented divergence from the upstream MDX keyboard table (see
  Assumptions).

### Key Entities

- **Scroll Spy (root)**: Owns the active section value (controlled or uncontrolled), the
  configuration (tracked area, offsets, threshold/margin, orientation, scroll behaviour), and the
  registry of known content sections.
- **Scroll Spy Nav**: The navigation container that groups the links; a `navigation` landmark, so it
  MUST accept and forward an accessible name (`aria-label`/`aria-labelledby`) and every documented
  example MUST supply one, since a page may contain several.
- **Scroll Spy Link**: A single navigation entry bound to one section identifier; knows whether it
  is the active one and triggers navigate-and-activate on click.
- **Scroll Spy Viewport**: The container for the tracked content sections; purely a layout concern
  unless it is also designated as the scrollable tracked area.
- **Scroll Spy Section**: A single piece of tracked content, identified by the same value a link
  targets; registers and unregisters itself for visibility tracking.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Scrolling through a tracked page always shows exactly one navigation link marked
  active, matching the section currently at the top of the visible tracked area, with no
  perceptible lag or flicker between sections.
- **SC-002**: Clicking any navigation link brings its section into view and marks that link active
  immediately, with zero incorrect intermediate activations while the resulting scroll is settling.
- **SC-003**: 100% of the upstream component's documented props, callbacks, and data attributes are
  reproduced, and covered by automated tests wherever the test environment can observe them;
  intersection-driven activation (SC-001) is verified by simulating intersection entries directly,
  since the automated test environment does not perform real layout or scrolling.
- **SC-004**: All three documented usage examples from the upstream documentation page (default
  horizontal layout, vertical orientation, controlled active state) are reproduced as working demos
  with no regressions in existing ported components.
- **SC-005**: The component behaves correctly, with no measurement or navigation-direction defects,
  when the surrounding layout is right-to-left.

## Assumptions

- **Reference variant**: upstream ships a "base" flavour (Radix `Primitive`/`Slot`-free, built
  directly on plain elements) and a "radix" flavour (adds `Direction`/`Slot` from `radix-ui`) of
  this component; both are behaviourally identical. This port targets the documented behaviour of
  both, since they are observably the same, using this project's existing `asChild`-via-`child`-
  snippet and direction-context conventions (`CLAUDE.md` §10) rather than depending on either
  upstream flavour directly.
- **Visibility tracking mechanism**: upstream's passive activation is implemented with the
  browser's `IntersectionObserver`. That has no bits-ui or existing project equivalent to compose,
  so it is implemented directly, per `CLAUDE.md` §4's guidance to use `IntersectionObserver` inside
  an `$effect` with teardown. The observer wrapper is extracted into its own module (in
  `<slug>.svelte.ts`) rather than inlined in the root component, specifically so the not-yet-ported
  `tour` component (which needs the same "is this element the topmost visible one" primitive) can
  import and reuse it instead of re-deriving it — mirroring how `scroller`'s
  `scroll-position.svelte.ts` was already deliberately built standalone for this same reason.
- **Scroll-position and offset math**: the pixel-offset scroll-to-section calculation and the
  scrollable-container-vs-window branching reuse this project's existing `scroller` scroll-metrics
  utilities (`readScrollMetrics`, and the container/window distinction already solved there) rather
  than re-deriving container/window scroll arithmetic from scratch, per Principle IV
  (Composition Over Reimplementation).
- **Reduced-motion default**: upstream derives its default `scrollBehavior` from
  `window.matchMedia("(prefers-reduced-motion: reduce)")` at first render. This is preserved
  verbatim; the assumption recorded is that jsdom's `matchMedia` (mocked in this project's test
  setup) returns `matches: false` unless a test explicitly overrides it, matching upstream's own
  test file.
- **"Is scrolling" suppression window**: upstream uses a fixed 500ms timeout after a
  click-triggered scroll starts, during which passive `IntersectionObserver` updates are ignored
  (FR-005). This fixed duration is preserved verbatim rather than made configurable, since upstream
  does not expose it as a prop.
- **`asChild` polymorphism**: upstream's `asChild` prop (Radix `Slot`) on the root, nav, link,
  viewport and section parts has no direct Svelte equivalent; per `CLAUDE.md` §10 this becomes an
  optional `child` snippet on each of those parts, preserving the capability to render a different
  underlying element while keeping the component's merged props and behaviour.
- **Direction resolution**: upstream reads `dir` through Radix's `Direction.useDirection`, which
  falls back to a document-level `DirectionProvider`. This project's own `direction-provider`
  component (already ported) is composed for the same fallback behaviour, per Principle IV.
- **Store-based reactivity**: upstream's internal `useSyncExternalStore`-backed store (used so
  every link only re-renders when its own active/inactive state flips) has no meaning in Svelte's
  fine-grained reactivity model; the equivalent behaviour — the active value being read reactively
  wherever it is used, without extra plumbing — falls out naturally from a `.svelte.ts` state class
  and `$derived`, per `CLAUDE.md` §4, and is not treated as a capability to reproduce structurally.
- **Scope boundary**: only the "Scroll Spy" component itself is in scope. No other component listed
  in `scripts/components.json` (including the not-yet-ported `tour`) is touched by this port beyond
  exporting the reusable observer wrapper described above for `tour` to import later.
- **`Space` does not activate a link (upstream MDX divergence)**: the upstream MDX keyboard table
  lists `Space` as activating the focused navigation link, but the upstream source adds no
  `onKeyDown`/`onKeyUp` handler anywhere, and HTML activation behaviour for `<a href>` is triggered
  by `Enter` only — the MDX table describes button semantics. This port therefore implements no
  `Space` handler (parity with the upstream *source*), preserves the browser's native page-scroll
  affordance for `Space`, and asserts in tests that `Space` leaves the active value unchanged.
  Callers who need `Space` activation render a `<button>` through the `child` snippet, which gets it
  from the platform. Recorded per Principle II; see research.md R-08.
- **Visibility observer is re-established when the tracked section set changes**: upstream's observer
  effect depends only on `[offset, rootMargin, threshold, scrollContainer]` and reads a plain
  section-map ref, so a section mounted after the first layout effect is never observed. React masks
  this because child layout effects run before the parent's; Svelte guarantees no such ordering. The
  section registry therefore exposes a reactive version counter that the root's `$effect` reads, so
  adding or removing a section disconnects and re-observes. Behaviour-preserving for static content,
  a fix for conditionally rendered sections, and required by FR-018. Recorded per Principle II; see
  research.md R-03 / divergence D-1.
