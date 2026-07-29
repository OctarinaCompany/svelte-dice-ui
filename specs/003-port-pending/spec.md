# Feature Specification: Pending Utility

**Feature Branch**: `003-port-pending`

**Created**: 2026-07-29

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Pending\" (slug: pending) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Show a busy state on a submit action without losing keyboard access (Priority: P1)

A developer building a form or action button wants to mark it as "pending" while an asynchronous
operation (a network request, a simulated delay, a navigation) is in flight, so that a user cannot
double-submit or re-trigger the action, while the control stays reachable by keyboard and screen
reader users are told the control is busy.

**Why this priority**: This is the core, most common use of the utility — wrapping a single button
or link during an async action — and is demonstrated first on the upstream docs page.

**Independent Test**: Render an interactive element (e.g. a button) wrapped by the pending utility
with its pending state toggled to true. Verify the element cannot be activated by click or by
keyboard (`Enter`/`Space`), remains focusable, and exposes `aria-busy="true"` and
`aria-disabled="true"`. Toggling pending back to false restores normal interaction.

**Acceptance Scenarios**:

1. **Given** an interactive element with pending state set to true, **When** a user clicks it,
   **Then** the click is prevented and no action fires.
2. **Given** an interactive element with pending state set to true, **When** a user tabs to it and
   presses `Enter` or `Space`, **Then** the key press is prevented and no action fires, and the
   element still receives focus.
3. **Given** an interactive element with pending state set to true, **Then** it exposes
   `aria-busy="true"`, `aria-disabled="true"`, and a `data-pending` attribute.
4. **Given** an interactive element with pending state set back to false, **When** a user clicks or
   activates it via keyboard, **Then** the action fires normally and none of the pending attributes
   are present.

---

### User Story 2 - Apply pending behaviour to any element via a wrapper, without changing its markup (Priority: P2)

A developer wants to add pending behaviour to an existing interactive element (a button, a link, a
switch) without rewriting that element's own event handlers, by wrapping it in a single component
that merges the pending behaviour onto whichever single child element it receives.

**Why this priority**: This is the second API surface the upstream component offers (the wrapper
component, as opposed to the lower-level hook), demonstrated in three of the five upstream examples
(wrapper, link, switch) and needed for composing with elements the developer does not directly
control the props of.

**Independent Test**: Render the wrapper in merge mode around a single interactive child with pending
state true. Verify the resulting DOM node is the child itself (no extra wrapper element) and that it
carries the merged pending attributes and event-prevention behaviour. Then render the same child in
fallback mode and verify a single `display:contents` wrapper hosts the attributes and suppresses the
descendant's interaction.

**Acceptance Scenarios**:

1. **Given** the wrapper component in merge mode around a single child button, **When** rendered,
   **Then** the DOM contains exactly one button element carrying both its own attributes and the
   pending attributes — no additional wrapping element is introduced. **Given** the same child in
   fallback mode, **Then** exactly one `display:contents` wrapper is introduced and it carries the
   pending attributes.
2. **Given** the wrapper component around a child link (anchor) with pending state true, **When** a
   user clicks the link, **Then** navigation is prevented and the link keeps its `href` and remains
   focusable.
3. **Given** the wrapper component around a child switch control with pending state true, **When** a
   user tries to toggle it, **Then** the toggle is prevented while the control remains focusable and
   exposes the pending data attribute for the switch's own styling hook.

---

### User Story 3 - Style an element differently while it is pending or disabled (Priority: P3)

A developer wants to visually distinguish a pending or disabled control (e.g. reduced opacity, a
"wait" cursor, a spinner swapped into the label) using the same styling hooks the project's other
components already expose, without writing conditional class logic themselves.

**Why this priority**: Styling hooks are what make the state visible to end users; every upstream
example pairs the pending state with content or class changes driven off of it, but this is
secondary to the underlying behavioural and accessibility contract of Stories 1 and 2.

**Independent Test**: Render an element through either API surface with pending state toggled and
verify the `data-pending` and `data-disabled` attributes appear/disappear in lockstep with the
respective boolean inputs, independent of one another (an element can be `disabled` without being
`pending`, and vice versa).

**Acceptance Scenarios**:

1. **Given** an element with `disabled` true and pending state false, **Then** it exposes
   `data-disabled` but not `data-pending`, `aria-busy`, or event prevention.
2. **Given** an element with pending state true, **Then** it exposes `data-pending`, `aria-busy`, and
   `aria-disabled`, and remains keyboard-focusable throughout.

---

### Edge Cases

- What happens when both `disabled` and pending state are true at once? The element exposes both
  `data-disabled` and the full pending attribute/event-prevention set; behaviour does not differ from
  pending-only, since pending already implies non-interactivity.
- (Non-normative) If pending state flips from true to false while the user's pointer is already down
  on the element, the exact fate of that in-flight gesture is an implementation detail of handler
  timing rather than a tested requirement: this port does not assert a specific outcome for it.
- What happens when the wrapper component receives neither a merge snippet nor a plain child? It
  throws a clear, documented error naming both options. Because Svelte has no `React.Children`
  inspection, a snippet that renders zero or several elements cannot be detected at runtime: in merge
  mode the caller decides where the props land, and in fallback mode every element rendered inside the
  `display:contents` wrapper is covered by the wrapper's capture-phase prevention. This is documented
  on the demo page instead of enforced.
- How does the pending state affect an element under `dir="rtl"`? Pending has no directional
  behaviour of its own (no arrow-key navigation), so right-to-left layouts are unaffected beyond the
  project's existing direction handling of the wrapped element itself.
- What happens when no `id` is supplied? A stable id is generated automatically so the element always
  has an identifiable id, matching the upstream default.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide a way to derive a set of "pending props" — an id, ARIA
  attributes, data attributes, and event-prevention handlers — from a boolean pending input and an
  optional boolean disabled input and an optional id, for direct use on any interactive element, and
  MUST also return the resolved pending flag itself so a consumer can drive label, icon and copy
  changes from the same source.
- **FR-002**: The system MUST provide a wrapper component with two modes: a primary *merge* mode that
  hands the merged pending props to the caller's own single element and introduces **no** extra DOM
  node, and a *fallback* mode for a plain child that hosts the pending props on a single
  `display:contents` wrapper element which adds no layout box. The merge mode MUST be the documented
  path and MUST be used by the demo sections that wrap a link, a switch or a button.
- **FR-003**: When the pending input is true, the system MUST set `aria-busy="true"` and
  `aria-disabled="true"` on the element that hosts the pending props — the consumer's own interactive
  element in merge mode — and MUST NOT remove it from the tab order (it remains focusable).
- **FR-004**: When the pending input is true, the system MUST prevent the element's default response
  to click/pointer/mouse activation and to keyboard activation (`Enter` and `Space`), so no action
  handler attached to that element fires as a result of user interaction while pending.
- **FR-005**: When the pending input is true, the system MUST expose a `data-pending` attribute on
  the element; when false, that attribute MUST be absent (not merely `"false"`).
- **FR-006**: When the disabled input is true, the system MUST expose a `data-disabled` attribute on
  the element, independent of the pending state; when false, that attribute MUST be absent.
- **FR-007**: The system MUST accept an optional id and use it verbatim when provided; when omitted,
  it MUST generate a stable unique id for the lifetime of the component instance.
- **FR-008**: Both API surfaces (the props-deriving form and the wrapper component in merge mode)
  MUST accept the same pending/disabled/id inputs and produce an identical attribute set on the same
  element, so a developer can choose either surface without a behavioural difference. The wrapper's
  fallback mode MUST produce the same attribute set and the same interaction prevention, but hosts the
  attributes on its `display:contents` wrapper rather than on the interactive descendant; it is
  therefore documented as the convenience path and MUST NOT be used where the busy state has to reach
  assistive technology.
- **FR-009**: The wrapper component MUST merge the pending attributes and handlers onto the caller's
  element rather than replacing that element's own attributes, preserving the child's own event
  handling for the non-pending case. It MUST throw a clear, documented error naming both snippet
  options when neither a merge snippet nor a plain child is supplied. Because Svelte cannot inspect
  the contents of a snippet, a snippet containing zero or more than one element is a documented
  consumer responsibility rather than a runtime-enforced one.
- **FR-010**: The system MUST work with any interactive HTML element type a consumer composes it
  with (buttons, links, form fields, custom controls such as switches), not only a specific built-in
  component.
- **FR-011**: The system MUST be usable inside a right-to-left (`dir="rtl"`) layout without any
  directional behaviour of its own interfering with the surrounding layout direction.
- **FR-012**: The demo page MUST provide one runnable example per upstream example page (the basic
  hook-driven button, the form submission with pending state, the navigation link, the toggle
  switch, and the wrapper-component variant).
- **FR-013**: The component MUST be distributed as installable source through the project's own
  component registry, alongside its documented API, exactly like the project's existing first-party
  UI components.

### Key Entities

- **Pending state**: A boolean flag, supplied by the consuming developer (not computed internally
  from a promise or transition, per the Assumptions below), indicating whether the element it is
  applied to is currently busy performing an asynchronous action.
- **Pending attributes** (`PendingAttributes`, upstream `pendingProps`): The derived set of ARIA
  attributes, data attributes, an id, and event-prevention handlers that together implement the
  busy-but-focusable behaviour on whichever element they are applied to. Derived via the
  props-deriving form (`usePending`), the wrapper's *merge mode*, or its *fallback mode* (see
  Assumptions).
- **Disabled state**: A boolean flag, independent of pending state, indicating the element should be
  marked `data-disabled` for styling purposes.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer can add busy-but-focusable behaviour to any interactive element in under
  five minutes by choosing either of the two documented API surfaces, without writing their own
  event-prevention logic.
- **SC-002**: 100% of interaction attempts (click, pointer, mouse, `Enter`, `Space`) on an element
  while its pending input is true are prevented, verified across every demo example (button, form,
  link, switch, wrapper).
- **SC-003**: 100% of elements with pending input true remain reachable by keyboard `Tab` navigation,
  matching upstream's focus-retention guarantee.
- **SC-004**: Every example shown on the upstream documentation page has an equivalent, runnable
  demonstration on this project's documentation site.
- **SC-005**: The component can be installed into a new project through the project's registry
  tooling in a single command, exactly like any other first-party component.

## Assumptions _(mandatory)_

- Upstream's `usePending` hook has no direct Svelte equivalent because Svelte has no hook mechanism;
  it is ported as a plain exported function (in `pending.svelte.ts`, not a class, since it holds no
  ongoing reactive state beyond deriving attributes from its inputs) that returns the same
  `pendingProps`-shaped object plus `isPending`, called directly in a component's script.
- Upstream's `Pending` wrapper component depends on Radix `Slot` to merge props onto a single child
  without adding a DOM node. This project's translation table (`CLAUDE.md` §10) directs `asChild`/
  `Slot` patterns to a `child` snippet instead; the ported wrapper therefore exposes a `child` snippet
  prop (`{#snippet child({ props })}`) as its Svelte-idiomatic single-child merge point, in addition to
  a plain `children` snippet for the common case of a single native element — mirroring how
  `dialog-content.svelte` already offers both in this repository. This is a deliberate divergence from
  upstream's implicit `React.Children`-based single-child cloning, recorded here per constitution
  Principle II.
- Upstream has no `useFormStatus`/`useTransition` integration in the Pending utility itself (those
  React APIs are absent from `pending.tsx`); the component-specific guidance in this port's brief
  about modelling pending state explicitly is already upstream's own design — `isPending` is always a
  value the consumer computes and passes in, never inferred from a `<form>` or a transition. No
  additional "action handler" concept is introduced beyond what upstream already exposes; this spec
  does not add a controlled/uncontrolled pair beyond the existing `isPending: boolean` input, since
  upstream defines none.
- The `id` auto-generation upstream performs via `React.useId()` is ported using this project's
  existing Svelte id-generation convention (`$props.id()` / the bits-ui `useId` helper already used
  elsewhere in the repo per `CLAUDE.md` §10), not a new mechanism.
- Only the base (non-Radix-primitive) behaviour of the upstream `pending.tsx` file is ported: it wraps
  Radix's `Slot` for child-merging only, and does not depend on any other Radix primitive's state
  machine, so there is no bits-ui primitive being composed here beyond ordinary HTML attribute
  merging.
- "Switches" and other composite controls used in the demo (e.g. the shadcn-svelte `Switch`) already
  exist in `src/lib/components/ui/`; the demo composes them rather than re-implementing switch
  behaviour, per Principle IV / composition-first scope.
- RTL support for this utility means "does not break or need special-casing under `dir="rtl"`" rather
  than "has directional keyboard behaviour of its own," since upstream documents no arrow-key or
  directional interaction for Pending at all.
- The upstream `disabled` prop and `data-disabled` attribute are ported verbatim as a plain visual/
  styling flag; they do not set `disabled` on the underlying native element (upstream does not either)
  so the element remains focusable regardless of this flag, consistent with FR-003's focusability
  guarantee applying even when `disabled` is true without `isPending`.
- `data-pending` / `data-disabled` are emitted as the empty string when set and omitted entirely when
  not, rather than upstream's `"true"` (plan.md divergence D3). `[data-pending]` and Tailwind's
  `data-pending:` selectors behave identically, and Constitution VIII mandates `cond ? '' : undefined`.
- Radix `Slot` composes the child's handler *and* the slot handler; here the merged props are spread
  last so the pending handler **replaces** the consumer's handler for the prevented events (plan.md
  divergence D4). This is upstream's own documented hook semantics ("spread `pendingProps` last") and
  is what FR-004 requires.
- Upstream's two `React.useMemo` wrappers are dropped; `$derived`/`$derived.by` already cache and
  invalidate (plan.md divergence D6).
- The returned state exposes an extra `disabled` member that upstream's `UsePendingReturn` does not
  have, for symmetry with `isPending`. It is additive and cannot break upstream-shaped consumer code.
- Two symbols with no upstream counterpart are exported for testability and for bare (non-component)
  `usePending()` calls: `PendingState` (the class that replaces the `UsePendingReturn` object) and
  `createPendingId()` (the `pending-<n>` fallback id generator, needed because `$props.id()` cannot be
  used outside a component).
- In `children` fallback mode only, the wrapper additionally attaches capture-phase handlers that call
  `preventDefault()` **and** `stopPropagation()`, so the descendant never receives the event. Upstream
  needs no equivalent because `Slot` merges directly onto the child. `child` mode has no capture
  handlers.
- The `usePending`/wrapper hook emits no `data-slot` key in `pendingProps`; `data-slot="pending"` is
  emitted only by the wrapper's fallback `<span>`, since the props object is spread last onto an
  element the consumer owns and a `data-slot` there would overwrite the consumer's own
  (`data-slot="button"`, `data-slot="switch"`, …), breaking the shadcn `data-[slot=…]` selectors
  (plan.md divergence D7).
- In the wrapper's `children` fallback mode the ARIA state (`aria-busy`, `aria-disabled`) and the `id`
  land on the `display:contents` wrapper, not on the interactive descendant, because Svelte cannot
  clone a child element the way Radix `Slot` does. Interaction prevention is still complete
  (capture-phase handlers), but the screen-reader busy announcement is not — which is why merge mode
  (`child`) is the documented path and is used by four of the five demo sections.
