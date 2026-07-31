# Feature Specification: Port Combobox Component

**Feature Branch**: `026-port-combobox`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Combobox\" (slug: combobox) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Filter and select a single value (Priority: P1)

A user opens a form field that lets them search a list of options by typing, sees the list narrow as they type, and picks exactly one option, which replaces the typed text with the selected option's label.

**Why this priority**: This is the base combobox experience (single selection with filtering) that every other capability builds on. Without it there is no component.

**Independent Test**: Render a combobox with a static list of options and a `defaultValue`. Type a partial match into the input, verify the option list narrows to matching options only, select one with the mouse or with `Enter`, and verify the input now shows that option's label, the popover closes, and focus stays on the input.

**Acceptance Scenarios**:

1. **Given** a closed combobox with no value, **When** the user types text into the input, **Then** the popover opens and the option list is filtered to options whose label matches the typed text.
2. **Given** an open combobox with a filtered option list, **When** the user clicks an option, **Then** that option becomes the selected value, the input text updates to the option's label, the popover closes, and input focus is retained.
3. **Given** an open combobox with a highlighted option, **When** the user presses `Enter`, **Then** the highlighted option is selected exactly as if it had been clicked.
4. **Given** an open combobox where the current input text matches no option, **When** the user presses `Enter`, **Then** no value is set, the input reverts to the previously selected label (or clears if none), and the popover closes.
5. **Given** a combobox with a selected value, **When** the user presses `Escape`, **Then** the input reverts to the selected value's label (or clears if unselected) and the popover closes.

---

### User Story 2 - Select multiple values shown as removable badges (Priority: P1)

A user working with a multi-select field types to filter, picks several options one after another without the list closing between picks, sees each pick appear as a removable badge/chip next to the input, and can remove a badge with the mouse or the keyboard.

**Why this priority**: Multiple selection with badge chips is a first-class, heavily-tested upstream mode (and is the shape `data-table` filtering needs), so it must ship in the same release as single-select, not as a follow-up.

**Independent Test**: Render a combobox with `multiple` enabled and a badge list. Select two options in a row without the popover closing, verify both appear as badges, delete one badge by clicking its delete affordance, and verify the value array updates and the remaining badge stays.

**Acceptance Scenarios**:

1. **Given** a multiple-selection combobox, **When** the user selects an option, **Then** the option is added to the value list, a badge appears for it, the input clears, and the popover stays open.
2. **Given** a multiple-selection combobox with an already-selected option, **When** the user selects that same option again, **Then** it is removed from the value list and its badge disappears.
3. **Given** a multiple-selection combobox with at least one badge, **When** the user clicks a badge's delete control, **Then** that value is removed from the list and input focus returns to the input.
4. **Given** the input caret is at the start of an empty input, **When** the user presses `ArrowLeft`, **Then** the last badge becomes keyboard-highlighted; repeated `ArrowLeft` presses move the highlight toward earlier badges, and `ArrowRight` moves it toward later badges until it exits back to the input.
5. **Given** a badge is keyboard-highlighted, **When** the user presses `Enter`, **Then** that badge's value is removed from the selection.
6. **Given** the input is empty and at least one value is selected, **When** the user presses `Backspace` or `Delete` with no badge highlighted, **Then** the last selected value is removed.
7. **Given** the input contains typed text, **When** the user presses `Backspace` or `Delete`, **Then** no badge is removed (normal text-editing behavior applies instead).

---

### User Story 3 - Navigate and operate the combobox entirely by keyboard, including assistive technology (Priority: P1)

A keyboard-only or screen-reader user opens the popover, moves through options with arrow keys, jumps to the first/last option, and gets correct role/state announcements throughout, matching the WAI-ARIA combobox pattern.

**Why this priority**: Accessibility parity is a non-negotiable project principle, and this component is a primary input control that must be fully operable without a mouse.

**Independent Test**: Using only keyboard input and an accessibility tree inspection (or testing-library `getByRole`), open the popover with `ArrowDown`, move the highlight with `ArrowDown`/`ArrowUp`, jump to first/last with `Home`/`End`, and confirm `role`, `aria-expanded`, `aria-controls`, and `aria-activedescendant` update correctly at each step.

**Acceptance Scenarios**:

1. **Given** a closed combobox, **When** the user presses `ArrowDown` (or `ArrowUp`) while the input is focused, **Then** the popover opens and the first (or last) option — or the currently selected option, if any — becomes highlighted.
2. **Given** an open combobox, **When** the user presses `ArrowDown`/`ArrowUp` repeatedly, **Then** the highlight moves forward/backward through the visible option list one item at a time, stopping at the boundary unless the component is configured to wrap.
3. **Given** an open combobox, **When** the user presses `Home` or `End`, **Then** the highlight jumps to the first or last visible option respectively.
4. **Given** an open, modal combobox, **When** the user presses `PageUp`/`PageDown`, **Then** the highlight moves the same as `ArrowUp`/`ArrowDown`.
5. **Given** an open combobox, **When** the user presses `Tab`, **Then** the popover closes and focus moves to the next focusable element as normal, except when the component is modal, in which case `Tab` is trapped within the popover.
6. **Given** the input has focus, **Then** it exposes `role="combobox"`, `aria-expanded`, `aria-controls` pointing at the listbox, `aria-autocomplete="list"`, and — whenever an option is highlighted — `aria-activedescendant` pointing at that option's id; the listbox itself exposes `role="listbox"`; each option exposes `role="option"` and `aria-selected` reflecting its selection state.
7. **Given** the option list is empty after filtering, **Then** an element with `role="status"` and `aria-live="polite"` announces that no results were found.

---

### User Story 4 - Grouped options, custom filtering, and externally-managed (async/manual) filtering (Priority: P2)

A user browses options organized into labeled groups, or types into a combobox whose matching logic is supplied by the consuming application (custom fuzzy ranking, or a debounced/async search against a remote source with a loading indicator).

**Why this priority**: These are documented upstream capabilities exercised by dedicated examples, but they build on top of User Stories 1–3 rather than being required for a minimally usable combobox.

**Independent Test**: Render a combobox with grouped options and verify each group's label and separator appear/disappear correctly as filtering narrows results. Separately, render a combobox with manual filtering and a simulated async delay, verify a loading indicator appears while "fetching" and the option list only updates once loading completes.

**Acceptance Scenarios**:

1. **Given** a combobox with options organized into labeled groups, **When** the list is unfiltered, **Then** every group label and its separator are visible; **When** filtering removes all options from a group, **Then** that group's label and separator are hidden.
2. **Given** a combobox configured with a custom filter function, **When** the user types, **Then** the option list reflects exactly the custom function's output rather than the built-in fuzzy/exact matcher.
3. **Given** a combobox configured for externally-managed filtering, **When** the user types, **Then** the component does not filter options itself — the list rendered by the consumer is shown as-is, allowing a loading indicator to be shown before results arrive.
4. **Given** externally-managed filtering with a loading indicator visible, **When** loading completes with zero results, **Then** the "no results" status message appears; **When** loading completes with results, **Then** the option list appears and the loading indicator disappears.

---

### User Story 5 - Right-to-left layout support (Priority: P3)

A user viewing the application in a right-to-left language sees the combobox's trigger, input, anchor, and popover all mirrored correctly.

**Why this priority**: Internationalization is required by project convention, but is additive polish once the core interaction model (P1/P1/P1) and secondary capabilities (P2) are correct.

**Independent Test**: Render a combobox with `dir="rtl"` (or inside the project's existing direction context set to RTL) and verify the `dir` attribute is present on the anchor, input, trigger, and popover content elements.

**Acceptance Scenarios**:

1. **Given** the combobox direction is set to `rtl`, **Then** the anchor, input, trigger, and popover content each carry `dir="rtl"`.
2. **Given** no explicit direction is set, **When** the component is rendered inside the project's ambient direction context set to RTL, **Then** the combobox still renders right-to-left without requiring an explicit `dir` prop on the component itself.

---

### Edge Cases

- Typing into the input when the combobox is `disabled` or `readOnly` MUST NOT open the popover, filter options, or change the value; a disabled combobox additionally rejects trigger clicks.
- Selecting an option whose `value` is an empty string is invalid and MUST be rejected/flagged during development (matches upstream, which throws in this case).
- Blurring the input with unconfirmed typed text: if the component is single-select, the input reverts to the current selection's label (or clears if there is none); if `preserveInputOnBlur` is enabled, the typed text is left as-is instead.
- Clicking the anchor/wrapper area (not the input itself) focuses the input rather than doing nothing, unless the anchor is explicitly configured to skip focusing the input.
- When the list is filtered down to zero visible options, the "no results" status element renders instead of the listbox's item collection, and no item is highlighted.
- Removing every badge (down to an empty value array) in multiple-selection mode leaves the popover state unaffected — it does not force-close or force-open.
- A component instance rendered with `name` inside a native `<form>` submits its current value via a visually hidden input, respecting `disabled`, `readOnly`, and `required`.
- Consumers who supply both `manualFiltering` and `onFilter` get externally-managed filtering — the built-in filter function is never invoked when either is set.

## Requirements _(mandatory)_

### Functional Requirements

**Composition & structure**

- **FR-001**: The component MUST ship as a set of composable parts — root, label, anchor, trigger, input, cancel control, badge list, badge item, badge item delete control, portal, popover content, popover arrow, loading indicator, empty-state, group, group label, item, item text, item indicator, and separator (20 parts total) — mirroring the upstream part list, so consumers compose only the parts they need. The portal part MUST allow the popover content to be rendered outside its DOM hierarchy into a caller-chosen container, and the arrow part MUST render a visual pointer to the anchor.
- **FR-002**: Each part MUST be usable both through a namespace import (`Combobox.Root`, `Combobox.Item`, …) and through individually named exports (`ComboboxRoot`, `ComboboxItem`, …), consistent with every other ported component in this project.

**Single selection (User Story 1)**

- **FR-003**: The root MUST support a single-selection mode where the value is one option (or none), settable both as a controlled value with a change callback and as an uncontrolled value with an initial default.
- **FR-004**: Typing into the input MUST filter the visible options to those matching the typed text using fuzzy matching by default, with an opt-in stricter/exact matching mode.
- **FR-005**: Selecting an option in single-selection mode MUST set the value, replace the input's text with that option's label, close the popover, and keep focus on the input.
- **FR-006**: Consumers MUST be able to supply a custom filter function that fully replaces the built-in matching logic.
- **FR-007**: Consumers MUST be able to disable all built-in filtering so the option list they render is shown exactly as given (externally-managed / "manual" filtering), enabling debounced or asynchronous search sources.

**Multiple selection (User Story 2)**

- **FR-008**: The root MUST support a multiple-selection mode where the value is a list of options, settable both as a controlled value with a change callback and as an uncontrolled value with an initial default.
- **FR-009**: Selecting an already-unselected option in multiple-selection mode MUST add it to the value list, clear the input text, and keep the popover open; selecting an already-selected option MUST remove it instead.
- **FR-010**: The component MUST provide a badge-list part that renders one removable badge per selected value when in multiple-selection mode, exposing an explicit delete control per badge.
- **FR-011**: Clicking a badge's delete control MUST remove that value from the selection and return focus to the input.
- **FR-012**: When the input has no typed text, `ArrowLeft` MUST move a keyboard highlight onto the last badge (or the previous badge if one is already highlighted); `ArrowRight` MUST move the highlight toward later badges and exit back to the input past the last one.
- **FR-013**: When a badge is keyboard-highlighted, `Enter` MUST remove that badge's value from the selection.
- **FR-014**: When the input is empty, `Backspace` and `Delete` MUST remove the highlighted badge if one is highlighted, or otherwise the last selected value; when the input has typed text, `Backspace`/`Delete` MUST NOT remove any badge.
- **FR-015**: The badge list MUST support both horizontal and vertical orientation, reflected in the rendered markup so consumers can style either layout.

**Popover & filtering behavior shared by both modes**

- **FR-016**: Typing text MUST open the popover if it is closed (unless the component is disabled or read-only).
- **FR-017**: The root MUST support an `open`/`defaultOpen` controlled/uncontrolled pair with a change callback, independent of the value state.
- **FR-017a**: The root MUST expose the input's text as a controlled/uncontrolled state pair independent of the selected value — a controlled current text with a change callback fired on every text change, and an uncontrolled seed (in single-selection mode, the initial default value's label). The change callback MUST NOT fire while the component is disabled or read-only. This is what allows a consumer to debounce typing and drive an external search.
- **FR-018**: The root MUST support an option to open the popover automatically when the input receives focus.
- **FR-019**: The root MUST support an option to auto-highlight the first visible option whenever the popover opens or the filtered list changes.
- **FR-020**: Options MUST be groupable under labeled sections with an optional separator between groups; a group and its separator MUST hide themselves automatically when filtering leaves the group with no visible options.
- **FR-021**: An empty-results indicator MUST render, with an assistive-technology-friendly live announcement, whenever the popover is open and the current non-empty search matches no options; it MUST NOT render for an open popover whose search is empty, and MUST offer an opt-in to stay mounted regardless (for externally-managed/async filtering).
- **FR-022**: A loading-indicator part MUST be available for consumers to show while results are being fetched, supporting both indeterminate and determinate (progress value) display.
- **FR-023**: A cancel/clear control MUST be available that clears the input's current text when it is non-empty.
- **FR-023a**: Every part whose visibility depends on transient state (popover content, cancel control, badge list, group, item indicator, empty-state, separator) MUST offer an opt-in `forceMount`/`keepVisible` prop that keeps it mounted regardless of that state, for consumers that need to control mount/unmount animations or externally-managed rendering themselves.

**Keyboard & accessibility (User Story 3)**

- **FR-024**: `ArrowDown`/`ArrowUp` MUST open the popover if closed (highlighting the selected option if any, else the first/last option) and, if already open, MUST move the highlight to the next/previous visible option.
- **FR-025**: `Home`/`End` MUST move the highlight to the first/last visible option while the popover is open.
- **FR-025a**: Highlight navigation MUST stop at the first and last visible option by default; when the root is configured to loop, `ArrowDown` past the last visible option MUST wrap to the first and `ArrowUp` past the first MUST wrap to the last. The setting MUST default to non-looping, matching upstream.
- **FR-026**: `PageUp`/`PageDown` MUST behave like `ArrowUp`/`ArrowDown` while the popover is open, at minimum in the component's modal display mode.
- **FR-027**: `Enter` MUST select the currently highlighted option; if nothing is highlighted or the list is empty, it MUST close the popover and revert the input text without changing the value.
- **FR-028**: `Escape` MUST close the popover and revert the input's text to the current selection's label (single mode) or clear unconfirmed text, without changing the value.
- **FR-029**: `Tab` MUST close the popover and allow focus to move on as normal; in the component's modal display mode, `Tab` MUST instead stay trapped within the popover while it is open.
- **FR-029a**: The component's modal display mode MUST also lock page scrolling while the popover is open, in addition to the keyboard-trapping behavior in FR-029; automated tests verify this as attribute/prop wiring only, since jsdom does not execute real scroll locking.
- **FR-030**: The input MUST expose `role="combobox"`, `aria-expanded`, `aria-controls` referencing the popover's listbox id, `aria-autocomplete="list"`, and — whenever an option is highlighted — `aria-activedescendant` referencing that option's id.
- **FR-031**: The popover content MUST expose `role="listbox"`; each option MUST expose `role="option"` with `aria-selected` reflecting whether it is part of the current value, and MUST NOT be a separate native Tab stop (selection/highlight is driven virtually from the input).
- **FR-031a**: An individual option MUST be markable as disabled: it MUST expose `aria-disabled`, MUST be skipped by all highlight movement (`ArrowUp`/`ArrowDown`/`Home`/`End`/`PageUp`/`PageDown` and auto-highlight), and MUST NOT change the value when clicked or when `Enter` is pressed. Each option MUST also accept an optional per-option select callback that fires with the option's value immediately before the value changes.
- **FR-032**: The trigger control MUST expose `aria-haspopup="listbox"` and `aria-expanded` kept in sync with popover open state. Clicking the trigger MUST toggle the popover open state, return focus to the input with the caret at the end, and highlight the selected option (or the first option when auto-highlight is enabled).
- **FR-033**: The label part MUST associate itself with the input via matching `id`/`for` (or `aria-labelledby`) so assistive technology announces the field's name.
- **FR-034**: Selecting/deselecting/removing values MUST never rely on color alone and MUST be reflected in both visual state and the corresponding ARIA/data attributes.

**Disabled, read-only, and form integration**

- **FR-035**: A `disabled` root state MUST prevent opening the popover, filtering, typing, and value changes across every part (input, trigger, badges, cancel).
- **FR-036**: A `readOnly` root state MUST prevent value changes from typing while still allowing the popover to be viewed/navigated.
- **FR-037**: When rendered with a form field name inside a native form, the component MUST submit its current value (single string or list) via a visually hidden form input honoring `disabled`, `readOnly`, and `required`.

**Internationalization (User Story 5)**

- **FR-038**: The component MUST support an explicit right-to-left layout mode that mirrors the anchor, input, trigger, and popover content, and MUST fall back to the project's existing ambient direction context when no explicit direction is supplied; additionally, under `dir="rtl"` the badge-navigation semantics of `ArrowLeft`/`ArrowRight` (FR-012) MUST be mirrored, so that `ArrowRight` moves toward earlier badges and `ArrowLeft` toward later badges.

**Distribution & documentation**

- **FR-039**: The component MUST be installable from the project's own component registry the same way every other first-party component is, with a single registry entry listing every source file.
- **FR-040**: A documentation/demo page MUST exist exercising, at minimum, each upstream example: default single-select with filtering, grouped options, multiple selection with badges, custom filter function, externally-managed/async filtering with a loading state, and large/virtualized-style option lists.

### Key Entities

- **Combobox value**: Either a single option identifier (single-selection mode) or an ordered list of option identifiers (multiple-selection mode); each identifier corresponds to exactly one rendered option and its display label.
- **Option (item)**: A selectable entry with a required non-empty identifier, a display label (defaulting to its rendered text), an optional disabled state, and a group membership.
- **Group**: A named collection of options rendered together under a shared label, optionally separated from adjacent groups.
- **Selection badge**: A visual, individually removable representation of one selected value, used only in multiple-selection mode.
- **Filter state**: The current typed text plus the derived set of currently visible options, produced either by the built-in matcher, a consumer-supplied filter function, or entirely by the consumer (externally-managed filtering).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can filter a list of 50 options down to the intended one and select it using only the keyboard in under 10 keystrokes/key-presses (typing plus at most `Enter`).
- **SC-002**: 100% of the keyboard interactions listed in User Story 3 (`ArrowDown`, `ArrowUp`, `Home`, `End`, `PageUp`/`PageDown` in modal mode, `Enter`, `Escape`, `Tab`) produce the documented outcome when automatically tested.
- **SC-003**: Every state a screen-reader user needs — whether the popover is open, how many options are visible, which option is highlighted, and which are selected — is exposed through the ARIA attributes asserted in the roles-and-ARIA test area (`aria-expanded`, `aria-controls`, `aria-activedescendant`, `role="option"` + `aria-selected`, `role="status"` live region for zero results), independent of any visual/color cue.
- **SC-004**: In multiple-selection mode, a user can select 3 options and remove any one of them (by mouse or by keyboard) without ever losing track of which options remain selected, verified by the badge list always matching the underlying value list exactly.
- **SC-005**: Every example shown on the upstream documentation page has a directly corresponding, working demo section on this project's documentation site.
- **SC-006**: Under `dir="rtl"`, the anchor, input, trigger, and popover content each carry `dir="rtl"`, and the badge-navigation keyboard tests (FR-012, FR-038) pass with inverted `ArrowLeft`/`ArrowRight` semantics, verified automatically rather than by sighted review.
- **SC-007**: The component is installable into a fresh consumer project through the project's registry in a single command, with zero manual follow-up edits required to reach a working state.

## Assumptions

- **Creatable entries are out of scope for behavioral parity.** The upstream package (`.reference/diceui/packages/combobox`) and its test suite have no "create new value from typed text" feature — there is no such prop, callback, or demo anywhere upstream. The task brief mentions "creatable entries" as part of the general APG combobox pattern to consider, but since the source of truth (upstream code + tests) has no such capability, this spec does not require it; adding one would be a feature beyond parity, not a port. This is a judgment call given conflicting inputs (task brief vs. upstream reality); upstream reality wins per the project's Upstream-Parity principle (constitution Principle II).
- **Typeahead is realized as live input filtering, not a discrete letter-buffer.** Upstream's "combobox" typeahead is the live-filtering-as-you-type behavior itself (User Story 1), not a separate buffered-letter-jump mechanism (that pattern belongs to the sibling Listbox component, which Combobox does not depend on). FR-004/FR-016 cover this.
- **PageUp/PageDown scope**: upstream only wires `PageUp`/`PageDown` in the component's "modal" display mode. This spec requires that behavior at minimum in modal mode (FR-026) rather than mandating it unconditionally, to stay faithful to upstream rather than over-specifying.
- **RTL arrow-key inversion for badge navigation — deliberate divergence from upstream, required by Constitution Principle III.** Upstream's `ArrowLeft`/`ArrowRight` badge-navigation branches in `combobox-input.tsx` never read `context.dir`, so upstream does not invert under RTL (only the sibling `listbox` package does). Constitution Principle III requires, without exception, that horizontal navigation invert under `dir="rtl"`; Principle II's escape hatch is exactly this — a divergence recorded here with its reason — while Principle III has none. This port therefore inverts badge navigation under `dir="rtl"`: `ArrowRight` moves the highlight toward the last badge (and, from the caret at position 0, highlights the last badge), `ArrowLeft` moves toward later badges and exits back to the input. This matches the in-repo precedent `src/lib/components/ui/tags-input/tags-input.svelte.ts:346-348`. All other keys (`ArrowUp`/`ArrowDown`/`Home`/`End`/`PageUp`/`PageDown`) are direction-independent and are unchanged from upstream.
- **Virtualization is a consumer-composition pattern, not a built-in feature.** The upstream 10,000-item demo layers an external virtualization technique on top of externally-managed filtering; no virtualization capability ships inside the component itself. FR-040 requires the demo page to include a large-list example, but no functional requirement mandates built-in virtualization.
- **Async/loading is a consumer-composition pattern.** There is no built-in fetch/data-source prop; "async" support means the loading-indicator part plus externally-managed filtering compose correctly together (FR-022, FR-023, User Story 4), matching the upstream debounced-search demo exactly.
- Standard defaults are used for anything not explicitly covered above (popover collision handling, positioning offsets, focus-visible styling) — these follow the same headless-primitive composition already used by every other popover-based component in this project (select, dropdown-menu, popover) rather than being reproduced as bespoke Combobox logic.
