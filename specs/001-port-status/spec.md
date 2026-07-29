# Feature Specification: Port Status Component

**Feature Branch**: `001-port-status`

**Created**: 2026-07-29

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Status\" (slug: status) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Show an at-a-glance state badge (Priority: P1)

A developer building a dashboard or list view wants to show a compact, colour-coded badge that
communicates a state (online, offline, away, idle, unknown) alongside a text label, so that users
can scan a page and understand system or entity health without reading full sentences.

**Why this priority**: This is the entire reason the component exists — every other behaviour is a
variation of "render a labelled, coloured badge." Without this, there is no component.

**Independent Test**: Render the badge with a colour variant and a text label; confirm the badge
displays with the correct colour treatment and the label text is visible and accessible to
assistive technology.

**Acceptance Scenarios**:

1. **Given** a developer renders the badge with the "success" variant and the label "Online",
   **When** the page displays, **Then** the badge shows green-toned styling and the text "Online" is
   present and readable, including to screen readers.
2. **Given** no variant is specified, **When** the badge renders, **Then** it falls back to the
   neutral "default" visual treatment.
3. **Given** the badge is placed in a right-to-left (`dir="rtl"`) page, **When** it renders, **Then**
   its internal layout (indicator, then label) mirrors horizontally and remains legible.

---

### User Story 2 - Pair the badge with an animated presence indicator (Priority: P2)

A developer wants to add a small pulsing dot in front of the label to draw attention to live or
continuously-updating state (e.g. "a service is currently online"), distinct from a purely static
label-only badge.

**Why this priority**: This is the component's signature visual behaviour and is called out
explicitly in upstream's documentation and every example except the text-only one; it is expected
by any consumer copying the pattern from Dice UI, but the badge is still useful without it (P1
covers the minimum viable badge).

**Independent Test**: Render the badge with the indicator sub-part included; confirm the indicator
renders as a small coloured dot with a continuous pulse animation, and that omitting the indicator
still produces a valid, correctly styled badge (text-only usage).

**Acceptance Scenarios**:

1. **Given** a developer includes the indicator sub-part inside the badge, **When** the badge
   renders, **Then** a small dot appears before the label and visibly pulses on a continuous loop.
2. **Given** a developer omits the indicator sub-part, **When** the badge renders, **Then** the
   badge still displays correctly with only the label, no layout gap or broken alignment.
3. **Given** the badge uses the "error" variant, **When** the indicator is present, **Then** the
   indicator's colour matches the badge's variant colour (not a fixed colour independent of variant).

---

### User Story 3 - Render the badge as a different interactive element (Priority: P3)

A developer wants the same badge look and colour semantics on an element that is itself
interactive — for example a link to a status page or a button that opens more detail — without
wrapping it in an extra, semantically meaningless `<div>`.

**Why this priority**: Documented upstream capability, but it is an escape hatch used by a minority
of consumers; the badge is fully useful for its primary (non-interactive, informational) purpose
without it.

**Independent Test**: Render the badge configured to merge onto a child link element; confirm the
resulting DOM is a single interactive element carrying the badge's visual styling and data
attributes, not a badge wrapping a nested interactive element.

**Acceptance Scenarios**:

1. **Given** a developer configures the badge to render onto a child anchor element, **When** the
   page renders, **Then** the anchor itself carries the badge's classes and data attributes, and no
   extra wrapping element is introduced.
2. **Given** the badge is configured this way but no single child element is supplied, **When** the
   component is used, **Then** the documented error/behaviour for that misuse is produced instead of
   silently rendering nothing.

---

### Edge Cases

- What happens when the badge label text is very long? It must not force page overflow — text
  wraps within normal flow to the next line rather than being clipped or overflowing at the badge
  boundary; the badge width follows its content (`w-fit`), so the badge itself does not stretch to
  fill an unrelated container.
- What happens when the badge is used with only an indicator and no label (icon/dot-only status)?
  It must still render as a valid, correctly spaced badge.
- What happens when an unsupported/misspelled variant value reaches the component at runtime (e.g.
  from untyped data)? It falls back to the "default" neutral treatment rather than rendering
  unstyled or throwing.
- What happens under `prefers-reduced-motion`? The pulse animation is decorative; this port does not
  add a reduced-motion override beyond what the project's global styles already provide, matching
  upstream's own behaviour (see Assumptions).
- What happens when the badge (or the element it is merged onto) receives keyboard focus because it
  is itself interactive (e.g. rendered onto a link)? Focus must remain visible and the accessible
  name must still be the label text.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST render a compact, pill-shaped container that groups an optional
  presence indicator and an optional text label.
- **FR-002**: The component MUST support exactly five visual variants — `default`, `success`,
  `error`, `warning`, `info` — each with a distinct colour treatment, defaulting to `default` when
  no variant is specified.
- **FR-003**: The presence indicator, when included, MUST render as a small dot that visually
  pulses continuously and MUST inherit the colour of the container's active variant (no
  variant-independent hardcoded indicator colour).
- **FR-004**: The text label, when included, MUST render as inline text with normal (non-clipped)
  line height, and MUST remain the badge's accessible name / readable content for assistive
  technology.
- **FR-005**: The indicator and the label MUST each be independently optional — the container MUST
  render correctly with only an indicator, only a label, both, or (in the degenerate case) neither.
- **FR-006**: The component MUST allow being rendered onto a single different, caller-supplied
  interactive element (e.g. a link or button) in place of its default non-interactive container,
  while preserving the container's styling and exposed state attributes on that element.
- **FR-007**: The component MUST expose its active variant as an inspectable, style-hookable
  attribute on the rendered container, so consumers can target a specific variant with their own
  styling without needing to know the internal class names.
- **FR-008**: The component MUST accept caller-supplied styling overrides on the container and on
  each sub-part, applied after (so they take precedence over) the component's own default styling.
- **FR-009**: The component MUST accept and forward all standard container/element attributes and
  event handlers on every part, so it composes like any other element in the surrounding markup.
- **FR-010**: The component's layout MUST correctly mirror for right-to-left reading direction: the
  visual order of indicator and label follows the ambient text direction rather than being pinned
  left-to-right.
- **FR-011**: The component MUST NOT rely on colour alone to convey the represented state — a text
  label MUST remain fully supported and readable independent of the colour variant, so the state is
  understandable without colour perception.
- **FR-012**: The component MUST be installable, and its usage documented, in exactly the same way
  as every other component already available in this project's component set.

### Key Entities

- **Status container**: The outer badge. Attributes: active colour variant, optional caller styling
  override, optional "render onto a different single element" mode.
- **Status indicator**: The optional pulsing presence dot, visually subordinate to and colour-linked
  with its parent container.
- **Status label**: The optional text content describing the state in words.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer can add a correctly styled, correctly coloured status badge to a page by
  writing three lines of markup (container, indicator, label), with no additional configuration.
- **SC-002**: All five documented colour variants are visually distinguishable from one another and
  from plain text, and each is verified by an automated test asserting the correct style-hook
  attribute is present.
- **SC-003**: 100% of the upstream documentation's example layouts (default usage, all variants,
  text-only usage, a multi-item status list) have a corresponding, working demo section in this
  project's documentation site.
- **SC-004**: A screen reader user can determine each badge's represented state from its label text
  alone, with zero reliance on colour, in 100% of tested cases.
- **SC-005**: The component passes this project's full automated quality gate (type-check, lint,
  unit tests, build) with zero suppressed checks.
- **SC-006**: Existing consumers of this project's component set can install the badge through the
  same installation mechanism as any other component, with no bespoke steps.

## Assumptions _(mandatory)_

- Upstream ships two parallel implementations of this component — a Radix-based variant
  (`docs/registry/bases/radix/ui/status.tsx`) and a Base-UI-based variant
  (`docs/registry/bases/base/ui/status.tsx`) — that are behaviourally and visually identical (same
  class names, same variants, same sub-parts) and differ only in which underlying React primitive
  library implements the "render onto a different element" escape hatch (`asChild` via Radix `Slot`
  vs. `render`/`useRender` via Base UI). This port targets that shared behaviour once; the Radix
  variant's documentation page is treated as canonical for API naming (`asChild`), consistent with
  this repository's existing convention of composing `bits-ui` for this kind of primitive.
- **Divergence**: upstream's `asChild` prop (Radix `Slot`) has no direct Svelte 5 equivalent;
  per this repository's established convention (`CLAUDE.md` §10 translation table), this is
  ported as a `child` snippet prop (`{#snippet child({ props })}`) on the root part, matching the
  pattern already used by e.g. `dialog-content.svelte`. The rendered element and its data
  attributes/classes are handed to the caller-supplied snippet instead of being merged via a Slot
  primitive, since Svelte has no runtime prop-merging primitive equivalent to Radix `Slot`.
- This is a presentational, stateless component: it holds no internal reactive state, has no
  controlled/uncontrolled value, no keyboard interaction model of its own beyond whatever the
  element it is rendered onto (via the `child` snippet) already provides, and no
  provider/context relationship between its parts (container, indicator, label do not need to
  communicate). Consequently the "state class in `.svelte.ts`" convention in `CLAUDE.md` §4 and the
  "typed Symbol context" convention in §5 do not apply here — there is no shared reactive state to
  hold. This makes Status the project's reference example of a _variant-only_ ported component
  (three independent, stateless parts unified only by shared Tailwind variant styling), as distinct
  from the _stateful compound component_ pattern (e.g. a future `tags-input`) that CLAUDE.md's
  fuller example illustrates.
- The animated pulse indicator is implemented with the same CSS-only technique upstream uses
  (Tailwind's `animate-ping` utility on `::before`, a static inner dot via `::after`, both inheriting
  the parent's current text colour via `bg-inherit`) — no JavaScript animation or `IntersectionObserver`
  is introduced, and no explicit `prefers-reduced-motion` handling is added beyond whatever the
  project's global styles already provide, because upstream itself adds none.
- Colour variants use this project's semantic tokens exclusively — no raw Tailwind palette
  utilities, per `CLAUDE.md` §6. `default` maps to `bg-muted`/`text-muted-foreground` and `error` to
  `text-destructive`/`border-destructive/20`, both already used elsewhere (e.g. `alert`, `badge`).
  The `success`, `warning` and `info` variants map to the dedicated `--success` / `--warning` /
  `--info` tokens (each with a `-foreground` companion), which are declared in `src/app.css` for
  both `:root` and `.dark` and exposed through `@theme inline`. Upstream's `green-*` / `orange-*` /
  `blue-*` utilities are therefore translated, not copied — see the mapping table in `CLAUDE.md` §6.
  Those tokens already exist, so this port neither adds nor modifies theme variables, and the
  "changes to the Tailwind theme" exclusion below still holds.
- `data-slot` values follow the folder/part naming convention already used by every other ported
  component: `data-slot="status"`, `data-slot="status-indicator"`, `data-slot="status-label"`,
  matching upstream's own `data-slot` values verbatim — no renaming needed since upstream already
  follows a `<slug>` / `<slug>-<part>` convention compatible with this project's.
  The active variant is additionally exposed as `data-variant="<variant>"` on the container, exactly
  as upstream documents in its Data Attributes table.
- No dedicated keyboard interactions, focus management, or `aria-*` wiring beyond standard HTML
  semantics are documented upstream for the non-interactive (default `div`) usage, and none are
  added here beyond ensuring the label text remains the accessible name and focus indicators are
  never suppressed when the badge is rendered onto an interactive element via the `child` snippet
  — this matches the WAI-ARIA Authoring Practices guidance that a purely decorative/informational
  status badge with a visible text label needs no additional ARIA role (an explicit `role="status"`
  live-region is a distinct, event-driven announcement pattern that upstream does not implement for
  this component and is out of scope for this port, since adding it would be new behaviour not
  present upstream).
- Only the three documented parts (container, indicator, label) are ported; no additional
  convenience parts (e.g. a combined "quick" component that renders all three at once) are invented,
  since upstream does not offer one.
- This component introduces no `bits-ui` dependency, since it wraps no interactive/floating
  behaviour (no open state, no positioning, no focus trap) that `bits-ui` would own; per
  Principle IV, composition applies to `cva`/`tailwind-variants` for the variant styling, which
  this project already uses elsewhere (e.g. `button`).
- The upstream package name (`@diceui/status`) and CLI install command are React/npm-specific and
  are not carried over; installation in this project happens exclusively through this project's own
  `registry.json` entry and `pnpm run registry:build` output, consistent with every other ported
  component.
