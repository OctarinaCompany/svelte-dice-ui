# Implementation Plan: Action Bar

**Branch**: `028-port-action-bar` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/028-port-action-bar/spec.md`

## Summary

Port Dice UI's **Action Bar** (radix base) to Svelte 5: a floating `role="toolbar"` surface that is
portalled to the document body, docked to a viewport edge (`side` / `align` / `sideOffset` /
`alignOffset`), dismissed with `Escape` or a close button, and containing a roving-tabindex
`role="group"` of action buttons that follows the WAI-ARIA Toolbar pattern (arrow keys, `Home`/`End`,
`loop`, RTL inversion, disabled skipping).

Technical approach: six part components plus three runes modules under
`src/lib/components/ui/action-bar/`. Two of those modules are written **component-agnostic and
exported from the barrel** so the next port (`selection-toolbar`) imports them instead of duplicating
them (FR-016):

- `action-bar-floating.svelte.ts` — viewport-edge inline style, the enter-transition/chrome `tv()`
  recipe, and the `Escape` dismisser state class.
- `action-bar-roving-focus.svelte.ts` — the WAI-ARIA Toolbar roving-tabindex group state class plus
  its pure helpers (`focusFirst`, `wrapArray`, `getDirectionAwareKey`, `getFocusIntent`).
- `action-bar-portal.svelte` — a portal host that delegates to `bits-ui`'s `Portal` and adds
  `DocumentFragment` targets, which `bits-ui` rejects.

Composition (Principle IV) covers everything else: `bits-ui` `Portal` for portalling,
`$lib/components/ui/button` for items, `$lib/components/ui/direction-provider`'s `useDirection()` for
`dir` resolution, and `speed-dial`'s already-shared `DomOrderedCollection` for the document-ordered
item registry that upstream open-codes as `getItems()`.

## Technical Context

**Language/Version**: TypeScript 5 (strict, `verbatimModuleSyntax`) + Svelte 5.56 (runes forced on)

**Primary Dependencies**: SvelteKit 2, `bits-ui` ^2.18.1 (`Portal`), `tailwind-variants` ^3.3.0,
`@lucide/svelte` ^1.27.0 (demo only), Tailwind CSS v4 + `tw-animate-css` (already imported by
`src/app.css`)

**Storage**: N/A — no persistence

**Testing**: Vitest (jsdom, `globals: false`, `expect.requireAssertions`) +
`@testing-library/svelte` + `@testing-library/user-event`, colocated at
`src/lib/components/ui/action-bar/action-bar.test.ts` with a `.test.svelte` harness for snippets,
bindings and provider-less renders

**Target Platform**: Browser (SSR-safe — the portal renders only in the browser)

**Project Type**: shadcn-svelte component registry (source-distributed UI library + SvelteKit docs
site)

**Performance Goals**: No layout thrash on open; item ordering is one `compareDocumentPosition` sort
per structural change (`DomOrderedCollection`), not per keystroke; the transition is CSS-only and
honours `motion-reduce`

**Constraints**: Zero new npm dependencies; no `any`, no suppressions; no `shadcn-svelte add`; every
gate green; component source must not import from `src/routes/**` or `src/lib/components/docs/**`

**Scale/Scope**: 6 part components + 3 runes/shared modules + 1 barrel + 1 test suite + 1 harness +
1 demo route + 1 registry entry (11 registry files)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                        |
| ---- | ----------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$effect`/`$props`/`$bindable` + snippets only; behaviour lives in `action-bar.svelte.ts`, `action-bar-floating.svelte.ts`, `action-bar-roving-focus.svelte.ts`; no stores, no `export let`, no dispatcher |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | `docs/registry/bases/radix/ui/action-bar.tsx`, `docs/types/radix/action-bar.ts`, `action-bar.mdx` and both demos read at the pinned commit; every prop, callback, data attribute and key reproduced; divergences listed in spec Assumptions and §"Assumption refinements" below |
| III  | Accessibility Is a MUST             | PASS    | `role="toolbar"` + `aria-orientation` on the root, `role="group"` on the group, roving `tabindex`, `role="separator"`+`aria-hidden`, full key map (Tab, Shift+Tab, Escape, Arrow×4, Home, End), RTL inversion, disabled skipping — all in the test plan (contracts/keyboard-map.md) |
| IV   | Composition Over Reimplementation   | PASS    | `bits-ui` `Portal`, `$lib/.../button`, `direction-provider`'s `useDirection()`, `speed-dial`'s `DomOrderedCollection`; the three bespoke pieces are justified below                             |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder `src/lib/components/ui/action-bar/`, one part per file, `index.ts` barrel with short + prefixed names + types, one `registry:ui` entry, no import from the docs app                   |
| VI   | TypeScript Strict, No Suppressions  | PASS    | All prop types exported from `<script lang="ts" module>` off `WithElementRef<HTMLAttributes<…>>`; no `any`, no ignore comments, no config edits                                                  |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit --run` → `build` scheduled as the final task; no skipped tests                                                                                          |
| VIII | Styling Discipline                  | PASS    | `cn()` + `tv()`, semantic tokens only (`bg-card`, `border`, `bg-border`, `text-sm`), `data-slot` on every part, boolean data attrs as `cond ? '' : undefined`, caller `class` merged last; `z-50` note below |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/action-bar/+page.svelte` with one `<ComponentPreview>` per upstream demo (`action-bar-demo.tsx`, `action-bar-position-demo.tsx`) plus six props tables               |
| X    | One Feature Directory Per Component | PASS    | All artifacts under `specs/028-port-action-bar/`; no git write commands; no writes to protected paths                                                                                            |

**Bespoke behaviour justification (Principle IV)**:

1. **Viewport-edge positioning** (`getViewportEdgeStyle`, ~12 lines of inline style).
   Evaluated: `bits-ui` `Popover`/`Tooltip` floating positioning. Lacking capability: every `bits-ui`
   positioner is *anchor-relative* — it requires a trigger element and computes a placement against
   it. The Action Bar's anchor is the **viewport**, so upstream itself uses plain
   `position: fixed` + a per-side pixel offset + `translate: -50% 0` for centring. Using a floating
   positioner would require inventing a virtual anchor element and would still not reproduce
   `align="start"/"end"` measured from the viewport edge. Also recorded in the spec Assumptions.

2. **Escape dismissal** (`EscapeDismissState`, ~15 lines).
   Evaluated: `bits-ui` `Dialog`/`Popover` (which own `escapeKeydownBehavior`) and any exported
   escape-layer utility. Lacking capability: `bits-ui`'s public surface exports no standalone escape
   layer (`node_modules/bits-ui/dist/index.js` exports only the widget namespaces plus `Portal`,
   `IsUsingKeyboard`, `BitsConfig`, `computeCommandScore`). The widgets that own the behaviour bundle
   it with modality, focus trapping, scroll locking and outside-click dismissal — none of which the
   Action Bar has (it is explicitly non-modal and must not trap focus). A document-level `keydown`
   listener in an `$effect` with a teardown is the faithful and smaller translation.

3. **Roving-tabindex group** (`RovingFocusGroupState`).
   Evaluated: `bits-ui` `Toolbar` (`Toolbar.Root` / `Toolbar.Group` / `Toolbar.Button`). Lacking
   capability: `bits-ui` scopes roving focus to `Toolbar.Root`, i.e. the whole bar — but upstream
   scopes it to the inner `ActionBarGroup`, and `ActionBarClose` must keep its **own separate tab
   stop** (FR-012), which is impossible when the root owns the roving scope. Additionally
   `bits-ui`'s `Toolbar.Group` is a toggle group (`aria-pressed`, `value`/`onValueChange`), not a
   focus sub-scope with `role="group"`, and `Toolbar` has no portal or viewport positioning. The
   item registry itself is *not* bespoke: it composes `speed-dial`'s exported
   `DomOrderedCollection`, which already implements upstream's `compareDocumentPosition` ordering.

4. **`DocumentFragment` portal target** (`action-bar-portal.svelte`, ~10 lines).
   Evaluated: `bits-ui` `Portal`. Lacking capability: `PortalTarget = Element | string` and
   `portal.svelte` throws a `TypeError` in DEV for anything else, while upstream's
   `portalContainer` is typed `Element | DocumentFragment | null`. The wrapper delegates to
   `bits-ui` `Portal` for every `Element`/`string` target and, for a `DocumentFragment`, appends a
   `display: contents` host element to the fragment and portals into that host — so `bits-ui` still
   owns the actual portalling.

**Styling note (Principle VIII, `z-50`)**: the "no manual `z-index` on overlays" rule targets
`bits-ui`-backed overlays that own their stacking (Dialog/Sheet/Popover/Tooltip). The Action Bar is a
bespoke, self-portalled surface with no such owner, so — exactly like the already-ported `banner`
(`banner-queue.svelte`: `isolate z-50`) and upstream (`fixed z-50`) — it sets its own `z-50`. This is
precedent-consistent, not a violation.

## Public API

Everything below is derived from `.reference/diceui/docs/registry/bases/radix/ui/action-bar.tsx` and
`.reference/diceui/docs/types/radix/action-bar.ts` at the pinned commit. Full prop-by-prop tables with
upstream line references live in [contracts/public-api.md](./contracts/public-api.md); this is the
authoritative summary.

Every part additionally accepts `ref` (bindable `HTMLElement | null`), `class`, `children`, a `child`
snippet (the project's replacement for upstream `asChild`), and spreads `...restProps` onto its
element.

### `ActionBar` (Root) — `action-bar.svelte`

Renders nothing while closed. When open, portals a `role="toolbar"` `<div>`.

| Prop              | Type                                                | Default        | Bindable |
| ----------------- | --------------------------------------------------- | -------------- | -------- |
| `open`            | `boolean`                                           | `false`        | **yes**  |
| `defaultOpen`     | `boolean`                                           | `false`        | no       |
| `onOpenChange`    | `(open: boolean) => void`                           | —              | no       |
| `onEscapeKeyDown` | `(event: KeyboardEvent) => void`                    | —              | no       |
| `side`            | `'top' \| 'bottom'`                                 | `'bottom'`     | no       |
| `sideOffset`      | `number`                                            | `16`           | no       |
| `align`           | `'start' \| 'center' \| 'end'`                      | `'center'`     | no       |
| `alignOffset`     | `number`                                            | `0`            | no       |
| `portalContainer` | `Element \| DocumentFragment \| string \| null`     | `document.body`| no       |
| `dir`             | `'ltr' \| 'rtl'`                                    | inherited/`ltr`| no       |
| `orientation`     | `'horizontal' \| 'vertical'`                        | `'horizontal'` | no       |
| `loop`            | `boolean`                                           | `true`         | no       |
| `ref`             | `HTMLDivElement \| null`                            | `null`         | **yes**  |

Snippets: `children`, `child({ props: ActionBarChildProps })`.
Callbacks: `onOpenChange`, `onEscapeKeyDown` (call `preventDefault()` to keep the bar open).
Data attributes: `data-slot="action-bar"`, `data-side`, `data-align`, `data-orientation`; plus
`role="toolbar"`, `aria-orientation`, `dir`.

### `ActionBarSelection` — `action-bar-selection.svelte`

Presentational pill for the selection summary. No behaviour, no extra props beyond the common set.
`data-slot="action-bar-selection"`.

### `ActionBarGroup` — `action-bar-group.svelte`

`role="group"`, roving-tabindex host. No extra props beyond the common set (orientation, loop and dir
come from the root context). `data-slot="action-bar-group"`, `data-orientation`,
`tabindex` = `0` unless tabbing back out or zero focusable items (then `-1`). Handles `onfocusin`,
`onfocusout`, `onmousedown` and forwards the caller's handlers first (early-returning on
`defaultPrevented`), and dispatches the cancelable `actionbarFocusGroup.onEntryFocus` event on entry.

### `ActionBarItem` — `action-bar-item.svelte`

Composes `$lib/components/ui/button`. Must be inside an `ActionBarGroup` (upstream throws otherwise).

| Prop       | Type                                              | Default       | Bindable |
| ---------- | ------------------------------------------------- | ------------- | -------- |
| `onSelect` | `(event: ActionBarItemSelectEvent) => void`       | —             | no       |
| `variant`  | `ButtonVariant`                                   | `'secondary'` | no       |
| `size`     | `ButtonSize`                                      | `'sm'`        | no       |
| `disabled` | `boolean`                                         | `undefined`   | no       |
| `ref`      | `HTMLButtonElement \| null`                       | `null`        | **yes**  |

`onSelect` receives the cancelable, bubbling `actionbar.itemSelect` `CustomEvent`; calling
`preventDefault()` suppresses the automatic `onOpenChange(false)`.
`data-slot="action-bar-item"`, `tabindex` `0` only when the item is the group's current tab stop.

### `ActionBarClose` — `action-bar-close.svelte`

A plain `<button type="button">` with its own tab stop, outside the group's roving focus. Calls the
caller's `onclick` first; unless prevented, calls `onOpenChange(false)`.
`data-slot="action-bar-close"`.

### `ActionBarSeparator` — `action-bar-separator.svelte`

| Prop          | Type                         | Default          | Bindable |
| ------------- | ---------------------------- | ---------------- | -------- |
| `orientation` | `'horizontal' \| 'vertical'` | root orientation | no       |

`role="separator"`, `aria-orientation`, `aria-hidden="true"`,
`data-slot="action-bar-separator"`.

### `ActionBarPortal` — `action-bar-portal.svelte` (addition, not an upstream part)

The reusable portal host described in justification 4. `to?: Element | DocumentFragment | string |
null`, `children`. Exported so `selection-toolbar` reuses it.

### Shared exports for `selection-toolbar` (FR-016)

From `action-bar-floating.svelte.ts`: `getViewportEdgeStyle`, `floatingSurfaceVariants`,
`EscapeDismissState`, `FLOATING_SIDES`, `FLOATING_ALIGNMENTS`, `DEFAULT_SIDE_OFFSET`, and the
`FloatingSide` / `FloatingAlign` / `FloatingOrientation` types.
From `action-bar-roving-focus.svelte.ts`: `RovingFocusGroupState`, `focusFirst`, `wrapArray`,
`getDirectionAwareKey`, `getFocusIntent`, `setRovingFocusContext`, `getRovingFocusContext`, and the
`RovingFocusIntent` / `RovingFocusItemMeta` types.
From `action-bar.svelte.ts`: the context helpers, the event-name constants and the `tv()` recipes.

## Assumption refinements

Three points where the spec's prose is refined by what the pinned upstream source actually does.
Principle II is non-negotiable, so upstream wins and the spec has been corrected in place
(Edge Cases + Assumptions):

- **`portalContainer={null}` renders into `document.body`.** Upstream computes
  `portalContainerProp ?? (mounted ? document.body : null)` — `??` falls back on `null`, so an
  explicit `null` is *not* a "do not render" signal; the only falsy case is the pre-mount SSR pass,
  which in Svelte `bits-ui` `Portal` already handles by rendering nothing outside the browser. The
  spec's original edge case said the opposite; it has been corrected.
- **FR-008's "enter/exit transition" is enter-only on this component.** FR-001 and the "action bar is
  closed" edge case both require synchronous unmount (upstream `if (!open) return null`), which
  forbids holding the node alive for an exit animation. The `tv()` recipe therefore ships both halves
  (`data-[state=open]:animate-in …` / `data-[state=closed]:animate-out …` + `motion-reduce:animate-none`)
  and is exported for reuse, while `ActionBar` itself only ever mounts in the open state. This
  satisfies FR-008's operative clause — "the transition primitive MUST be reusable outside this
  component" — without breaking FR-001.
- **The `actionbar.itemSelect` DOM plumbing *is* reproduced.** The spec assumed only the observable
  contract would be. Reproducing the real bubbling, cancelable `CustomEvent` (the
  `speed-dial-action.svelte` precedent) is a strict superset: `onSelect` still fires with a cancelable
  event and `preventDefault()` still suppresses the auto-close, and consumers additionally get the
  upstream event on ancestors. Same for `actionbarFocusGroup.onEntryFocus` on the group.

## Project Structure

### Documentation (this feature)

```text
specs/028-port-action-bar/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── public-api.md    # exhaustive prop/snippet/callback/data-attribute contract
│   └── keyboard-map.md  # key → behaviour → test assertion matrix (LTR + RTL)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/action-bar/
├── index.ts                          # barrel: short names + prefixed aliases + every prop type + shared modules
├── action-bar.svelte                 # Root            ← action-bar.tsx:126-235 (ActionBar)
├── action-bar-selection.svelte       # Selection       ← action-bar.tsx:237-252 (ActionBarSelection)
├── action-bar-group.svelte           # Group           ← action-bar.tsx:254-418 (ActionBarGroup)
├── action-bar-item.svelte            # Item            ← action-bar.tsx:420-591 (ActionBarItem)
├── action-bar-close.svelte           # Close           ← action-bar.tsx:593-626 (ActionBarClose)
├── action-bar-separator.svelte       # Separator       ← action-bar.tsx:628-659 (ActionBarSeparator)
├── action-bar-portal.svelte          # Portal host     ← action-bar.tsx:190-193, 199-232 (createPortal + container resolution)
├── action-bar.svelte.ts              # root state class, Symbol context, constants, tv() recipes ← action-bar.tsx:15-87, 112-124, 180-229
├── action-bar-floating.svelte.ts     # SHARED: viewport-edge style, surface tv(), EscapeDismissState ← action-bar.tsx:162-178, 210-229
├── action-bar-roving-focus.svelte.ts # SHARED: RovingFocusGroupState + focusFirst/wrapArray/getDirectionAwareKey/getFocusIntent ← action-bar.tsx:35-62, 89-110, 265-391, 505-556
├── action-bar.test.ts                # colocated tests (NOT in registry.json)
└── action-bar.test.svelte            # render harness for snippets/bindings/provider-less renders (NOT in registry.json)

src/routes/docs/components/action-bar/
└── +page.svelte                      # 2 <ComponentPreview> (Default, Position) + 6 props tables

registry.json                          # append exactly one registry:ui entry named "action-bar"
```

**Structure Decision**: One folder per component (Principle V); every part file is
`action-bar-<part>.svelte`, the root is `action-bar.svelte`, reactive logic sits in `.svelte.ts`
modules, and tests are colocated and excluded from the registry entry. The two shared modules are
named with the `action-bar-` prefix required by CLAUDE.md §3 even though their exported API is
component-agnostic — the `speed-dial-collection.svelte.ts` / `DomOrderedCollection` precedent, which
`segmented-input` and `time-picker` already consume cross-component via a `registryDependencies`
entry. Folder slug = demo route segment = registry item name = `action-bar`.

Registry entry: `registryDependencies: ["button", "direction-provider", "speed-dial"]`,
`dependencies: ["bits-ui", "tailwind-variants"]`, `files` = the eleven non-test files above.

## Phase plan

| Phase | Work                                                                                                                | Deliverable                                       |
| ----- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 0     | Resolve every open question against the pinned source                                                                | `research.md` (16 decisions, zero unknowns left)  |
| 1     | Entities/state model, exhaustive API contract, keyboard matrix, validation guide                                     | `data-model.md`, `contracts/*`, `quickstart.md`   |
| 2     | (`/speckit-tasks`) shared modules → parts → barrel → tests → demo route → registry → gates                            | `tasks.md`                                        |

## Complexity Tracking

> No Constitution Check violations. The four bespoke behaviours are permitted by Principle IV
> because each carries the written justification above; none is an unjustified violation, so this
> table stays empty.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | none      | —          | —                                      |
