# Implementation Plan: Selection Toolbar

**Branch**: `029-port-selection-toolbar` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/029-port-selection-toolbar/spec.md`

## Summary

Port Dice UI's **Selection Toolbar** — a Medium-style floating toolbar that appears against the live
text selection and offers formatting/utility actions — to Svelte 5 as
`src/lib/components/ui/selection-toolbar/`.

Technical approach: **selection tracking is bespoke** (the DOM Selection API has no primitive
equivalent) and lives in a runes state class; **positioning, portalling, collision handling and the
Escape/outside-pointer layers are composed from `bits-ui`'s `Popover` primitives**, whose floating
layer accepts a virtual `Measurable` anchor (`customAnchor`) — exactly the `getBoundingClientRect()`
virtual element upstream feeds to `@floating-ui/react-dom`. Every one of upstream's positioning props
(`side`, `sideOffset`, `align`, `alignOffset`, `avoidCollisions`, `collisionBoundary`,
`collisionPadding`, `sticky`, `hideWhenDetached`, `updatePositionStrategy`) maps 1:1 onto a
`Popover.Content` prop of the same name and semantics, because both sides are floating-ui. Zero new
npm dependencies.

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`), Svelte 5.56 with runes forced on

**Primary Dependencies**: `bits-ui` ^2.18.1 (`Popover` floating layer, `Portal`), Tailwind CSS v4,
`tailwind-merge`/`clsx` via `cn()`, `$lib/components/ui/button`, `$lib/components/ui/direction-provider`

**Storage**: N/A

**Testing**: Vitest 4 (jsdom) + `@testing-library/svelte` 5 + `@testing-library/user-event`, colocated
at `src/lib/components/ui/selection-toolbar/selection-toolbar.test.ts` with a
`selection-toolbar.test.svelte` harness for snippet composition

**Target Platform**: Browsers with the DOM Selection API; SSR-safe (all selection work happens inside
`$effect`, which never runs on the server)

**Project Type**: shadcn-svelte registry component (source distribution) + one SvelteKit docs route

**Performance Goals**: reposition within one animation frame of a selection/scroll/resize change
(SC-001); `scroll`/`resize` listeners are `passive` and coalesced through a single
`requestAnimationFrame` token, exactly as upstream

**Constraints**: must not fight native selection — `preventDefault()` only for
`pointerType === "mouse"` (FR-014); no focus may be moved into the toolbar (moving focus would
collapse the selection the toolbar exists to act on); every listener torn down by its `$effect`
teardown

**Scale/Scope**: 5 source files + 1 barrel + 1 test file + 1 test harness + 1 demo route + 1 registry
entry; 3 public parts (Root, Item, Separator) and 1 internal part (Portal)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                                                                                                                                                       |
| ---- | ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$effect`/`$props`/`$bindable` only; selection tracking in `SelectionToolbarRootState` (`selection-toolbar.svelte.ts`) fed by getter functions; `asChild` → `child` snippets; no stores, no `export let`, no dispatcher                                                                                                       |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | `radix/ui/selection-toolbar.tsx`, `base/ui/selection-toolbar.tsx` (identical prop interface), the MDX and both demos read at the pinned commit; all 15 props, both callbacks, `[data-state]`, the 4 CSS variables, the `selectiontoolbar.select` event and the `Escape` interaction reproduced; divergences D-1…D-8 below and in spec Assumptions |
| III  | Accessibility Is a MUST             | PASS    | `role="toolbar"` + `aria-label="Text formatting toolbar"` on the root, `role="separator" aria-orientation="vertical" aria-hidden="true"` on the separator, items are real `<button type="button">`s reachable by `Tab` and activated by `Enter`/`Space` (FR-010); `Escape` closes and clears; `dir` plumbed to the floating layer for RTL. Upstream ships a flat, independently-tabbable button list with no APG roving-tabindex toolbar navigation (see Complexity Tracking) — reproduced verbatim per Principle II         |
| IV   | Composition Over Reimplementation   | PASS    | Tier 1: `$lib/components/ui/button` (Item), `$lib/components/ui/direction-provider` (`useDirection`). Tier 2: `bits-ui` `Popover.Root`/`Popover.Portal`/`Popover.Content` for anchor positioning, collision middleware, portalling, presence, escape + dismissible layers. Tier 3 (bespoke, justified below): Selection-API tracking only        |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder `selection-toolbar/`, one part per file, `selection-toolbar.svelte.ts` for logic, `index.ts` barrel with short names + prefixed aliases + types, `.js`-suffixed intra-repo imports, exactly one `registry:ui` entry, no import from `src/routes/**` or `src/lib/components/docs/**`                                                    |
| VI   | TypeScript Strict, No Suppressions  | PASS    | All prop types exported from `<script lang="ts" module>`; DOM props via `WithElementRef<HTMLAttributes<HTMLDivElement>>`; the virtual anchor is typed `{ getBoundingClientRect(): DOMRect }`, structurally assignable to bits-ui's `Measurable` — no `any`, no assertion escape hatches, no ignore comments                                       |
| VII  | Green Gate Before Commit            | PASS    | `pnpm run format` → `check` → `lint` → `test:unit -- --run` → `build` scheduled as the final task; no `.skip`/`.todo`                                                                                                                                                                                                                            |
| VIII | Styling Discipline                  | PASS    | `cn()` only (single-variant component, so no `tv()`); `bg-card`/`border`/`bg-border` semantic tokens; `data-slot` on every part; `data-state="open"/"closed"` supplied by bits-ui; no `dark:`, no `space-*`, no manual `z-index` (the popover layer owns stacking)                                                                                |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/selection-toolbar/+page.svelte` with one `<ComponentPreview>` per upstream demo file (`selection-toolbar-demo.tsx`, `selection-toolbar-info-demo.tsx`) plus an API Reference section with a props table per part                                                                                                      |
| X    | One Feature Directory Per Component | PASS    | All artifacts under `specs/029-port-selection-toolbar/`; no git write commands; no writes to `.reference/`, `scripts/`, `.port-*`                                                                                                                                                                                                                |

**Bespoke behaviour justification (Principle IV)**

1. **Selection tracking (`SelectionToolbarRootState`)** — bespoke. Primitives evaluated: `bits-ui`
   exports no Selection-API utility (its `text-selection-layer` only _suppresses_ selection overflow
   while a pointer is down inside a layer; it never reports the selected text or its rect), and no
   component under `src/lib/components/ui/*` reads `window.getSelection()`. The missing capability is
   "observe the live document selection, derive its text and viewport rect, and open/close from it".
   Ported from upstream (`selection-toolbar.tsx:390-496`): `mouseup` on the container (or `document`),
   `selectionchange` on `document`, `passive` `scroll`/`resize` on `window`, coalesced through one rAF
   token and all removed by the `$effect` teardown.

2. **Virtual anchor object** — bespoke, ~10 lines. `Popover.Content`'s `customAnchor` accepts
   `string | HTMLElement | Measurable`; we build the `Measurable` (`{ getBoundingClientRect() }`) from
   the tracked selection rect. This is the same virtual element upstream hands to `useFloating`
   (`selection-toolbar.tsx:226-241`).

3. **Item activation semantics** — bespoke, because the mouse path must _not_ steal the selection:
   `pointerdown` records `pointerType` and calls `preventDefault()` for mouse only; mouse activates on
   `pointerup`, everything else (touch, `Enter`/`Space`) activates on `click` (upstream 629-663). No
   primitive models this; `$lib/components/ui/button` supplies the element, variant and focus ring.

4. **`DocumentFragment` portal target** — bespoke bridge, ~20 lines. `bits-ui`'s `PortalTarget` is
   `Element | string` and its portal throws for anything else, but upstream's `portalContainer` is
   `Element | DocumentFragment | null`. A `display: contents` host div appended to the fragment closes
   the gap while `bits-ui` still performs the mount — the pattern already shipped in
   `action-bar-portal.svelte`.

**Everything else is composed**, in particular: the `offset` / `flip` / `shift`+`limitShift` / `size` /
`hide` middleware, the `transformOrigin` middleware, `autoUpdate` (`updatePositionStrategy`), the
portal, mount/unmount presence, the `Escape` layer and the outside-pointer (dismissible) layer.

**Post-design re-check (after Phase 1)**: all ten verdicts stand. The design added no dependency, no
suppression and no undocumented divergence; the only change relative to the pre-research state is that
Principle IV moved _more_ behaviour from bespoke to composed (positioning and dismissal), and the spec's
Assumptions were corrected to match. `research.md`, `data-model.md`, `contracts/selection-toolbar.md`
and `quickstart.md` contain no `NEEDS CLARIFICATION` markers.

**Deviation from the component-specific porting guidance, stated explicitly.** The guidance asked to
reuse `action-bar`'s `action-bar-floating.svelte.ts`. That module was written for a surface docked to a
_viewport edge_: `getViewportEdgeStyle()` emits `position: fixed; top/bottom/left/right` declarations
that cannot express an anchored, collision-aware placement; `floatingSurfaceVariants` hard-codes
`fixed z-50` plus `top`/`bottom`-only slide variants, which would fight the floating layer's own
positioned wrapper; and `EscapeDismissState` duplicates the escape layer `Popover.Content` already
provides — and, unlike it, does not participate in the nested-layer stack (a selection toolbar inside a
dialog must not dismiss both on one `Escape`). Reuse would therefore have been limited to two constants
(`FLOATING_ALIGNMENTS`, `DEFAULT_ALIGN_OFFSET`), which does not justify the hard
`registryDependencies: ["action-bar"]` edge it would force on every consumer. Rationale in one line:
**Principle IV ranks a `bits-ui` primitive above bespoke code, and the premise that no primitive can
anchor to a non-element is false — `customAnchor` takes a virtual `Measurable`.** The spec's Assumptions
have been corrected to match.

## Project Structure

### Documentation (this feature)

```text
specs/029-port-selection-toolbar/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── selection-toolbar.md   # Phase 1 output — public API contract
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/lib/components/ui/selection-toolbar/
├── index.ts                            # barrel: Root/Item/Separator + prefixed aliases + types + context API
├── selection-toolbar.svelte            # Root — upstream `SelectionToolbar` (radix/ui/selection-toolbar.tsx:119-574)
├── selection-toolbar-portal.svelte     # internal — upstream `portalContainer` + `ReactDOM.createPortal` (523-571)
├── selection-toolbar-item.svelte       # upstream `SelectionToolbarItem` (581-679)
├── selection-toolbar-separator.svelte  # upstream `SelectionToolbarSeparator` (681-696)
├── selection-toolbar.svelte.ts         # `SelectionToolbarRootState` + Symbol context — upstream store (57-207, 379-521)
├── selection-toolbar.test.svelte       # test harness (snippet composition, contenteditable fixture)
└── selection-toolbar.test.ts           # colocated tests (NOT listed in registry.json)

src/routes/docs/components/selection-toolbar/
└── +page.svelte                        # 2 <ComponentPreview> sections + API Reference tables

registry.json                           # append exactly one registry:ui entry named "selection-toolbar"
```

**Structure Decision**: folder slug `selection-toolbar` == registry item name == demo route segment.
Upstream mapping: `SelectionToolbar` → `selection-toolbar.svelte` (its store → `selection-toolbar.svelte.ts`,
its portal branch → `selection-toolbar-portal.svelte`), `SelectionToolbarItem` →
`selection-toolbar-item.svelte`, `SelectionToolbarSeparator` → `selection-toolbar-separator.svelte`.
Upstream's exported `useSelectionToolbar` hook becomes the exported context getter
`getSelectionToolbarContext()` (divergence D-6). `selection-toolbar-portal.svelte` is an implementation
detail of the root's `portalContainer` prop and is deliberately **not** exported from the barrel,
because upstream exposes no `Portal` part.

## Public API

All types are declared in each part's `<script lang="ts" module>` and re-exported from `index.ts`.
Every part additionally accepts `ref` (`$bindable`, default `null`), `class`, `style` and
`...restProps`, spread onto the rendered element with the caller's `class` merged last.

### `SelectionToolbar` (`Root`) — `selection-toolbar.svelte`

`SelectionToolbarRootProps = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {…}`
(alias `SelectionToolbarProps`, matching the upstream type name).

| Prop                     | Type                                                     | Default                        | Bindable |
| ------------------------ | -------------------------------------------------------- | ------------------------------ | -------- |
| `ref`                    | `HTMLDivElement \| null`                                 | `null`                         | ✅       |
| `open`                   | `boolean \| undefined`                                   | `false` (seeded once)          | ✅       |
| `onOpenChange`           | `(open: boolean) => void`                                | —                              | —        |
| `onSelectionChange`      | `(text: string) => void`                                 | —                              | —        |
| `container`              | `HTMLElement \| null \| undefined`                       | `undefined` (whole document)   | —        |
| `portalContainer`        | `Element \| DocumentFragment \| string \| null`          | `document.body`                | —        |
| `side`                   | `"top" \| "right" \| "bottom" \| "left"`                 | `"top"`                        | —        |
| `sideOffset`             | `number`                                                 | `8`                            | —        |
| `align`                  | `"start" \| "center" \| "end"`                           | `"center"`                     | —        |
| `alignOffset`            | `number`                                                 | `0`                            | —        |
| `avoidCollisions`        | `boolean`                                                | `true`                         | —        |
| `collisionBoundary`      | `Element \| null \| (Element \| null)[]`                 | `[]`                           | —        |
| `collisionPadding`       | `number \| Partial<Record<SelectionToolbarSide, number>>` | `0`                           | —        |
| `sticky`                 | `"partial" \| "always"`                                  | `"partial"`                    | —        |
| `hideWhenDetached`       | `boolean`                                                | `false`                        | —        |
| `updatePositionStrategy` | `"optimized" \| "always"`                                | `"optimized"`                  | —        |
| `dir`                    | `"ltr" \| "rtl" \| undefined`                            | nearest provider → DOM → `ltr` | —        |
| `children`               | `Snippet`                                                | —                              | —        |
| `child`                  | `Snippet<[{ props: SelectionToolbarChildProps }]>`        | —                              | —        |

- **Snippets**: `children` (toolbar contents); `child` (replaces upstream `asChild`; receives the merged
  attribute payload to spread onto the caller's own element — `children` is not rendered and `ref` stays
  `null` in that mode).
- **Callbacks/events**: `onOpenChange(open)` on every open/close transition (controlled and
  uncontrolled); `onSelectionChange(text)` on every tracked selection change, including `""` when the
  selection is cleared.
- **Rendered contract**: `role="toolbar"`, `aria-label="Text formatting toolbar"` (overridable through
  `restProps`), `data-slot="selection-toolbar"`, `data-state="open" | "closed"`, plus the four CSS
  variables below. Renders nothing while closed.

### `SelectionToolbarItem` (`Item`) — `selection-toolbar-item.svelte`

`SelectionToolbarItemProps = Omit<ButtonProps, "onselect"> & {…}`

| Prop       | Type                                                             | Default   | Bindable |
| ---------- | ---------------------------------------------------------------- | --------- | -------- |
| `ref`      | `HTMLButtonElement \| HTMLAnchorElement \| null`                 | `null`    | ✅       |
| `onSelect` | `(text: string, event: SelectionToolbarItemSelectEvent) => void` | —         | —        |
| `variant`  | `ButtonProps["variant"]`                                         | `"ghost"` | —        |
| `size`     | `ButtonProps["size"]`                                            | `"icon"`  | —        |
| `disabled` | `boolean`                                                        | `false`   | —        |
| `children` | `Snippet`                                                        | —         | —        |
| `child`    | `Snippet<[{ props: SelectionToolbarItemChildProps }]>`            | —         | —        |

- **Event**: dispatches a bubbling, cancelable `CustomEvent<{ text: string }>` named
  `selectiontoolbar.select` (exported as `SELECTION_TOOLBAR_ITEM_SELECT`) on its own element; `onSelect`
  is registered as a one-shot listener for it, so consumers may also listen on an ancestor.
- **Activation**: mouse → `pointerup` (with `preventDefault()` on `pointerdown` so the selection
  survives); touch/pen and keyboard (`Enter`/`Space`) → `click`.
- **Rendered contract**: `<button type="button">` from `$lib/components/ui/button` with
  `data-slot="selection-toolbar-item"` and `class="size-8"` merged before the caller's `class`.
- Throws ``` `<SelectionToolbar.Item>` must be used within `<SelectionToolbar>`. ``` outside the root.

### `SelectionToolbarSeparator` (`Separator`) — `selection-toolbar-separator.svelte`

`SelectionToolbarSeparatorProps = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & { child? }`

| Prop       | Type                                                       | Default | Bindable |
| ---------- | ---------------------------------------------------------- | ------- | -------- |
| `ref`      | `HTMLDivElement \| null`                                   | `null`  | ✅       |
| `children` | `Snippet`                                                  | —       | —        |
| `child`    | `Snippet<[{ props: SelectionToolbarSeparatorChildProps }]>` | —       | —        |

- **Rendered contract**: `role="separator" aria-orientation="vertical" aria-hidden="true"`,
  `data-slot="selection-toolbar-separator"`, `class="mx-0.5 h-6 w-px bg-border"`.
- Throws ``` `<SelectionToolbar.Separator>` must be used within `<SelectionToolbar>`. ``` outside the
  root (divergence D-7).

### Module exports (`selection-toolbar.svelte.ts`, re-exported from the barrel)

| Export                                         | Kind  | Purpose                                                                          |
| ---------------------------------------------- | ----- | -------------------------------------------------------------------------------- |
| `SelectionToolbarRootState`                    | class | Reactive `open` / `selectedText` / `selectionRect` / `anchor`, tracking lifecycle |
| `setSelectionToolbarContext`                   | fn    | Called by the root                                                               |
| `getSelectionToolbarContext(consumer)`         | fn    | Throwing getter — the Svelte equivalent of upstream's `useSelectionToolbar`       |
| `SELECTION_TOOLBAR_SIDES` / `…ALIGNMENTS`      | const | The documented `side` / `align` option lists                                     |
| `SELECTION_TOOLBAR_ITEM_SELECT`                | const | `"selectiontoolbar.select"`                                                      |
| `SELECTION_TOOLBAR_ITEM_SELECT_OPTIONS`        | const | `{ bubbles: true, cancelable: true }`                                            |
| `DEFAULT_SIDE_OFFSET` / `DEFAULT_ALIGN_OFFSET` | const | `8` / `0`                                                                        |
| Types                                          | types | `SelectionToolbarSide`, `SelectionToolbarAlign`, `SelectionRect`, `SelectionToolbarRootStateProps`, `SelectionToolbarItemSelectEvent`, every `*Props` and `*ChildProps` |

### Data attributes and CSS variables

| Name                                   | On           | Values / source                                             |
| -------------------------------------- | ------------ | ----------------------------------------------------------- |
| `data-state`                           | root         | `"open"` \| `"closed"`                                      |
| `data-side` / `data-align`             | root         | resolved placement (supplied by the floating layer)         |
| `data-slot`                            | every part   | `selection-toolbar`, `-item`, `-separator`                  |
| `--selection-toolbar-available-width`  | root (style) | `var(--bits-popover-content-available-width)`               |
| `--selection-toolbar-available-height` | root (style) | `var(--bits-popover-content-available-height)`              |
| `--selection-toolbar-anchor-width`     | root (style) | `var(--bits-popover-anchor-width)` (selection rect width)   |
| `--selection-toolbar-anchor-height`    | root (style) | `var(--bits-popover-anchor-height)` (selection rect height) |

## Behaviour contract

| Trigger                                             | Result                                                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `mouseup` on `container ?? document`                | next frame: read selection → non-empty (and inside `container`) → set text + rect, open   |
| `selectionchange` with an empty/collapsed selection | close: `open=false`, `selectedText=""`, `selectionRect=null`, one batched notification    |
| `scroll` / `resize` (passive)                       | one rAF-coalesced re-read while open, so the toolbar tracks the selection                 |
| selection extended without clearing                 | rect/text updated in place — no close/reopen (spec edge case, FR-005)                     |
| `Escape` while open                                 | `selection.removeAllRanges()` then close (FR-008), via the popover's escape layer         |
| pointer down outside the toolbar                    | `selection.removeAllRanges()` then close (FR-009), via the popover's dismissible layer    |
| pointer down **inside** the toolbar                 | nothing dismisses; mouse `pointerdown` is `preventDefault()`ed so the selection survives  |
| item activated                                      | `selectiontoolbar.select` dispatched with the text captured at activation time (FR-010)   |
| `container` set and selection made outside it       | ignored — toolbar stays closed (FR-004)                                                   |
| touch selection                                     | no `preventDefault()` anywhere on the touch path; native handles/menu unaffected (FR-014) |

## Divergences from upstream (all recorded in spec Assumptions)

| #   | Upstream                                                | Here                                                                                              |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| D-1 | `@floating-ui/react-dom` `useFloating` + middleware      | `bits-ui` `Popover.Content` (the same floating-ui middleware stack) with a virtual `customAnchor`  |
| D-2 | `asChild` (Radix `Slot`) on root and separator           | `child` snippet (CLAUDE.md §10)                                                                   |
| D-3 | `container?: HTMLElement \| RefObject \| null`           | `container?: HTMLElement \| null` — Svelte refs are plain values, so `RefObject` has no equivalent |
| D-4 | `portalContainer?: Element \| DocumentFragment \| null`  | additionally accepts a CSS selector `string`, matching `bits-ui`'s `PortalTarget` and `action-bar` |
| D-5 | `--selection-toolbar-*` written by the `size` middleware | same four variables, aliased onto the `--bits-popover-*` variables the floating layer computes     |
| D-6 | `useSelectionToolbar` store hook                         | `getSelectionToolbarContext()` + `SelectionToolbarRootState` (Principle V compound pattern)        |
| D-7 | separator renders anywhere                               | separator reads the context and throws outside the root (FR-016, CLAUDE.md §5)                     |
| D-8 | no direction prop                                        | `dir` prop resolved through `<DirectionProvider>` and forwarded to the floating layer (FR-015)     |

Additional non-API notes: `bits-ui` sets `tabindex="-1"` on the floating surface (upstream sets none) —
inert for a container that never receives focus; `preventOverflowTextSelection={false}` and
`trapFocus={false}` are passed so the layer never locks `user-select` or moves focus, and both
auto-focus events are default-prevented, preserving upstream's "never touch the selection" behaviour.

## Deliverables schedule

| #   | Deliverable                                                                                             | Depends on |
| --- | ------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | `selection-toolbar.svelte.ts` — rect/text/open state, Selection-API tracking `$effect`, Symbol context   | —          |
| 2   | `selection-toolbar-portal.svelte` — bits `Portal` + `DocumentFragment` host bridge                       | —          |
| 3   | `selection-toolbar.svelte` — `Popover.Root`/`Portal`/`Content`, all 15 props, `child` snippet, CSS vars  | 1, 2       |
| 4   | `selection-toolbar-item.svelte` — `Button` composition, pointer-type activation, select event            | 1          |
| 5   | `selection-toolbar-separator.svelte`                                                                     | 1          |
| 6   | `index.ts` barrel — components, aliases, types, context API, constants                                   | 1–5        |
| 7   | `selection-toolbar.test.svelte` harness + `selection-toolbar.test.ts` (six areas below)                  | 6          |
| 8   | `src/routes/docs/components/selection-toolbar/+page.svelte` — 2 previews + API Reference tables          | 6          |
| 9   | `registry.json` entry (`registryDependencies: ["button", "direction-provider"]`, `dependencies: ["bits-ui"]`) + `pnpm run registry:build` | 6 |
| 10  | Quality gates: `format` → `check` → `lint` → `test:unit -- --run` → `build`                              | 7–9        |

**Shared modules exported for later components**: none of this component's logic is generic enough to
promote. The selection tracker is Selection-API-specific and the positioning belongs to `bits-ui`.
`selection-toolbar.svelte.ts` therefore exports its state class, context helpers and constants under
`SelectionToolbar*` names only; the reusable floating mechanics a future port would want already exist
in `bits-ui` (`Popover.Content`) and in `action-bar/action-bar-floating.svelte.ts` (viewport-edge
docking), and this plan adds no third one.

### Tests (constitution III / CLAUDE.md §7, six required areas)

1. **Roles/ARIA** — `role="toolbar"` + accessible name, separator role/orientation/`aria-hidden`,
   `data-slot` and `data-state` on every part.
2. **Keyboard** — `Escape` closes and clears the ranges; `Enter`/`Space` on a focused item fires
   `onSelect` with the selected text (the non-mouse activation path); `Tab` reaches the items.
3. **Uncontrolled** — no `open` prop: selecting text in the container opens the toolbar; collapsing the
   selection closes it; `onSelectionChange` fires with the text and then with `""`.
4. **Controlled** — `open` bound: the parent's value wins and `onOpenChange` fires with the next value.
5. **RTL** — `dir="rtl"` on the root and via `<DirectionProvider>`: the resolved direction reaches the
   floating surface (`dir` attribute), which is what inverts `align="start"/"end"` in the layer.
6. **Guard rails** — `container` scoping ignores outside selections; `disabled` items do not fire
   `onSelect`; mouse `pointerdown` inside an item is default-prevented while touch is not (FR-014);
   `<SelectionToolbar.Item>` and `<SelectionToolbar.Separator>` outside the root throw the documented
   error (`expect(() => render(...)).toThrow(/within/)`).

Upstream ships **no** test file for this component (checked: no `selection-toolbar*.test.tsx` anywhere
under `.reference/diceui`), so the floor is the MDX contract plus the six areas above.

## Complexity Tracking

> Every bespoke unit in the Bespoke behaviour justification above is covered by Principle IV and none of
> them replaces an available primitive. One deviation between Principle II and Principle III is recorded
> below because it cannot be resolved by composition.

| Principle | Violation                                                  | Why Needed                                                                                                                                                                                                                                                       | Compliant Alternative Rejected Because                                                                                                                             |
| --------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| III       | `role="toolbar"` without APG roving focus                   | Upstream ships plain, independently tabbable `<button>`s and documents `Escape` as the component's only keyboard interaction (radix/ui/selection-toolbar.tsx:665-677, MDX Keyboard Interactions). Principle II is NON-NEGOTIABLE, so key-for-key parity wins over adding non-upstream Arrow/Home/End roving focus. | Adding roving tabindex would change the documented tab order and silently diverge from upstream — an undocumented drift that Principle II forbids. Revisit if upstream adopts the APG pattern. |
