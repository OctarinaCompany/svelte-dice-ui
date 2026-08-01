# Implementation Plan: Port Mention Component

**Branch**: `042-port-mention` | **Date**: 2026-08-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/042-port-mention/spec.md`

## Summary

Port Dice UI's **Mention** (`.reference/diceui/packages/mention`, pinned commit
`d9763d82530416dfa4c81c462387b55d06bae4ec`) to Svelte 5 as `src/lib/components/ui/mention/`: a text
field that opens a caret-anchored, filterable option list when a trigger character (`@` by default)
is typed at a word boundary, splices the chosen item's label into the text, and thereafter treats each
inserted mention as an atomic unit of text kept in sync with a structured value list.

Technical approach: six public parts plus one internal highlighter, a `MentionRootState` class in
`mention.svelte.ts` holding all reactive behaviour, and a rune-free `mention-caret.ts` holding the
pure caret geometry and span algebra. Positioning, portalling, dismissal and scroll locking are
composed from `bits-ui`'s `Popover` layer, driven by a **virtual anchor** (`customAnchor` accepts
`Measurable = { getBoundingClientRect(): DOMRect }`) computed at the caret. Filtering reuses the
already-ported `ComboboxFilterStore` / `scoreItem` from `combobox`; direction resolution reuses
`direction-provider`; form participation reuses `checkbox-group`'s `FormControlState`. Bespoke code is
confined to trigger detection, caret geometry, mention-span algebra and the `data-tag` highlighter —
each justified below. **Zero new npm dependencies.**

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`), Svelte 5.56 with runes forced on
repo-wide (`vite.config.ts`)

**Primary Dependencies**: `bits-ui@^2.18.1` (Popover: floating layer, portal, dismissible layer,
scroll lock), `clsx`/`tailwind-merge` via `cn()`, Tailwind CSS v4 semantic tokens. Existing in-repo
components: `combobox` (filter store), `direction-provider` (`useDirection`, `Direction`),
`checkbox-group` (`FormControlState`). **No new npm dependency** — see research R-16.

**Storage**: N/A

**Testing**: Vitest (jsdom, `globals: false`, `expect.requireAssertions`) +
`@testing-library/svelte` + `@testing-library/user-event`, colocated at
`src/lib/components/ui/mention/mention.test.ts` with a `mention.test.svelte` harness for
compositions a `.ts` spec cannot express (`bind:`, function bindings, `<form>`, snippets, bare parts).

**Target Platform**: SvelteKit 2 web app + shadcn-svelte registry consumers (source distribution)

**Project Type**: UI component library (shadcn-svelte registry item, `type: registry:ui`)

**Performance Goals**: No dropped frames while typing. Filtering scores in 250-item batches
(inherited from the reused filter store). Caret measurement is one off-screen `<span>` per caret
update; the highlighter re-renders only its segment list.

**Constraints**: No `any`, no suppressions, no Svelte 4 idioms, no `shadcn-svelte add` mid-port, no
docs-app imports from the component folder, no git write commands, no files outside this feature
directory and `src/lib/components/ui/mention/`, `src/routes/docs/components/mention/`,
`registry.json`.

**Scale/Scope**: 10 source files + 2 test files, 6 public parts + 1 internal part, ~35 root props/
callbacks across the API, 3 demo sections, 1 registry entry.

**Unknowns**: none. Every open question raised while reading the upstream source was resolved during
Phase 0 and recorded in [research.md](./research.md) (R-01 … R-16). No unresolved-clarification
marker remains in any artifact of this feature.

## Constitution Check

_GATE: passed before Phase 0 research; re-checked after Phase 1 design (see the second table)._

### Initial check (pre-research)

| #    | Principle                           | Verdict | Evidence                                                                                                                       |
| ---- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| I    | Svelte 5 Runes Only                 | PASS    | All reactive logic in `mention.svelte.ts` (`$state`, `$state.raw`, `$derived`, `$derived.by`, `$effect` with teardown); snippets only; no stores, `export let`, `createEventDispatcher` or `<slot>` |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | All 8 upstream source files, the test file and the MDX read at the pinned commit; every prop, callback, data attribute and key mapped in [contracts/public-api.md](./contracts/public-api.md); 11 divergences recorded (D-1 … D-11) and mirrored in the spec's Assumptions |
| III  | Accessibility Is a MUST             | PASS    | APG combobox-with-listbox pattern: `role=combobox` + `aria-expanded`/`aria-controls`/`aria-autocomplete`/`aria-activedescendant`, `role=listbox`, `role=option` + `aria-selected`, `label` `for`/`id`; full key map in the contract; RTL mirrors `align`; all six required test areas planned in Phase 3 |
| IV   | Composition Over Reimplementation   | PASS    | `bits-ui` `Popover.{Root,Portal,Content}` for positioning/portal/dismiss/scroll-lock; `combobox`'s filter store; `direction-provider`; `checkbox-group`'s `FormControlState`. Four bespoke areas justified below |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder, one part per file, `<slug>-<part>.svelte`, `mention.svelte.ts`, `index.ts` barrel with short names + prefixed aliases + types, `.js` import extensions, one `registry:ui` entry, no docs-app imports |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Props types exported from `<script lang="ts" module>`, `WithElementRef<HTMLAttributes<…>>`, no `any`, no ignore comments, no config edits |
| VII  | Green Gate Before Commit            | PASS    | The five commands scheduled as the final phase task; no `.skip`/`.todo`; every `it` asserts |
| VIII | Styling Discipline                  | PASS    | `cn()` only (no variants → no `tv()`), semantic tokens only, `data-slot` on every part, boolean `data-*` as `cond ? '' : undefined`, no manual `z-index` (Popover owns stacking), no `dark:`, no `space-*` |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/mention/+page.svelte` with one `<ComponentPreview>` per upstream demo (3) plus API reference tables |
| X    | One Feature Directory Per Component | PASS    | All planning artifacts under `specs/042-port-mention/`; no git write commands; no protected paths touched |

**Bespoke behaviour justification (Principle IV)** — four areas, each naming the primitive evaluated
and the capability it lacks:

1. **Caret geometry → virtual anchor** (`mention-caret.ts`). Evaluated: `bits-ui` `Popover.Content`
   with `customAnchor`, and `Popover.Anchor`. Both anchor to an *element*; neither can report the
   position of a caret **inside** an `<input>`/`<textarea>`, because those have no selectable DOM
   `Range`. Only the "where is the caret" measurement is written here — the resulting `Measurable`
   object is handed straight to `customAnchor`, so all floating/flip/shift/collision/tracking work is
   still the primitive's (research R-01).
2. **Trigger detection** (`resolveMentionTrigger` in `mention-caret.ts`). Evaluated: `bits-ui`
   `Combobox`, the in-repo `combobox` port, and `command`. All three filter a dedicated input's whole
   value; none parses a *substring* of free-form prose for a trigger character at a word boundary
   while excluding already-inserted spans. Six-condition rule stated in research R-15.
3. **Mention-span algebra** (`addMentionSpan` / `removeMentionSpans` / `shiftMentionSpans`).
   Evaluated: `tags-input` (a value list with no text offsets) and `editable`. Neither tracks
   character offsets that must survive arbitrary text edits. Pure functions, unit-testable directly.
4. **The `data-tag` highlighter** (`mention-highlighter.svelte`). Evaluated: nothing in `bits-ui` or
   `src/lib/components/ui/*` draws a style-synchronised overlay behind a text field. Required because
   the MDX documents `data-tag` as the root's styling API. Its `ResizeObserver`, `MutationObserver`,
   `scroll` and `resize` hookups live in one `$effect` whose teardown disconnects all four.

Everything else — floating position, portal, dismissal, outside-press, scroll lock, direction
resolution, fuzzy/exact/custom filtering and scoring, form-control detection — is composed.

### Post-design re-check (after Phase 1)

| #    | Principle                           | Verdict | Post-design evidence                                                                                                          |
| ---- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| I    | Svelte 5 Runes Only                 | PASS    | Design has no `useMemo`/`useCallback` residue; the one place upstream mutates state from a callback (`filterStore.onCallback`) becomes a synchronous read of a `$derived` filter store, so no `$effect` writes state it reads |
| II   | Upstream Parity                     | PASS    | Contract enumerates all 20 root props, 6 parts, 13 data attributes, 5 CSS variables and 13 key bindings against upstream line references; no undocumented drift |
| III  | Accessibility                       | PASS    | Test plan (Phase 3) covers roles/ARIA, the full key set, uncontrolled, controlled, RTL and guard rails; jsdom's layer-visibility limitation is handled by `data-slot` queries **without** dropping any role assertion |
| IV   | Composition                         | PASS    | Bespoke surface did not grow during design: still the four areas above; `Measurable` compatibility with `customAnchor` verified against `bits-ui@2.18.1` type declarations |
| V    | Distribution                        | PASS    | File list below is final; `registry.json` entry lists all 10 non-test files; slug == folder == route == registry name == `mention` |
| VI   | TypeScript Strict                   | PASS    | Every exported type named in the contract; the `child` snippet's props type (`MentionInputChildProps`) is explicit, so no `any` is needed to spread onto a `<textarea>` |
| VII  | Green Gate                          | PASS    | Final phase runs all five commands; the caret math's jsdom degradation is asserted structurally rather than skipped |
| VIII | Styling Discipline                  | PASS    | `data-slot`/`data-*` table finalised in [data-model.md](./data-model.md) §7; the demo's `data-tag` styling uses `bg-info/15 text-info` semantic tokens instead of upstream's `bg-blue-200 text-blue-950` |
| IX   | Documentation                       | PASS    | Three `<ComponentPreview>` sections, one per upstream demo file, plus per-part props tables, a data-attribute table and a keyboard table (the `listbox`/`combobox` docs-page shape) |
| X    | One Feature Directory               | PASS    | Artifacts written: `plan.md`, `research.md`, `data-model.md`, `contracts/public-api.md`, `quickstart.md` — all inside `specs/042-port-mention/` |

No principle is violated, so **Complexity Tracking is empty**.

## Public API

Full field-by-field contract, with upstream line references, lives in
[`contracts/public-api.md`](./contracts/public-api.md). Summary:

### `Mention.Root` (`mention.svelte`) — aliases `Mention`, `MentionRoot`

| Prop | Type | Default | Bindable |
| ---- | ---- | ------- | -------- |
| `value` | `string[]` | `defaultValue` | **yes** |
| `defaultValue` | `string[]` | `[]` | no |
| `onValueChange` | `(value: string[]) => void` | — | no |
| `open` | `boolean` | `defaultOpen` | **yes** |
| `defaultOpen` | `boolean` | `false` | no |
| `onOpenChange` | `(open: boolean) => void` | — | no |
| `inputValue` | `string` | `''` | **yes** |
| `onInputValueChange` | `(value: string) => void` | — | no |
| `trigger` | `string` | `'@'` | no |
| `dir` | `'ltr' \| 'rtl'` | provider → DOM → `'ltr'` | no |
| `disabled` | `boolean` | `false` | no |
| `onFilter` | `(options: string[], term: string) => string[]` | — | no |
| `exactMatch` | `boolean` | `false` | no |
| `loop` | `boolean` | `false` | no |
| `modal` | `boolean` | `false` | no |
| `readonly` | `boolean` | `false` | no |
| `required` | `boolean` | `false` | no |
| `name` | `string` | — | no |
| `id` | `string` | `$props.id()` | no |
| `ref` | `HTMLDivElement \| null` | `null` | **yes** |

Snippets: `children`. Callbacks: `onValueChange`, `onOpenChange`, `onInputValueChange`, `onFilter`.

### `Mention.Label` (`mention-label.svelte`)

`WithElementRef<HTMLLabelAttributes, HTMLLabelElement>`; `ref` bindable; snippet `children`; no
callbacks. Renders `<label id={labelId} for={inputId}>`.

### `Mention.Input` (`mention-input.svelte`)

`WithElementRef<Omit<HTMLInputAttributes, 'dir' | 'value'>, HTMLInputElement | HTMLTextAreaElement>`
plus `child?: Snippet<[{ props: MentionInputChildProps }]>`; `ref` bindable (also in `child` mode,
through an attachment carried in `props`). Composes caller handlers for `oninput`, `onbeforeinput`,
`onclick`, `oncut`, `onfocus`, `onkeydown`, `onpaste`, `onpointerdown`, `onselect`.

### `Mention.Portal` (`mention-portal.svelte`)

`to?: Element | string` (default `document.body`, upstream `container`), `disabled?: boolean`
(default `false`); snippet `children`.

### `Mention.Content` (`mention-content.svelte`)

`side` `'bottom'`, `sideOffset` `4`, `align` `'start'`, `alignOffset` `0`, `arrowPadding` `0`,
`collisionBoundary`, `collisionPadding` `0`, `sticky` `'partial'`, `strategy` `'absolute'`,
`avoidCollisions` `true`, `fitViewport` `false`, `forceMount` `false`, `hideWhenDetached` `false`,
`trackAnchor` `true`, `onEscapeKeyDown`, `onPointerDownOutside`; `ref` bindable; snippet `children`.

### `Mention.Item` (`mention-item.svelte`)

`value: string` (required, non-empty), `label?: string` (default `value`), `disabled?: boolean`
(default `false`); `ref` bindable; snippet `children`; no callbacks.

### Shared modules exported for later reuse (deliverable 5)

`mention-caret.ts` is deliberately **rune-free** so any later caret-anchored component can import it
without a reactive context: `measureTextWidth`, `getLineHeight`, `getCaretRect`, `createCaretAnchor`,
`resolveMentionTrigger`, `addMentionSpan`, `removeMentionSpans`, `shiftMentionSpans`, and the types
`MentionSpan`, `TriggerMatch`, `CaretAnchor`. `mention.svelte.ts` exports `MentionRootState`,
`MentionCollection`, `setMentionContext`, `getMentionContext` and their types. Both are re-exported
from `index.ts`.

## Project Structure

### Documentation (this feature)

```text
specs/042-port-mention/
├── plan.md                  # This file
├── research.md              # Phase 0 — R-01 … R-16, divergence register D-1 … D-11
├── data-model.md            # Phase 1 — entities, invariants, algorithms, data attributes
├── contracts/
│   └── public-api.md        # Phase 1 — the exported interface
├── quickstart.md            # Phase 1 — gates + 19 validation scenarios
├── checklists/
│   └── requirements.md      # from /speckit-specify
└── tasks.md                 # Phase 2 — created by /speckit-tasks, NOT by this command
```

### Source Code (repository root)

```text
src/lib/components/ui/mention/
├── index.ts                      # barrel: short names + Mention*-prefixed aliases + prop types + state/caret modules
├── mention.svelte                # Root            ← packages/mention/src/mention-root.tsx
├── mention-label.svelte          # Label           ← packages/mention/src/mention-label.tsx
├── mention-input.svelte          # Input           ← packages/mention/src/mention-input.tsx
├── mention-highlighter.svelte    # internal overlay ← packages/mention/src/mention-highlighter.tsx
├── mention-portal.svelte         # Portal          ← packages/mention/src/mention-portal.tsx
├── mention-content.svelte        # Content         ← packages/mention/src/mention-content.tsx
├── mention-item.svelte           # Item            ← packages/mention/src/mention-item.tsx
├── mention-caret.ts              # rune-free caret geometry + trigger rule + span algebra
│                                 #   ← mention-input.tsx:25-134 (geometry), :144-243 (trigger)
│                                 #   ← mention-root.tsx:287-367 (span algebra)
├── mention.svelte.ts             # MentionRootState + MentionCollection + Symbol context
│                                 #   ← mention-root.tsx:42-85 (context), shared use-collection /
│                                 #     use-controllable-state / use-list-highlighting
├── mention.test.svelte           # harness (NOT in registry.json, not collected by Vitest)
└── mention.test.ts               # colocated tests (NOT in registry.json)

src/routes/docs/components/mention/
└── +page.svelte                  # 3 <ComponentPreview> sections + API reference tables

registry.json                     # append exactly one registry:ui entry named "mention"
```

**Structure Decision**: one file per upstream part, named `<slug>-<part>.svelte`, root at
`mention.svelte`. The highlighter is a file of its own (never two components in one `.svelte`) even
though it is not a public export — upstream does not export it either; it is rendered by
`<Mention.Input>` inside the `position: relative` wrapper, exactly as upstream. Reactive logic is
split in two on purpose: `mention.svelte.ts` (runes, context, collection) and `mention-caret.ts`
(pure functions), so the trigger rule and the span algebra are unit-testable without rendering and
are reusable by later components. Demo route segment `mention` == folder slug `mention` == registry
item `name: "mention"`.

**Registry entry** (appended to `registry.json`, then `pnpm run registry:build`):

```json
{
	"name": "mention",
	"type": "registry:ui",
	"title": "Mention",
	"description": "A text field that suggests and inserts mentions when a trigger character is typed.",
	"registryDependencies": ["combobox", "direction-provider", "checkbox-group"],
	"dependencies": ["bits-ui"],
	"files": [
		{ "path": "src/lib/components/ui/mention/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/mention/mention.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/mention/mention-label.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/mention/mention-input.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/mention/mention-highlighter.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/mention/mention-portal.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/mention/mention-content.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/mention/mention-item.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/mention/mention-caret.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/mention/mention.svelte.ts", "type": "registry:ui" }
	]
}
```

The two test files (`mention.test.ts`, `mention.test.svelte`) are deliberately absent from `files` —
registry items ship source, not tests (Principle V).

`combobox` for the filter store, `direction-provider` for `useDirection`, `checkbox-group` for
`FormControlState` — the same cross-component dependency style already used by `key-value` →
`editable`, `kanban` → `sortable` and `phone-input` → `mask-input`. No `@lucide/svelte`: the
component renders no icons.

## Implementation phases (what `/speckit-tasks` will expand)

**Phase A — foundation (blocks everything).**
`mention-caret.ts`: `MentionSpan`/`TriggerMatch`/`CaretAnchor` types, `measureTextWidth`,
`getLineHeight` (finite-number guard, D-9), `getCaretRect`, `createCaretAnchor`,
`resolveMentionTrigger` (the six-condition rule), `addMentionSpan`, `removeMentionSpans`,
`shiftMentionSpans`. Then `mention.svelte.ts`: `MentionCollection`, `MentionRootState`, the `Symbol`
context key with a throwing `getMentionContext(consumerName)`.

**Phase B — parts (US1, US2, US3).**
`mention.svelte` (controlled/uncontrolled trio, direction, form input, context publication) →
`mention-label.svelte` → `mention-highlighter.svelte` → `mention-input.svelte` (the whole event
surface: trigger update, keyboard, cut, paste, `beforeinput`, pointer, `select`; the `child` snippet
with its attachment) → `mention-portal.svelte` → `mention-content.svelte` (virtual anchor,
RTL align flip, CSS variables, `data-pasting`) → `mention-item.svelte` (registration, roles, data
attributes, click/pointer) → `index.ts`.

**Phase C — tests.**
`mention.test.svelte` harness (default composition + bare-part modes + empty-item-value mode +
`<form>` mode + binding modes) and `mention.test.ts` covering, at minimum: the upstream test file's
15 cases translated; roles/ARIA; every key in the contract's keyboard table; uncontrolled;
controlled + function binding; RTL; `disabled`/`readonly`; each guard-rail error; the word-boundary
matrix; splice-preserves-surrounding-text; atomic delete (adjacent, inside, selection-overlap); and
direct unit tests of the four pure functions in `mention-caret.ts`.

**Phase D — docs route.**
`src/routes/docs/components/mention/+page.svelte`: **Default** (`mention-demo.tsx` — textarea via the
`child` snippet, a user list with `label`/`value`, `data-tag` styling through semantic tokens),
**Custom Trigger** (`mention-custom-trigger-demo.tsx` — `trigger="#"`), **With Custom Filter**
(`mention-custom-filter-demo.tsx` — `trigger="/"`, controlled `value` + `inputValue`, a starts-with
`onFilter` built on `Combobox.createFilter`), then the API reference: one props table per part, a
data-attribute table and a keyboard table.

**Phase E — registry + gates.**
Append the `registry.json` entry, run `pnpm run registry:build`, then
`pnpm run format` → `check` → `lint` → `test:unit -- --run` → `build`, fixing causes rather than
suppressing.

## Complexity Tracking

> No Constitution Check violation was recorded, in either the initial or the post-design pass, so this
> table is intentionally empty. Principles II, VI and VII admit no exception and are not implicated.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | none      | —          | —                                      |
