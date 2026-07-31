# Feature Specification: Action Bar

**Feature Branch**: `028-port-action-bar`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Action Bar\" (slug: action-bar) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Act on a contextual selection (Priority: P1)

A user selects one or more items in a list (tasks, rows, files). A floating action bar appears at the
edge of the viewport showing how many items are selected, a group of contextual actions (e.g.
Duplicate, Delete), and a way to dismiss the selection. Choosing an action performs it and clears the
selection; dismissing the bar clears the selection without performing an action.

**Why this priority**: This is the component's entire reason to exist — every other capability
(positioning, keyboard navigation) only matters in service of this flow. Without it there is nothing to
demo or to reuse.

**Independent Test**: Render a list with selectable rows, an `ActionBar` bound to
`selection.size > 0`, an `ActionBarSelection` showing the count, an `ActionBarGroup` with two
`ActionBarItem`s, and an `ActionBarClose`. Select two rows — the bar appears with "2 selected" and both
actions. Activate one action — it runs and the bar closes. Select again and click close — the bar
closes and the selection clears without running an action.

**Acceptance Scenarios**:

1. **Given** no items are selected, **When** the page renders, **Then** the action bar is not present
   in the document.
2. **Given** the consumer sets the open state to true (e.g. because one or more items are selected),
   **When** the state changes, **Then** the action bar mounts into the document body, shows the
   selection content, the action group, and the close control.
3. **Given** the action bar is open, **When** the user activates an `ActionBarItem` (pointer or
   keyboard), **Then** the item's `onSelect` callback fires and, unless the callback prevents the
   default behaviour, the action bar's open state is set to `false`.
4. **Given** the action bar is open, **When** the user activates `ActionBarClose`, **Then** the open
   state is set to `false` unless the click handler prevented the default behaviour.

---

### User Story 2 - Position the bar to fit the layout (Priority: P2)

A consumer embedding the action bar in a page with other fixed UI (e.g. a bottom navigation bar, a
sticky footer) needs to choose which edge of the viewport the bar docks to and how it aligns along that
edge, so it never overlaps existing chrome.

**Why this priority**: Positioning is the second most-visible behaviour and is explicitly called out as
a documented example upstream, but the component is still usable with the defaults if this is missing.

**Independent Test**: Render the action bar with `side="top"` and `align="start"`, toggle it open, and
confirm it docks to the top-start of the viewport instead of the default bottom-center. Repeat for each
combination of `side` (`top`, `bottom`) and `align` (`start`, `center`, `end`), including the offset
props.

**Acceptance Scenarios**:

1. **Given** `side="top"`, **When** the bar opens, **Then** it is positioned at the top of the viewport
   instead of the bottom.
2. **Given** `align="start"` and a non-zero `alignOffset`, **When** the bar opens, **Then** it is
   offset from the start edge of the viewport by that amount.
3. **Given** `orientation="vertical"`, **When** the bar renders its group, **Then** items lay out in a
   column instead of a row.

---

### User Story 3 - Operate the bar entirely by keyboard, including RTL (Priority: P3)

A keyboard-only or screen-reader user needs to reach the action bar, move between its actions without
leaving unrelated focus stops in between, and dismiss it, exactly as the WAI-ARIA Toolbar pattern
prescribes — including under a right-to-left layout.

**Why this priority**: Required for accessibility parity (constitution Principle III) but layers on top
of Stories 1–2 rather than blocking them.

**Independent Test**: With an open action bar containing a group of three items and a close button, tab
into the group (one stop), use arrow keys to move between items, tab again to reach the close button,
and press Escape to close the bar. Repeat with `dir="rtl"` and confirm `ArrowLeft`/`ArrowRight` invert.

**Acceptance Scenarios**:

1. **Given** an open action bar with a group of items, **When** the user presses `Tab`, **Then** focus
   moves to the group as a single stop (the most recently focused item, or the first enabled item if
   none has been focused yet), then to the close button, never landing on every item individually.
2. **Given** focus is on an item and `orientation="horizontal"`, **When** the user presses
   `ArrowRight`/`ArrowLeft`, **Then** focus moves to the next/previous enabled item, wrapping when
   `loop` is true and stopping at the ends when `loop` is false.
3. **Given** focus is on an item and `orientation="vertical"`, **When** the user presses
   `ArrowDown`/`ArrowUp`, **Then** focus moves to the next/previous enabled item with the same
   wrap/stop rules.
4. **Given** `dir="rtl"`, **When** the user presses `ArrowLeft`/`ArrowRight` in a horizontal group,
   **Then** the movement direction inverts relative to the LTR case.
5. **Given** focus is on an item, **When** the user presses `Home`/`End`, **Then** focus moves to the
   first/last enabled item in the group.
6. **Given** the action bar is open, **When** the user presses `Escape`, **Then** `onEscapeKeyDown`
   fires and, unless it prevents the default behaviour, the open state is set to `false`.
7. **Given** an item is disabled, **When** arrow-key or `Home`/`End` navigation runs, **Then** the
   disabled item is skipped and never receives focus.

---

### Edge Cases

- No focusable (non-disabled) item exists in a group: the group itself is not a tab stop
  (`tabindex="-1"`) so `Tab` skips it entirely.
- The action bar is closed (`open` is `false` or falsy): nothing is rendered — no DOM node, no portal,
  no focus side effects — matching upstream's `if (!open) return null`.
- `portalContainer` is explicitly `null`: the bar still renders, into the document body. Upstream
  resolves the container as `portalContainer ?? document.body`, and `??` falls through on `null`, so
  an explicit `null` is not a "do not render" signal — the only unresolved case is the pre-mount
  server pass, where nothing renders anyway.
- The consumer prevents default inside `onSelect`: the action bar stays open after the item activates.
- The consumer prevents default inside the close button's click handler or inside `onEscapeKeyDown`:
  the open state is not changed.
- Tabbing out of a group backwards (`Shift+Tab`) while a subsequent `Tab` would otherwise refocus the
  group: the group is temporarily excluded from the tab order until focus leaves and returns via a
  fresh keyboard entry, matching the roving-tabindex "tabbing back out" behaviour upstream.
- Rendering `ActionBarGroup`, `ActionBarItem`, `ActionBarClose`, or `ActionBarSeparator` outside an
  `ActionBar` throws a descriptive error naming both the part and the required ancestor; rendering
  `ActionBarItem` inside an `ActionBar` but outside an `ActionBarGroup` throws naming
  `ActionBarGroup`.
- `dir` is not explicitly set: the bar inherits the ambient reading direction from the project's
  direction context, defaulting to `ltr`.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide an `ActionBar` root that renders nothing while closed and, once
  open, mounts a `role="toolbar"` container into a portal (defaulting to the document body, overridable
  via a container prop), so the bar always renders above in-flow page content.
- **FR-002**: The root MUST accept a controlled open state and a change callback, MUST support an
  uncontrolled initial open state for consumers that do not need to own the state themselves, and MUST
  never change its own open state except through that callback (documented divergence — see
  Assumptions).
- **FR-003**: The root MUST accept `side` (`top` | `bottom`, default `bottom`), `align` (`start` |
  `center` | `end`, default `center`), `sideOffset` (default `16`), and `alignOffset` (default `0`) and
  MUST position itself against the corresponding edge/alignment of the viewport using those values.
- **FR-004**: The root MUST accept `orientation` (`horizontal` | `vertical`, default `horizontal`) and
  `loop` (default `true`) and MUST make both available to its descendants for layout and keyboard
  behaviour.
- **FR-005**: The root MUST accept a reading direction, resolved from an explicit prop or from the
  project's ambient direction context, defaulting to `ltr`, and MUST expose it to descendants and to
  the rendered container (`dir` attribute).
- **FR-006**: The root MUST listen for the `Escape` key while open, invoke an `onEscapeKeyDown`
  callback, and close itself unless that callback prevents the default behaviour.
- **FR-007**: The root MUST expose `data-slot="action-bar"`, `data-side`, `data-align`, and
  `data-orientation` attributes reflecting current props, and `aria-orientation` matching
  `orientation`.
- **FR-008**: The root MUST play an enter transition on mount (fade + slide from the active side +
  slight scale) and MUST honour reduced-motion preferences. Because FR-001 requires synchronous
  unmount when closed, the root plays no exit transition; the transition recipe itself MUST ship
  both the enter and exit halves and MUST be exported as a component-agnostic primitive reusable
  outside this component (see Assumptions and plan.md "Assumption refinements").
- **FR-009**: The system MUST provide an `ActionBarSelection` part — a plain container, styled as a
  pill, for arbitrary selection-summary content (e.g. a count and an inline close control) — carrying
  `data-slot="action-bar-selection"`.
- **FR-010**: The system MUST provide an `ActionBarGroup` part implementing roving-tabindex focus
  management (WAI-ARIA Toolbar pattern): `role="group"`, a single tab stop for the whole group, arrow
  keys (`ArrowLeft`/`ArrowRight` for horizontal, `ArrowUp`/`ArrowDown` for vertical) moving focus
  between enabled items, `Home`/`End` moving to the first/last enabled item, wrap-around governed by
  the root's `loop`, and re-entry focusing the most recently focused item (or the first enabled item on
  first entry). It MUST carry `data-slot="action-bar-group"` and `data-orientation`.
- **FR-011**: The system MUST provide an `ActionBarItem` part composing the project's existing button
  component (secondary variant, small size by default, every button variant/size still selectable by
  the consumer), participating in the group's roving focus when nested in a group, exposing a
  `disabled` prop that excludes the item from focus and navigation, and exposing an `onSelect` callback
  fired on activation (pointer or keyboard) that, unless it prevents the default behaviour, closes the
  action bar. It MUST carry `data-slot="action-bar-item"`.
- **FR-012**: The system MUST provide an `ActionBarClose` part — a button with its own independent tab
  stop (not part of the group's roving focus) — that closes the action bar on activation unless its
  click handler prevents the default behaviour. It MUST carry `data-slot="action-bar-close"`.
- **FR-013**: The system MUST provide an `ActionBarSeparator` part — a presentational divider
  (`role="separator"`, `aria-hidden="true"`, `aria-orientation` matching its resolved orientation)
  whose orientation defaults to the root's orientation but can be overridden per instance, adapting
  its rendered dimension (full-height line for horizontal groups, full-width line for vertical
  groups). It MUST carry `data-slot="action-bar-separator"`.
- **FR-014**: `ActionBarGroup`, `ActionBarItem`, `ActionBarClose`, and `ActionBarSeparator` MUST each
  throw a descriptive error identifying the part and its required ancestor when rendered outside an
  `ActionBar`. `ActionBarItem` additionally MUST throw, naming `ActionBarGroup`, when it is rendered
  inside an `ActionBar` but outside an `ActionBarGroup` (upstream requires both contexts).
- **FR-015**: All keyboard, positioning, and focus behaviour MUST invert correctly for `ArrowLeft`/
  `ArrowRight` when the resolved reading direction is `rtl`.
- **FR-016**: The portal-mount, viewport-edge-positioning, enter/exit-transition, and roving-focus
  logic MUST be implemented as a standalone, component-agnostic module (not private to `ActionBar`) so
  a subsequently ported floating-toolbar component can reuse it without duplicating the mechanics.
- **FR-017**: The component MUST ship as source under the project's UI component directory with a
  public index barrel exporting every part, short and prefixed names, and every prop type, and MUST be
  registered in the project's component registry exactly like an existing first-party component.
- **FR-018**: A documentation page MUST exist demonstrating both upstream examples: the default
  selection-toolbar layout, and the position (`side`/`align`) configurator.
- **FR-019**: Any capability already provided by an existing project UI component (button, separator)
  or by the underlying headless primitive library MUST be composed rather than re-implemented; bespoke
  code is limited to the portal/position/transition/roving-focus mechanics this component owns.

### Key Entities

- **Action Bar (root)**: The floating toolbar instance. Attributes: open state, side, align, offsets,
  orientation, loop, direction, portal container. Owns the escape-key listener and the shared context
  consumed by its parts.
- **Action Group**: A roving-focus region inside the bar. Attributes: current tab-stop item identity,
  count of focusable items, whether focus is mid-tab-out. Owns the ordered collection of registered
  items.
- **Action Item**: A single contextual action. Attributes: identity, disabled state, whether it is the
  group's current tab stop. Relationship: registers itself with its enclosing Action Group, if any.
- **Selection Summary**: Arbitrary content describing the current selection (count, labels); has no
  behaviour of its own beyond layout.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A consumer can wire the action bar to a selection state and have it appear and disappear
  correctly with zero additional positioning or portal code of their own.
- **SC-002**: 100% of the keyboard interactions documented on the upstream Action Bar page (Tab,
  Shift+Tab, Escape, ArrowLeft/Right, ArrowUp/Down, Home, End) are exercised by an automated test and
  pass, in both `ltr` and `rtl`.
- **SC-003**: Every prop, callback, data attribute, and part documented in the upstream API reference
  is present and behaviourally verified in this port.
- **SC-004**: The documentation page reproduces both upstream examples (default selection flow,
  position configurator) so a reader can see and interact with every documented capability without
  reading source code.
- **SC-005**: The component installs into a fresh consumer project through the project's own registry
  command with no manual follow-up edits, identical to installing an existing first-party component.
- **SC-006**: A screen-reader user can identify the toolbar, move between its actions, and dismiss it
  using only documented keys, without encountering an unlabelled or unreachable control.

## Assumptions _(mandatory)_

- Upstream `ActionBarProps` only exposes a controlled `open`/`onOpenChange` pair with no
  `defaultOpen`. This project's convention (every value-bearing prop is `$bindable` with a
  `defaultValue` fallback, CLAUDE.md §4) is applied here as a `defaultOpen` addition purely for
  uncontrolled convenience; the component still behaves exactly like upstream when only
  `open`/`onOpenChange` are supplied, and never mutates `open` itself outside the documented
  `onOpenChange`/`onEscapeKeyDown` paths.
- Upstream's `asChild`/Radix `Slot` composition escape hatch on every part is dropped in favour of this
  project's existing `child` snippet pattern (see `dialog-content.svelte`), matching every prior port —
  no React-only escape hatch is carried forward.
- Upstream positions the bar with inline `style` (`fixed`, per-side pixel offset, `translate` for
  centering) rather than a floating-UI/anchor library, because the anchor is the viewport, not another
  element. The Svelte port keeps this same fixed-position CSS approach rather than introducing
  `bits-ui` popover/floating positioning, which targets anchor-relative positioning, a different
  problem.
- The portal, viewport-edge positioning, enter/exit transition, and roving-focus (Toolbar pattern)
  logic have no ready-made `bits-ui` equivalent for a *self-anchored* (viewport-relative, not
  trigger-relative) floating toolbar, so they are implemented as bespoke code — justified per
  constitution Principle IV — and extracted into one reusable module rather than embedded in
  `ActionBar`, because the next port (`selection-toolbar`) needs the identical mechanics.
- `ActionBarItem` composes the project's existing `button` component instead of re-implementing button
  styling/variants, matching upstream's own composition of its `Button`.
- `ActionBarSeparator`'s combination of `role="separator"` with `aria-hidden="true"` is kept exactly as
  upstream documents it (a presentational divider that is still selectable via `[role=separator]` for
  styling but is not exposed to assistive technology) rather than reconciled with the project's generic
  `separator` component, because the generic separator does not expose the `in-data-[slot=…]` contextual
  sizing upstream relies on inside `ActionBarSelection`.
- `dir` resolution uses the project's existing direction-context primitive (`direction-provider`) when
  no explicit `dir` prop is supplied, mirroring upstream's `DirectionPrimitive.useDirection`.
- Only the `radix` base variant of the upstream component is ported (this project already tracks the
  `radix` base for its bits-ui-backed components); the parallel `base` (non-Radix) variant under
  `.reference/diceui/docs/registry/bases/base/ui/action-bar.tsx` is out of scope, consistent with every
  prior port in this repository.
- `ActionBarItem`'s custom-event-based `onSelect` dispatch (`item.dispatchEvent` + a one-shot listener)
  **is** reproduced verbatim, including the bubbling, cancelable `actionbar.itemSelect` `CustomEvent`
  and the group's `actionbarFocusGroup.onEntryFocus` event. Svelte has a direct equivalent and the
  repository already ships this exact pattern in `speed-dial-action.svelte`
  (`speedDial.actionSelect`), so reproducing it is a strict superset of the observable contract:
  `onSelect` still receives a cancelable event and `preventDefault()` still suppresses the auto-close,
  and consumers additionally get the upstream event on ancestor elements.
- FR-008's enter/exit transition is delivered as a CSS-only recipe exported for reuse, but `ActionBar`
  itself only ever plays the **enter** half, because FR-001 and the "action bar is closed" edge case
  both require synchronous unmount (upstream returns `null` when closed) and an exit animation would
  contradict acceptance scenario 1. The exported recipe carries both halves plus
  `motion-reduce:animate-none`, satisfying FR-008's operative clause that the transition primitive be
  reusable outside this component.
- `portalContainer` additionally accepts a CSS selector `string`, because the underlying `bits-ui`
  `Portal` accepts one; upstream's `Element | DocumentFragment | null` remains fully supported.
