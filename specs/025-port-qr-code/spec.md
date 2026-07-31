# Feature Specification: Port QR Code Component

**Feature Branch**: `025-port-qr-code`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"QR Code\" (slug: qr-code) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Display a scannable QR code for a value (Priority: P1)

A developer using the component library wants to render a QR code that encodes a piece of text (a URL,
a Wi-Fi credential string, plain text, etc.) so that an end user can scan it with a phone camera.

**Why this priority**: This is the entire reason the component exists. Without a working, scannable
code the component delivers no value at all.

**Independent Test**: Render the component with a `value` prop set to a URL and no other configuration.
Confirm a QR code image appears, and that decoding it (e.g. with any QR reader) returns the exact
encoded string.

**Acceptance Scenarios**:

1. **Given** a container is rendered with `value="https://example.com"`, **When** the page finishes
   rendering, **Then** a QR code representing that exact value is visible on screen.
2. **Given** the QR code has finished generating, **When** it is inspected by assistive technology,
   **Then** it exposes an accessible name that communicates it is a QR code for the encoded value.
3. **Given** the `value` prop changes to a new string, **When** the change is applied, **Then** the
   displayed QR code regenerates to encode the new value.

---

### User Story 2 - Choose how the QR code is rendered (canvas, SVG, or image) (Priority: P1)

A developer wants to control the underlying rendering technology of the QR code — a bitmap canvas for
best on-screen performance, an inline SVG for crisp print/scalable output, or a plain image element for
contexts where a canvas or SVG is inconvenient (e.g. copying into an email or an `<img>`-only context).

**Why this priority**: Upstream ships all three renderers as an explicit, documented choice; omitting
any one of them is a loss of parity and breaks any consumer relying on that specific renderer.

**Independent Test**: Render the same encoded value three times, once with each renderer part, and
confirm each produces a valid on-screen representation of the same code without requiring the other
renderer parts to be present.

**Acceptance Scenarios**:

1. **Given** the canvas renderer part is used inside the component, **When** generation completes,
   **Then** a `<canvas>` element shows the QR code and its pixel dimensions match the configured size.
2. **Given** the SVG renderer part is used instead, **When** generation completes, **Then** an SVG
   representation of the same QR code is shown, scaled to the configured size.
3. **Given** the image renderer part is used instead, **When** generation completes, **Then** an
   `<img>` element shows the same QR code with an accessible alternative text.
4. **Given** none of the renderer parts have finished generating yet, **When** the component first
   mounts, **Then** only a loading placeholder (if present) is visible and no broken/empty renderer is
   shown.

---

### User Story 3 - Customize appearance and error correction (Priority: P2)

A developer wants to adjust the QR code's size, foreground/background colors, and error-correction
level to fit their brand and to compensate for a logo overlay that will obscure part of the code.

**Why this priority**: Customization is documented and demonstrated upstream, and is required for the
overlay use case in User Story 4, but the component is still useful with defaults alone, so this ranks
below the base rendering stories.

**Independent Test**: Render the component with non-default `size`, `foregroundColor`,
`backgroundColor`, and `level` props and confirm the generated code reflects each of them (visually
distinct colors/size, and a successful scan even when a portion of the modules is later covered at the
`H` level).

**Acceptance Scenarios**:

1. **Given** `size={150}`, **When** the code renders, **Then** the rendered output is constrained to
   150 logical pixels on each side.
2. **Given** custom `foregroundColor` and `backgroundColor` values, **When** the code renders, **Then**
   the dark/light modules use those colors instead of the defaults.
3. **Given** `level="H"`, **When** the code renders, **Then** the code is generated with the highest
   error-correction level, tolerating the largest amount of obscured area.
4. **Given** an invalid or empty `value`, **When** generation is attempted, **Then** no code is
   rendered, an error callback fires with a descriptive error, and no unhandled exception reaches the
   consumer's application.

---

### User Story 4 - Overlay a logo and offer a download action (Priority: P3)

A developer wants to place a small logo or icon in the center of the QR code, and give end users a
button to download the generated code as an image file.

**Why this priority**: Both are documented upstream examples and genuinely useful, but they are
additive to a working, correctly rendered code and are the least critical to the component's core
purpose.

**Independent Test**: Render the component with an overlay element centered over the code, and a
download control; confirm the overlay does not block generation of the underlying code, and that
activating the download control produces a file containing the QR code in the requested format.

**Acceptance Scenarios**:

1. **Given** an overlay containing a small icon is placed inside the component, **When** the code
   renders, **Then** the overlay is centered over the code and visually layered above it.
2. **Given** a download control configured for the PNG format, **When** it is activated by click,
   **Then** a PNG file download of the current code is initiated with the configured filename.
3. **Given** a download control configured for the SVG format, **When** it is activated by click,
   **Then** an SVG file download of the current code is initiated with the configured filename.
4. **Given** a download control has keyboard focus, **When** `Enter` or `Space` is pressed, **Then**
   the same download behavior as a pointer click is triggered.
5. **Given** the code has not finished generating yet, **When** the download control is activated,
   **Then** no download of a partial or empty file occurs.

---

### Edge Cases

- What happens when `value` is an empty string? No generation is attempted and no code is rendered;
  the component does not throw.
- What happens when generation fails (e.g. the encoding library rejects the input, or a canvas
  operation errors in an unsupported environment)? The `onError` callback receives a descriptive error
  and no partial/corrupt output is shown; any previously successful output for a prior `value` is
  cleared once a new generation attempt fails.
- What happens when a renderer part (canvas, SVG, or image) is used outside the root container? A
  descriptive error is thrown naming the part and the required root.
- What happens when the layout direction is right-to-left? The code and its accompanying loading
  placeholder, overlay, and download control remain visually centered and readable; no layout mirrors
  in a way that misplaces the overlay off-center.
- What happens when the download control has no successfully generated output yet (still loading or
  errored)? Activating it does nothing rather than downloading an empty or stale file.
- What happens when several renderer parts are combined at once (e.g. canvas and SVG together)? Each
  renders its own representation of the same value independently; the component does not restrict
  which renderer parts may be combined.
- What happens when the same value/configuration is supplied again after a code has already been
  generated? The component does not regenerate unnecessarily.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST accept a `value` (the text to encode), and encode it using the
  upstream-designated third-party QR encoding library — no alternative library and no hand-rolled
  encoder.
- **FR-002**: The component MUST support configuring `size` (pixel dimensions), `level`
  (error-correction level: low/medium/quartile/high), `margin` (quiet-zone width in modules, with `0`
  removing the quiet zone), `quality` (output image quality, where applicable to the chosen renderer),
  `foregroundColor`, and `backgroundColor`, each with the same default as upstream (`size` 200,
  `level` "M", `margin` 1, `quality` 0.92, `foregroundColor` "#000000", `backgroundColor` "#ffffff").
- **FR-003**: The component MUST provide three interchangeable rendering parts for the generated code:
  a canvas-backed renderer, an SVG-backed renderer, and an `<img>`-backed renderer, each independently
  usable and combinable within the same instance.
- **FR-004**: The component MUST provide a loading-placeholder part that is visible before generation
  completes and automatically hides once any output (canvas, SVG, or image) is ready.
- **FR-005**: The component MUST provide an overlay part that visually centers arbitrary content (such as a logo) above the generated code, layered over it without participating in or blocking generation. The documentation MUST state that `level="H"` is required when an overlay is used, matching the upstream guidance that high error correction keeps a code with up to ~30% coverage scannable.
- **FR-006**: The component MUST provide a download control part that, when activated by pointer or by
  keyboard (`Enter`/`Space`), downloads the currently generated code as a file in the requested format
  (PNG or SVG) under a configurable filename, and MUST NOT initiate a download before generation has
  produced usable output.
- **FR-007**: The component MUST regenerate the code whenever `value` or any of the customization
  props (`size`, `level`, `margin`, `quality`, `foregroundColor`, `backgroundColor`) change, and MUST
  avoid redundant regeneration when the same combination of inputs is supplied again.
- **FR-008**: The component MUST invoke an `onGenerated` callback after a successful generation and an
  `onError` callback (receiving a descriptive error) after a failed generation; a failed generation
  MUST NOT leave a partial or corrupted visual result on screen.
- **FR-009**: The component MUST NOT attempt QR generation when `value` is empty, and MUST NOT throw
  an unhandled exception for an empty or otherwise invalid `value`.
- **FR-010**: Every renderer, overlay, loading-placeholder, and download part MUST throw a descriptive
  error naming both the part and the required root container when used outside that root.
- **FR-011**: The rendered code (whichever renderer part is used) MUST expose an accessible name that
  communicates it represents a QR code and, where feasible for that element type, describes the
  encoded value, so that assistive technology users are informed of the code's presence and purpose.
- **FR-012**: The download control MUST be operable as a standalone interactive control: it MUST be
  reachable by keyboard, MUST have a visible focus indicator, and MUST expose an accessible name
  describing its action (defaulting to naming the target format when no custom label is supplied).
- **FR-013**: The component and all of its parts MUST render correctly under a right-to-left layout
  direction, keeping the code, overlay, and loading placeholder centered and the download control's
  reading order correct.
- **FR-014**: The component MUST be composable: consumers combine only the parts they need (e.g. just
  a renderer, or a renderer plus a download control) without being forced to render every part.
- **FR-015**: The component MUST expose the generated size as a shared layout constraint so that
  renderer, overlay, loading-placeholder, and download parts stay visually consistent with the
  configured `size` without each part repeating that value.
- **FR-016**: Every part (container, all three renderers, overlay, loading placeholder, and download control) MUST let a consumer replace the element it renders with their own element or component while keeping every computed attribute, class, ARIA attribute, sizing attribute and event handler wired to that replacement — the port of upstream's documented per-part composition escape hatch. Using the escape hatch MUST NOT drop the part's `data-slot`, its accessible name, or (for the download control) its download behaviour.

### Key Entities

- **QR Code container**: The root that owns the encoded `value`, the customization options (`size`,
  `level`, `margin`, `quality`, colors), and the current generation state (pending, ready, or errored),
  shared with every part nested inside it.
- **Rendering part**: One of three interchangeable representations of the same generated code —
  canvas, SVG, or image — each consuming the shared generation state to display output once ready.
- **Loading placeholder part**: A part representing the "not yet generated" state, shown only while no
  rendering output exists yet.
- **Overlay part**: A part representing arbitrary content layered visually on top of the generated
  code, centered within it.
- **Download control part**: A part representing a user-triggerable action that exports the current
  generated code as a file in a chosen format under a chosen filename.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer can render a scannable QR code for an arbitrary text value using only the
  container and one rendering part, with zero additional configuration — demonstrated by the minimal
  composition documented in the quickstart guide, which requires no configuration beyond the container
  and one rendering part.
- **SC-002**: 100% of the documented upstream examples (default rendering, alternate render formats,
  color/size/error-correction customization, and logo overlay with download) are reproduced as working
  demonstrations.
- **SC-003**: A code requested with the highest documented error-correction level is generated using
  that level unchanged — the level upstream documents as tolerating up to ~30% obscured area —
  verified by an automated test asserting the error-correction level reaches the encoding library
  unchanged. Physical scan verification is out of scope because the encoding library is a third-party
  dependency that is mocked in the automated test suite.
- **SC-004**: Every interactive part (the download control) is fully operable using only a keyboard — reachable with `Tab`, activated by `Enter` and by `Space` — and every part's role, accessible name and state attributes are asserted in the colocated automated test suite through role- and name-based queries, which is this port's automated accessibility evidence. (No axe-style scanner is part of the repository toolchain and none is added by this feature.)
- **SC-005**: The component and all of its parts render with correct, mirrored-appropriate layout when
  the surrounding page direction is right-to-left, with no visual regression versus left-to-right.
- **SC-006**: Changing the encoded value or any customization option updates the visible code without
  requiring the consumer to remount or manually force a re-render.

## Assumptions _(mandatory)_

- **Scope**: Only the `radix` base variant of upstream `qr-code` is ported (the user description
  explicitly points at `.reference/diceui/docs/registry/bases/radix/ui/qr-code.tsx`), matching this
  project's use of `bits-ui` as its headless primitive layer in place of upstream's Radix/base split.
  The parallel `base` variant under `docs/registry/bases/base/ui/qr-code.tsx` is not ported separately;
  its behaviour is identical for the purposes of this component (it has no interactive primitive
  dependency beyond the `Slot`/`asChild` pattern already covered below).
- **QR encoding dependency**: The upstream component dynamically imports the `qrcode` npm package to
  perform PNG data-URL, canvas, and SVG-string generation. This port adds `qrcode` (plus its
  `@types/qrcode` type definitions as a dev dependency) as the component's registry dependency and
  performs the same dynamic import, per the constitution's composition principle and the task's
  explicit instruction not to substitute or hand-roll an encoder.
- **`asChild` / `Slot` → `child` snippet**: Upstream's `asChild` prop (backed by Radix `Slot`) on every
  part is replaced by this repository's existing `child` snippet convention (see `dialog-content.svelte`
  and CLAUDE.md §10), which is the established Svelte 5 equivalent used throughout this codebase for
  render-prop-style delegation to a caller-supplied element (e.g. the `Download` part rendered as a
  `Button`).
- **Internal store → state class**: Upstream's hand-rolled `useSyncExternalStore`-based `Store` (for
  fine-grained subscription to generation state without re-rendering the whole tree) has no Svelte
  equivalent need: Svelte 5's `$state`/`$derived` runes already provide fine-grained reactivity. This
  becomes a single `QRCodeState` class in `qr-code.svelte.ts` holding `dataUrl`, `svgString`,
  `isGenerating`, `error`, and the current generation key as `$state`, exposed through the existing
  Symbol-context pattern (CLAUDE.md §5), replacing both of upstream's two React contexts
  (`StoreContext` and `QRCodeContext`).
- **`useLazyRef` / composed refs helpers**: Upstream's `useLazyRef` and `useComposedRefs` utility hooks
  (listed as separate manual-install steps in the MDX) have no port: they exist only to work around
  React's ref/memoization model. Svelte's `$state`/`bind:this` and a single `$bindable(null)` `ref`
  prop per part (CLAUDE.md §4/§10) replace them directly; no helper files are added.
- **Generation trigger**: Upstream regenerates inside a `useLayoutEffect` gated by a `requestAnimationFrame`
  and a memoized `generationKey` string to avoid redundant work. This is reproduced with a Svelte
  `$effect` that recomputes the same kind of derived key from the reactive inputs and skips
  regeneration when the key is unchanged from the last completed generation (FR-007).
- **Client-only generation**: QR generation is inherently client-side (it needs `canvas`/DOM APIs and a
  dynamically-imported library); this is preserved as-is. No server-side rendering of the encoded
  bitmap/SVG is in scope, consistent with upstream's own dynamic-import approach for SSR safety.
- **Accessible name for the image renderer** defaults to `"QR Code"`, matching upstream's `alt` default,
  overridable via the same prop. For the canvas and SVG renderers — which upstream leaves without a
  built-in accessible name — this port adds an `aria-label` (defaulting to a value derived from the
  encoded `value`, e.g. `"QR code for {value}"`) so FR-011 holds for all three renderers; this is a
  documented accessibility strengthening beyond upstream's weaker default, per the constitution's
  instruction to follow the stronger pattern (APG) when upstream falls short, and is recorded here as a
  deliberate divergence (upstream: no default accessible name on canvas/SVG parts).
- **Keyboard interactions**: Upstream's own accessibility table only documents `Enter`/`Space` on the
  Download control (a native `<button>`); this is preserved by rendering that part as a native
  `<button type="button">` by default, which grants that behavior for free, exactly matching upstream
  scope — no additional keyboard interactions are invented for the non-interactive rendering/overlay
  parts, which upstream also treats as static content.
- **Error-clearing on failure**: The MDX does not specify whether a previously successful render is
  kept on screen if a later regeneration fails. This port clears prior visual output when a new
  generation attempt for a changed input fails, so a stale/mismatched code is never left displayed
  (edge case decision, favoring correctness over graceful degradation, since a QR code silently
  encoding the wrong value is worse than encoding nothing).
- **Overlay guard is additive**: upstream's `QRCodeOverlay` (`qr-code.tsx:450-465`) consumes no context and therefore renders without error outside a root. This port makes `Overlay` call the context getter so FR-010 holds uniformly for all seven parts; rendering it standalone now throws ``<QRCode.Overlay> must be used within `<QRCode.Root>`.`` (upstream: no guard).
- **Root `class` merge order**: upstream's root composes `cn(className, 'relative flex flex-col items-center gap-2')` (`qr-code.tsx:282`), so its own defaults win over the caller's `class` — upstream's overlay demo passes `className="gap-4"` and is silently overridden back to `gap-2`. Constitution Principle VIII requires the caller's `class` to merge **last**, so this port reverses that order for the root part only (the other six parts already merge `class` last upstream). Consequence: a caller-supplied `gap-*`/layout class now takes effect on the root.
- **`data-state` on the root**: additive `data-state="idle" | "generating" | "ready" | "error"`, required by Principle VIII ("every piece of component state MUST be exposed as a `data-*` attribute"). Upstream exposes no generation-state attribute (`qr-code.tsx:279-289`).
- **Focus ring on the download control**: upstream's `<button>` carries only `max-w-(--qr-code-size)` (`qr-code.tsx:438`) and inherits the UA focus ring; this port adds the repo's `focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring outline-none` tokens to satisfy FR-012. Additive styling only — `class` still merges last, so a caller can strip it.
