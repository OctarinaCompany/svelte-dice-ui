# Feature Specification: Port Listbox Component

**Feature Branch**: `041-port-listbox`

**Created**: 2026-08-01

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Listbox\" (slug: listbox) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Select a single option with mouse or keyboard (Priority: P1)

A user opens a page containing a list of selectable options, clicks one (or navigates to it with the keyboard and presses `Enter`/`Space`), and sees exactly that option marked as selected; clicking the already-selected option again clears the selection.

**Why this priority**: Single selection is the base listbox experience every other capability builds on. Without it there is no component.

**Independent Test**: Render a listbox with a static list of options and a `defaultValue`. Click a different option and verify it becomes the sole selection while the previous one is deselected; click the currently selected option again and verify the selection clears.

**Acceptance Scenarios**:

1. **Given** a listbox with no value selected, **When** the user clicks an option, **Then** that option becomes selected and is the only selected option.
2. **Given** a listbox with one option selected, **When** the user clicks a different option, **Then** the new option becomes selected and the previous one is deselected.
3. **Given** a listbox with one option selected, **When** the user clicks that same option again, **Then** the selection clears entirely.
4. **Given** a listbox with keyboard focus on an option, **When** the user presses `Enter` or `Space`, **Then** the focused option is selected exactly as if it had been clicked.

---

### User Story 2 - Select multiple options (Priority: P1)

A user working with a multi-select listbox clicks (or keyboard-activates) several options one after another and sees each one marked as selected independently, without any previous selection being replaced.

**Why this priority**: Multiple selection is a first-class, heavily documented upstream mode required for grouped-options use cases like the upstream "Grouped Items" example.

**Independent Test**: Render a listbox with `multiple` enabled. Select two options in a row and verify both remain selected; select one of them again and verify only that one is deselected while the other stays selected.

**Acceptance Scenarios**:

1. **Given** a multiple-selection listbox with no value, **When** the user selects an option, **Then** it is added to the selection and `aria-multiselectable="true"` is present on the listbox.
2. **Given** a multiple-selection listbox with one option already selected, **When** the user selects a different option, **Then** both are now selected.
3. **Given** a multiple-selection listbox with an option already selected, **When** the user selects that same option again, **Then** only that option is removed from the selection; all other selected options remain selected.
4. **Given** a multiple-selection listbox with focus on an unselected option, **When** the user presses `Ctrl+A` (or `Cmd+A` on macOS), **Then** every enabled option becomes selected.
5. **Given** a multiple-selection listbox with focus on one option, **When** the user holds `Shift` and presses an arrow key that moves focus to another option, **Then** every option between the anchor and the newly focused option becomes selected, extending or shrinking as `Shift` + arrow keys are pressed again.

---

### User Story 3 - Operate the listbox entirely by keyboard, matching the WAI-ARIA APG listbox pattern (Priority: P1)

A keyboard-only or screen-reader user tabs into the listbox, moves through options with arrow keys, jumps to the first/last option, jumps by a page, and types the start of an option's label to jump straight to it — with focus and ARIA state always reflecting where they are.

**Why this priority**: Accessibility parity is a non-negotiable project principle for a component whose entire purpose is keyboard-navigable selection.

**Independent Test**: Using only keyboard input and `@testing-library/user-event`, tab into the listbox, move focus with `ArrowDown`/`ArrowUp`, jump with `Home`/`End` and `PageUp`/`PageDown`, type letters to jump to a matching option, and confirm real DOM focus and `aria-selected` update correctly at each step.

**Acceptance Scenarios**:

1. **Given** an unfocused vertical listbox, **When** the user tabs into it, **Then** the previously focused option (or the first enabled option if none was focused yet) receives real DOM focus.
2. **Given** a focused vertical listbox, **When** the user presses `ArrowDown`/`ArrowUp`, **Then** focus moves to the next/previous enabled option, skipping disabled options, and stopping at the boundary unless `loop` is enabled (in which case it wraps).
3. **Given** a focused listbox, **When** the user presses `Home`/`End`, **Then** focus jumps to the first/last enabled option.
4. **Given** a focused listbox, **When** the user presses `PageUp`/`PageDown`, **Then** focus moves the same as `ArrowUp`/`ArrowDown`.
5. **Given** a focused listbox, **When** the user types printable characters in quick succession, **Then** focus jumps to the next enabled option whose visible text starts with the typed characters (case-insensitive), cycling back to the first match after the last one; pausing briefly resets the typed buffer.
6. **Given** a focused option, **When** the user presses `Escape`, **Then** keyboard focus/highlight state is cleared without changing the selection.
7. **Given** a focused option, **When** the user presses `Shift+Tab`, **Then** focus leaves the listbox for the previous focusable element; a subsequent `Tab` back into the listbox returns focus to that same remembered option.
8. **Given** the listbox, **Then** it exposes `role="listbox"`; each option exposes `role="option"` with `aria-selected` reflecting selection state; disabled options additionally expose `aria-disabled`.

---

### User Story 4 - Navigate a two-dimensional grid layout (Priority: P2)

A user browsing options arranged in a CSS grid (not a single column or row) navigates with all four arrow keys, where up/down move within a column and left/right move within a row.

**Why this priority**: Grid layout is a documented upstream example (`orientation="mixed"`) with its own navigation geometry, distinct from — and building on — the single-axis navigation in User Story 3.

**Independent Test**: Render a listbox with `orientation="mixed"` and a multi-column CSS grid of options. Focus the first option, press `ArrowRight` to move within the row, then `ArrowDown` to move within the column, and verify focus lands on the geometrically correct option each time.

**Acceptance Scenarios**:

1. **Given** a grid-orientation listbox laid out in rows and columns, **When** the user presses `ArrowRight`/`ArrowLeft`, **Then** focus moves to the next/previous option in the same row.
2. **Given** a grid-orientation listbox, **When** the user presses `ArrowDown`/`ArrowUp`, **Then** focus moves to the option directly below/above in the same column.
3. **Given** a grid-orientation listbox with `loop` enabled, **When** the user presses `ArrowDown` on the last row of a column, **Then** focus wraps to the first row of that same column (and equivalently for `ArrowUp`/`ArrowLeft`/`ArrowRight`).

---

### User Story 5 - Group related options under a labeled heading (Priority: P2)

A user browsing a longer list sees related options grouped under a heading (e.g., "Basic Tricks", "Advanced Tricks"), with the heading announced by assistive technology as the group's accessible name.

**Why this priority**: Grouping is a documented upstream example needed for organizing longer option lists, but it is additive structure on top of the selection and navigation behavior already covered by User Stories 1–3.

**Independent Test**: Render a listbox with two `Group`s, each containing a `GroupLabel` and two items. Verify each group exposes `role="group"` with `aria-labelledby` pointing at its label's `id`, and that keyboard navigation moves seamlessly across group boundaries as if the groups were not present.

**Acceptance Scenarios**:

1. **Given** a listbox with grouped options, **Then** each group renders with `role="group"` and `aria-labelledby` referencing its group label's `id`.
2. **Given** focus on the last option of one group, **When** the user presses `ArrowDown`, **Then** focus moves to the first option of the next group, navigating across the group boundary transparently.

---

### User Story 6 - Right-to-left layout support (Priority: P3)

A user viewing the application in a right-to-left language navigates a horizontal or grid listbox and finds the arrow keys mirrored to match reading direction.

**Why this priority**: Internationalization is required by project convention, but is additive polish once the core interaction model (P1) and secondary capabilities (P2) are correct.

**Independent Test**: Render a horizontal listbox with `dir="rtl"` (or inside the project's existing direction-provider context set to RTL) and verify `ArrowLeft` moves focus toward later options while `ArrowRight` moves it toward earlier options — the opposite of LTR.

**Acceptance Scenarios**:

1. **Given** a horizontal listbox with `dir="rtl"`, **When** the user presses `ArrowLeft`, **Then** focus moves to the next option (mirroring reading direction); `ArrowRight` moves to the previous option.
2. **Given** no explicit `dir` prop, **When** the listbox is rendered inside the project's ambient direction-provider context set to RTL, **Then** the same mirrored arrow-key behavior applies without requiring an explicit `dir` prop on the component itself.
3. **Given** a grid-orientation (`mixed`) listbox with `dir="rtl"`, **Then** row navigation (`ArrowLeft`/`ArrowRight`) is mirrored while column navigation (`ArrowUp`/`ArrowDown`) is unchanged.

---

### Edge Cases

- Rendering an `Item` with an empty-string `value` is invalid and MUST be rejected/flagged during development (matches upstream, which throws in this case).
- A `disabled` root MUST prevent all focus, selection, and keyboard handling across every item, and MUST NOT be a tab stop.
- An individual `disabled` item MUST be skipped by every directional navigation key, by `Home`/`End`/`PageUp`/`PageDown`, by typeahead matching, and MUST NOT become selected on click or `Enter`/`Space`.
- A listbox with zero enabled items MUST NOT throw when focused or navigated; navigation keys are simply no-ops.
- Using `Item`, `ItemIndicator`, `Group`, or `GroupLabel` outside their required ancestor MUST throw the documented error naming both the part and the required provider.
- A `virtual` root (for consumer-managed virtualization) MUST update selection/highlight/focused-value state without calling the DOM `.focus()`/`.scrollIntoView()` APIs on individual items, since the consumer controls what is actually mounted.
- A component instance rendered with `name` inside a native `<form>` MUST submit its current value (a single string, or an array in `multiple` mode) via a visually hidden input, honoring `disabled`.
- `Shift`+arrow range selection only applies in `multiple` mode; in single-selection mode `Shift`+arrow behaves exactly like the unmodified arrow key.
- Rapid typeahead across a pause boundary (no keypress within the reset window) MUST restart the match buffer from the newly typed character rather than appending to stale input.

## Requirements _(mandatory)_

### Functional Requirements

**Composition & structure**

- **FR-001**: The component MUST ship as five composable parts — root, group, group label, item, and item indicator — mirroring the upstream part list (`Listbox`, `ListboxGroup`, `ListboxGroupLabel`, `ListboxItem`, `ListboxItemIndicator`).
- **FR-002**: Each part MUST be usable both through a namespace import (`Listbox.Root`, `Listbox.Item`, …) and through individually named exports where the root's alias is the bare component name (`Listbox`, `ListboxGroup`, `ListboxGroupLabel`, `ListboxItem`, `ListboxItemIndicator`), consistent with every other ported component in this project and with the upstream shadcn wrapper's export names.

**Single selection (User Story 1)**

- **FR-003**: The root MUST support a single-selection mode where the value is one option identifier or none, settable both as a controlled value with a change callback and as an uncontrolled value with an initial default.
- **FR-004**: Selecting a new option in single-selection mode MUST replace any previous selection; selecting the already-selected option again MUST clear the selection entirely.

**Multiple selection (User Story 2)**

- **FR-005**: The root MUST support a multiple-selection mode where the value is a list of option identifiers, settable both as a controlled value with a change callback and as an uncontrolled value with an initial default.
- **FR-006**: In multiple-selection mode, selecting any option (by click, or `Enter`/`Space` on the focused option) MUST toggle only that option's membership in the selection, independent of Ctrl/Cmd modifier keys, leaving every other selected option unchanged.
- **FR-006a**: Each option MUST accept its own select callback that fires with that option's identifier whenever the option is activated by click or by `Enter`/`Space`, before the root's value-change callback fires, and MUST NOT fire while the option or the root is disabled.
- **FR-007**: `Ctrl+A`/`Cmd+A` MUST select every enabled option at once when the listbox has focus and is in multiple-selection mode; it MUST be a no-op in single-selection mode.
- **FR-008**: `Shift` + a navigation arrow key MUST extend or shrink a contiguous range selection from the last non-`Shift` focus point (the anchor) to the newly focused option, in multiple-selection mode only.
- **FR-009**: The root MUST expose `aria-multiselectable="true"` when, and only when, multiple-selection mode is active.

**Orientation & keyboard navigation (User Stories 3 & 4)**

- **FR-010**: A `vertical` orientation (the default) MUST move focus with `ArrowUp`/`ArrowDown` and MUST ignore `ArrowLeft`/`ArrowRight`.
- **FR-011**: A `horizontal` orientation MUST move focus with `ArrowLeft`/`ArrowRight` and MUST ignore `ArrowUp`/`ArrowDown`.
- **FR-012**: A `mixed` (grid) orientation MUST move focus vertically within the same column using `ArrowUp`/`ArrowDown` and horizontally within the same row using `ArrowLeft`/`ArrowRight`, based on the items' rendered grid geometry.
- **FR-013**: An opt-in `loop` setting MUST wrap navigation from the last enabled option/row/column back to the first (and vice versa) on every orientation; it MUST default to off, matching upstream.
- **FR-014**: `Home`/`End` MUST move focus to the first/last enabled option regardless of orientation.
- **FR-015**: `PageUp`/`PageDown` MUST move focus the same as `ArrowUp`/`ArrowDown` (this listbox has no concept of a scrollable "page" independent of its item list).
- **FR-016**: Disabled options MUST be skipped by every directional-navigation key, by `Home`/`End`/`PageUp`/`PageDown`, and by typeahead.
- **FR-017**: The currently active option MUST receive real DOM keyboard focus, not merely a virtual highlight communicated through ARIA. The listbox MUST use a roving-tabindex model in which the root is the component's single tab stop for as long as it is enabled (and is not a tab stop at all when disabled), while every option is permanently excluded from the tab sequence and is focused programmatically; entering the listbox with `Tab` moves real focus from the root onto an option.
- **FR-018**: `Enter`/`Space` on the focused option MUST select it, applying the current mode's toggle semantics (FR-004/FR-006).
- **FR-019**: `Escape` MUST clear the current keyboard focus/highlight state without changing the selection.
- **FR-020**: `Tab` (without `Shift`) on first entry MUST focus the listbox's last remembered focused option, or the first enabled option if none was yet focused — including after the user has previously tabbed out. `Shift+Tab` MUST return focus to the root, clear the *active* focus used for arrow navigation, and let the browser move to the previous focusable element outside the listbox, while preserving the remembered option for the next entry.
- **FR-021**: Typing one or more printable characters in quick succession MUST move focus to the next enabled option whose text content starts with the typed buffer (case-insensitive), cycling back to the start of the list after the last match; the buffer MUST reset after a short pause between keypresses.
- **FR-022**: Hovering the pointer over an enabled option MUST mark it as highlighted (a distinct, purely visual state from keyboard focus and from selection) via a data attribute; moving the pointer away MUST clear it.

**Groups (User Story 5)**

- **FR-023**: A group part MUST render with `role="group"` and an `aria-labelledby` referencing its group label's `id`; keyboard navigation MUST traverse across group boundaries exactly as if the grouping markup were not present.
- **FR-024**: A group label part MUST expose the `id` referenced by its owning group's `aria-labelledby`.
- **FR-024a**: The item indicator part MUST render only while its owning option is selected, MUST render unconditionally when its `forceMount` setting is on, and MUST be hidden from assistive technology (`aria-hidden="true"`) since it is a purely visual echo of the option's already-announced selected state.

**Disabled root, virtual mode, and form integration**

- **FR-025**: A `disabled` root state MUST prevent focus, selection changes, and all keyboard handling across the entire listbox and MUST NOT be a tab stop.
- **FR-026**: A `virtual` root state MUST suppress the component's own DOM `.focus()`/`.scrollIntoView()` calls on items while still updating the tracked focused/highlighted/selected state, for consumers who virtualize rendering themselves.
- **FR-027**: When rendered with a form field `name` inside a native form, the component MUST submit its current value (a single string, or an array of strings in multiple mode) via a visually hidden form input honoring `disabled`.

**Internationalization (User Story 6)**

- **FR-028**: The component MUST support an explicit right-to-left layout mode (`dir="rtl"`) that mirrors `ArrowLeft`/`ArrowRight` semantics in both `horizontal` and `mixed` orientations, and MUST fall back to the project's existing ambient direction-provider context when no explicit `dir` prop is supplied.

**Distribution & documentation**

- **FR-029**: The component MUST be installable from the project's own component registry the same way every other first-party component is, with a single registry entry listing every source file except tests.
- **FR-030**: A documentation/demo page MUST exist exercising, at minimum, each upstream example: the default vertical list, horizontal orientation, grid (`mixed`) layout, and grouped items.

### Key Entities

- **Listbox value**: Either a single option identifier (single-selection mode) or an ordered set of option identifiers (multiple-selection mode); each identifier corresponds to exactly one rendered option.
- **Option (item)**: A selectable entry with a required non-empty identifier, an optional disabled state, an optional per-item select callback, and membership in at most one group.
- **Group**: A named collection of options rendered together under a shared, accessible label.
- **Focus/highlight state**: The single option currently holding real keyboard focus (roving tabindex) and, independently, the option currently pointer-highlighted; distinct from selection state.
- **Selection anchor**: The focus position recorded the last time a non-`Shift` navigation or selection occurred, used as the start point for `Shift`+arrow range selection.
- **Grid geometry**: The row/column structure derived from how options are actually laid out (e.g., via CSS grid), used to resolve vertical vs. horizontal movement in `mixed` orientation.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can select any one of 50 options using only the keyboard (arrow keys, or `Home`/`End`, or typeahead) followed by a single `Enter`/`Space`, without ever needing the mouse.
- **SC-002**: 100% of the keyboard interactions listed in User Stories 2–4 (`ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`, `Home`, `End`, `PageUp`/`PageDown`, `Enter`/`Space`, `Escape`, `Tab`/`Shift+Tab`, typeahead, `Ctrl/Cmd+A`, `Shift`+arrow range selection) produce the documented outcome when automatically tested.
- **SC-003**: Every state a screen-reader user needs — the listbox role, each option's selected/disabled state, and each group's accessible name — is exposed through the ARIA attributes asserted in the roles-and-ARIA test area, independent of any visual/color-only cue.
- **SC-004**: In multiple-selection mode, a user can select any 3 options in any order (via mouse, individual keyboard activation, or `Shift`+arrow range) and end up with exactly those 3 (and no others) selected, verified automatically.
- **SC-005**: Every example shown on the upstream documentation page (default, horizontal, grid, grouped) has a directly corresponding, working demo section on this project's documentation site.
- **SC-006**: Under `dir="rtl"`, horizontal and grid-row keyboard navigation tests pass with inverted `ArrowLeft`/`ArrowRight` semantics, verified automatically rather than by sighted review.
- **SC-007**: The component is installable into a fresh consumer project through the project's registry in a single command, with zero manual follow-up edits required to reach a working state.

## Assumptions

- **Roving tabindex with real DOM focus is the chosen APG variant, not `aria-activedescendant`.** The task brief's component-specific guidance lists both "roving tabindex" and "`aria-activedescendant`" as floor requirements, but the WAI-ARIA Authoring Practices treat these as two *alternative*, mutually exclusive ways to implement listbox keyboard focus — a widget uses one or the other, not both. Upstream's own implementation (`.reference/diceui/packages/listbox/src/listbox.tsx`) calls real `.focus()` on each option's DOM node and gives the active option `tabIndex={-1}` (a classic roving-tabindex setup) and never sets `aria-activedescendant` anywhere. This spec follows upstream's real-focus roving-tabindex model (FR-017) rather than adding a redundant/conflicting virtual-focus layer; this satisfies Constitution Principle II (upstream parity) without contradicting Principle III (APG is a floor, and roving tabindex is a fully valid APG pattern on its own).
- **Typeahead, `Shift`+arrow range selection, `Ctrl`/`Cmd`+`A` select-all, and `PageUp`/`PageDown` are deliberate additions beyond upstream, required by the task's explicit component-specific guidance and by Constitution Principle III ("where upstream is weaker than the APG pattern for this kind of widget, follow the APG instead").** Upstream's `listbox.tsx` and its test file implement neither: there is no character-buffer matching, no `Shift`-modified range logic, no select-all shortcut, and `PageUp`/`PageDown` are entirely unhandled keys. All four are part of the standard APG listbox/grid pattern for exactly this widget shape, so this port adds them (FR-007, FR-008, FR-015, FR-021) as an enhancement over upstream rather than a strict parity item, and records the divergence here per Principle II.
- **`PageUp`/`PageDown` default to single-step movement, matching the sibling `combobox` port's precedent.** This listbox has no independent scrolling viewport or virtualization concept built in, so there is no natural "page size" to jump by; `src/lib/components/ui/combobox/` (the closest ported precedent) resolved the same ambiguity by making `PageUp`/`PageDown` behave like `ArrowUp`/`ArrowDown` (FR-015), and this port follows that same resolution for consistency across the project.
- **Typeahead reset window**: the character-match buffer resets after a short pause (implementation detail resolved in `plan.md`) with no additional prop to configure it, since upstream exposes no such prop and the task brief does not request one.
- **Grid geometry (`orientation="mixed"`) is derived from actual rendered layout**, matching upstream's approach of measuring option bounding rectangles at runtime rather than accepting an explicit `columns` prop — consumers arrange items into a grid purely via CSS (e.g., `grid grid-cols-3`), exactly as upstream's `listbox-grid-demo.tsx` does.
- **`virtual` mode is a hook for consumer-managed virtualization**, not a built-in virtualized-rendering feature — matching upstream's own `virtual` prop, which only suppresses the component's internal `.focus()`/`.scrollIntoView()` calls (FR-026) and does nothing else.
- **Upstream's `asChild`/`Slot` escape hatch has no direct Svelte 5 equivalent** and is replaced by this project's standard `child` snippet pattern wherever a part needs to render as a different element, per the project-wide React→Svelte translation table; this is not called out per-part above because it applies uniformly to every part with a documented ARIA role.
- **Positioning/portals are out of scope**: unlike `combobox`, `listbox` has no popover, anchor, or portal parts upstream — it is an always-visible, non-floating selection list — so no bits-ui popover/positioning primitive is composed here at all.
- **Form submission encoding diverges from upstream's `VisuallyHiddenInput`.** Upstream renders one hidden input whose value is `JSON.stringify`d in `multiple` mode, which no form parser reads back. This port renders one clipped `type="text"` input per submitted value, all sharing `name`, so `new FormData(form).getAll(name)` returns a real array (FR-027) — the same markup `combobox` and `tags-input` already use. Replaces upstream `visually-hidden-input.tsx`.
- **`aria-disabled` and root `data-disabled` are additions.** Upstream's `ListboxItem` sets only `data-disabled`, and `ListboxRoot` sets no disabled attribute at all. Per Constitution Principle III (APG floor) and VIII (every state exposed as a `data-*`), disabled items also expose `aria-disabled`, and a `disabled` root exposes both `aria-disabled` and `data-disabled=""`. Purely additive: no upstream attribute changes meaning.
- **`data-focused` on `Item` is an addition with no upstream equivalent.** It exposes roving-focus position for styling without relying on `:focus-visible`, alongside upstream's `data-selected` / `data-highlighted` / `data-disabled`.
- **`Group` throws outside `Root`, which upstream does not.** Upstream's `ListboxGroup` never reads the listbox context, so it renders silently outside a root (its `LISTBOX_ERRORS` entry is unreachable). This port makes the throw real, matching the error message upstream already declares and this project's rule that every part names its required provider.
- Standard defaults are used for anything not explicitly covered above (focus-visible styling, exact CSS grid utility classes used in demos) — these follow the same conventions already used by every other ported component in this project.
