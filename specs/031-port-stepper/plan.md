# Implementation Plan: Port Stepper

**Branch**: `031-port-stepper` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/031-port-stepper/spec.md`

**Upstream pin**: `sadmann7/diceui @ d9763d82530416dfa4c81c462387b55d06bae4ec`

## Summary

Port Dice UI's React `Stepper` — an eleven-part compound component that guides a user through a
multi-step process — to Svelte 5 runes, shipped as a shadcn-svelte registry item.

Upstream's machinery (`useSyncExternalStore` store, `useLazyRef`, `useAsRef`, `useComposedRefs`,
`useIsomorphicLayoutEffect`) exists to work around React's re-render model and is **translated, not
transliterated**: it collapses into three state classes in one `stepper.svelte.ts` module —
`StepperRootState` (step registry, value, validation), `StepperItemState` (per-item derivation) and
`StepperFocusState` (roving tabindex). Reactive inputs arrive as getter functions; `value` is a
single `$bindable` read directly, with no mirror `$state`, which is what makes controlled mode
authoritative.

Two behaviours are **composed rather than rewritten**: the document-ordered trigger registry is
`speed-dial`'s exported `DomOrderedCollection`, and the pure roving-focus helpers (`focusFirst`,
`wrapArray`, `getDirectionAwareKey`) come from `action-bar`'s roving-focus module. The group *state*
is bespoke, justified below. Direction resolution uses this repo's `direction-provider`; `asChild`
becomes the `child` snippet; the indicator's `ReactNode | render-fn` union becomes one
`Snippet<[StepperDataState]>`.

Deliverables: 15 files (13 registry files + 2 test files) under `src/lib/components/ui/stepper/`, a
colocated test file porting all 18 upstream assertions plus the Constitution §7 additions, a demo
route with one section per upstream demo (**four**, not three), and one `registry.json` entry.

## Technical Context

**Language/Version**: TypeScript 5 (strict, `verbatimModuleSyntax`), Svelte 5 (runes forced on in
`vite.config.ts`), SvelteKit 2

**Primary Dependencies**: `bits-ui`, `@lucide/svelte` (the `Check` icon), `tailwind-variants`
(orientation variants), Tailwind CSS v4. **Zero new npm dependencies** — every package this port
touches is already in `package.json`.

**Internal dependencies**: `$lib/components/ui/direction-provider` (`useDirection`),
`$lib/components/ui/speed-dial` (`DomOrderedCollection`), `$lib/components/ui/action-bar`
(`focusFirst`, `wrapArray`, `getDirectionAwareKey`), `$lib/utils.js` (`cn`, `WithElementRef`)

**Storage**: N/A — no persistence

**Testing**: Vitest (jsdom, `globals: false`, `expect.requireAssertions`) +
`@testing-library/svelte` + `@testing-library/user-event`, colocated at
`src/lib/components/ui/stepper/stepper.test.ts` with a `stepper.test.svelte` prop-driven harness

**Target Platform**: Browsers (SSR-safe: no DOM access outside `$effect`); Node 20+ for the toolchain

**Project Type**: Component library distributed as a shadcn-svelte registry (source, not a package)

**Performance Goals**: No per-frame work. The trigger collection sorts once per structural change
(`DomOrderedCollection`), not per keystroke; `data-state` derivation is O(n) over `stepKeys` per
part, matching upstream's `Array.from(steps.keys()).indexOf(...)`.

**Constraints**: No `any`, no suppression comments, no config loosening; semantic Tailwind tokens
only; no imports from `src/routes/**` or `src/lib/components/docs/**` into the component; no git
write commands; no watch-mode or dev-server invocations.

**Scale/Scope**: 11 exported parts, 3 contexts, 3 state classes, 3 pure helpers, ~14 files,
4 demo sections, 1 registry entry.

**Unknowns**: none. Every open question from the spec was resolved in Phase 0 — see
[research.md](./research.md) R-01 … R-14.

## Constitution Check

_GATE: passed before Phase 0 research; re-checked after Phase 1 design — verdicts unchanged._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                   |
| ---- | ----------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$effect`/`$props`/`$bindable` + snippets only; all reactive logic in `stepper.svelte.ts` state classes taking getter-function inputs. No stores, no `export let`, no `createEventDispatcher`, no `<slot>`. |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | Source, types file, MDX, test file and all four demos read at the pinned commit. Every documented prop, callback, data attribute, ARIA attribute and key is in [`contracts/public-api.md`](./contracts/public-api.md). Four divergences recorded in `spec.md` Assumptions; upstream JSDoc incl. `@default` copied onto every prop. |
| III  | Accessibility Is a MUST             | PASS    | WAI-ARIA Tabs pattern: `tablist`/`tab`/`tabpanel`, `aria-orientation`, `aria-selected`, `aria-current="step"`, `aria-posinset`/`aria-setsize`, `aria-controls`/`aria-labelledby`, roving tabindex. Keyboard map ported key-for-key incl. `PageUp`/`PageDown`; RTL inverts the horizontal arrows. Tests cover all six §7 areas. |
| IV   | Composition Over Reimplementation   | PASS    | `DomOrderedCollection` (speed-dial), `focusFirst`/`wrapArray`/`getDirectionAwareKey` (action-bar), `useDirection` (direction-provider) composed as-is. One bespoke class, justified below. |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder, one part per file, `stepper.svelte.ts`, `index.ts` barrel with short names + prefixed aliases + types, `.js` extensions on every intra-repo import, one `registry:ui` entry listing all 13 non-test files. No import from `src/routes/**` or `src/lib/components/docs/**`. |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Props types in `<script lang="ts" module>` deriving from `WithElementRef<HTMLAttributes<…>>`; no `any`, no `@ts-*`, no `eslint-disable`, no `svelte-ignore`, no config edits. |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit --run` → `build` scheduled as Phase 6; no skipped or `.todo` tests. Three upstream assertions tightened with a stated reason (research R-14). |
| VIII | Styling Discipline                  | PASS    | `cn()` everywhere, `tv()` for the four orientation-varying parts, caller `class` merged last, `data-slot="stepper-<part>"` on all eleven, boolean data attrs as `? '' : undefined`. Upstream's classes are already semantic (`primary`/`muted`/`background`/`border`) — no status-colour remap needed. |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/stepper/+page.svelte` with **four** `<ComponentPreview>` sections, one per upstream demo file, plus per-part props tables. No `+page.ts`. |
| X    | One Feature Directory Per Component | PASS    | All planning output under `specs/031-port-stepper/`. No git write commands; no edits to `.port-state.json`, `.port-logs/**`, `scripts/**`, `.specify/scripts/**` or `.reference/**`. |

**Bespoke behaviour justification (Principle IV)**

One class is hand-written: **`StepperFocusState`** (the roving-focus group in `stepper.svelte.ts`).

- **Primitive evaluated**: `RovingFocusGroupState` in
  `src/lib/components/ui/action-bar/action-bar-roving-focus.svelte.ts`.
- **Capabilities it lacks** (research R-04, verified against the source):
  1. **Validation-gated navigation.** Its `navigate()` terminates in
     `queueMicrotask(() => focusFirst(candidates))` and never exposes the candidate list. Stepper
     must resolve `candidates[0]` back to a step value, `await onValidate`, and *cancel the focus
     move* when validation fails (upstream `stepper.tsx:882-912`). The toolbar class cannot express
     a focus move that an `await` may veto.
  2. **Selection-priority entry focus.** Stepper's entry-focus candidate order is
     `[selectedItem, activeItem, currentItem, ...items]` (`stepper.tsx:499-515`) — the trigger of
     the *current step value* is tried first. The toolbar class only knows `tabStopId`
     (`action-bar-roving-focus.svelte.ts:186-193`) and has no concept of a selected value.
  3. **`PageUp` / `PageDown`.** Stepper maps them to `first`/`last` (`stepper.tsx:57-66`); the
     toolbar's `getFocusIntent` does not. Adding them there would silently change `action-bar` and
     `selection-toolbar` behaviour and break *their* upstream parity.
- **Why the shared module is not extended instead**: editing a shipped registry component that two
  other ported components depend on is a parity risk this port does not need to take. The three
  genuinely component-agnostic helpers in that module (`focusFirst`, `wrapArray`,
  `getDirectionAwareKey`) **are** imported unchanged, so the duplication is confined to the group
  state itself.
- **`bits-ui` evaluated and rejected**: it exposes no standalone roving-focus-group primitive, and
  its `Tabs` primitive hard-codes activation with no `onValidate` hook, no `completed` step state and
  no `nonInteractive` mode.

**Recorded divergences from upstream** (all four also appended to `spec.md` Assumptions):

| # | Upstream                                             | Here                                                        | Reason                                                                 |
| - | ---------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1 | `data-slot="title"` / `"description"`                | `"stepper-title"` / `"stepper-description"`                 | Principle VIII; the bare names collide with `card`/`alert`/`empty`. The trigger's two `not-has-data-[slot=…]` selectors are updated in step, so rendering is identical. |
| 2 | `setStateWithValidation` writes the awaited result unconditionally | A generation counter drops a stale result           | Spec Edge Case 4. Can only suppress a write against a value the consumer has already replaced — never enables a move upstream would block. |
| 3 | `StepperSeparatorProps` has no members in the types file | `forceMount?: boolean` ported                            | It exists in the source (`stepper.tsx:1028-1030, 1052`) and FR-017 requires it; the types file omits it. Source wins. |
| 4 | `export { useStore as useStepper }`                  | not exported; `getStepperContext()` is                      | An internal store selector with no documented API surface (already in `spec.md` Assumptions). |

**Deliberate parity choice, not a divergence**: the trigger keeps upstream's unconditional
`aria-describedby="<titleId> <descriptionId>"` even when no Title/Description renders. The IDREFs are
stable and become live the moment those parts mount; dangling IDREFs are ignored by browsers and do
not affect the accessible name, which comes from the trigger's contents (research R-11).

## Project Structure

### Documentation (this feature)

```text
specs/031-port-stepper/
├── plan.md                    # This file
├── spec.md                    # Input
├── research.md                # Phase 0 — R-01 … R-14
├── data-model.md              # Phase 1 — entities, contexts, state transitions
├── quickstart.md              # Phase 1 — runnable validation guide
├── contracts/
│   └── public-api.md          # Phase 1 — every part, prop, snippet, callback
├── checklists/
│   └── requirements.md        # From /speckit-specify
└── tasks.md                   # Phase 2 — NOT created by /speckit-plan
```

### Source Code (repository root)

```text
src/lib/components/ui/stepper/
├── index.ts                       # barrel: short names + prefixed aliases + prop types + state exports
├── stepper.svelte                 # Root      ← stepper.tsx:229-377
├── stepper-list.svelte            # List      ← stepper.tsx:402-585
├── stepper-item.svelte            # Item      ← stepper.tsx:610-673
├── stepper-trigger.svelte         # Trigger   ← stepper.tsx:675-980
├── stepper-indicator.svelte       # Indicator ← stepper.tsx:986-1026
├── stepper-separator.svelte       # Separator ← stepper.tsx:1032-1082
├── stepper-title.svelte           # Title     ← stepper.tsx:1088-1108
├── stepper-description.svelte     # Descr.    ← stepper.tsx:1114-1134
├── stepper-content.svelte         # Content   ← stepper.tsx:1141-1173
├── stepper-prev.svelte            # Prev      ← stepper.tsx:1175-1216
├── stepper-next.svelte            # Next      ← stepper.tsx:1218-1259
├── stepper.svelte.ts              # 3 state classes + 3 Symbol contexts + 3 pure helpers
│                                  #           ← stepper.tsx:47-227, 379-400, 587-608
├── stepper.test.ts                # colocated spec  (NOT in registry.json)
└── stepper.test.svelte            # prop-driven harness (NOT in registry.json)

src/routes/docs/components/stepper/
└── +page.svelte                   # 4 <ComponentPreview> + props tables

registry.json                      # append exactly one registry:ui entry
```

**Structure Decision**: Eleven parts, one file each, named `stepper-<part>.svelte` with the root at
`stepper.svelte` — a 1:1 map onto the eleven functions upstream exports, as tabulated above.
Upstream's `getId`, `getDataState`, `getFocusIntent`, `MAP_KEY_TO_FOCUS_INTENT`, the `Store`, and the
three context definitions have no markup, so they all land in `stepper.svelte.ts`. Upstream's
`focusFirst` and `wrapArray` are **not** re-created — they are imported from `action-bar`.

Slug consistency: folder `stepper` = registry item `stepper` = demo route segment
`/docs/components/stepper`. Two test files are excluded from the registry entry; `stepper.test.svelte`
is not collected by Vitest (its `include` is `src/**/*.{test,spec}.{js,ts}`) and exists because
`useDirection()` and `bind:value` need a real parent component (the `direction-provider` and
`checkbox-group` precedent).

## Implementation Phases

| Phase | Work                                                                                                                                                   | Files                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| 1     | `stepper.svelte.ts`: value types, `getStepperId`, `getStepperDataState`, `getStepperFocusIntent`, `StepperRootState`, `StepperItemState`, `StepperFocusState`, three Symbol contexts + throwing getters | 1 file  |
| 2     | Root, List, Item — context publication, step registration, roving-focus group, `tv()` orientation variants                                              | 3 files                                                   |
| 3     | Trigger — ARIA block, roving registration, the four event handlers, validation-gated arrow navigation                                                    | 1 file                                                    |
| 4     | Indicator, Separator, Title, Description, Content, Prev, Next                                                                                            | 7 files                                                   |
| 5     | `index.ts` barrel; `stepper.test.svelte` harness; `stepper.test.ts` (18 ported + §7 additions, see [quickstart.md](./quickstart.md) S-1…S-7)             | 3 files                                                   |
| 6     | Demo route (4 sections + props tables); `registry.json` entry; `pnpm run registry:build`; the four quality gates                                          | 2 files + generated `static/r/stepper.json`               |

**Registry entry** to append:

```jsonc
{
	"name": "stepper",
	"type": "registry:ui",
	"title": "Stepper",
	"description": "A component that guides users through a multi-step process with clear visual progress indicators.",
	"registryDependencies": ["direction-provider", "speed-dial", "action-bar"],
	"dependencies": ["@lucide/svelte", "tailwind-variants"],
	"files": [ /* the 13 non-test files above, each "type": "registry:ui" */ ]
}
```

`registryDependencies` follows the convention already set by `segmented-input` and `time-picker`,
which both list `speed-dial` because they import `DomOrderedCollection`. `button` is **not** a
dependency: `Stepper.Prev`/`Stepper.Next` render unstyled `<button>` elements exactly as upstream
does — the demo page composes `Button` through the `child` snippet, and demo files are not part of
the registry entry.

**Demo sections** (Principle IX — one per upstream demo file):

| Section       | Upstream                     | Shows                                                                                  |
| ------------- | ---------------------------- | -------------------------------------------------------------------------------------- |
| Default       | `stepper-demo.tsx`           | Horizontal, indicator-only triggers, per-step content                                  |
| Vertical      | `stepper-vertical-demo.tsx`  | `orientation="vertical"`, title + description, absolutely positioned separator          |
| With Validation | `stepper-validation-demo.tsx` | Controlled `bind:value` + `onValidate` gating forward moves, `Prev`/`Next` via `child` |
| With Form     | `stepper-form-demo.tsx`      | Multi-step form using `Field`/`Input`/`Textarea` + a local validator (spec Assumptions) |

## Complexity Tracking

> No Constitution Check violations. `StepperFocusState` is bespoke *within* Principle IV, which
> permits bespoke behaviour that carries a written justification — supplied above — so it is not a
> violation and is not tracked here.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | none      | —          | —                                      |
