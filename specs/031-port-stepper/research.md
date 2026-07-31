# Phase 0 Research: Port Stepper

**Feature**: `031-port-stepper` | **Date**: 2026-07-31

**Upstream pin**: `sadmann7/diceui @ d9763d82530416dfa4c81c462387b55d06bae4ec`

Sources read in full:

| Source                                                                | Lines | Role                              |
| --------------------------------------------------------------------- | ----- | --------------------------------- |
| `.reference/diceui/docs/registry/bases/radix/ui/stepper.tsx`          | 1275  | Behaviour contract                |
| `.reference/diceui/docs/types/radix/stepper.ts`                       | 208   | Documented prop API + JSDoc       |
| `.reference/diceui/docs/content/docs/components/radix/stepper.mdx`    | 323   | Data attributes + keyboard table  |
| `.reference/diceui/docs/registry/bases/radix/test/stepper.test.tsx`   | 400   | Assertion floor (17 `it` blocks)  |
| `.../radix/examples/stepper-{demo,vertical,validation,form}-demo.tsx` | 4×    | Demo sections (four, not three)   |

Local conventions read: `CLAUDE.md`, `.specify/memory/constitution.md`,
`.agents/skills/shadcn-svelte/rules/{styling,composition,forms,icons}.md`,
`src/lib/components/ui/{checkbox-group,direction-provider,action-bar,speed-dial,scroll-spy}/`.

---

## R-01 — Where does the reactive state live?

**Decision**: One `StepperRootState` class in `stepper.svelte.ts`, plus a `StepperItemState` for the
per-item context, plus a `StepperFocusState` for the roving-focus group. No external store.

**Rationale**: Upstream builds a hand-rolled `useSyncExternalStore` store (`stepper.tsx:141-330`)
with `useLazyRef` for the listener set and the state ref, and `useAsRef` to keep callback props
fresh. Every one of those three hooks exists purely to work around React's re-render model:
`useLazyRef` avoids re-creating the `Map` per render, `useAsRef` avoids stale closures, and
`useSyncExternalStore` avoids re-rendering all eleven parts when one step changes. Svelte 5 runes
have none of those problems — a `$state` field is already fine-grained, and a getter-function prop
already reads the latest callback. Porting the store literally would be transliteration, which the
port instructions forbid.

**Alternatives considered**: A literal store port with `subscribe`/`notify` — rejected, it would
reimplement Svelte's own dependency tracking and every part would need a manual subscription
`$effect`. A single flat context object — rejected, `StepperItem`/`StepperTrigger`/`StepperIndicator`
/`StepperSeparator` all need the *item's* value, which is what upstream's second
`StepperItemContext` provides.

---

## R-02 — Controlled vs uncontrolled `value`

**Decision**: `value = $bindable()` on the root with `value ??= defaultValue ?? ''` seeding once, and
every mutation routed through a single `setValue(next)` that writes `value` and then calls
`onValueChange?.(next)`. No mirror `$state`.

**Rationale**: This is the `checkbox-group` pattern (`checkbox-group.svelte.ts:117-134` +
`checkbox-group.svelte`), already proven in this repo. Reading straight from the `$bindable` prop is
precisely what lets an authoritative parent decline a write: if the consumer passes `value` without
`bind:`, the local assignment is overwritten on the next props invalidation and the stepper does not
move on its own — which is FR-001's controlled requirement. Upstream achieves the same with a
`useIsomorphicLayoutEffect` that re-pushes the `value` prop into the store (`stepper.tsx:332-336`);
in Svelte that effect is unnecessary and would be a write-to-state-you-read loop.

**Consequence for tests**: `@testing-library/svelte`'s `rerender()` does not survive a non-bound
`$bindable` (known repo pitfall). Controlled-mode assertions therefore go through a
`stepper.test.svelte` harness that owns the state and uses `bind:value`, matching the
`direction-provider` / `checkbox-group` harness convention.

**Alternatives considered**: A `#value = $state()` mirror synced by `$effect` — rejected, it
re-introduces the stale-write problem the repo already solved, and it makes "controlled parent
declines the write" untestable.

---

## R-03 — Step registration and ordering

**Decision**: Reuse `DomOrderedCollection` from
`$lib/components/ui/speed-dial/speed-dial-collection.svelte.js` for the **trigger** registry
(roving focus), and a `SvelteMap<string, StepRegistration>` in `StepperRootState` for the **step**
registry (insertion-ordered, keyed by step value).

**Rationale**: Two distinct collections exist upstream and they are not interchangeable.

- `StoreState.steps: Map<string, StepState>` (`stepper.tsx:141-144`) is keyed by step value, ordered
  by `StepperItem` mount order, and is what `aria-posinset`, `aria-setsize`, `getDataState`,
  `StepperPrev` and `StepperNext` all index into. A JS `Map` preserves insertion order, so
  `SvelteMap` is the exact equivalent and is already used across this repo.
- `itemsRef` in `StepperList` (`stepper.tsx:428, 456-472`) is keyed by trigger element id and sorted
  by `compareDocumentPosition` at read time — that is verbatim `DomOrderedCollection`
  (`speed-dial-collection.svelte.ts:12-19`), which already implements the same comparator and the
  same `isConnected` filter. Three components (`segmented-input`, `time-picker`, `action-bar`)
  already import it, and each declares `speed-dial` in `registryDependencies`; this port follows
  that established convention.

**Ordering caveat**: `StepperItem` mount order and DOM order can diverge under `{#each}` reordering.
Upstream has the identical divergence, so parity is preserved by keeping the two collections
separate rather than "fixing" it.

**Alternatives considered**: One collection for both — rejected, `StepperPrev`/`StepperNext` and
`aria-posinset` must keep working for steps whose trigger is absent (a `StepperItem` need not render
a `StepperTrigger`), which a trigger-element-keyed collection cannot represent.

---

## R-04 — Roving focus: what is composed, what is bespoke

**Decision**: Compose the three pure helpers `focusFirst`, `wrapArray` and `getDirectionAwareKey`
from `$lib/components/ui/action-bar/action-bar-roving-focus.svelte.js`. Write a bespoke
`StepperFocusState` for the group state itself, in `stepper.svelte.ts`.

**Rationale (Principle IV justification)**: The primitive evaluated is
`action-bar-roving-focus.svelte.ts`'s `RovingFocusGroupState`. Its pure helpers are a byte-for-byte
match for upstream stepper's `focusFirst` (90-102), `wrapArray` (104-108) and `getDirectionAwareKey`
(68-75) and are reused as-is. The **class** cannot be reused as-is, and lacks exactly three
capabilities:

1. **Validation-gated navigation.** `RovingFocusGroupState.navigate()` ends in
   `queueMicrotask(() => focusFirst(candidates))` and never exposes the candidate list. Stepper must
   intercept `candidates[0]` *before* focusing it, resolve it back to a step value, run the async
   `onValidate`, and abort the focus move entirely when validation fails (`stepper.tsx:882-912`).
   Nothing in the toolbar class can express "the focus move may be cancelled by an await".
2. **Selection-priority entry focus.** Stepper's `onFocus` builds its candidate list as
   `[selectedItem, activeItem, currentItem, ...items]` (`stepper.tsx:499-515`) — the item matching
   the *current step value* is tried first. The toolbar class only knows about `tabStopId`
   (`action-bar-roving-focus.svelte.ts:186-193`); it has no notion of a selected value.
3. **`PageUp`/`PageDown`.** Stepper maps them to `first`/`last` (`stepper.tsx:57-66`); the toolbar's
   `getFocusIntent` does not. Adding them there would silently change `action-bar` and
   `selection-toolbar` behaviour and break their upstream parity, so stepper supplies its own
   key→intent map and delegates only the RTL swap to the shared `getDirectionAwareKey`.

`action-bar-roving-focus.svelte.ts` is therefore **not modified** — a behavioural edit to a shipped
registry component is a parity risk for two other ported components that this port does not need to
take. `bits-ui` was also evaluated: it exposes no standalone roving-focus-group primitive, and its
`Tabs` primitive hard-codes tab activation with no validation hook, no `completed` state and no
`nonInteractive` mode.

**Registry consequence**: `registryDependencies` gains `action-bar` (for the three helpers) and
`speed-dial` (for `DomOrderedCollection`). Cross-component registry dependencies of this weight are
established practice here — `time-picker` depends on `segmented-input` and `checkbox-group`.

---

## R-05 — Async validation and the stale-result guard

**Decision**: `StepperRootState.setValueWithValidation(next, direction)` is `async`, returns
`Promise<boolean>`, and carries a monotonically increasing `#validationGeneration` counter. The
awaited result is applied only when the generation is still current.

**Rationale**: Upstream's `setStateWithValidation` (`stepper.tsx:283-298`) awaits `onValidate` and
then writes unconditionally. If the consumer changes the controlled `value` while that promise is in
flight, upstream applies the stale result over the newer value. Spec Edge Case 4 requires this not
happen. A generation counter is the minimal fix: increment on entry, capture, compare after the
await, and drop the write on mismatch. `try/catch → return false` is kept verbatim (295-297): a
*rejected* validator blocks the move exactly like a `false` one.

**Divergence recorded**: this guard is behaviour upstream does not have. It can never make a move
happen that upstream would block, only suppress a write upstream would have made against a value the
consumer has since replaced.

**Alternatives considered**: `AbortController` — rejected, `onValidate`'s documented signature is
`(value, direction) => boolean | Promise<boolean>` and adding a third argument is API drift.

---

## R-06 — `getDataState` derivation

**Decision**: Port `getDataState` (`stepper.tsx:110-133`) verbatim as an exported pure function
taking `(value, itemValue, step, stepKeys, variant)`.

**Rationale**: The precedence order is load-bearing and non-obvious, and every one of the four rules
is asserted by an upstream test:

1. `step.completed === true` → `"completed"`, **before** the active check. (Test
   `handles completed steps correctly`: `step1` is explicitly `completed` while `step2` is active.)
2. `value === itemValue` → `"active"` for items/triggers/indicators, but `"inactive"` for the
   separator variant. (The separator after the *active* step must not be filled.)
3. Otherwise, if the active step's index is **greater** than this step's index → `"completed"`.
4. Otherwise `"inactive"`.

Exported rather than inlined because `StepperItem`, `StepperTrigger`, `StepperIndicator` and
`StepperSeparator` all call it, and the separator passes a different `variant`.

---

## R-07 — `asChild` → `child` snippet

**Decision**: Every part that upstream gives `asChild` gets a `child?: Snippet<[{ props }]>` prop,
following `action-bar-item.svelte:178-198`. In `child` mode `children` is not rendered and `ref`
stays `null`.

**Rationale**: `CLAUDE.md` §10 and `.agents/skills/shadcn-svelte/rules/composition.md` both make this
the standard translation, and the upstream `stepper-validation-demo` / `stepper-form-demo` both use
`<StepperPrev asChild><Button/></StepperPrev>`, so the demo page cannot be ported without it.
`StepperPrev` and `StepperNext` are the parts that actually need it; the rest get it for parity.

**Consequence**: a `child`-rendered `StepperTrigger` cannot self-register with the roving-focus
collection (the caller owns the element and `ref` never binds). Documented on the prop, exactly as
`action-bar-item.svelte:28-32` documents it.

---

## R-08 — `dir` resolution

**Decision**: `useDirection({ dir: () => dirProp })` from
`$lib/components/ui/direction-provider/index.js`, resolved once in the root and published on the
stepper context. Every part renders `dir={context.dir}`, as upstream does.

**Rationale**: Upstream uses `radix-ui`'s `DirectionPrimitive.useDirection(dirProp)`
(`stepper.tsx:338`), whose resolution order is `prop ?? provider ?? 'ltr'`. This repo's
`useDirection` resolves `prop ?? provider ?? domDir ?? 'ltr'` — a superset — and is already the
established replacement in `checkbox-group`, `action-bar`, `scroll-spy` and six others.

---

## R-09 — Element ids

**Decision**: `const rootId = id ?? $props.id()`, and a pure exported
`getStepperId(rootId, variant, value)` returning `` `${rootId}-${variant}-${value}` ``.

**Rationale**: Verbatim upstream `getId` (`stepper.tsx:47-53`) and `rootId = id ?? instanceId`
(340-341). Exporting the helper is what lets `StepperContent` compute the trigger id it points
`aria-labelledby` at without needing the item context — `StepperContent` lives *outside*
`StepperItem`, so it can only derive ids from the root id plus its own `value` prop.

---

## R-10 — `data-slot` on Title and Description

**Decision**: `data-slot="stepper-title"` and `data-slot="stepper-description"`, with
`StepperTrigger`'s two Tailwind selectors updated to
`not-has-data-[slot=stepper-title]:rounded-full` and
`not-has-data-[slot=stepper-description]:rounded-full`.

**Rationale**: Upstream emits the bare `data-slot="title"` / `"description"`
(`stepper.tsx:1102, 1128`). Constitution Principle VIII requires `data-slot="<slug>-<part>"`
without exception, and the bare names genuinely collide in this repo — `card`, `alert` and `empty`
all ship a `data-slot="title"`, so a Stepper inside a Card would flip the trigger's border radius
from the wrong element. Updating both halves of the selector pair keeps the rendered result
identical. **Recorded as a divergence** in `spec.md` Assumptions.

---

## R-11 — `aria-describedby` on the trigger

**Decision**: Reproduce upstream verbatim: `aria-describedby={`${titleId} ${descriptionId}`}`,
always both ids, regardless of whether a Title or Description is rendered.

**Rationale**: Principle II is non-negotiable and this is documented rendered output. The IDREFs are
stable and become live the instant the parts render; a dangling IDREF is ignored by every browser and
by the accessibility tree. Making it conditional would require the trigger to know whether its
descendants exist, which upstream deliberately does not do, and would change `aria-describedby` on
every existing consumer's markup. The accessible *name* is unaffected — it comes from the trigger's
own contents, which is what the upstream tests query by (`getByRole('tab', { name: /step 2/i })`).

---

## R-12 — `StepperSeparator.forceMount`

**Decision**: Port `forceMount?: boolean` on `StepperSeparator`.

**Rationale**: It is in the source (`stepper.tsx:1028-1030, 1052`) but **missing** from the
documented types file (`types/radix/stepper.ts` gives `StepperSeparatorProps` no members). Source
wins: it is rendered behaviour, it is the only way to keep the trailing separator mounted for an
animation library, and FR-017 requires it. `StepperContent.forceMount` is in both and is ported the
same way.

---

## R-13 — Which primitives are composed for the demo page

**Decision**: The two form-shaped demos (`stepper-validation-demo`, `stepper-form-demo`) are rebuilt
on `$lib/components/ui/field`, `input`, `textarea`, `button` and `sonner`, with a plain local
`validateStep(fields)` function.

**Rationale**: Upstream depends on `react-hook-form`, `@hookform/resolvers` and `zod`. No ported
component in this repo uses a form library, and Principle IV forbids adding one for a demo. The
demonstrated behaviour — `onValidate` returning `false` blocks the forward move and toasts — is fully
reproducible with a local validator. Already recorded in `spec.md` Assumptions.

---

## R-14 — Test strategy

**Decision**: `stepper.test.ts` (spec) + `stepper.test.svelte` (prop-driven harness). All 17 upstream
`it` blocks are ported, with the three that upstream wrote defensively tightened.

**Rationale**: `expect.requireAssertions` is on and `globals: false`. Three upstream tests are weaker
than the behaviour they describe and are corrected on port (Principle VII allows this with a stated
reason):

| Upstream test                        | Problem                                                                        | Port                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `navigates with next/previous buttons` | Branches on `if (!nextButton.disabled)` — the assertion can be skipped entirely | Asserts unconditionally; steps register synchronously in Svelte          |
| `prevents navigation when validation fails` | `await new Promise(r => setTimeout(r, 100))` — a wall-clock sleep          | `vi.waitFor` on `onValidate`, then assert `onValueChange` never fired    |
| `handles validation correctly`       | Wraps `user.click` in `act()` — a React-only concern                            | Plain `await user.click` + `vi.waitFor`                                  |

Added beyond upstream, as Constitution III §7 requires: RTL arrow inversion, vertical-orientation
arrow filtering, `Home`/`End`/`PageUp`/`PageDown`, `loop` in both directions, the eleven
out-of-provider error messages, `bind:value`, the `child` snippet, `forceMount` on both parts,
`onValueAdd`/`onValueRemove`/`onValueComplete`, `disabled` on the root, and the stale-validation
guard from R-05.
