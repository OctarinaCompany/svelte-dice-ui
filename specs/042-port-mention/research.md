# Phase 0 Research: Port Mention Component

**Feature**: `042-port-mention` | **Date**: 2026-08-01

**Upstream pin**: `sadmann7/diceui@d9763d82530416dfa4c81c462387b55d06bae4ec`, vendored read-only at
`.reference/diceui`.

Every open question in the Technical Context is resolved below. Nothing is left open.

---

## Sources read (at the pinned commit)

| File                                                                   | Lines | What it settles                                                       |
| ---------------------------------------------------------------------- | ----- | --------------------------------------------------------------------- |
| `.reference/diceui/packages/mention/src/mention-root.tsx`              | 432   | Root prop list, context surface, `onMentionAdd`, `onMentionsRemove`   |
| `.reference/diceui/packages/mention/src/mention-input.tsx`             | 1025  | Trigger detection, caret geometry, keyboard, cut/paste, `beforeinput` |
| `.reference/diceui/packages/mention/src/mention-content.tsx`           | 177   | Anchor positioning, dismiss, scroll lock, RTL align flip              |
| `.reference/diceui/packages/mention/src/mention-item.tsx`              | 140   | Item registration, roles, data attributes, click/pointer behaviour    |
| `.reference/diceui/packages/mention/src/mention-label.tsx`             | 30    | `id`/`for` wiring                                                     |
| `.reference/diceui/packages/mention/src/mention-portal.tsx`            | 29    | `container` prop                                                      |
| `.reference/diceui/packages/mention/src/mention-highlighter.tsx`       | 200   | The `data-tag` overlay behind the field                               |
| `.reference/diceui/packages/mention/src/index.ts`                      | 12    | The exported part list                                                |
| `.reference/diceui/packages/mention/test/mention.test.tsx`             | 417   | The assertion floor                                                   |
| `.reference/diceui/docs/content/docs/components/radix/mention.mdx`     | 244   | The API contract, data attributes, CSS vars, keyboard table           |
| `.reference/diceui/docs/registry/bases/radix/ui/mention.tsx`           | 91    | Confirmed: a thin styling wrapper, no behaviour                       |
| `.reference/diceui/docs/registry/bases/radix/examples/mention-*.tsx`   | 3     | The three demo sections the docs page must reproduce                  |
| `.reference/diceui/packages/shared/src/hooks/use-filter{,-store}.ts`   | 271+177 | The matcher and scoring contract                                    |
| `.reference/diceui/packages/shared/src/hooks/use-list-highlighting.ts` | 79    | Highlight movement semantics                                          |

Local conventions read: `CLAUDE.md`, `.specify/memory/constitution.md`,
`.agents/skills/shadcn-svelte/rules/{styling,composition,forms,icons}.md`, and the three closest
ported components — `combobox` (filter store, anchored layer, form input, collection),
`tags-input` (value list + form participation), `mask-input` (`child` snippet on a text field),
plus `direction-provider` (RTL) and `listbox` (item registration through an attachment).

---

## R-01 — Anchoring the popup to the caret

**Decision**: compose `bits-ui`'s `Popover.Content` and drive it with `customAnchor` set to a
**virtual anchor object** (`{ getBoundingClientRect(): DOMRect }`) that this port computes from the
caret offset. The caret geometry itself is bespoke, in a rune-free `mention-caret.ts`.

**Rationale**: `bits-ui`'s floating layer types `customAnchor` as
`string | HTMLElement | Measurable | null`, and
`Measurable = { getBoundingClientRect: () => DOMRect }`
(`node_modules/bits-ui/dist/internal/floating-svelte/types.d.ts:4-6`,
`.../floating-layer/types.d.ts:93`). That is exactly the shape upstream hands to
`@floating-ui/react` as a `VirtualElement`, so all of the floating/collision/flip/portal mechanics
come from the primitive and only the "where is the caret" arithmetic is written here. Constitution
Principle IV is satisfied by composing the positioner; the bespoke part is the narrow piece no
primitive offers.

**Alternatives considered**:

- `Popover.Content` anchored to the field element — rejected: the popup would sit under the whole
  textarea rather than under the caret, which is the component's headline behaviour (MDX:
  "Positions the mention popover relative to the cursor position").
- Re-implementing the positioner with `@floating-ui/dom` directly — rejected: a new npm dependency
  and a permanent duplicate of audited `bits-ui` work (Principle IV).
- `Range.getBoundingClientRect()` on the input — rejected: `<input>`/`<textarea>` have no
  selectable DOM `Range`; upstream's span-measurement approach is the only portable one.

**Carried over from upstream, verbatim** (`mention-input.tsx:25-134`): off-screen `<span>` text
measurement, wrapped-line count from `textWidth / containerWidth`, `scrollTop`/`scrollLeft`
compensation, RTL branch, and the `rect.right - 10` clamp.

**One deliberate correction**: upstream writes
`Number.parseInt(style.lineHeight, 10) ?? input.offsetHeight`. `??` never fires for `NaN`, so a
computed `line-height: normal` (and every jsdom run) yields `NaN` and poisons the whole rect. The
port uses a `Number.isFinite` guard with the same intended fallback. Recorded as divergence **D-9**.

---

## R-02 — The portal

**Decision**: `<Mention.Portal>` wraps `bits-ui`'s `Popover.Portal`, exposing `to` (element or
selector) and `disabled`, mirroring `combobox-portal.svelte` exactly.

**Rationale**: upstream's `MentionPortal` only forwards `container` to `@diceui/shared`'s `Portal`.
`bits-ui` already owns portalling for the popover layer it renders, and the combobox port
established the `container` → `to` naming for this repo. Recorded as divergence **D-2**.

---

## R-03 — Filtering

**Decision**: reuse the already-ported filter module, `ComboboxFilterStore` / `scoreItem` /
`createFilter`, imported from `$lib/components/ui/combobox/index.js`. `registry.json` therefore lists
`combobox` in `registryDependencies`.

**Rationale**: `src/lib/components/ui/combobox/combobox-filter.ts` is a line-for-line, deliberately
rune-free port of the same `@diceui/shared` `use-filter.ts` + `use-filter-store.ts` that Mention's
root consumes (`mention-root.tsx:237-249`), down to the `2` / `1.5` / `1` / `0` scores, the
descending sort and the 250-item batch. Its own header comment states it is kept rune-free precisely
so other components can reuse it. Principle IV orders "existing component under
`src/lib/components/ui/*`" first, and cross-component registry dependencies are already the norm here
(`key-value` → `editable`, `kanban` → `sortable`, `phone-input` → `mask-input`, five components →
`checkbox-group`).

**Alternatives considered**: a private `mention-filter.ts` copy — rejected: ~400 duplicated lines
that would silently drift from the combobox's copy, for the sole benefit of a smaller install.

**Contract detail confirmed from source**: `onFilter` fully replaces the matcher, and `exactMatch` is
ignored when `onFilter` is supplied (`use-filter-store.ts:57-60`). The `2`/`1.5` short-circuits for
an exact or prefix match run *before* `onFilter` — so a custom filter cannot hide an item whose value
equals or prefixes the term. That is upstream behaviour and is preserved.

**Auto-close on empty**: upstream closes the popup, clears the highlight and drops the virtual anchor
from `useFilterStore`'s `onCallback` when `itemCount === 0` (`mention-root.tsx:241-248`). Because the
port's filter store is a `$derived.by`, `itemCount` is fresh the instant `search` is written, so the
check runs synchronously at the end of the trigger-update path rather than in a callback — same
observable behaviour, one fewer frame of lag.

---

## R-04 — Direction / RTL

**Decision**: `useDirection({ dir: () => dir, element: () => ref })` from
`$lib/components/ui/direction-provider/index.js`; `<Mention.Content>` flips `align` (`start`↔`end`)
when the resolved direction is `rtl`.

**Rationale**: `direction-provider` already reproduces `@diceui/shared`'s `useDirection`, including
the DOM `[dir]` fallback and the `MutationObserver`. Upstream's align flip is four lines
(`mention-content.tsx:78-81`) and is reproduced as a `$derived`. Spec FR-030 / SC-008.

---

## R-05 — Native form participation

**Decision**: `FormControlState` from `$lib/components/ui/checkbox-group/index.js` decides whether a
form ancestor exists; a clipped `type="text"` input carries `name`, the comma-joined value list,
`disabled`, `required` and `readonly`, and re-dispatches a native `input` event when the value moves.

**Rationale**: identical to `combobox.svelte:237-296` and `tags-input`. `type="hidden"` (upstream's
`VisuallyHiddenInput`) is excluded from constraint validation, so a `required` mention with no
selection would submit — the clipped text input is the repo's established fix. Recorded as
divergence **D-6**; the spec already records the mapping in its Assumptions.

---

## R-06 — `asChild` on the input

**Decision**: a `child` snippet on `<Mention.Input>` receiving `{ props }`, where `props` carries
every attribute, every event handler **and an attachment** that registers the rendered element with
the root. Rendering `<textarea {...props}></textarea>` is then fully functional.

**Rationale**: all three upstream demos use `<MentionInput asChild><textarea /></MentionInput>`
(`mention-demo.tsx`, `mention-custom-trigger-demo.tsx`, `mention-custom-filter-demo.tsx`), so this is
not an optional escape hatch — it is the primary composition. The repo's standard `child` note says
"in `child` mode `ref` stays `null`", which would break Mention because the element is where every
caret read and write happens. `mask-input.svelte:154, 232-245` already solves exactly this by putting
a `createAttachmentKey()` attachment inside the child props, and `listbox-item.svelte:42, 90` uses the
same technique for registration. This port copies that precedent. Recorded as divergence **D-1**.

**Alternatives considered**: a boolean `multiline`/`asTextarea` prop — rejected as an invented API
(Principle II); requiring `bind:ref` from the caller — rejected: a snippet cannot `bind:`.

---

## R-07 — Item collection and jsdom visibility

**Decision**: a `MentionCollection` modelled on `ComboboxCollection`
(`combobox.svelte.ts:66-102`): `$state.raw` array, `register()` returning its own teardown, both
reads `untrack`ed, `getItems()` sorted by `compareDocumentPosition`. A filtered-out item stays
registered with a `null` element so it can come back.

**Rationale**: replaces `@diceui/shared`'s `useCollection`; `bits-ui` exposes no reusable collection.
The `untrack` discipline is required — see the memory note *"SvelteMap writes in `$effect`
self-invalidate"*; the combobox pattern is the proven fix in this repo.

**Testing consequence**: `bits-ui` layer content is not visible to jsdom's `getByRole`
(memory: *"bits-ui layer content is hidden in jsdom"*, and `combobox.test.ts:46-70` documents the same
workaround). Every popup assertion in `mention.test.ts` queries `[data-slot="mention-content"]` /
`[data-slot="mention-item"]`, never `getByRole('listbox' | 'option')`. Roles are asserted with
`toHaveAttribute('role', …)` on the elements found that way, so ARIA coverage is not weakened.

---

## R-08 — `requestAnimationFrame` scheduling

**Decision**: `await tick()` (once, or twice where upstream hops two frames) instead of
`requestAnimationFrame`.

**Rationale**: upstream's rAF hops exist to wait for React to commit newly-rendered items
(`mention-root.tsx:262-266`, `mention-input.tsx:336, 831-837`). Svelte's `tick()` resolves after the
DOM is flushed, is deterministic in jsdom, and needs no fake timers in tests. The one place upstream
waits for the *browser* rather than for React — `onPointerDown`'s caret repositioning
(`mention-input.tsx:773-775`) — also becomes `tick()`, because the caret write must land after the
default pointer handling, which Svelte flushes in the same turn.

---

## R-09 — The highlighter overlay

**Decision**: port `mention-highlighter.tsx` as `mention-highlighter.svelte`, rendered *by*
`<Mention.Input>` inside its `position: relative` wrapper. It is not a public part (upstream does not
export it either), but it is what emits the `data-tag` spans the MDX documents as the root's styling
API ("Mention tags can be styled using the `data-tag` attribute within the root").

**Rationale**: no primitive draws a mirrored, style-synchronised overlay behind a text field. The
`ResizeObserver` + `MutationObserver` + `scroll`/`resize` listeners become one `$effect` with a
teardown that disconnects all four (Principle I, and the memory note *"Teardown assertions go
vacuous"* — the test asserts the observers stop by asserting the listener count, not by asserting a
callback was not called after unmount).

`React.memo` and the custom `arePropsEqual` comparator are dropped: they are a React re-render
optimisation with no Svelte counterpart (translation rule "useMemo/useCallback → nothing"). Recorded
as divergence **D-8**.

---

## R-10 — The `readonly` prop spelling

**Decision**: keep upstream's lowercase `readonly`, even though `combobox` and `tags-input` in this
repo expose `readOnly`.

**Rationale**: Principle II is non-negotiable and the upstream Mention prop is literally `readonly`
(`mention-root.tsx:157`), asserted as such in the upstream test (`mention.test.tsx:135`). Combobox's
upstream prop was `readOnly`; these are two different upstream spellings, not an inconsistency this
port gets to normalise. The DOM attribute rendered is `readonly` either way.

---

## R-11 — `data-value` on the item

**Decision**: emit `data-value={value}` on `<Mention.Item>`.

**Rationale**: the MDX's data-attributes table for `MentionItem` documents `[data-value]` — "The
value of the item" — while the source only emits `data-selected` / `data-highlighted` /
`data-disabled`. The MDX is the contract (Principle II), so the documented attribute is emitted.
Recorded as divergence **D-7** (additive, documentation-conformant).

`DATA_ITEM_ATTR` (`data-dice-collection-item`) is also emitted, matching what the combobox port
already does, so DOM-order collection queries behave identically.

---

## R-12 — Paste-driven mention reconstruction

**Decision**: port `onPaste` (`mention-input.tsx:781-978`) including `normalizeWithGaps`, the
longest-word-combination greedy match, and the trailing-space bookkeeping. `normalizeWithGaps` is
**not** re-implemented — it is already exported from the combobox barrel and is byte-identical logic.

**Sequencing**: upstream opens the content and hops two frames so items register, keeping the content
visually hidden via `isPasting`. The port does the same: set `isPasting`, open, `await tick()` twice,
read `getEnabledItems()`, splice, then clear `isPasting` and close. The content carries
`data-pasting` plus the clip style while `isPasting`, so styling stays externally observable
(Principle VIII).

**Scope note**: upstream itself makes no guarantee that every pasted mention-like substring resolves;
the spec's Assumptions already record this as best-effort parity.

---

## R-13 — `modal`

**Decision**: `modal` maps to `Popover.Content`'s `preventScroll` (page-scroll lock) plus upstream's
`Tab`-selects-the-highlighted-item branch (`mention-input.tsx:630-638`).

**Rationale**: upstream's `modal` drives `useScrollLock` and `disableOutsidePointerEvents`
(`mention-content.tsx:129-136`). `bits-ui` covers both via `preventScroll` and its dismissible layer;
combobox already maps it the same way (`combobox-content.svelte:225`).

---

## R-14 — Keyboard set, confirmed key by key

From `mention-input.tsx:363-687` and the MDX keyboard table:

| Key                     | Behaviour                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `ArrowDown`             | open only; `next` if something is highlighted, else `first`; no-op while `readonly`             |
| `ArrowUp`               | open only; `prev` if something is highlighted, else `last`; no-op while `readonly`              |
| `Home` / `End`          | open only; `first` / `last`; **returns early** when `Meta`/`Ctrl` is held, so the caret jumps   |
| `Enter`                 | selects the highlighted item; with nothing highlighted it closes and does **not** `preventDefault` |
| `Escape`                | closes, clears highlight, clears search; focus stays in the field                               |
| `Tab`                   | `modal` → select and `preventDefault`; otherwise close and let focus move                       |
| `Backspace` / `Delete`  | with a selection overlapping mentions: remove them all in one edit                               |
| `Backspace`             | closed + no selection: caret at/inside a mention (or one space past it) removes the whole mention; a bare trailing space is removed first; `Meta`/`Ctrl` skips the space step |
| `ArrowLeft`/`ArrowRight`| no selection, no `Shift`: jump over an adjacent mention in one step; `Meta`/`Ctrl` jumps to its exact start/end |

`isNavigationKey` calls `preventDefault()` for all of `ArrowDown`, `ArrowUp`, `Enter`, `Escape`,
`Home`, `End` while the popup is open (never for `Tab`) — reproduced exactly, because it is what keeps
the caret still while the list owns the keys.

---

## R-15 — Trigger detection, stated precisely

From `mention-input.tsx:136-264`. The popup opens **iff** all of the following hold for
`i = text.lastIndexOf(trigger, caret)`:

1. `i !== -1`;
2. no tracked mention span satisfies `start <= i && end > i` (the trigger is not inside an existing
   mention);
3. either there is no non-whitespace text before `i` at all, **or** the character immediately before
   `i` is `' '` or `'\n'` (this is the word-boundary rule — it is what stops `foo@bar.com`);
4. `text.slice(i + 1, caret)` contains no space;
5. `caret > i`;
6. no interfering text after the caret: the first character after the caret is absent, `' '`, `'\n'`
   or the trigger itself, **or** the caret sits inside a tracked mention span.

The search term is `''` when `caret === i + 1`, else `text.slice(i + 1, caret)`. Failing any
condition closes the popup, clears the highlight and clears the search — but only if it was open.

This is extracted into a pure, rune-free function `resolveMentionTrigger()` in `mention-caret.ts` so
it can be unit-tested directly against every boundary case in spec User Story 3, independently of
rendering.

---

## R-16 — Zero new npm dependencies

**Confirmed**: every runtime need is already in `package.json` — `bits-ui@^2.18.1` (popover layer,
portal), `svelte@^5.56.1` (runes, attachments), `clsx`/`tailwind-merge` via `cn()`. Upstream's
`@floating-ui/react` is replaced by `bits-ui`; `@diceui/shared` is replaced by
`direction-provider` + `checkbox-group` + `combobox`'s filter module + this port's own state class.
No `tailwind-variants` is needed (Mention has no variants). No icons are needed, so
`@lucide/svelte` is **not** a dependency of this entry.

---

## Divergence register (all also carried into `plan.md`)

| #    | Upstream                                   | Here                                                          | Why                                                       |
| ---- | ------------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------- |
| D-1  | `asChild` + `Slot` on `MentionInput`       | `child` snippet whose props carry an element attachment       | No Svelte `Slot`; attachment keeps the element registered |
| D-2  | `MentionPortal container`                  | `<Mention.Portal to disabled>` over `bits-ui` `Popover.Portal` | Composition; matches `combobox-portal`                    |
| D-3  | `@floating-ui/react` + `useAnchorPositioner` | `bits-ui` `Popover.Content` + `customAnchor` virtual anchor  | Principle IV                                              |
| D-4  | `--dice-*` CSS variables                   | aliased onto `--bits-popover-*`                               | Same values, produced by the composed primitive           |
| D-5  | `fitViewport` (floating-ui `size`)         | `max-width`/`max-height` off the available-space variables    | `bits-ui` exposes no `size` middleware; same result       |
| D-6  | `VisuallyHiddenInput type="hidden"`        | clipped `type="text"` input                                   | `type="hidden"` skips constraint validation               |
| D-7  | item emits no `data-value`                 | item emits `data-value`                                       | The MDX documents `[data-value]`; MDX is the contract     |
| D-8  | `React.memo` on the highlighter            | dropped                                                       | React-only re-render optimisation                         |
| D-9  | `parseInt(lineHeight) ?? offsetHeight`     | `Number.isFinite` guard with the same fallback                | `??` never catches `NaN`; upstream bug, same intent       |
| D-10 | `requestAnimationFrame` hops               | `await tick()`                                                | Svelte's flush point; deterministic in jsdom              |
| D-11 | `onFilter`/`exactMatch` in `@diceui/shared` | reused from `combobox`'s ported filter module                | Principle IV; identical scoring contract                  |
| D-12 | `Enter` is `preventDefault`ed unconditionally by `isNavigationKey` | `Enter` is left to the field when nothing is highlighted | The keyboard contract states it, and upstream's redundant inner `event.preventDefault()` in the highlighted branch shows the same intent |
| D-13 | the zero-match auto-close reads the live `itemMap` | it reads the last option set seen with the popup mounted | A closed popup unmounts its items, so a live-only read makes *every* reopen with a non-empty search look like "nothing matches" |
| D-14 | `parseFloat(padding-*)` and `textWidth / containerWidth` are unguarded | the same `Number.isFinite` guard as D-9, plus a zero-width divisor guard | Extends D-9's fix to the rest of `getCaretRect`, so the `DOMRect` handed to the floating layer is never `NaN` |
| D-15 | the highlighter walks `mentions` in registration order | it walks them in text order | A mention inserted *before* an existing one would otherwise emit an out-of-order overlay |
| D-16 | no teardown guard on the `requestAnimationFrame` hops | `MentionRootState.destroy()`, checked by every deferred path | Svelte reports `derived_inert` when a `tick()` continuation outlives its component; the guard is a plain field, so it is safe to read after teardown |

**Every question is resolved; no unresolved-clarification marker remains.**
