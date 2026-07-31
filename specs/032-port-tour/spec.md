# Feature Specification: Tour

**Feature Branch**: `032-port-tour`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Tour\" (slug: tour) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Walk a first-time visitor through the product (Priority: P1)

A person opens a page (or triggers a "Start Tour" action) and is guided, one step at a time,
through a sequence of highlighted elements. For each step, the surrounding page dims except for a
cutout around the target element, and a small card near that element explains what it is, with
controls to move to the next step, go back, or finish.

**Why this priority**: This is the entire reason the component exists — a self-driving,
spotlight-and-popover walkthrough. Without it there is no independently useful component.

**Independent Test**: Render a page with several identifiable elements and a tour describing three
steps targeting them, open the tour, and confirm: the first step's target is spotlighted and its
step card is visible with a title and description; advancing moves the spotlight and card to the
next target; advancing past the last step closes the tour and reports completion.

**Acceptance Scenarios**:

1. **Given** a closed tour, **When** it is opened, **Then** the first step's target element is
   spotlighted (the rest of the page is dimmed with a cutout around it), and that step's card shows
   its title, description and navigation controls.
2. **Given** an open tour on a step that is not the last, **When** the person activates "Next",
   **Then** the spotlight and card move to the next step's target and the step counter updates.
3. **Given** an open tour on the last step, **When** the person activates the final control,
   **Then** the tour closes and a completion notification fires exactly once.
4. **Given** an open tour past the first step, **When** the person activates "Previous", **Then**
   the spotlight and card move back to the prior step's target and the "Previous" control is
   disabled again once back at the first step.

---

### User Story 2 - Keep the tour accessible while it has focus (Priority: P1)

A keyboard or assistive-technology user opens the tour. While a step is showing, focus is trapped
inside that step's card (it never leaks to the dimmed page behind it), every control inside the
card remains reachable and operable with the keyboard, `Escape` closes the tour, and when the tour
closes, focus returns to wherever it was before the tour opened.

**Why this priority**: The component wraps interactive controls over content the user did not
choose to focus; without a correct focus trap and restoration it actively harms keyboard and
screen-reader users, which the constitution's accessibility principle treats as a hard requirement,
not an enhancement.

**Independent Test**: Open the tour with keyboard focus on a known trigger element, tab through the
step card's controls and confirm focus wraps at both ends without ever landing on the dimmed page
behind it, press `Escape` and confirm the tour closes, and confirm focus returns to the original
trigger element.

**Acceptance Scenarios**:

1. **Given** an open step, **When** the user presses `Tab` from the last focusable control in the
   step card, **Then** focus moves to the first focusable control in that same card, not to the
   page behind it.
2. **Given** an open step, **When** the user presses `Shift+Tab` from the first focusable control,
   **Then** focus moves to the last focusable control in that same card.
3. **Given** an open tour, **When** the user presses `Escape`, **Then** the tour's escape callback
   fires and, unless that callback prevents the default behavior, the tour closes.
4. **Given** a tour opened while some element had keyboard focus, **When** the tour closes (by any
   means), **Then** focus returns to that original element, provided it is still present in the
   document.
5. **Given** an open step, **When** the user presses `Enter` or `Space` while a step control (Next,
   Previous, Skip, Close) has focus, **Then** that control activates.

---

### User Story 3 - Drive the tour from application state (Priority: P2)

A person building a page wants to start, stop, or jump the tour to a specific step from their own
application logic (e.g. a "Replay tour" button, or resuming a tour left mid-way), rather than
always trusting the tour's own internal step tracking.

**Why this priority**: Documented as the "Controlled" example and required for integrations that
synchronize the tour with external UI, but the component is fully usable without an external
controller (User Stories 1-2 cover the uncontrolled default).

**Independent Test**: Render the tour with externally owned open and step values plus change
callbacks, drive those values from outside the component, and confirm the tour's displayed step and
open state track the external values exactly, while every internal navigation action reports back
through the change callbacks instead of changing state unprompted.

**Acceptance Scenarios**:

1. **Given** externally supplied open and step values, **When** those values change, **Then** the
   tour shows (or hides) and displays the matching step accordingly.
2. **Given** externally supplied open and step values, **When** the user activates "Next" or
   "Previous" inside the tour, **Then** the corresponding change callback fires with the new value
   and the displayed state waits for the external value to update rather than changing on its own.

---

### User Story 4 - Let the visitor skip or dismiss the tour (Priority: P2)

A person who is not interested in the walkthrough closes it early, either through an explicit
"Skip" control, a close button, clicking/tapping outside the step card, or `Escape`. The
application is notified that the tour ended early (as opposed to being completed), so it can, for
example, avoid showing it again automatically.

**Why this priority**: Documented behaviour (`onSkip`, `TourClose`, `TourSkip`, dismiss-outside)
distinct from normal completion, and every real onboarding tour needs an escape hatch.

**Independent Test**: Open a multi-step tour, close it before reaching the last step through each
dismissal path in turn (Skip control, Close control, outside pointer interaction, Escape), and
confirm each path closes the tour and fires the skip notification exactly once, without also
firing the completion notification.

**Acceptance Scenarios**:

1. **Given** an open tour not on its last step, **When** the person activates "Skip" or "Close",
   **Then** the tour closes and a skip notification fires; the completion notification does not.
2. **Given** an open, dismissible tour, **When** the user presses `Escape` or interacts with a
   pointer outside the step card, **Then** the tour closes the same way, unless an integrator
   callback for that interaction prevents the default behavior.
3. **Given** an open tour explicitly marked non-dismissible, **When** the user presses `Escape` or
   clicks outside the step card, **Then** the tour does not close from that interaction alone.

---

### User Story 5 - Customize spotlight styling, spacing and target resolution (Priority: P3)

A person building a tour styles the highlight ring around the target element (border, glow,
animation), sets a default gap between the step card and its target that individual steps can
override, and targets elements by CSS selector, by element reference, or by direct DOM node.

**Why this priority**: Demonstrated in upstream's "Custom Spotlight Styling" and "Global Offset
Control" examples; visual polish and flexible targeting, not core interaction behaviour.

**Independent Test**: Render a tour with a custom class on the spotlight ring, a root-level default
side offset, and one step overriding that offset; confirm the ring accepts the custom class, the
step without an override uses the root default gap, and the overriding step uses its own value.

**Acceptance Scenarios**:

1. **Given** a spotlight ring with caller-supplied classes, **Then** those classes apply in
   addition to the component's own styling.
2. **Given** a root-level default side offset and a step with no offset of its own, **Then** that
   step's card is positioned using the root default.
3. **Given** the same setup but the step specifies its own side offset, **Then** that step's card
   uses its own value instead of the root default.
4. **Given** a step whose target is expressed as a CSS selector, an element reference, or a direct
   DOM element, **Then** the tour resolves all three the same way and positions correctly against
   the resolved element.

---

### Edge Cases

- The current step's target element does not exist in the document (wrong selector, not yet
  rendered, or removed): that step does not render its card or spotlight cutout unless the
  integrator has explicitly forced it to mount; the tour does not error and does not silently skip
  to another step.
- The step whose target has gone off-screen mid-tour (scrolled away, target removed) is marked as
  configured to hide instead of floating in place: the card becomes invisible and inert without
  unmounting, so it reappears correctly if the target comes back into view.
- The active step index is advanced past the last step (e.g. "Next" on the final step): the tour
  fires its completion notification once and closes, rather than rendering an out-of-range step.
- The tour opens with a step count of zero (no steps registered yet): nothing is spotlighted and no
  card renders until at least one step exists.
- The page is scrolled such that the target is outside the viewport when a step becomes active: the
  page auto-scrolls the target into view before/while showing the spotlight, honoring the visitor's
  reduced-motion preference (instant jump instead of animated scroll) unless the integrator has
  explicitly requested a specific scroll behavior.
- Two elements are targeted by the same selector, or a selector matches nothing: the first DOM
  match is used; no match behaves like "target does not exist" above.
- The tour is open and the browser viewport is resized or the page is scrolled: the spotlight
  cutout and the step card's position both stay synchronized with the target's current position.
- Right-to-left reading direction: card placement sides, the arrow's pointing direction, and footer
  button order all mirror correctly, with no left-to-right assumption leaking into positioning math.
- A step is unmounted while it is the active step (e.g. conditionally rendered content disappears):
  the tour does not crash and the step index gracefully reflects the remaining steps.
- Rapid repeated activation of "Next"/"Previous" before scrolling settles: each activation's target
  step takes precedence over the last; no stale scroll-in-progress state causes the wrong step to
  end up focused or spotlighted.
- A step is marked to prevent the tour from being dismissed while it is active (e.g. a step the
  integrator wants the visitor to acknowledge): `Escape` and outside interaction are suppressed for
  the whole tour while `dismissible` is `false` (upstream applies this check to outside interaction
  only — see Assumptions, "`Escape` is gated on `dismissible`"; see also the per-step `required`
  flag, which upstream defines but does not yet gate behavior on).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The tour MUST support an open/closed state usable both as an uncontrolled default
  (seeded once, then managed internally) and as a fully controlled value (owned externally, with
  every change reported through a change notification).
- **FR-002**: The tour MUST support a current-step index usable both as an uncontrolled default and
  as a fully controlled value, with the same controlled/uncontrolled contract as FR-001.
- **FR-003**: Opening the tour MUST spotlight (dim the page except for a cutout around) the target
  element of the current step and show that step's card with its title, description and navigation
  controls.
- **FR-004**: Activating "Next" MUST advance to the next registered step; activating it on the last
  step MUST close the tour and fire a completion notification exactly once, instead of advancing to
  a non-existent step.
- **FR-005**: Activating "Previous" MUST move to the immediately preceding step and MUST be
  unavailable (disabled) while on the first step.
- **FR-006**: Activating "Skip" or the close control MUST close the tour and fire a skip
  notification, distinct from the completion notification of FR-004, whenever the tour is closed
  before reaching the last step.
- **FR-007**: Each step MUST accept its target expressed as a CSS selector, an element reference, or
  a direct DOM element, and MUST resolve all three forms to the same underlying element for
  positioning and spotlighting.
- **FR-008**: Each step's card MUST be positioned relative to its target using a configurable
  preferred side (top/right/bottom/left) and alignment (start/center/end), with collision-aware
  repositioning that keeps the card within the viewport, matching the placement behaviour already
  used by this project's other floating UI (popover-style) components.
- **FR-009**: The tour MUST support a root-level default gap between a step's card and its target
  (in both the primary and cross-axis directions), which any individual step MAY override with its
  own value.
- **FR-010**: The tour MUST render an optional arrow element pointing from the step's card toward
  its target, oriented to match whichever side the card ultimately placed on (which may differ from
  the preferred side after collision avoidance), and hidden when the pointer cannot be centered on
  the target.
- **FR-011**: While a step is active, keyboard focus MUST be trapped within that step's card:
  `Tab` and `Shift+Tab` MUST cycle only through focusable controls inside the card, never reaching
  content behind the dimmed page.
- **FR-011a**: The step card MUST expose modal-dialog semantics: `role="dialog"`, `aria-modal="true"`
  while the tour is modal, an accessible name taken from the step's `Tour.Title` through
  `aria-labelledby`, and its `Tour.Description` associated through `aria-describedby`. `Tour.Title`
  and `Tour.Description` MUST each generate a stable id (overridable by a caller-supplied `id`) and
  register it with the enclosing step.
- **FR-012**: When the tour opens, focus MUST move into the current step's card (to its first
  focusable control, or to the card itself if it has none); when the tour closes, focus MUST return
  to whatever element held focus immediately before the tour opened, provided that element is still
  present in the document. Both moments MUST be interceptable through integrator callbacks that can
  prevent the default focus movement.
- **FR-013**: `Escape` MUST close the tour unless suppressed by an integrator callback that can
  prevent the default behavior, and MUST NOT close the tour at all while the tour is configured as
  non-dismissible.
- **FR-014**: A pointer interaction (down or focus) outside the current step's card and outside its
  target element MUST close the tour, unless suppressed by an integrator callback or unless the tour
  is configured as non-dismissible.
- **FR-015**: While the tour is open and configured as modal (the default), the underlying page
  MUST NOT scroll from user interaction with the background; this restriction MUST be lifted
  cleanly when the tour closes or when modal behavior is disabled.
- **FR-016**: When a new step becomes active, the tour MUST, by default, scroll the target element
  into view if it is not already fully visible, honoring the visitor's operating-system
  reduced-motion preference (an instant jump instead of an animated scroll) unless the integrator
  explicitly overrides the scroll behavior or disables auto-scrolling entirely.
- **FR-017**: The tour MUST let the integrator configure the scroll margin used when deciding
  whether the target is already in view and where it lands after scrolling, independently for each
  edge of the viewport.
- **FR-018**: The spotlight cutout and any spotlight ring MUST track the current target element's
  position and size live, staying synchronized across window resize and page scroll while the tour
  is open.
- **FR-019**: A step whose target cannot be found in the document MUST NOT render its card or
  contribute a spotlight cutout, unless the integrator has explicitly forced that step to mount;
  this MUST NOT raise an error or otherwise disrupt the rest of the tour.
- **FR-020**: A step MAY be configured to become invisible and non-interactive (rather than
  following the target) when its target scrolls out of view or is otherwise undetectable, without
  unmounting the step.
- **FR-021**: The tour MUST expose a step counter presentation (current step number and total step
  count) with a caller-overridable format, and MUST expose the same current-step/total-step
  information as inspectable state wherever a part needs to reflect it (e.g. disabling
  "Previous"/"Next").
- **FR-022**: The tour MUST let the integrator supply a single reusable footer (navigation
  controls layout) applied to every step that does not provide its own footer content, so common
  tours do not need to repeat the same controls on every step.
- **FR-023**: Individual steps MAY register per-step callbacks that fire when that step becomes the
  active step and when it stops being the active step.
- **FR-024**: Right-to-left reading direction MUST be supported: card placement, arrow orientation,
  and footer control layout MUST all mirror correctly, with no left-to-right assumption in
  positioning or layout math, consistent with how the rest of the component set resolves direction.
- **FR-025**: Every part with rendered markup (root, step, spotlight, spotlight ring, arrow, close,
  header, title, description, footer, step counter, previous, next, skip) MUST support rendering the
  caller's own element in place of the default one, receiving the component's merged attributes, so
  markup can be substituted without losing behaviour (upstream `asChild`).
- **FR-026**: Attempting to use any part other than the root outside of a tour instance MUST fail
  with a clear, documented error identifying both the part and the required root; attempting to use
  a part that requires an active step (arrow, footer-as-step-child) outside of a step MUST likewise
  fail with an error naming both the part and the required step.
- **FR-027**: The tour and its parts MUST be distributed as installable source through the project's
  own component registry, with a documented usage example for every behaviour above, including at
  minimum: the default guided-tour walkthrough and the externally controlled tour.
- **FR-028**: The tour MUST support a root-level spotlight padding, in pixels, added on every edge of
  the target's bounds when computing both the spotlight cutout and the spotlight ring; default `4`.
- **FR-029**: The tour's floating content (spotlight, ring and steps) MUST be renderable into a
  caller-chosen container, defaulting to the document body, resolved only on the client so the part
  is inert during server-side rendering.
- **FR-030**: The spotlight and the spotlight ring MUST each accept a force-mount option that keeps
  them in the document while the tour is closed, reporting `data-state="closed"`, so exit transitions
  can run.

### Key Entities

- **Tour (root)**: Owns the open state and the current-step index (each controlled or
  uncontrolled), the registered step list, direction, modal/dismissible configuration, spotlight
  padding, default offsets, auto-scroll configuration, and the shared default footer.
- **Tour Portal**: Renders the tour's floating content (spotlight, ring, step) into a chosen
  container (defaulting to the document body) once mounted on the client.
- **Tour Spotlight**: The dimming backdrop with a cutout around the current target, tracking that
  target's live position and size.
- **Tour Spotlight Ring**: An optional visual outline overlaying the cutout area, independently
  styleable from the dimming backdrop.
- **Tour Step**: A single step, identified by its target (selector, element reference, or DOM
  element) and its own placement, offset, collision, and lifecycle configuration; registers itself
  with the root in mount order and unregisters on removal.
- **Tour Arrow**: An optional pointer element attached to a step's card, oriented to the step's
  resolved placement.
- **Tour Header / Title / Description**: The step card's labelled heading region.
- **Tour Footer / Step Counter / Previous / Next / Skip / Close**: The step card's navigation
  region and its individual controls, each aware of the current step position to enable/disable
  itself and choose its default label appropriately.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Opening a configured tour always spotlights exactly one step's target and shows
  exactly one step card, with the spotlight and card staying visually attached to that target
  through scrolling and resizing.
- **SC-002**: A person using only the keyboard can open a tour, move through every step in either
  direction, and close it, without focus ever landing outside the currently visible step card while
  the tour is open, and without losing their original focus position after the tour closes.
- **SC-003**: 100% of the upstream component's documented props, callbacks, and data attributes are
  reproduced, and covered by automated tests wherever the test environment can observe them; live
  viewport measurement (spotlight cutout geometry, real scrolling) is verified through simulated
  layout/intersection primitives, since the automated test environment does not perform real layout.
- **SC-004**: Every documented usage example from the upstream documentation page (the default
  guided walkthrough and the externally controlled tour) is reproduced as a working demo with no
  regressions in existing ported components.
- **SC-005**: The component behaves correctly, with no placement, arrow-direction, or layout defect,
  when the surrounding layout is right-to-left.
- **SC-006**: Reaching the last step and finishing the tour always fires exactly one completion
  notification and zero skip notifications for that session; closing early through any dismissal
  path always fires exactly one skip notification and zero completion notifications.

## Assumptions

- **Reference variant**: upstream ships a "base" flavour (Radix `Primitive`/`Slot`-free, built
  directly on plain elements) and a "radix" flavour (adds `Direction`/`Slot` from `radix-ui`, plus
  a hand-rolled focus trap, focus guards and dismissable-layer implementation) of this component.
  This port targets the documented behaviour of the radix flavour (the fuller, canonical one linked
  from the task and the docs site's primary Tour page), using this project's existing
  `asChild`-via-`child`-snippet and direction-context conventions (`CLAUDE.md` §10) rather than
  depending on either upstream flavour's own primitives directly.
- **Positioning, focus trap and dismiss-outside are composed, not re-implemented**: upstream
  hand-rolls floating-ui positioning, a focus-trap/focus-guard pair modeled on Radix Focus Guards,
  and pointer-outside/focus-outside dismiss handling modeled on Radix Dismissable Layer (credited in
  its own MDX). This project already has that exact combination — floating placement, focus
  trapping, and outside-dismiss — composed into `bits-ui`'s floating-layer-backed primitives (the
  same foundation this project's `popover` and `dialog` ports already build on). Per Principle IV
  (Composition Over Reimplementation), Tour Step composes those existing primitives for placement,
  collision avoidance, focus trapping, `Escape` handling and outside-dismiss instead of re-deriving
  floating-ui middleware and hand-rolled focus-guard DOM nodes from scratch. The observable contract
  (FR-008, FR-011 through FR-014) is unchanged; only the implementation foundation differs from
  upstream.
- **Target resolution has no ref-forwarding equivalent**: upstream's `target` prop accepts a string
  selector, a React ref object, or a raw `HTMLElement`. Svelte has no ref-object type; the port
  accepts a CSS selector string or a raw DOM `Element`/`HTMLElement` (including one read from a
  `$state` binding via `bind:this`), covering the same practical use cases without a React-specific
  type.
- **Reduced-motion default**: like the sibling `scroll-spy` port, the default scroll behaviour is
  derived from `window.matchMedia("(prefers-reduced-motion: reduce)")` at first use. Upstream defines
  its own copy of `getDefaultScrollBehavior` in `tour.tsx` (lines 360-365), byte-identical to the one
  in `scroll-spy.tsx` (lines 26-31); this port likewise keeps a local three-line copy rather than
  importing it from `scroll-spy`, which would add a `registryDependencies: ["scroll-spy"]` edge that
  drags an unrelated five-part component into every Tour install for one media-query read.
- **`scroller`'s scroll metrics are not reused** _(supersedes an earlier assumption that they would
  be)_: `readScrollMetrics` reads `scrollTop`/`clientHeight`/`scrollHeight` off an `HTMLElement`
  container, whereas upstream's `onScrollToElement` (lines 367-398) measures
  `getBoundingClientRect()` against `window.innerWidth`/`innerHeight` and calls `window.scrollTo`.
  There is no container and no metric in common, so the window-scroll arithmetic is ported directly
  as a pure function and no dependency on `scroller` is added.
- **`hideWhenDetached` composes floating-ui's `hide` middleware, not an `IntersectionObserver`**
  _(supersedes an earlier assumption that the scroll-spy observer module would be reused here)_:
  upstream does not use an `IntersectionObserver` for this at all — it uses
  `hide({ strategy: "referenceHidden" })` (lines 987-991), which `bits-ui` exposes directly as the
  `hideWhenDetached` prop on its floating content. Substituting `observeSections` would be bespoke
  code replacing an available primitive (Principle IV) *and* a divergence from upstream behaviour
  (Principle II), so it is rejected on both counts. `section-observer.svelte.ts` remains exported
  and unchanged; this port simply does not consume it.
- **`asChild` polymorphism**: upstream's `asChild` prop (Radix `Slot`) on every part has no direct
  Svelte equivalent; per `CLAUDE.md` §10 this becomes an optional `child` snippet on each part,
  preserving the capability to render a different underlying element while keeping the component's
  merged props and behaviour.
- **Direction resolution**: upstream reads `dir` through Radix's `Direction.useDirection`, which
  falls back to a document-level `DirectionProvider`. This project's own `direction-provider`
  component (already ported) is composed for the same fallback behaviour, per Principle IV.
- **Store-based reactivity**: upstream's internal store (subscribed via `useSyncExternalStore` so
  each part only re-renders on its own slice of state) has no meaning in Svelte's fine-grained
  reactivity model; the equivalent behaviour — every part reading exactly the reactive state it
  needs, without extra plumbing — falls out naturally from a `.svelte.ts` state class and
  `$derived`, per `CLAUDE.md` §4, and is not treated as a capability to reproduce structurally.
- **`required` is reproduced as inert per-step data, matching upstream**: upstream's `TourStep`
  accepts a `required` prop and stores it on the step record, but no code path in the upstream
  source currently reads it back to change behaviour (it does not, today, block skipping or
  dismissal). This port reproduces the prop and stores it identically for forward API parity
  (Principle II) without inventing enforcement upstream does not have; a tour author who needs a
  step the visitor cannot bypass uses the existing `dismissible={false}` root option (FR-013,
  FR-014), which upstream does implement.
- **Portal target resolution**: upstream's `TourPortal` renders via `ReactDOM.createPortal` into a
  caller-supplied container or `document.body`, resolved after mount (so it is inert during SSR).
  The Svelte port uses this project's existing portal pattern (as already used by `dialog`, `sheet`,
  and other overlay ports) for the same client-only, container-or-body behaviour.
- **`Escape` is gated on `dismissible`, unlike upstream**: upstream's root-level `Escape` handler
  (line 726) closes the tour without consulting `context.dismissible`, even though its own
  outside-interaction handler does apply that check (line 1098). A tour declared
  `dismissible={false}` that `Escape` nevertheless dismisses is incoherent, so this port applies the
  check on both paths, as **FR-013** and User Story 4 acceptance scenario 3 require. For the default
  `dismissible={true}` tour the behaviour — including `onEscapeKeyDown` and its `preventDefault()`
  suppression — is unchanged.
- **Outside-interaction timing and event shape**: `bits-ui`'s dismissible layer reports an outside
  interaction on `pointerup` (plus `onFocusOutside` for focus), where upstream listens on
  `pointerdown`. Both `onPointerDownOutside` and `onInteractOutside` still fire, in upstream's order,
  one interaction later; a `focusin` outside fires only `onInteractOutside`, exactly as upstream does
  (lines 1137-1142). The `CustomEvent` wrappers upstream passes to these callbacks — and to
  `onOpenAutoFocus`/`onCloseAutoFocus` — are reconstructed identically, and a `preventDefault()` on
  them suppresses the default action just as documented.
- **Focus guards are the primitive's, not upstream's**: upstream inserts two
  `[data-tour-focus-guard]` spans into `document.body` (lines 89-125). Focus trapping here is
  `bits-ui`'s focus scope, which solves the same edge-of-document problem its own way. The guard
  spans are an implementation detail of upstream's hand-rolled trap, not part of its documented API,
  so they are not reproduced; the observable contract (**FR-011**, **FR-012**) is unchanged.
- **`data-slot="tour-close"` is additive**: upstream's `TourClose` carries no `data-slot`, unlike
  every other part. Constitution Principle VIII requires one on every part, so it is added.
- **Dialog semantics are added, unlike upstream**: upstream's `TourStep` renders a bare
  `<div tabindex="-1">` with no `role`, no `aria-modal` and no `aria-labelledby`/`aria-describedby`,
  and `TourTitle`/`TourDescription` emit no ids (`tour.tsx` lines 1223-1236, 1445-1480). Because the
  card traps focus, locks background scroll and closes on `Escape`, it is a modal dialog, and
  Constitution Principle III (WAI-ARIA roles, accessible names, label/description association) admits
  no exception. This port therefore adds `role="dialog"`, `aria-modal` (mirroring `modal`),
  `aria-labelledby` and `aria-describedby`. Every upstream attribute is unchanged and a caller may
  override each of these through `...restProps`.
- **`Tour.Next`'s accessible name follows its visible label**: upstream hard-codes
  `aria-label="Next step"` even on the last step, where the visible label reads `Finish` (`tour.tsx`
  lines 1583-1596), so the accessible name no longer contains the visible one — a WCAG 2.5.3 "Label
  in Name" failure that Principle III does not permit. This port keeps `aria-label="Next step"` for
  every non-final step and switches it to `"Finish tour"` on the last one. A caller-supplied
  `aria-label` still wins through `...restProps`.
- **No scroll-in-progress state, so rapid navigation cannot go stale**: `scrollTargetIntoView` is a
  fire-and-forget `window.scrollTo` call with no pending-completion state (upstream
  `onScrollToElement`, `tour.tsx` lines 367-398), and the spotlight is recomputed from the *current*
  step's live rect inside a single coalesced `requestAnimationFrame`. A later `Next`/`Previous`
  therefore always supersedes an earlier one, satisfying the "rapid repeated activation" edge case
  without additional bookkeeping.
- **Scope boundary**: only the "Tour" component itself is in scope. No other component listed in
  `scripts/components.json` is touched, added to, or modified by this port.
