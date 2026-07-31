# Phase 0 Research: Port Editable

**Feature**: `023-port-editable` | **Date**: 2026-07-31

**Upstream pin**: `sadmann7/diceui` @ `d9763d82530416dfa4c81c462387b55d06bae4ec`

Sources read in full:

| File                                                                | Role                                              |
| ------------------------------------------------------------------- | ------------------------------------------------- |
| `.reference/diceui/docs/registry/bases/radix/ui/editable.tsx`        | the implementation (829 lines, 9 parts + 2 hooks) |
| `.reference/diceui/docs/registry/bases/radix/test/editable.test.tsx` | 15 tests — the assertion floor                    |
| `.reference/diceui/docs/content/docs/components/radix/editable.mdx`  | the API + data-attribute + keyboard contract      |
| `.reference/diceui/docs/registry/bases/radix/examples/editable-*.tsx` | 5 demos → 5 `<ComponentPreview>` sections         |

Local conventions read: `CLAUDE.md`, `.specify/memory/constitution.md`,
`.agents/skills/shadcn-svelte/rules/{styling,composition,forms,icons}.md`, and the ported
`tags-input`, `checkbox-group`, `time-picker` components.

The spec contains zero `[NEEDS CLARIFICATION]` markers, so Phase 0 resolves implementation-level
unknowns rather than requirement-level ones.

---

## R-01 — Replacing upstream's hand-rolled `Store`

**Decision**: Drop the `Store` / `useSyncExternalStore` / `useLazyRef` / `useAsRef` machinery entirely.
`{ value, editing }` become two `$state` fields on a single `EditableRootState` class in
`editable.svelte.ts`, published through one `Symbol`-keyed context.

**Rationale**: The store exists purely so `EditablePreview` re-renders on `value` while
`EditableTrigger` re-renders only on `editing`. Svelte 5's signal graph gives that granularity for
free — a part that reads `state.editing` is not invalidated when `state.value` moves. Keeping the
store would be a transliteration, forbidden by the porting rules.

**Consequence for parity**: upstream's `setState` short-circuits on `Object.is` equality, so
`onValueChange` / `onEditingChange` fire only on an *actual* change. That guard is reproduced
explicitly in `setValue` / `setEditing` (it is observable: submitting an unchanged value must fire
`onSubmit` but must NOT fire `onValueChange`).

**Alternatives considered**: two separate contexts mirroring `StoreContext` + `EditableContext` —
rejected, there is nothing for the split to buy in Svelte and it doubles the throwing getters.
`useStore` is not re-exported as a public hook (spec Assumptions); `bind:value` / `bind:editing`
covers the same need.

---

## R-02 — Controlled / uncontrolled for two independent pieces of state

**Decision**: `value` and `editing` are both `$bindable()`, each seeded once from its `default*`
counterpart through `untrack`, exactly as `tags-input.svelte` does:

```ts
value ??= untrack(() => defaultValue);
editing ??= untrack(() => defaultEditing);
```

Writes go through a setter that assigns the bindable and then calls the callback prop.

**Rationale**: This is the repo-wide idiom (constitution I, CLAUDE.md §4). It gives three usages from
one implementation: uncontrolled (`defaultValue` only), two-way (`bind:value`), and fully authoritative
(the function binding `bind:value={() => v, (next) => …}`, where a setter that declines the write
leaves the field exactly where it was — upstream's controlled-prop-wins layout effect, without the
effect).

**Alternatives considered**: mirroring upstream's `useIsomorphicLayoutEffect(() => store.setState(...))`
sync — rejected: writing reactive state inside an effect where the binding already does it is
explicitly forbidden by the porting rules and would double-fire the callbacks.

---

## R-03 — Focus / select / autosize when edit mode starts

**Decision**: `$effect.pre` inside `editable-input.svelte`, guarded on
`editing && !disabled && !readOnly && inputElement`, scheduling `requestAnimationFrame` and returning
`() => cancelAnimationFrame(id)`. The frame body calls `focus()`, `select()`, then `autosize()`.

**Rationale**: A direct translation of upstream's `useIsomorphicLayoutEffect` +
`requestAnimationFrame` + cancel cleanup (`editable.tsx:615-629`). The frame is upstream's own and
must stay: the input is mounted by the same state change that flips `editing`, and focusing it in the
same tick races the browser's own focus handling on the element that was just unmounted. `$effect.pre`
is CLAUDE.md §10's mapping for `useLayoutEffect`.

**Test consequence**: `tests/setup.ts` already runs in jsdom; `requestAnimationFrame` is native there.
Tests await it with `await vi.waitFor(...)` / `await tick()` rather than mocking rAF into a
`setTimeout` the way the upstream test file does.

**Alternatives considered**: `bits-ui`'s focus utilities and an `autofocus` attribute — rejected,
neither selects the content, and `autofocus` is unreliable when the element mounts inside an already
focused document.

---

## R-04 — Focus restoration on cancel (upstream has none)

**Decision**: `EditableRootState` records the element that started the edit (`triggerElement`, a plain
non-reactive field written by `edit(trigger)`), and `cancel()` restores focus to it after the preview
re-mounts (`await tick()`, then `triggerElement?.focus()`; falls back to the preview element when the
recorded element has since unmounted).

**Rationale**: Spec FR-007 and SC-003 require it, and it is a WAI-ARIA baseline (constitution III:
"focus order MUST be predictable"). Upstream simply lets focus fall to `<body>` when the input
unmounts, which is a defect, not a contract. Recorded as divergence **D-1** — an *addition*, so no
upstream behaviour is lost.

**Alternatives considered**: restoring focus on submit as well — rejected. Upstream does not, the spec
does not ask for it, and submitting by blur (the common case) means focus has deliberately moved to
another control; stealing it back would be worse than the status quo.

---

## R-05 — `maxLength` never reaches the input upstream

**Decision**: `editable-input.svelte` applies `maxlength={maxLength ?? root.maxLength}` — its own prop
first, the root's as fallback.

**Rationale**: Upstream puts `maxLength` into the context (`editable.tsx:274`) and then never reads
it: `EditableInput` destructures its *own* `maxLength` prop and renders `maxLength={maxLength}`
(`editable.tsx:648`). A root-level `maxLength` is therefore dead upstream, while both the MDX and spec
FR-012 document it as a root prop. Fixing it is required by FR-012. Recorded as divergence **D-2**.

**Alternatives considered**: reproducing the dead prop for byte-parity — rejected, it contradicts a
functional requirement and the upstream's own documentation.

---

## R-06 — `aria-controls` points at an id that may not exist upstream

**Decision**: the root always renders `id={id ?? uid}`, where `uid = $props.id()`.

**Rationale**: Upstream computes `rootId = id ?? instanceId` and hands it to
`EditableTrigger`/`EditableToolbar`/`EditableCancel`/`EditableSubmit` as `aria-controls`, but renders
`id={id}` on the root — so when the caller passes no `id`, four parts point `aria-controls` at a
non-existent element. Always rendering the resolved id makes the reference resolve, which is what the
attribute means. Recorded as divergence **D-3**.

**Ids**: one `$props.id()` call yields `uid`; `inputId = `${uid}-input``, `labelId = `${uid}-label``.
Upstream burns three `useId()` calls; one plus suffixes is the repo idiom (`tags-input`,
`time-picker`) and keeps the ids readable in the DOM.

---

## R-07 — `EditableTrigger` is inert under `triggerMode="focus"` upstream

**Decision**: the trigger activates on click when `triggerMode` is `"click"` **or** `"focus"`, and on
double click when `triggerMode` is `"dblclick"`.

**Rationale**: Upstream wires `onClick` only for `"click"` and `onDoubleClick` only for `"dblclick"`
(`editable.tsx:692-693`), so a `triggerMode="focus"` root renders an explicit "Edit" button that does
nothing at all. Spec FR-014 explicitly requires the trigger to remain a click/double-click activator
under `triggerMode="focus"`, because focus-triggering a button the user must focus to press is not a
meaningful interaction. Recorded as divergence **D-4**.

**Alternatives considered**: also firing on focus in `"focus"` mode — rejected: `Tab`bing past the
button would silently open the editor.

---

## R-08 — Direction

**Decision**: compose `useDirection({ dir: () => dir, element: () => ref })` from
`$lib/components/ui/direction-provider`, and render `dir={root.dir}` on the area and the input, as
upstream does.

**Rationale**: Constitution IV — `direction-provider` is an existing registry item that already
reproduces `DirectionPrimitive.useDirection` (nearest provider → DOM `[dir]` → `"ltr"`). Nothing is
re-implemented. It becomes `registryDependencies: ["direction-provider"]`.

**RTL scope**: the component has no left/right-sensitive key, so nothing inverts; RTL is a rendering
concern only (spec FR-019). The upstream RTL test asserts exactly that (`dir="rtl"` on the group and
the textbox).

---

## R-09 — Form association

**Decision**: compose `FormControlState` from `$lib/components/ui/checkbox-group` for "am I inside a
`<form>`", and render one clipped `<input type="text" data-slot="editable-form-input">` carrying
`name` / `value` / `disabled` / `required` / `readonly`, plus the `input`-event dispatch the other
ports use so form libraries observe the value.

**Rationale**: Constitution IV plus the pattern already set by `tags-input`, `phone-input` and
`time-picker`. Upstream's `VisuallyHiddenInput type="hidden"` is *not* copied: `type="hidden"` is
barred from constraint validation, which would make FR-017's native `required` block unreachable.
Already recorded in the spec's Assumptions; carried here as divergence **D-5**.

**Alternatives considered**: `bits-ui`'s `HiddenInput` — same `type="hidden"` problem, and it has no
form-detection half.

---

## R-10 — `asChild` → the `child` snippet

**Decision**: every one of the nine parts takes an optional
`child?: Snippet<[{ props: Editable<Part>ChildProps }]>`, following `tags-input-clear.svelte`
verbatim: the merged attribute object is built once in a `$derived`, rendered either through
`{@render child({ props })}` or onto the default element with `bind:this={ref}`.

**Rationale**: CLAUDE.md §10 and the composition rules. Four of the five upstream demos use
`asChild` to render `EditableTrigger` / `EditableSubmit` / `EditableCancel` as a `<Button>`; without
the snippet those demos cannot be reproduced (constitution IX).

**Note**: in `child` mode `ref` stays `null` and `children` is not rendered — the caller owns the
element. Documented on every part's `child` JSDoc, as `tags-input` does.

---

## R-11 — Native handler composition

**Decision**: no new callback props for native events. Each part destructures the specific handler it
must compose (`onclick`, `ondblclick`, `onfocus`, `onkeydown`, `onblur`, `oninput`) out of
`restProps`, calls the caller's handler first, and returns early on `event.defaultPrevented`.

**Rationale**: This is upstream's `propsRef` + `event.defaultPrevented` pattern (used on every part)
expressed with Svelte's lowercase event props, and it matches how `tags-input.svelte` composes
`onclick`/`onmousedown`/`onfocusout`. Spec Assumptions already record it.

**`onChange` → `oninput`**: React's `onChange` on a text input is the native `input` event.

---

## R-12 — Keeping a read-only input's DOM value pinned

**Decision**: the input is *not* `bind:value`. It renders `value={root.value}` and handles `oninput`,
which returns early when disabled or read-only **and** re-pins `event.currentTarget.value = root.value`
so a rejected keystroke cannot leave the DOM out of sync with state.

**Rationale**: Upstream's `onChange` returns early under `isDisabled || isReadOnly`, and React then
re-renders the controlled input back to the store value. Svelte will not re-render an unchanged
`value`, so the resync must be explicit. The same resync protects the authoritative function-binding
case, where the parent declines a write.

---

## R-13 — Autosize

**Decision**: one `autosize(target)` method on the state class, called from `oninput` and from the
edit-start frame (R-03). `HTMLTextAreaElement` → `style.height = '0'` then `scrollHeight`px;
otherwise `style.width = '0'` then `scrollWidth + 4`px. The input's class is `w-auto` when
`autosize`, `w-full` otherwise.

**Rationale**: Byte-for-byte upstream (`editable.tsx:537-550`, `:656`). The `textarea` branch is kept
even though the default element is an `<input>`, because a consumer can render a textarea through the
`child` snippet. The upstream test asserts the `w-auto` class, which is the only part of autosize that
is observable in jsdom (`scrollWidth` is always 0 there) — so the class assertion is the test, and the
measurement is exercised only through the demo page.

---

## R-14 — Which parts unmount

**Decision**, transcribed from upstream:

| Part      | Rendered when                          |
| --------- | -------------------------------------- |
| `Preview` | `!editing && !readOnly`                |
| `Input`   | `editing \|\| readOnly`                |
| `Trigger` | `forceMount \|\| (!editing && !readOnly)` |
| `Cancel`  | `editing \|\| readOnly`                |
| `Submit`  | `editing \|\| readOnly`                |
| `Label`, `Area`, `Toolbar` | always                |

Removal is `{#if}` — genuinely out of the DOM and the accessibility tree, not `hidden` (spec FR-005,
FR-016; the upstream tests assert `not.toBeInTheDocument()`).

---

## R-15 — Blur submission and its two exceptions

**Decision**: `onblur` submits `root.value` unless `event.relatedTarget` is an `HTMLElement` that
matches `closest('[data-slot="editable-trigger"]')` or `closest('[data-slot="editable-cancel"]')`.

**Rationale**: Verbatim upstream (`editable.tsx:552-571`). The exceptions exist because those two
buttons own the resulting state change themselves; letting blur submit first would commit the value
the cancel button is about to discard. The `data-slot` selectors are the same strings we already emit,
so the guard keeps working when a part is rendered through the `child` snippet onto a `<Button>` —
`data-slot` travels with the spread props.

---

## R-16 — Test strategy

**Decision**: `editable.test.ts` (the spec, collected by Vitest) + `editable.test.svelte` (a harness
component, not collected — `include` is `src/**/*.{test,spec}.{js,ts}`), matching `tags-input`.

**Rationale**: `bind:value` / `bind:editing`, a `<form>` ancestor, a `child` snippet, and each part
rendered with no root above it cannot be expressed by `render(Component, { props })`; they need real
markup. Harness modes: `default`, `with-trigger`, `with-form`, `child-buttons`, and one
`bare-<part>` mode per part for the FR-018 throw tests.

**Interaction driver**: `@testing-library/user-event` throughout, per constitution III. The upstream
test file uses `fireEvent` for everything, including `fireEvent.change`, `fireEvent.focus` and
`fireEvent.blur`; those are re-expressed as `user.click`, `user.dblClick`, `user.type`, `user.tab`
and `input.blur()`-via-`user.click(elsewhere)` so the events carry a real `relatedTarget` (which R-15
depends on and `fireEvent.blur` cannot provide). `fireEvent` is retained only where no user gesture
can produce the event — specifically a blur whose `relatedTarget` must be `null`.

**Upstream assertion mapping**: all 15 upstream tests map onto our suite; see
`contracts/upstream-test-map.md`.

---

## R-17 — Zero new npm dependencies

**Decision**: none added.

- `radix-ui` (upstream's `Slot` + `Direction`) → the `child` snippet (R-10) and `direction-provider`
  (R-08).
- `@diceui/shared`-style helpers (`compose-refs`, `use-as-ref`, `use-lazy-ref`,
  `use-isomorphic-layout-effect`) → `$bindable` refs, plain fields, and `$effect.pre` (R-03).
- `@lucide/svelte` is already a dependency and is used **only by the demo page** (the todo-list demo's
  `Edit` / `Trash2` icons), so it is not a registry dependency of the component itself.

`registryDependencies` therefore: `["direction-provider", "checkbox-group"]`. `dependencies`: `[]`.
