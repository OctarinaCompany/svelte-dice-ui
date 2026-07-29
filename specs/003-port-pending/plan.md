# Implementation Plan: Pending Utility

**Branch**: `003-port-pending` | **Date**: 2026-07-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-port-pending/spec.md`

## Summary

Port Dice UI's `Pending` utility — a hook (`usePending`) plus a `Slot`-based wrapper component
(`Pending`) that mark any interactive element as busy: `aria-busy="true"`, `aria-disabled="true"`,
`data-pending`, `data-disabled`, and event prevention for click/pointer/mouse activation and for
`Enter`/`Space`, while the element stays in the tab order.

Technical approach: the hook becomes a rune-based function `usePending()` in `pending.svelte.ts`
returning a `PendingState` instance whose `pendingProps` is a `$derived.by` attribute payload; the
wrapper becomes `pending.svelte`, whose primary surface is the `child` snippet (the Svelte
equivalent of Radix `Slot` / Base UI `useRender`), with a `display:contents` `<span>` fallback for
`children`. Behaviour is pure attribute-and-handler derivation, so no `bits-ui` primitive is
composed and no npm dependency is added.

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`), Svelte 5.56 in forced runes
mode (`vite.config.ts`), SvelteKit 2.63

**Primary Dependencies**: none new. Existing only — `clsx` + `tailwind-merge` via `cn()` from
`$lib/utils.js`, Tailwind CSS v4. `bits-ui` is *not* imported by the component (see Constitution
Check IV); it is exercised indirectly by the Switch demo, which composes
`$lib/components/ui/switch`. `@lucide/svelte` reaches the demo only through
`$lib/components/ui/spinner`.

**Storage**: N/A

**Testing**: Vitest 4 (jsdom, `globals: false`, `expect.requireAssertions: true`) +
`@testing-library/svelte` 5 + `@testing-library/user-event` 14, setup in `tests/setup.ts`

**Target Platform**: SSR + browser (SvelteKit); the component is distributed as source through the
project's shadcn-svelte registry

**Project Type**: Component library (shadcn-svelte registry) with a colocated SvelteKit docs site

**Performance Goals**: N/A — the component performs no measurement, no layout work and registers no
document-level listeners. `pendingProps` is a single `$derived.by` recomputed only when `id`,
`isPending` or `disabled` change.

**Constraints**: no `any`, no suppression comments, no new npm dependency, no `shadcn-svelte add`,
no `$effect` (nothing to tear down — see research.md R7), semantic Tailwind tokens only.

**Scale/Scope**: 1 component folder (3 shipped files + 2 test files), 1 demo route with 5 example
sections + 4 API tables, 1 `registry.json` entry. No shared module is extracted for later components
(research.md R8).

## Public API

Derived from `.reference/diceui/docs/registry/bases/radix/components/pending.tsx`,
`.reference/diceui/docs/types/radix/pending.ts` and
`.reference/diceui/docs/content/docs/utilities/radix/pending.mdx` at the pinned commit
`d9763d82530416dfa4c81c462387b55d06bae4ec`.

### `usePending(options?: UsePendingOptions): PendingState`

Replaces upstream's `usePending` hook. Must be called during component initialisation. Reactive
inputs arrive as **getter functions** (CLAUDE.md §4), because a snapshot captured at construction
would never update.

| Option      | Type                            | Default                       | Bindable | Upstream counterpart |
| ----------- | ------------------------------- | ----------------------------- | -------- | -------------------- |
| `id`        | `() => string \| undefined`     | auto `pending-<n>`            | n/a      | `id?: string`        |
| `isPending` | `() => boolean \| undefined`    | `false`                       | n/a      | `isPending?: boolean`|
| `disabled`  | `() => boolean \| undefined`    | `false`                       | n/a      | `disabled?: boolean` |

`options` itself is optional; every field is optional. An empty-string `id` falls back to the
generated id, matching upstream's `id || instanceId`.

**Returns** `PendingState` (replaces upstream's `UsePendingReturn`; also exported as the type alias
`UsePendingReturn` for name parity):

| Member         | Type                | Notes                                                                 |
| -------------- | ------------------- | --------------------------------------------------------------------- |
| `id`           | `string` (readonly) | `$derived` — the supplied id, or the generated one                    |
| `isPending`    | `boolean` (readonly)| `$derived` — upstream's `isPending` passthrough                       |
| `disabled`     | `boolean` (readonly)| `$derived` — added for symmetry; not on `UsePendingReturn` upstream    |
| `pendingProps` | `PendingAttributes` (readonly) | `$derived.by` — spread **last** onto the element        |

`PendingAttributes` (upstream's inline `pendingProps` type):

| Key                                                              | Present when  | Value                        |
| ---------------------------------------------------------------- | ------------- | ---------------------------- |
| `id`                                                             | always        | `string`                     |
| `aria-busy`                                                      | `isPending`   | `'true'`                     |
| `aria-disabled`                                                  | `isPending`   | `'true'`                     |
| `data-pending`                                                   | `isPending`   | `''` (see divergence D3)     |
| `data-disabled`                                                  | `disabled`    | `''` (see divergence D3)     |
| `onclick`, `onpointerdown`, `onpointerup`, `onmousedown`, `onmouseup` | `isPending` | `(event: Event) => void` — `preventDefault()` |
| `onkeydown`, `onkeyup`                                           | `isPending`   | `(event: KeyboardEvent) => void` — `preventDefault()` for `Enter`/`" "` only |

Keys that are not "present" are **omitted from the object entirely**, never set to `undefined` — a
spread `{ onclick: undefined }` would clobber the consumer's own handler. This is the mechanism that
makes "spread last" safe when not pending.

**Snippets**: none. **Callbacks/events**: none — upstream defines no `onPendingChange`.

### `<Pending>` — the wrapper component (`Root`)

Replaces upstream's `Pending` (Radix `Slot`) / Base UI `useRender({ state: { slot: "pending" } })`.

| Prop          | Type                                       | Default            | Bindable |
| ------------- | ------------------------------------------ | ------------------ | -------- |
| `ref`         | `HTMLSpanElement \| null`                  | `null`             | **yes**  |
| `id`          | `string \| undefined`                      | `undefined` (falls back to top-level `const uid = $props.id()`) | no       |
| `isPending`   | `boolean`                                  | `false`            | no       |
| `disabled`    | `boolean`                                  | `false`            | no       |
| `class`       | `ClassValue`                               | `undefined`        | no       |
| `children`    | `Snippet`                                  | `undefined`        | no       |
| `child`       | `Snippet<[{ props: PendingChildProps }]>`  | `undefined`        | no       |
| `...restProps`| `HTMLAttributes<HTMLSpanElement>`          | —                  | no       |

- **Snippets**: `children` (fallback mode) and `child` (merge mode, receives
  `{ props: PendingChildProps }`).
- **Callbacks/events**: none. `isPending` is deliberately **not** `$bindable` — the component never
  writes it, and upstream exposes no change callback (spec Assumptions).
- `PendingChildProps` = `PendingAttributes & Record<string, unknown>` — `pendingProps` merged
  **after** `restProps` and after the computed `class`, mirroring upstream's
  `<Slot {...props} {...pendingProps} />`.
- Throws `` `<Pending>` requires exactly one child: pass it as `children`, or spread the merged props onto your own element with the `child` snippet. `` when neither snippet is supplied — the detectable half of upstream's `React.Children.only` contract. When both are supplied, `child` wins and
  `children` is not rendered, matching `status.svelte` and bits-ui.

### Barrel exports (`index.ts`)

```ts
Root, Pending (alias of Root), usePending, PendingState, createPendingId
type PendingRootProps, PendingChildProps, PendingAttributes, UsePendingOptions, UsePendingReturn
```

### Recorded divergences from upstream

| #  | Upstream                                     | Here                                                                                       | Why |
| -- | -------------------------------------------- | ------------------------------------------------------------------------------------------ | --- |
| D1 | `Pending` wraps Radix `Slot`                 | `child` snippet (primary) + `display:contents` `<span>` for `children`                      | Svelte has no `cloneElement`; CLAUDE.md §10 maps `asChild`/`Slot` → `child` snippet. Upstream's own Base-UI variant uses the equivalent `render` prop. |
| D2 | `PendingProps extends EmptyProps<"div">`     | `HTMLAttributes<HTMLSpanElement>`, fallback element is `<span class="contents">`             | The fallback wraps phrasing content (button/anchor/switch); a `<div>` would be invalid inside inline contexts. `contents` adds no layout box. |
| D3 | `data-pending={true}` / `data-disabled={true}` → `="true"` | `''` when set, attribute absent when not                                    | Constitution VIII mandates `cond ? '' : undefined`; bits-ui's own `boolToEmptyStrOrUndef` does the same. `[data-pending]` / Tailwind `data-pending:` selectors behave identically. |
| D4 | Slot composes child + slot handlers (both run) | Spread order decides: `pendingProps` last replaces the consumer's handler                  | This is exactly upstream's documented *hook* semantics ("spread `pendingProps` last") and is what spec FR-004 requires ("no action handler fires"). |
| D5 | `React.useId()`                              | a top-level `const uid = $props.id()` in `pending.svelte` (fallback via `id \|\| uid`); module counter `pending-<n>` in bare `usePending()` | `$props.id()` is component-only, cannot be called from a `.svelte.ts` module, and the compiler requires it as the initializer of a top-level `const`/`let` — it cannot be a prop default or a destructuring default. Documented, with a recommendation to pass an explicit id when another element references it. |
| D6 | `React.useMemo` around both return values    | dropped                                                                                     | Svelte's `$derived` makes memoisation unnecessary (brief's translation rules). |
| D7 | hook emits no `data-slot`; Base UI variant sets render-state `slot: "pending"` on the wrapper | `data-slot="pending"` is emitted **only** by the wrapper's fallback `<span>`; `pendingProps` carries no `data-slot` | `pendingProps` is spread *last* onto an element the consumer owns; a `data-slot` there overwrites `data-slot="button"`/`"switch"` (both written before `{...restProps}`) and breaks the shadcn `data-[slot=…]` selectors. Constitution VIII governs parts this component renders. |

All divergences D1–D7 are recorded in the spec's Assumptions section, as Principle II requires; this
table is the technical restatement.

## Constitution Check

_GATE: passed before Phase 0 research; re-checked after Phase 1 design — see "Post-design re-check"._

| #    | Principle                           | Verdict | Evidence                                                               |
| ---- | ----------------------------------- | ------- | ---------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$derived`/`$derived.by` in `PendingState`, `$props`/`$bindable`/`$props.id()` in `pending.svelte`, snippets only. No stores, no `export let`, no `createEventDispatcher`, no `<slot>`. Reactive inputs passed as getter functions. |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | `pending.tsx`, `types/radix/pending.ts`, `pending.mdx` and all five `pending-*-demo.tsx` read at the pinned commit; the base-variant `pending.tsx` cross-checked. Every option, return member, ARIA and data attribute and both handler sets reproduced above; JSDoc incl. `@default` copied onto the Svelte types. Divergences D1–D7 recorded. |
| III  | Accessibility Is a MUST             | PASS    | `aria-busy="true"` + `aria-disabled="true"`, focus retained (no `disabled`, no `tabindex` change), `Enter`/`Space` prevented and no other key touched. Tests cover ARIA, accessible name, the full keyboard set, RTL, controlled/uncontrolled, guard rails and the documented throw. |
| IV   | Composition Over Reimplementation   | PASS    | No behaviour is bespoke beyond attribute derivation — see justification below. |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder `src/lib/components/ui/pending/`, `index.ts` barrel with short name + alias + types, `.js` extensions on intra-repo imports, one `registry:ui` entry, no import from `src/routes/**` or `$lib/components/docs/**`. |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Types declared in `<script lang="ts" module>` and in `pending.svelte.ts`; `WithElementRef<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>`; handler params typed `Event`/`KeyboardEvent`; no `any`, no ignore comments, no config change. |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit --run` → `build` scheduled as the final task; no `.skip`/`.todo`. |
| VIII | Styling Discipline                  | PASS    | Only `cn('contents', className)` on the fallback span — no colours at all in the component. `data-slot="pending"` on the fallback `<span>` only (D7), `data-pending`/`data-disabled` as `cond ? '' : undefined`. Demo uses `text-success` (existing token), never a raw palette colour. |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/pending/+page.svelte` with five `<ComponentPreview>` sections, one per upstream demo file, plus API tables. |
| X    | One Feature Directory Per Component | PASS    | All planning artifacts in `specs/003-port-pending/`; no git write command anywhere in the plan. |

**Bespoke behaviour justification (Principle IV)**: Two pieces of logic are hand-written.

1. **The pending attribute/handler payload.** Evaluated: `$lib/components/ui/button` (its `disabled`
   removes the element from the tab order and fires no events — the opposite of the required
   busy-but-focusable contract, and the shadcn-svelte composition rule explicitly states Button has
   no `isPending` prop); `bits-ui` (searched its surface for a pending/busy primitive — it exposes
   none; `aria-busy` appears nowhere in its component states). No primitive derives
   `aria-busy` + `aria-disabled` + focus-retaining event prevention, so the payload is written
   directly. It is ~30 lines of pure derivation with no DOM access, no listeners and no lifecycle.
2. **The `child` snippet merge.** Evaluated: bits-ui's `mergeProps`/`Slot` equivalents — they are
   internal to `bits-ui` and `svelte-toolbelt` and not re-exported from `bits-ui`'s single `.`
   entry point, so they cannot be imported without adding a dependency. Plain object spread in the
   documented "last wins" order reproduces upstream's `<Slot {...props} {...pendingProps} />`
   exactly, and the consumer-side spread onto a bits-ui component still short-circuits correctly
   because bits-ui composes `restProps` handlers *before* its own and bails on
   `event.defaultPrevented` (verified in `svelte-toolbelt/dist/utils/compose-handlers.js`).

Nothing else is bespoke: no portal, no focus trap, no positioner, no dismissible layer, no direction
handling.

## Project Structure

### Documentation (this feature)

```text
specs/003-port-pending/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── pending-api.md   # Phase 1 output — the public contract
├── checklists/
│   └── requirements.md  # from /speckit-specify
├── spec.md              # from /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/pending/
├── index.ts                    # barrel: Root + Pending alias, usePending, PendingState, all types
├── pending.svelte              # the wrapper component (Root)
├── pending.svelte.ts           # usePending(), PendingState, createPendingId(), option/return types
├── pending.test.svelte         # prop-driven test harness (NOT collected by Vitest, NOT in registry)
└── pending.test.ts             # colocated tests

src/routes/docs/components/pending/
└── +page.svelte                # 5 <ComponentPreview> sections + 4 API tables

registry.json                   # append exactly one registry:ui entry named "pending"
```

**Structure Decision**:

| File                        | Upstream counterpart under `.reference/diceui`                                        |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `pending.svelte.ts`         | `docs/registry/bases/radix/components/pending.tsx` → `usePending` + the `UsePendingOptions` / `UsePendingReturn` JSDoc in `docs/types/radix/pending.ts` |
| `pending.svelte`            | `docs/registry/bases/radix/components/pending.tsx` → `function Pending(...)`; `PendingProps` JSDoc from `docs/types/radix/pending.ts`; `data-slot="pending"` confirmed by the base variant's `state: { slot: "pending" }` |
| `index.ts`                  | `export { Pending, usePending }` at the foot of `pending.tsx`                            |
| `pending.test.ts` / `.svelte` | No upstream test file exists (`docs/registry/bases/radix/test/` has none for pending); the suite is authored from the MDX contract and the source |
| `+page.svelte`              | `docs/content/docs/utilities/radix/pending.mdx` + the five `docs/registry/bases/radix/examples/pending-*-demo.tsx` |
| `registry.json` entry       | `docs/public/r/styles/radix-nova/pending.json`                                           |

There is no multi-part compound structure and therefore no context: `Pending` has exactly one part
(the root), so there is no `setPendingContext`/`getPendingContext` pair and no
"used outside its provider" error to throw. The equivalent documented error — the one Principle III
requires a test for — is the missing-child throw described in the Public API section.

Slug check: folder `pending` == registry item `name: "pending"` == demo route segment
`src/routes/docs/components/pending/`. ✅

### Implementation order (what `/speckit-tasks` will expand)

1. `pending.svelte.ts` — `createPendingId()`, `UsePendingOptions`, `PendingAttributes`,
   `PendingState`, `usePending()`, `UsePendingReturn` alias. (US1)
2. `pending.svelte` — props type in the module script, a top-level `const uid = $props.id()`
   fallback (`id || uid`, not a prop default), `child` branch and the `contents`-span `children`
   branch, the missing-child throw. (US2)
3. `index.ts` barrel. (US1/US2)
4. `pending.test.svelte` harness + `pending.test.ts` covering the six constitution areas. (US1–US3)
5. `src/routes/docs/components/pending/+page.svelte` — five previews + four tables. (US1–US3)
6. `registry.json` entry, then `pnpm run registry:build`.
7. Quality gates: `pnpm run format`, `check`, `lint`, `test:unit -- --run`, `build`.

## Post-design re-check (after Phase 1)

Re-ran the table above against `data-model.md`, `contracts/pending-api.md` and `quickstart.md`:
**all ten principles still PASS.** Phase 1 changed nothing structurally; it only pinned down the
exact attribute payload, the "omit, never `undefined`" spread rule, and the fallback wrapper's
capture-phase handlers — none of which introduces a dependency, a suppression, a raw colour, a
bespoke primitive, or a second feature directory. `Complexity Tracking` stays empty.

## Complexity Tracking

> No Constitution Check violations. This table is intentionally empty.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | —         | —          | —                                      |
