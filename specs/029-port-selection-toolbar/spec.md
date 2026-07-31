# Feature Specification: Selection Toolbar

**Feature Branch**: `029-port-selection-toolbar`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Selection Toolbar\" (slug: selection-toolbar) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Format selected text with a floating toolbar (Priority: P1)

A person is reading or editing text in an editable area. When they select a run of text with the
mouse or trackpad, a small toolbar appears near the selection offering formatting and utility
actions (for example bold, italic, link, copy, share). Choosing an action applies it to the
selected text; the toolbar itself stays open and anchored — it closes only when the selection is
cleared (which an action such as copy may do itself).

**Why this priority**: This is the entire reason the component exists — a Medium-style contextual
formatting toolbar. Without it there is no independently useful component.

**Independent Test**: Render a container with `contenteditable` content and a toolbar with a
couple of items inside it. Select text with `userEvent`, confirm the toolbar becomes visible near
the selection, activate an item, and confirm the associated action callback fires with the
selected text.

**Acceptance Scenarios**:

1. **Given** an editable region with no active selection, **When** the user selects a run of
   text inside it, **Then** the toolbar appears positioned near the selection and exposes the
   configured actions.
2. **Given** the toolbar is visible for a selection, **When** the user activates one of its
   actions, **Then** the action receives the text that was selected at activation time, the
   selection survives the activation, and the toolbar stays open unless the action itself clears
   the selection.
3. **Given** the toolbar is visible, **When** the user collapses or clears the selection (for
   example by clicking elsewhere or pressing an arrow key), **Then** the toolbar disappears.
4. **Given** the toolbar is visible, **When** the user selects a different, non-empty run of
   text, **Then** the toolbar repositions to track the new selection instead of closing and
   reopening.

---

### User Story 2 - React to selection changes to show live information (Priority: P2)

A person building a page wants to show supplementary information — such as a running word or
character count — while someone selects text, without owning the toolbar's open/close state
themselves.

**Why this priority**: This is the second upstream example and is a common real-world need (a
"selection info" panel), but the toolbar is fully usable without it.

**Independent Test**: Render the toolbar with a selection-change callback, select text, and
confirm the callback receives the exact selected text every time the selection changes,
independent of whether an item was activated.

**Acceptance Scenarios**:

1. **Given** a callback is supplied for selection changes, **When** the user selects text,
   **Then** the callback is invoked with the selected text.
2. **Given** a callback is supplied for selection changes, **When** the selection is cleared,
   **Then** the callback is invoked with an empty string.

---

### User Story 3 - Restrict tracking to a specific editable region (Priority: P3)

A page contains both an editable area that should offer the toolbar and other page content (for
example navigation, unrelated paragraphs) that should not trigger it. The integrator scopes
selection tracking to a single container element.

**Why this priority**: Necessary for correct behaviour on any real page that is not 100% covered
by editable content, but it is a configuration of User Story 1 rather than a new capability.

**Independent Test**: Render a container-scoped toolbar next to unrelated text outside the
container; select text outside the container and confirm the toolbar does not appear; select text
inside the container and confirm it does.

**Acceptance Scenarios**:

1. **Given** the toolbar is scoped to a container element, **When** the user selects text outside
   that container, **Then** the toolbar does not appear.
2. **Given** the toolbar is scoped to a container element, **When** the user selects text inside
   that container, **Then** the toolbar appears as in User Story 1.

---

### Edge Cases

- Selecting text that spans element boundaries (multiple paragraphs) inside the tracked container
  still produces one toolbar positioned against the overall selection's bounding box.
- A selection made, then extended without ever fully clearing (e.g. shift-clicking to grow it),
  updates the toolbar's position and tracked text without closing and reopening it.
- Scrolling or resizing the viewport while the toolbar is open repositions it to stay anchored to
  the (possibly now off-screen) selection, and hides it (without closing the underlying state)
  when the selection's anchor is fully scrolled out of the visible collision boundary.
- Pressing `Escape` while the toolbar is open closes it and clears the browser's text selection.
- Clicking anywhere outside the toolbar while it is open clears the text selection and closes the
  toolbar; clicking inside the toolbar (including on its own items) does not.
- On a touch device, the platform's native selection handles and any native selection menu are not
  fought or preventDefault'ed by the component — only mouse-driven interaction suppresses the
  default action explicitly.
- A caret placed with no text selected (collapsed selection) never opens the toolbar.
- The toolbar is fully controllable from outside: an integrator can force it open or closed
  regardless of the live browser selection, and can be told whenever open state changes.
- Under `dir="rtl"`, the toolbar's collision-avoidance and alignment behave correctly relative to
  the inline-start/inline-end edges of the viewport rather than assuming a left-to-right layout.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The toolbar MUST appear automatically whenever the user completes a non-empty text
  selection, and MUST disappear automatically whenever the selection becomes empty or is removed.
- **FR-002**: The toolbar MUST expose its open/closed state through a controlled prop and a
  corresponding change callback, and MUST also work fully uncontrolled (tracking the live
  selection with no external state).
- **FR-003**: The toolbar MUST expose a callback that fires with the current selected text every
  time the tracked selection changes (including becoming empty).
- **FR-004**: The toolbar MUST support being scoped to a specific container element via three
  distinct states: no container supplied (track the whole document); a container element supplied
  (selections inside it trigger the toolbar, selections elsewhere on the page MUST be ignored); and
  a container that resolves to nothing yet (neither opens nor closes the toolbar until it
  resolves).
- **FR-005**: The toolbar MUST position itself near the current text selection's bounding box, on
  a configurable side (top, right, bottom, left) and alignment (start, center, end), with
  configurable offsets from that selection.
- **FR-006**: The toolbar MUST avoid viewport collisions by default — shifting and/or flipping to
  the opposite side to remain visible — with this behavior configurable (including a togglable
  "sticky" partial-shift mode), an optional set of collision boundary elements, and configurable
  collision padding.
- **FR-007**: The toolbar MUST support hiding itself (without closing) when its selection anchor is
  fully occluded or out of view, as an opt-in behavior.
- **FR-008**: The toolbar MUST close and clear the browser's live text selection when the user
  presses `Escape` while it is open.
- **FR-009**: The toolbar MUST close and clear the browser's live text selection when the user
  interacts (e.g. clicks/taps) outside the toolbar's own boundary while it is open; interactions
  inside the toolbar MUST NOT trigger this dismissal.
- **FR-010**: Each toolbar action item MUST expose a "select" callback that receives the text that
  was selected at the time the item was activated, fired for both pointer/mouse activation and
  keyboard/touch activation (an item MUST NOT require a mouse specifically to be usable).
- **FR-011**: A visual separator element MUST be available to group toolbar items.
- **FR-012**: The toolbar's root element MUST be identifiable as a toolbar widget with an
  accessible name, and every exposed open/closed state MUST be reflected as an inspectable
  attribute on the rendered markup for styling and testing purposes.
- **FR-013**: The toolbar and its items MUST be rendered through the page's overlay layer (i.e.
  detached from normal document flow) so they are never clipped by an ancestor's overflow or
  stacking context, with the ability to target a specific host element for that overlay.
- **FR-014**: The toolbar MUST NOT fight the operating system's native text-selection or
  press-and-hold interactions on touch input; any suppression of default browser behaviour for
  activating an item MUST be limited to mouse pointer input.
- **FR-015**: Right-to-left reading direction MUST be supported: side/alignment placement and
  collision handling MUST resolve correctly when the surrounding layout is RTL, consistent with
  how the rest of the component set handles direction.
- **FR-016**: Attempting to use a toolbar action item or separator outside of a toolbar instance
  MUST fail with a clear, documented error identifying both the part and the required parent.
- **FR-017**: The toolbar and its parts MUST be distributed as installable source through the
  project's own component registry, with a documented usage example for every behaviour above.
- **FR-018**: The open toolbar MUST expose, on its own element, the four documented sizing custom
  properties — available width, available height, anchor width and anchor height — under their
  upstream `--selection-toolbar-*` names, plus the resolved placement side and alignment as
  inspectable attributes, so consumers can size and style the surface without forking it.
- **FR-019**: The toolbar MUST let the integrator choose how aggressively its position is
  recomputed — a default strategy that updates only when needed, and an opt-in strategy that
  updates on every animation frame for smoother tracking.
- **FR-020**: The toolbar root and the separator MUST support rendering the caller's own element in
  place of the default one, receiving the component's merged attributes, so the markup can be
  substituted without losing behaviour (upstream `asChild`/`render`).

### Key Entities

- **Selection Toolbar (root)**: The floating container itself. Holds whether it is open, the
  text currently selected, the selection's on-screen bounding box, and the configuration
  (container to watch, side/alignment/offsets, collision rules).
- **Selection Toolbar Item**: A single actionable control inside the toolbar (e.g. "bold",
  "copy"). Knows how to report the selected text back to its own activation callback.
- **Selection Toolbar Separator**: A non-interactive visual divider between groups of items.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A person can select any non-empty run of text inside a tracked area and see a
  formatting toolbar appear within one animation frame of finishing the selection, with no
  perceptible flicker or repositioning glitch.
- **SC-002**: 100% of the upstream component's documented props, callbacks, data attributes, and
  keyboard interactions are reproduced, and covered by automated tests wherever jsdom can observe
  them; placement-dependent criteria (SC-001, SC-003) are verified through quickstart scenarios 6-7
  and 10 instead, since jsdom returns zero-size layout rects.
- **SC-003**: The toolbar remains fully visible and correctly positioned when a selection is made
  within 8px of any viewport edge, in both left-to-right and right-to-left layouts, without manual
  intervention from the integrator.
- **SC-004**: Activating a toolbar action always delivers the exact text that was selected at
  activation time, verified across both mouse and keyboard/touch activation paths.
- **SC-005**: Both documented usage examples from the upstream documentation page (a full
  formatting toolbar, and a toolbar paired with a live selection-info readout) are reproduced as
  working demos with no regressions in existing ported components.

## Assumptions

- **Base variant only**: upstream ships this component in both a "base" flavour (built directly on
  the DOM Selection API with no extra runtime dependency) and a "radix" flavour (the same
  behaviour, built on `@floating-ui/react-dom` for anchor positioning). This port targets
  behavioural parity with the documented feature set of both — since they are identical in
  observable behaviour — implemented once using this repository's existing floating/positioning
  conventions rather than pulling in a new positioning dependency; no upstream-visible capability
  from either flavour is dropped.
- **Positioning primitive**: `bits-ui`'s floating layer _does_ support anchor-to-a-non-element
  positioning — `Popover.Content`'s `customAnchor` accepts a virtual `Measurable`
  (`{ getBoundingClientRect() }`), which is exactly the virtual element upstream feeds to
  `@floating-ui/react-dom`. Positioning, collision handling (`flip`, `shift`/`sticky`,
  `collisionBoundary`, `collisionPadding`), `hideWhenDetached`, `updatePositionStrategy`, portalling,
  the Escape layer and the outside-pointer layer are therefore **composed** from `bits-ui`, per
  Principle IV, with no new npm dependency. Bespoke code is limited to what no primitive covers:
  reading the DOM Selection API, deriving the anchor rectangle from it, and the item's pointer-type
  activation rules. This supersedes the earlier assumption that a bespoke positioner and the
  `action-bar` floating-container module (`action-bar-floating.svelte.ts`) would be used: that module
  docks a surface to a fixed viewport edge and cannot express an anchored, collision-aware placement,
  and its Escape dismisser duplicates the popover's escape layer without participating in the nested
  layer stack. The deviation and its rationale are recorded in `plan.md`.
- **Selection tracking source**: selection state is read from the standard DOM Selection API
  (`window.getSelection()` / `document.addEventListener("selectionchange", ...)`), matching
  upstream. All listeners are torn down when the toolbar unmounts or stops tracking.
- **Outside-pointer and Escape dismissal**: handled by the popover's dismissible and escape layers,
  each wired to clear the browser selection before closing — behaviourally identical to upstream's two
  document listeners, and correct when the toolbar is nested inside another layer (a dialog), where
  one `Escape` must dismiss only the topmost surface. The surface stays non-modal: focus is never
  trapped or moved (`trapFocus={false}` plus both auto-focus events default-prevented), scrolling is
  never locked, and the layer's `user-select` lock is disabled — otherwise the toolbar would fight the
  selection it exists to act on.
- **Touch behaviour**: upstream only calls `preventDefault()` on pointerdown when
  `event.pointerType === "mouse"`; this is preserved verbatim so native touch selection handles and
  any OS-level selection menu keep working unmodified (FR-014, addressing the "must not fight the
  browser's own selection on touch" guidance).
- **`asChild` / `Slot` polymorphism**: upstream's `asChild` prop (Radix `Slot`) on the root and on
  the separator has no direct Svelte equivalent; per the repository's established translation
  (`CLAUDE.md` §10), this becomes an optional `child` snippet on those parts, preserving the
  capability to render a different underlying element while keeping the same props merged onto it.
- **Item polymorphism**: upstream's toolbar item is a thin wrapper around the project's own
  `Button` component (`variant="ghost" size="icon"`), so the ported item composes this project's
  existing `button` component in the same way, per Principle IV.
- **CSS custom properties**: the four upstream `--selection-toolbar-*` custom properties (available
  width/height, anchor width/height) are preserved verbatim as they are part of the documented
  styling API and have no equivalent already exposed by an existing primitive.
- **`useSelectionToolbar` hook**: upstream exports a low-level `useStore`-based hook
  (`useSelectionToolbar`) for advanced consumers to read toolbar state directly. This has no
  idiomatic Svelte equivalent as a standalone hook; the equivalent capability is the toolbar's own
  exported state accessor from its `<slug>.svelte.ts` context (Principle V's compound-component
  pattern), reached the same way every other ported component exposes internal state — through the
  typed context getter — rather than a bespoke store hook.
- **Scope boundary**: only the "Selection Toolbar" component itself is in scope. No other component
  listed in `scripts/components.json` is touched, and no visual redesign beyond mapping upstream's
  raw Tailwind classes to this project's semantic tokens (Section 6 of `CLAUDE.md`) is performed.
- **Toolbar keyboard model**: upstream's toolbar exposes each item as an independently tabbable
  `<button>` and documents `Escape` as its only keyboard interaction; it does not implement the
  WAI-ARIA Authoring Practices roving-tabindex toolbar navigation. That behaviour is reproduced
  verbatim (Principle II) rather than extended, and the deviation from the APG pattern is recorded in
  `plan.md` under Complexity Tracking.
- **Link demo placeholder**: the reproduced "Default" demo's link item uses a fixed placeholder URL
  instead of upstream's `prompt()`, which is blocked in many browsers and would make the demo route
  unusable under automated preview; this is a demo-only divergence, not a component-behaviour one.
