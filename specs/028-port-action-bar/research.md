# Phase 0 Research: Action Bar

Every decision below is resolved against the pinned upstream commit
(`d9763d82530416dfa4c81c462387b55d06bae4ec`, vendored at `.reference/diceui`), the constitution, and
existing ports in this repository. **Every open question is resolved; no clarification markers remain.**

Sources read in full: `docs/registry/bases/radix/ui/action-bar.tsx` (669 lines),
`docs/types/radix/action-bar.ts`, `docs/content/docs/components/radix/action-bar.mdx`,
`docs/registry/bases/radix/examples/action-bar-demo.tsx`,
`docs/registry/bases/radix/examples/action-bar-position-demo.tsx`, and — for the reuse contract —
`docs/registry/bases/radix/ui/selection-toolbar.tsx`. In-repo references: `speed-dial`,
`direction-provider`, `banner`, `combobox`, `button`.

---

## R-01 — Which upstream base to port

**Decision**: the `radix` base only (`docs/registry/bases/radix/ui/action-bar.tsx`).

**Rationale**: every prior port in this repo tracks the `radix` base, and the spec Assumptions fix it.
The `base` (Base UI) variant is a parallel implementation with the same public API.

**Alternatives considered**: porting both bases — rejected, it would produce two registry items for
one documented component and doubles the parity surface with no consumer benefit.

---

## R-02 — Portalling

**Decision**: compose `bits-ui`'s `Portal`, wrapped by `action-bar-portal.svelte`, which adds
`DocumentFragment` support by appending a `display: contents` host `<div>` to the fragment and
portalling into that host.

**Rationale**: upstream uses `ReactDOM.createPortal(node, portalContainer)` where `portalContainer` is
`Element | DocumentFragment | null`. `bits-ui`'s `PortalTarget` is `Element | string` and
`portal.svelte` throws a DEV `TypeError` for anything else, so the fragment case needs a
five-line bridge. `bits-ui` still performs the mount, keeps `getAllContexts()` propagation, and is
already a no-op outside the browser (SSR-safe), which is exactly upstream's `mounted` guard.

**Alternatives considered**: (a) hand-rolled `mount()`/`unmount()` portal — rejected, it duplicates
`bits-ui` and loses context propagation guarantees; (b) dropping `DocumentFragment` from the type —
rejected, it is part of the documented upstream API (Principle II).

---

## R-03 — `portalContainer={null}` semantics

**Decision**: `null` and `undefined` both resolve to `document.body`; the bar still renders.

**Rationale**: upstream line 190-191 is
`portalContainerProp ?? (mounted ? globalThis.document?.body : null)`. `??` falls through on `null`,
so an explicit `null` yields `document.body`. The `if (!portalContainer || !open) return null` guard
(line 193) can therefore only be hit by `!open` or by the pre-mount SSR pass. The spec's original
edge case claimed the opposite; it misread the operator and has been corrected in `spec.md`.

**Alternatives considered**: honouring the spec's original wording — rejected, Principle II admits no
exception and the source is unambiguous.

---

## R-04 — Viewport-edge positioning

**Decision**: bespoke `getViewportEdgeStyle({ side, sideOffset, align, alignOffset })` returning a CSS
text string, applied as `style` on the root and merged before the caller's `style`.

**Rationale**: upstream builds the identical object (lines 220-229):
`{ [side]: '<sideOffset>px' }` plus `align === 'center' ? { left: '50%', translate: '-50% 0' } :
align === 'start' ? { left: '<alignOffset>px' } : { right: '<alignOffset>px' }`, with the caller's
`style` spread last. The anchor is the viewport, not an element.

**Alternatives considered**: `bits-ui` `Popover`/`Tooltip` positioning — rejected, every `bits-ui`
positioner is anchor-relative and needs a trigger element; a virtual anchor still could not express
"16px from the viewport's bottom edge, `alignOffset` from its inline start". Documented in the spec
Assumptions and in `plan.md` justification 1.

**Note on RTL**: upstream uses physical `left`/`right`, *not* logical `inset-inline-*`, so
`align="start"` stays visually left-anchored under `dir="rtl"`. The port keeps that verbatim; only
arrow-key navigation inverts (FR-015 applies to keyboard behaviour, which is where upstream inverts).

---

## R-05 — Escape dismissal

**Decision**: bespoke `EscapeDismissState` in `action-bar-floating.svelte.ts` — an `$effect` that,
while open, attaches `keydown` to the root's `ownerDocument` and on `Escape` calls
`onEscapeKeyDown?.(event)` then `onOpenChange?.(false)` unless `event.defaultPrevented`; teardown
removes the listener.

**Rationale**: verbatim translation of upstream lines 162-178, including the `ownerDocument ??
document` resolution (correct inside an iframe) and the `defaultPrevented` check.

**Alternatives considered**: `bits-ui` `Dialog`/`Popover` escape layers — rejected, `bits-ui` exports
no standalone escape utility (its public export list is the widget namespaces plus `Portal`,
`IsUsingKeyboard`, `BitsConfig`, `computeCommandScore`), and the widgets that own the behaviour bundle
modality, focus trapping, scroll locking and outside-click dismissal, none of which the non-modal
Action Bar has.

---

## R-06 — Roving focus: which primitive

**Decision**: bespoke `RovingFocusGroupState` in `action-bar-roving-focus.svelte.ts`, composing
`speed-dial`'s exported `DomOrderedCollection` for the item registry.

**Rationale**: three hard blockers against `bits-ui` `Toolbar`: (1) it scopes roving focus to
`Toolbar.Root`, i.e. the entire bar, but `ActionBarClose` must have its own independent tab stop
(FR-012); (2) `bits-ui`'s `Toolbar.Group` is a toggle group (`value`/`onValueChange`/`aria-pressed`),
not a `role="group"` focus sub-scope; (3) `Toolbar` has no portal, no viewport positioning and no
`onSelect`/auto-close contract. `DomOrderedCollection` already implements upstream's
`compareDocumentPosition` sort and `isConnected` filter, so the *registry* half is composed, not
rewritten.

**Alternatives considered**: `bits-ui` `Toolbar` (above); re-implementing the collection inside
action-bar — rejected, `speed-dial` already exports it for exactly this purpose and
`segmented-input`/`time-picker` set the cross-component `registryDependencies` precedent.

---

## R-07 — `focusableItemCount` as `$derived`, not a counter

**Decision**: `focusableCount = $derived(collection.ordered.filter((e) => !e.meta.getDisabled()).length)`.

**Rationale**: upstream keeps a manual counter mutated by `onFocusableItemAdd`/`onFocusableItemRemove`
from each item's layout effect (lines 284-290, 449-466) — a React workaround for not having derived
state. The translation rules forbid mutating reactive state in an `$effect` where `$derived` will do.
Observable behaviour is identical: the group's `tabindex` is `-1` when the count is `0`.

**Alternatives considered**: literal port of the counter — rejected by the constitution's Principle I
and by the double-registration hazard when `disabled` toggles.

---

## R-08 — `onFocus`/`onBlur` translation: `focusin`/`focusout`

**Decision**: the group listens on `onfocusin` (entry focus) and `onfocusout` (reset
`isTabbingBackOut`), not on `onfocus`/`onblur`.

**Rationale**: React's `onFocus`/`onBlur` are delegated `focusin`/`focusout` and therefore *bubble*.
Upstream relies on that: `onBlur` must fire when focus leaves an **item** (line 318-326) to clear the
tabbing-back-out flag, which a native non-bubbling `blur` handler on the group would never see. The
entry-focus handler already guards with `event.target === event.currentTarget`, so `focusin` reproduces
it exactly. `onMouseDown` maps to `onmousedown` verbatim (no bubbling subtlety).

**Alternatives considered**: `onfocus`/`onblur` — rejected, it silently breaks the Shift+Tab re-entry
case in the Edge Cases section of the spec.

---

## R-09 — Distinguishing keyboard entry from click entry

**Decision**: keep upstream's per-group `isClickFocus` flag set in `onmousedown` and cleared at the end
of the `focusin` handler (a plain non-reactive class field, not `$state`).

**Rationale**: literal parity with lines 333, 355, 360-368. The flag is read once inside an event
handler and never rendered, so it must not be reactive (translation table: "`useRef` (mutable box,
non-reactive) → a plain `let` or a private class field").

**Alternatives considered**: `bits-ui`'s exported `IsUsingKeyboard` — rejected, it is a *global*
last-input-modality heuristic, not the per-group "this focus came from the mousedown I just saw"
signal; it would misfire when a keyboard user clicks once anywhere on the page.

---

## R-10 — Arrow-key navigation algorithm

**Decision**: verbatim port of lines 505-556, in `getFocusIntent()` + `RovingFocusGroupState.navigate()`:

1. `Shift+Tab` on an item → `onItemShiftTab()` and return (no navigation).
2. Ignore events whose `target !== currentTarget`.
3. `key = getDirectionAwareKey(event.key, dir)` — swaps `ArrowLeft`↔`ArrowRight` when `dir === 'rtl'`.
4. Horizontal: `ArrowLeft`→prev, `ArrowRight`→next, `Home`→first, `End`→last.
   Vertical: `ArrowUp`→prev, `ArrowDown`→next, `Home`→first, `End`→last.
5. Bail out if any of `metaKey`/`ctrlKey`/`altKey`/`shiftKey` is held; otherwise `preventDefault()`.
6. Candidates = enabled items in document order; `last` reverses; `prev` reverses then slices/wraps
   from `currentIndex + 1`; `next` slices/wraps from `currentIndex + 1`. `loop` chooses
   `wrapArray(candidates, currentIndex + 1)` over `candidates.slice(currentIndex + 1)`.
7. `queueMicrotask(() => focusFirst(candidates))`.

**Rationale**: the `reverse`-then-`wrap` trick is what makes one code path serve prev/next/first/last;
paraphrasing it is how off-by-one wrap bugs get introduced. `queueMicrotask` keeps the focus move
after the keydown's default handling, matching upstream.

**Alternatives considered**: an index-arithmetic rewrite — rejected, harder to audit against upstream
and behaviourally different at the ends when `loop` is `false`.

---

## R-11 — `focusFirst` semantics

**Decision**: port lines 35-47 exactly, over `HTMLElement[]` instead of ref objects: remember
`document.activeElement`; for each candidate, return immediately if it *is* the previously focused
element, otherwise `focus({ preventScroll })` and return as soon as `document.activeElement` actually
changed.

**Rationale**: the "already focused → stop" and "focus refused (e.g. detached/disabled) → try next"
behaviour is what makes `Home` on the first item a no-op instead of a jump, and what skips items the
browser refuses to focus.

**Alternatives considered**: `candidates[0]?.focus()` — rejected, breaks both behaviours above.

---

## R-12 — `onSelect` and the `actionbar.itemSelect` event

**Decision**: reproduce the real DOM plumbing. On click: run the caller's `onclick` first, bail on
`defaultPrevented`, then attach a `{ once: true }` listener for `actionbar.itemSelect` on the item that
invokes `onSelect`, dispatch `new CustomEvent('actionbar.itemSelect', { bubbles: true, cancelable: true })`,
and call `onOpenChange(false)` only when the event was not default-prevented.

**Rationale**: exactly upstream lines 468-492, and exactly the pattern already shipped by
`speed-dial-action.svelte` (`speedDial.actionSelect`). It is a strict superset of the observable
contract the spec assumed: `onSelect` still receives a cancelable event and `preventDefault()` still
keeps the bar open, and consumers additionally get the documented bubbling event on ancestors. The
group's entry-focus event (`actionbarFocusGroup.onEntryFocus`, `{ bubbles: false, cancelable: true }`)
is reproduced the same way (lines 339-341).

**Alternatives considered**: a synthetic `{ preventDefault, defaultPrevented }` object — rejected, it
loses the bubbling event that upstream documents and is no simpler.

---

## R-13 — Keyboard activation of an item

**Decision**: no explicit `Enter`/`Space` handling; the item is a real `<button type="button">`, so the
browser synthesises the `click` that drives `onSelect`.

**Rationale**: upstream does the same — `ActionBarItem` renders `Button` and only handles arrow/Home/
End/Shift+Tab in `onKeyDown`. Tests still assert `Enter` and `Space` activate the item, since that is
the behaviour the WAI-ARIA Toolbar pattern requires and native semantics deliver.

---

## R-14 — `ActionBarItem` outside a group throws

**Decision**: `ActionBarItem` requires **both** an `ActionBar` ancestor and an `ActionBarGroup`
ancestor; it throws
`` `<ActionBar.Item>` must be used within `<ActionBar>`. `` / `` … within `<ActionBar.Group>`. ``.

**Rationale**: upstream calls `useActionBarContext(ITEM_NAME)` then `useFocusContext(ITEM_NAME)` (lines
442-444) and both throw. The MDX's "When used inside a `Group`, participates in roving focus" describes
the effect, not optionality. It also matches the repo's composition rule ("Items always inside their
Group component"). The message names the required Svelte ancestor rather than upstream's internal
`FocusProvider`, which has no user-visible counterpart here.

---

## R-15 — Direction resolution

**Decision**: `useDirection({ dir: () => dir, element: () => ref })` from
`$lib/components/ui/direction-provider`, resolving `explicit prop → nearest provider → DOM `dir` →
'ltr'`; the resolved value is written to the root's `dir` attribute and published on context.

**Rationale**: mirrors upstream's `DirectionPrimitive.useDirection(dirProp)` (line 156) and is the
established in-repo pattern (`tags-input.svelte:162`, `marquee.svelte:125`). Adds a registry dependency
on `direction-provider`, as eight prior ports already do.

---

## R-16 — Uncontrolled `defaultOpen`

**Decision**: add `defaultOpen` (default `false`) and make `open` `$bindable`; the root seeds
`open ??= defaultOpen` once and never mutates `open` outside `setOpen()`, which writes `open` and then
calls `onOpenChange(next)`.

**Rationale**: CLAUDE.md §4 requires every value-bearing prop to work controlled *and* uncontrolled.
When only `open`/`onOpenChange` are supplied the behaviour is upstream-identical: `setOpen` assigns to
the caller's binding (or to the local copy if unbound) and always notifies. Recorded in the spec
Assumptions.

**Known hazard**: memory `bindable-prop-resets-on-props-invalidation` — a non-bound `$bindable` prop is
reset on props invalidation, so uncontrolled tests must not rely on `rerender()` preserving internal
open state; the `.test.svelte` harness owns the state instead.

---

## R-17 — Transition, and the FR-008 "exit" clause

**Decision**: CSS-only transition via the exported `floatingSurfaceVariants` `tv()` recipe —
`animate-in fade-in-0 zoom-in-95 duration-250 [animation-timing-function:cubic-bezier(0.16,1,0.3,1)]`,
`data-[side=bottom]:slide-in-from-bottom-4`, `data-[side=top]:slide-in-from-top-4`,
`motion-reduce:animate-none motion-reduce:transition-none`, plus the mirrored
`data-[state=closed]:animate-out …` half for reuse. `ActionBar` itself unmounts synchronously when
`open` becomes `false`.

**Rationale**: upstream lines 211-214 are enter-only, because the component returns `null` when closed.
FR-001 and the spec's "action bar is closed" edge case both mandate synchronous unmount, so an actual
exit animation would contradict the spec's own acceptance scenario 1. FR-008's operative requirement —
"the transition primitive MUST be reusable outside this component" — is satisfied by exporting the
recipe with both halves. `tw-animate-css` is already imported by `src/app.css`, so all utilities exist
and no dependency is added.

---

## R-18 — Separator: why not `$lib/components/ui/separator`

**Decision**: bespoke `<div role="separator" aria-hidden="true">` with a `tv()` recipe, not the shared
`separator` component.

**Rationale**: upstream deliberately combines `role="separator"` with `aria-hidden="true"` (a purely
decorative divider that is still selectable for styling), and its class list depends on the
`in-data-[slot=action-bar-selection]:` contextual variant to shrink inside the selection pill — neither
is expressible through the shared `separator`'s API, which renders a `bits-ui` `Separator` with its own
ARIA contract. Recorded in the spec Assumptions.

---

## R-19 — Demo page composition

**Decision**: two `<ComponentPreview>` sections mirroring the two upstream demos, both portalling to
`document.body` as upstream does, plus six props tables built with `$lib/components/ui/table`.

- **Default** ← `action-bar-demo.tsx`: a task list of `Checkbox` + `Label` rows, `open` derived from
  `selected.size > 0`, `onOpenChange(false)` clearing the selection, `ActionBarSelection` with the
  count + inline `ActionBarSeparator` + `ActionBarClose`, and a group of Duplicate / Delete
  (`variant="destructive"`) items. Icons: `copy`, `trash-2`, `x` from `@lucide/svelte`.
- **Position** ← `action-bar-position-demo.tsx`: a `Switch` for open plus two `Select`s driving `side`
  and `align`, with Favorite / Archive items. Icons: `star`, `archive`, `x`.

**Rationale**: Principle IX requires one section per upstream demo. Keeping both portalled to the body
matches upstream; `fixed` positioning would ignore a preview-scoped container anyway unless that
container created a containing block.

---

## R-20 — Test strategy

**Decision**: `action-bar.test.ts` (Vitest specs) + `action-bar.test.svelte` (harness, excluded from
`registry.json` and from Vitest's `include`), covering the six mandatory areas of CLAUDE.md §7. The
harness owns modes for: default, controlled, uncontrolled, vertical, RTL, `loop={false}`, disabled
item, `child` snippet, and each part rendered with no provider.

**Rationale**: upstream ships no test file for `action-bar` (no `docs/registry/bases/radix/test/
action-bar.test.tsx`), so the assertion floor is the MDX keyboard table plus the data-attribute tables,
not a test to port. Queries go through `document.querySelector('[data-slot=…]')` and
`screen.getByRole('toolbar')` because the content is portalled outside the testing-library container —
the `speed-dial` precedent.

**Known jsdom constraints**: `tests/setup.ts` already shims `ResizeObserver`, `matchMedia`, pointer
capture and `scrollIntoView`. `compareDocumentPosition` and `focus()` work natively in jsdom;
`queueMicrotask` resolves before `await user.keyboard(...)` settles, so no fake timers are required.
