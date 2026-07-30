# Feature Specification: Port Phone Input

**Feature Branch**: `020-port-phone-input`

**Created**: 2026-07-30

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Phone Input\" (slug: phone-input) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Type an international phone number and see it formatted (Priority: P1)

A person filling in a form types digits into the phone field and sees them grouped into a readable
international format as they type, with a leading `+` and the dial code separated from the rest of
the number, without having to type spaces or punctuation themselves.

**Why this priority**: Formatting-as-you-type is the component's core value; without it, this is just
a text input, and the port would deliver nothing that a plain `<Input type="tel">` doesn't.

**Independent Test**: Render the component standalone, type `14085551234` into the field, and confirm
the displayed value reads as a formatted number (dial code separated from the grouped remainder) while
the underlying value exposed to the form is the unformatted `+14085551234`.

**Acceptance Scenarios**:

1. **Given** an empty, uncontrolled phone field, **When** the user types digits, **Then** the field
   displays them grouped into an international format (dial code, then the remaining digits grouped in
   threes) and prefixes the value with `+`.
2. **Given** a field with an existing value, **When** the user pastes a number that already starts with
   `+`, **Then** non-digit characters other than the leading `+` are stripped and the result is
   reformatted.
3. **Given** a field with digits typed, **When** the user deletes characters, **Then** the displayed
   formatting is recomputed from the remaining digits rather than leaving stale separators behind.

---

### User Story 2 - Pick a country from a searchable dropdown (Priority: P1)

A person filling in a form who does not want to type a full international number opens a country
picker, searches for their country by name, dial code, or ISO code, and selects it, which sets the
number's dial code and updates the trigger to show that country's flag.

**Why this priority**: Country selection is the second half of the component's identity (it is a
compound component named `PhoneInput` + `PhoneInputCountrySelect` + `PhoneInputField`); without it the
component cannot disambiguate numbers that share a leading digit across countries (e.g. `+1` for both
the US and Canada).

**Independent Test**: Render the full compound component, open the country select trigger, type a
partial country name into the search box, select a filtered result, and confirm the trigger's flag
updates and the field's value now carries that country's dial code.

**Acceptance Scenarios**:

1. **Given** the country select trigger, **When** the user activates it with a click or with
   `Space`/`Enter`, **Then** a popover opens containing a searchable, scrollable list of countries.
2. **Given** the open country list, **When** the user types text, **Then** the list filters to
   countries whose name, dial code, or ISO code matches, and shows a documented empty state when
   nothing matches.
3. **Given** the open country list, **When** the user selects a country (by pointer or by `Enter` on a
   highlighted item), **Then** the popover closes, focus returns to the phone number field, and the
   selected country becomes the active one (flag shown on the trigger, checkmark shown next to the
   selected item when reopened).
4. **Given** the open country list, **When** the user presses `Escape`, **Then** the popover closes
   without changing the selected country.

---

### User Story 3 - Automatic country detection from a pasted or typed number (Priority: P2)

A person who pastes or types a full international number (e.g. `+33612345678`) sees the country
selector automatically switch to the matching country without having to open the dropdown themselves.

**Why this priority**: This is a documented behaviour that meaningfully improves the primary flow, but
the component is still usable without it (the user can always pick the country manually), so it ranks
below the two compound-component fundamentals above.

**Independent Test**: Render the component with no country selected, type a number starting with `+`
and a recognizable dial code followed by enough digits to disambiguate it, and confirm the country
selector's flag updates to the detected country without any manual selection.

**Acceptance Scenarios**:

1. **Given** an empty field, **When** the user types a value starting with `+` followed by a dial code
   that unambiguously matches one country, **Then** that country becomes selected automatically.
2. **Given** an empty field, **When** the user types enough digits (without a leading `+`) that the
   number is 10 or more digits long, **Then** country detection runs against those digits the same way.
3. **Given** a number whose dial code is shared by multiple countries (e.g. `+1`), **When** none of the
   extra digits disambiguate a more specific match, **Then** the country whose code is `US` is preferred
   over other `+1` countries.
4. **Given** a partially typed number whose digits do not (yet) match any country's dial code,
   **When** detection runs, **Then** the previously selected country is left unchanged rather than being
   cleared.

---

### Edge Cases

- Typing a number with no recognizable dial code (fewer than 3 digits, or digits matching no entry in
  the country table) leaves formatting to fall back to grouping the raw digits in threes after a
  best-effort dial-code guess, without detecting or changing the selected country.
- Clearing the field back to empty resets the displayed value to empty and leaves the previously
  selected country as-is (detection only runs on non-empty input, never on empty input).
- A caller-supplied `countries` list that omits the currently selected/detected country still renders
  that country's dial code in the field; the trigger shows the flag-less placeholder swatch because no
  matching entry exists to source a flag or name from.
- `disabled` suppresses all interaction on both the field and the country trigger, and is reflected as
  inert, non-focusable controls plus the shared `[data-disabled]` state.
- `readOnly` allows focus and text selection on the field but suppresses edits (upstream's combined
  `isReadOnly` guard on the field's change handler). It deliberately does **not** disable the country
  trigger: upstream's `PhoneInputCountrySelect` never reads `readOnly`, so the dropdown still opens and a
  country can still be selected while the field is read-only. Only `disabled` inerts the trigger.
- `required` and `invalid` are reflected as ARIA attributes (`aria-required`, `aria-invalid`) on the
  field and drive the shared destructive-state styling on the root and the field, without upstream
  performing any of its own phone-number validation.
- Rendering `PhoneInputCountrySelect` or `PhoneInputField` outside a `PhoneInput` ancestor throws a
  descriptive error naming the missing provider, matching every other compound component in this
  project.
- Submitting the enclosing `<form>` includes the phone value under `name` even though the visible field
  never carries a `name` attribute itself (the value lives in a hidden form-associated input), and the
  hidden input is omitted entirely once the root is attached and has no ancestor `<form>` (it is present
  before mount, matching upstream's `isFormControl` default).
- With `dir="rtl"`, the country trigger and field keep their logical (start/end) order rather than a
  hard-coded left/right order, and the list navigation and search interactions are unaffected by
  direction (this widget has no left/right arrow-key navigation to invert).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST be usable as a compound API: a root that provides shared state, a
  country-select trigger/popover part, and a text-field part, composed by the consumer exactly as
  upstream documents (`PhoneInput` containing `PhoneInputCountrySelect` and `PhoneInputField`). The root
  MUST also support replacing its rendered element via a `child` snippet (this project's `asChild`
  equivalent), which receives the root's computed props (`role`, `data-*` state attributes) so a
  caller-supplied element can render in the root's place without losing that state.
- **FR-002**: The root MUST support both uncontrolled (`defaultValue`) and controlled (`value` +
  `onValueChange`) usage for the phone number, and both uncontrolled (`defaultCountry`) and controlled
  (`country` + `onCountryChange`) usage for the selected country, independently of each other.
- **FR-003**: The field MUST normalize every edit into a canonical value of digits only, prefixed with
  `+` whenever the user's input started with `+` or already contains digits, and MUST re-derive the
  formatted display value (dial code separated from the remaining digits, which are grouped in threes)
  from that canonical value on every change.
- **FR-004**: The root MUST accept a caller-supplied `countries` list and MUST otherwise default to a
  built-in list covering the same country set as upstream (ISO 3166-1 alpha-2 code, localized display
  name, `+`-prefixed dial code, and a flag emoji derived from the ISO code), sorted by display name.
- **FR-005**: The root MUST automatically select the best-matching country when the phone value is
  non-empty **and** either (a) the raw text the user last typed or pasted began with `+`, or (b) the
  value's digit count — measured as upstream does, over `value.slice(1)`, so one leading character is
  always dropped — is 10 or more. Detection MUST resolve ties in favour of `US` when the matched dial
  code is `+1` and multiple countries share it, MUST leave the current selection unchanged when no
  country matches, and MUST NOT run on an empty value. The `+`-prefix condition tracks the *user's
  input*, not the canonical value (which is always `+`-prefixed once it holds a digit).
- **FR-006**: The country-select trigger MUST open a searchable list (filterable by country name, dial
  code, or ISO code) in a popover, MUST show the active country's flag (unless `showFlag` is `false` or
  no matching country/flag exists), MUST show a check mark against the currently selected entry, and
  MUST close and return focus to the phone field after a selection is made. The popover's open state
  MUST support both uncontrolled (internal state) and controlled (`open` + `onOpenChange`) usage; when
  the caller supplies `open`, it takes precedence over the internal state, and a caller's `onOpenChange`
  fires alongside the internal handler rather than replacing it.
- **FR-007**: Selecting a country MUST update the selected-country state (`country`/`onCountryChange`)
  and MUST NOT itself alter the digits already present in the phone value.
- **FR-008**: The root MUST expose `disabled`, `readOnly`, `required`, `invalid`, `showFlag`, `name`,
  `placeholder`, and `id` (defaulting to a generated id when not supplied), each applied to both the
  trigger and the field per the acceptance scenarios and edge cases above, and MUST reflect
  `disabled`/`invalid`/`readOnly` as data attributes on the root element (`data-disabled`, `data-invalid`,
  `data-readonly`) using the project's presence-based convention (attribute present when true, absent
  otherwise). The root's `placeholder` takes precedence over a `placeholder` passed directly to the field
  part. `disabled`, `readOnly`, and `required` set directly on `PhoneInputField` (or `disabled` on
  `PhoneInputCountrySelect`) are OR-ed with the root's own value rather than replacing it. Attributes
  passed through `restProps` on the root (e.g. a caller-supplied `role` or `data-*`) take precedence over
  the component's own `role="group"`/`data-*` defaults.
- **FR-009**: The component MUST submit the canonical (unformatted) phone value through a
  visually-hidden, form-associated input rendered whenever the root is form-associated — i.e. before the
  root element is attached, or once attached when it has an ancestor `<form>` — carrying `name` when one
  is supplied, plus `disabled`, `required` and `readonly`, without requiring the visible field to carry
  the `name` itself. The hidden input MUST NOT be rendered once the root is known to have no ancestor
  `<form>`, and MUST dispatch a bubbling `input` event on every value change so form libraries observe it.
- **FR-010**: The field MUST expose the semantics of a telephone input (an input whose type and input
  mode communicate "telephone number" to assistive technology and virtual keyboards) and MUST wire
  `aria-required` and `aria-invalid` from the `required`/`invalid` props.
- **FR-011**: The country-select trigger MUST be operable by keyboard exactly as documented upstream:
  `Tab` moves focus between the trigger and the field; `Space`/`Enter` open the popover from the
  trigger; `ArrowUp`/`ArrowDown` move the highlighted list item; `Home`/`End` jump to the first/last
  country; `Escape` closes the popover without changing the selection; and typing while the list is
  open filters it.
- **FR-012**: Rendering `PhoneInputCountrySelect` or `PhoneInputField` without an ancestor `PhoneInput`
  MUST throw an error identifying both the part and the required ancestor.
- **FR-013**: The component MUST render correctly under `dir="rtl"`: part order follows logical
  (start/end) flow rather than a fixed left-to-right assumption, and no upstream behaviour is
  direction-dependent beyond that layout flip (the widget has no left/right arrow-key navigation to
  invert).
- **FR-014**: The component MUST ship as an installable registry item under the project's UI component
  directory with a public barrel export, and a documentation page MUST demonstrate every example shown
  on the upstream docs page: the default layout, a custom/restricted country list, and usage inside a
  validated form.

### Key Entities

- **Country**: One selectable entry in the country dropdown — an ISO 3166-1 alpha-2 `code`, a
  human-readable `name`, a `+`-prefixed `dialCode`, and an optional flag emoji derived from `code`.
- **Phone value**: The canonical, unformatted string the root tracks and reports through
  `value`/`onValueChange` — digits only, optionally `+`-prefixed — distinct from the display string
  shown inside the field, which is derived from it on every render.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A person can type a raw string of digits and, without typing any punctuation themselves,
  see a correctly grouped international phone number appear in the field within the same interaction.
- **SC-002**: The country list is fully reachable and selectable using only the keyboard, starting from
  the trigger: open with `Space`/`Enter`, filter by typing, move the highlight with `Arrow`/`Home`/`End`,
  and confirm with `Enter` — with zero pointer interaction required.
- **SC-003**: Pasting a well-known international number (e.g. a US or UK number with its country code)
  results in the correct country being auto-selected without any additional user action, in 100% of
  cases where the number's dial code is unambiguous.
- **SC-004**: The component passes an automated accessibility and keyboard-interaction test suite that
  covers every interaction listed in the Requirements section, with zero regressions against the
  upstream component's documented behaviour.
- **SC-005**: The demo page documents every prop of all three parts (`PhoneInput`,
  `PhoneInputCountrySelect`, `PhoneInputField`), so a developer already familiar with the upstream Dice UI
  `PhoneInput` can compose the Svelte version correctly using only this project's documentation page.

## Assumptions _(mandatory)_

- Only the `radix` upstream base variant (`.reference/diceui/docs/registry/bases/radix/ui/phone-input.tsx`)
  is ported, because this project's existing `popover`, `command`, and `input` primitives are already
  built on `bits-ui`, the same primitive family the `radix` variant composes (Radix UI) — matching the
  project's established pattern of porting the Radix-based upstream variant. The `base` variant (a
  parallel, non-Radix implementation under `docs/registry/bases/base/ui/phone-input.tsx`) is out of scope.
- Upstream's internal `Store`/`useSyncExternalStore` plumbing (`StoreContext`, `useStore`, the
  listener set) is an implementation detail of React's lack of fine-grained reactivity. It is replaced
  by a single reactive state class in `phone-input.svelte.ts`, following this project's established
  state-class-plus-context convention — no equivalent public API is exposed, since upstream itself only
  re-exports `useStore` as an internal escape hatch (`usePhoneInput`) that no example or doc page uses.
- Upstream's `asChild`/`SlotPrimitive.Slot` on the root is replaced by this project's `child` snippet
  convention, per the project's established React→Svelte translation table; no upstream behaviour is
  lost since both mechanisms let a caller replace the rendered root element.
- Upstream's `VisuallyHiddenInput` + `useComposedRefs`/`useAsRef`/`useLazyRef`/
  `useIsomorphicLayoutEffect` helper hooks have no meaningful Svelte equivalent to port 1:1; the hidden
  form-submission input (FR-009) and the ref/effect plumbing they exist to support are re-expressed
  using this project's `$bindable` ref pattern and `$effect`, per the project's translation table. If an
  equivalent hidden-input helper already exists elsewhere in `src/lib/components/ui/`, it is reused
  instead of being re-authored.
- The digit-grouping and dial-code-splitting logic (`formatPhoneNumber`, `detectCountryFromNumber`) is
  a distinct algorithm from `mask-input`'s fixed-pattern slot masking (which formats a single fixed
  domestic `(###) ###-####` shape), because a phone number's mask shape depends on the *detected
  country's* dial-code length rather than a static pattern. Per the component-specific guidance, the
  implementation composes/reuses `mask-input`'s existing formatting primitives (its pure,
  DOM-free formatting module) wherever the two algorithms overlap — e.g. digit-extraction — rather than
  duplicating that logic, and adds only the country-aware parts upstream itself does not delegate to any
  shared engine.
- Country metadata matches upstream's own choice exactly: a small inline `[iso2, dialCode]` table
  (upstream's own transcription of the `country-telephone-data` project, not that npm package itself)
  combined with the runtime `Intl.DisplayNames` API for localized names and a computed flag emoji —
  no third-party phone-number-formatting or country-data package (e.g. `libphonenumber-js`,
  `react-phone-number-input`) is introduced, since upstream itself takes no such dependency.
- `getCountryName`'s `locale` parameter (hardcoded to `"en"` upstream, with no prop exposing it) is
  ported as-is with no new locale prop, since upstream documents no such prop and introducing one would
  be undocumented scope creep, not parity.
- Upstream's real-time validation is limited to reflecting the caller-supplied `invalid` boolean; this
  port does not add phone-number-format validation upstream does not itself perform.
- The `PhoneInputCountrySelect` popover's list is built by composing this project's existing
  `popover` and `command` components (which already exist under `src/lib/components/ui/`), per the
  Composition First rule, rather than re-implementing dropdown positioning or list filtering.
- `defaultCountry` defaults to `''`, not the `"US"` that upstream's `docs/types/radix/phone-input.ts`
  annotates: upstream's implementation falls back to `countryProp ?? defaultCountry ?? ""`, and the plain
  `phone-input-demo` renders the flag-less swatch that this proves. Runtime behaviour wins; the JSDoc
  records both (research R-04).
- The selected country is marked with `data-checked="true"`, reusing the repo `Command.Item`'s existing
  check mark, in place of upstream's inline `Check` toggled between `opacity-0` and `opacity-100`. The
  `'true'` string (rather than the repo's presence-based `'' | undefined`) is required by the existing
  shadcn selector (`group-data-[checked=true]/command-item`), a deliberate, documented exception to the
  project's presence-based `data-*` convention (research R-07).
- Focus returns to the field after a selection through bits-ui's `onCloseAutoFocus`, replacing upstream's
  `requestAnimationFrame(() => inputRef.current?.focus())`, which fights the focus scope. Observable
  behaviour is identical: field on select-close, trigger on Escape/outside-click (research R-08).
- A DOM-only `$effect` re-asserts `element.value` on the field to reproduce React's "controlled input
  snaps back" behaviour for rejected characters, replacing upstream's re-render-driven value
  reassertion; no caret logic is added, matching upstream (research R-09).
- `value` is omitted from `PhoneInputFieldProps` rather than accepted and silently ignored as upstream
  does, because a dropped `value` on a Svelte input type is a typing trap (research R-12).
- Every `dark:` variant in upstream's class strings is dropped (the tokens already flip in
  `src/app.css`) and `rounded-l-*`/`border-r`/`rounded-r-*` become logical `rounded-s-*`/`border-e`/
  `rounded-e-*` so the layout flips under `dir="rtl"` (FR-013; research R-13).
- The "With Form" demo does not add a `react-hook-form`/`zod` equivalent, since neither is a repo
  dependency and neither is part of the ported component itself (research R-15).
