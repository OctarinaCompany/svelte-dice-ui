# Phase 0 Research: Segmented Input

**Feature**: `018-port-segmented-input` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Upstream, pinned `d9763d82530416dfa4c81c462387b55d06bae4ec`** — every file below was read in full:

| File                                                                       | Lines | What it settles                                     |
| -------------------------------------------------------------------------- | ----- | --------------------------------------------------- |
| `docs/registry/bases/radix/ui/segmented-input.tsx`                         | 211   | The implementation named by the port brief          |
| `docs/registry/bases/base/ui/segmented-input.tsx`                          | 243   | The sibling variant (`useRender` instead of `Slot`) |
| `docs/types/radix/segmented-input.ts`                                      | 76    | The documented prop surface + JSDoc + `@default`    |
| `docs/content/docs/components/radix/segmented-input.mdx`                   | 114   | API reference + keyboard table + example list       |
| `docs/content/docs/components/base/segmented-input.mdx`                    | —     | Identical example list, base import path            |
| `docs/registry/bases/base/examples/segmented-input-demo.tsx`               | 55    | Demo 1 — three-part name                            |
| `docs/registry/bases/base/examples/segmented-input-form-demo.tsx`          | 82    | Demo 2 — phone number in a `<form>`                 |
| `docs/registry/bases/base/examples/segmented-input-rgb-demo.tsx`           | 65    | Demo 3 — RGB channels                               |
| `docs/registry/bases/base/examples/segmented-input-vertical-demo.tsx`      | 60    | Demo 4 — vertical mailing address                   |

**No upstream test file exists** for this component (`.reference/diceui` has no
`segmented-input.test.tsx` under either `packages/` or `docs/registry/bases/radix/test/`). The
"upstream assertions are the floor" rule of Principle III therefore has an empty floor here; the
test plan is derived from the MDX contract, the `types/` JSDoc, and the six mandatory areas of
`CLAUDE.md` §7 instead.

---

## R-01 — Which upstream variant is the source of truth

**Decision**: port the **radix** variant (`docs/registry/bases/radix/ui/segmented-input.tsx`), named
explicitly in the port brief.

**Rationale**: the two variants are behaviourally identical. Diffing them line by line, they differ
in exactly three places:

1. `radix` resolves direction with `DirectionPrimitive.useDirection(dirProp)`; `base` uses its own
   `useDirection()` hook plus `dirProp ?? contextDir`. Same semantics — explicit prop wins over
   ambient context.
2. `radix` implements the escape hatch with `asChild` + `SlotPrimitive.Slot`; `base` uses
   `useRender`/`mergeProps` with a `render` prop.
3. `base`'s item falls through to the same `<Input>` render when no `render` prop is given, so its
   non-`render` output is byte-identical to `radix`'s.

The `cva` variant table, the position auto-assignment, the context shape and every data attribute
are character-for-character the same. Both were read so that the `child`-snippet design (R-05) can
satisfy both spellings at once.

**Alternatives considered**: porting `base` — rejected because `useRender`/`mergeProps` is a Base UI
mechanism with no Svelte analogue, whereas `asChild`→`child` snippet is the mapping `CLAUDE.md` §10
already prescribes and that `banner.svelte`, `marquee.svelte`, `masonry.svelte` etc. already
implement in this repo.

---

## R-02 — `React.Children.map` + `cloneElement` position assignment

Upstream assigns each item its `position` by walking `React.Children` in the root and cloning each
child with an injected prop:

```tsx
const childrenCount = React.Children.toArray(children).length;
React.Children.map(children, (child, index) => {
  if (React.isValidElement(child) && !child.props.position) {
    const position = childrenCount === 1 ? "isolated"
      : index === 0 ? "first"
      : index === childrenCount - 1 ? "last" : "middle";
    return React.cloneElement(child, { position });
  }
  return child;
});
```

**Decision**: replace it with **self-registration into a document-ordered collection**. Each
`<SegmentedInput.Item>` takes an id from `$props.id()`, registers `(id, element, meta)` with the
root's state from an `$effect`, and unregisters on teardown. The item's position is
`$derived(explicitPosition ?? nav.positionOf(id))`, and `positionOf` reads the collection's
`indexById` / `size`.

**Rationale**: `CLAUDE.md` §10 states outright that `React.Children` inspection "is not available —
model it explicitly with context or an items array". Registration is the only mechanism that
survives `{#each}`, `{#if}`, reordering, and items nested one level deeper inside a wrapper — all of
which break a naive "count the slots" approach. It also produces exactly the index the arrow-key
navigation (R-08) and the paste distribution (R-10) need, so one registry serves all three
behaviours.

**Consequences, recorded as divergences**:

- **D-01**: upstream counts *all* children (a stray `<span>` between two items would be counted and
  would shift the `first`/`last` computation); this port counts only registered
  `<SegmentedInput.Item>`s. This is strictly better — a decorative child no longer corrupts the
  joined-edge styling — and it is the only behaviour reachable without `React.Children`.
- **D-02**: position is `"isolated"` for the first render frame, before the registration effect has
  run, and settles on the microtask after mount. Tests must `await tick()` (or use
  `@testing-library`'s auto-flushing queries) before asserting `data-position`. No visible flash in
  practice, because Svelte applies both the initial and the settled class in the same paint.

**Alternatives considered**: an init-time monotonic counter on the context (cheap, no effect) —
rejected because it produces source-order, not document-order, and is wrong the moment items are
conditionally rendered or reordered.

---

## R-03 — The DOM-ordered collection: compose, do not re-write

**Decision**: import `DomOrderedCollection` from
`$lib/components/ui/speed-dial/speed-dial-collection.svelte.js` and add **`speed-dial` to this
component's `registryDependencies`**.

**Rationale**: Principle IV orders the sources of behaviour as (1) an existing component under
`src/lib/components/ui/*`, (2) `bits-ui`, (3) bespoke. `DomOrderedCollection` is (1): it was written
generically during the Speed Dial port and its own doc comment states it is "**exported from the
barrel** for later ports to reuse rather than duplicate (research R-16)". It already provides
exactly what R-02 needs — `register`/`unregister`, a `compareDocumentPosition` sort memoised in one
`$derived.by`, an `indexById` map built in a single pass, `size`, `elements()`, and the
`isConnected` filter that drops detached nodes.

Re-implementing it here would be a verbatim 60-line copy, which is precisely what Principle IV
exists to prevent.

**Trade-off, accepted and recorded**: `registryDependencies: ["speed-dial"]` means a consumer who
installs `segmented-input` through the shadcn CLI also receives Speed Dial's nine files (and its
`button` dependency). The import is written against the **module file**, not the barrel
(`.../speed-dial-collection.svelte.js`, not `.../speed-dial/index.js`), so nothing from Speed Dial's
component graph reaches the consumer's bundle — the cost is files on disk, not bytes shipped. The
clean long-term fix is to promote the collection to its own `registry:lib` item; that is a
cross-cutting registry change affecting an already-shipped component and is **out of scope for this
port** (Principle X: one feature directory, one component).

**Alternatives considered**:

- Copying the class into `segment-navigation.svelte.ts` — rejected: direct Principle IV violation
  with no capability gap to justify it.
- Importing through the Speed Dial barrel — rejected: pulls six component modules into the import
  graph for one class.
- Adding a new `registry:lib` shared item — rejected as out of scope (above).

---

## R-04 — Direction resolution

**Decision**: `useDirection({ dir: () => dirProp, element: () => ref })` from
`$lib/components/ui/direction-provider/index.js`; the resolved value is published on context and
also written to the root's `dir` attribute (upstream does the same).

**Rationale**: `DirectionReader` already implements exactly upstream's precedence —
`explicit ?? nearest provider ?? nearest DOM [dir] ancestor ?? 'ltr'` — including a
`MutationObserver` for runtime `dir` flips, and it never throws when no provider is mounted. This is
the same composition `checkbox-group` made (`registryDependencies: ["direction-provider"]`).
Anchoring the DOM fallback on the root's own `ref` (rather than `document.documentElement`) is what
makes `<div dir="rtl"><SegmentedInput.Root>…` work, which spec US2 AS-2 requires.

**Alternatives considered**: reading `getComputedStyle(el).direction` — rejected: not reactive, and
jsdom does not compute it.

---

## R-05 — `asChild` (radix) / `render` (base) → the `child` snippet

**Decision**: both root and item expose `child?: Snippet<[{ props: … }]>`. When `child` is supplied
it is rendered with the fully merged attribute payload and the default element is **not** rendered;
otherwise the default element renders and `children` goes inside it.

This is the pattern already used by `banner.svelte`, `marquee.svelte`, `masonry.svelte`,
`gauge.svelte`, `color-swatch.svelte` and `circular-progress.svelte` in this repo, and the mapping
`CLAUDE.md` §10 prescribes for `asChild` / `Slot` / `cloneElement`.

The exported `SegmentedInputChildProps` / `SegmentedInputItemChildProps` types name every attribute
in the payload (`data-slot`, `role`, `aria-*`, `data-*`, `class`) intersected with
`Record<string, unknown>` for `restProps`, matching `BannerChildProps`.

**Consequence, recorded as D-03**: when the root renders through `child`, `bind:ref` is not applied
(the caller owns the element). Every ported component in this repo behaves the same way; the
direction DOM fallback then resolves from the document instead of the root element.

---

## R-06 — The item composes this repo's `Input`

**Decision**: `<SegmentedInput.Item>` renders `$lib/components/ui/input/index.js`'s `Input`, not a
bare `<input>`.

**Rationale**: upstream's item renders its registry `Input` too (`radix/ui/segmented-input.tsx:184`,
`base/ui/segmented-input.tsx:226`), so this is parity *and* Principle IV. Our `Input` conveniently
already accepts a `'data-slot'` prop (`input.svelte:11`), so the item can override
`data-slot="segmented-input-item"` without forking the file, and it already forwards `value` as
`$bindable`, `class` merged through `cn()`, and everything else via `restProps`.

**Consequence, recorded as D-04**: `Input`'s props are a discriminated union whose `type: 'file'`
arm carries a `files` binding. A file input inside a segmented group is meaningless (it has no
caret, no `maxlength`, and cannot receive a distributed paste part), so the item's `type` is typed
`Exclude<HTMLInputTypeAttribute, 'file'>` and `files` is not exposed. Upstream types the item as the
unrestricted `React.ComponentProps<'input'>`; narrowing it is a type-level restriction only, and it
keeps the port free of `as any` (Principle VI).

**Consequence, recorded as D-05**: this repo's `Input` uses `rounded-lg`; upstream's uses
`rounded-md`. The vertical compound variants that *restore* a radius must therefore say
`rounded-e-lg` / `rounded-s-lg`, not upstream's `rounded-e-md` / `rounded-s-md`, or the restored
corner would not match the group's outer corners.

---

## R-07 — `cva` → `tv()`, and the RTL bug in upstream's variant table

**Decision**: translate `segmentedInputItemVariants` to `tv()` from `tailwind-variants` (declared in
`segmented-input.svelte.ts`, exported from the barrel, per Principle VIII), converting upstream's
**physical** border utilities to **logical** ones.

Upstream's table mixes logical and physical properties in the same rule:

```ts
middle: "-ms-px rounded-none border-l-0",   //  ms-* is logical, border-l-* is physical
last:   "-ms-px rounded-s-none border-l-0",
```

Under `dir="rtl"` the layout flows right-to-left, so `-ms-px` correctly pulls each item toward its
*visual* right neighbour — but `border-l-0` still removes the **left** border, which in RTL is the
item's *end* edge, not the shared edge. The result upstream renders in RTL is a doubled border at
every seam and a missing border at the group's leading edge.

**Decision**: use `border-s-0` / `border-s` throughout. Recorded as **D-06** — a deliberate
divergence, justified by Principle III ("horizontal navigation MUST invert under `dir='rtl'`", and
by extension horizontal *presentation*), and asserted by a test.

Full translated table (positions × orientation × size), with D-05 applied:

| variant                  | classes                                                       |
| ------------------------ | ------------------------------------------------------------- |
| `position: isolated`     | *(none)*                                                      |
| `position: first`        | `rounded-e-none`                                              |
| `position: middle`       | `-ms-px rounded-none border-s-0`                              |
| `position: last`         | `-ms-px rounded-s-none border-s-0`                            |
| `size: sm`               | `h-8 px-2 text-xs`                                            |
| `size: default`          | `h-9 px-3`                                                    |
| `size: lg`               | `h-11 px-4`                                                   |
| `first` + `vertical`     | `ms-0 rounded-e-lg rounded-b-none border-s`                   |
| `middle` + `vertical`    | `ms-0 -mt-px rounded-none border-t-0 border-s`                |
| `last` + `vertical`      | `ms-0 -mt-px rounded-s-lg rounded-t-none border-t-0 border-s` |

`defaultVariants`: `position: 'isolated'`, `orientation: 'horizontal'`, `size: 'default'` — verbatim
upstream. The root's own classes stay `cn()`-composed (`flex` + `flex-row`/`flex-col`), which is all
upstream applies there; no `tv()` needed for two mutually exclusive utilities.

`tailwind-variants` is already a dependency (`package.json:48`) and is already declared by
`speed-dial`, `marquee`, `banner` and others — **no new npm dependency for this port**.

---

## R-08 — Arrow-key navigation: caret-boundary guarded

Spec FR-009/FR-010 require arrow keys to move focus between segments; the MDX documents only
`Tab`/`Shift+Tab`, but the vertical demo's own copy says "Use arrow keys (up/down) to navigate
between fields", and Principle III makes the WAI-ARIA pattern the floor when upstream is weaker.
The spec Assumptions already record this as a deliberate enhancement.

**Problem**: the segments are real, editable text inputs. `ArrowLeft`/`ArrowRight` natively move the
caret; hijacking them unconditionally would make it impossible to edit the middle of a segment's
text — a usability regression far worse than the missing navigation.

**Decision**: the arrow key moves focus **only when the caret is already at that edge of the
segment's own text and nothing is selected**. Concretely, for a request to move toward the *end*:
`selectionStart === selectionEnd && selectionStart === value.length`; toward the *start*:
`selectionStart === selectionEnd && selectionStart === 0`. Otherwise the event is left alone and the
browser moves the caret.

This is the behaviour of every shipping segmented text control (date fields, OTP inputs, IP-address
inputs), it satisfies every acceptance scenario in spec US2 (whose fixtures are empty or
caret-at-edge segments), and it is the only reading under which FR-009 and FR-002 ("accepts the same
attributes a plain input accepts") are simultaneously true.

`ArrowUp`/`ArrowDown` in **vertical** orientation are guarded the same way for symmetry, even though
a single-line input has no vertical caret movement to preserve — keeping one rule keeps the module
predictable for Time Picker.

Recorded as **D-07**. Note in jsdom `selectionStart` is `null` for input types that do not support
selection; the guard treats `null` as "at both edges" so navigation still works there and in
`type="number"` segments.

**Key → intent resolution** (pure, exported, unit-testable):

| orientation  | key          | `dir="ltr"` | `dir="rtl"` |
| ------------ | ------------ | ----------- | ----------- |
| `horizontal` | `ArrowRight` | `next`      | `previous`  |
| `horizontal` | `ArrowLeft`  | `previous`  | `next`      |
| `horizontal` | `ArrowUp`    | —           | —           |
| `horizontal` | `ArrowDown`  | —           | —           |
| `vertical`   | `ArrowDown`  | `next`      | `next`      |
| `vertical`   | `ArrowUp`    | `previous`  | `previous`  |
| `vertical`   | `ArrowLeft`  | —           | —           |
| `vertical`   | `ArrowRight` | —           | —           |
| both         | `Home`       | `first`     | `first`     |
| both         | `End`        | `last`      | `last`      |

Vertical navigation is direction-independent (FR-009), matching every ARIA vertical-orientation
pattern.

**Clamping and skipping** (FR-010): `next`/`previous` scan forward/backward from the current index
for the first entry whose `getDisabled()` is `false`; if none exists, focus does not move (no
wraparound). `first`/`last` pick the first/last enabled entry. A disabled entry still occupies an
index, so it still contributes to `first`/`middle`/`last` styling — exactly what the spec's Edge
Cases require.

---

## R-09 — `Home` / `End`

**Decision**: `Home` and `End` move focus to the first / last enabled segment unconditionally and
call `preventDefault()`, then place the caret at position 0 (for `first`) or at the end of the
value (for `last`).

**Rationale**: FR-011 states it without qualification, and SC-002 counts it. Unlike the arrow keys
there is no partial-edit case to protect: `Home`/`End` inside a segment only move the caret to that
segment's own boundary, and after the jump the caret lands on the equivalent boundary of the target
segment, so the user's mental model ("go to the beginning/end of this control") is preserved at the
group level rather than the segment level. `Ctrl+Home`/`Ctrl+End` are **not** intercepted, leaving
the document-level shortcut intact.

---

## R-10 — Paste distribution

Not present upstream at all; required by FR-013/FR-014 and scoped by the spec's Assumptions. The
algorithm below is the direct encoding of that assumption text.

**Targets**: the registered entries from the focused segment's index to the end of the group,
filtered to those that are neither `disabled` nor `readOnly` (FR-014). Segments before the focused
one are never touched.

**Splitting** — `splitPastedValue(text, maxLengths)`, a pure exported function:

1. `const trimmed = text.trim()`; empty ⇒ return `[]` (fall through to the browser).
2. **Separator path** — if `/[^\p{L}\p{N}]/u` matches anywhere in `trimmed`, split on
   `/[^\p{L}\p{N}]+/u`, drop empty fragments, truncate part *i* to `maxLengths[i]` when defined,
   and take at most `maxLengths.length` parts (extras discarded, FR-013).
3. **Character path** — no separator present:
   - if `maxLengths[0]` is `undefined`, the first (and only) part is the whole string: a segment
     that declares no width "expects" any length, so there is nothing to split on. The result is one
     part, and step 4 hands the paste back to the browser.
   - otherwise consume greedily: part *i* takes `maxLengths[i]` characters, and a segment with an
     undefined `maxLength` takes the entire remainder and terminates the walk. Stop when the text or
     the target list is exhausted.
4. **Bail-out**: if the result is 0 or 1 parts *and* no truncation occurred, the handler returns
   without calling `preventDefault()`, so the native paste runs — preserving undo history, the
   caret/selection semantics, and `beforeinput` for the common single-field case.
5. Otherwise: `preventDefault()`, write each part into its target (R-11), and move focus to the last
   target that received a part with the caret at the end of it (FR-014).

Worked examples (from the demos):

| pasted             | focused segment      | `maxLength`s   | result                              |
| ------------------ | -------------------- | -------------- | ----------------------------------- |
| `"+1 555 1234567"` | country code (idx 0) | `∅, 3, 7`      | `+1` / `555` / `1234567`            |
| `"5551234567"`     | area code (idx 1)    | `3, 7`         | `555` / `1234567`                   |
| `"255, 128, 0"`    | red (idx 0)          | `∅, ∅, ∅`      | `255` / `128` / `0`                 |
| `"Ada Byron King"` | first (idx 0)        | `∅, ∅, ∅`      | `Ada` / `Byron` / `King`            |
| `"Lovelace"`       | first (idx 0)        | `∅, ∅, ∅`      | 1 part ⇒ native paste, no redirect  |
| `"ab cd ef gh"`    | second of three      | `∅, ∅, ∅`      | `ab` / `cd`, `ef`+`gh` discarded    |

---

## R-11 — Writing a pasted part into another segment's value

The navigation module must set the value of segments it does not own. Two Svelte-correct channels
exist, and the port uses **both, in one call**:

1. The item registers a `setValue(next: string)` closure in its collection meta. That closure
   assigns to the item's own `$bindable` `value` prop, so `bind:value` updates, and a caller using a
   **function binding** (`bind:value={get, set}`) that declines the write keeps authority — nothing
   is force-written behind their back.
2. It then dispatches a bubbling `new Event('input')` on the item's element, so callers who use the
   upstream idiom (`oninput` / `onchange` handlers, which is what all four upstream demos do) also
   observe the change.

The two are complementary and non-looping: Svelte's own `bind:value` listener re-reads the same
`el.value` it just wrote, so no second update is scheduled.

**Alternatives considered**: writing `element.value` directly and relying solely on the synthetic
event — rejected because it bypasses a function binding's setter, silently breaking the
"parent stays authoritative" contract this repo established in the Checkbox Group port (R-03 there).

---

## R-12 — Composing the caller's own `onkeydown` / `onpaste`

The item must attach handlers *and* forward the caller's. `...restProps` spread after an attribute
overwrites it in Svelte, so the two handlers are composed explicitly: `onkeydown` and `onpaste` are
destructured out of the props, and the item renders a wrapper that calls the caller's handler
first and returns early when `event.defaultPrevented` is true.

This is also the documented **opt-out**: a consumer who wants the browser's plain single-field paste
or plain caret arrows writes their own handler and calls `event.preventDefault()` — no new prop is
invented for it, keeping the surface at upstream parity.

---

## R-13 — The reusable module boundary (FR-015)

**Decision**: `src/lib/components/ui/segmented-input/segment-navigation.svelte.ts`, exported from
the component's `index.ts`, containing:

- `class SegmentNavigation` — registration, ordering, position derivation, `onKeydown`, `onPaste`.
- `type SegmentEntryMeta` — the per-segment capability record
  (`getDisabled`, `getReadOnly`, `getMaxLength`, `setValue`, `focus`).
- pure helpers `resolveSegmentPosition`, `resolveSegmentIntent`, `splitPastedValue`,
  `SEGMENT_POSITIONS`, `SEGMENT_ORIENTATIONS`.

It imports **nothing** from any `.svelte` file, knows nothing about `Input`, sizes, variants or
`data-slot`s, and takes its orientation and direction as getter functions. Time Picker will
construct its own `SegmentNavigation`, register its hour/minute/second segments, and get identical
keyboard and paste behaviour by adding `segmented-input` to its `registryDependencies` — the same
inter-component reuse route `checkbox-group → direction-provider` already established.

The tests exercise the pure helpers directly (no DOM) *and* through the rendered component, so the
module's contract is pinned independently of this component's markup.

---

## R-14 — jsdom and test-harness constraints

- `userEvent.paste(text)` dispatches a real `paste` event carrying a populated `clipboardData`, so
  `event.clipboardData.getData('text')` works under jsdom. `userEvent.setup()` is required (the
  direct-call API has no clipboard).
- `selectionStart` / `selectionEnd` are implemented by jsdom for `type="text"`; they are `null` for
  `type="number"`. R-08's guard treats `null` as "at both edges", so tests may use either type.
- `HTMLElement.focus()` works; `document.activeElement` assertions via
  `expect(el).toHaveFocus()` are reliable.
- `tests/setup.ts` already shims `ResizeObserver`, `matchMedia`, pointer capture and
  `scrollIntoView`; none of them are needed here — this component observes nothing and measures
  nothing.
- A `segmented-input.test.svelte` harness is required (the `direction-provider` /
  `checkbox-group` precedent) for: snippet children, `bind:value` and function bindings,
  `bind:ref`, conditional item rendering (to prove position re-derivation), the `child` snippet, and
  the provider-less item that must throw.

---

## R-15 — React machinery that is deliberately not ported

| Upstream                                                | Here                                                                    |
| ------------------------------------------------------- | ----------------------------------------------------------------------- |
| `React.useMemo` for the context value                   | dropped — a state class with `$derived` fields has no re-render to skip  |
| `React.useCallback`                                     | dropped — no referential-identity contract exists in Svelte              |
| `React.createContext` / `useSegmentedInputContext(name)` | `Symbol` key + `getSegmentedInputContext(consumer)` that throws (§5)     |
| `React.Children.toArray` / `map` / `cloneElement`       | self-registration into `DomOrderedCollection` (R-02)                    |
| `SlotPrimitive.Slot` / `useRender` / `mergeProps`       | the `child` snippet (R-05)                                              |
| `cva` + `VariantProps`                                  | `tv()` from `tailwind-variants` (R-07)                                  |
| `DirectionPrimitive.useDirection`                       | `useDirection()` from `direction-provider` (R-04)                       |

The error message is kept verbatim in shape — ``` `<SegmentedInput.Item>` must be used within `<SegmentedInput.Root>`.``` —
so it still matches the `/within/` assertion Principle III mandates.

---

## R-16 — Registry entry

```jsonc
{
  "name": "segmented-input",
  "type": "registry:ui",
  "title": "Segmented Input",
  "description": "A group of connected input fields that appear as a single segmented visual unit.",
  "registryDependencies": ["input", "direction-provider", "speed-dial"],
  "dependencies": ["tailwind-variants"],
  "files": [ /* index.ts, 2 × .svelte, 2 × .svelte.ts — never the tests */ ]
}
```

`registryDependencies` are registry item names, resolved by the shadcn CLI: `input` (R-06),
`direction-provider` (R-04), `speed-dial` (R-03). `dependencies` lists only npm packages the CLI
cannot infer — `tailwind-variants` (R-07). `clsx`/`tailwind-merge` arrive with `cn()` and are never
listed by the existing entries; `bits-ui` and `@lucide/svelte` are **not** used by this component
and are therefore absent.

---

## Open questions

None. Every `NEEDS CLARIFICATION` slot in the Technical Context is resolved above.
