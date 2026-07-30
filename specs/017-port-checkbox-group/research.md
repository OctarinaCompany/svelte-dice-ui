# Phase 0 Research: Checkbox Group

All upstream references are at the pinned commit `d9763d82530416dfa4c81c462387b55d06bae4ec`
(`.reference/diceui`). Line numbers are from the vendored copy.

The feature spec contains **zero** `[NEEDS CLARIFICATION]` markers; the unknowns resolved here are the
technical ones the Technical Context raised (which primitive, which idiom, which jsdom behaviour).

---

## R-01 — Upstream's `createContext` pair → two Symbol-keyed contexts + two state classes

**Decision.** `checkbox-group.svelte.ts` exports `CheckboxGroupRootState` and
`CheckboxGroupItemState`, each published on its own typed `Symbol` key with
`set…Context` / `get…Context(consumer: string)` helpers; the getters throw
``` `<CheckboxGroup.X>` must be used within `<CheckboxGroup.Root>`. ``` (and `…within <CheckboxGroup.Item>`
for the indicator).

**Rationale.** Upstream has exactly two contexts: `CheckboxGroupContextValue` (root, 16 fields —
`checkbox-group-root.tsx:14-30`) and `CheckboxGroupItemContext` (`value`, `disabled`, `checked` —
`checkbox-group-item.tsx:15-19`). Its `createContext(ROOT_NAME)` factory throws
`` `${consumerName} must be used within ${rootComponentName}` ``. CLAUDE.md §5 and FR-023 require the
same throw, named per part; two classes keep item-scoped derivation (checked/disabled/required) off
the root and let the indicator read only what it needs.

**Alternatives considered.** One flat context with an items map — rejected: the indicator would have to
re-find its own item, and `React.Children` inspection has no Svelte counterpart (CLAUDE.md §10). A
bare string context key — rejected by CLAUDE.md §5.

---

## R-02 — `useControllableState` + four `useId`s → `$bindable` + one `$props.id()`

**Decision.** The root takes `value = $bindable()` and seeds `value ??= defaultValue` at init; it holds
no shadow copy. Ids: one `const uid = $props.id()` with the four documented suffixes
(`${uid}`, `${uid}-label`, `${uid}-description`, `${uid}-message`) plus `${uid}-list`.

**Rationale.** `useControllableState({prop, defaultProp, onChange})` is exactly the repo's
`value ??= defaultValue` idiom plus a write-through setter that also calls the callback
(`speed-dial.svelte:91-101`, CLAUDE.md §4). Four separate `useId()` calls exist upstream only because
React has no way to derive stable sibling ids; deriving them from one `$props.id()` is stable across
SSR/hydration and makes the ids readable in test failures.

**Alternatives considered.** `crypto.randomUUID()` — not SSR-stable. A `$state` mirror of `value`
synced by `$effect` — rejected, it is precisely what breaks R-03.

---

## R-03 — "Controlled means the parent can decline" in Svelte

**Decision.** Controlled mode is expressed by binding: `bind:value={someState}` (parent accepts every
change) or Svelte's **function binding** `bind:value={() => authoritative, (next) => { … }}` (parent
decides). Because the root reads `value` straight from the prop and never mirrors it, a setter that
ignores the write leaves `value` reading its old value and the rendered checked state does not move —
spec US1 AS-5. Passing `value` **unbound** (`value={list}` + `onValueChange`) seeds the value and then
self-updates; that is documented on the demo page and in the barrel's JSDoc.

**Rationale.** `$bindable` has no "is it bound?" introspection: any write to an unbound bindable prop
updates the component's local copy, so React's "prop wins, always" cannot be reproduced for an unbound
prop by any implementation. Function bindings (`bind:x={get, set}`) are the Svelte-native expression of
an authoritative parent, and they only work if the component keeps no shadow state — which fixes the
implementation choice.

**Alternatives considered.** Detecting controlled-ness once at init (`const controlled = value !== undefined`)
and skipping writes — rejected: it silently breaks `bind:value`. A mirror `$state` + sync-back `$effect`
— rejected: it moves first and corrects after, producing a visible flash and an extra `onValueChange`.

---

## R-04 — `bits-ui` `Checkbox.Group` / `Checkbox.Root` evaluated and rejected

**Decision.** Do not compose either; hand-write the item button and its hidden input. Compose
`useDirection()` and `Label.Root` instead.

**Rationale (read from `node_modules/bits-ui/dist/bits/checkbox/checkbox.svelte.js`, v2.18.1).**

| Requirement                                            | `bits-ui` behaviour                                                                        | Verdict                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Veto a change (`readOnly`, declining parent) FR-006/AS-5 | Child mutates `checked`, `watch.pre` pushes into `group.addValue/removeValue`; no veto point | **Blocker**                                |
| `required` ⇒ *at least one* checked, FR-007            | `trueRequired = group.required \|\| own.required` ⇒ *every* box required                    | **Blocker**                                |
| Hidden input inside a form without a `name`, FR-016     | `shouldRender = Boolean(trueName)` — no `name`, no input, no native validation              | **Blocker** (upstream's own `required` test passes no name) |
| Form `reset` ⇒ restore `defaultValue`, clear message    | `HiddenInput` has no reset hook                                                             | **Blocker**                                |
| `onValidate` / `invalid` / message / `orientation` / `dir` | Absent                                                                                    | Would be bespoke anyway                    |
| `aria-invalid`, `data-invalid`, `data-orientation`      | Not emitted                                                                                 | Would be bespoke anyway                    |
| `role="checkbox"`, `type="button"`, `aria-checked`, `data-state`, Space toggles, Enter inert | Emitted correctly                                          | ~25 lines to reproduce                     |

The composable part is ~25 lines of attributes; the non-composable part is the entire value/validation
model. Constitution IV orders "existing component → bits-ui → bespoke" *and* requires the bespoke
justification in writing — this is it. See plan.md "Bespoke behaviour justification".

**Alternatives considered.** Wrapping `Checkbox.Group` with a mirror + sync-back effect — rejected
(R-03 rationale, plus the `required` inversion cannot be fixed from outside: it is derived inside the
child from the group's own `required`, so we would have to leave `required` unset on the group and
compute it per item anyway). Composing `$lib/components/ui/checkbox` — rejected: `WithoutChildrenOrChild`
means no indicator and no item text.

---

## R-05 — Direction: compose this repo's `useDirection()`

**Decision.** `const direction = useDirection({ dir: () => dirProp })` from
`$lib/components/ui/direction-provider/index.js`; render `dir={direction.current}` on the root and pass
`() => direction.current` into the root state.

**Rationale.** Upstream calls `useDirection(dirProp)` from `@diceui/shared`; this repo already ported
that hook including provider lookup, DOM `[dir]` fallback and `MutationObserver` teardown
(`direction-provider.svelte.ts:118-160`). Constitution IV makes composing it mandatory. It never throws
without a provider, so a standalone `<CheckboxGroup.Root>` still works.

**Consequence for `registry.json`.** `registryDependencies` must list `direction-provider`, otherwise a
consumer installing `checkbox-group` gets a broken import (Constitution V).

---

## R-06 — Upstream's 50 ms click debounce is a React artefact; replace it with a proven invariant

**Decision.** No time-based debounce. The item's `onclick` toggles exactly once per native click, and
the test suite proves the invariant upstream's debounce was defending
(`user.click` on the indicator ⇒ `onValueChange` called once; two clicks on the same item ⇒ check then
uncheck).

**Rationale.** Upstream (`checkbox-group-item.tsx:54,77-86`) keeps `lastClickTimeRef` and drops any
click within 50 ms, with the comment "This prevents event bubbling from clicking on the indicator".
That duplicate is possible in React's synthetic delegation over Radix's `Primitive` composition; in
Svelte the handler is a single native listener on the `<button>`, and a click on the indicator `<span>`
bubbles to it as **one** event. Transliterating the window would actively break behaviour: jsdom's
`MouseEvent.timeStamp` and `Date.now()` have millisecond resolution and two `await user.click(item)`
calls routinely land inside 50 ms, so a genuine check→uncheck (spec US1 AS-3) would be swallowed.
Recorded as a divergence in spec Assumptions.

**Alternatives considered.** Dedupe by `event.timeStamp` — rejected: two genuine clicks in the same
millisecond (common in jsdom) would collapse into one. Keep 50 ms and slow the tests with real delays —
rejected: it bakes a wall-clock sleep into the suite to defend behaviour that cannot occur.

---

## R-07 — `Presence`, `useMemo`, `useCallback`, `useComposedRefs`, `composeEventHandlers`

**Decision.** `Presence` ⇒ `{#if forceMount || checked}`. `useMemo`/`useCallback` ⇒ deleted.
`useComposedRefs` ⇒ `ref = $bindable(null)` + `bind:this`. `composeEventHandlers` ⇒ a local
`function onclick(e) { callerOnclick?.(e); if (e.defaultPrevented) return; … }`.

**Rationale.** CLAUDE.md §10's translation table, plus: the port attaches no enter/exit animation to
the indicator, so `Presence`'s only remaining job — keeping a node mounted for its exit animation — has
no work to do; `bits-ui` exports no standalone `Presence` to compose. Upstream's `composeEventHandlers`
runs the consumer's handler first and skips the internal one when `defaultPrevented`
(`shared/src/lib/compose-event-handlers.ts`), which the three-line local function reproduces exactly.

---

## R-08 — `aria-describedby` must not dangle

**Decision.** `Label`, `Description` and `Message` register their id with the root state while they are
actually rendered (`$effect` with a teardown); the root derives
`aria-labelledby = hasLabel ? labelId : undefined` and
`aria-describedby = [hasDescription && descriptionId, isInvalid && hasMessage && messageId].filter(Boolean).join(' ') || undefined`.

**Rationale.** Upstream emits `aria-describedby={`${descriptionId} ${isInvalid ? messageId : ""}`}`
unconditionally (`checkbox-group-root.tsx:172`) — a dangling idref plus a trailing space whenever no
`Description` is rendered, which is the *default* composition in three of the five upstream demos, and
which `hideOnError` guarantees at exactly the moment the description disappears. `axe`'s
`aria-valid-attr-value` fails on it, and Constitution III outranks a bug-for-bug copy. Registration also
gives `Description`/`Message` a single source of truth for "am I in the accessibility tree".

**Alternatives considered.** Emitting upstream's string verbatim — rejected (Principle III). Querying the
DOM for the ids — rejected: not reactive, and SSR-unsafe.

---

## R-09 — The item's accessible name, and where the indicator lives

**Decision.** `checkbox-group-item.svelte` renders

```text
<button role="checkbox" class="… inline-flex items-center gap-2 …">   ← data-slot="checkbox-group-item"
  <span data-slot="checkbox-group-item-box">{@render indicator?.() ?? <Indicator/>}</span>
  {@render children?.()}                                              ← the visible text
</button>
```

so the accessible name comes from content, and the `Indicator` part keeps its own contract
(`forceMount`, `data-state`, `data-disabled`) inside the box.

**Rationale.** Upstream has two content models and neither is directly portable. Its *package* test puts
the text inside the button (`<Item value="kickflip"><Indicator/>Kickflip</Item>` — name from content);
its *registry* item puts the text outside, in a wrapping `<label>` (`ui/checkbox-group.tsx:57-75`).
The second leaves the `<button>` unnamed in browsers: HTML-AAM computes a `button`'s name from its
subtree, not from a wrapping `label` (jsdom's `element.labels`-based fallback makes it *look* fine in
tests, which is worse). Splitting into `indicator` (inside the box) + `children` (beside it) keeps the
consumer-facing markup identical to the upstream registry demos
(`<CheckboxGroupItem value="indy">Indy</CheckboxGroupItem>`), gives every item a name without an
`aria-label`, and avoids authoring a control-less `<label>` that `svelte-check` flags
`a11y_label_has_associated_control` (unsuppressable under Principle VI).

**Alternatives considered.** Reproducing the wrapping `<label>` — rejected (nameless button + a11y
warning). Text inside the 4×4 box — rejected (visually broken). Requiring `aria-label` on every item —
rejected: it duplicates visible text and is easy to forget.

---

## R-10 — `name` on the group as well as the item

**Decision.** `name` is accepted on both `Root` and `Item`; the item's own `name` wins
(`item.name ?? group.name`). The hidden input is only *emitted* when the item is inside a form,
regardless of `name` (a nameless checkbox contributes nothing to `FormData` but still participates in
constraint validation — which is exactly what upstream's `required` test relies on).

**Rationale.** Upstream's item destructures `name` from its own props (`checkbox-group-item.tsx:43`)
and the group has none; spec FR-016 and US3 AS-3 describe a group-level `name="tricks"`. Supporting
both is a strict superset: upstream code keeps working, and the spec's scenario is expressible without
repeating the name on every item. Recorded as a divergence in spec Assumptions.

---

## R-11 — jsdom and native constraint validation

**Decision.** Assert the upstream behaviour directly — `expect(onSubmit).not.toHaveBeenCalled()` after
submitting an empty required group, and `expect(onSubmit).toHaveBeenCalledTimes(1)` after checking one
item — and *additionally* assert the mechanism (`form.checkValidity() === false`, the hidden input's
`validity.valueMissing === true`, and that the input is not `hidden`/`display:none`). If jsdom's
submit-time validation turns out not to gate the `submit` event, the mechanism assertions stay and the
gating assertion is re-expressed through `form.requestSubmit()` — never removed, never `.skip`ped
(Constitution VII anti-cheat).

**Rationale.** jsdom implements the constraint-validation API and the "interactively validate the
constraints" step of form submission, but it is the one behaviour in this port whose environment
support cannot be confirmed by reading source alone. Writing both layers of assertion means the intent
survives either way, and the visually-hidden input must stay off-screen-but-rendered (`position:absolute;
width:1px; height:1px; clip-path:inset(50%)`) because `display:none` and `hidden` make a control
*barred from constraint validation* — the single most common way this pattern silently breaks.

---

## R-12 — Form `reset`

**Decision.** `FormControlState` exposes the item's closest `<form>`; the item registers a `reset`
listener in an `$effect` and calls `root.reset()`, which sets the value back to `defaultValue` and
clears `validationMessage`. Duplicate registration across N items is harmless because `reset()` is
idempotent.

**Rationale.** Upstream wires `onReset` through `VisuallyHiddenInput` → `useFormReset`
(`shared/src/hooks/use-form-reset.ts`), i.e. one listener per item, calling
`context.onReset()` → `setValue(defaultValue ?? [])` + `setValidationMessage(undefined)`
(`checkbox-group-root.tsx:146-149`). `bits-ui`'s `HiddenInput` offers no equivalent (R-04), so this is
the bespoke piece the next form port copies.

---

## R-13 — The multi-selection demo's shift-range helper

**Decision.** Port `useShiftMultiSelect` as
`src/routes/docs/components/checkbox-group/shift-multi-select.svelte.ts` — a small rune-based class
(`selectedValues`, `lastSelected`, a non-reactive `isShiftPressed` field, `onValueChange`,
`onShiftKeyDown`) used only by the demo page. It stays out of `src/lib` and out of `registry.json`.

**Rationale.** Upstream implements it inside the demo file, not the component
(`checkbox-group-multi-selection-demo.tsx:56-140`); the component has no shift-select prop. The spec's
Assumptions already fix this boundary. Its keydown/keyup listeners sit on `CheckboxGroup.List` via
`restProps` — the same limitation as upstream (Shift is only observed while focus is inside the list),
reproduced deliberately rather than "improved", since improving it would require a component-level API
upstream does not have.

---

## R-14 — Demo coverage: five previews, not four

**Decision.** The docs route renders one `<ComponentPreview>` per upstream demo file: **Default,
Animated, Horizontal, With Validation, Multi Selection**. The animated indicator's
`stroke-dashoffset` keyframes go in the page's scoped `<style>` block, not in `src/app.css`.

**Rationale.** Constitution IX binds the section list to the demo files (5), while spec FR-022 named 4;
FR-022 is amended to the superset. Upstream's animated demo asks consumers to extend
`tailwind.config.ts` with a keyframe — a v3 instruction with no v4 equivalent that belongs in a
consumer's theme, not in this repo's global stylesheet. A Svelte scoped `<style>` on the demo page
keeps the animation local, applies to the SVG authored in that page's markup (scoping is compile-time,
so it survives being rendered through the `indicator` snippet), and adds nothing to the registry
payload.

---

## Resolved unknowns summary

| Technical Context item             | Resolution                                                             |
| ---------------------------------- | ---------------------------------------------------------------------- |
| Which primitive backs the item     | None — bespoke button + hidden input, justified (R-04)                 |
| Which primitive backs direction    | `useDirection()` from `direction-provider` (R-05)                      |
| Which primitive backs the label    | `bits-ui` `Label.Root` (R-05, R-09)                                    |
| New npm dependencies               | None (R-04, R-14)                                                      |
| Controlled-mode semantics          | `bind:value` / function binding; no shadow state (R-03)                |
| Environment risk                   | jsdom constraint validation, double-layer assertions (R-11)            |
</content>
