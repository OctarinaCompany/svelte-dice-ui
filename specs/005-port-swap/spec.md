# Feature Specification: Port Swap Component

**Feature Branch**: `005-port-swap`

**Created**: 2026-07-29

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Swap\" (slug: swap) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Click to swap between two states (Priority: P1)

A developer drops a `Swap` component with an "on" face and an "off" face (e.g. a sun/moon theme
toggle icon) into a page. By default, clicking the component toggles between the two faces, and the
component looks and behaves like a toggle button.

**Why this priority**: This is the default, documented activation mode and the primary reason the
component exists — every other behaviour (hover mode, animation styles, controlled state) is a
variation on this core toggle interaction.

**Independent Test**: Render `Swap` with a `SwapOn` and `SwapOff` child in the default configuration.
Click it and verify the on-face becomes visible/active and the off-face becomes hidden/inactive, and
that clicking again reverses it. Delivers value standalone as a working icon toggle.

**Acceptance Scenarios**:

1. **Given** a `Swap` with default (unswapped) state, **When** the user clicks it, **Then** the
   swapped face becomes visible and the component reports itself as pressed/swapped.
2. **Given** a `Swap` already in the swapped state, **When** the user clicks it again, **Then** it
   reverts to the unswapped state.
3. **Given** a `Swap` with focus, **When** the user presses `Enter` or `Space`, **Then** the state
   toggles exactly as a click would, and the default action of `Space` (page scroll) does not occur.

---

### User Story 2 - Hover to preview the alternate state (Priority: P2)

A developer sets `activationMode="hover"` so that moving the pointer over the component previews the
swapped face for as long as the pointer stays over it, reverting the moment the pointer leaves —
useful for reveal-on-hover affordances (e.g. showing a "mute" icon only while hovering a volume
control).

**Why this priority**: Documented as the second activation mode; it changes the interaction model
from a persistent toggle to a momentary preview and must not regress the click mode.

**Independent Test**: Render `Swap` with `activationMode="hover"`. Hover the pointer over it and
verify the swapped face appears; move the pointer away and verify it reverts. Clicking must not
toggle anything in this mode.

**Acceptance Scenarios**:

1. **Given** a `Swap` with `activationMode="hover"`, **When** the pointer enters the component,
   **Then** the swapped face becomes visible.
2. **Given** a `Swap` with `activationMode="hover"` in the hovered/swapped state, **When** the
   pointer leaves the component, **Then** it reverts to the unswapped face.
3. **Given** a `Swap` with `activationMode="hover"`, **When** the user clicks it, **Then** the state
   does not change from the click alone, and the component does not expose a pressed/button role
   (hover-activated swaps are not operable by keyboard or click, so they carry no interactive role).

---

### User Story 3 - Controlled state and disabled guard rail (Priority: P3)

A developer wires `Swap` to their own state (e.g. a global dark-mode flag) via the `swapped` /
`onSwappedChange` props, or disables it entirely while an action is in flight.

**Why this priority**: Necessary for real integrations (theme toggles driven by an app-wide store)
but is an extension of, not a prerequisite for, the core toggle behaviour in User Story 1.

**Independent Test**: Render `Swap` with `swapped` bound to external state and an `onSwappedChange`
handler; verify interacting with the component calls the handler and that the external state — not
internal click handling — is what ultimately decides which face is shown. Separately, render a
`disabled` `Swap` and verify neither click nor hover changes its state.

**Acceptance Scenarios**:

1. **Given** a `Swap` with a bound `swapped` value, **When** the user clicks it, **Then**
   `onSwappedChange` fires with the next boolean value and the displayed face follows the bound
   value (including when the parent changes the bound value directly, without a click).
2. **Given** a `Swap` with `disabled` set, **When** the user clicks or hovers it, **Then** the state
   does not change, the component exposes its disabled state to assistive technology, and it is
   removed from the tab order.
3. **Given** a `Swap` with `defaultSwapped={true}` and no bound `swapped` value, **When** it first
   renders, **Then** the swapped face is visible from the start without requiring an interaction.

---

### Edge Cases

- A user with `prefers-reduced-motion: reduce` set at the OS/browser level interacts with any
  `animation` variant: the face swap MUST happen instantly (no transition, rotation, flip, or scale
  animation) while the end state (which face is visible) is identical to the animated case.
- The page is rendered `dir="rtl"`: the component's own layout has no inherent left/right asymmetry
  (it is a single toggle, not an oriented list), so no directional inversion of behaviour is
  required beyond what the `rotate`/`flip` animations already express visually; RTL context is still
  read from the project's existing direction provider so any directional CSS logical properties used
  by consumers resolve correctly.
- `SwapOn` or `SwapOff` is rendered without a surrounding `Swap` ancestor: the part MUST throw a clear
  error naming both the part and the required `Swap` ancestor, rather than rendering with undefined
  state or crashing on a null read.
- Both `swapped` (controlled) and `defaultSwapped` (uncontrolled) are omitted: the component MUST
  start unswapped (`false`), matching upstream's fallback.
- The consumer changes the bound `swapped` value programmatically (not via click/hover): the
  displayed face MUST update to match, exactly as in a controlled form input.
- An `onclick` or `onkeydown` handler passed by the consumer calls `preventDefault()` on the event: the
  built-in toggle behaviour for that event MUST be suppressed, matching upstream's escape hatch for
  consumers who want to override or veto the default action. The same guard exists on `onmouseenter` /
  `onmouseleave`, but because those events are non-cancelable it can only be exercised by a deliberately
  cancelable dispatched event — a normal hover gesture can never veto the swap.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST provide a root part that renders exactly two child faces — an "on"
  face shown when swapped, and an "off" face shown when not swapped — and controls which one is
  visible/active based on its swapped state.
- **FR-002**: The root part MUST support `activationMode="click"` (default), where clicking the
  component toggles the swapped state.
- **FR-003**: The root part MUST support `activationMode="hover"`, where pointer entry sets the
  swapped state to true and pointer exit sets it to false; clicking MUST NOT toggle state in this
  mode.
- **FR-004**: The component MUST support both an uncontrolled mode (internal state seeded from a
  `defaultSwapped` prop, defaulting to `false`) and a controlled mode (a bound `swapped` value that
  is authoritative over internal state), matching this project's controlled/uncontrolled convention
  for value-bearing props.
- **FR-005**: The component MUST invoke a change callback whenever its swapped state changes as a
  result of user interaction, receiving the new boolean state.
- **FR-006**: The component MUST support four visual animation styles for the transition between
  faces — `fade` (default), `rotate`, `flip`, and `scale` — selected via an `animation` prop.
- **FR-007**: The component MUST support a `disabled` state in which click and hover interactions no
  longer change the swapped state, the disabled condition is exposed to assistive technology, and the
  component is not reachable via `Tab` key navigation.
- **FR-008**: In `click` activation mode, the root part MUST expose itself to assistive technology as
  a toggle button: an interactive role, a pressed/swapped state reflected as an ARIA property, and
  keyboard operability via `Enter` and `Space` (with `Space`'s default scroll behaviour suppressed).
- **FR-009**: In `hover` activation mode, the root part MUST NOT expose a button role or a
  pressed/swapped ARIA property, since the widget is not operable by keyboard or click in that mode
  and presenting it as a button would be misleading to assistive technology.
- **FR-009a**: In `click` activation mode the root part MUST carry an accessible name. The component
  MUST forward a consumer-supplied `aria-label` / `aria-labelledby` unchanged through its rest props,
  and the component's own documentation examples MUST each supply one, because the faces are icon-only
  and provide no accessible text of their own. A toggle button that assistive technology announces
  without a name is a defect, not an upstream-parity concession.
- **FR-010**: The component MUST expose its current swapped state, its configured animation style,
  its disabled condition, and whether reduced motion is in effect as inspectable attributes on the
  rendered root element, so consumers can target every state and variant with their own styling
  without needing to duplicate the component's internal logic.
- **FR-011**: The "on" and "off" faces MUST each expose their own current visibility (matching the
  parent's swapped state) as an inspectable attribute, so consumers can style the transition of each
  face independently (e.g. fading one out while the other fades in, or offsetting the hidden face so
  it does not affect layout).
- **FR-012**: When the user has requested reduced motion, the transition between faces MUST occur
  instantly, with no animated rotation, flip, scale, or fade, regardless of the configured
  `animation` style; the final visible/hidden result MUST be unchanged.
- **FR-013**: Using an "on" face or "off" face part outside of a root part MUST fail loudly with an
  error identifying both the part and the required root ancestor, rather than silently rendering
  incorrect or blank content.
- **FR-014**: The component MUST allow a consumer's own click, pointer-enter, pointer-leave, and
  keydown handlers to run before the component's built-in toggle logic, and MUST skip the built-in
  behaviour for any of those events whose `defaultPrevented` flag is set by the consumer's handler.
  Note that `mouseenter` and `mouseleave` are non-cancelable in the DOM, so for those two events the
  guard is only reachable via an explicitly cancelable dispatched event; the guard is retained for
  upstream parity and MUST be verified that way rather than through a normal pointer gesture.
- **FR-015**: The component MUST be installable and importable exactly like the project's other
  first-party UI components: as source under the project's UI component directory, exported through
  an index barrel, and listed as an entry in the project's own component registry.
- **FR-016**: A documentation page for the component MUST exist that exercises every example shown on
  the upstream documentation page (a click-to-swap example, a hover-to-swap example, and an
  all-four-animation-styles example).

### Key Entities

- **Swap state**: A single boolean — swapped or not swapped — shared by the root part and its two
  face parts. Owned internally when uncontrolled, or owned by the consumer when a swapped value is
  bound.
- **Activation mode**: A configuration choice (`click` or `hover`) fixed by the consumer per
  instance; it changes which interactions are allowed to change the swap state and which ARIA role
  the root exposes.
- **Animation style**: A configuration choice (`fade`, `rotate`, `flip`, `scale`) fixed by the
  consumer per instance; it changes only the visual transition, never the underlying state semantics.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer already familiar with the upstream Dice UI Swap component can use this
  port's root, on-face, and off-face parts with no prop, callback, or data-attribute renamed or
  missing from what the upstream documentation describes.
- **SC-002**: 100% of the interaction scenarios described in User Stories 1–3 (click toggle, hover
  preview, controlled binding, disabled guard rail, keyboard operation) pass automated tests driven
  through simulated user input, not direct state manipulation.
- **SC-003**: Every documented keyboard interaction (`Enter`, `Space` in click mode) produces the
  same state change as the equivalent pointer interaction, verified by an automated test.
- **SC-004**: With reduced motion requested, an automated test confirms the face swap completes with
  no animation applied, while producing the identical end state as the animated case.
- **SC-005**: All four quality gates (type-check, lint, unit tests, build) pass with zero
  suppressions on the finished port.
- **SC-006**: The documentation page renders all three upstream examples (default click/hover pair,
  and the four-animation grid) without visual or console errors.

## Assumptions

- Only the **radix base** of upstream Swap is ported (the variant at
  `.reference/diceui/docs/registry/bases/radix/ui/swap.tsx` / documented at
  `docs/content/docs/components/radix/swap.mdx`), consistent with how this repository has ported
  other `radix`-based components so far; the parallel `base` (non-Radix) variant under
  `docs/registry/bases/base/ui/swap.tsx` is not a separate deliverable. The two variants differ only in
  their composition escape hatch — the `base` variant's `SwapProps` extends `useRender.ComponentProps<'div'>`
  and takes a `render` prop, while the `radix` variant defines `asChild?: boolean` — and both map onto this
  repository's `child` snippet pattern (see below), so porting one is not a loss of API surface. The radix
  base is chosen for consistency with prior ports, even though the constitution's Principle II / IX prose
  cites the `base` MDX and examples paths; the two MDX files are otherwise byte-identical apart from
  base/path metadata, so this is a path deviation, not a content one.
- Upstream's `asChild` prop (a Radix `Slot`-based render-as-child escape hatch) is **dropped** in
  favour of this project's existing `child` snippet pattern (see `dialog-content.svelte` and
  CLAUDE.md §10), because Svelte 5 has no direct equivalent of React's `Slot` composition and every
  other ported component in this repository already standardises on the snippet form for this
  capability.
- Upstream's internal `useStore`/`React.useSyncExternalStore`-based store (a hand-rolled pub/sub used
  only because React function components have no persistent instance) is replaced by a single
  `SwapState` class in `swap.svelte.ts` holding `swapped` as `$state`, shared through a `Symbol`
  context key per CLAUDE.md §5. This is an internal implementation detail with no observable API
  difference for consumers.
- Upstream's `useIsomorphicLayoutEffect` synchronisation between the `swapped` prop and internal state
  is expressed as `value ??=`-style prop/state reconciliation idiomatic to this project's
  controlled/uncontrolled convention (CLAUDE.md §4), not as a literal effect — the observable
  behaviour (a bound `swapped` value is always authoritative) is unchanged.
- Reduced-motion handling is not present in the upstream source beyond the `motion-reduce:` Tailwind
  variants baked into its class strings. Those variants are **kept verbatim** (so the port is never worse
  than upstream, including pre-hydration and with JS disabled), and this port **additionally** ships a
  small runes reader — `useReducedMotion()` / `ReducedMotionReader` in `swap.svelte.ts`, exported from the
  barrel — that reads `(prefers-reduced-motion: reduce)` through `window.matchMedia` behind an SSR guard,
  subscribes to its `change` event in an `$effect` with a teardown, and drives two additive outputs: the
  root gains `data-motion="reduce"` and the two faces omit their `transition-all duration-300` utilities.
  This is a **deliberate additive divergence** from upstream: nothing upstream is renamed, dropped or
  changed. It is required because FR-012 / SC-004 demand an asserting automated test and jsdom applies no
  CSS, so a variant-only mechanism could only ever be asserted as a literal class string. Recorded as row 5
  of the divergence ledger in `contracts/swap-public-api.md` §6 and as research decision D-007.
- No dedicated `bits-ui` primitive exists for a two-state "swap" toggle; the closest analogues
  (`bits-ui`'s Toggle/Switch) encode different semantics (a single control with a checked value, not
  two independently styleable face slots) and are not composed for the root — a small root-level
  state class is used instead, per the composition-over-reimplementation order in CLAUDE.md §4 and
  constitution Principle IV (bits-ui was evaluated and lacks a two-slot swap-face abstraction).
- The RTL requirement is satisfied by ensuring the component reads directional context from this
  project's existing `direction-provider` where CSS logical properties are involved, since Swap's own
  markup (a single element with two overlaid children) has no left/right-specific behaviour to invert
  — unlike, say, a horizontally-navigable list. No new directional logic is introduced.
- `data-state` values are `"on"` / `"off"` (matching upstream literally, not `"swapped"`/`"unswapped"`
  or `"checked"`/`"unchecked"`), preserving Principle II parity even though this diverges from some of
  this project's other `data-state="open"/"closed"` boolean components.
- Upstream routes its controlled-prop synchronisation through the same `setState` path as user interaction,
  so a **parent-driven** change of the `swapped` prop also re-fires `onSwappedChange`. This port fires
  `onSwappedChange` only when the component itself changes the value (click, hover, `Enter`/`Space`), per
  FR-005. The React behaviour is an echo artefact of the controlled-prop shim rather than a documented
  feature, and reproducing it would call the consumer's callback in response to the consumer's own write —
  infinite-loop bait for `onSwappedChange={(v) => (swapped = v)}`. Divergence ledger row 4 / research D-002.
- Upstream exports its internal `useStore` hook under the public name `useSwap`, taking a selector function
  and returning the selected slice. This port keeps the exported name `useSwap` but returns the shared
  `SwapState` instance directly, because runes make selector-based subscription unnecessary — every member
  of `SwapState` is already fine-grained `$derived` state. No export is renamed or dropped. Divergence
  ledger row 6.
- The inactive face is hidden only visually (`data-[state=off]:absolute data-[state=off]:opacity-0`), so
  both the on-face and the off-face remain in the accessibility tree and are announced together by a screen
  reader — matching upstream exactly. This is a deliberate choice to keep Principle II parity rather than an
  oversight: the root's own accessible name (FR-009a) is what a screen reader announces for the toggle
  itself, and the faces are decorative icon content rather than independently meaningful text, so leaving
  both mounted does not create a distinct a11y defect beyond what upstream already ships.
