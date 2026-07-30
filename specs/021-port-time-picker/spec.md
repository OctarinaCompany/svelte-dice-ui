# Feature Specification: Time Picker

**Feature Branch**: `021-port-time-picker`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Time Picker\" (slug: time-picker) to this
SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Type a time directly into the field (Priority: P1)

A person filling out a form (an appointment slot, a reminder, a shift start time) clicks into the time
field and types digits straight through — hour, then minute, then (optionally) seconds and AM/PM — the
same way they would type into a native `<input type="time">`, without ever opening a dropdown.

**Why this priority**: This is the component's primary, always-visible interaction surface. Every other
capability (the dropdown, the trigger, form submission) exists to support or supplement this flow; without
it the component is not a time picker.

**Independent Test**: Render a time picker with an empty value, focus the hour segment, type two digits,
confirm focus auto-advances to the minute segment, type two more digits, confirm the combined value now
reads as a 24-hour `"HH:mm"` string and matches what the visible hour/minute segments display in the
active 12-hour or 24-hour format.

**Acceptance Scenarios**:

1. **Given** an empty time picker, **When** the user types a single digit into the hour segment that could
   still be followed by a second digit (e.g. "1"), **Then** the segment shows that digit zero-padded
   ("01") and waits briefly for a second digit before advancing, exactly as a native time input does.
2. **Given** an empty time picker, **When** the user types a digit into the hour segment whose value could
   not be extended by a second digit without exceeding the maximum (e.g. "9" in 24-hour mode), **Then**
   the segment immediately zero-pads and focus auto-advances to the next segment.
3. **Given** a time picker with a value already set, **When** the focused segment has its full value
   selected and the user presses `ArrowUp` or `ArrowDown`, **Then** the segment's value increments or
   decrements by **one unit** and **wraps around** at its boundary (hour `23 → 00` /
   `00 → 23` in 24-hour mode, `12 → 1` / `1 → 12` in 12-hour mode; minute and second `59 → 00` / `00 →
   59`), with the new value re-selected so repeated presses keep working.
4. **Given** a 12-hour format time picker, **When** the AM/PM segment is focused and the user presses `A`,
   `P`, `1`, `2`, `ArrowUp`, or `ArrowDown`, **Then** the segment's period toggles between `AM` and `PM`
   accordingly and the stored 24-hour value updates to match.
5. **Given** a time picker with a value already set, **When** the user selects a segment's full text and
   presses `Backspace` or `Delete`, **Then** that segment reverts to its placeholder and is removed from
   the stored value, leaving every other segment's value untouched.
6. **Given** any segment, **When** the user presses `Enter`, **Then** the in-progress edit is committed
   and the segment stays focused with its full text re-selected; **when** the user presses `Escape`
   instead, **Then** the edit is discarded, the segment reverts to its last committed value, and the
   segment blurs.

---

### User Story 2 - Pick a time from a dropdown list (Priority: P2)

A person who would rather browse than type clicks the clock trigger, gets a popover with one scrollable
column per active segment (hour, minute, optionally seconds, and AM/PM for 12-hour locales), and selects a
value from each column with mouse, touch, or keyboard.

**Why this priority**: This is the component's secondary, convenience interaction surface — explicitly
described upstream as "for easier selection with mouse/touch." The field is fully usable through User
Story 1 alone, so this is valuable but not load-bearing for MVP.

**Independent Test**: Render a time picker with a value already set, open it via the trigger, confirm the
value's hour/minute (and second, if enabled) are pre-highlighted/selected in their respective columns and
focus lands on the highlighted hour item, then click a different minute value and confirm the field's
displayed value and stored value both update while the popover stays open.

**Acceptance Scenarios**:

1. **Given** a closed time picker with a value set, **When** the user opens it via the trigger, **Then**
   focus moves into the popover onto the currently selected item of the first column (the generated
   columns always mark one item selected, falling back to the current clock time when the field is empty;
   a hand-composed column with no selected item falls back to its first item).
2. **Given** an open popover, **When** the user presses `ArrowUp`/`ArrowDown` while a column item is
   focused, **Then** focus moves to the previous/next item in that same column and **wraps around** at the
   column's first/last item.
3. **Given** an open popover, **When** the user presses `ArrowLeft`/`ArrowRight` or `Tab`/`Shift+Tab`
   while a column item is focused, **Then** focus moves to the equivalent (selected, or first) item of the
   previous/next column, wrapping from the last column back to the first and vice versa.
4. **Given** an open popover, **When** the user clicks or activates (`Enter`/`Space`) a column item,
   **Then** that segment's value is set immediately, the item is marked selected, and the popover remains
   open so the user can continue picking other segments.
5. **Given** a time picker with `showSeconds` unset (the default), **When** the popover opens, **Then** no
   seconds column is rendered; **given** `showSeconds` is set, **Then** a seconds column is rendered
   alongside hour and minute.
6. **Given** a 24-hour locale (no AM/PM), **When** the popover opens, **Then** no period column is
   rendered; the hour column instead lists every hour from the configured step across the full 0–23 range.

---

### User Story 3 - Configure format, granularity, and labelling (Priority: P3)

A developer integrating the component sets it up to match a specific use case: a locale that determines
12-hour vs. 24-hour display automatically, coarser selection granularity (e.g. 15-minute appointment
slots), custom empty-segment placeholders, and a clear affordance to reset the field — without writing any
locale-detection or formatting code themselves.

**Why this priority**: These are configuration surfaces layered on top of User Stories 1–2; the component
is fully functional with every configuration option left at its default, so this is the lowest-priority
slice, though it is directly required by several of upstream's documented examples.

**Independent Test**: Render three time pickers side by side — one left at defaults, one with
`minuteStep={15}` and `secondStep={10}` plus `showSeconds`, and one with custom `segmentPlaceholder`
values — and confirm each renders and behaves according to its own configuration independently of the
others (no shared state, no configuration leaking).

**Acceptance Scenarios**:

1. **Given** no explicit `locale` prop, **When** the component determines whether to render 12-hour
   (with an AM/PM segment/column) or 24-hour format, **Then** it derives that decision from the runtime's
   locale settings through the standard internationalization API, never from a hard-coded list of locale
   codes.
2. **Given** an explicit `locale` prop (e.g. `"en-US"` or `"en-GB"`), **When** the component renders,
   **Then** it uses that locale's 12-hour/24-hour convention instead of the runtime's ambient locale,
   while the stored value remains 24-hour `"HH:mm"`/`"HH:mm:ss"` regardless of display format.
3. **Given** `minuteStep={15}`, **When** the popover's minute column is rendered, **Then** it offers only
   multiples of 15; inline `ArrowUp`/`ArrowDown` on the minute segment still moves by one minute, and
   typing a minute mid-interval is accepted and stored as typed (the step constrains the offered column
   list only).
4. **Given** a custom `segmentPlaceholder` (a single string applied to every segment, or a per-segment
   object), **When** a segment has no value yet, **Then** it displays the configured placeholder instead
   of the default `"--"`.
5. **Given** a time picker with a value set, **When** the user activates the clear control, **Then** the
   stored value resets to empty and every segment reverts to its placeholder.

---

### Edge Cases

- Typing a value that leaves some segments unset (e.g. only the hour is typed) MUST be representable and
  stored as a **partial** time value while mid-edit; already-committed segments keep their own independent
  value and are not clobbered by an in-progress edit on another segment.
- Wrap-around MUST be exact at every boundary: hour `23 → 00` and `00 → 23` in 24-hour mode; hour `12 → 1`
  and `1 → 12` in 12-hour mode; minute/second `59 → 00` and `00 → 59`; AM/PM toggles with no third state.
- A segment left at its placeholder when the field loses focus, where at least one other segment now has a
  value, MUST be backfilled from the current time (current hour/minute/second as applicable) rather than
  left blank, matching the native-`<input type="time">`-like behavior upstream documents.
- Disabled or read-only state MUST suppress all editing — typing, arrow-key stepping, clearing, **and
  dropdown column selection** — while still allowing the field to be focused and its value read/announced.
  Upstream suppresses only typing, group pointer handling and `Clear` under `readOnly`; column items there
  still commit (see divergence D-17).
- Switching `showSeconds` at runtime MUST add or remove the seconds segment and column without requiring
  the caller to remount the component, and MUST NOT invent a seconds value that was never set.
- Rendering under a right-to-left context (or an explicit `dir="rtl"`) MUST invert which arrow key moves
  focus toward the visual end of the input group and of the popover's column row, mirroring the existing
  `segmented-input` component's RTL handling.
- A pasted value is explicitly **out of scope** for automatic per-segment distribution: upstream does not
  implement or document paste handling for this component (unlike `segmented-input`'s paste-distribution
  feature), so a paste into a segment falls through to the browser's normal single-field paste behavior.
- `min`/`max` are accepted as props for API parity with upstream but, matching upstream's own vendored
  implementation, are not enforced as a clamp or validation rule anywhere in this component; a caller who
  needs range validation composes it externally (e.g. via the `invalid` prop) exactly as with upstream.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide a root component that holds a time value as a string in `"HH:mm"`
  (or `"HH:mm:ss"` when seconds are enabled) 24-hour format, supporting both controlled (`value` +
  `onValueChange`) and uncontrolled (`defaultValue`) usage, and a controlled/uncontrolled open state for
  its dropdown (`open`/`defaultOpen` + `onOpenChange`).
- **FR-002**: The root MUST accept `disabled`, `readOnly`, `required`, and `invalid` flags that apply to
  the whole field (every segment, the trigger, and the dropdown). `disabled`, `readOnly` and `invalid`
  MUST each be exposed as a corresponding `data-*` attribute for styling; `required` is reflected onto the
  hidden form input only, matching upstream (the segments are not individually required).
- **FR-003**: The root MUST accept `hourStep`, `minuteStep`, and `secondStep` (default `1` each) that
  govern **only** the set of values offered in the corresponding dropdown column (hour: `⌈12/hourStep⌉`
  items in 12-hour format, `⌈24/hourStep⌉` in 24-hour; minute/second: `⌈60/step⌉` items). Inline
  `ArrowUp`/`ArrowDown` stepping inside a segment input MUST always move by exactly **one** unit
  regardless of these props, matching upstream (`time-picker.tsx:1319-1334` and `1361-1376`, where the
  step props are never read).
- **FR-004**: The root MUST accept a `segmentPlaceholder` prop — either a single string applied to every
  segment or an object with independent `hour`/`minute`/`second`/`period` placeholders — defaulting to
  `"--"`, shown whenever a segment has no committed value.
- **FR-005**: The root MUST accept `showSeconds` (default `false`) controlling whether a seconds segment
  and dropdown column are rendered, and `min`/`max` string props accepted for upstream API parity (see
  Edge Cases for their scope).
- **FR-006**: The root MUST determine whether to display 12-hour (with an AM/PM segment/column) or
  24-hour format by querying the runtime's internationalization API for the active or explicitly-provided
  `locale`, never from a hard-coded table of locale codes; the stored value format is always 24-hour
  regardless of the detected/explicit display format.
- **FR-007**: The root MUST integrate with native HTML forms: given a `name`, it MUST submit its current
  string value (empty string when unset) as if it were a hidden form field, and MUST reflect `disabled`,
  `readOnly`, and `required` onto that form participation.
- **FR-008**: The system MUST provide a label part that associates with the field's interactive group for
  assistive technology, following this project's existing label-association pattern.
- **FR-009**: The system MUST provide an input-group part that visually and semantically groups the
  segment inputs and the trigger as one field (`role="group"`, group-labelled by the label part), exposes
  the placeholder-driven per-segment width as CSS custom properties consumable/overridable by callers, and
  implements the root's `inputGroupClickAction` prop — `"focus"` (default: clicking empty space in the
  group focuses and selects the first segment) or `"open"` (clicking empty space opens the dropdown
  instead), without intercepting clicks that land on a segment input or the trigger itself.
- **FR-010**: The system MUST provide a segment input part (`segment="hour" | "minute" | "second" |
  "period"`) that:
  - Displays that segment's current value zero-padded, or its configured placeholder when unset.
  - Accepts direct digit entry (numeric segments) or `A`/`P`/`1`/`2` (period segment) with the native
    `<input type="time">`-style auto-pad and auto-advance behavior described in User Story 1.
  - Increments/decrements with wraparound on `ArrowUp`/`ArrowDown`, selecting the new value afterward.
  - Clears to placeholder on `Backspace`/`Delete` when the segment's full text is selected.
  - Commits the in-progress edit and **re-selects the segment's full text, keeping focus**, on `Enter`;
    discards the in-progress edit, reverts to the last committed value and **blurs** on `Escape` (upstream
    `time-picker.tsx:1272-1297`; the upstream MDX row claiming `Enter` removes focus describes behaviour
    upstream does not implement — see divergence D-16).
  - Selects its full text on focus and on click, so typing or arrow-stepping always replaces the whole
    segment rather than inserting into it.
- **FR-011**: Movement between segment inputs with `ArrowLeft`/`ArrowRight` (direction-aware, bounded —
  no wraparound past the group's first/last segment) MUST be implemented by composing this project's
  existing reusable segment-navigation module (already extracted for and exported by the `segmented-input`
  component) rather than re-implementing equivalent focus-management logic; `Tab`/`Shift+Tab` uses the
  browser's native tab order between segments and MUST first commit the in-progress edit of the segment
  being left, zero-padding a single typed digit (upstream `time-picker.tsx:1252-1267`).
- **FR-012**: The system MUST provide a trigger part (a button, defaulting to a clock icon when no
  children are supplied) that opens/closes the dropdown, is disabled together with the field's own
  `disabled` state, and exposes its open/closed state as a data attribute.
- **FR-013**: The system MUST provide a content part — the dropdown container, positioned relative to the
  input group — that, on open, moves focus onto the first column's currently-selected item (the generated
  columns always mark one item selected, falling back to the current clock time when the field is empty; a
  hand-composed column with no selected item falls back to its first item), unless the dropdown was opened
  as a side effect of the field receiving keyboard focus (see FR-016), in which case focus stays on the
  segment input. The content part MUST accept `side` (default `bottom`), `align` (default `start`) and
  `sideOffset` (default `6`) and forward them to the underlying positioning primitive.
- **FR-014**: The system MUST provide a generic column part and a column-item part such that:
  - `ArrowUp`/`ArrowDown` moves focus to the previous/next item within the same column, **wrapping**
    around at the column's first/last item, and **activates** the item it lands on (so arrowing through a
    column commits each value as it passes), matching upstream (`time-picker.tsx:1777-1779`).
  - `ArrowLeft`/`ArrowRight` (direction-aware) and `Tab`/`Shift+Tab` move focus to the equivalent item
    (selected, or first) of the adjacent column, **wrapping** from the last column to the first and vice
    versa.
  - Activating an item (click, `Enter`, or `Space`) commits that segment's value immediately without
    closing the dropdown, marks the item as the column's selected item, and **backfills any still-unset
    hour/minute (and second when `showSeconds` is enabled) from the current time**, matching upstream
    (`time-picker.tsx:1897-1907`).
  - The column-item part MUST accept `value` (required), `selected` (default `false`) and `format`
    (`'numeric' | '2-digit'`, default `'numeric'`), rendering a numeric value zero-padded only under
    `'2-digit'`.
- **FR-015**: The system MUST provide four purpose-built column parts — hour, minute, second, and period —
  each composing the generic column/column-item parts, generating their offered values from the
  corresponding step and the active 12-hour/24-hour format (hour), or from the corresponding step alone
  (minute/second); the period column MUST render nothing when the active format is 24-hour, and the
  second column MUST only be rendered by the caller when `showSeconds` is enabled (matching the layout
  composition upstream demonstrates). The hour, minute and second column parts MUST each accept a
  `format` prop (`'numeric' | '2-digit'`) defaulting to `'numeric'` for hour and `'2-digit'` for minute
  and second, forwarded to every item they generate.
- **FR-016**: The root MUST accept an `openOnFocus` prop (default `false`) that, when set, opens the
  dropdown automatically the first time any segment input receives keyboard focus, without stealing focus
  away from that input, and MUST NOT reopen on every subsequent focus event while the dropdown is already
  open from that same focus.
- **FR-017**: The system MUST provide a separator part (default content `":"`, `aria-hidden`) for visual
  separation between segments, and a clear part (a button, default label "Clear") that resets the stored
  value to empty and is suppressed by `disabled`/`readOnly`.
- **FR-018**: Every part that upstream exposes an escape hatch on (the root, and any part with an
  equivalent upstream `asChild`) MUST support this project's existing `child`-snippet composition pattern,
  letting a caller render a different underlying element while the part retains its role, resolved state,
  data attributes, and context participation.
- **FR-019**: The system MUST be distributed as an installable item through the project's own component
  registry, with a public entry point exporting every part, mirroring every other first-party component
  already shipped this way.
- **FR-020**: A demo page MUST exist exercising every example shown on the upstream documentation page:
  the default layout, custom step intervals, seconds enabled, custom placeholders, `openOnFocus`, both
  `inputGroupClickAction` modes, controlled state, and use inside a validated form.

### Key Entities

- **Time Picker Root**: The controller for the field's value (a 24-hour time string, possibly partial
  while mid-edit), its open/closed dropdown state, and the shared configuration (steps, placeholders,
  format detection, disabled/read-only/required/invalid) every part reads from.
- **Segment**: One editable unit of the time value — hour, minute, second, or period (AM/PM) — with its
  own displayed value or placeholder, independently focusable and steppable.
- **Segment Navigation Behavior**: The reusable, markup-independent focus-management unit (already
  extracted from and exported by `segmented-input`) that governs bounded, direction-aware
  `ArrowLeft`/`ArrowRight` movement between the input group's segments.
- **Dropdown Column**: A scrollable list of selectable values for one segment (hour, minute, second, or
  period), with its own wrap-around up/down navigation and cross-column left/right/tab navigation.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A person can enter a complete time using only the keyboard, typing digits through every
  segment in sequence with automatic advancement, in under 5 keystrokes for a simple `HH:MM` 12-hour value
  (e.g. "0930A"), with no pointer interaction required.
- **SC-002**: 100% of the documented wrap-around boundaries (hour `23↔00` in 24-hour mode, hour `12↔1` in
  12-hour mode, minute/second `59↔00`, and the AM/PM toggle) behave correctly on the first keyboard
  attempt, in both the inline segments and the dropdown columns.
- **SC-003**: A person who opens the dropdown for a field that already has a value sees that value
  pre-highlighted in every relevant column with zero additional clicks needed to locate it.
- **SC-004**: The displayed 12-hour-vs-24-hour format matches the runtime's (or explicitly configured)
  locale convention with no manual configuration required for the common case, and remains stable
  (unaffected by display format) as a 24-hour string wherever the value is read programmatically.
- **SC-005**: Every example shown on the upstream documentation page has a working, visually equivalent
  counterpart on this project's documentation site.
- **SC-006**: The component installs and renders correctly through the project's own registry installation
  path with zero manual edits required after installation.
- **SC-007**: Every keyboard interaction and ARIA role/state documented for this component behaves
  identically under a right-to-left reading direction, with only the left/right arrow-key mapping mirrored.

## Assumptions

- Upstream's `TimePicker` root accepts `min`/`max` string props but its own vendored implementation never
  reads them to clamp, validate, or otherwise constrain typed or selected values — they are stored on
  context and otherwise unused. This port matches that actual (not merely documented) behavior: the props
  are accepted for API parity, and no validation or clamping is added, since inventing enforcement upstream
  never implemented would be a behavioral addition outside this port's scope, not a gap the WAI-ARIA
  Authoring Practices require closing (Principle III's floor is about accessibility semantics, not business
  validation logic).
- Locale-driven 12-hour/24-hour detection is implemented via `Intl.DateTimeFormat(locale, { hour: "numeric"
  }).format(...)` inspection (mirroring upstream's `getIs12Hour` helper) rather than any hard-coded list of
  locale codes, per the explicit component-specific guidance for this port.
- The reusable segment-navigation module already extracted for `segmented-input`
  (`src/lib/components/ui/segmented-input/segment-navigation.svelte.ts`) is imported and composed for the
  input group's `ArrowLeft`/`ArrowRight` bounded, direction-aware movement between segments, per the
  explicit component-specific guidance for this port and per `segmented-input`'s own spec, which states
  this module was extracted specifically so a future Time Picker could reuse it. The dropdown's column
  navigation (wrap-around `ArrowUp`/`ArrowDown` within a column, wrap-around cross-column
  `ArrowLeft`/`ArrowRight`/`Tab`) is a distinct behavior — a grid/listbox-style navigation, not a bounded
  linear one — and is implemented as its own state, not forced into the linear segment-navigation module.
- Upstream does not implement or document paste-distribution behavior for this component (unlike
  `segmented-input`), so none is added here; a paste into a segment input falls through to normal
  single-field browser paste handling, matching upstream exactly.
- Upstream's `asChild` (via Radix `Slot`) on the root and other composable parts maps to this project's
  existing `child`-snippet pattern (see `dialog-content.svelte` and CLAUDE.md §10), not to a
  re-implemented slot primitive.
- Context sharing (root configuration, the value/open store, the input-group's segment registry, the
  content's column registry, a column's item registry) is implemented with this project's Symbol-keyed
  context pattern (CLAUDE.md §5), matching every other compound component already ported, rather than
  upstream's bare React context objects and external store.
- The dropdown/content part composes this project's existing `popover` primitive (already used by other
  ported components) for positioning, focus containment, and dismiss behavior, rather than re-implementing
  anchor positioning — consistent with Principle IV (Composition Over Reimplementation).
- The hidden-input form-participation part (upstream's `VisuallyHiddenInput`) is composed from this
  project's existing visually-hidden utility pattern rather than reintroduced as component-specific code,
  if such a utility already exists in the codebase; otherwise a minimal equivalent scoped to this component
  is added, consistent with Principle IV.
- Direction (`dir`) resolution for both the input-group's segment navigation and the dropdown's column
  navigation composes the project's existing `direction-provider` component
  (`src/lib/components/ui/direction-provider`) for the ambient/context case, with an explicit `dir` prop on
  the root taking precedence — mirroring `segmented-input`'s own resolution and upstream's own
  `DirectionPrimitive.useDirection` fallback behavior.
- Only the eight documented upstream examples (default, step intervals, seconds, custom placeholders,
  open-on-focus, input-group click action, controlled, and form) are in scope for the demo page; no
  additional demos are invented beyond what upstream's docs page shows.
- A single "base"-style variant is produced (this project has one existing `input`/`popover` primitive
  set, not separate "base" and "radix" styling engines), matching the approach already taken for
  `segmented-input` and every other multi-style upstream component ported into this project.

### Recorded divergences from upstream (Principle II)

Finalized during planning; the full rationale for each is in `plan.md` and `research.md`. Seventeen
divergences are recorded:

- **D-01 — `ref` is not populated when the `child`-snippet escape hatch is used**, matching every other
  ported component in this project (upstream's `asChild` forwards a ref onto the caller's element; a
  `child` snippet hands the caller the element and props directly instead).
- **D-02 — context and internal store use this project's Symbol-keyed context pattern** instead of
  upstream's bare `React.createContext` objects plus an external `useSyncExternalStore`-based store,
  since Svelte 5 runes make an external store layer unnecessary.
- **D-03 — cross-segment and cross-column keyboard navigation compose shared, reusable state modules**
  (the existing `segment-navigation` module for the input group; a new column-navigation unit for the
  dropdown) rather than the inline, per-component `useCallback` handlers upstream writes directly inside
  `TimePickerInput`/`TimePickerColumnItem`, matching this project's established pattern of factoring
  reactive behavior into `.svelte.ts` state classes (CLAUDE.md §4).
- **D-04 — `Column` / `ColumnItem` are exported parts** (module-private upstream) — Principle V (one part
  per file) plus FR-014.
- **D-05 — horizontal arrows invert under RTL** in both the input group and the dropdown (upstream reads
  raw DOM order) — R-16, SC-007, Principle III.
- **D-06 — a nullable `editValue` replaces upstream's `isEditing` flag and its resync `useEffect`** —
  R-12.
- **D-07 — `data-readonly` is emitted** on root/input group/trigger (documented in the upstream MDX,
  unimplemented upstream) — R-17.
- **D-08 — the `child` snippet is supported on `Input`** (documented upstream via `CompositionProps`,
  unimplemented) — R-20.
- **D-09 — `rounded-lg` replaces upstream's `rounded-md`** on the input group — this repo's radius scale,
  R-21.
- **D-10 — `<TimePicker.Label>` carries `id={labelId}` and `for={inputGroupId}`**, replacing upstream's
  `htmlFor={labelId}`, whose `aria-labelledby` resolved to nothing — R-19.
- **D-11 — each segment input gets a caller-overridable default `aria-label`** (upstream ships four
  unnamed inputs) — R-18, Principle III.
- **D-12 — extra `data-segment` / `data-placeholder` / state attributes on `Input`** — Principle VIII.
- **D-13 — a `dir` prop is added to the root** to head the direction-resolution chain — R-16.
- **D-14 — `getTimePickerContext()` replaces upstream's `useStore as useTimePicker`** — runes have no
  external store, R-01.
- **D-15 — `<TimePicker.Clear>` composes `Button variant="ghost" size="sm"`** instead of an inline class
  list that already is that variant — Principle IV, R-21.
- **D-16 — `Enter` keeps focus, `Escape` blurs**, following upstream's vendored source rather than its
  MDX keyboard table, which claims `Enter` "confirms and removes focus." The source is authoritative for
  behaviour; the MDX row is a documentation defect.
- **D-17 — `readOnly` also suppresses dropdown column selection.** Upstream's `TimePickerColumnItem`
  select handlers (`time-picker.tsx:1878-2131`) write the value even while the root is `readOnly`, which
  contradicts the flag's own documented meaning and lets a mouse user mutate a read-only field. This port
  gates every column commit on `readOnly` (and `disabled`) instead.
