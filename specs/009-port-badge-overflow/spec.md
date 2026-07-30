# Feature Specification: Badge Overflow

**Feature Branch**: `009-port-badge-overflow`

**Created**: 2026-07-30

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Badge Overflow\" (slug: badge-overflow) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Show only the tags that fit, with a "+N" indicator (Priority: P1)

A developer renders a list of tags (e.g. technology labels, skill badges) inside a fixed-width
container. Instead of the tags wrapping onto unpredictable numbers of lines or overflowing the
container, only as many badges as actually fit on the configured number of lines are shown, and a
trailing "+N" indicator badge communicates how many were hidden.

**Why this priority**: This is the entire reason the component exists — every other behaviour is in
service of this single guarantee. Without it there is nothing to ship.

**Independent Test**: Render the component with a container narrower than the combined width of all
provided items and confirm that (a) the badges that are shown fit within the container's width, (b)
an overflow indicator is shown once at least one item is hidden, and (c) the indicator's count equals
the number of items not rendered as badges.

**Acceptance Scenarios**:

1. **Given** a container wide enough to fit every item, **When** the component measures its content,
   **Then** every item renders as a badge and no overflow indicator is shown.
2. **Given** a container too narrow to fit every item, **When** the component measures its content,
   **Then** only the items that fit are rendered as badges, followed by an overflow indicator whose
   count equals the remaining items.
3. **Given** the container is resized after the initial render (wider or narrower), **When** the new
   size settles, **Then** the visible item count and overflow indicator update to match the new
   available space without a page reload or prop change.

---

### User Story 2 - Multi-line overflow (Priority: P2)

A developer sets a maximum number of lines greater than one so that badges wrap onto multiple rows
before the overflow indicator appears, instead of truncating after the first row.

**Why this priority**: This is a documented, commonly used configuration (the upstream demo ships a
two-line and three-line example) but the component is fully usable and valuable with the single-line
default alone, so it ranks below the core overflow guarantee.

**Independent Test**: Render the component with `lineCount` set to 2 (or 3) and a narrow container,
and confirm badges are distributed across up to that many lines before the overflow indicator is
shown on the last line, and that no line exceeds the container's width.

**Acceptance Scenarios**:

1. **Given** `lineCount` is 2, **When** more items fit across two lines than across one, **Then** the
   component fills the first line, continues filling the second line, and only then shows the
   overflow indicator on the second line if items remain.
2. **Given** `lineCount` is 1 (the default), **When** items overflow, **Then** all overflowing items
   collapse into the single indicator on that one line — no second line is created.

---

### User Story 3 - Custom badge and overflow rendering (Priority: P2)

A developer fully controls how each visible badge and the overflow indicator look and behave (e.g. a
removable tag with a close icon, or an overflow badge reading "+3 more"), because the badges and
indicator are supplied by the consumer, not by the component itself.

**Why this priority**: Custom rendering is required for the interactive/removable-tag use case shown
in the upstream docs, but the component still delivers full value with the default badge/overflow
appearance, so this ranks after the core overflow behaviour.

**Independent Test**: Supply a custom render for both the badge and the overflow indicator (e.g. with
distinguishing text or a data attribute) and confirm the rendered output uses the custom markup
instead of the built-in default badge/indicator markup.

**Acceptance Scenarios**:

1. **Given** a custom badge renderer, **When** items are visible, **Then** each visible item is
   rendered using exactly that custom markup (not the default badge look).
2. **Given** no custom overflow renderer is supplied, **When** items overflow, **Then** a default
   "+N" indicator is shown.
3. **Given** a custom overflow renderer is supplied, **When** items overflow, **Then** the custom
   renderer receives the hidden count and its markup is shown instead of the default indicator.
4. **Given** an array of plain strings, **When** no label-extraction function is supplied, **Then**
   each string is used directly as its own badge label.
5. **Given** an array of objects, **When** no label-extraction function is supplied, **Then** the
   component fails fast (surfaces a clear, documented error) rather than rendering `[object Object]`.

---

### Edge Cases

- **Empty items array**: no badges and no overflow indicator are rendered; the container occupies no
  extra space beyond its own padding.
- **Every item hidden** (container narrower than even a single badge plus the overflow indicator):
  at minimum the overflow indicator itself is shown once measurement completes; the component never
  renders a badge that would visually exceed the container width on the last available line.
- **Object items without a label function**: throws a descriptive error identifying that a label
  extractor is required for non-primitive items, per User Story 3 acceptance scenario 5.
- **Container has no defined width** (e.g. an unconstrained flex parent that can grow to fit content):
  overflow calculations have nothing to measure against; the component's documented contract is that
  the immediate container must resolve to a definite width, matching upstream's documented constraint.
  When the measured content width resolves to `0`, the component reproduces upstream's short circuit
  and renders every item with no indicator — SC-001's guarantee applies only to a container that
  measures a positive width.
- **Items list changes** (added/removed) while mounted: measurement re-runs and the visible/overflow
  split updates to reflect the new list, without requiring a manual remount.
- **Right-to-left layout**: badges and the overflow indicator wrap and are laid out in
  reading-order per the ambient text direction; no left/right-specific behaviour is hard-coded.
- **Server-side rendering**: on the server, no width is known yet, so the component renders a
  best-effort placeholder (a bounded slice of the items, sized to avoid a large layout shift) rather
  than crashing or accessing browser-only APIs.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST accept a list of items and, for each item, a way to render it as a
  badge, showing exactly the items that fit within the configured number of lines of the component's
  own content box.
- **FR-002**: The component MUST accept an optional function that extracts a text label from each
  item, used to identify and measure that item's rendered badge width. When the items are primitive
  values (strings/numbers), this function is optional and the item's own string representation is
  used as the label. When items are non-primitive (objects), omitting this function MUST cause the
  component to raise a clear, descriptive error rather than silently rendering an incorrect label.
- **FR-003**: The component MUST accept a maximum number of lines to fill with badges before
  switching to an overflow indicator, defaulting to 1 line when not specified.
- **FR-004**: Whenever the count of items that do not fit is greater than zero, the component MUST
  render exactly one overflow indicator, immediately after the last visible badge, showing that
  count.
- **FR-005**: The component MUST allow the consumer to fully customize the overflow indicator's
  rendering, receiving the hidden count as input; when no custom renderer is supplied, the component
  MUST render a default indicator showing `+<count>`.
- **FR-006**: The component MUST determine which items fit by measuring the actual rendered width of
  each item's badge (as produced by the consumer's own badge rendering), not an estimate — so that
  custom badge content (icons, multi-line text, custom padding) is measured accurately.
- **FR-007**: The component MUST re-measure and recompute the visible/overflow split automatically
  whenever the component's own content box is resized, without requiring the consumer to pass a new
  size prop or force a re-render.
- **FR-008**: The component MUST re-measure and recompute the visible/overflow split automatically
  whenever the items list changes (items added, removed, or reordered).
- **FR-009**: The component MUST derive its layout spacing (the gap between badges) and content-box
  padding from its own rendered styles, so that consumers can control spacing purely through styling
  (e.g. Tailwind utility classes) without a dedicated spacing prop.
- **FR-010**: Before the first measurement completes (including during server-side rendering, where
  no layout measurement is possible), the component MUST render a non-empty, bounded placeholder view
  of the items list so that a visible flash of empty content does not occur, and MUST NOT access
  browser-only globals (`window`, `document`, `ResizeObserver`) while rendering that placeholder on
  the server.
- **FR-011**: The component MUST support both an uncontrolled usage — items supplied as a plain array
  — and a fully consumer-driven interactive usage where the consumer owns add/remove state for the
  items array and the component re-measures whenever that array changes, as demonstrated by the
  upstream "Interactive Tags" example.
- **FR-012**: Every visible badge and the overflow indicator MUST render in the reading order implied
  by the ambient text direction, so that under a right-to-left direction the wrap order visually
  mirrors the left-to-right case without additional configuration.
- **FR-013**: The component MUST allow the consumer to merge their own CSS classes and inline styles
  onto the rendered container, with consumer-supplied classes taking precedence over the component's
  own default layout classes.
- **FR-014**: The component MUST allow the consumer to render the container as a different underlying
  element or component (matching the upstream `asChild`/`render` escape hatch) rather than being
  restricted to a fixed container element.
- **FR-015**: The component and its rendered parts MUST expose a stable, documented markup identifier
  (equivalent to upstream's `data-slot="badge-overflow"`) so consumers can target the component with
  CSS/test selectors.
- **FR-016**: The component MUST spread any additional standard element attributes the consumer
  supplies onto the rendered container, mirroring plain HTML element usage.
- **FR-017**: The component MUST NOT add an ARIA role or any `aria-*` attribute to its visible
  container and MUST NOT make that container focusable; keyboard reachability and accessible naming of
  badge content remain the consumer's, so tab order MUST equal the DOM order of the consumer-rendered
  badges — matching upstream, which ships no role, no `aria-*` and no keyboard handler.
- **FR-018**: The invisible measurement copy of the badge list MUST be hidden from assistive
  technology (`aria-hidden="true"`) so its duplicated badge text is never announced.

### Key Entities

- **Badge Overflow item**: one entry of the consumer-supplied `items` list; may be a primitive
  (string/number) or an arbitrary object, always paired with a derived text label used for width
  measurement and, by default, badge content.
- **Visible set**: the ordered subset of items that fit within the configured line count at the
  current container width; recomputed on every measurement pass.
- **Hidden count**: the number of items excluded from the visible set at the current container
  width; drives whether and what the overflow indicator shows.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In a container too narrow to fit all supplied items, the rendered badges never overflow
  the container's own width on any line, and the "+N" indicator's number always equals the exact
  count of items not rendered as badges — verified across at least the single-line default and the
  two-line and three-line configurations shown in the upstream examples.
- **SC-002**: Resizing the container (without changing any prop) updates the visible/overflow split
  to match the new width, so a developer never has to force a re-render to correct a stale overflow
  count.
- **SC-003**: A developer can go from a plain array of strings to a working overflow badge list with
  a single required rendering callback, and can switch to an array of objects by adding exactly one
  more callback (the label extractor) — with no other API change.
- **SC-004**: The component behaves correctly under right-to-left page direction without the consumer
  writing any direction-specific code.
- **SC-005**: The component installs and renders through this project's own component registry the
  same way every other already-ported component does, requiring no manual post-install edits by the
  consumer.
- **SC-006**: Every upstream demo file has a working equivalent `<ComponentPreview>` on this project's
  docs page — three previews: **Default** (`badge-overflow-demo.tsx`, containing both the plain and the
  custom-overflow cases shown in that file), **Multi-line Overflow** (`badge-overflow-multiline-demo.tsx`)
  and **Interactive Tags** (`badge-overflow-interactive-demo.tsx`).

## Assumptions _(mandatory)_

- **Upstream variant chosen**: two near-identical upstream implementations exist —
  `docs/registry/bases/radix/ui/badge-overflow.tsx` (built on `radix-ui`'s `Slot`) and
  `docs/registry/bases/base/ui/badge-overflow.tsx` (built on `@base-ui/react`'s `useRender`). Neither
  underlying React primitive library is a dependency of this project. The two implementations are
  behaviourally identical (confirmed by diffing their MDX pages: only the `base`/`radix` frontmatter
  field, the installation package name, and the API-reference type-table path differ). This port
  treats them as a single upstream source of truth and follows the **`radix` variant's prop surface**
  (`asChild?: boolean`) as the canonical API to translate, per Principle II's "the component source"
  reference in `CLAUDE.md` for registry-only components living at
  `docs/registry/bases/base/ui/<name>.tsx` — reconciled here because this component exists in both
  `bases/base` and `bases/radix`, and the two are functionally the same component.
- **`asChild` → `child` snippet**: upstream's `asChild` boolean (radix variant) / `render` prop (base
  variant) — both a `React.ReactNode`-or-render-function escape hatch for swapping the rendered
  element — is replaced by a `child` snippet prop, matching this repository's existing convention
  (see `dialog-content.svelte` and CLAUDE.md §10 translation table: `asChild` / `Slot` / `render` →
  `child` snippet). This is a Svelte-idiomatic 1:1 behavioural replacement, not a capability drop.
- **`useComposedRefs` → `bind:this` + `$bindable`**: upstream composes an internal measurement ref
  with the consumer's forwarded ref via `useComposedRefs`. Svelte has no forwarded-ref concept;
  `ref = $bindable(null)` bound with `bind:this` on the root element is the direct equivalent, and the
  internal (invisible) measurement container gets its own private, non-exposed ref.
  `docs/registry/bases/radix/lib/compose-refs.ts` is therefore not ported — it is dead weight once
  `bind:this` exists.
- **Render props → snippets**: `renderBadge(item, label) => ReactNode` and
  `renderOverflow(count) => ReactNode` are React render-prop callbacks with no snippet equivalent
  possible via plain props (Svelte snippets are not first-class values constructible from a plain
  callback the way JSX is). They are ported as **typed snippet props** —
  `badge: Snippet<[item: T, label: string]>` and `overflow?: Snippet<[count: number]>` — matching
  CLAUDE.md §10's "render prop → typed `Snippet<[Item]>` prop" rule. `renderBadge`/`renderOverflow`
  are documented as the upstream names these replace.
- **Generic item type param**: upstream is a TypeScript generic component (`BadgeOverflow<T>`).
  Svelte 5 supports generic components via `generics="T"` on the module script; this is used so
  `items: T[]`, the `badge` snippet, and the conditional-required `getLabel` prop stay fully typed for
  consumers, matching upstream's compile-time guarantee that `getBadgeLabel` is required for
  non-primitive `T`.
- **Conditional-required `getBadgeLabel` typing**: upstream expresses "required only for object
  arrays" as a conditional TypeScript type
  (`T extends object ? GetBadgeLabel<T> : Partial<GetBadgeLabel<T>>`). Svelte prop types support the
  same conditional-type construct in the module script, so this compile-time guarantee is preserved
  as-is (renamed `getBadgeLabel` → `getLabel` is **not** done; the upstream name is kept verbatim
  because no Svelte-specific reason to rename it exists). The runtime throw for the missing-label
  case (`` `getBadgeLabel` is required when using array of objects ``) is preserved verbatim as the
  documented error message.
- **`use-badge-overflow.ts` hook is not ported as a public API**: it is a standalone, DOM-measuring
  utility hook (with a module-level `Map` cache keyed by rendered CSS class) used nowhere by the
  `badge-overflow.tsx` component itself — it is an alternative, hand-rolled measurement strategy
  documented separately, not a dependency of the component being ported. Per Principle IV
  (composition over reimplementation) and this project's "one state class per component" convention,
  the port re-implements only the measurement logic actually used by `BadgeOverflow` itself (the
  `useLayoutEffect` + `ResizeObserver` block inside the component), as a `BadgeOverflowState` class in
  `badge-overflow.svelte.ts`. The synthetic off-DOM `measureBadgeWidth` string-measurement helper and
  its cross-instance cache are not carried over, because the component's own measurement approach
  (rendering real badges invisibly and reading `offsetWidth`) is what ships and is what must have
  parity — not the unused alternative hook.
- **`$effect` + `ResizeObserver` replaces `useLayoutEffect` + `ResizeObserver`**: per the
  component-specific guidance in this port's instructions and CLAUDE.md §4/§10, the measurement pass
  runs inside a Svelte `$effect` (not `$effect.pre`) that creates one `ResizeObserver` on the root
  element, re-running the full measurement (gap, padding, per-badge widths, badge height, overflow
  badge width, container width) on every observed resize and on every reactive change to `items` or
  `getLabel`/`getBadgeLabel`, and returns a teardown that calls `.disconnect()`. `$effect.pre` is not
  used because the measurement reads layout of already-rendered DOM (the invisible measurement row)
  rather than needing to run before paint on every update; an initial post-mount measurement plus
  `ResizeObserver`-driven re-measurement matches upstream's `useLayoutEffect` intent (measure as soon
  as possible after DOM commit) without requiring `$effect.pre`'s stricter pre-paint timing, and
  avoids measuring on every keystroke of unrelated ancestor updates. The effect body exits early
  (no-op) when `typeof window === 'undefined'` or the root/measurement element refs are not yet bound,
  which is what makes SSR safe (FR-010) — the effect itself never runs during server rendering, so
  this guard defends only against the not-yet-hydrated edge case on the client.
- **Un-measured last-line-doesn't-fit correction, base variant only**: the `radix`/`base` component
  variant this port follows does not include the `use-badge-overflow.ts` hook's "pop the last visible
  item if the overflow indicator itself would not fit" correction — that correction exists only in
  the unported hook. The ported component's line-fitting algorithm matches
  `docs/registry/bases/radix/ui/badge-overflow.tsx`'s own inline algorithm exactly (reserve space for
  the overflow indicator only on the last line when more items remain), since that inline algorithm —
  not the separate hook — is what is actually being ported per the point above.
- **Falsy items and falsy measured widths are skipped, verbatim**: upstream's fitting loop guards with
  `if (!item) continue` (a falsy item such as `''` or `0` is skipped entirely, not counted as hidden)
  and `if (!badgeWidth) continue` (a label whose measured width is `0`, not just `undefined`, is
  likewise skipped). Both guards are reproduced exactly as written upstream — this is upstream
  behaviour being ported, not a divergence.
- **Container width prerequisite is documented, not enforced**: matching upstream's own documented
  constraint ("Container must have a defined width for overflow calculations to work"), the Svelte
  port does not add a runtime warning or fallback for an unbounded-width container; this is called
  out in the component's own prop documentation instead, consistent with upstream leaving it
  undocumented-as-a-guard and documented-as-a-prerequisite only.
- **Accessibility posture**: `Badge Overflow` is a layout/measurement utility, not an interactive
  widget with a WAI-ARIA Authoring Practices pattern of its own (upstream ships no ARIA role,
  attribute, or keyboard handling beyond what the consumer's own `renderBadge` content supplies, e.g.
  a clickable badge in the interactive example). This port therefore adds no ARIA role or keyboard
  handling to the container itself, and the accessibility of interactive badge content (e.g. a
  removable tag) remains the consumer's responsibility via their own `badge` snippet — exactly as
  upstream. RTL correctness (Principle III) is satisfied because the container is a plain
  `flex flex-wrap` box, which already reverses visual order under `dir="rtl"` without any
  direction-aware logic in the component; no dependency on the project's `direction-provider` context
  is introduced, because the component has no direction-sensitive keyboard or focus behaviour to
  invert.
- **Registry dependency**: only the *demo route* reuses this project's existing `badge` component
  (`src/lib/components/ui/badge/`), exactly as upstream's demos reuse shadcn's `Badge`. The component
  itself imports nothing from `ui/badge`: its built-in default markup (used when no `overflow` snippet
  is supplied) inlines upstream's own self-contained classes, so the registry entry keeps
  `registryDependencies: []`.
- **`child` snippet also receives the generated content**: unlike this repo's earlier `child` ports
  (`swap`, `color-swatch`, `gauge`), Badge Overflow *generates* its own children — the visible badge
  list and the indicator — so a `{ props }`-only payload would render an empty element in `child` mode,
  a regression against Radix `Slot`, which preserves the component's children through `cloneElement`.
  The payload is therefore `{ props, content }`, where `content` is a `Snippet` the caller renders
  inside their element. `children` is correspondingly removed from the props type
  (`WithoutChildren<…>`), since the container's content is never caller-supplied.
- **Additional `data-*` state attributes**: upstream emits only `data-slot="badge-overflow"`.
  Constitution Principle VIII requires every piece of component state to be exposed as a `data-*`
  attribute, so the visible container also emits `data-measured` (present once the first measurement
  pass completes), `data-line-count`, `data-hidden-count` and `data-empty`; the invisible measurement
  row carries `data-slot="badge-overflow-measure"` and the built-in indicator
  `data-slot="badge-overflow-indicator"` with `data-count`. These are additive — no upstream attribute
  is renamed or removed — and boolean ones use `cond ? '' : undefined` so they are absent when false.
- **`aria-hidden="true"` on the measurement row**: upstream hides the row visually only
  (`pointer-events-none invisible absolute`). `visibility: hidden` does remove it from the
  accessibility tree in practice, but the row duplicates every badge's text, so the intent is made
  explicit and defensive against consumer badge markup that overrides `visibility`. No other ARIA is
  added: the component has no WAI-ARIA pattern of its own (see the accessibility posture assumption
  above).
- **Non-finite computed `gap` falls back to the documented default**: upstream reads
  `const gap = gapValue ? parseFloat(gapValue) : 4`, which yields `NaN` whenever `gap` computes to
  `normal` (a flex container with no `gap` set) — and that `NaN` is then written back out as the
  container's `gap` and multiplied into the placeholder `min-height`. The port guards with
  `Number.isFinite`, keeping the documented default of `4`. Behaviour is unchanged in every case
  upstream handles correctly; this only prevents an invalid declaration on the first pass and in
  jsdom.
- **The built-in indicator is its own file and is exported**: upstream inlines the default `+N` markup
  twice inside the component function. Constitution Principle V requires one part per file, so the
  markup lives in `badge-overflow-indicator.svelte` and is exported from the barrel as
  `Indicator` / `BadgeOverflowIndicator`, letting consumers reuse the default look inside their own
  overflow snippet. The element, the text and the class *set* are identical to upstream's inline
  version; the string is emitted in Prettier-Tailwind order (`inline-flex h-5 shrink-0 items-center
  rounded-md border px-1.5 text-xs font-semibold`) because `pnpm run format` reorders upstream's
  `font-semibold text-xs` spelling — a formatting-only difference (data-model.md §Attribute contract).
- **SSR placeholder sizing**: matching upstream's own `isMeasured` fallback branch exactly, the
  pre-measurement placeholder renders `min(items.length, lineCount * 3 - (lineCount > 1 ? 1 : 0))`
  items with no overflow indicator and a `min-height` guess of `badgeHeight * lineCount + badgeGap *
  (lineCount - 1)` using the same hard-coded defaults upstream seeds state with (`badgeHeight = 20`,
  `badgeGap = 4`) before any measurement has run.
