# Feature Specification: Port Mask Input Component

**Feature Branch**: `019-port-mask-input`

**Created**: 2026-07-30

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Mask Input\" (slug: mask-input) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Type into a formatted field and see live formatting (Priority: P1)

A person filling out a form field (phone number, date, credit card, SSN, etc.) types raw characters
and immediately sees them arranged into the expected format (parentheses, dashes, slashes, spaces)
as they type, without needing to type the separators themselves.

**Why this priority**: This is the core value of the component — every other capability builds on
reliable live formatting. Without it, the component is just a plain text input.

**Independent Test**: Render the input with a built-in pattern (e.g. `phone`), type digits only,
and confirm the on-screen value and the reported "masked" value match the documented format while
the reported "unmasked" value contains only the raw characters.

**Acceptance Scenarios**:

1. **Given** an empty input configured with the `phone` pattern, **When** the user types
   `1234567890`, **Then** the field displays `(123) 456-7890` and the change notification reports
   both the masked value `(123) 456-7890` and the unmasked value `1234567890`.
2. **Given** an empty input configured with the `date` pattern, **When** the user types `12252023`,
   **Then** the field displays `12/25/2023`.
3. **Given** an empty input configured with the `currency` pattern, **When** the user types
   `1234.56`, **Then** the field displays `$1,234.56` (using the default USD/en-US formatting), and
   changing the `currency`/`locale` inputs produces the equivalent formatting for that currency
   (e.g. EUR in `de-DE`, GBP in `en-GB`, JPY with no decimals).
4. **Given** an input with no `mask` configured, or with masking explicitly turned off, **When**
   the user types any text, **Then** the text passes through unformatted.

---

### User Story 2 - Edit formatted text without fighting the cursor (Priority: P1)

A person editing an already-formatted value — inserting a digit in the middle, deleting a digit
with Backspace or Delete, or pasting a block of text — expects the caret to land where they would
naturally expect, not jump to the end or land inside a literal separator character.

**Why this priority**: Cursor-jumping is the single most common failure of masked-input
implementations and the explicit hard problem called out for this port; getting it wrong makes the
field unusable for editing (not just initial entry).

**Independent Test**: Render the input with a pattern that has multiple literal separators (e.g.
`creditCard`, phone, SSN), type a full value, move the caret to a specific position with
`setSelectionRange`, perform an edit (character insert, Backspace, Delete, or paste), and assert
both the resulting formatted value and the resulting caret position.

**Acceptance Scenarios**:

1. **Given** a fully-populated `creditCard` field (`4242 4242 4242 4242`) with the caret placed
   mid-value, **When** the user presses Backspace, **Then** the digit immediately before the caret
   is removed, the value reformats around the remaining digits, and the caret lands immediately
   after the position of the removed digit in the reformatted value.
2. **Given** the same field, **When** the user then types a replacement digit at that caret
   position, **Then** the value reformats to include the new digit and the caret advances exactly
   one position past the inserted digit (accounting for any separator that now falls between the
   old and new caret position).
3. **Given** a field with the caret positioned exactly before a literal separator (e.g. right after
   the last digit of a group, before the following space or dash), **When** the user types a digit,
   **Then** the new digit is inserted before the separator and the caret ends up after both the
   separator and the digit, per the pattern's layout.
4. **Given** a field with the caret in the middle of a value, **When** the user presses Delete,
   **Then** the digit at (not before) the caret is removed, the value reformats, and the caret
   position does not move.
5. **Given** a field with an existing value and a text selection, **When** the user pastes new
   text over the selection, **Then** the selected range is replaced by the pasted content and the
   whole result is reformatted; for non-currency/percentage patterns the caret lands after the last
   character contributed by the paste. For the `currency` pattern the caret lands just before the
   trailing currency glyph when the symbol trails the number (a currency-at-end locale) or at the
   very end of the value when the symbol leads the number; for the `percentage` pattern the caret
   lands immediately before the trailing `%`. These two currency/percentage paste branches do not
   fire the value-change notification, matching upstream, which returns before committing state for
   them.
6. **Given** a `currency` field with a value formatted with the currency symbol at a fixed edge
   position, **When** the user edits a digit in the middle of the numeric portion, **Then** the
   caret remains anchored near the edited digit rather than jumping to the end of the field.

---

### User Story 3 - Know whether the value I entered is valid (Priority: P2)

A person filling out a masked field wants to know, at the moment configured by the form's
validation strategy (as they type, when they leave the field, only on submit, or only after the
field has been visited once), whether their input satisfies the pattern's rules (e.g. a real
calendar date, a Luhn-valid card number, a percentage between 0 and 100).

**Why this priority**: Validation is documented, tested upstream, and required for the component to
be usable inside real forms, but it is secondary to formatting/cursor behavior — a field that
formats and edits correctly but never validates is still broadly useful; the reverse is not true.

**Independent Test**: Render the input with a built-in or custom pattern that has a `validate`
function, set each of the five validation modes in turn, drive typing and blur through
`userEvent`, and assert the validation callback fires (or does not fire) at the right moments with
the right boolean result.

**Acceptance Scenarios**:

1. **Given** `validationMode="onChange"` (the default), **When** the user types into a field with a
   validating pattern, **Then** the validation callback fires after every value change with the
   current pass/fail result.
2. **Given** `validationMode="onBlur"`, **When** the user types, **Then** the validation callback
   does not fire; **When** the user then moves focus away, **Then** it fires exactly once with the
   result for the value at that time.
3. **Given** `validationMode="onSubmit"`, **When** the user types and blurs, **Then** the
   validation callback never fires automatically (submission-triggered validation is the
   consuming form's responsibility, matching upstream).
4. **Given** `validationMode="onTouched"`, **When** the user types before ever blurring, **Then**
   the callback does not fire on change; **When** the user blurs once, **Then** it fires; **When**
   the user subsequently types again (having been touched), **Then** it now fires on every change.
5. **Given** `validationMode="all"`, **When** the user types and blurs, **Then** the callback fires
   on both events.
6. **Given** a pattern's built-in `validate` function (e.g. `date`, `creditCard` via the Luhn
   algorithm, `creditCardExpiry` relative to the current date, `ipv4`), **When** values at the
   documented valid/invalid boundaries are checked directly, **Then** the function returns the
   documented boolean for each boundary case.

---

### User Story 4 - Use the field with a screen reader, keyboard-only, or right-to-left layout (Priority: P2)

A person using assistive technology, keyboard-only navigation, or a right-to-left language needs the
masked field to behave like a standard accessible text input: reachable and leavable with Tab,
announcing its invalid/required/disabled/read-only state, and laying out mask literals in the
correct reading direction.

**Why this priority**: Accessibility and internationalization are non-negotiable project principles,
but they are additive to the P1 formatting/editing behavior rather than the field's primary purpose.

**Independent Test**: Render the input in isolation and drive it with Tab/Shift+Tab and assistive
attributes assertions; separately render it inside an RTL container and confirm layout direction is
inherited rather than hard-coded.

**Acceptance Scenarios**:

1. **Given** a masked field on a page with other focusable elements, **When** the user presses Tab
   or Shift+Tab, **Then** focus moves to and away from the field exactly like any native text input.
2. **Given** an `invalid`, `disabled`, read-only, or `required` field, **When** inspected via
   accessibility tooling, **Then** the corresponding ARIA/native attributes (`aria-invalid`,
   `disabled`, `readonly`, `required`) and matching `data-*` attributes are present, and a
   `disabled` or read-only field ignores further typing, Backspace/Delete, and paste.
3. **Given** the page direction is right-to-left, **When** the masked field is rendered without any
   direction override of its own, **Then** it inherits RTL layout from its ancestor context rather
   than forcing a fixed direction, matching how other ported inputs in this project handle
   direction.

---

### User Story 5 - Build a new masked field from the same formatting engine (Priority: P3)

A developer composing a more specific input (for example, a future dedicated phone-number component)
wants to reuse the same mask/format/validate/caret logic that powers this component, rather than
re-implementing string-masking and caret-math from scratch.

**Why this priority**: This is a distribution/API requirement rather than an end-user behavior; it
only matters once a second consumer (a future `phone-input` port) exists, but the export shape must
be decided now since it is part of this component's public contract.

**Independent Test**: Import the mask/format module independently of the Svelte component (no
rendering involved) and call its exported functions directly with representative inputs, asserting
on their return values in isolation.

**Acceptance Scenarios**:

1. **Given** the mask engine module, **When** a consumer imports `applyMask`, `applyCurrencyMask`,
   `applyPercentageMask`, `getUnmaskedValue`, `toUnmaskedIndex`, `fromUnmaskedIndex`, and
   `MASK_PATTERNS`, **Then** every one of these is available as a named export independent of the
   Svelte component markup, with the same input/output contract as upstream.
2. **Given** a custom mask pattern object (`{ pattern, transform?, validate? }`) supplied instead of
   a built-in pattern key, **When** it is passed to the component or the engine functions directly,
   **Then** it is honored exactly as a built-in pattern would be.

---

### Edge Cases

- What happens when the pattern is a currency/percentage mask and the user presses Backspace or
  Delete? These patterns manage their own reformatting on every keystroke through the standard
  change path; explicit Backspace/Delete caret-jump handling is skipped for them (matching
  upstream), so the value shortens through the normal reformatting flow instead.
- What happens for the `ipv4` pattern specifically? It has no literal separators to insert
  automatically — the user must type dots themselves — and neither the Backspace/Delete
  caret-math nor the paste-reformatting path apply to it (matching upstream, which returns the
  cleaned value unchanged and skips key/paste interception for this pattern).
- What happens during IME composition (e.g. typing with a Japanese/Chinese/Korean input method)?
  While composition is in progress, the raw composed text passes through unmasked; masking and the
  change notification are applied only once composition ends.
- What happens if the consumer supplies both `value` (controlled) and `defaultValue`? `value`
  being present makes the field controlled and authoritative; `defaultValue` is only consulted when
  `value` is absent (uncontrolled mode), matching every other ported input in this project.
- What happens if a custom `currency` code or `locale` tag is not recognized by the runtime's
  number-formatting support? Formatting falls back to the default currency/locale (USD / en-US)
  rather than throwing or producing a broken display.
- What happens when `maskPlaceholder` is set but the field has no `placeholder`? No placeholder text
  is shown while unfocused; the `maskPlaceholder` text is shown only while focused.
- What happens when both `placeholder` and `maskPlaceholder` are set? The plain `placeholder` shows
  while unfocused; it swaps to `maskPlaceholder` while focused, and swaps back on blur.
- What happens when the field is used with composition-style rendering (rendering as a
  caller-supplied element instead of the built-in styled input)? The masking/validation/keyboard
  behavior still applies; only the rendered element changes.
- What happens with a pattern that has more literal characters than digit slots and the user has
  typed fewer characters than the pattern's slot count? The field shows only the mask characters up
  to the last entered digit (a partial, not a fully padded, mask) — trailing unfilled slots are not
  rendered as blanks or placeholder characters in the value itself.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST render as a single text-entry field that accepts the same standard
  input attributes (placeholder, disabled, readOnly, required, name, id, and other pass-through
  attributes) as any other ported input in this project.
- **FR-002**: The component MUST support both a controlled mode (an externally supplied, bindable
  value that the caller owns) and an uncontrolled mode (an internal value seeded from a default and
  managed internally), matching this project's existing controlled/uncontrolled convention.
- **FR-003**: The component MUST notify the caller of every value change with both the formatted
  ("masked") value and the raw ("unmasked") value.
- **FR-004**: The component MUST ship the following built-in mask patterns, each reproducing its
  documented format string, transform, and validation exactly: `phone`, `ssn`, `date`, `time`,
  `creditCard`, `creditCardExpiry`, `zipCode`, `zipCodeExtended`, `currency`, `percentage`,
  `licensePlate`, `ipv4`, `macAddress`, `isbn`, `ein`.
- **FR-005**: The component MUST accept a fully custom mask definition (a format pattern plus
  optional transform and validate functions) in place of a built-in pattern name, and apply it
  identically to how a built-in pattern is applied.
- **FR-006**: The component MUST support disabling masking entirely for a given field (raw
  passthrough of typed/pasted text with no reformatting).
- **FR-007**: The component MUST reformat the displayed value as the user types, deletes, or
  pastes, and MUST reposition the caret after each such reformat so that editing feels continuous
  rather than jumping to the end of the field, for every non-currency/percentage/ipv4 built-in
  pattern and for custom patterns using the `#`-token pattern syntax.
- **FR-008**: The component MUST support currency-specific formatting driven by a currency code and
  a locale tag, using the runtime's standard internationalization number-formatting facilities, and
  MUST fall back to a documented default currency/locale if the supplied ones are not recognized.
- **FR-009**: The component MUST support a percentage pattern that limits input to a numeric value
  followed by a trailing `%`, capped at two decimal places.
- **FR-010**: The component MUST expose a validation callback that reports whether the current
  unmasked value satisfies the active pattern's validation rule (built-in or custom), gated by a
  selectable validation mode with these five behaviors: validate on every change, validate only on
  blur, never validate automatically (submit-driven), validate on blur until first touched and on
  every change afterward, or validate on both change and blur.
- **FR-011**: The component MUST support an optional secondary placeholder that is shown only while
  the field has focus, distinct from (and able to coexist with) the field's regular placeholder
  shown while unfocused.
- **FR-012**: The component MUST expose `disabled`, read-only, `required`, and `invalid` states,
  each reflected through both the correct native/ARIA attribute and a corresponding `data-*`
  attribute, and `disabled`/read-only MUST suppress all masked-editing interactions (typing,
  Backspace/Delete shortcuts, paste reformatting). This guard is a deliberate divergence from
  upstream, which omits it in its keydown/paste handlers; it is recorded as divergence D-08 (to be
  added to contracts/mask-input.md §7 during implementation).
- **FR-013**: The component MUST derive an appropriate virtual keyboard hint (numeric vs. decimal vs.
  unset) from the active pattern when the caller has not explicitly overridden it, matching
  upstream's per-pattern defaults.
- **FR-014**: The component MUST cap the field's maximum input length to the active fixed pattern's
  total character count when the pattern has a fixed number of fillable slots, and MUST leave the
  maximum length unconstrained (or caller-supplied) for patterns without a fixed slot count
  (currency, percentage).
- **FR-015**: The component MUST correctly handle IME composition sequences: no reformatting or
  change notification occurs mid-composition, and the value is masked and notified once composition
  ends.
- **FR-016**: The component MUST support pasting text into the field, replacing any active selection,
  reformatting the combined result, and placing the caret at the position documented in User Story 2.
- **FR-017**: The component MUST expose the underlying mask/format/validate engine (the built-in
  pattern table and the apply/unmask/caret-index helper functions) as a standalone, independently
  importable module, so that other components in this project can reuse it without rendering this
  component.
- **FR-018**: The component MUST support composing its masked behavior onto a caller-supplied
  element instead of the built-in styled input element.
- **FR-019**: The component MUST be usable inside a right-to-left layout without any RTL-specific
  configuration of its own, inheriting direction from its ancestor context the same way other ported
  inputs in this project do.
- **FR-020**: The component MUST be distributed as source under this project's UI component
  directory with a public index barrel, and MUST be installable through this project's own
  component registry the same way every other ported component is.
- **FR-021**: A documentation demo page MUST exercise every example shown on the upstream
  documentation page: the default/basic patterns demo, the custom-pattern demo, the
  validation-modes demo, the card-information (multi-field) demo, and the form-integration demo.
- **FR-022**: The component MUST forward its `min`/`max` input attributes, numeric-normalised, to
  the active pattern's validate function (e.g. the `percentage` pattern's bounds check).

### Key Entities

- **Mask Pattern**: A named or ad-hoc definition of how raw input becomes a formatted display value.
  Composed of a format string using `#` as a fillable-slot token and any other character as a
  literal, an optional transform function that cleans/normalizes raw input before slots are filled,
  and an optional validate function that judges whether a given unmasked value is acceptable
  (optionally parameterized by extra options such as a min/max range).
- **Masked Value / Unmasked Value**: Every value the field carries has two representations — the
  formatted string shown to and typed by the user (masked), and the underlying raw string with
  literals and formatting removed (unmasked). Both are always reported together on change.
- **Validation Mode**: One of five named strategies (`onChange`, `onBlur`, `onSubmit`, `onTouched`,
  `all`) controlling when the validation outcome is (re)computed and reported.
- **Currency/Locale Context**: The pair of a currency code and a locale tag that together determine
  the symbol, decimal separator, and grouping separator used by the `currency` pattern (and by
  extension anywhere `$`/`€` literals appear in a pattern).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user typing digits into every one of the fifteen built-in patterns sees the
  documented formatted example (e.g. typing `1234567890` into a phone field yields `(123) 456-7890`)
  with zero formatting deviations across a full pass of representative inputs for each pattern.
- **SC-002**: Editing an already-formatted value (inserting, deleting via Backspace, deleting via
  Delete, or pasting) at any interior position leaves the caret within one character of the position
  a person would intuitively expect, in 100% of the scenarios captured in User Story 2, matching the
  upstream test file's assertions exactly.
- **SC-003**: Each of the five validation modes produces the documented fire/no-fire behavior on
  both a change and a subsequent blur, with no false triggers, across all five modes.
- **SC-004**: The component passes an accessibility check confirming Tab/Shift+Tab focus traversal,
  and correct `aria-invalid`/`disabled`/`readonly`/`required` reflection, with zero missing
  attributes relative to the upstream component.
- **SC-005**: The reusable mask engine module can be imported and exercised with zero dependency on
  rendering the Svelte component, confirmed by tests that call its exports directly.
- **SC-006**: The demo page presents a working, interactive example for each of the five upstream
  demo scenarios (basic patterns, custom pattern, validation modes, card information, form
  integration), each demonstrably functional when exercised manually.
- **SC-007**: The ported test suite ports every assertion present in the upstream test file (test-
  for-test parity), plus the additional controlled/uncontrolled and RTL assertions this project's
  conventions require, and the full suite passes with zero skipped or suppressed assertions.

## Assumptions

- **Package boundary**: Upstream ships this component under the "radix" registry base (it imports
  Radix's `Slot` primitive for `asChild` composition and a `compose-refs` utility, not a published
  `@diceui/*` npm package). This port follows the project's existing pattern of composing `bits-ui`
  wherever it already provides equivalent behavior: the `asChild`/composition capability (FR-018) is
  implemented via a `child` snippet in the Svelte port rather than reimplementing a Slot primitive,
  and ref-forwarding uses this project's standard `$bindable(null)` + `bind:this` convention rather
  than a ported `compose-refs` helper. No `compose-refs` utility file is introduced.
- **Locale/currency engine**: "Standard internationalization number-formatting facilities" (FR-008)
  means the JavaScript `Intl.NumberFormat` API, exactly as upstream uses it — this is a web-platform
  API available in the target runtime, not a project-specific abstraction, so composing it directly
  (rather than through a project UI primitive) satisfies the composition-first principle.
  Default currency/locale fallback (used whenever a caller-supplied pair is unsupported) is `USD`
  and `en-US`, matching upstream's constants.
  Following this project's translation table (§10, `useMemo` → `$derived`), the memoized formatter/
  currency-symbol/currency-at-end caches upstream builds with plain `Map` objects are reproduced as
  plain module-level `Map` caches in the ported engine module (not component state), since they are
  pure memoization keyed only on `locale`/`currency`/format options, not reactive Svelte state.
- **Direction/RTL**: This project does maintain a dedicated `direction-provider` primitive
  (`src/lib/components/ui/direction-provider/`), used by components that read direction for
  arrow-key navigation (e.g. `marquee`, `swap`). This component consumes it in no way: it has no
  arrow-key navigation to reverse, and all caret arithmetic is character-index based and
  direction-agnostic. Per FR-019, "using the project's existing direction context where one
  applies" therefore resolves to: no additional direction plumbing is added by this component; it
  inherits `dir` from the surrounding DOM/CSS the same way the project's other plain
  `<input>`-based components (e.g. Tags Input) do, and RTL correctness is verified by rendering
  inside a `dir="rtl"` ancestor and confirming layout (not caret-math) responds correctly.
- **`readonly` prop spelling**: The prop is spelled `readonly` (the `HTMLInputAttributes` spelling),
  not upstream's `readOnly` — recorded as divergence D-03 in contracts/mask-input.md §7. Spec text
  above uses "read-only" to refer to the concept, independent of the prop's exact spelling.
- **`min`/`max` validation options**: Upstream passes `min`/`max` input attributes through to the
  validate function's `ValidateOptions` (parsed from string to number if needed). This port keeps
  that behavior: `min`/`max` on the component are ordinary pass-through HTML attributes on the
  rendered input, additionally forwarded to the custom/pattern validate function when present.
- **Date/time "current date" dependency**: The `date`, `creditCardExpiry`, and implicitly any custom
  pattern using the current date depend on wall-clock time for range validation (e.g.
  `creditCardExpiry`'s "not more than 50 years in the future, not in the past" rule). Ported tests
  reproduce upstream's approach of mocking system time (fake timers) around these assertions so the
  test suite is not flaky against the actual calendar date.
- **Feature-directory scope naming**: The upstream slug and this feature's directory both use
  `mask-input`; no renaming or reinterpretation of the component name is needed.
- **No dedicated icon/visual redesign**: Per the explicit out-of-scope note, the field's visual
  styling matches the existing ported `Input` component's Tailwind classes/semantic tokens
  (background, border, focus ring, disabled/invalid states) rather than introducing new visual
  treatment; only the masking/validation *behavior* is new.
