# Feature Specification: Responsive Dialog

**Feature Branch**: `027-port-responsive-dialog`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Responsive Dialog\" (slug: responsive-dialog) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A single dialog that adapts to screen size (Priority: P1)

A developer drops one `ResponsiveDialog` composition into a page. On a desktop-sized viewport it
renders as a centered modal dialog; on a mobile-sized viewport the same composition renders as a
bottom drawer, without the developer writing any conditional logic themselves.

**Why this priority**: This is the entire reason the component exists — it is the MVP. Without
automatic viewport switching, a consumer would just use `Dialog` or `Drawer` directly.

**Independent Test**: Render `ResponsiveDialog` with a trigger and content at a viewport width at or
above the breakpoint, open it, and confirm it exposes the dialog's ARIA role and centered layout.
Resize (or render) below the breakpoint and confirm the same composition instead exposes the
drawer's ARIA role and bottom-anchored layout — no other code change required.

**Acceptance Scenarios**:

1. **Given** the viewport is at or above the 768px breakpoint, **When** the user activates the
   trigger, **Then** a modal dialog opens with role `dialog`, is centered, and traps focus.
2. **Given** the viewport is below the 768px breakpoint, **When** the user activates the trigger,
   **Then** a bottom drawer opens with role `dialog`, is anchored to the bottom of the screen, and
   traps focus.
3. **Given** the dialog/drawer is open, **When** the user presses `Escape`, **Then** it closes and
   focus returns to the trigger.

---

### User Story 2 - Composable parts mirror the underlying dialog and drawer (Priority: P2)

A developer builds a non-trivial dialog (header, title, description, footer, explicit close button)
using the same part names and composition shape as Dice UI's `ResponsiveDialog`, and every part
renders as the correct underlying dialog or drawer part automatically.

**Why this priority**: Distribution parity depends on this — the whole value proposition is "compose
it exactly like upstream," so every documented part must exist and behave identically regardless of
which underlying primitive is active.

**Independent Test**: Compose `ResponsiveDialog.Root` with `Trigger`, `Content`, `Header`, `Title`,
`Description`, `Footer`, `Close`, `Overlay`, and `Portal`. Render at both above- and below-breakpoint
widths and confirm each part renders its dialog or drawer counterpart with matching text/structure.

**Acceptance Scenarios**:

1. **Given** a composition using `Header`, `Title`, `Description`, and `Footer`, **When** rendered
   above the breakpoint, **Then** the title is programmatically associated with the dialog via
   `aria-labelledby` and the description via `aria-describedby`.
2. **Given** the same composition, **When** rendered below the breakpoint, **Then** the same
   associations hold against the drawer's title and description elements.
3. **Given** a `Close` part inside `Footer`, **When** activated, **Then** the dialog/drawer closes
   in both viewport modes.
4. **Given** any part, **When** it renders, **Then** it exposes `data-variant="dialog"` or
   `data-variant="drawer"` matching the active mode, so callers can target
   `data-[variant=drawer]:` / `data-[variant=dialog]:` styles.

---

### User Story 3 - Controlled state and breakpoint switching preserve state (Priority: P3)

A developer controls the open state from outside the component (e.g. tied to a route or a mutation's
pending state) and the dialog stays open, with its content intact and focus correctly placed, even if
the viewport crosses the breakpoint while it is open (e.g. rotating a device or resizing a browser
window).

**Why this priority**: This is the trickiest correctness requirement (explicitly called out in the
component-specific guidance) but is not required for the MVP composition to be useful — most
consumers never resize across the breakpoint while a dialog is open.

**Independent Test**: Open the dialog under a controlled `open`/`onOpenChange` pair at a
below-breakpoint width, then change the simulated viewport to above-breakpoint width without closing
it, and confirm: the dialog is still open, its content is unchanged, it now exposes the dialog's ARIA
role instead of the drawer's, and focus is on a focusable element inside the now-active content (not
lost to the document body or left inside a removed drawer node).

**Acceptance Scenarios**:

1. **Given** an uncontrolled dialog opened below the breakpoint, **When** the breakpoint is crossed
   upward while it is open, **Then** it re-renders as the centered dialog with the same open state
   and content, and focus lands inside the new dialog content.
2. **Given** a controlled dialog (`open` bound by the caller), **When** the breakpoint is crossed in
   either direction while open, **Then** the caller's `open` value is respected — the component never
   force-closes on a breakpoint change.
3. **Given** the breakpoint is crossed while closed, **When** the trigger is later activated,
   **Then** the correct mode for the current viewport opens.

---

### Edge Cases

- What happens when the trigger is activated via keyboard (`Enter`/`Space`) instead of pointer? It
  must open the dialog/drawer identically to a pointer click, per the upstream keyboard table.
- How does the system handle `dir="rtl"`? Layout (e.g. close button position, footer button order)
  must follow the direction context already used by the existing `Dialog`/`Drawer` components; no
  new direction logic is introduced by this component.
- How does the system handle `defaultOpen` combined with a below-breakpoint initial render (e.g.
  during SSR, before the client can measure the viewport)? See Assumptions for the resolved default.
- What happens if `ResponsiveDialogTrigger`/`Content`/etc. is rendered without a `ResponsiveDialog`
  root ancestor? It must throw a descriptive error naming the missing part and the required root,
  matching the pattern used by every other ported compound component.
- What happens when the `breakpoint` prop is changed after mount? The mode re-evaluates against the
  new breakpoint on the next viewport measurement; this is a rare enough case that no special
  transition handling beyond the standard breakpoint-crossing behavior (User Story 3) is required.
- What happens to an `onOpenChange` callback when the mode switches but the open state does not
  change? It must not fire — only actual open/closed transitions invoke it.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide a root component that renders a modal dialog when the current
  viewport width is at or above a configurable breakpoint (default 768px), and a bottom drawer when
  the viewport is below that breakpoint.
- **FR-002**: The root component MUST accept `breakpoint` (pixels, default `768`), `open`
  (controlled), `defaultOpen` (uncontrolled, default `false`), and `onOpenChange` (fired whenever the
  effective open state changes), matching the upstream `ResponsiveDialog` contract. The root MAY
  additionally accept `onOpenChangeComplete`, a Svelte-only pass-through to the underlying `Dialog`
  root that fires after the open/close animation settles; it is inert in drawer mode because the
  drawer primitive has no such callback (divergence D-08).
- **FR-003**: The system MUST provide `Trigger`, `Close`, `Portal`, `Overlay`, `Content`, `Header`,
  `Footer`, `Title`, and `Description` parts, each of which renders the dialog part when in dialog
  mode and the drawer part when in drawer mode, mirroring the upstream part list exactly.
- **FR-004**: Every part that renders a DOM element (`Trigger`, `Close`, `Overlay`, `Content`,
  `Header`, `Footer`, `Title`, `Description`) MUST expose a `data-variant` attribute set to
  `"dialog"` or `"drawer"` reflecting the currently active mode, so consumers can apply mode-specific
  styling exactly as documented upstream (`data-[variant=drawer]:` / `data-[variant=dialog]:`).
  `Portal` renders no element of its own and therefore carries no attribute — see divergence D-07.
- **FR-005**: `Content` MUST apply the upstream's drawer-mode-only default spacing (equivalent to
  `px-4 pb-4`) while leaving dialog-mode spacing untouched, and MUST still merge a caller-supplied
  `class` in both modes.
- **FR-006**: `Footer` MUST accept the same `showCloseButton` option the underlying `Dialog.Footer`
  supports (`@default false`), and `Content` MUST accept the `showCloseButton` option the underlying
  `Dialog.Content` supports (`@default true`); both apply only in dialog mode — the drawer footer and
  drawer content have no equivalent option — matching upstream.
- **FR-007**: The mode-detection logic MUST be implemented as a reusable, standalone reactive
  primitive (ported from upstream's `useIsMobile` hook) that any component in this project can reuse
  to answer "is the viewport narrower than breakpoint X" — not inlined into the dialog component.
- **FR-008**: Changing the effective viewport mode while the dialog/drawer is open MUST NOT close it,
  MUST NOT reset any content state, and MUST move focus to a focusable element inside the
  newly-rendered content rather than leaving it on a removed node or the document body.
  Programmatically, the open state is preserved across the underlying primitive swap so no
  close/reopen animation or callback fires purely because the mode changed.
  Constitution Principle IV governs the mode swap itself, both underlying primitives are already
  ported components in this project.
- **FR-009**: All ARIA roles, states, properties, focus management, and keyboard interactions (Space
  and Enter on the trigger, Tab / Shift+Tab cycling, Escape closing and returning focus to the
  trigger) MUST match the WAI-ARIA dialog (modal) pattern in both dialog and drawer mode, inherited
  from the already-ported `Dialog` and `Drawer` components.
- **FR-010**: The component MUST work correctly under `dir="rtl"`, inheriting direction handling from
  the existing `Dialog`/`Drawer` components with no additional direction logic in this component.
- **FR-011**: Every part MUST throw a descriptive error identifying both the part and the required
  root component when rendered outside a `ResponsiveDialog` root, consistent with every other ported
  compound component in this project.
- **FR-012**: The component MUST ship as source under this project's UI component directory with an
  `index.ts` barrel (short names, prefixed aliases, exported prop types) and MUST be installable
  through this project's own component registry, exactly like a first-party component.
- **FR-013**: A documentation page MUST demonstrate every example shown on the upstream docs page: a
  general-purpose edit-profile-style dialog, a destructive-action confirmation dialog with an async
  pending state on its confirm button, and a variant-styling example showing
  `data-[variant=drawer]:` / `data-[variant=dialog]:` class targeting on a part.

### Key Entities

- **ResponsiveDialog state**: The shared reactive state each part reads — current open/closed value,
  and whether the active mode is `dialog` or `drawer` for the current viewport. Owned by the root and
  shared with every part through context, mirroring the upstream external-store pattern.
- **Mode-detection primitive**: A reusable "is viewport narrower than breakpoint X" reactive value,
  independent of the dialog itself, that the root consumes to decide which underlying primitive to
  render.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer can compose a working responsive dialog (trigger, content, header, title,
  description, footer) using only the documented parts, with zero conditional logic of their own to
  choose between a dialog and a drawer.
- **SC-002**: 100% of the upstream component's documented props, parts, data attributes, and keyboard
  interactions are reproduced and covered by an automated test.
- **SC-003**: 100% of the examples shown on the upstream documentation page (`responsive-dialog-demo.tsx`,
  `responsive-dialog-confirm-demo.tsx`, and the MDX "Variant Styling" example) are reproduced as
  `<ComponentPreview>` sections on `/docs/components/responsive-dialog`; the route compiles under
  `pnpm run build`, and the open / close / confirm-cancel path of each reproduced example is exercised
  by at least one assertion in `responsive-dialog.test.ts`. No dev server or live browser session is
  used — the unattended pipeline forbids them (Constitution, Development Workflow).
- **SC-004**: Crossing the responsive breakpoint while the dialog is open never closes it, never
  clears its content, and never leaves keyboard focus outside every focusable element in the document
  (i.e. focus is never silently lost), verified by an automated test that simulates the breakpoint
  transition while open.
- **SC-005**: The component is installable through the project's registry build and produces zero
  new errors across the project's four quality gates (type check, lint, unit tests, build).

## Assumptions _(mandatory)_

- Upstream's `useIsMobile` hook (`window.matchMedia` + `resize`/`change` listener, SSR-safe
  `undefined` → boolean coercion) is ported as a standalone `.svelte.ts` reactive primitive (an
  `IsMobile` state class plus a `useIsMobile()` factory) under this project's UI internals, not
  duplicated inside the responsive-dialog module, per Constitution Principle IV and the
  component-specific guidance in this feature's brief.
- Upstream's internal `Store`/`useSyncExternalStore` plumbing (`useAsRef`, `useLazyRef`,
  `useIsomorphicLayoutEffect`, the hand-rolled pub/sub store) is a React-only workaround for
  synchronizing external mutable state with concurrent rendering. It has no Svelte 5 equivalent need:
  Svelte's `$state`/`$derived`/context primitives already provide synchronous, fine-grained reactivity
  without tearing. The Svelte port therefore uses a single reactive state class in
  `responsive-dialog.svelte.ts` (per CLAUDE.md §5's context pattern) instead of re-implementing a
  store abstraction. This is a divergence from the upstream implementation detail, not from the
  upstream API surface.
- Upstream's `asChild` prop on `Trigger`/`Close` (used in both demos to wrap a `Button`) is replaced
  by this project's existing `child` snippet pattern already used by `Dialog.Trigger` /
  `Drawer.Trigger`/`Close`, per CLAUDE.md's React→Svelte translation table. `ResponsiveDialogTrigger`
  and `ResponsiveDialogClose` forward to the underlying `Dialog`/`Drawer` trigger/close parts, which
  already support this snippet.
- The default breakpoint (768px) and the "`< breakpoint` is mobile" comparison are taken verbatim from
  upstream's `useIsMobile`/`ResponsiveDialog` defaults.
- Before the mode can be measured on the client (first paint), the component assumes desktop
  (`isMobile = false`, i.e. dialog mode) rather than rendering nothing, matching this project's
  existing SSR-safe patterns for other viewport-dependent components and avoiding a layout flash of
  an empty root; upstream's own hook briefly returns `false` (`!!undefined`) for the same reason
  before its effect runs, so this preserves upstream behaviour rather than diverging from it.
- Only the `radix` base variant of `responsive-dialog` (the one that composes `Dialog`/`Drawer`, per
  the upstream `base: radix` MDX frontmatter) is ported; there is no separate `base` (non-Radix)
  variant of this component upstream, so no scope decision is needed there.
- `Overlay` and `Portal` are ported as pass-through parts forwarding to the active mode's
  `Dialog.Overlay`/`Drawer.Overlay` and `Dialog.Portal`/`Drawer.Portal`, exactly mirroring upstream —
  most compositions will not use them directly since `Content` already renders its own portal and
  overlay internally (matching this project's existing `Dialog`/`Drawer` components).

### Recorded divergences (Constitution Principle II)

| ID   | Upstream                                                                   | Here                                                                                                    | Reason                                                                                                                                                                              |
| ---- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | `useIsMobile` in `hooks/use-mobile.ts`                                     | `useIsMobile` / `IsMobile` in `src/lib/hooks/is-mobile.svelte.ts`, shipped as a `registry:hook` file      | Svelte hooks are rune modules; the `hooks` alias already exists in `components.json`. Keeps the port to exactly one `registry:ui` entry while staying reusable (FR-007).             |
| D-02 | `Store` + `useSyncExternalStore` + `useLazyRef` / `useAsRef` / `useIsomorphicLayoutEffect` | one `ResponsiveDialogState` class on a `Symbol` context key                                 | React-only concurrent-rendering plumbing; Svelte's `$state`/`$derived` are synchronous and cannot tear. Public API unchanged.                                                        |
| D-03 | `asChild` on `Trigger` / `Close`                                           | the `child` snippet already supported by `Dialog`/`Drawer`                                               | CLAUDE.md React→Svelte translation table; `vaul-svelte` re-exports the same `bits-ui` prop types, so one snippet works in both modes.                                                |
| D-04 | `window.innerWidth < breakpoint` read inside the MQL `change` handler      | `mediaQueryList.matches` for the same `(max-width: breakpoint - 1px)` query                              | Arithmetically identical for integer widths, removes a second source of truth, and makes the primitive drivable from a test by stubbing `matchMedia`.                               |
| D-05 | Radix `Dialog`'s `modal` prop reachable through the root's prop spread     | not exposed on the root                                                                                  | `bits-ui`'s `Dialog.Root` has no `modal` prop (dismissal is configured per-`Content` via `interactOutsideBehavior` / `escapeKeydownBehavior`), so there is no prop to forward.       |
| D-06 | `<Loader2 className="animate-spin" />` in the confirmation demo            | `<Spinner />` from `$lib/components/ui/spinner`                                                          | Repo composition rule: a pending button is `Button` + `Spinner` + `disabled`. Demo-only; the component API is unaffected.                                                            |
| D-07 | `data-variant` passed to `DialogPortal` / `DrawerPortal`                   | not set on `ResponsiveDialog.Portal`                                                                     | `bits-ui`'s `Dialog.Portal` and `vaul-svelte`'s `Drawer.Portal` render no DOM node and type their props as `PortalProps`, so the attribute has no element to land on (it is a no-op upstream too, since Radix's `Portal` does not forward `data-*` either). Setting it would be a type error, not a feature. |
| D-08 | no equivalent upstream                                                     | `onOpenChangeComplete` forwarded to `Dialog.Root` only                                                   | `bits-ui`'s `Dialog.Root` exposes `onOpenChangeComplete` and dropping it from the intersection prop type would break `bind:`-style parity with this repo's own `Dialog`. `vaul-svelte`'s `Drawer.Root` has no counterpart, so in drawer mode the callback is never invoked. Additive only — no upstream API is changed. |
| D-09 | MDX keyboard table: `Space` / `Enter` "Opens/**closes** the dialog when focus is on the trigger" | `Space` / `Enter` on the trigger **open only** — they never toggle it closed                | `bits-ui`'s `DialogTriggerState.onkeydown` calls `handleOpen()`, not a toggle, and `vaul-svelte` re-exports that same trigger; neither exposes a toggle option. The distinction is unobservable in practice because both primitives trap focus inside the modal content while it is open, so the trigger cannot be the focused element to receive the key. Hand-rolling a toggle would be bespoke behaviour with no Principle IV justification, so the inherited open-only behaviour stands and is pinned by a test. |
