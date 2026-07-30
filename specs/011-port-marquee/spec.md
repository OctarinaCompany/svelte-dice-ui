# Feature Specification: Marquee

**Feature Branch**: `011-port-marquee`

**Created**: 2026-07-30

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Marquee\" (slug: marquee) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Continuously scroll a row of content (Priority: P1)

A developer renders a horizontal band of cards, logos, or announcements that scrolls continuously and
seamlessly — the moment one copy of the content scrolls off, an identical copy is already in place, so
the motion never stutters or shows a gap. The scroll speed is driven by the content's measured size so
it looks the same regardless of how much content is inside.

**Why this priority**: This is the entire reason the component exists — every other behaviour (autofill,
vertical orientation, RTL, pausing) is a variation on this same seamless-loop base case. Without it there
is nothing to ship.

**Independent Test**: Render the component with a handful of items inside a fixed-width container and
confirm (a) the content is duplicated so the loop has no visible gap, (b) the container exposes a
`marquee` role, and (c) the animation is disabled and content still renders in full when
`prefers-reduced-motion: reduce` is active.

**Acceptance Scenarios**:

1. **Given** a marquee with content narrower than its container, **When** it renders, **Then** the
   content region contains two adjacent copies of the children so the scroll loop is seamless.
2. **Given** a marquee with `autoFill` enabled and content narrower than its container, **When** it
   renders, **Then** enough copies of the children are duplicated to fill the container before the loop
   repeats.
3. **Given** a user with `prefers-reduced-motion: reduce`, **When** the marquee renders, **Then** the
   scrolling animation does not play and all content remains visible and readable.

---

### User Story 2 - Pause the scroll to read or interact with content (Priority: P2)

A user hovers their pointer over the scrolling content, or reaches it with the keyboard, in order to
read a card or interact with something inside before it scrolls away. The scrolling pauses immediately
and resumes when they stop hovering or move focus/pause-toggle away.

**Why this priority**: A marquee that cannot be paused is inaccessible to anyone who cannot read the
content within a single scroll pass (motor-impaired users, screen magnifier users, or simply someone who
wants to click a link inside a scrolling card). This is required for the component to be usable, not
just decorative.

**Independent Test**: Render the component with `pauseOnHover` and `pauseOnKeyboard` enabled, then (a)
hover the pointer over the content and confirm the animation stops, (b) move the pointer away and
confirm it resumes, (c) tab focus to the marquee and press Space and confirm the animation stops, and
(d) press Space again and confirm it resumes.

**Acceptance Scenarios**:

1. **Given** a marquee with `pauseOnHover` enabled, **When** the pointer hovers over its content,
   **Then** the animation pauses, and **When** the pointer leaves, **Then** the animation resumes;
   **When** keyboard focus moves into the marquee instead, **Then** the animation likewise pauses, and
   resumes when focus leaves.
2. **Given** a marquee with `pauseOnKeyboard` enabled, **When** it receives keyboard focus and Space is
   pressed, **Then** the animation pauses and the marquee shows a visible focus indicator; **When**
   Space is pressed again, **Then** the animation resumes.
3. **Given** a marquee with `pauseOnKeyboard` disabled, **When** a user tabs through the page, **Then**
   the marquee does not receive keyboard focus (it is not part of the tab order).

---

### User Story 3 - Adapt orientation, direction and edge fade to the layout (Priority: P3)

A developer places the marquee in a vertical panel (e.g. a scrolling testimonial column) instead of a
horizontal band, and/or the page is laid out right-to-left. The marquee scrolls in the requested
direction (left, right, top, or bottom) and, under RTL, a "left" or "right" marquee visually reverses so
it still reads in the correct direction for the ambient page direction. Optional edge overlays fade the
content into the background at the start and end of the scroll axis so items don't appear to end
abruptly.

**Why this priority**: Orientation, direction-awareness and edge fades are documented, real upstream
capabilities but are refinements of the same core loop — a consumer can ship value with just User Story
1 and 2 and add these afterwards.

**Independent Test**: Render the component with `side="top"` inside a fixed-height container and confirm
it scrolls vertically; separately, render it under an RTL direction context with `side="left"` and
confirm the animation direction is mirrored; separately, render it with an edge overlay on each end and
confirm each overlay renders as a decorative, non-interactive gradient at its configured side and size.

**Acceptance Scenarios**:

1. **Given** `side="top"` or `side="bottom"`, **When** the marquee renders, **Then** the scrolling axis
   is vertical and the container fills the available height rather than width.
2. **Given** an ambient right-to-left direction (from the project's shared direction context) and
   `side="left"`, **When** the marquee renders, **Then** the animation runs in the mirrored (RTL-correct)
   direction described by upstream.
3. **Given** an edge overlay configured with a `side` and a `size`, **When** it renders, **Then** it is
   positioned at that side, sized according to the given size, marked as decorative
   (non-interactive, hidden from the accessibility tree), and does not intercept pointer events.

---

### Edge Cases

- What happens when the content is wider than the container and `autoFill` is off? The content is not
  duplicated beyond the two copies needed for the seamless loop; the animation duration is derived from
  the content's own size rather than the container's.
- What happens when the container has zero measured size (e.g. not yet laid out, or `display: none`)?
  The component falls back to a fixed default animation duration until a real measurement is available,
  rather than dividing by zero or leaving the animation duration undefined.
- What happens when `speed` is `0` or negative? The component treats it as an effectively-negligible
  positive speed floor so the animation duration stays finite (extremely slow rather than infinite or
  reversed).
- What happens when `loopCount` is `0` or `Infinity`? The animation repeats forever.
- What happens when a consumer resizes the window or the content changes size at runtime? The animation
  duration recalculates from the newly measured sizes without a page reload.
- What happens when both `pauseOnHover` and `pauseOnKeyboard` are enabled and the marquee is both
  hovered and keyboard-paused at once? The animation stays paused as long as either condition holds.
- What happens when `reverse` is combined with RTL mirroring? The two invert independently — `reverse`
  flips whatever direction the `side`/direction combination already produced.
- What happens when the marquee is rendered with no children? It renders an empty scrolling track
  without erroring; there is nothing to duplicate or animate meaningfully.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST render a root container that establishes a `marquee` live-region role
  for assistive technology, exactly as upstream documents.
- **FR-002**: The component MUST expose a content region that duplicates its children into two (or, with
  autofill, more) adjacent copies so the scrolling loop has no visible seam or gap, and MUST mark the
  duplicate copy used purely for visual looping as decorative/hidden from assistive technology so screen
  reader users hear each item once.
- **FR-003**: The component MUST support both horizontal scroll directions (`left`, `right`) and both
  vertical scroll directions (`top`, `bottom`) via a single "side" setting, switching the container's
  layout axis (row vs. column, full-width vs. full-height) to match.
- **FR-004**: The component MUST expose an item wrapper for individual pieces of content within the
  scrolling track, and an edge-overlay part that renders a decorative gradient fade at a given side
  (`left`, `right`, `top`, `bottom`) and size (`sm`, `default`, `lg`), non-interactive and hidden from
  assistive technology.
- **FR-005**: The component MUST calculate the scroll animation's duration from the measured size of its
  content relative to its container and a configurable speed (in pixels per second), recalculating
  whenever either measured size changes at runtime (container resize, content changes).
- **FR-006**: The component MUST support an "auto-fill" mode that duplicates content enough times to
  visually fill the container before the loop repeats, for content narrower than the container.
- **FR-007**: The component MUST support a configurable gap between adjacent items and between loop
  repetitions, accepting both CSS length strings and plain numbers (treated as pixels).
- **FR-008**: The component MUST support a configurable start delay and a configurable loop count, where
  a loop count of `0` or `Infinity` means the animation repeats indefinitely and any other positive
  number stops the animation after that many repetitions.
- **FR-009**: The component MUST support reversing the animation's direction independently of the
  side/direction-derived direction.
- **FR-010**: The component MUST support pausing the scroll animation on pointer hover, opt-in via a
  boolean setting, resuming when the pointer leaves. The same setting MUST also pause the animation
  while keyboard focus is anywhere inside the marquee and resume when focus leaves, so the hover pause
  is reachable without a pointer.
- **FR-011**: The component MUST support pausing and resuming the scroll animation from the keyboard by
  pressing Space while the marquee holds focus, opt-in via a boolean setting; when this is enabled the
  marquee MUST be reachable via Tab and MUST show a visible focus indicator, and when disabled the
  marquee MUST NOT be part of the tab order.
- **FR-012**: The component MUST honor the user's reduced-motion preference: when
  `prefers-reduced-motion: reduce` is active, the scroll animation MUST NOT play and all content MUST
  remain fully visible and readable without relying on the animation to reveal it.
- **FR-013**: The component MUST resolve its text direction from the project's shared direction context
  (falling back to an explicit override prop, then the ambient DOM `dir`, then left-to-right) rather than
  only accepting a locally-declared direction prop, and MUST mirror the horizontal scroll animations for
  `left`/`right` sides when the resolved direction is right-to-left, matching upstream's documented RTL
  behaviour.
- **FR-014**: Every part MUST expose a composition escape hatch equivalent to upstream's `asChild`, so a
  consumer can render the part's behaviour and attributes onto a child element of their choosing instead
  of the default container element.
- **FR-015**: Every part MUST forward unrecognised attributes (including `class` and inline styles) to
  its rendered element, merging consumer-provided classes after the component's own classes so callers
  can always override layout.
- **FR-016**: Every non-root part MUST throw a clear, descriptive error identifying both itself and the
  required root component when rendered outside of the marquee root's provided context.
- **FR-017**: The component MUST be distributed as installable source under the project's UI component
  directory, with a public barrel export, and MUST be listed in the project's component registry so it
  can be installed the same way as any other first-party component.
- **FR-018**: A documentation page MUST exist that demonstrates every example shown on the upstream
  documentation page: the default/basic scrolling row, a logo-showcase using auto-fill, a vertical
  layout, and a right-to-left layout.

### Key Entities

- **Marquee root**: The scrolling container. Owns the resolved side, orientation, direction, speed,
  gap, delay, loop count, auto-fill flag, reverse flag, the two pause settings, and the current
  paused/not-paused state; measures itself and its content to derive the animation duration; shares all
  of this with its descendants.
- **Marquee content**: The scrolling track. Renders the caller's children, duplicated into the number of
  copies needed for a seamless loop (and, under auto-fill, enough copies to fill the container), and
  applies the animation.
- **Marquee item**: An individual piece of content inside the scrolling track. Purely a styling/behaviour
  wrapper around one caller-provided child.
- **Marquee edge**: A decorative, non-interactive gradient overlay anchored to one side of the root,
  sized `sm` / `default` / `lg`, used to fade content into the surrounding background at the scroll
  axis's start and end.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer can compose a working, seamlessly-looping scrolling row or column from the
  documented parts (root, content, item, edge) without writing any animation, measurement, or
  duplication logic themselves.
- **SC-002**: 100% of the upstream component's documented props, parts, data attributes, CSS custom
  properties, and keyboard interaction (Space to pause/resume) are reproduced and covered by automated
  tests.
- **SC-003**: Users who set `prefers-reduced-motion: reduce` at the operating-system level see all
  marquee content fully rendered and readable with no moving animation, on 100% of demo page examples.
- **SC-004**: Keyboard-only users can pause and resume any marquee that opts into `pauseOnKeyboard` using
  only Tab and Space, with a visible focus indicator, without needing a pointer.
- **SC-005**: The documentation page exhibits all four upstream examples (default, logo showcase with
  auto-fill, vertical layout, right-to-left layout), and each one visibly scrolls, pauses on hover where
  configured, and mirrors direction correctly under RTL.
- **SC-006**: The component installs through the project's own registry command in the same way as any
  other already-ported component, requiring no manual post-install steps beyond what the registry
  entry declares.

## Assumptions

- **Keyboard pausing defaults to on.** Upstream ships two conflicting defaults for `pauseOnKeyboard`:
  the component source defaults it to `false`, but the published prop-table documentation (the API
  contract consumers read) defaults it to `true`. Per this project's explicit guidance that "pause on
  hover/focus must be keyboard reachable" and accessibility parity being a binding requirement, this
  port follows the documented default (`true`) so every installed marquee is keyboard-pausable unless a
  consumer explicitly opts out.
- **Direction resolution uses the project's shared direction context.** Upstream reads direction through
  a Radix `useDirection` primitive that checks an explicit prop, then a React context provider, then
  falls back to `ltr`. This project already has an equivalent `direction-provider` context with the same
  precedence (explicit override → provider → ambient DOM `dir` → `ltr`); the port composes that existing
  primitive instead of introducing a second, parallel direction mechanism.
- **Resize/measurement tracking is scoped to what's needed for the animation duration**, not exposed as
  a public API — upstream's shared resize-observer store is an internal implementation detail for
  computing `--marquee-duration`, not a documented prop or part, so this port is free to implement the
  equivalent measurement behind the scenes without matching upstream's specific caching data structure.
- **The animation itself is delivered as CSS** (keyframes + custom properties for duration, gap, delay,
  and loop count), matching upstream's approach of driving the loop through `--marquee-*` CSS custom
  properties rather than a JavaScript animation loop, so the animation continues smoothly under paused
  JS execution (e.g. background tabs resuming) and respects `prefers-reduced-motion` at the CSS layer.
- **Edge overlays are purely decorative, and this port hides them from assistive technology.** Upstream's
  `MarqueeEdge` renders only `data-slot`, `data-size` and `pointer-events-none` — it does *not* set
  `aria-hidden`. Because the overlay is a pure gradient with no content, FR-004 requires it to be hidden
  from the accessibility tree, so this port adds `aria-hidden="true"` (divergence D-05, replacing
  upstream's unlabelled decorative div).
- **A default demo, a logo/auto-fill demo, a vertical demo, and an RTL demo** are the four documentation
  sections required, one per upstream example file; no additional demo sections are required beyond
  those four, and no demo introduces content or capabilities upstream does not already demonstrate.
- **Reduced motion is enforced on the animated element.** Upstream puts `motion-reduce:animate-none` on
  the root, which is never animated, so a reduced-motion user still sees the marquee scroll. This port
  keeps the root class and additionally applies the guard to both content tracks, which is where the
  animation actually runs (divergence D-02, required by FR-012 / SC-003).
- **The decorative duplicate does not receive forwarded attributes.** Upstream re-spreads the same
  `contentProps` onto the clone, duplicating any caller-supplied `id`. This port gives the clone only
  `class`, `style`, `role="presentation"`, `aria-hidden="true"`, `data-slot` and `data-clone`, so a
  caller's `id`/`aria-*` appears exactly once (divergence D-03, replacing upstream's duplicated
  attribute spread).
- **`pauseOnHover` also pauses while focus is inside the marquee.** Upstream pauses on `:hover` only,
  which is unreachable without a pointer. This port adds `:focus-within` pausing alongside the hover
  pause (divergence D-04, replacing upstream's hover-only pause; required by User Story 2 and WCAG
  2.2.2).
- **A caller-supplied key handler is composed, not replaced.** Upstream's own `onKeyDown` overwrites any
  `onKeyDown` passed by the consumer. This port invokes the caller's handler first and then applies the
  Space pause toggle (divergence D-06, replacing upstream's attribute-order overwrite; required by
  FR-015).
- **A numeric `gap` is emitted as a pixel length.** Upstream writes the raw number into `--marquee-gap`,
  which is not a valid CSS length, so `gap-(--marquee-gap)` collapses; the documented type is
  `string | number` with "numbers in pixels", so this port emits `16px` for `gap={16}` (a fix to an
  upstream defect, replacing the raw-number value; part of FR-007).
- **The logo-showcase demo substitutes icon glyphs for upstream's brand SVGs.** Upstream inlines six
  brand SVGs with hard-coded hex fills, which this project's styling rules forbid. The demo uses
  `@lucide/svelte` glyphs with the same `sr-only` brand names inside the same circular container,
  demonstrating the identical capability (divergence D-07, demo-only; no component behaviour changes).
