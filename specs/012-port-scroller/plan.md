# Implementation Plan: Scroller

**Branch**: `012-port-scroller` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-port-scroller/spec.md`

## Summary

Port Dice UI's `Scroller` — a plain scroll container that paints a CSS `mask-image` fade on whichever
edge still hides content, optionally hides the native scrollbar, and optionally overlays directional
navigation buttons that scroll by a fixed step on press-and-hold, hover, or click.

Technical approach: one root component (`scroller.svelte`) plus one internal navigation button part
(`scroller-button.svelte`); all measurement and derivation lives in two runes modules —
`scroll-position.svelte.ts` (the reusable, component-agnostic detection layer required by FR-010,
which `scroll-spy` and `tour` in wave 3 will import) and `scroller.svelte.ts` (the `ScrollerState`
class, its `Symbol` context, and the `tv()` variants' inputs). Upstream's imperative
`setAttribute`/`removeAttribute` calls inside a layout effect become `$derived` attribute objects
spread onto the element; the only `$effect` in the component subscribes the container to
scroll/resize and writes the measured metrics, which are not derivable from props.

Two deliberate additions over upstream, both recorded in the spec's Assumptions: direction-awareness
through the existing `direction-provider` (D-01), and keyboard/accessible-name support on the
navigation buttons (D-04/D-05), which upstream leaves unreachable without a pointer.

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`), Svelte 5.56 (runes forced on
repo-wide via `vite.config.ts`), SvelteKit 2

**Primary Dependencies**: `bits-ui` 2.18 (evaluated, not required here — see Principle IV
justification), `tailwind-variants` 3.3 (`tv()` for the orientation/hide-scrollbar and button
direction variants), `@lucide/svelte` 1.27 (`chevron-up/down/left/right`, per `icons.md` the
`iconLibrary` in `components.json` is `lucide`), `clsx` + `tailwind-merge` via `cn()`,
`$lib/components/ui/direction-provider` (first-party, already ported). **Zero new npm dependencies.**

**Storage**: N/A

**Testing**: Vitest 4 (jsdom, `globals: false`, `expect.requireAssertions` on) +
`@testing-library/svelte` 5 + `@testing-library/user-event` 14; setup at `tests/setup.ts` (jest-dom
matchers, `cleanup()`, `ResizeObserver`/`matchMedia`/pointer-capture/`scrollIntoView` shims). A
`scroller.test.svelte` harness carries everything a `.ts` spec cannot express (`child` snippets,
`bind:ref`, a part with no provider, a `<DirectionProvider>` wrapper) — same pattern as
`marquee.test.svelte`.

**Target Platform**: Modern evergreen browsers (CSS `mask-image`, `ResizeObserver`,
`MutationObserver`, pointer events); SSR-safe — every browser API touched is behind a `typeof
window === 'undefined'` guard or inside an `$effect`, which never runs on the server.

**Project Type**: shadcn-svelte registry component (source distribution) inside a SvelteKit docs app.

**Performance Goals**: Edge state recomputes within one frame of a scroll/resize/content change
(SC-003). The scroll listener does no layout writes; it reads six numbers off the element and stores
them, and all six data attributes are `$derived` from that snapshot. The auto-scroll repeat runs at
upstream's 50 ms interval.

**Constraints**: No `any`, no suppression comments, no config loosening (Principle VI); semantic
Tailwind tokens only, no manual `dark:`, no `space-*` (Principle VIII); the component must not import
anything from `src/routes/**` or `src/lib/components/docs/**` (Principle V).

**Scale/Scope**: 1 public component + 1 internal part, 2 runes modules, 1 barrel, ~1 test spec + 1
test harness, 1 demo route with 4 upstream examples + reference tables, 1 registry entry.

## Constitution Check

_GATE: passed before Phase 0 research; re-checked after Phase 1 design (see "Post-design re-check")._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                                                                              |
| ---- | ----------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$props`/`$bindable`/`$state`/`$derived`/`$effect` + snippets only; `ScrollerState` and the detection helpers live in `scroller.svelte.ts` / `scroll-position.svelte.ts` with getter-function inputs. No stores, no `export let`, no `createEventDispatcher`, no slots. |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | `scroller.tsx`, `scroller.mdx`, `types/radix/scroller.ts` and all four `scroller-*-demo.tsx` read at the pinned commit; every prop, default, data attribute and trigger mode reproduced (see Public API). Divergences D-01 (RTL), D-02 (widened observation), D-03 (`data-slot` rename), D-04 (keyboard), D-05 (accessible name/focus ring) and D-06 (`dir` prop) are each recorded as a numbered bullet in the spec's Assumptions section.   |
| III  | Accessibility Is a MUST             | PASS    | Native scroll container (no ARIA widget pattern applies); navigation buttons get `type="button"`, an `aria-label`, `aria-hidden` icons, a focus-visible ring, and Enter/Space + focus-driven auto-scroll (D-04/D-05). RTL inverts the horizontal edges (D-01).          |
| IV   | Composition Over Reimplementation   | PASS    | `scroll-area`, `bits-ui` `ScrollArea` and shadcn `Button` each evaluated and rejected with a written reason below; the remaining bespoke code is the mask-edge detection upstream itself owns.                                                                          |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder `src/lib/components/ui/scroller/`, one part per file, `index.ts` barrel with short names + prefixed aliases + types, one `registry:ui` entry listing all five non-test files, `.js` extensions on intra-repo imports, no docs imports.                       |
| VI   | TypeScript Strict, No Suppressions  | PASS    | All prop types exported from `<script lang="ts" module>`; `WithElementRef<HTMLAttributes<HTMLDivElement>>` for DOM props; `ScrollDirection`/`ScrollerTriggerMode` are string-literal unions; no `any`, no ignore comments, no config edits.                              |
| VII  | Green Gate Before Commit            | PASS    | `pnpm run format` → `check` → `lint` → `test:unit -- --run` → `build` scheduled as the final task; no `.skip`/`.todo`, every `it` asserts.                                                                                                                              |
| VIII | Styling Discipline                  | PASS    | `tv()` variants in the module scripts, caller `class` merged last through `cn()`, `data-slot` on every part, all state exposed as `data-*`. Semantic tokens only (`bg-background`, `text-muted-foreground`, `ring-ring`). See the `data-*="true"` note below.           |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/scroller/+page.svelte` with one `<ComponentPreview>` per upstream demo file (default, horizontal, hidden, navigation) plus props/data-attribute/CSS-variable tables.                                                                        |
| X    | One Feature Directory Per Component | PASS    | All artifacts written under `specs/012-port-scroller/`; no git write commands run at any phase.                                                                                                                                                                        |

**Note on Principle VIII vs Principle II (`data-*` values).** Upstream's mask selectors are
`data-[top-scroll=true]:…`, so the attribute value must be the literal string `"true"`, not `""`.
Principle VIII's actual requirement — the attribute is *absent* when the condition is false so
`data-[…]:` selectors behave — is satisfied by writing `cond ? 'true' : undefined`. Attributes that
upstream does **not** key a selector on (`data-hide-scrollbar`) use the plain `cond ? '' : undefined`
spelling. This is a reconciliation, not a violation, and needs no Complexity Tracking row.

The same reconciliation applies to one attribute *value*: upstream renders `data-slot="scroll-button"` on
the navigation button (`scroller.tsx` L250), while Principle V/VIII require `data-slot="<slug>-<part>"`,
i.e. `data-slot="scroller-button"`. Principle VIII wins on the slot naming; the rename — together with the
attributes upstream emits nowhere (`data-slot="scroller-wrapper"`, `data-orientation`,
`data-hide-scrollbar`, `data-direction`, `data-trigger-mode`) — is recorded as divergence D-03 in the
spec's Assumptions so a consumer's `[data-slot=scroll-button]` selector update is documented rather than
silent.

**Note on `forms.md`.** Reviewed; nothing in it applies — Scroller renders no form control, no
labelled field and no option set. `composition.md` applies only through the `Button` evaluation
above, `icons.md` through the per-icon `@lucide/svelte/icons/chevron-*` imports, and `styling.md`
throughout (see research R-10 for the mask-gradient reading).

**Bespoke behaviour justification (Principle IV)**:

- **Scroll container itself** — `$lib/components/ui/scroll-area` (bits-ui `ScrollArea`) was evaluated
  and rejected: it replaces the native scrollbar with a rendered viewport + custom thumb, so
  `hideScrollbar` becomes meaningless, the consumer's `class` no longer lands on the scrolling box,
  and upstream's `asChild` contract (the horizontal demo scrolls the consumer's own flex row) cannot
  be expressed. Scroller is deliberately a *native* `overflow-auto` element; that is the component.
- **Edge/overflow detection** (`scroll-position.svelte.ts`) — bits-ui exposes no scroll-position or
  overflow-observation primitive (its `ScrollArea` keeps its own measurement private and unexported).
  This is the logic FR-010 requires to be reusable, so it is written once here and exported.
- **Navigation buttons** — `$lib/components/ui/button` was evaluated and rejected: every `Button`
  variant imposes a background/border and `size="icon"` a fixed `size-9` box, which would replace
  upstream's bare chevron-with-opacity-transition appearance (Principle II). A native `<button>` with
  `scrollerButtonVariants` reproduces upstream exactly, plus the focus ring D-05 adds.
- **Auto-scroll repeat** — a 50 ms `window.setInterval` restarted/cleared by an `$effect` teardown,
  matching upstream's `setInterval(onClick, 50)`. No primitive exists for a press-and-hold repeat.
- **Direction resolution** — *not* bespoke: composed from the already-ported
  `direction-provider`'s `useDirection()`, exactly as Marquee and Timeline do.

## Project Structure

### Documentation (this feature)

```text
specs/012-port-scroller/
├── plan.md              # This file
├── research.md          # Phase 0 output — R-01…R-10 decisions
├── data-model.md        # Phase 1 output — entities, derivations, state transitions
├── quickstart.md        # Phase 1 output — how to validate the port end to end
├── contracts/
│   └── public-api.md    # Phase 1 output — exported surface, props, data attributes, module API
├── checklists/
│   └── requirements.md  # from /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/scroller/
├── index.ts                     # barrel: Root/Scroller + types + scroll-position module exports
├── scroller.svelte              # Root — upstream `Scroller` (scroller.tsx L66–275)
├── scroller-button.svelte       # internal nav button — upstream `ScrollButton` (L277–385)
├── scroller.svelte.ts           # ScrollerState + Symbol context + direction/attribute derivations
├── scroll-position.svelte.ts    # FR-010 reusable detection: metrics, overflow, observation
├── scroller.test.svelte         # test harness (child snippets, bind:ref, bare part, RTL provider)
└── scroller.test.ts             # colocated spec

src/routes/docs/components/scroller/
└── +page.svelte                 # 4 <ComponentPreview> sections + props/data-attr/CSS-var tables

registry.json                    # append exactly one registry:ui entry named "scroller"
```

**Structure Decision**

| File                        | Upstream counterpart (`.reference/diceui/docs/registry/bases/radix/ui/scroller.tsx`)                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `scroller.svelte`           | `Scroller` (L66–275) + `scrollerVariants` (L22–47) + the `relative w-full` navigation wrapper (L265–272)             |
| `scroller-button.svelte`    | `ScrollButton` (L306–385) + `scrollButtonVariants` (L277–292) + `directionToIcon` (L294–299)                         |
| `scroller.svelte.ts`        | `ScrollVisibility` state (L84–90), `onScrollBy` (L92–107), `activeDirections` (L224–227), the `DATA_*` keys (L15–20) |
| `scroll-position.svelte.ts` | the measurement half of the `useLayoutEffect` body (L119–214), generalised and de-duplicated per axis                |
| `scroller.test.ts`          | no upstream test file exists for `scroller` (verified) — the MDX prop table + source are the contract instead        |

The demo route segment (`scroller`), the folder slug (`scroller`) and the registry item name
(`scroller`) are identical, as Principle V and IX require. `scroller-button.svelte` is a file but not
a barrel export (spec Assumption: upstream's `ScrollButton` is unexported and undocumented); it is
still listed in the registry entry because it is a file of the component folder.

## Public API

Derived from `scroller.tsx` and `.reference/diceui/docs/types/radix/scroller.ts`. Full JSDoc text
lives in [contracts/public-api.md](./contracts/public-api.md); upstream's `@default` tags are copied
verbatim onto the Svelte prop types.

### `Scroller.Root` — `scroller.svelte` (aliases: `Root`, `Scroller`; type `ScrollerRootProps`, alias `ScrollerProps`)

| Prop                | Type                                             | Default          | Bindable | Upstream                                    |
| ------------------- | ------------------------------------------------ | ---------------- | -------- | ------------------------------------------- |
| `ref`               | `HTMLDivElement \| null`                         | `null`           | **yes**  | `ref` (`useComposedRefs`)                   |
| `orientation`       | `'vertical' \| 'horizontal'`                     | `'vertical'`     | no       | `orientation`                               |
| `hideScrollbar`     | `boolean`                                        | `false`          | no       | `hideScrollbar`                             |
| `size`              | `number`                                         | `40`             | no       | `size` → `--scroll-shadow-size`             |
| `offset`            | `number`                                         | `0`              | no       | `offset`                                    |
| `withNavigation`    | `boolean`                                        | `false`          | no       | `withNavigation`                            |
| `scrollStep`        | `number`                                         | `40`             | no       | `scrollStep`                                |
| `scrollTriggerMode` | `'press' \| 'hover' \| 'click'`                  | `'press'`        | no       | `scrollTriggerMode`                         |
| `dir`               | `'ltr' \| 'rtl' \| undefined`                    | `undefined`      | no       | **addition D-01** (resolved via provider)   |
| `class`             | `string \| undefined \| null`                    | —                | no       | `className` (merged last)                   |
| `style`             | `string \| undefined \| null`                    | —                | no       | `style` (appended after the custom property) |
| `...restProps`      | `HTMLAttributes<HTMLDivElement>`                 | —                | —        | `...scrollerProps`                          |

**Snippets**: `children?: Snippet` (default content); `child?: Snippet<[{ props: ScrollerChildProps }]>`
— replaces upstream's `asChild`, and unlike Marquee's `child` it stays fully functional: the props
object carries a Svelte **attachment** (`createAttachmentKey()` from `svelte/attachments`) so the
consumer's element is still registered for measurement and scrolling when they spread `{...props}`
(research R-05). Upstream's horizontal demo uses `asChild`, so this path must work, not degrade.

**Callbacks/events**: upstream declares none. Scroller has **no value-bearing prop**, so there is no
`onValueChange` and no controlled/uncontrolled pair; DOM handlers (`onscroll`, `onpointerdown`, …)
pass through `restProps` and compose with the component's own listener rather than replacing it. The
constitution's controlled/uncontrolled test axis maps here to: `bind:ref` (two-way), `child`-mode
attachment, and restProps forwarding — stated so `/speckit-analyze` does not read the absence of an
`onValueChange` test as a gap.

**Rendered data attributes** (root element): `data-slot="scroller"`, `data-orientation`,
`data-hide-scrollbar`, `dir`, and the six upstream scroll-state attributes
(`data-top-scroll`, `data-bottom-scroll`, `data-top-bottom-scroll`, `data-left-scroll`,
`data-right-scroll`, `data-left-right-scroll`, each `"true"` or absent). When `withNavigation` is
set, the wrapper `<div>` carries `data-slot="scroller-wrapper"`.

### `scroller-button.svelte` (internal — not exported from the barrel; type `ScrollerButtonProps` is exported for typing only)

| Prop           | Type                                   | Default | Bindable | Upstream                        |
| -------------- | -------------------------------------- | ------- | -------- | ------------------------------- |
| `ref`          | `HTMLButtonElement \| null`            | `null`  | **yes**  | `ref`                           |
| `direction`    | `'up' \| 'down' \| 'left' \| 'right'`  | —       | no       | `direction` (required)          |
| `class`        | `string \| undefined \| null`          | —       | no       | `className`                     |
| `...restProps` | `HTMLButtonAttributes`                 | —       | —        | `...buttonProps`                |

Trigger mode, scroll step and the scroll action are read from `ScrollerState` on context, not passed
as props (upstream passes `onClick`/`triggerMode` down; context is the Svelte-idiomatic equivalent
and gives the required "used outside its provider" guard rail). Renders
`data-slot="scroller-button"`, `data-direction`, `data-trigger-mode`, `aria-label`, and a
`aria-hidden` Lucide chevron.

### Module exports (`scroller.svelte.ts`, `scroll-position.svelte.ts`) — all re-exported from `index.ts`

`ScrollerState`, `setScrollerContext`, `getScrollerContext`, `SCROLLER_ORIENTATIONS`,
`SCROLLER_TRIGGER_MODES`, `SCROLL_DIRECTIONS`, `AUTO_SCROLL_INTERVAL`, `DEFAULT_*` constants, and the
reusable detection layer: `readScrollMetrics`, `EMPTY_SCROLL_METRICS`, `computeAxisOverflow`,
`observeScrollPosition`, `ScrollPositionState`, plus types `ScrollMetrics`, `ScrollAxis`,
`AxisOverflow`, `ScrollerOrientation`, `ScrollerTriggerMode`, `ScrollDirection`, `ScrollerStateProps`.

## Deliverables & sequencing

Written here so `/speckit-tasks` has an unambiguous ordering (each line is independently verifiable):

1. **`scroll-position.svelte.ts`** (FR-010) — pure functions first (`readScrollMetrics`,
   `computeAxisOverflow`), then `observeScrollPosition`, then the optional `ScrollPositionState`
   wrapper. No imports from the rest of the component: this is the module `scroll-spy` and `tour`
   will import in wave 3, so it must stand alone. Exported from `index.ts`; wave-3 components will
   declare `registryDependencies: ["scroller"]` rather than the module becoming its own registry item
   (spec Assumption).
2. **`scroller.svelte.ts`** — `ScrollerState` (config getters + `metrics` + derived edge attributes,
   navigation visibility, active directions, `scrollByStep`), the `Symbol` key, and the
   `getScrollerContext(consumerName)` helper that throws
   `` `scroller-button.svelte` must be used within `<Scroller.Root>`. `` — naming the file rather than
   `<Scroller.Button>`, since the button part is deliberately not exported from the barrel
3. **`scroller.svelte`** — `scrollerVariants` via `tv()`, prop types + JSDoc, the single `$effect`
   that wires `observeScrollPosition`, the `child` attachment, the navigation wrapper.
4. **`scroller-button.svelte`** — `scrollerButtonVariants`, the three trigger modes, the interval
   with `$effect` teardown, keyboard/focus parity (D-04), `aria-label` (D-05).
5. **`index.ts`** — barrel per §3 of `CLAUDE.md`.
6. **`scroller.test.svelte` + `scroller.test.ts`** — coverage matrix in
   [quickstart.md](./quickstart.md#test-coverage-matrix).
7. **`src/routes/docs/components/scroller/+page.svelte`** — four previews + tables.
8. **`registry.json`** entry, then `pnpm run registry:build`.
9. **Quality gates**: `pnpm run format` → `check` → `lint` → `test:unit -- --run` → `build`.

## Post-design re-check (after Phase 1)

Re-evaluated against the finished contracts: all ten principles still **PASS**. The design added
three things after the initial gate — the `createAttachmentKey()` bridge for `child` mode (Principle
I: plain Svelte 5, no new dependency; Principle II: makes `asChild` parity real rather than
degraded), the context-based button wiring (Principle III: supplies the "outside its provider"
guard-rail assertion), and the `data-*="true"` reconciliation noted above (Principle VIII). None
introduces a violation, so **Complexity Tracking stays empty**.

One spec-wording refinement surfaced during design and is resolved in favour of upstream (Principle
II): spec Edge Cases says the `offset` gates both edge cues *and* navigation buttons, but upstream
applies `offset` to the leading cue and the leading button (`scrollTop > offset`), to the trailing
cue (`scrollTop + clientHeight + offset < scrollHeight`), and **not** to the trailing button
(`scrollTop + clientHeight < scrollHeight`). The port reproduces upstream exactly; see research R-03
and data-model "Derivation table". Tests assert the asymmetry deliberately.

## Complexity Tracking

> No Constitution Check violations. This table is intentionally empty.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | —         | —          | —                                      |
