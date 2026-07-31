# Phase 0 Research: Key Value

**Feature**: `024-port-key-value` | **Date**: 2026-07-31

**Upstream contract** (pinned commit `d9763d82530416dfa4c81c462387b55d06bae4ec`):

| Artifact  | Path                                                                    |
| --------- | ----------------------------------------------------------------------- |
| Source    | `.reference/diceui/docs/registry/bases/radix/ui/key-value.tsx`          |
| Docs      | `.reference/diceui/docs/content/docs/components/radix/key-value.mdx`    |
| Demos     | `.reference/diceui/docs/registry/bases/radix/examples/key-value-*.tsx`  |
| Reference | `src/lib/components/ui/{editable,tags-input,checkbox-group}/`           |

Upstream ships **no test file** for `key-value` (`find .reference/diceui -name "*key-value*" -path "*test*"`
returns nothing), so there is no upstream assertion floor to port. The floor is instead constitution
Principle III's six mandatory areas plus every documented prop.

The `base` and `radix` variants of `key-value-*.tsx` are byte-identical for this port's purposes; the
radix source is treated as the single contract (spec Assumptions).

---

## R-01 — Replacing upstream's `useSyncExternalStore` store

**Decision**: Two state classes in `key-value.svelte.ts` — `KeyValueRootState` (list value, errors,
focus bookkeeping, all configuration) and `KeyValueItemState` (one per row, published by an internal
provider component) — each published on a `Symbol`-keyed context with a throwing getter.

**Rationale**: Upstream builds a hand-rolled `Store` (`key-value.tsx:54-82`, `:206-240`) with
`subscribe`/`getState`/`setState`/`notify` and reads it through `useSyncExternalStore` with a
per-consumer selector. Its entire purpose is to give React the per-field subscription granularity that
Svelte's signal graph provides natively: a part that reads only `root.errors` re-renders only when
`errors` moves. Porting the store would add a subscription layer over signals that already have one.

`KeyValueRootState` receives its reactive inputs as getter functions (`getValue`, `getDisabled`, …) so
the root's `$bindable` `value` stays authoritative — the same pattern as
`EditableRootState` and `TagsInputRootState`.

**Alternatives considered**: a single flat state class holding a `Map<id, row>` — rejected because the
per-row context has to be a stable object across re-renders of the `{#each}` body, and a class instance
keyed by row id gives that for free.

---

## R-02 — `KeyValueList` renders its children once per row

**Decision**: `KeyValueList` renders `{#each root.value as item (item.id)}` and wraps each iteration in
an internal, non-exported `key-value-item-provider.svelte` that calls `setKeyValueItemContext(...)` and
renders the caller's `children` snippet.

**Rationale**: Upstream does `React.Children.toArray(props.children)` inside `value.map(...)` and wraps
each copy in an `ItemContext.Provider` (`key-value.tsx:348-356`) — the caller writes the row template
*once* and it is instantiated per row. Svelte snippets can be rendered any number of times, so
`{@render children?.()}` inside the `{#each}` reproduces this exactly. Context can only be set during a
component's initialisation, so the per-row provider must be its own component; `KeyValueItem` cannot do
it because `KeyValueItem` lives *inside* the snippet and has no way to know which row it belongs to.

**Alternatives considered**: typing `children` as `Snippet<[KeyValueItemData]>` and making every part
take an `item` prop — rejected, it changes the upstream layout contract (`<KeyValueKeyInput />` is a
leaf that reads context) and would force every consumer to thread the row manually.

---

## R-03 — Composing `editable` for the key and value fields (FR-020)

**Decision**: `KeyValue.KeyInput` and `KeyValue.ValueInput` each render an internal
`<Editable.Root triggerMode="focus"> <Editable.Area> <Editable.Preview/> <Editable.Input/> </Editable.Area> </Editable.Root>`,
with the row's `key` / `value` wired through a **function binding**
(`bind:value={() => item.key, (next) => root.setField(item.id, 'key', next)}`) so `KeyValueRootState`
stays the single source of truth. Both parts remain leaves in the public API, exactly as upstream.

**Rationale**: Upstream renders permanently-open `<Input>` / `<Textarea>` elements, which implement
none of the keyboard contract the upstream MDX documents — the MDX keyboard table
(`key-value.mdx:230-249`) lists `Enter` → "Submit the current input value" and `Escape` → "Cancel the
current input", behaviour a plain controlled `<input>` simply does not have. `editable` is this
repository's implementation of exactly that state machine (`EditableRootState.submit` / `.cancel`,
`editable-input.svelte:130-146`). Composing it satisfies the documented MDX contract, satisfies FR-020,
and satisfies constitution Principle IV (source behaviour from `src/lib/components/ui/*` first).

`triggerMode="focus"` is what keeps the interaction indistinguishable from an always-open input for a
keyboard user: `Editable.Preview` renders with `role="button"` and `tabindex={0}`, its `onfocus` calls
`root.edit()` (`editable-preview.svelte:76-81`), and `Editable.Input`'s `$effect.pre` focuses and
selects the newly-mounted input on the next frame (`editable-input.svelte:87-98`). So `Tab` lands on the
field and the caret is in it — FR-005 and the MDX's `Tab` row hold.

`EditableRootState.setText` writes through on **every** keystroke (`editable.svelte.ts:137-141`), so
validation stays live per-keystroke exactly as upstream's `onChange` handler does — composing `editable`
does **not** defer the value to submit time.

**Alternatives considered**:

- Plain `<Input>` / `<Textarea>` (literal upstream transliteration) — rejected: violates FR-020 and
  leaves the MDX's `Enter`/`Escape` rows unimplemented.
- `Editable` with `readOnly` to force the input open — rejected: `readOnly` also makes it inert.

**Recorded divergence D-1**: the fields render a preview until focused rather than a permanently-open
input. Already recorded in the spec's Assumptions.

---

## R-04 — A `<textarea>` for the value field through `Editable.Input`'s `child` snippet

**Decision**: `KeyValue.ValueInput` renders `Editable.Input` in `child` mode and spreads the merged
props onto its own `<textarea class="field-sizing-content min-h-9 resize-none">`, and re-implements the
two behaviours `child` mode hands back to the caller: focus-and-select on mount, and pushing a rejected
value back onto the element.

**Rationale**: `Editable.Input` renders an `<input>`; FR-018 requires a multi-line, content-sizing
value field with an optional `maxRows` cap, which is upstream's `<Textarea>` with
`field-sizing-content min-h-9 resize-none` and `max-height: calc(maxRows * 1.5em + 1rem)`
(`key-value.tsx:681-707`). `EditableInputProps.child` exists for precisely this and its payload type is
`… & Record<string, unknown>`, so spreading it onto a `<textarea>` type-checks.
`EditableRootState.autosizeElement` already carries a `HTMLTextAreaElement` branch
(`editable.svelte.ts:148-158`) "because a consumer can render a textarea through the `child` snippet",
so this is the documented, intended use.

`child` mode is documented to leave `ref` `null` and to give the caller
"the focus-and-select-on-edit-start behaviour" (`editable-input.svelte:38-44`). The textarea only ever
mounts while editing, so a mount-time `$effect` that calls `focus()` + `select()` is the whole
replacement — four lines, listed as bespoke behaviour in `plan.md`.

**Alternatives considered**: adding an `Editable.Textarea` part to the `editable` folder — rejected,
that edits an already-shipped registry item outside this feature's scope (Principle X) and `child` mode
is the sanctioned escape hatch.

**Recorded divergence D-2**: `Enter` in the value field submits the row's edit rather than inserting a
newline, because the `Enter` → submit binding is `editable`'s and the MDX documents it. Multi-line
values still arrive through paste and still render/scroll multi-line. Recorded in the API contract.

---

## R-05 — Where the caller's `class` and `data-slot` land on the composed fields

**Decision**:

| Element                        | `data-slot`                        | receives caller `class`? |
| ------------------------------ | ---------------------------------- | ------------------------ |
| `Editable.Area` (part wrapper) | `key-value-key-input`              | yes                      |
| `Editable.Preview`             | `key-value-key-input-preview`      | no                       |
| `Editable.Input`               | `key-value-key-input-control`      | no                       |

(and the `value` equivalents: `key-value-value-input`, `-preview`, `-control`).

**Rationale**: the demos pass `className="font-mono"` (`key-value-paste-demo.tsx:32-33`) and
`className="flex-1"` (`key-value-form-demo.tsx:107-108`). `flex-1` must sit on the part's outermost box
— the `Editable.Area` — to have any effect inside the row's flex container, and `font-mono` cascades
from there onto both the preview and the input, so a single target satisfies both demos. Upstream's
`[data-slot="key-value-key-input"]` selected the input itself; here it selects the part wrapper, with
`-control` added for the input. Both are documented in the contract.

**Recorded divergence D-3**: `data-slot="key-value-key-input"` marks the field wrapper, not the
`<input>`; `-preview` and `-control` are new slot names introduced by the `editable` composition.

---

## R-06 — Paste parsing

**Decision**: two pure, exported functions in `key-value.svelte.ts` —
`stripSurroundingQuotes(text, shouldStrip)` and `parseKeyValueText(text, { stripQuotes })` — ported
line-for-line from `removeQuotes` (`key-value.tsx:41-52`) and the paste body (`key-value.tsx:487-525`),
returning `{ key, value }[]` without ids so the caller mints them.

Per-line format priority is upstream's, unchanged: `=` first, then `:`, then `/\s{2,}|\t/`. A line that
matches none of the three yields no row (`if (key) parsed.push(...)`). Split-then-rejoin semantics are
kept verbatim (`parts.slice(1).join("=")`) so `URL=https://a?b=c` keeps its `=`; the whitespace branch
rejoins with a single space, which is upstream's behaviour and is preserved.

**Rationale**: pure functions are directly unit-testable without a DOM and let the paste table in the
MDX (`key-value.mdx:263-279`) be asserted exhaustively.

**Insertion semantics** (`key-value.tsx:527-552`), unchanged: only when the clipboard text has **more
than one non-blank line** is the paste intercepted (`event.preventDefault()`); a row that is entirely
empty (`key === "" && value === ""`) is *replaced* by the parsed rows, otherwise they are inserted
immediately *after* it; the result is then truncated with `slice(0, maxItems)`.

**Recorded divergence D-4**: paste is additionally suppressed when the list is `disabled` or
`readOnly`. Upstream gates only on `enablePaste`; FR-010 requires read-only to suppress paste, and a
read-only field that rewrites the whole list on `Ctrl+V` is a defect.

---

## R-07 — Validation, and which errors get recomputed

**Decision**: one `KeyValueRootState.validateItem(id, nextValue)` routine shared by both fields,
reproducing upstream's duplicated block (`key-value.tsx:436-473` == `:639-676`) exactly:

1. `onKeyValidate?.(item.key, nextValue)` → `errors.key`
2. if `!allowDuplicateKeys`, another row with the **same non-empty** key → `errors.key = "Duplicate key"`
   (overwrites step 1)
3. `onValueValidate?.(item.value, item.key, nextValue)` → `errors.value`
4. write `errors[id]` if non-empty, otherwise `delete errors[id]`

Only the **edited** row is revalidated, matching upstream. `errors[id]` is deleted on remove
(`key-value.tsx:740-741`). `isInvalid = Object.keys(errors).length > 0`.

**Rationale**: this is verbatim upstream behaviour including the fact that editing the *key* also runs
`onValueValidate` and editing the *value* also runs `onKeyValidate` and duplicate detection. A row whose
duplicate partner is fixed elsewhere keeps its stale error until it is itself edited — upstream's
behaviour, and revalidating every row instead would change how often the caller's validators are
invoked, which Principle II forbids. Empty keys never collide (`updatedItemData.key !== ""`), which is
the spec's first Edge Case.

---

## R-08 — Focus management on add, remove and paste (FR-002, US1.3)

**Decision**: `KeyValueRootState` carries two separate signals:

- `focusedId: string | null` — upstream's, purely presentational, drives `data-highlighted` on
  `KeyValueItem` (`key-value.tsx:387`).
- `focusRequestId: string | null` — new, a one-shot focus request consumed by the target row's key
  field.

`add()` sets both to the new row's id. `remove(id)` sets both to the **next** row's id, or the
**previous** row's id when the removed row was last, or `null` when the list is now empty.
`pasteInto()` sets both to the last inserted row's id.

`KeyValue.KeyInput` consumes the request in an `$effect`: when `root.focusRequestId === item.id`, it
clears the request and sets its `Editable` root's `editing` to `true`, which mounts the input and
triggers `editable`'s own `requestAnimationFrame` focus + select. The clear happens inside `untrack`,
so the effect re-runs exactly once more and then short-circuits — no loop.

**Rationale**: upstream sets `focusedId` on add (`key-value.tsx:800`) but never focuses anything, so
FR-002 ("newly added rows MUST receive keyboard focus on their key field") is unmet upstream and has to
be added. Two signals rather than one because clearing a one-shot request would also clear the
persistent `data-highlighted` that upstream's `focusedId` exists for.

**Recorded divergence D-5**: focus actually moves on add, on remove, and after a splitting paste.
Recorded in the spec's Assumptions for remove; add/paste follow the same rule.

---

## R-09 — `aria-orientation` on `KeyValueList` is dropped

**Decision**: `KeyValueList` renders `role="list"` + `data-orientation` but **not**
`aria-orientation`.

**Rationale**: upstream sets `aria-orientation={orientation}` on `role="list"`
(`key-value.tsx:338-339`). `aria-orientation` is not a global ARIA attribute and is not in the
supported-properties set of the `list` role, so Svelte's `a11y_role_supports_aria_props` compiler check
emits a warning — and `pnpm run check` must finish with **zero warnings** (constitution Quality Gates).
The attribute is also inert for assistive technology on a `list`, so nothing is lost.

**Recorded divergence D-6**: `aria-orientation` omitted; `data-orientation` carries the orientation for
both styling and tests.

---

## R-10 — Native form participation

**Decision**: the root renders the repository's clipped-`type="text"`-input pattern behind
`FormControlState` from `$lib/components/ui/checkbox-group/index.js`, with
`value={JSON.stringify(rows)}` and the same `$effect` that pushes the value onto the element and
dispatches a bubbling `input` event.

**Rationale**: identical to `tags-input.svelte:288-311` and `editable.svelte:255-274`, including their
recorded reason for `type="text"` over upstream's `type="hidden"` (hidden inputs are barred from
constraint validation, so a `required` empty field would submit happily). Upstream hands the raw
`ItemData[]` to `VisuallyHiddenInput` (`key-value.tsx:308-317`), which React serialises to
`"[object Object],[object Object]"` — unusable. `tags-input` chose `.join(',')` because its value is
`string[]`; for an object array `JSON.stringify` is the only serialisation that round-trips.

**Recorded divergence D-7**: the form value is JSON rather than React's default array stringification.

---

## R-11 — Row identifiers

**Decision**: a module-level monotonic counter in `key-value.svelte.ts`, `key-value-item-${++n}`,
exposed as `createKeyValueItemId()`.

**Rationale**: upstream uses `crypto.randomUUID()` (`key-value.tsx:209`, `:523`, `:794`), which is not
available in every jsdom/SSR target and makes assertions non-deterministic. Ids never appear verbatim in
the public contract (the spec's Assumptions say so explicitly); they only feed `errors` keys and the
`aria-describedby` id, both of which are derived and compared, never asserted literally. A counter is
deterministic, SSR-stable (the same render order produces the same sequence on server and client), and
dependency-free.

**Recorded divergence D-8**: id format is `key-value-item-N`, not a UUID. Callers supplying their own
`defaultValue` / `value` keep whatever ids they pass (the validation demo passes `"1"`, `"2"`, `"3"`).

---

## R-12 — `readOnly` suppresses add and remove

**Decision**: `KeyValue.Add` is disabled when `disabled || readOnly || (maxItems !== undefined &&
count >= maxItems)`; `KeyValue.Remove` is disabled when `disabled || readOnly || count <= minItems`.

**Rationale**: upstream omits `readOnly` from both (`key-value.tsx:727`, `:776-778`), so a read-only list
can still be emptied one row at a time. FR-010 requires `readOnly` to suppress add, remove and edit.

**Recorded divergence D-9**: `readOnly` disables the add and remove buttons.

---

## R-13 — Trailing-whitespace desync under `trim`

**Decision**: `KeyValue.KeyInput` and `KeyValue.ValueInput` each keep a `bind:ref` on their control and
run an `$effect` that writes `ref.value = item.key` whenever `ref.value !== item.key`.

**Rationale**: `trim` defaults to `true` and upstream trims on **every** keystroke
(`key-value.tsx:430`, `:633`). Typing a trailing space therefore produces a stored value identical to
the previous one, Svelte skips the attribute update because the value did not change, and the DOM keeps
the untrimmed text while the state holds the trimmed text. React papered over this with its
re-render; `editable-input.svelte:112-128` documents the same hazard (research R-12 there) and solves
the read-only case the same way. The guard is two lines and keeps the DOM and the state in lockstep.

---

## R-14 — The "With Form" demo

**Decision**: reproduce `key-value-form-demo.tsx` with plain runes plus `$lib/components/ui/field` and
`svelte-sonner`, as `src/routes/docs/components/editable/+page.svelte` already does for the same
upstream pattern.

**Rationale**: the upstream demo uses `react-hook-form` + `@hookform/resolvers/zod`, neither of which
has a counterpart in this registry, and adding one would violate the zero-new-dependencies constraint.
The user-visible contract — a labelled field, a submit button, validation messages, a toast of the
submitted JSON — is reproducible with what is installed. Already recorded in the spec's Assumptions.

---

## R-15 — Dependencies

**Decision**: **zero new npm dependencies.**

| Need                  | Source                                                            |
| --------------------- | ----------------------------------------------------------------- |
| inline editing        | `$lib/components/ui/editable` (registry dep `editable`)           |
| add / remove buttons  | `$lib/components/ui/button` (registry dep `button`)               |
| RTL resolution        | `$lib/components/ui/direction-provider` (registry dep)            |
| form-control          | `FormControlState` from `$lib/components/ui/checkbox-group`       |
| `PlusIcon` / `XIcon`  | `@lucide/svelte` — already a package dependency                   |

`registry.json` `dependencies` therefore lists only `"@lucide/svelte"` (matching the `tags-input`
entry), and `registryDependencies` lists `["editable", "button", "direction-provider",
"checkbox-group"]` — every `ui/*` folder imported, as `verify` requires (commit `4f81f61`).

No `bits-ui` primitive covers "list of key/value rows with paste parsing and per-row validation", and
none is imported.
