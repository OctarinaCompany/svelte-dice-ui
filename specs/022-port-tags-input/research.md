# Phase 0 Research — Port Tags Input

Every unknown raised by the Technical Context is resolved below. No `NEEDS CLARIFICATION` remains.

Sources read at the pinned upstream commit `d9763d82530416dfa4c81c462387b55d06bae4ec`:

- `.reference/diceui/packages/tags-input/src/*.tsx` (7 files) and `test/tags-input.test.tsx`
- `.reference/diceui/docs/registry/bases/radix/ui/tags-input.tsx`
- `.reference/diceui/docs/content/docs/components/radix/tags-input.mdx` and `docs/types/radix/tags-input.ts`
- `.reference/diceui/docs/registry/bases/radix/examples/tags-input-{,editable-,validation-,sortable-}demo.tsx`
- `.reference/diceui/packages/shared/src/components/visually-hidden-input.tsx`
- Ported precedents in this repo: `checkbox-group`, `direction-provider`, `phone-input`, `segmented-input`, `speed-dial`

---

## R-01 — Is there a `bits-ui` primitive to compose?

**Decision**: No. The component is written from scratch against this repo's own primitives.

**Rationale**: `bits-ui` ships no tags/token input, and none of the 58 folders under
`src/lib/components/ui/` covers it. What upstream imports from `@diceui/shared` splits into three
buckets: (a) already ported here — `useDirection` → `direction-provider`, `useFormControl` →
`FormControlState` in `checkbox-group`, both **composed**; (b) React plumbing with no Svelte analogue —
`createContext`, `useControllableState`, `useComposedRefs`, `composeEventHandlers`, `Primitive.*`,
`useId`, replaced by the conventions in CLAUDE.md §4/§5/§10; (c) genuinely bespoke — the caret-aware
keyboard state machine and the add/validate/dedupe/max pipeline.

**Alternatives considered**: wrapping `bits-ui`'s `Combobox` (rejected: it owns an open/filter model
the tags input does not have, and its item focus model moves DOM focus, which this widget must not do);
a DOM collection query over `[data-slot="tags-input-item"]` to replace `useItemCollection` (rejected —
see R-06).

## R-02 — Controlled vs uncontrolled (`useControllableState`)

**Decision**: `value = $bindable()` seeded once with `value ??= untrack(() => defaultValue)`; every
mutation goes through one `setValue(next)` that assigns `value` and then calls `onValueChange?.(next)`.
The state class reads the value through `getValue: () => value ?? []` — there is **no** mirror `$state`.

**Rationale**: This is the pattern `checkbox-group.svelte` established and `phone-input` repeated. With
no mirror, a parent using the function binding `bind:value={() => tags, (next) => …}` that declines a
write leaves the rendered list exactly where it was — the Svelte equivalent of React's controlled-prop
authority (spec FR-002, US-controlled scenario). `untrack` on the seed makes the one-shot nature
explicit; reading `defaultValue` bare would look reactive but capture only the initial value.

**Alternatives considered**: an internal `$state` synced by `$effect` (rejected: writes state it reads,
and a controlled parent could no longer decline a change).

## R-03 — Where does the typed input text live?

**Decision**: In the DOM, uncontrolled — exactly as upstream. Handlers read
`event.currentTarget.value` and clear it by assigning `element.value = ''`. No `$bindable` input value
is added to the public API.

**Rationale**: Upstream's `TagsInputInput` never controls its own value; it mutates the DOM node in
`onChange`/`onBlur`/`onCustomKeydown`. Introducing a bindable `inputValue` would be new public API
(Principle II) and would fight `user-event`'s typing model in tests. The delimiter-commit path
(`delimiter === target.value.slice(-1)`) depends on reading the raw DOM value, which stays exact.

**Alternatives considered**: `bind:value` on the input plus a `$state` mirror (rejected: new API surface
and an extra flush between keystroke and commit).

## R-04 — `requestAnimationFrame` in upstream callbacks

**Decision**: Replace per call site rather than wholesale.

| Upstream call site                                          | Here                                                                 |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| `onItemUpdate` → `rAF(() => inputRef.focus())`              | `await tick()` then focus — the edit field must unmount first          |
| `Item.onDoubleClick` → `rAF(() => setEditingIndex(index))`  | set directly; nothing needs to re-render before the assignment         |
| `Escape` / `ArrowRight`-off-the-end → `rAF(setSelectionRange(0,0))` | call synchronously on the same input element — no re-render involved |
| root `onBlur` → `rAF(() => setHighlightedIndex(null))`      | keep a `rAF`; it exists to let focus settle on the new target, not to await a render |

**Rationale**: React needs `rAF` because the DOM it wants to touch has not been committed yet. In
Svelte the only equivalent need is "after the next flush", which is `tick()`. Keeping a raw `rAF` where
no flush is involved would make the tests depend on timer flushing for no behavioural gain; keeping it
where focus ordering genuinely matters preserves upstream behaviour.

**Alternatives considered**: `tick()` everywhere (rejected: `tick()` does not help the blur case, which
waits on the browser's focus transfer, not on Svelte); `rAF` everywhere (rejected: forces
`await new Promise(requestAnimationFrame)` into otherwise synchronous tests).

## R-05 — Direction resolution

**Decision**: `useDirection({ dir: () => dir, element: () => ref })` from
`$lib/components/ui/direction-provider/index.js`, exposed to the state class as `getDir`. The root
renders `dir={direction.current}` and the input inherits it, as upstream does.

**Rationale**: Composition (Principle IV) — the reader already implements
`override ?? provider ?? DOM [dir] ?? 'ltr'` with a `MutationObserver` teardown, which is exactly
`useDirection`. `checkbox-group` and `phone-input` both consume it this way. Adds
`direction-provider` to `registryDependencies`.

## R-06 — Replacing `useItemCollection` / `getEnabledItems`

**Decision**: Each `<TagsInput.Item>` registers `{ value, disabled }` with the root in an `$effect`
whose teardown unregisters it. Navigation runs over real value indices via
`findAdjacentIndex({ current, count, direction, loop, isEnabled })`, where
`isEnabled(i) = !disabledValues.has(value[i])`.

**Rationale**: The tags input's items *are* its value array, so a DOM collection would re-derive
information the root already holds and add an ordering dependency. Registration by tag value (not by
index) survives insertion and removal anywhere in the list. This also fixes an upstream defect:
`findNextEnabledIndex` builds `enabledIndices = enabledItems.map((_, index) => index)`, i.e.
`[0..enabledCount-1]`, and then treats those positions as value indices — correct only while no item is
disabled (true of every upstream demo), shifted otherwise. Divergence **D-5**, pre-recorded in the spec's
Assumptions.

**Alternatives considered**: `root.querySelectorAll('[data-slot="tags-input-item"]')` on each keystroke
(rejected: SSR-unsafe, and it would faithfully reproduce the index-shift bug).

## R-07 — Highlight / edit state ownership

**Decision**: `highlightedIndex: number | null` and `editingIndex: number | null` are `$state` fields on
`TagsInputRootState`. `TagsInputItemState` derives `isHighlighted` / `isEditing` by comparing its own
index; nothing per-item is stored on the root.

**Rationale**: Mirrors upstream's context shape (`highlightedIndex` + `setHighlightedIndex` on the root)
and keeps a single source of truth, so `Home`/`End`/arrow navigation never needs to walk the items.

## R-08 — Add / update pipeline order (exact parity)

**Decision**: Reproduce upstream's ordering literally, including its asymmetries:

- **Guard** — `disabled || readOnly` → return `false` before anything else.
- **Paste path** (`addOnPaste && viaPaste`): split on `delimiter` → `trim` → drop empties; if
  `value.length + split.length > max && max > 0` → `onInvalid(rawPastedText)`, return `false`; call
  `onInvalid(v)` once per candidate already present; dedupe against existing **and** against itself;
  filter through `onValidate`; if nothing survives return `false`; otherwise one single `setValue`.
  This path does **not** touch `isInvalidInput`, `highlightedIndex` or `editingIndex`.
- **Single path**: `value.length >= max && max > 0` → `onInvalid(rawText)` (untrimmed), return `false`
  → then `trim` → `onValidate` false → `isInvalidInput = true`, `onInvalid(trimmed)`, return `false`
  → duplicate → `isInvalidInput = true`, `onInvalid(trimmed)`, **return `true`** → otherwise append,
  clear `highlightedIndex`/`editingIndex`, `isInvalidInput = false`, return `true`.

**Rationale**: The `true` on duplicate is deliberate upstream: the Input clears its text on a truthy
return, so a duplicate is swallowed rather than left in the field. Spec FR-003 codifies exactly this
("a duplicate hit still clears the input the same way upstream does, without adding it twice"). The
max check preceding the trim, and receiving the untrimmed text, is likewise upstream behaviour and is
observable through `onInvalid`.

**Update path**: same duplicate (excluding self) and `onValidate` checks, then store the **raw trimmed**
value — divergence **D-3** — set `highlightedIndex = index`, `editingIndex = null`,
`isInvalidInput = false`, and refocus the text input after `tick()`.

## R-09 — Editing must replace, not append

**Decision**: `Enter` inside the edit field commits through `updateItem(index, editValue)`, replacing
the tag in place. The upstream test's expectation
(`toHaveBeenLastCalledWith(["initial tag", "edited tag"])`, with the comment "the component appends the
edited tag rather than replacing") is **not** ported.

**Rationale**: The MDX, upstream's own `onItemUpdate` implementation (`newValues[index] = updatedValue`)
and spec US4 AS-2 / FR-009 all specify replacement. The append is an artefact of the edit field's blur
handler clearing `editingIndex` before the keystroke lands during `user.clear()` + retype. Porting a
defect that contradicts the documented contract would violate Principle II, not satisfy it. Divergence
**D-4**; the ported test states the one-line reason inline, as the Quality Gates section permits.

## R-10 — Inline edit field as its own component file

**Decision**: `tags-input-item-edit.svelte`, rendered by `tags-input-item-text.svelte` inside
`{#if isEditing && editable && !disabled}`.

**Rationale**: The edit field seeds `editValue = $state(item.displayValue)` at creation. A `$state`
declared in `tags-input-item-text.svelte` would be created once for the item's lifetime and would keep
a stale value the second time editing starts; a separate component inside the `{#if}` is created and
destroyed with the block, which is the Svelte equivalent of upstream's conditionally mounted
`TagsInputEditableItemText`. It also satisfies CLAUDE.md §3 ("never put two components in one
`.svelte` file"). It stays out of the barrel because upstream does not export it either.

The field keeps upstream's auto-width behaviour (`width: 0` then `scrollWidth + 4`) on focus and input,
written as a plain handler on the element — no observer, so nothing to tear down.

## R-11 — Form association and native `required`

**Decision**: Compose `FormControlState` from `$lib/components/ui/checkbox-group/index.js` for the
"am I inside a `<form>`, and which one" question, and render one clipped
`<input type="text" tabindex={-1} aria-hidden="true">` carrying `name`, `required`, `disabled`,
`readonly` and `value={value.join(',')}` — the same comma join React produces when upstream passes the
array to `VisuallyHiddenInput`. Value changes additionally dispatch a native `input` event through the
element, as `phone-input` does, so form libraries observing the form see the change.

**Rationale**: Upstream renders `type="hidden"`, which browsers exclude from constraint validation, so
FR-016's "native `required` validation blocks submission of an empty, required tag list" is
unreachable with it. A clipped (not `display:none`) text input is focusable, so the browser can report
and focus the invalid control — this is precisely the pattern `checkbox-group-item.svelte` already
ships. Divergence **D-7**. `registryDependencies` gains `checkbox-group`, which the repo's
import/registryDependency verifier requires.

**Form reset**: upstream passes no `onReset` to `VisuallyHiddenInput` for the tags input, so a native
form reset does not restore `defaultValue` upstream. Parity is kept — no `reset` listener is added.

**Alternatives considered**: one hidden input per tag so `FormData.getAll(name)` yields the array
(rejected: better HTML semantics, but a silent, undocumented change to what the server receives —
exactly the drift Principle II forbids); `type="hidden"` verbatim (rejected: fails FR-016).

## R-12 — ARIA attributes on non-semantic elements

**Decision**: `<TagsInput.Item>` renders a `<div>` carrying `aria-labelledby`, `aria-current` and
`aria-disabled`, spread from a `$derived` object rather than written literally on the element.

**Rationale**: Upstream emits these on `Primitive.div`, and the MDX's data-attribute table depends on
that element. Written literally, Svelte's `a11y_role_supports_aria_props` check rejects
`aria-labelledby` on an element whose implicit role is `generic`, and `svelte-ignore` is a Constitution
violation. `checkbox-group.svelte` already solved this by spreading the superset object — the emitted
DOM is identical, the static analyser simply cannot see through the spread. Adding a role
(`listitem`/`option`) instead would change upstream's accessibility tree.

## R-13 — `asChild` coverage

**Decision**: A `child` snippet on **`Clear` only**.

**Rationale**: `asChild` is not part of the documented prop surface (`docs/types/radix/tags-input.ts`
exposes only the component-specific props); it arrives implicitly through `Primitive.*`. Exactly one
upstream demo uses it — `tags-input-editable-demo.tsx` renders `<TagsInputClear asChild><Button …>` —
and Principle IX requires that demo to be reproduced. Every other part renders its own element, which
callers restyle through `class` and `restProps`. `speed-dial`'s `child?: Snippet<[{ props }]>` shape is
copied verbatim, including the rule that `children` is not rendered and `ref` stays `null` in `child`
mode.

## R-14 — Clear-button presence and `forceMount`

**Decision**: `{#if forceMount || count > 0}` around the button; `data-state` still reports
`visible`/`invisible` from the live count, so a force-mounted button in an empty list renders as
`data-state="invisible"`.

**Rationale**: Upstream wraps the button in `Presence present={forceMount || value.length > 0}`, whose
only job here is deferring unmount for exit animations. `bits-ui`'s presence utilities are bound to its
own open-state primitives and cannot be pointed at an arbitrary boolean. `forceMount` remains the
documented escape hatch for consumers who want to animate, which is what the upstream JSDoc promises.
Spec FR-012 and US2 AS-3 describe exactly this behaviour.

## R-15 — Label registration

**Decision**: `<TagsInput.Label>` registers with the root in an `$effect`; the input emits
`aria-labelledby={labelId}` only while a label is registered.

**Rationale**: Upstream emits it unconditionally, so a tags input used without a `<TagsInputLabel>` has
`aria-labelledby` pointing at an id that is not in the document — the accessible name computation then
returns empty and shadows any `aria-label` the caller put on the input. `checkbox-group` already
established `registerLabel()` returning its own teardown. Divergence **D-6**; the `<label for>`
association, which is what upstream's own test asserts (`getByLabelText("Tags")`), is unchanged.

## R-16 — Root pointer handling

**Decision**: Port upstream's `getIsClickedInEmptyRoot` as
`!target.closest('[data-slot="tags-input-item"]') && target.tagName !== 'INPUT'`, used by the root's
`onclick` (focus the text input) and `onmousedown` (`preventDefault`, so the root cannot steal focus).

**Rationale**: `DATA_ITEM_ATTR` (`data-dice-collection-item`) has no counterpart here; `data-slot` is
this repo's per-part marker (Principle VIII) and is on the item element already. `closest` rather than
`hasAttribute` additionally covers a mousedown landing on the item's text span, which upstream's item
`onClick`-level `stopPropagation` happens to cover only for clicks.

## R-17 — Styling map (upstream registry component → semantic tokens)

| Upstream                                                                     | Here                                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `border-input bg-background focus-within:ring-1 focus-within:ring-ring`      | unchanged (already semantic) — used by the demo's list wrapper     |
| `focus-within:ring-zinc-500 dark:focus-within:ring-zinc-400`                 | `focus-within:ring-ring`                                           |
| `[&[data-highlighted]:not([data-editing])]:bg-zinc-200 … dark:bg-zinc-800`   | `[&[data-highlighted]:not([data-editing])]:bg-accent` + `text-accent-foreground` |
| `data-editing:ring-1 data-editing:ring-zinc-500 dark:ring-zinc-400`          | `data-editing:ring-1 data-editing:ring-ring`                       |
| `placeholder:text-zinc-500 dark:placeholder:text-zinc-400`                   | `placeholder:text-muted-foreground`                                |
| `ring-offset-zinc-950`                                                       | `ring-offset-background`                                           |
| `text-zinc-800 dark:text-zinc-300 hover:bg-zinc-100/80 …` (Clear)            | the demo composes `<Button variant="outline">` through `child`     |
| `h-4 w-4` / `h-3.5 w-3.5`                                                    | `size-4` / `size-3.5`                                              |

No `dark:` variant survives, no raw palette colour is used, and no new token is needed (Principle VIII,
CLAUDE.md §6).

## R-18 — The "With Sortable" demo without a `Sortable` component

**Decision**: Reproduce the composition with native HTML5 drag-and-drop held entirely in the demo page:
each `<TagsInput.Item>` gets `draggable="true"` plus `ondragstart`/`ondragover`/`ondrop` that reorder
the page's `$state` array, with `Alt+ArrowLeft`/`Alt+ArrowRight` as the keyboard equivalent so the
example is not pointer-only.

**Rationale**: `src/lib/components/ui/` has no drag/reorder primitive (all 58 folders checked), and
porting upstream's `Sortable` (built on `@dnd-kit/core`) is a separate component and a new npm
dependency — out of scope for this feature and forbidden by the zero-new-dependency constraint. Spec
Assumptions already authorises this substitution: what the section documents is that the tag list can
be reordered by an outside owner while `TagsInput` keeps managing add/remove, and that survives intact.
The demo page states the substitution in its description so nobody reads it as upstream parity.

## R-19 — Test strategy

**Decision**: `tags-input.test.ts` (Vitest, collected) + `tags-input.test.svelte` (harness, not
collected because Vitest's `include` is `.{js,ts}`, and not listed in `registry.json`). The harness
exposes a `mode` prop for: the default composition, `bind:value`, the function binding, a `<form>`
ancestor, and one bare-part mode per part for the provider-error assertions.

Coverage plan, mapping the six CLAUDE.md §7 areas onto spec requirements:

| Area                  | Assertions                                                                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roles / ARIA          | label↔input association, `aria-labelledby` on item and delete button, `aria-controls`, `aria-current`, `aria-disabled`, `aria-readonly`, and every `data-*` in the MDX tables |
| Keyboard              | `Enter`, `Escape`, `Backspace` (highlight-then-remove), `Delete`, `ArrowLeft`/`ArrowRight` incl. caret-position gating and the `loop` wrap, `Home`, `End`, `Tab` with and without `addOnTab`, and "typing clears the highlight" |
| Uncontrolled          | `defaultValue` seeds; add/remove/clear mutate it                                                                                                                             |
| Controlled            | `bind:value` moves the parent; the function binding declines a write and the list does not move; `onValueChange` fires with the next value in both modes                      |
| RTL                   | `dir="rtl"` inverts `ArrowLeft`/`ArrowRight`, using the upstream navigation cases                                                                                             |
| Guard rails           | `disabled` and `readOnly` suppress add/remove/clear/edit; each of the six parts rendered bare throws `/within/`                                                               |
| Spec-specific         | `max`, `onValidate`, duplicate → `onInvalid` + `data-invalid` (SC-003); `addOnPaste` splitting/dedup in one update (SC-002); `blurBehavior` add/clear/unset; `editable` double-click and `Enter`-to-edit, `Escape` discard, `Enter` replace (D-4); `displayValue` render-only (D-3); per-item `disabled` skipped by navigation (D-5); `forceMount`; hidden input carries the value and blocks submit while empty+required |

**Rationale**: The upstream test file's assertions are the floor (Principle III). Its `renderTagsInput`
render-prop helper becomes the harness's default mode; its two expectations that encode upstream
defects (D-4 editing-appends, and the `data-dice-collection-item` selector) are replaced with the
documented behaviour and this repo's `data-slot` selector.

## R-20 — Reusable module surface (deliverable 5)

**Decision**: Export `splitByDelimiter(text, delimiter)` and
`findAdjacentIndex({ current, count, direction, loop, isEnabled })` as pure functions from
`tags-input.svelte.ts`, alongside the state classes and context helpers.

**Rationale**: `findAdjacentIndex` is the "move to the next enabled index, optionally wrapping, else
null" primitive that upstream re-implements per component; the later Combobox and Mention ports need
the same traversal, and a pure function is trivially testable and carries no reactivity. Everything
else the port needs is component-specific and stays private.
