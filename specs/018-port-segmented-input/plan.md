# Implementation Plan: Segmented Input

**Branch**: `018-port-segmented-input` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-port-segmented-input/spec.md`

**Upstream (pinned `d9763d82530416dfa4c81c462387b55d06bae4ec`)**:
`.reference/diceui/docs/registry/bases/radix/ui/segmented-input.tsx` (211 lines — the implementation named by the port brief),
`.reference/diceui/docs/registry/bases/base/ui/segmented-input.tsx` (243 lines — the sibling variant, read for the `render` escape hatch),
`.reference/diceui/docs/types/radix/segmented-input.ts` (76 lines — the documented prop surface and its `@default` JSDoc),
`.reference/diceui/docs/content/docs/components/radix/segmented-input.mdx` (114 lines — API reference, keyboard table, example list),
`.reference/diceui/docs/registry/bases/base/examples/segmented-input{,-form,-rgb,-vertical}-demo.tsx` (4 demos).

**No upstream test file exists** for this component under `packages/` or `docs/registry/bases/*/test/`.
Principle III's "upstream assertions are the floor" therefore has an empty floor; the suite is
derived from the MDX contract, the `types/` JSDoc and the six mandatory areas of `CLAUDE.md` §7
instead (research preamble).

---

## Summary

Port Dice UI's `SegmentedInput` — a `role="group"` container that lays a row or column of `<input>`s
out so they read as one joined control, propagating `size`/`disabled`/`invalid`/`required` down and
assigning each child a `first`/`middle`/`last`/`isolated` position — to Svelte 5 runes as a
shadcn-svelte registry item, **plus** the two behaviours the port brief and spec require on top of
upstream: segment arrow-key navigation and paste distribution.

Technical approach:

1. **`React.Children` inspection is replaced by self-registration.** Upstream computes each item's
   `position` by walking `React.Children` and `cloneElement`-ing the prop in; that mechanism does not
   exist in Svelte (`CLAUDE.md` §10). Each item instead registers `(id, element, meta)` with the
   root's state from an `$effect` and derives `position` from the resulting document-ordered index.
   The same registry is what makes arrow navigation and paste distribution possible at all (R-02).
2. **The ordering primitive is composed, not re-written.** `DomOrderedCollection` was written
   generically during the Speed Dial port and explicitly exported "for later ports to reuse rather
   than duplicate"; this port imports it from
   `$lib/components/ui/speed-dial/speed-dial-collection.svelte.js` and adds `speed-dial` to
   `registryDependencies` (R-03, Principle IV).
3. **The navigation behaviour is a standalone module, because Time Picker will import it.**
   `segment-navigation.svelte.ts` holds `SegmentNavigation` plus three pure helpers
   (`resolveSegmentPosition`, `resolveSegmentIntent`, `splitPastedValue`). It imports nothing from
   any `.svelte` file, knows nothing about `Input`, sizes or `data-slot`s, and takes orientation and
   direction as getter functions — so Time Picker constructs one and gets identical keyboard and
   paste behaviour for free (FR-015, R-13).
4. **Arrow keys are caret-boundary guarded; Home/End are not.** These are editable text inputs.
   Hijacking `ArrowLeft`/`ArrowRight` unconditionally would make it impossible to edit the middle of
   a segment, so focus moves only when the caret already sits at that edge with nothing selected —
   the behaviour of every shipping date-field and OTP input. `Home`/`End` move to the first/last
   segment unconditionally, as FR-011 states without qualification (R-08, R-09).
5. **Two upstream defects are fixed rather than reproduced.** Upstream's variant table mixes logical
   and physical properties (`-ms-px … border-l-0`), so under `dir="rtl"` every seam renders a doubled
   border and the leading edge loses its border; this port uses `border-s-0`/`border-s` throughout
   and asserts it (D-06, R-07). Upstream's position count includes non-item children, so a
   decorative `<span>` between two items corrupts the joined-edge styling; counting registered items
   cannot (D-01, R-02).
6. **Everything React-shaped is translated away.** `useMemo`/`useCallback` are dropped outright,
   `createContext` becomes a `Symbol` key with a throwing getter, `asChild`/`Slot` and `render`/
   `useRender` both become one `child` snippet, `cva` becomes `tv()`, and
   `DirectionPrimitive.useDirection` becomes this repo's `useDirection()` (R-15).

Full rationale in [research.md](./research.md) (R-01…R-16); entities, derivations and the DOM
contract in [data-model.md](./data-model.md); the installable surface in
[contracts/public-api.md](./contracts/public-api.md); the executable proof in
[quickstart.md](./quickstart.md) (V-1…V-46).

---

## Public API

Authoritative detail — including every JSDoc `@default` copied from upstream — lives in
[contracts/public-api.md](./contracts/public-api.md). Summary:

### Exported components

| Export                                | File                          | Renders                              | Upstream                   |
| ------------------------------------- | ----------------------------- | ------------------------------------ | -------------------------- |
| `Root` / `SegmentedInput`             | `segmented-input.svelte`      | `<div role="group">`                 | `SegmentedInput`           |
| `Item` / `SegmentedInputItem`         | `segmented-input-item.svelte` | `Input` → `<input>`                  | `SegmentedInputItem`       |

### `SegmentedInput.Root`

| Prop           | Type                                            | Default        | Bindable | Callback / snippet |
| -------------- | ----------------------------------------------- | -------------- | -------- | ------------------ |
| `ref`          | `HTMLDivElement \| null`                        | `null`         | **yes**  | —                  |
| `size`         | `'default' \| 'sm' \| 'lg'`                     | `'default'`    | no       | —                  |
| `dir`          | `'ltr' \| 'rtl'`                                | resolved via `useDirection()` | no | —      |
| `orientation`  | `'horizontal' \| 'vertical'`                    | `'horizontal'` | no       | —                  |
| `disabled`     | `boolean`                                       | `false`        | no       | —                  |
| `invalid`      | `boolean`                                       | `false`        | no       | —                  |
| `required`     | `boolean`                                       | `false`        | no       | —                  |
| `class`        | `string`                                        | —              | no       | merged last        |
| `children`     | `Snippet`                                       | —              | no       | **snippet**        |
| `child`        | `Snippet<[{ props: SegmentedInputChildProps }]>` | —              | no       | **snippet** (replaces `asChild` / `render`) |
| `...restProps` | `HTMLAttributes<HTMLDivElement>`                | —              | —        | spread             |

No callbacks of its own — upstream declares none either; native `<div>` handlers pass through.

### `SegmentedInput.Item`

| Prop           | Type                                                | Default           | Bindable | Callback / snippet |
| -------------- | --------------------------------------------------- | ----------------- | -------- | ------------------ |
| `ref`          | `HTMLInputElement \| null`                          | `null`            | **yes**  | —                  |
| `value`        | `string \| number \| null \| undefined`             | `undefined`       | **yes**  | —                  |
| `type`         | `Exclude<HTMLInputTypeAttribute, 'file'>`           | `undefined`       | no       | —                  |
| `position`     | `'isolated' \| 'first' \| 'middle' \| 'last'`       | auto-detected     | no       | —                  |
| `disabled`     | `boolean`                                           | inherits the root | no       | —                  |
| `required`     | `boolean`                                           | inherits the root | no       | —                  |
| `class`        | `string`                                            | —                 | no       | merged last        |
| `child`        | `Snippet<[{ props: SegmentedInputItemChildProps }]>` | —                 | no       | **snippet**        |
| `...restProps` | `HTMLInputAttributes`                               | —                 | —        | spread             |

Events: the native input handlers, forwarded unchanged. `onkeydown` and `onpaste` are **composed**
(caller first, then the component's; a caller `preventDefault()` vetoes the component's behaviour) —
that veto is the documented opt-out for both enhancements, so no extra prop is invented (R-12).

### Also exported from the barrel

`SegmentNavigation`, `SegmentEntryMeta`, `resolveSegmentPosition`, `resolveSegmentIntent`,
`splitPastedValue`, `SEGMENT_POSITIONS`, `SEGMENT_ORIENTATIONS` (the Time Picker reuse surface,
FR-015); `SegmentedInputRootState`, `setSegmentedInputContext`, `getSegmentedInputContext`,
`hasSegmentedInputContext`, `segmentedInputItemVariants`, `SEGMENTED_INPUT_SIZES`,
`SEGMENTED_INPUT_ORIENTATIONS`, and every prop/child-props type.

---

## Technical Context

**Language/Version**: TypeScript (strict, `verbatimModuleSyntax`), Svelte 5 with runes forced on
(`vite.config.ts`).

**Primary Dependencies**: SvelteKit 2, Tailwind CSS v4, `tailwind-variants@^3.3.0` (already a
dependency — used by `button`, `banner`, `marquee`, `speed-dial`), `clsx` + `tailwind-merge` via
`cn()`. Composed registry items: `input`, `direction-provider`, `speed-dial` (for
`DomOrderedCollection` only). **No new npm dependency** — nothing upstream needs one; `bits-ui` and
`@lucide/svelte` are not used by this component.

**Storage**: N/A.

**Testing**: Vitest (jsdom) + `@testing-library/svelte` + `@testing-library/user-event`,
`expect.requireAssertions` on, `globals: false`. Colocated at
`src/lib/components/ui/segmented-input/segmented-input.test.ts`, with a
`segmented-input.test.svelte` harness (the `direction-provider` / `checkbox-group` precedent) for
snippets, `bind:value` and function bindings, `bind:ref`, conditional items, the `child` snippet and
the provider-less item.

**Target Platform**: Browsers supporting Svelte 5 / Tailwind v4. SSR-safe: no DOM access at module
scope or component init — registration, direction fallback and focus all run from effects/handlers.

**Performance Goals**: N/A. The only non-constant work is `DomOrderedCollection`'s
`compareDocumentPosition` sort, which runs once per structural change and is shared by every reader
through `indexById` (O(n log n) per change, O(1) per item read). Segment counts are single digits.

**Constraints**: Constitution I/VI (runes only, no `any`, no suppressions); Principle VIII styling
(semantic tokens, `data-slot` on every part, boolean data attributes as `'' | undefined`); the four
quality gates green from a clean tree.

**Scale/Scope**: 2 public parts + 1 barrel + 2 state modules = 5 registry files, ~46 validation
scenarios, 1 docs route with 4 previews (one per upstream demo file) + 2 prop tables + 1 keyboard
table, 1 `registry.json` entry.

---

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — verdicts unchanged._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                                                        |
| ---- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$derived.by`/`$effect`/`$props`/`$props.id()`/`$bindable` + snippets only; all non-markup logic in `segmented-input.svelte.ts` and `segment-navigation.svelte.ts`; reactive inputs passed as getter functions; no store, `export let`, dispatcher, `$:` or `<slot>`. |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | Both variant sources, the MDX, the types file and all 4 demos read at the pinned commit; every documented prop, `@default`, `aria-*`, `data-*` and variant class reproduced ([contracts/public-api.md](./contracts/public-api.md)); 7 divergences (D-01…D-07) recorded in spec Assumptions. No upstream test file exists to port. |
| III  | Accessibility Is a MUST             | PASS    | `role="group"` + `aria-orientation` (`aria-orientation` spread from a `$derived` object, per the `checkbox-group` precedent, so `a11y_role_supports_aria_props` never fires and no `svelte-ignore` is needed); items keep native `textbox` semantics with `aria-invalid`/`aria-required` and caller-supplied accessible names; keyboard map covers `Tab`/`Shift+Tab` (upstream) plus arrows/`Home`/`End` (FR-009…FR-011); RTL inversion via `useDirection()` **and** an RTL styling fix (D-06); all six mandatory test areas scheduled (V-1…V-46). |
| IV   | Composition Over Reimplementation   | PASS    | Composed: `Input` (`$lib/components/ui/input`), `useDirection()` (`direction-provider`), `DomOrderedCollection` (`speed-dial`), `tv()`/`cn()`. Bespoke behaviour justified in writing below.                                                     |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder `src/lib/components/ui/segmented-input/`, one part per file, `index.ts` barrel with short + prefixed names + types, `.js` import extensions, exactly one `registry:ui` entry listing all 5 non-test files, no import from `src/routes/**` or `$lib/components/docs/**`. |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Prop types exported from `<script lang="ts" module>`, derived from `WithElementRef<…>`; `type` narrowed to exclude `'file'` so the composed `Input`'s discriminated union resolves without a cast (D-04); no `any`, no ignore comment, no config change. |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit -- --run` → `build` scheduled as the final task; no `.skip`/`.todo`; jsdom `selectionStart === null` handled by the guard itself rather than by weakening a test (R-14).                                 |
| VIII | Styling Discipline                  | PASS    | `tv()` declared in `segmented-input.svelte.ts` and exported; caller `class` merged last through `cn()`; semantic tokens only (all colour comes from the composed `Input`; the variants add geometry only); `gap-*`/`flex` not `space-*`; `data-slot` on both parts; every state a `data-*` attribute written `'' \| undefined`. |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/segmented-input/+page.svelte` with one `<ComponentPreview>` per upstream demo file — **4** (Default, Form Input, RGB Color Input, Vertical Layout), matching spec FR-018 exactly — plus per-part prop tables and a keyboard table. |
| X    | One Feature Directory Per Component | PASS    | All artefacts under `specs/018-port-segmented-input/`; no git write command; no touch of `.reference/`, `scripts/`, `.port-state.json`, `.port-logs/`.                                                                                          |

### Bespoke behaviour justification (Principle IV)

Three behaviours are hand-written. Primitives evaluated, and the specific capability each lacks:

1. **Segment arrow-key navigation + `Home`/`End` (`SegmentNavigation.onKeydown`).**
   - **`bits-ui` `PinInput`** (`node_modules/bits-ui/dist/bits/pin-input/*`) — the closest
     primitive, and it *does* implement inter-segment focus. Rejected: it owns a single string value
     split into fixed-width single-character cells, renders its own hidden input plus one
     non-editable cell element per character, and exposes no way to attach its navigation to N
     caller-owned, independently-valued, variably-sized `<input>`s. Segmented Input's segments are
     full text fields with their own `value`, `maxlength`, `pattern` and `name` — the exact shape
     `PinInput` is designed not to be.
   - **`bits-ui` `RovingFocusGroup`** (used internally by `ToggleGroup`, `Menubar`) — implements
     arrow/Home/End traversal with orientation and RTL awareness, which is exactly the shape needed.
     Rejected on two counts: (a) it is not exported from `bits-ui`'s public entry, so a consumer
     installing this registry item could not import it; (b) it manages `tabindex` as a *roving*
     tabstop, making all but one segment unreachable by `Tab` — which would break FR-008 and the one
     keyboard behaviour the upstream MDX actually documents.
   - **`bits-ui` `useRovingFocus` / `Toolbar`** — same roving-tabstop objection.
   - Nothing in `src/lib/components/ui/*` implements inter-element arrow navigation over editable
     inputs. Hence bespoke — and written as a standalone module precisely so it is written *once*
     for this component and Time Picker (FR-015).
2. **Paste distribution (`SegmentNavigation.onPaste` + `splitPastedValue`).** No primitive in
   `bits-ui` or `src/lib/components/ui/*` distributes a clipboard payload across sibling fields;
   `PinInput` fills its own single value and, again, cannot address caller-owned inputs. The
   splitting rules are also spec-specific (separator detection, per-segment `maxlength` widths,
   discard-the-remainder) and have no general-purpose equivalent.
3. **Position auto-assignment (`resolveSegmentPosition` + registration).** This is the direct
   translation of `React.Children.map` + `cloneElement`, which `CLAUDE.md` §10 states has no Svelte
   equivalent. The *ordering* half of it is **not** bespoke — `DomOrderedCollection` is composed from
   `speed-dial` (R-03); only the four-way index→position mapping is written here, and it is eight
   lines of pure function.

Everything else is composed: the input element and all of its colour/focus/invalid styling come from
`$lib/components/ui/input`; direction resolution (including the provider lookup, the DOM `[dir]`
fallback and its `MutationObserver`) comes from `$lib/components/ui/direction-provider`; class
composition comes from `cn()`/`tv()`.

---

## Project Structure

### Documentation (this feature)

```text
specs/018-port-segmented-input/
├── plan.md                    # This file
├── research.md                # Phase 0 — R-01…R-16, all unknowns resolved
├── data-model.md              # Phase 1 — entities, derivations, DOM contract
├── quickstart.md              # Phase 1 — V-1…V-46 validation scenarios + gate commands
├── contracts/
│   └── public-api.md          # Phase 1 — the installable surface
├── checklists/
│   └── requirements.md        # from /speckit-specify
├── spec.md
└── tasks.md                   # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/segmented-input/
├── index.ts                          # barrel: short names + prefixed aliases + prop types + reuse surface
├── segmented-input.svelte            # Root      ← upstream `SegmentedInput`   (radix/ui/segmented-input.tsx:50-126)
├── segmented-input-item.svelte       # Item      ← upstream `SegmentedInputItem` (radix/ui/segmented-input.tsx:176-209)
├── segmented-input.svelte.ts         # SegmentedInputRootState + Symbol context + `tv()` variants
│                                     #           ← upstream context (20-38) + `segmentedInputItemVariants` (128-168)
├── segment-navigation.svelte.ts      # SegmentNavigation + pure helpers — the module Time Picker imports (FR-015)
│                                     #           ← no upstream counterpart; new behaviour per FR-009…FR-014
├── segmented-input.test.ts           # colocated tests (NOT listed in registry.json)
└── segmented-input.test.svelte       # prop-driven harness (NOT listed in registry.json)

src/routes/docs/components/segmented-input/
└── +page.svelte                      # 4 <ComponentPreview> sections + 2 prop tables + keyboard table

registry.json                         # append exactly one registry:ui entry
```

**Structure Decision**: folder slug `segmented-input` == demo route segment `segmented-input` ==
registry item `name` `"segmented-input"`, so the docs sidebar resolves by construction (Principle
V/IX). Upstream has exactly two exported components, so there are exactly two `.svelte` parts. The
behaviour is split across **two** `.svelte.ts` modules rather than one because FR-015 requires the
navigation half to be independently importable by Time Picker — `segment-navigation.svelte.ts`
imports nothing from `segmented-input.svelte.ts` (the dependency arrow points one way only).

---

## Implementation sequence

Ordered by dependency; `/speckit-tasks` will expand this into `tasks.md`.

1. `segment-navigation.svelte.ts` — pure helpers first (`resolveSegmentPosition`,
   `resolveSegmentIntent`, `splitPastedValue`), then `SegmentNavigation` over
   `DomOrderedCollection`. Testable with zero markup (V-43…V-46).
2. `segmented-input.svelte.ts` — `SEGMENTED_INPUT_SIZES`/`_ORIENTATIONS`,
   `segmentedInputItemVariants` (`tv()`), `SegmentedInputRootState`, the `Symbol` context trio.
3. `segmented-input.svelte` — root: `useDirection()`, state construction, context publication,
   `child` snippet, data attributes.
4. `segmented-input-item.svelte` — item: `$props.id()`, registration effect, position/disabled/
   required derivations, composed `Input`, composed `onkeydown`/`onpaste`, `child` snippet.
5. `index.ts` — barrel.
6. `segmented-input.test.svelte` + `segmented-input.test.ts` — V-1…V-46.
7. `src/routes/docs/components/segmented-input/+page.svelte` — 4 previews + tables.
8. `registry.json` entry + `pnpm run registry:build`.
9. Quality gates: `format` → `check` → `lint` → `test:unit -- --run` → `build`.

---

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

No violations. Every principle records PASS above, and the three bespoke behaviours are justified in
writing under Principle IV with the specific primitive evaluated and the capability it lacks — which
is what Principle IV requires, not an exception to it.

The one accepted trade-off, recorded here for visibility rather than as a violation:
`registryDependencies: ["speed-dial"]` installs nine unrelated files on a consumer's disk to supply
one 60-line `DomOrderedCollection` class (R-03). Duplicating the class instead would be an actual
Principle IV violation; promoting it to a shared `registry:lib` item would modify an already-shipped
component's registry entry and is out of scope under Principle X. The import targets the module file
directly, so nothing from Speed Dial's component graph reaches the consumer's bundle.
