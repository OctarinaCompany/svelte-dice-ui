# Feature Specification: Port Stepper Component

**Feature Branch**: `031-port-stepper`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Stepper\" (slug: stepper) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Guide a user through a multi-step flow (Priority: P1)

A consumer of the component library builds a multi-step process (account setup, checkout, onboarding) and needs a stepper that shows the list of steps, tracks which one is active, lets the visitor jump between steps by clicking a step trigger, and displays only the content belonging to the active step.

**Why this priority**: This is the core value of the component — without step tracking and content switching there is no stepper.

**Independent Test**: Render a Stepper with three steps and per-step content; confirm only the active step's content is visible, its trigger is marked current, and clicking another step's trigger switches both the active state and the visible content.

**Acceptance Scenarios**:

1. **Given** a Stepper with three steps and a default active step, **When** the component renders, **Then** only the content belonging to the default step is visible and its trigger reports itself as the current step.
2. **Given** a Stepper with three steps, **When** the visitor clicks the trigger of a step other than the active one, **Then** that step becomes active, its content becomes visible, the previously active step's content is hidden, and any change callback fires with the new step's identifier.
3. **Given** a Stepper where step 1 precedes the active step, **When** the component renders, **Then** step 1 is presented in a "completed" state and the active step in an "active" state, and steps after it are "inactive".

---

### User Story 2 - Move sequentially with Previous/Next controls (Priority: P2)

A consumer adds Previous/Next buttons so visitors can move through the steps in order without needing to target a specific step trigger, with the buttons automatically disabling at the first/last step.

**Why this priority**: Sequential navigation is the most common real-world pattern (wizards, checkout flows) built on top of the core step-tracking behaviour from User Story 1.

**Independent Test**: Render a Stepper with Previous/Next controls; confirm Previous is disabled on the first step, Next is disabled on the last step, and clicking either moves exactly one step in the corresponding direction.

**Acceptance Scenarios**:

1. **Given** the active step is the first step, **When** the component renders, **Then** the Previous control is disabled.
2. **Given** the active step is the last step, **When** the component renders, **Then** the Next control is disabled.
3. **Given** the active step is a middle step, **When** the visitor activates the Next control, **Then** the following step becomes active; **When** the visitor then activates the Previous control, **Then** the original step becomes active again.

---

### User Story 3 - Validate a step before advancing (Priority: P3)

A consumer building a multi-step form wants to run validation (e.g. required-field checks) before the visitor is allowed to move forward, while still allowing free backward movement, so invalid data never silently skips a step.

**Why this priority**: This unlocks the form-wizard use case highlighted in the upstream documentation, but a stepper is fully usable without it, so it ranks below the core and sequential-navigation behaviours.

**Independent Test**: Render a Stepper with a validation callback that can be made to reject; confirm a forward move (via trigger, keyboard, or Next) that fails validation does not change the active step, while a backward move is never blocked by validation.

**Acceptance Scenarios**:

1. **Given** a validation callback that resolves to `true`, **When** the visitor attempts to move forward, **Then** the callback is invoked with the target step and a "next" direction, and the step change proceeds.
2. **Given** a validation callback that resolves to `false`, **When** the visitor attempts to move forward, **Then** the active step does not change and no change callback fires.
3. **Given** a validation callback that resolves to `false` for forward movement, **When** the visitor moves backward instead, **Then** the callback is not required to pass and the move succeeds.

---

### Edge Cases

- A step marked disabled cannot become active via click, keyboard focus-activation, or programmatic Next/Previous, and is skipped when arrow-key roving focus moves between triggers.
- A step explicitly marked `completed` always reports a "completed" state regardless of its position relative to the active step.
- With zero or one step registered, Previous and Next are both disabled and no navigation occurs.
- Rapidly changing the active step (controlled usage) while an asynchronous validation call from a previous interaction is still pending must not apply a stale validation result to the now-current step.
- In `nonInteractive` mode, triggers no longer respond to pointer clicks or `Enter`/`Space`, but the active step can still be changed by the consumer through the controlled `value` prop.
- When `orientation="vertical"`, `ArrowLeft`/`ArrowRight` no longer move focus between steps but `ArrowUp`/`ArrowDown` do (and the reverse for `orientation="horizontal"`).
- With `dir="rtl"`, `ArrowLeft` and `ArrowRight` swap their meaning so the visual direction of "previous"/"next" travel stays consistent with reading direction.
- With `loop` enabled, pressing the "next" arrow key on the last (non-disabled) step wraps focus and activation (when in automatic activation mode) to the first step, and vice versa.
- Removing a step (e.g. an item unmounts) updates step count, position (`aria-posinset`/`aria-setsize`), and completed/inactive derivation for the remaining steps.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The stepper MUST support both uncontrolled use (an initial active step with internal state) and controlled use (an externally supplied active step plus a change notification), matching the state of the given step's identifier.
- **FR-002**: The stepper MUST render a list of step items, each carrying a unique step identifier, and derive a per-step display state of "active" (the current step), "completed" (a step considered finished, either because it precedes the active step or because it is explicitly marked complete), or "inactive" (any other step).
- **FR-003**: Each step item MUST support being individually marked disabled, in which case it cannot become active through any interaction (pointer, keyboard activation, or roving-focus arrival) and is skipped when arrow-key roving focus moves between triggers, while remaining a valid destination for controlled `value` changes made by the consumer. `disabled` and `completed` are independent flags: a step MAY be both, and a disabled step that is explicitly marked completed MUST still report a "completed" display state.
- **FR-004**: The stepper MUST render a separate content region per step, showing only the content belonging to the active step and hiding all others, unless a step's content is explicitly told to remain mounted at all times.
- **FR-005**: The stepper MUST provide Previous and Next controls that move exactly one step backward or forward respectively, are disabled at the first step (Previous) and last step (Next), and are disabled entirely when no steps are registered.
- **FR-006**: The stepper MUST support an optional asynchronous validation check that runs before a forward step change (via trigger activation, keyboard navigation, or the Next control) is committed; the step change proceeds only if the check succeeds, and backward moves are never subject to this check.
- **FR-007**: A failed or rejected validation check MUST leave the active step unchanged and MUST NOT fire the change notification.
- **FR-008**: The stepper MUST support an "automatic" activation mode (moving keyboard focus to a step trigger also activates that step, subject to validation) and a "manual" activation mode (moving focus does not activate a step; only explicit activation via click or Enter/Space does).
- **FR-009**: The stepper MUST support a "non-interactive" mode in which step triggers no longer respond to pointer or keyboard activation, while the active step can still change through consumer-controlled state.
- **FR-010**: Step triggers MUST expose their position (1-based) and the total step count so that assistive technology can announce "step X of Y".
- **FR-011**: Step triggers MUST be reachable via a single Tab stop that moves focus into the step list, after which arrow keys move focus between step triggers ("roving tabindex"); Home or PageUp moves focus to the first non-disabled step trigger and End or PageDown to the last.
- **FR-012**: The stepper MUST support both a horizontal orientation (left/right arrow keys move between step triggers) and a vertical orientation (up/down arrow keys move between step triggers), and MUST expose the current orientation for styling.
- **FR-013**: In right-to-left layouts, the left/right arrow key roles MUST invert so that "previous" and "next" travel remain consistent with the reading direction; up/down behaviour is unaffected by direction.
- **FR-014**: The stepper MUST support an optional "loop" behaviour where arrow-key navigation past the last (or before the first) non-disabled step trigger wraps around to the opposite end, instead of stopping.
- **FR-015**: The stepper MUST notify the consumer whenever a step's completed state changes, whenever a step is registered, and whenever a step is unregistered, in addition to notifying on active-step change.
- **FR-016**: Each step trigger MUST be labelled by an associated title and, when present, an associated description, and MUST communicate its current/selected status to assistive technology.
- **FR-017**: The visual connector between adjacent steps MUST reflect the same active/completed/inactive derivation as the step it follows, and MUST NOT render after the final step unless explicitly told to remain mounted.
- **FR-018**: The component MUST be distributed as installable source under the project's UI component alias, with a public barrel export, and be listed in the project's component registry so it can be added to a consuming project the same way as any other registry component.
- **FR-019**: A documentation page MUST demonstrate one example per upstream demo file — the default horizontal layout, a vertical layout, a validation-gated flow, and a multi-step form flow — mirroring the upstream examples.
- **FR-020**: The stepper MUST support being disabled as a whole, in which case every step trigger reports itself as disabled and no step can be activated by pointer or keyboard, independently of any per-step disabled flag; the disabled state MUST be exposed on the stepper for styling.

### Key Entities

- **Step**: One stage of the process. Attributes: a unique identifier (its `value`), a 1-based position among registered steps, a completed flag (explicit or derived), a disabled flag, and a derived display state (active / completed / inactive).
- **Stepper state**: The active step identifier for the whole stepper, either owned internally (uncontrolled) or supplied and owned by the consumer (controlled), plus the ordered collection of registered steps.
- **Navigation direction**: Whether a requested step change is moving toward a later step ("next") or an earlier one ("prev"); determines whether the optional validation check applies.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A consumer can build a working multi-step flow (step list, per-step content, Previous/Next controls) by composing the shipped parts, with no additional custom state-management code, in under 10 lines of template markup beyond the step data itself.
- **SC-002**: 100% of the upstream component's documented props, data attributes, ARIA roles/states, and keyboard interactions listed in its documentation page are reproduced and covered by an automated test.
- **SC-003**: Keyboard-only visitors can reach any step trigger, move between step triggers with arrow keys (respecting orientation and RTL inversion), jump to the first/last step with Home/End, and activate a step, without ever losing keyboard focus to an unreachable or invisible element.
- **SC-004**: Screen reader users are told the current step's position among the total (e.g. "step 2 of 4") and which step is currently selected, without relying on colour alone.
- **SC-005**: Every example on the upstream documentation page — the default demo plus Vertical Layout, With Validation and With Form, four in total, one per `stepper-*-demo.tsx` — has a corresponding working demo on the project's documentation site.

## Assumptions _(mandatory)_

- Upstream's `asChild` prop (Radix `Slot`-based render-as-another-element composition) is dropped from every part in favour of the repository's existing `child` snippet pattern (see `dialog-content.svelte`), because Svelte 5 has no direct equivalent to a React "Slot" — this is the standard translation already used throughout this repository (CLAUDE.md §10).
- Upstream's internal `useSyncExternalStore`-backed store, `useLazyRef`, `useAsRef`, and `useComposedRefs` hooks are reimplemented as a single reactive state class (`StepperState`) in `stepper.svelte.ts`, following the repository's `.svelte.ts` state-class convention (CLAUDE.md §4/§10) — there is no concept of an external store in Svelte 5 runes.
- Upstream's `React.useId()`-generated `rootId` (used to derive per-step `trigger`/`content`/`title`/`description` element ids) is generated with the project's existing id-generation convention (`$props.id()` / bits-ui `useId`) rather than a bespoke implementation.
- Upstream's direction (`dir`) resolution via `radix-ui`'s `Direction.useDirection` is replaced by this project's existing direction/RTL context provider (`direction-provider`), which is already ported and used by other components — no new RTL mechanism is introduced.
- The roving-focus / arrow-key / entry-focus behaviour (a hand-rolled implementation of the Radix `roving-focus-group` primitive) is composed from this repository's existing pieces wherever they fit — the document-ordered trigger registry is `speed-dial`'s exported `DomOrderedCollection`, and `focusFirst`, `wrapArray` and `getDirectionAwareKey` are imported unchanged from `action-bar`'s roving-focus module — with only the group state class itself written bespoke on `StepperList`/`StepperTrigger`. bits-ui exposes no standalone roving-focus-group primitive, and `action-bar`'s `RovingFocusGroupState` cannot stand in because it cannot cancel a focus move on an awaited validation, has no notion of a selected value for entry-focus priority, and does not map `PageUp`/`PageDown`; the full justification is in `plan.md`.
- The `useStepper` convenience hook re-export (an alias for the internal store selector hook) is not ported as a public export: it is an internal implementation detail of the store, and Svelte consumers read stepper state through the same context/state class every part already uses; nothing in the upstream MDX documents it as public API.
- `StepperIndicator`'s children prop, which upstream accepts as either a `ReactNode` or a render function of the current data-state, is ported as an optional `child`-less default (step position number or a checkmark icon) plus a `Snippet<[DataState]>` prop for custom content, per the render-prop translation rule in CLAUDE.md §10.
- The checkmark icon shown for a completed step (`lucide-react`'s `Check`) is ported to this project's existing `@lucide/svelte` `Check` icon — a like-for-like icon swap, not a design change.
- "Non-linear" step navigation (jumping to any step by clicking its trigger, without requiring prior steps to be completed) is the default, matching upstream's lack of any `linear` prop; forward-only enforcement is available exclusively through the existing `onValidate` callback, exactly as upstream documents it — no new `linear` prop is invented.
- Upstream's status colours (`data-[state=active]`/`data-[state=completed]` borders, backgrounds and text) already use semantic `primary`/`primary-foreground`/`muted`/`muted-foreground`/`background` tokens with no raw palette classes, so no status-colour remapping (CLAUDE.md §6) is required for this component.
- Only the Radix/shadcn base variant of Stepper (`docs/registry/bases/radix/ui/stepper.tsx`) is ported; there is no separate non-Radix "base" implementation of this component upstream, so no additional variant decision is needed.
- Upstream's `StepperTitle` and `StepperDescription` emit a bare `data-slot="title"` / `data-slot="description"`; here they emit `data-slot="stepper-title"` / `data-slot="stepper-description"`, and `StepperTrigger`'s two `not-has-data-[slot=…]:rounded-full` selectors are updated to match. The prefixed form is required without exception by the project constitution (Principle VIII), and the bare names genuinely collide with the `data-slot="title"` already shipped by `card`, `alert` and `empty` — a Stepper nested in a Card would otherwise take its border radius from the wrong element. The rendered result is unchanged.
- Upstream's `setStateWithValidation` applies the awaited `onValidate` result unconditionally, so a controlled `value` change made while validation is still pending is silently overwritten by the stale result. A monotonic generation counter is added so a stale result is discarded, satisfying the fourth Edge Case above. The guard can only suppress a write against a value the consumer has already replaced; it can never allow a step change that upstream would have blocked.
- `StepperSeparator`'s `forceMount` prop exists in the upstream component source but is missing from upstream's generated props type file (`docs/types/radix/stepper.ts` declares `StepperSeparatorProps` with no members). The source is treated as authoritative and the prop is ported, because it is rendered behaviour and FR-017 depends on it.
- `StepperTrigger`'s `aria-describedby` is reproduced verbatim as `"<titleId> <descriptionId>"`, both ids always present, even when no `StepperTitle` or `StepperDescription` is rendered (as in the default upstream demo). This is upstream parity rather than a divergence: the ids are stable and resolve as soon as those parts mount, dangling IDREFs are ignored by browsers and by the accessibility tree, and the trigger's accessible name comes from its own contents and is unaffected.
- The `stepper-form-demo.tsx` upstream example additionally depends on `react-hook-form` and `zod` for form-field validation; the ported demo page reproduces its step-by-step structure and validation gating using the project's existing `Field`/`Input`/`Textarea` primitives and a lightweight local validation function, rather than introducing a new form-library dependency that no other ported component in this project uses.
- Upstream's MDX DataAttributesTable lists `[data-orientation]` on `StepperTrigger`, but the upstream source (`stepper.tsx:962-964`) renders only `data-disabled`, `data-state` and `data-slot` on that element. The source is treated as authoritative for rendered output, so the ported `Stepper.Trigger` carries `data-state` and `data-disabled` only, matching every other divergence in this list by being recorded here rather than left implicit.
