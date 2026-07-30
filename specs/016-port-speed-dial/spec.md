# Feature Specification: Speed Dial Component Port

**Feature Branch**: `016-port-speed-dial`

**Created**: 2026-07-30

**Status**: Draft

**Input**: User description: "Port the Dice UI React component 'Speed Dial' (slug: speed-dial) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Reveal a set of quick actions from a floating trigger (Priority: P1)

A user viewing a page sees a single round floating action button. Clicking it reveals a fan of
related action buttons (e.g. Share, Copy, Like) positioned next to the trigger; clicking it again,
clicking an action, pressing Escape, or clicking outside collapses the fan back to just the trigger.

**Why this priority**: This is the entire reason the component exists — without open/close and
action selection there is no speed dial, just a button.

**Independent Test**: Render a speed dial with a trigger and three actions. Verify the actions are
absent from the accessibility tree while closed, click the trigger, verify all three actions become
available and one of them can be activated to run its handler and close the dial.

**Acceptance Scenarios**:

1. **Given** a closed speed dial, **When** the user clicks the trigger, **Then** the action list
   becomes visible, the trigger reports itself expanded, and focus stays on the trigger.
2. **Given** an open speed dial, **When** the user clicks the trigger again, **Then** the action
   list closes and its items stop being focusable once the closing transition ends.
3. **Given** an open speed dial, **When** the user activates one of the action buttons, **Then**
   that action's handler runs and the speed dial closes automatically.
4. **Given** an open speed dial, **When** the user presses `Escape`, **Then** the speed dial closes
   and focus returns to the trigger.
5. **Given** an open speed dial, **When** the user clicks or taps outside the trigger and the action
   list, **Then** the speed dial closes.

---

### User Story 2 - Keyboard-only operation of the action fan (Priority: P1)

A keyboard user tabs to the trigger, opens the speed dial without touching a pointer, tabs through
every revealed action in visual order, and can leave the action list — forward or backward — without
getting trapped, with the dial closing automatically once focus exits its actions.

**Why this priority**: Accessibility parity is a non-negotiable project principle; a speed dial that
only a mouse can drive is not shippable.

**Independent Test**: Render the same three-action speed dial, drive it purely with `Tab`,
`Shift+Tab`, `Enter`/`Space`, and `Escape` via `userEvent`, and assert focus and open state at each
step.

**Acceptance Scenarios**:

1. **Given** focus on the trigger, **When** the user presses `Enter` or `Space`, **Then** the speed
   dial opens the same way a click would.
2. **Given** an open speed dial with focus on the last action, **When** the user presses `Tab`,
   **Then** the speed dial closes and focus moves to the next focusable element after the trigger.
3. **Given** an open speed dial with focus on the first action, **When** the user presses
   `Shift+Tab`, **Then** focus moves to the trigger and the speed dial stays open; **When** the user
   presses `Shift+Tab` again from the trigger, **Then** the speed dial closes and focus moves to the
   element before the trigger (the trigger is the first registered node of the composite — see
   Assumptions, R-06).
4. **Given** an open speed dial, **When** the user presses `Escape` while focus is on an action,
   **Then** the speed dial closes and focus returns to the trigger.

---

### User Story 3 - Configure activation mode, expansion side, and labels (Priority: P2)

A developer composing the speed dial into a page chooses whether it opens on click or on hover, which
side of the trigger the actions fan out toward (top, right, bottom, left) so it fits the page layout,
and whether each action shows a visible text label or only an accessible name, and whether the open
state is controlled externally or left to the component.

**Why this priority**: These are documented, developer-facing configuration points that every
consumer of the upstream component relies on, but the dial is already usable end to end without them
(P1 covers the default click/top/uncontrolled path).

**Independent Test**: Render four speed dials, one per `side` value, and assert each renders its
action list with the matching orientation and side. Render one with `activationMode="hover"` and
assert hovering the trigger opens it after `delay` and moving away closes it. Render one with `open`
+ `onOpenChange` supplied and assert the component never changes state on its own. Render one with
visible `SpeedDialLabel` text and assert it is present and associated with its action.

**Acceptance Scenarios**:

1. **Given** `side="left"` (or `"right"`), **When** the speed dial opens, **Then** the action list
   reports a horizontal orientation and expands along that side.
2. **Given** `side="top"` (or `"bottom"`), **When** the speed dial opens, **Then** the action list
   reports a vertical orientation and expands along that side.
3. **Given** `activationMode="hover"`, **When** the user's pointer enters the trigger and remains for
   the configured `delay`, **Then** the speed dial opens without a click; **When** the pointer leaves
   the trigger and the action list, **Then** the speed dial closes shortly after.
4. **Given** an externally controlled speed dial (`open` + `onOpenChange` supplied), **When** the
   user clicks the trigger, **Then** the component calls back with the requested next state but does
   not change its own rendered state until the caller updates the `open` prop.
5. **Given** a `SpeedDialLabel` rendered without `sr-only` styling, **When** the speed dial is open,
   **Then** the label text is visible next to its action and programmatically associated with it.
6. **Given** `disabled` is set on the root, **When** the user clicks or hovers the trigger, **Then**
   the speed dial does not open and the trigger is exposed as disabled.

---

### Edge Cases

- A speed dial with zero `SpeedDialItem` children opens to an empty, still-`role="menu"` container
  without erroring.
- Rapid repeated clicks on the trigger (open, close, open) each register as a distinct state change
  and never leave the dial in a stuck or duplicated-listener state.
- An action's `onSelect` handler calls `event.preventDefault()`: the speed dial stays open and the
  action's own `onClick` still ran.
- A single disabled `SpeedDialItem`/`SpeedDialAction` is skipped by Tab-driven focus-exit detection —
  it never becomes the element whose loss of focus closes the dial — but does not block Tab from
  reaching the remaining enabled actions.
- Rendering a large number of actions (dozens) opens and closes in time proportional to the item
  count, not its square, matching the upstream regression test's intent.
- Right-to-left context (`dir="rtl"`): `side="left"`/`"right"` continue to expand toward the visual
  side named by the prop; RTL does not invert `side`, matching upstream (which does not offer RTL
  mirroring for this component) — see Assumptions.
- Touch input dismissal: a tap outside the open speed dial on a touch device closes it on the
  following tap-equivalent interaction rather than immediately hijacking the first outside touch,
  matching upstream's touch-vs-pointer dismissal split.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST render as a compound set of parts — a root, a trigger, a content
  container, an item wrapper, an action button, and a label — installable and importable together
  from one module, matching the upstream `SpeedDial` / `SpeedDialTrigger` / `SpeedDialContent` /
  `SpeedDialItem` / `SpeedDialAction` / `SpeedDialLabel` part names.
- **FR-001a**: Every part MUST accept a `child` snippet that lets the caller render its own element in
  place of the part's default element, receiving the props the part would have applied — the Svelte
  replacement for upstream's `asChild` on all six parts (see Assumptions).
- **FR-002**: The root MUST support both uncontrolled (`defaultValue`-style initial open state) and
  controlled (`open` + `onOpenChange`) operation, matching upstream's `open` / `defaultOpen` /
  `onOpenChange` props, and MUST additionally expose `open` as a two-way bindable value for Svelte
  consumers.
- **FR-003**: The trigger MUST toggle the open state on activation (pointer click or keyboard
  activation) by default (`activationMode="click"`).
- **FR-004**: The root MUST support `activationMode="hover"`, opening after a configurable `delay`
  (default 250ms) once the pointer enters the trigger, and closing a short fixed interval (100ms)
  after the pointer leaves both the trigger and the open content, matching upstream's `delay` prop
  and internal hover-close timing. A click on the trigger MUST cancel any pending hover-open or
  hover-close timer, but MUST NOT otherwise disable hover activation for the remainder of the
  component's life.
- **FR-005**: The root MUST support a `side` prop (`"top" | "right" | "bottom" | "left"`, default
  `"top"`) controlling which direction the action list expands from the trigger, and the content MUST
  expose the resulting orientation (`"vertical"` for top/bottom, `"horizontal"` for left/right).
- **FR-006**: The root and trigger MUST support a `disabled` prop that prevents opening by any
  activation method and is reflected on the trigger's disabled state.
- **FR-007**: The content MUST NOT be present in the accessible tree while closed (default, no
  `forceMount`) and MUST support a `forceMount`-equivalent option that keeps it present but visually
  and interactively inert while closed.
- **FR-008**: The content MUST close on `Escape`, MUST close and hand focus onward when `Tab` moves
  focus past the last enabled action, and MUST close and hand focus backward when `Shift+Tab` moves
  focus before the first enabled node of the composite (the trigger, which precedes the actions in
  document order).
- **FR-009**: The content MUST close when a pointer interaction occurs outside both the trigger and
  the content, with an `onInteractOutside`-equivalent callback that can cancel the auto-close by
  preventing the event's default action.
- **FR-010**: Each action MUST close the speed dial after running its own click handling and firing
  an `onSelect`-equivalent callback, unless that callback prevents its event's default action, in
  which case the speed dial stays open.
- **FR-010a**: Where a part installs its own DOM event handler (the trigger's click and mouse
  enter/leave, the root's pointer-down-capture, the content's mouse enter/leave), a caller-supplied
  handler for the same event MUST run first, and MUST be able to suppress the part's internal
  behaviour by preventing the event's default action, matching upstream.
- **FR-011**: Each action MUST support an individual `disabled` state that suppresses its `onSelect`
  callback and excludes it from Tab-driven focus-exit detection.
- **FR-012**: Each item's contained label MUST be programmatically associated with its sibling action
  (accessible name association), independent of whether the label is visually hidden or visible.
- **FR-013**: The trigger MUST expose `aria-haspopup="menu"`, `aria-expanded` reflecting open state,
  and `aria-controls` referencing the content; the content MUST expose `role="menu"` and
  `aria-orientation` matching FR-005; each action MUST expose `role="menuitem"`; each item MUST
  expose `role="none"`; and the trigger MUST carry an explicit `role="button"`, matching upstream.
- **FR-014**: The root, trigger, content, and item parts MUST each expose their open/closed state as
  a `data-state` attribute (`"open"` | `"closed"`); the root MUST expose `data-disabled` when, and
  only when, it is disabled; the content and item MUST expose `data-side`; the content MUST expose
  `data-orientation`. No part exposes a data attribute that upstream does not document.
- **FR-015**: Opening MUST stagger each item's entrance animation and closing MUST stagger each
  item's exit animation in reverse, matching upstream's per-item delay behaviour, without regressing
  to quadratic render cost as the item count grows.
- **FR-016**: The gap between action items and the offset between the content and the trigger MUST
  each be configurable (`gap`, `offset` props), matching upstream defaults of 8px each.
- **FR-016a**: The content MUST publish `--speed-dial-gap`, `--speed-dial-offset` and
  `--speed-dial-transform-origin`, and each item MUST publish `--speed-dial-animation-duration`
  (200ms) and `--speed-dial-delay` (its stagger), as CSS custom properties on the rendered element,
  with a caller-supplied `style` taking precedence over all five — matching the upstream CSS-variable
  tables for `SpeedDialContent` and `SpeedDialItem`.
- **FR-017**: The component MUST be usable in a right-to-left document (`dir="rtl"`) without breaking
  positioning or keyboard navigation; `side` values are absolute (not mirrored) in RTL, matching
  upstream.
- **FR-018**: The component MUST ship as source under the project's UI component directory with an
  index barrel exporting namespaced and prefixed names plus their prop types, and MUST be registered
  in the project's component registry so it is installable the same way as any other listed
  component.
- **FR-019**: A documentation demo page MUST exist exercising: the default example, the visible-label
  example, the hover-activation example, the controlled-state example, and the four-sides example,
  mirroring the upstream demo files one-for-one.
- **FR-020**: Using the trigger, content, item, action, or label part outside of a root MUST raise a
  clear error naming both the part and the required root, matching upstream's context-guard
  behaviour.
- **FR-021**: The content MUST expose an `onEscapeKeyDown`-equivalent callback that receives the
  `Escape` keyboard event before the dial closes and can cancel that close by preventing the event's
  default action, matching upstream's documented `onEscapeKeyDown` prop on `SpeedDialContent`.

### Key Entities

- **Speed Dial Root**: The compound component's state owner. Holds open/closed state (controlled or
  uncontrolled), `side`, `activationMode`, `delay`, and `disabled`; coordinates which descendant
  actions currently exist so Tab-driven focus-exit detection can find the first/last one.
- **Speed Dial Item**: A pairing of exactly one action and one label; carries the per-item stagger
  delay and open/closed state used for its enter/exit animation.
- **Speed Dial Action**: The interactive control inside an item; carries its own `disabled` flag and
  an `onSelect`-equivalent cancelable callback fired on activation.
- **Speed Dial Label**: The (optionally visible) text describing an action; associated with its
  sibling action for assistive technology.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A keyboard-only user can open the speed dial, reach every action, activate one, and
  have focus land somewhere sensible afterward, without ever touching a pointing device.
- **SC-002**: Every interaction, state, prop, and data attribute documented on the upstream Speed
  Dial page has a corresponding, passing automated test in this project.
- **SC-003**: The demo page renders all five upstream examples (default, labels, hover, controlled,
  sides) and each is independently interactive without console errors.
- **SC-004**: Opening a speed dial with 50 actions completes rendering in under one second, matching
  the upstream project's own performance regression guard for this component.
- **SC-005**: A consumer of this repository's component registry can install the Speed Dial with one
  command and use it by composing the six exported parts, with no additional configuration beyond
  what the demo page shows.
- **SC-006**: The component reads and behaves correctly in a right-to-left document: no layout
  overlap, no reversed keyboard order regression, and `side` continues to point at the same visual
  edge as in left-to-right.

## Assumptions _(mandatory)_

- **Base variant only, not the Radix-hooks variant**: Upstream ships two implementations of Speed
  Dial — a "base" registry component and a "radix" registry component (this project was pointed at
  `docs/registry/bases/radix/ui/speed-dial.tsx`, which itself is a plain-React implementation using
  small internal hooks, not an actual Radix UI primitive). The internal hooks it depends on
  (`useComposedRefs`, `useIsomorphicLayoutEffect`, `useLazyRef`, `useAsRef`) are React ref/timing
  utilities with no meaning in Svelte's reactivity model; their behaviour (external store
  synchronisation, layout-timed effects, stable callback refs) is reproduced using Svelte 5 runes
  (`$state`, `$effect.pre`, class fields) in a `speed-dial.svelte.ts` state class per repository
  convention (CLAUDE.md §4), not ported file-for-file.
- **`asChild` dropped in favour of a `child` snippet**: Upstream's `asChild`/`SlotPrimitive.Slot`
  polymorphism has no direct Svelte 5 equivalent; per the repository's established translation table
  (CLAUDE.md §10), any part that needs to render as a caller-supplied element exposes a `child`
  snippet instead. Every other prop keeps its upstream name.
- **`onOpenChange` keeps its name and gains a bindable `open`**: Per CLAUDE.md §10's rule for
  `onValueChange`-style callbacks, `open` becomes `$bindable`, and `onOpenChange` is still called on
  every change so existing upstream-style consumers translate directly.
- **The internal `Store`/`useSyncExternalStore` layer is an implementation detail, not part of the
  contract**: Upstream builds its own pub/sub store to avoid unnecessary React re-renders. Svelte's
  runes already provide fine-grained reactivity, so this is replaced by a single reactive state class
  (`SpeedDialState`) shared via typed-Symbol context (CLAUDE.md §5); no store, subscribe/notify API,
  or `useSyncExternalStore` equivalent is exposed to consumers, because upstream never documented
  that layer as public API either.
- **Trigger and action buttons compose the project's existing `Button` component** rather than
  reimplementing button styling/behaviour, per the Composition First principle; upstream itself
  composes its own `Button` for the same parts.
- **Outside-pointer dismissal is implemented directly on `document`/`window`**, not delegated to a
  bits-ui dismissible-layer primitive, because it needs the same touch-vs-pointer-vs-click branching
  upstream documents (a plain click on non-touch devices, a deferred one-shot `click` listener on
  touch devices) and no existing project primitive exposes that exact behaviour; this is the
  documented exception to "prefer bits-ui" for logic bits-ui does not cover.
- **Animation timing constants are ported as-is**: default item stagger 50ms, default enter/exit
  duration 200ms, default hover-close delay 100ms, default hover-open `delay` 250ms, default `gap`
  and `offset` of 8px each — these are upstream's documented/observed defaults and are not treated as
  configurable-by-default deviations.
- **RTL**: upstream does not mirror the `side` prop under `dir="rtl"` (it has no direction-awareness
  code at all), so this port does not add mirroring either — RTL support here means the component
  renders and functions correctly (no broken layout, no broken focus order) inside an RTL document,
  not that `side="left"` becomes `side="right"` automatically. This matches Assumption/Principle II:
  no undocumented behavioural addition beyond upstream.
- **Fixed positioning guidance is documentation-only**: the upstream Callout about applying `fixed`
  classes to the root rather than the trigger is a usage note, not a prop; it is reproduced as prose
  on the demo page rather than as enforced component behaviour, since the component does not restrict
  what classes a consumer passes.

### Added during planning (Phase 0/1 — see `research.md` and `contracts/public-api.md` §10)

- **Per-item stagger comes from a self-registering collection, not from children introspection**
  (research R-01): upstream's `SpeedDialContent` counts and wraps its children with
  `React.Children.map` to hand each one an index-derived delay. A Svelte `Snippet` cannot be
  introspected, so each `SpeedDialItem` instead registers its own element into a document-ordered
  collection owned by the root, and derives its index from one shared lookup map. The rendered
  result — `--speed-dial-delay` of `index * 50ms` while opening and `(count - index - 1) * 50ms`
  while closing — is identical, and the shared map keeps the cost O(n log n), which is what
  upstream's own O(n²) regression test guards.
- **The Tab-exit boundary includes the trigger** (research R-06): upstream closes when `Tab` is
  pressed on the last enabled *registered node* and when `Shift+Tab` is pressed on the first, and the
  trigger is registered alongside the actions — so in DOM order the trigger *is* the first node. US2
  acceptance scenario 3 is therefore satisfied one keypress later than its wording implies:
  `Shift+Tab` on the first action moves focus to the trigger, and the next `Shift+Tab` closes the
  dial and hands focus backward. FR-008's "before the first enabled action" is read as "before the
  first enabled node of the composite". Upstream's semantics are reproduced exactly and pinned by a
  test.
- **`Escape` restores focus to the trigger** (research R-07): the upstream *source* only closes the
  dial, but the upstream MDX keyboard table states "Closes the speed dial and returns focus to the
  trigger", and leaving focus on `document.body` when the focused action unmounts violates the
  project's accessibility principle. The MDX is the contract, so focus is restored. This is a
  deliberate divergence from the source in favour of the documentation.
- **Controlled mode follows the project's `$bindable` idiom** (research R-08): `open` is `$bindable`
  so `bind:open` works, which requires the component to assign to the prop; a strictly
  never-written prop would make the binding inert and break FR-002. This matches upstream, whose
  internal store also moves on click and only re-syncs when the `open` prop itself changes — pass a
  constant `open={false}` and upstream opens too. US3 acceptance scenario 4 is satisfied in the sense
  upstream implements it: `onOpenChange` fires with the requested next state, and any subsequent
  value the caller supplies for `open` is authoritative.
- **The content is positioned even while closed** (research R-04): upstream computes its four CSS
  offset declarations only while open, so a `forceMount`ed closed content renders unpositioned and
  displaces the trigger. Here the position is a pure derivation of `side` and `offset` and is always
  applied. Observable only under `forceMount`; upstream's gating is an artifact of its React state
  dance, not documented behaviour.
- **`data-disabled` is emitted only when disabled**: upstream writes `data-disabled={false}`, so the
  attribute is present permanently and `data-[disabled]:` selectors always match. The project's
  boolean-data-attribute rule (`cond ? '' : undefined`) is applied instead.
- **No `bits-ui` primitive is composed** (research R-04, R-05): the floating-layer primitives portal
  the content, own and collision-flip `data-side`, and replace `role="menu"`; and bits-ui exposes no
  standalone dismissable layer to reuse. Content placement (four static CSS declarations, no
  measurement) and the outside/keyboard dismissal layer — including upstream's capture-phase
  inside-tree guard and its touch-vs-pointer split — are therefore the component's own, and are the
  documented exception to "prefer bits-ui".
- **A reusable `DomOrderedCollection` is exported** (research R-16): upstream's `getNodes()` is a
  local copy of `@diceui/shared`'s `useCollection`, which several not-yet-ported components also
  need. It ships as `speed-dial-collection.svelte.ts` inside this component's folder and is exported
  from the barrel; later ports depend on `speed-dial` rather than duplicating it, following the
  precedent set by `relative-time-format.ts`.
- **`z-50` on the content is retained**: the project's "no manual z-index" rule targets overlays whose
  primitive owns stacking (Dialog, Popover, Tooltip, Sheet). This content is a locally positioned
  sibling with no primitive behind it, and upstream sets `z-50`; the same carve-out is already
  documented in `marquee-edge.svelte` and `scroller-button.svelte`.
