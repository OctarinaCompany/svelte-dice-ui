# Feature Specification: Direction Provider

**Feature Branch**: `002-port-direction-provider`

**Created**: 2026-07-29

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Direction Provider\" (slug: direction-provider) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Declare a document-wide text direction (Priority: P1)

A developer building an application with this component library wraps their app (or a subtree of it)
in a direction provider and declares whether that subtree is left-to-right or right-to-left. Every
interactive component nested inside — menus, selects, sliders, carousels, anything with directional
keyboard navigation or directional layout — picks up that direction automatically, without the
developer having to pass a `dir` prop to each one individually.

**Why this priority**: This is the entire purpose of the component. Without it there is no way for
the rest of the ported component set to share a single source of truth for direction, and every
future RTL-aware component would need its own ad-hoc mechanism.

**Independent Test**: Render the provider with `dir="rtl"` around a consumer that reports the
direction it reads back; confirm the consumer reports `"rtl"`. Fully testable in isolation, with no
dependency on any other ported component.

**Acceptance Scenarios**:

1. **Given** a provider rendered with `dir="ltr"`, **When** a descendant reads the current direction,
   **Then** it receives `"ltr"`.
2. **Given** a provider rendered with `dir="rtl"`, **When** a descendant reads the current direction,
   **Then** it receives `"rtl"`.
3. **Given** two nested providers with different `dir` values, **When** a descendant of the inner
   provider reads the current direction, **Then** it receives the inner provider's value (the nearest
   provider wins).

---

### User Story 2 - Read the ambient direction without a provider present (Priority: P2)

A developer builds a component that needs to know the current text direction, but the app that
consumes it may or may not have wrapped itself in a direction provider (for example, a component used
inside this library's own demo pages, or dropped into a consumer's app that never opted into the
provider). The direction reader must never throw and must never silently assume left-to-right when the
surrounding page is visibly right-to-left.

**Why this priority**: Every other ported component that needs directionality (menus, sliders, tabs,
carousels, etc.) depends on this reader being safe to call unconditionally. It is the second half of
the feature's contract and is exercised far more often than the provider itself, but it cannot be
demonstrated without User Story 1 existing first, hence P2 rather than P1.

**Independent Test**: Call the reader from a component that is rendered with no provider as an
ancestor, once with no `dir` attribute anywhere in the DOM ancestry (expect `"ltr"`) and once with a
`dir="rtl"` attribute set on an ancestor element or the document root (expect `"rtl"`). Both cases are
testable without any other ported component present.

**Acceptance Scenarios**:

1. **Given** no provider anywhere in the component tree and no `dir` attribute set on any ancestor
   element or the document, **When** a component reads the current direction, **Then** it receives
   `"ltr"`.
2. **Given** no provider anywhere in the component tree but an ancestor element (or the document root)
   has `dir="rtl"`, **When** a component reads the current direction, **Then** it receives `"rtl"`.
3. **Given** no provider but a component explicitly passes its own direction override to the reader,
   **When** it reads the current direction, **Then** the explicit override wins over both the DOM
   attribute and the default.

---

### User Story 3 - Override the inherited direction for a single consumer (Priority: P3)

A developer has a provider set for the whole app in one direction, but one specific component instance
needs to force the opposite direction (for example, an embedded code sample or a foreign-language
snippet that must stay left-to-right inside an otherwise right-to-left page).

**Why this priority**: This is a documented escape hatch on the upstream reader, not the primary
workflow. It matters for completeness and for components ported later that expose their own `dir`
prop, but the library ships useful value without it being exercised on day one.

**Independent Test**: Render a provider with `dir="rtl"` and a consumer that calls the reader with an
explicit `"ltr"` override; confirm the consumer reports `"ltr"` even though the provider says `"rtl"`.

**Acceptance Scenarios**:

1. **Given** a provider set to `dir="rtl"`, **When** a descendant reader is called with an explicit
   `"ltr"` argument, **Then** the descendant receives `"ltr"`.

### Edge Cases

- What happens when the provider is rendered with no `dir` prop at all? It MUST default to `"ltr"`,
  matching upstream's default and this library's default writing direction.
- What happens when a component using the reader is unmounted and remounted, or moved between a
  right-to-left and left-to-right subtree at runtime (the provider's `dir` value changes while
  mounted)? The reader MUST reflect the new value reactively without requiring a page reload.
- What happens when the reader is called outside of any Svelte component context (e.g. from a plain
  module-level function)? This is not a supported call site upstream either; it is out of scope.
- What happens when an ancestor `dir` DOM attribute is present but invalid (neither `"ltr"` nor
  `"rtl"`, e.g. `dir="auto"`)? The fallback lookup only recognizes `"ltr"` and `"rtl"`; any other value
  is treated the same as no attribute being present, and the default of `"ltr"` applies.
- What happens when the provider component itself is given an invalid `dir` value at the type level?
  This is prevented at compile time by restricting the prop to the two supported literals.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The library MUST expose a provider component that accepts a `dir` value of either
  `"ltr"` or `"rtl"` and makes that value available to every component nested inside it.
- **FR-002**: The provider MUST default to `"ltr"` when no `dir` value is supplied.
- **FR-003**: When providers are nested, a descendant MUST resolve to the value of its nearest
  ancestor provider, not an outer one.
- **FR-004**: The library MUST expose a direction reader usable by any component to obtain the current
  direction value.
- **FR-005**: The reader MUST be safe to call from a component that has no provider anywhere in its
  ancestry — it MUST NOT throw and MUST NOT require the caller to check for a provider first.
- **FR-006**: When no provider is present, the reader MUST fall back to inspecting the nearest
  ancestor DOM element (including the document root) that carries a recognized `dir` attribute
  (`"ltr"` or `"rtl"`) and MUST return that value.
- **FR-007**: When no provider is present and no ancestor element carries a recognized `dir`
  attribute, the reader MUST return `"ltr"`.
- **FR-008**: The reader MUST accept an optional explicit direction argument that, when supplied,
  takes precedence over both a provider value and the DOM fallback.
- **FR-009**: The value returned by the reader MUST update reactively when the direction it resolves
  from (provider value, explicit argument, or the DOM fallback) changes while the consuming component
  remains mounted.
- **FR-010**: The provider MUST forward standard element/container attributes and any additional
  props given to it to its rendered output, and MUST render its given content without altering it
  structurally or visually.
- **FR-011**: The provider component and the reader MUST each be individually importable from the
  library so a consumer can use the reader without necessarily using the provider (per Edge Cases and
  User Story 2).
- **FR-012**: The ported component MUST be distributed as an installable entry in this library's own
  component registry, following the same installation path as every other first-party component in
  this library.
- **FR-013**: The library's documentation MUST include a demo page for this component that
  demonstrates every usage example shown on the upstream documentation page: providing a fixed
  direction, and reading the current direction from within a consumer.

### Key Entities

- **Direction**: An enumerated value representing text/layout flow, either `"ltr"` (left-to-right) or
  `"rtl"` (right-to-left). It is not persisted; it exists only for the lifetime of the component tree
  that declares or reads it.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer can make an entire nested component subtree right-to-left aware by adding a
  single wrapper with no changes to any of the components inside it.
- **SC-002**: Any component in the library that needs to know the current direction gets a correct
  answer 100% of the time, whether or not a provider is present above it.
- **SC-003**: Switching the declared direction at runtime (e.g. a language-switcher toggling RTL) is
  reflected by every consumer immediately, with no manual refresh and no consumer left showing the
  stale direction.
- **SC-004**: The demo page lets a visitor exercise both the "explicit direction" and the "ambient /
  fallback direction" behaviours documented upstream, without reading any source code.

## Assumptions _(mandatory)_

- Upstream ships two parallel implementations (a Radix-UI-backed variant and a Base-UI-backed
  variant) that are functionally identical: a context provider carrying a `"ltr" | "rtl"` value and a
  hook returning `dirProp ?? contextValue ?? "ltr"`. This project has no Radix/Base UI dependency, so
  the port reproduces the documented behaviour (FR-001–FR-009) directly using Svelte context, without
  depending on either upstream headless library — consistent with `bits-ui` (this project's headless
  primitive library) not shipping an equivalent primitive to compose.
- Upstream's `useDirection` hook falls back to a hardcoded `"ltr"` when no provider is present; it does
  not inspect the DOM. This specification intentionally strengthens that fallback to also check the
  nearest ancestor `dir` DOM attribute (and finally `"ltr"`) per the explicit component-specific
  guidance for this port. This is a deliberate, documented divergence from upstream's literal behaviour
  that preserves upstream's precedence contract (explicit argument, then provider, then a default)
  while making the reader also work correctly for consumers of this library who set a plain HTML `dir`
  attribute instead of using the provider — a pattern already used in this project's own demo pages.
- Upstream's Radix variant additionally accepts a legacy `direction` prop as an alias for `dir`, kept
  only for backward compatibility with an older API. This port does not carry that alias forward: a
  single canonical prop name (`dir`) is already the pattern for every other ported component's props in
  this project, and CLAUDE.md's translation table gives no precedent for preserving deprecated
  dual-prop aliases. `dir` is the sole prop for setting direction.
- "Nested providers resolve to the nearest one" and "an explicit override wins over the ambient/DOM
  fallback" (User Stories 1 and 3) are not called out explicitly in the upstream docs page, but they
  are the direct, testable consequences of upstream's own precedence chain
  (`dirProp ?? contextDir ?? "ltr"`, backed by ordinary context nesting) and are reproduced as such,
  not introduced as new capabilities.
- This is a headless, non-visual utility (per the component-specific guidance): there is no visual
  regression risk and no design-token usage. The provider's only rendered output is its given content
  wrapped in a plain container that carries the resolved `dir` attribute, so native browser bidi
  behaviour applies to anything it wraps and the DOM-attribute fallback (FR-006) has something to find
  when a provider is nested inside another provider's output.
- The demo page exercises the provider with a toggle between `"ltr"` and `"rtl"` and a nested consumer
  that displays the resolved direction, mirroring the single usage example shown on the upstream docs
  page — there is no second demo file upstream to mirror.
- Upstream's reader takes a plain positional argument (`useDirection(dirProp?: Direction)`), which stays
  live in React because a hook re-runs on every render. This port takes an options object whose fields
  are getter functions (`useDirection({ dir: () => …, element: () => … })`) and returns an object whose
  `current` field is reactive, because a Svelte function called once during component initialisation
  would otherwise capture a snapshot and freeze — failing the "updates while mounted" requirement above.
  This is the mechanical translation CLAUDE.md §4 and §10 prescribe for a custom hook, not a change of
  contract: the precedence order and the `"ltr"` floor are unchanged. The second field, `element`, exists
  only to anchor the DOM-attribute fallback that this specification added, and defaults to the document
  root.
- Upstream types the provider's `dir` prop as **required** while documenting `@default "ltr"` on it.
  This port makes it optional so the documented default is actually reachable, which is what the
  "defaults to `ltr` when no `dir` is supplied" requirement above needs. The prop is a plain input, not
  a two-way binding, and there is no change callback: the component never mutates the direction itself,
  so a binding or an `onDirChange` would be surface with nothing to drive it. Only the element reference
  is bindable, matching every other ported component.
