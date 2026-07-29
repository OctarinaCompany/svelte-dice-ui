# Feature Specification: Port Stat Component

**Feature Branch**: `004-port-stat`

**Created**: 2026-07-29

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Stat\" (slug: stat) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Show a labelled metric at a glance (Priority: P1)

A developer building a dashboard wants to display a single key metric — a label describing what is
being measured and the value itself — inside a card-style container, so that users can scan a page
of statistics and immediately understand what each number represents.

**Why this priority**: This is the minimum viable statistic display and the reason the component
exists — a card, a label, and a value. Every other behaviour (indicators, trends, descriptions) is
an enrichment layered on top of this core pairing.

**Independent Test**: Render the container with a label and a value; confirm both are visible inside
a card-style layout and the value is visually emphasised over the label.

**Acceptance Scenarios**:

1. **Given** a developer renders the container with a label "Total Revenue" and a value "$45,231",
   **When** the page displays, **Then** both texts are visible inside a bordered, padded card and the
   value uses larger, heavier typography than the label.
2. **Given** only the container and a value are rendered (no label), **When** the page displays,
   **Then** the card still renders correctly with no broken layout or empty gap.
3. **Given** the card is placed in a right-to-left (`dir="rtl"`) page, **When** it renders, **Then**
   its grid layout mirrors horizontally and remains legible.

---

### User Story 2 - Pair the metric with a colour-coded visual indicator (Priority: P2)

A developer wants to add an icon, a small badge, or an interactive action control next to the
metric, tinted by semantic colour (success, info, warning, error), so that the metric's context —
positive, informational, cautionary, critical — is communicated visually as well as textually, and
so an action (like a menu of further options) can be attached to the same card without adding an
unrelated element.

**Why this priority**: This is the component's signature visual behaviour, shown in every upstream
example page. It is expected by any consumer copying the pattern from Dice UI, but the card is still
useful without it (P1 covers the minimum viable metric).

**Independent Test**: Render the indicator with each of its four visual styles and each of its five
colour themes inside a card; confirm each combination renders with visually distinct styling and,
for the interactive style, that composing it as the content of an existing menu trigger produces a
working, keyboard-operable menu.

**Acceptance Scenarios**:

1. **Given** a developer renders the indicator with the "icon" style and the "success" colour theme,
   **When** the card renders, **Then** the indicator shows a bordered, tinted square containing the
   icon content.
2. **Given** a developer renders the indicator with the "badge" style and the "info" colour theme,
   **When** the card renders, **Then** the indicator shows a compact, tinted pill suitable for a short
   number or icon.
3. **Given** a developer renders the indicator with the "action" style as the content of an existing
   menu component's trigger, **When** a user activates that trigger by pointer or by keyboard,
   **Then** the menu opens, and the trigger carries the menu's own focus, keyboard and ARIA
   behaviour while the indicator supplies the visual treatment.
4. **Given** no style or colour is specified, **When** the indicator renders, **Then** it falls back
   to the neutral "default" style and "default" colour theme.

---

### User Story 3 - Add trend context, a divider and a longer description (Priority: P3)

A developer wants to show whether the metric is trending up, down, or holding steady compared to a
prior period, optionally separated by a divider from a longer explanatory sentence about what the
number means, so that a viewer gets the full analytical picture — value, direction of change, and
context — without leaving the card.

**Why this priority**: Documented upstream capability used in the richer example layouts, but the
card communicates its primary value without it (P1 and P2 already deliver a usable, informative
card).

**Independent Test**: Render the trend text with each of its three directions inside a card; confirm
each direction has visually distinct styling, and that adding a divider and a description below the
value renders both as expected, spanning the full width of the card.

**Acceptance Scenarios**:

1. **Given** a developer renders the trend text with the "up" direction, **When** the card renders,
   **Then** the trend text is styled with the visual treatment for positive change.
2. **Given** a developer renders the trend text with the "down" direction, **When** the card renders,
   **Then** the trend text is styled with the visual treatment for negative change.
3. **Given** a developer renders the trend text with the "neutral" direction, or omits the direction
   entirely, **When** the card renders, **Then** the trend text is styled with the muted, neutral
   treatment.
4. **Given** a developer places a divider between the indicator and a description, **When** the card
   renders, **Then** a horizontal rule spanning the card's full width separates the two, and the
   description text renders below it in a smaller, muted style.

---

### Edge Cases

- What happens when the value text is very long (e.g. a large formatted currency amount)? The value
  cell has no fixed width or truncation of its own; it wraps within its grid column like ordinary
  text, and the card grows to fit — matching upstream, which applies no `truncate`/`whitespace-nowrap`
  to the value.
- What happens when a card includes only an indicator and a value, with no label, trend, separator,
  or description? It must still render as a valid, correctly spaced card with no broken grid rows.
- What happens when an unsupported/misspelled `variant`, `color`, or `trend` value reaches the
  indicator or trend part at runtime (e.g. from untyped data)? The part still renders using the
  variant-table's default class fallback for that axis rather than crashing, matching upstream's
  `cva`/variant-map behaviour of applying no extra classes for an unrecognised key.
- What happens when the divider (`StatSeparator`) is used outside a `Stat` card? It renders correctly
  as a standalone horizontal rule, since it carries no dependency on the card's grid context beyond
  the card's own CSS targeting its `data-slot`.
- What happens when the "action" style indicator is used without composing it inside an actual
  interactive trigger? It is visually styled as interactive (pointer cursor, hover background) but
  carries no keyboard or ARIA semantics of its own — those come entirely from whatever interactive
  element it is composed with, exactly as upstream (see Assumptions).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST render a card-style container arranging its parts in a two-column
  grid: a primary column for label/value/trend/description/separator content, and a secondary column
  reserved for the indicator, so the indicator sits alongside the label and value rather than below
  them.
- **FR-002**: The container MUST target its children by their part identity (not by DOM position), so
  parts can be composed in any order in markup and still land in the correct grid cell/column/row.
- **FR-003**: The component MUST provide a label part for the metric's name/category, rendered as
  small, muted, medium-weight text.
- **FR-004**: The component MUST provide a value part for the metric's primary figure, rendered as
  large, semibold, tightly-tracked text, with no truncation or forced non-wrapping applied.
- **FR-005**: The component MUST provide an indicator part supporting exactly four visual styles —
  "default" (icon only, no background), "icon" (bordered tinted square), "badge" (compact tinted
  pill), and "action" (interactive-looking square with hover feedback) — defaulting to "default" when
  no style is specified.
- **FR-006**: The indicator part MUST support exactly five colour themes — "default", "success",
  "info", "warning", "error" — independently of its visual style, defaulting to "default" when no
  colour is specified.
- **FR-007**: The component MUST provide a trend part accepting a direction of "up", "down", or
  "neutral", with "up" styled as positive, "down" styled as negative, and "neutral" (or no direction)
  styled as muted/neutral.
- **FR-008**: The component MUST provide a divider part that renders a full-width horizontal rule
  between other parts, reusing this project's existing horizontal-rule component rather than a new
  implementation.
- **FR-009**: The component MUST provide a description part for supplementary explanatory text,
  rendered as small, muted text spanning the card's full width.
- **FR-010**: Every part MUST be independently optional — including the indicator and the trend — and
  any subset of the parts, written in any order, MUST render without breaking the container's grid
  layout (no empty rows, no misplaced cells).
- **FR-011**: The component MUST expose the indicator's active visual style and colour theme, and the
  trend's active direction, as inspectable, style-hookable attributes on their respective rendered
  elements, so consumers can target a specific combination with their own styling without needing to
  know internal class names.
- **FR-012**: The component MUST accept caller-supplied styling overrides on the container and on
  each part, applied after (so they take precedence over) the component's own default styling.
- **FR-013**: The component MUST accept and forward all standard container/element attributes and
  event handlers on every part, so it composes like any other element in the surrounding markup —
  including placing the "action" style indicator inside the trigger of an existing interactive
  component (e.g. a menu), which is how the upstream component is composed.
- **FR-014**: The component's grid layout MUST correctly mirror for right-to-left reading direction,
  following the ambient text/layout direction rather than being pinned left-to-right.
- **FR-015**: The component MUST be installable, and its usage documented, in exactly the same way as
  every other component already available in this project's component set.
- **FR-016**: When the interactive-style indicator is composed as the content of a trigger whose only
  visible content is an icon, that trigger MUST expose a text alternative (an accessible name)
  describing the action, and the icon MUST NOT contribute a name of its own. Upstream's example omits
  this; the omission is corrected here because an unnamed control is unusable with a screen reader.

### Key Entities

- **Stat container**: The outer card. A two-column grid that positions its children by part identity;
  carries the card's border, background, padding and corner-rounding.
- **Stat label**: Small muted text naming the metric.
- **Stat indicator**: The optional visual accent — an icon, badge, or interactive-looking control —
  with an independent visual style axis and colour-theme axis.
- **Stat value**: The metric's primary figure, emphasised typographically.
- **Stat trend**: Directional text (up/down/neutral) describing change versus a prior period.
- **Stat separator**: A full-width divider between grouped content within the card.
- **Stat description**: Small muted supplementary text spanning the full card width.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer can add a correctly styled, correctly laid-out statistic card to a page by
  writing three lines of markup (container, label, value), with no additional configuration.
- **SC-002**: All four indicator visual styles and all five indicator colour themes are visually
  distinguishable from one another, and each combination is verified by an automated test asserting
  the correct style-hook attributes are present.
- **SC-003**: All three trend directions are visually distinguishable from one another, and each is
  verified by an automated test asserting the correct style-hook attribute is present.
- **SC-004**: 100% of the upstream documentation's example layouts (default usage with indicator and
  trend, indicator style/colour variants, and rich multi-part layout with separator and description)
  have a corresponding, working demo section in this project's documentation site.
- **SC-005**: The "action" style indicator can be composed as the content of this project's existing
  menu trigger and successfully open that menu by pointer and by keyboard, producing the same DOM
  shape as upstream (the menu's own trigger element wrapping the indicator).
- **SC-006**: The component passes this project's full automated quality gate (type-check, lint, unit
  tests, build) with zero suppressed checks.
- **SC-007**: Existing consumers of this project's component set can install the card through the
  same installation mechanism as any other component, with no bespoke steps.
- **SC-008**: The "action" style indicator's trigger exposes a discoverable accessible name, verified
  by an automated test that queries the trigger by its role and that name.

## Assumptions _(mandatory)_

- Upstream ships two parallel implementations of this component — a Radix-based variant
  (`docs/registry/bases/radix/ui/stat.tsx`) and a Base-UI-based variant
  (`docs/registry/bases/base/ui/stat.tsx`) — that are byte-for-byte identical in markup, class names,
  variants and parts, differing only in which sibling `separator` implementation `StatSeparator`
  imports. This port targets that shared behaviour once; the Radix variant's documentation page is
  treated as canonical for API naming, consistent with this repository's existing convention.
- This is a purely presentational, stateless component: no internal reactive state, no
  controlled/uncontrolled value, no keyboard interaction model or focus management of its own, and no
  provider/context relationship between its parts (each part styles independently; the container
  targets children purely through CSS attribute selectors on `data-slot`, not through any shared
  state). Consequently the "state class in `.svelte.ts`" convention and the "typed Symbol context"
  convention (`CLAUDE.md` §4–5) do not apply — there is no shared reactive state to hold, and no part
  throws an "outside its provider" error because there is no provider.
- **Divergence**: upstream builds `statIndicatorVariants` with `cva()` from `class-variance-authority`;
  this port uses `tv()` from `tailwind-variants` (Principle VIII and the repository's existing
  `button.svelte`/`status.svelte` precedent). The variant keys (`variant`: default/icon/badge/action;
  `color`: default/success/info/warning/error) and their default values are unchanged — the divergence
  is in the builder only, not the API.
- **Divergence**: upstream's `StatSeparator` wraps a Radix/Base-UI `Separator` primitive re-exported
  from the sibling `separator` file in the same registry. This port composes this project's own
  already-ported `src/lib/components/ui/separator/separator.svelte` (a `bits-ui` `Separator.Root`
  wrapper) instead, per Principle IV (composition over reimplementation) — no new primitive is
  introduced, and no `bits-ui` dependency is added beyond what is already installed.
- **No divergence (corrected during planning)**: upstream's `stat-demo.tsx` uses
  `<DropdownMenuTrigger>` **without** `asChild`, so Radix renders its own `<button>` and
  `<StatIndicator variant="action">` is ordinary content *inside* that button — there is no cloning
  and no implicit prop-forwarding. This project's `dropdown-menu` trigger (backed by `bits-ui`)
  likewise renders a `<button>` when no `child` snippet is supplied, so the demo composes the
  indicator as plain trigger content and reproduces upstream's DOM exactly, with focus management,
  `aria-haspopup`/`aria-expanded`/`aria-controls` and `Enter`/`Space`/`ArrowDown`/`Escape` supplied by
  `bits-ui`. `StatIndicator` carries no `asChild`/`child` prop of its own — it remains a plain styled
  `div`, matching upstream's type definitions (`types/radix/stat.ts`), which document none. Spreading
  the trigger's props onto the indicator `div` instead was rejected: a `div` is not focusable and
  would answer neither `Enter` nor `Space`. See `plan.md` § "Spec reconciliation".
- Colour themes use this project's semantic tokens exclusively, per `CLAUDE.md` §6 and matching the
  mapping already established by the `status` port: `default` → `bg-muted`/`text-muted-foreground`;
  `success` → `bg-success/10 text-success border-success/20`; `info` → `bg-info/10 text-info
  border-info/20`; `warning` → `bg-warning/10 text-warning border-warning/20`; `error` →
  `bg-destructive/10 text-destructive border-destructive/20` (already the project's existing
  destructive treatment). The trend part's "up"/"down" text colours similarly use `text-success` and
  `text-destructive` in place of upstream's raw `green-*`/`red-*` utilities. These tokens already
  exist in `src/app.css`, so this port neither adds nor modifies theme variables, consistent with the
  "no theme changes" exclusion.
- `data-slot` values follow the folder/part naming convention already used by every other ported
  component and match upstream's own values verbatim: `stat`, `stat-label`, `stat-indicator`,
  `stat-value`, `stat-trend`, `stat-separator` (applied to the composed `Separator`'s own `data-slot`
  override), `stat-description`. The container's CSS targeting of children (`**:data-[slot=...]`
  arbitrary-variant selectors) is reproduced verbatim, translated to Tailwind v4 syntax already used
  elsewhere in this project.
- The indicator additionally exposes `data-variant` (its visual style) and `data-color` (its colour
  theme); the trend part exposes `data-trend` (its direction) — both reproduced verbatim from
  upstream's `DataAttributesTable`.
- No dedicated keyboard interactions, focus management, or `aria-*` wiring beyond standard HTML
  semantics are documented upstream for any part of this component, and none are added here beyond
  what composition with an actual interactive element (e.g. a menu trigger) naturally provides — this
  matches the WAI-ARIA Authoring Practices guidance that a purely presentational metric display with
  visible text content needs no additional ARIA role, live region, or `aria-label`, since the label
  and value text are themselves already accessible as ordinary text content. The one exception is
  FR-016: when the composed trigger's only visible content is the icon-only "action" indicator (no
  label/value text of its own to serve as an accessible name), an explicit `aria-label` is required —
  this is a targeted correction of an upstream a11y defect, not a general aria-label policy.
- Only the seven documented parts (container, label, indicator, value, trend, separator, description)
  are ported; no additional convenience parts are invented, since upstream does not offer one.
- **Divergence**: upstream exports only its `cva` table. This port additionally exports
  `statTrendVariants` (upstream inlines a `clsx` object), the readonly tuples
  `STAT_INDICATOR_VARIANTS` / `STAT_INDICATOR_COLORS` / `STAT_TREND_DIRECTIONS`, and the guards
  `resolveStatIndicatorVariant` / `resolveStatIndicatorColor` / `resolveStatTrendDirection`. The
  tuples are the single source of truth for the unions, the variant-table keys, the `data-*` values
  and the test/demo loops; the guards implement the Edge Case requirement that an unrecognised
  runtime value falls back to the axis default instead of leaking into a `data-*` attribute. This
  matches the precedent already set by the `status` port. No part, prop or behaviour is added.
- The upstream package name and CLI install command (`npx shadcn@latest add @diceui/stat`) are
  React/npm-specific and are not carried over; installation in this project happens exclusively
  through this project's own `registry.json` entry and `pnpm run registry:build` output, consistent
  with every other ported component.
