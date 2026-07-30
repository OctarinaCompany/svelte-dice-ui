# Feature Specification: Relative Time Card

**Feature Branch**: `015-port-relative-time-card`

**Created**: 2026-07-30

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Relative Time Card\" (slug: relative-time-card) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See a timestamp in relative and absolute form (Priority: P1)

A person reading a page (an activity feed, a comment, an audit log entry) sees a compact, human-readable
timestamp such as "5 minutes ago" or a short absolute date. They don't need to do anything to get this —
it is simply how the timestamp renders.

**Why this priority**: This is the component's entire reason to exist. Without it there is nothing to
hover, focus, or inspect.

**Independent Test**: Render the component with a fixed date in the past and confirm the trigger shows a
formatted absolute date/time (e.g. "Jul 30, 2026, 10:00 AM" in the viewer's locale).

**Acceptance Scenarios**:

1. **Given** a date five minutes in the past, **When** the component renders, **Then** the trigger displays
   a locale-formatted short date and time inside a `<time>` element whose `datetime` attribute is the
   date's ISO string.
2. **Given** a `date` passed as a string or a number instead of a `Date` object, **When** the component
   renders, **Then** it is parsed and displayed identically to an equivalent `Date` object.

---

### User Story 2 - Inspect exact and relative time on hover or focus (Priority: P1)

The same person hovers over the timestamp, or reaches it with the keyboard, and a card appears showing the
precise relative time ("in 3 minutes", "2 hours 14 minutes ago") plus the equivalent time in one or more
named timezones, each labelled with its abbreviation.

**Why this priority**: This is the component's signature interaction — the trigger alone is only a
summary; the card is where the useful detail lives, and it must work for pointer and keyboard users alike.

**Independent Test**: Open the card via pointer hover and separately via `Tab` + `Enter`/focus, and confirm
in both cases the card lists the relative time and one row per configured timezone (plus the viewer's local
timezone), each row showing a timezone label, a formatted date, and a formatted time.

**Acceptance Scenarios**:

1. **Given** the card is closed, **When** a pointer hovers the trigger, **Then** the card opens after the
   configured open delay and closes after the configured close delay once the pointer leaves.
2. **Given** the card is closed, **When** the trigger receives keyboard focus, **Then** the card opens;
   **When** focus moves away or `Escape` is pressed, **Then** the card closes.
3. **Given** `timezones={["America/New_York", "Europe/London"]}`, **When** the card opens, **Then** it
   shows one row per listed timezone plus exactly one additional row for the viewer's local timezone, each
   row's accessible name stating the timezone, formatted date and formatted time.
4. **Given** the relative time keeps advancing while the card stays open (e.g. "4 minutes ago" becomes "5
   minutes ago"), **When** the configured update interval elapses, **Then** the displayed relative time
   text updates without the card closing or losing focus.

---

### User Story 3 - Style the trigger and choose its content (Priority: P2)

A developer embedding the component wants it to look consistent with surrounding UI: a subtler or a
link-like presentation, extra classes, or an entirely custom trigger element (e.g. a button with an icon)
instead of the default timestamp text.

**Why this priority**: Necessary for real-world adoption across different visual contexts, but the
component is fully functional with just the default appearance from User Story 1.

**Independent Test**: Render the component with each documented `variant`, with a custom `class`, and with
custom children, and confirm each renders distinctly without breaking the hover/focus behaviour from User
Story 2.

**Acceptance Scenarios**:

1. **Given** `variant="muted"` or `variant="ghost"`, **When** the component renders, **Then** the trigger
   receives the corresponding visual treatment while the default (unset) variant keeps the baseline look.
2. **Given** a caller-supplied `class`, **When** the component renders, **Then** the caller's classes are
   applied in addition to (and able to override) the component's own classes.
3. **Given** custom `children` passed to the trigger, **When** the component renders, **Then** the supplied
   content replaces the default formatted-date text while the hover/focus/card behaviour is unchanged.
4. **Given** a custom trigger element supplied via composition (replacing the default `<button>`), **When**
   the component renders, **Then** the supplied element becomes the interactive trigger and still opens the
   card on hover/focus.

---

### User Story 4 - Control card position, timing and open state (Priority: P3)

A developer placed near a viewport edge, or one integrating this into a controlled form/workflow, needs to
choose which side the card opens on, override its offsets, and optionally drive the open/closed state
programmatically.

**Why this priority**: A refinement for layout edge cases and advanced integrations; the component is
useful without it.

**Independent Test**: Render the component with each `side`/`align` combination and confirm the card
appears on the requested side; separately, drive `open`/`onOpenChange` from outside the component and
confirm the component defers to the controlling parent.

**Acceptance Scenarios**:

1. **Given** `side="top"` and `align="start"`, **When** the card opens, **Then** it is positioned above the
   trigger, start-aligned, honouring any `sideOffset`/`alignOffset` supplied.
2. **Given** a controlling parent holding `open` and `onOpenChange`, **When** the parent's state is `true`,
   **Then** the card renders open regardless of pointer/focus state, and every open/close transition invokes
   `onOpenChange` with the next boolean instead of the component changing state on its own.
3. **Given** no `open`/`onOpenChange` supplied (uncontrolled), **When** the user hovers, focuses, or presses
   `Escape`, **Then** the component manages its own open state exactly as in User Story 2.

---

### Edge Cases

- **Time within 5 seconds of now**: displays "just now" rather than "0 seconds ago" or "in 0 seconds".
- **Future date**: relative time is phrased as "in X" instead of "X ago", at every unit boundary (seconds,
  minutes, hours, days).
- **Date 7 or more days away (past or future)**: relative phrasing is dropped in favour of a plain
  formatted date, matching upstream's fallback.
- **Invalid `date` input** (a string/number that does not parse to a valid date): the component must not
  throw during render; it renders `Invalid Date` text consistent with `Date` semantics, and the live
  interval does not attempt to reformat an invalid date. (Not exercised upstream; assumed default per
  "Invalid Date on a non-parsing string/number" behaviour.)
- **`timezones` includes a duplicate of the viewer's local timezone**: both rows still render — the
  component does not deduplicate, matching upstream (each list entry always renders, plus one row for the
  local timezone).
- **Empty `timezones` array**: only the single local-timezone row renders.
- **Component unmounted while the card is open**: the update interval and any hover-open timers are cleared
  and no state updates occur after teardown.
- **`disabled`-equivalent state**: upstream has no `disabled` prop; none is added (see Assumptions).
- **RTL layout (`dir="rtl"`)**: the card's side/align logic mirrors horizontally exactly as the underlying
  popover/hover-card primitive already mirrors for every other ported component; timezone rows keep the
  logical (start-to-end) reading order via `flex` with no explicit horizontal direction hardcoded.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST accept a `date` value as a `Date`, an ISO/parseable string, or a numeric
  timestamp, and normalise it to a `Date` before formatting.
- **FR-002**: The component MUST render a focusable, hoverable trigger showing, by default, the date
  formatted with the viewer's locale as short month, numeric day, numeric year, and 2-digit hour:minute
  (e.g. "Jul 30, 2026, 10:00 AM"), wrapped in a `<time>` element whose `datetime` attribute is the date's
  ISO string. When `date` does not parse to a valid date, the trigger MUST still render without
  throwing, MUST omit the `datetime` attribute on its `<time>` element, and MUST expose an `invalid`
  state as a data attribute on the trigger.
- **FR-003**: The component MUST accept `children` to replace the default trigger content while preserving
  all interactive behaviour.
- **FR-004**: The component MUST support a `variant` prop with values `"default"`, `"muted"`, and `"ghost"`,
  each producing a distinct visual treatment of the trigger, defaulting to `"default"`.
- **FR-005**: On hover or keyboard focus of the trigger, the component MUST open a card showing: (a) the
  live relative-time string for `date`, and (b) one row per entry in `timezones` plus exactly one row for
  the viewer's local timezone (resolved from the runtime's locale when not explicitly listed), each row
  showing a short timezone label/abbreviation, a formatted date, and a formatted time for that timezone.
- **FR-006**: The relative-time string MUST read: "just now" within 5 seconds of the current time; for
  past times, `"N seconds ago"`, `"N minutes M seconds ago"` (the minutes branch alone appends the
  remaining seconds, including a literal `0 seconds`), `"N hours ago"` and `"N days ago"`; for future
  times, the mirrored `"in N …"` phrasing with **no** seconds residual on the minutes branch, matching
  upstream's deliberate asymmetry; and a plain formatted date once the difference reaches 7 days or
  more, in either direction.
- **FR-007**: The relative-time string MUST update automatically at a configurable interval (`updateInterval`,
  default 1000 ms) while the component is mounted, and MUST stop updating (interval cleared, no further
  state changes) once the component is unmounted.
- **FR-008**: The component MUST accept `timezones` (a list of IANA timezone identifiers, default
  `["UTC"]`) controlling which additional timezone rows render in the card, always appending the viewer's
  local timezone as one further row.
- **FR-009**: The component MUST support both uncontrolled (internal open state, optional `defaultOpen`)
  and controlled (`open` + `onOpenChange`) operation of the card's open/closed state, with `openDelay`
  (default 500 ms) and `closeDelay` (default 300 ms) governing hover- and focus-driven open/close timing
  in both modes (in controlled usage the delay elapses before `onOpenChange` is invoked).
- **FR-010**: The component MUST accept positioning props for the card — `side`, `align`, `sideOffset`,
  `alignOffset`, `avoidCollisions`, `collisionBoundary`, `collisionPadding` — passed through to the
  underlying popover/hover-card positioning behaviour.
- **FR-011**: The component MUST accept an additional CSS class from the caller and merge it with its own
  classes so caller-supplied classes can override the defaults.
- **FR-012**: The component MUST allow the default trigger element to be replaced by an arbitrary
  caller-supplied element while keeping that replacement element as the interactive, focusable,
  hover/focus-opening trigger.
- **FR-013**: The card's timezone rows MUST be exposed as a list — a wrapper with the `list` role
  containing one `listitem` per row — and the card's timezone rows and relative-time row MUST be
  reachable and readable by screen readers: the relative-time row is announced as a time value, and
  each timezone row exposes an accessible name stating the timezone and its formatted date/time.
- **FR-014**: Pressing `Tab` MUST move focus onto (or away from) the trigger, opening or closing the card
  as focus arrives or leaves it; pressing `Enter` while the trigger is focused MUST open the card if it is
  closed; pressing `Escape` while the card is open MUST close it.
- **FR-015**: Under `dir="rtl"`, the card's side/alignment behaviour MUST mirror horizontally, consistent
  with every other ported popover-based component in this project.
- **FR-016**: The component MUST be distributed as source under the project's UI component alias directory
  with a public barrel export, and installable through the project's own component registry.
- **FR-017**: The trigger element and the card element MUST each expose a `data-state` attribute
  reflecting the card's open state (`"open"` when the card is shown, `"closed"` when it is not),
  matching the single data attribute documented on the upstream component page.

### Key Entities

- **Relative Time Card**: The composite widget — a trigger showing a formatted timestamp, plus a card
  (shown on hover/focus) listing the live relative-time string and a set of timezone rows.
- **Timezone Row**: One line item in the card — a timezone identifier/abbreviation paired with that
  timezone's formatted date and time for the same instant.
- **Date input**: The instant in time the whole component describes; accepted as a `Date`, string, or
  number, always normalised to a single `Date` before formatting.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A viewer can determine, at a glance and without interacting, both the absolute date/time of
  an event from the trigger and — within one hover or focus action — its precise relative time and its
  time in every configured timezone.
- **SC-002**: 100% of the documented upstream states, props, variants, and keyboard interactions for this
  component (per the upstream documentation page) have a corresponding, independently testable acceptance
  scenario in this spec.
- **SC-003**: The live relative-time text updates automatically at least once per configured interval for
  as long as the component remains mounted, with zero updates occurring after the component is removed
  from the page (no leaked timers).
- **SC-004**: Every interaction achievable with a pointer (hover to open, move away to close) has an
  equivalent achievable with the keyboard alone (focus to open, blur or `Escape` to close), with no loss of
  information between the two paths.
- **SC-005**: The component renders correctly and mirrors its opening direction under right-to-left page
  direction, with no visual or functional regression versus left-to-right.

## Assumptions

- **Upstream variant name discrepancy resolved in favour of the implementation, not the stale doc
  comment**: the upstream `relative-time-card.tsx` `cva` definition and demo files use `variant="muted"`
  as the second style, while the upstream `types/radix/relative-time-card.ts` JSDoc comment (alone) says
  `"subtle"`. The actual component code, both demo files (`relative-time-card-demo.tsx`,
  `relative-time-card-variants-demo.tsx`), and every usage agree on `"muted"`. This port keeps `variant:
  "default" | "muted" | "ghost"`, matching the runnable upstream code rather than the one inconsistent
  JSDoc string, since the code is normative behaviour and the demos are the acceptance evidence for this
  spec's Documentation Parity requirement.
- **`asChild` → a `child` snippet**: upstream's `asChild` prop (backed by Radix's `Slot`) has no direct
  Svelte equivalent. This port exposes the same "replace the default trigger element" capability (User
  Story 3, FR-012) through this project's existing `child` snippet convention (as already used by, e.g.,
  `dialog-content.svelte`), rather than adding a boolean `asChild` prop.
- **Hover/positioning primitive**: upstream composes Radix's `HoverCard`. This project already ports that
  behaviour as `src/lib/components/ui/hover-card/*`, itself composing `bits-ui`'s `LinkPreview` primitive
  (open/close delays, controlled/uncontrolled open state, side/align/offset/collision props, portal). This
  port composes the existing `hover-card` parts rather than re-implementing hover-open timing or
  positioning, per the project's composition-first rule.
- **Formatting APIs**: upstream computes the relative-time string with hand-written arithmetic (not
  `Intl.RelativeTimeFormat`) and formats absolute dates/times with `Intl.DateTimeFormat`. Per this port's
  explicit component-specific guidance, the relative-time string is computed using
  `Intl.RelativeTimeFormat` for its unit-and-number-to-string formatting (feeding it the same
  seconds/minutes/hours/days breakdown and past/future sign upstream computes), and all absolute date/time
  formatting continues to use `Intl.DateTimeFormat`, so no bespoke string formatter is shipped. The
  observable phrasing (unit thresholds, the "just now" special case, the 7-day cutover to a plain date) is
  preserved exactly as upstream.
- **Live-update timer lifecycle**: the update interval described in FR-007 is created in an effect and its
  teardown clears the interval, matching this project's effect-teardown convention; tests pin the clock
  with fake timers rather than sleeping, per the component-specific guidance.
- **`timezones` default and local-row behaviour**: default `["UTC"]`, always appended with one further row
  for the viewer's local timezone (resolved via `Intl.DateTimeFormat().resolvedOptions().locale` and a
  `shortOffset`-style timezone name lookup), reproducing upstream's `TimezoneCard` used once per listed
  timezone plus once with no `timezone` override (local).
- **No `disabled` prop**: upstream does not document one; none is invented for this port.
- **Radix base, not the plain "base" variant**: the user description explicitly names the `radix` upstream
  path (`docs/registry/bases/radix/ui/relative-time-card.tsx` and the `radix` MDX). A separate, near-
  identical `base` variant also exists upstream under `docs/registry/bases/base/`; it is out of scope for
  this port, which targets only the `radix`-based component, itself now composed onto this project's
  existing `hover-card` (bits-ui) parts rather than raw Radix primitives.
- **Trigger element**: upstream defaults the trigger to a native `<button>` (or the `asChild`-slotted
  element). This port keeps a `<button>` default, composed as the `hover-card` trigger's child, with the
  `child`-snippet escape hatch from the point above covering the `asChild` case.
- **Positioning prop pass-through**: `side`, `align`, `sideOffset`, `alignOffset`, `avoidCollisions`,
  `collisionBoundary`, `collisionPadding` are passed straight through to the composed `hover-card` content
  part, whose defaults (e.g. `align="center"`, `sideOffset=4`) are used as this port's defaults since
  upstream's own defaults for these (`align="center"`, `side="bottom"`, offsets `0`) are equivalent
  hover-card behaviour already implemented by the existing primitive.

### Assumptions added during planning (Phase 0/1)

- **The timezone row is exported, additively**: upstream's `TimezoneCard` is module-private and upstream
  exports only `RelativeTimeCard`. `CLAUDE.md` §3 forbids two components in one `.svelte` file, so the row
  becomes its own file regardless; it is also exported from the barrel as
  `Timezone` / `RelativeTimeCardTimezone` because a labelled zone row is meaningful standalone and the file
  ships in the registry entry either way. This is additive — no upstream name or behaviour changes.
- **`"just now"` stays an English literal**: it is upstream's own hard-coded string and Principle II makes
  it the contract. `Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'second')` would produce
  `"now"`, a different string, so it is not substituted. Every other word in the relative-time output is
  produced by `Intl.RelativeTimeFormat`, `Intl.NumberFormat` (`style: "unit"`) and `Intl.ListFormat`; no
  pluralisation table or bespoke formatter ships.
- **Duplicate timezone entries are index-keyed**: the rows are rendered with `{#each timezones as tz, i (i)}`.
  A string-keyed each would throw `each_key_duplicate` on the duplicate case this spec's Edge Cases require
  to render, where React merely warns.
- **Non-throwing guards on invalid input**: for an unparseable `date` the trigger's `<time>` omits its
  `datetime` attribute (upstream's `date.toISOString()` throws) and the relative string comes from
  `Date.prototype.toLocaleDateString` (`Intl.DateTimeFormat.prototype.format` throws on an invalid date),
  yielding `Invalid Date`. An unknown IANA identifier in `timezones` renders its raw string as the row label
  and falls back to the viewer's local formatting instead of throwing at `Intl` construction time.
- **The row merges the caller's `class`**: upstream's `TimezoneCard` writes `className` after its prop
  spread and therefore silently discards a caller-supplied class. This port merges it last through `cn()`,
  as Principle VIII requires of every part.
- **`focus-visible:outline-none` is dropped from the trigger**: upstream pairs it with
  `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`; the ring utilities are kept
  and the outline suppressor is not, so the focus indicator can never be lost (Principle III).
- **The relative string is derived, not effect-seeded**: upstream seeds React state with a plain date and
  only switches to the relative string after its first client effect (its `suppressHydrationWarning`
  escape). Here it is `$derived`, so it is correct from the first render including SSR; server and client
  text may differ by the request duration, and the first live-update tick reconciles it. Structure and
  attributes are identical in both renders.
