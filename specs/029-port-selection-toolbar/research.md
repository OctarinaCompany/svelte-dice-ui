# Phase 0 Research — Selection Toolbar

All upstream references are the pinned commit `d9763d8` vendored at `.reference/diceui`. Line numbers
refer to `.reference/diceui/docs/registry/bases/radix/ui/selection-toolbar.tsx` unless stated
otherwise. The `base` flavour (`base/ui/selection-toolbar.tsx`) exposes an **identical** prop interface
(verified: `SelectionToolbarProps`, base 100-118 vs radix 101-117), so one port covers both.

No `NEEDS CLARIFICATION` markers remained in the spec; the questions below are the technical unknowns
this plan had to close before design.

---

## R-01 — Can a `bits-ui` primitive anchor to a text-selection rectangle?

**Decision**: Yes. Compose `bits-ui` `Popover.Root` / `Popover.Portal` / `Popover.Content` and pass the
selection rect as a virtual anchor through `customAnchor`.

**Evidence**: `node_modules/bits-ui/dist/bits/utilities/floating-layer/types.d.ts:93` types
`customAnchor?: string | HTMLElement | Measurable | null`, and `Measurable` is
`{ getBoundingClientRect(): DOMRect }` — floating-ui's virtual-element protocol, the exact shape
upstream builds at 226-241. `use-floating-layer.svelte.js:29-38` prefers `customAnchorNode` over the
trigger node, so **no `Popover.Trigger` is required**.

**Rationale**: Constitution IV ranks a `bits-ui` primitive above bespoke code. `Popover.Content` is
floating-ui underneath (`@floating-ui/dom@1.8.0` is already in the tree as a `bits-ui` dependency), so
the middleware upstream configures is the middleware we get:

| Upstream (`useFloating` middleware)                       | `Popover.Content` prop                            |
| --------------------------------------------------------- | ------------------------------------------------- |
| `offset({ mainAxis: sideOffset, alignmentAxis: alignOffset })` | `sideOffset`, `alignOffset`                    |
| `shift({ limiter: sticky === "partial" ? limitShift() : … })`  | `sticky`                                        |
| `flip(detectOverflowOptions)`                              | `avoidCollisions`                                 |
| `detectOverflowOptions.boundary` / `.padding`              | `collisionBoundary`, `collisionPadding`           |
| `size({ apply: … --selection-toolbar-* })`                 | `--bits-popover-*` CSS variables (see R-05)       |
| `hide({ strategy: "referenceHidden" })`                    | `hideWhenDetached`                                |
| `autoUpdate({ animationFrame: strategy === "always" })`    | `updatePositionStrategy`                          |
| `transformOrigin` custom middleware                        | `--bits-popover-content-transform-origin`         |
| `strategy: "fixed"`                                        | `strategy="fixed"`                                |

**Alternatives considered**:

- _Bespoke positioner reusing `action-bar/action-bar-floating.svelte.ts`_ (what the spec originally
  assumed, and what the porting guidance asked for). Rejected: that module docks to a **viewport edge**
  (`getViewportEdgeStyle()` emits `fixed` + `top/bottom/left/right`; `floatingSurfaceVariants` hard-codes
  `fixed z-50` and `top`/`bottom`-only slide animations). Nothing in it computes a placement against a
  moving anchor, so `flip`, `shift`+`limitShift`, `hideWhenDetached`, `collisionBoundary`,
  `collisionPadding` and `updatePositionStrategy` — six documented props — would all have to be
  re-implemented, against Principle IV and at real risk to SC-003 (viewport-edge correctness).
- _Adding `@floating-ui/dom` as a direct dependency_. Rejected: a new npm dependency the spec forbids,
  duplicating what `bits-ui` already ships.
- _`$lib/components/ui/popover`'s `Popover.Content` wrapper_ (tier-1 under Principle IV). Rejected: its
  chrome (`w-72 bg-popover p-2.5 gap-2.5 ring-1 flex-col`) is a panel, not a toolbar, and overriding
  six conflicting utilities is less readable than composing the primitive. `combobox-content.svelte`
  set this precedent: it also uses `PopoverPrimitive.Content` directly with `role="listbox"`.

**Confirmed side-effects of the choice** (each verified in `bits-ui` source):

- `mergeProps(restProps, contentState.props)` (`popover-content.svelte:40`) — bits' own props win for
  keys it sets (`id`, `tabindex`, `data-state`, `style`, handlers are chained). It sets **no** `role`,
  so `role="toolbar"` + `aria-label` pass through (proved by `combobox-content.svelte:207`).
- `data-state` is `"open"`/`"closed"` (`popover.svelte.js:327`) — exactly the documented attribute.
- Escape and outside-pointer dismissal come from the escape/dismissible layers; we hook
  `onEscapeKeydown` / `onInteractOutside` to also clear the browser selection (FR-008, FR-009).

---

## R-02 — Will the popover layers fight the text selection?

**Decision**: Pass `trapFocus={false}`, `onOpenAutoFocus`/`onCloseAutoFocus` default-prevented,
`preventScroll={false}` and `preventOverflowTextSelection={false}`.

**Rationale**: moving focus into the surface would collapse the very selection the toolbar acts on.
`FocusScopeProps.trapFocus` already defaults to `false`
(`bits/utilities/focus-scope/types.d.ts`), but `Popover.Content` re-defaults it to `true`
(`popover-content.svelte:22`) and still fires an auto-focus event, so both must be neutralised
explicitly. `TextSelectionLayerState` (`use-text-selection-layer.svelte.js:53-70`) sets
`body { user-select: none }` while a pointer is down **inside** the layer; upstream does no such thing,
so it is disabled for parity (FR-014). `preventScroll` must stay `false` because the page has to keep
scrolling under an open toolbar (the scroll listener repositions it).

**Alternatives considered**: leaving the defaults and compensating in the item handlers — rejected as
fragile and unobservable in tests.

---

## R-03 — Escape and outside-pointer dismissal: bits layers or upstream's own listeners?

**Decision**: use the popover's escape and dismissible layers, wiring `onEscapeKeydown` and
`onInteractOutside` to `clearSelection()` (remove all ranges, then close).

**Rationale**: behaviourally identical to upstream's two `document` listeners (498-521) for the flat
case, and strictly better when nested — bits' layers form a stack, so a toolbar inside a dialog
consumes `Escape` alone instead of both surfaces closing. It also removes two hand-managed listeners.

**Alternatives considered**: `EscapeDismissState` from `action-bar-floating.svelte.ts` (the reuse the
porting guidance suggested). Rejected: it duplicates the escape layer that ships with the surface we
are already mounting, does not participate in the layer stack, and would drag a
`registryDependencies: ["action-bar"]` edge onto every consumer for one 25-line class. Recorded as an
explicit deviation in `plan.md`.

---

## R-04 — Selection tracking

**Decision**: bespoke `SelectionToolbarRootState` in `selection-toolbar.svelte.ts`, a verbatim
translation of upstream 390-496:

- `mouseup` on `container ?? document` → `requestAnimationFrame` → `updateSelection()`
- `selectionchange` on `document` → close when `selection.toString().trim()` is empty
- `scroll` + `resize` on `window`, `{ passive: true }` → `scheduleUpdate()` (one rAF token, re-entrancy
  guarded, only re-reads while open)
- teardown removes all four listeners and cancels a pending frame

**Rationale**: no primitive exposes the Selection API (R-01 note on `text-selection-layer`). Upstream's
"changed?" comparison (423-444) is what keeps an _extended_ selection from closing and reopening, and is
what makes `onSelectionChange` fire once per real change; it is ported as-is. The state class receives
reactive inputs as getter functions (`getContainer`, `getOpen`, …) per CLAUDE.md §4.

**Consequences worth recording**:

- Touch: upstream opens only from `mouseup`, so on platforms that do not synthesise it the toolbar
  stays closed and the native selection UI is untouched. Preserved verbatim (FR-014).
- `container={null}` (as opposed to `undefined`) is upstream's "scoped but unresolved" state:
  `containerProp !== undefined` enters the scope check, `getContainer()` returns `null`, and
  `updateSelection` returns early **without** closing (403-406). Ported exactly, including the early
  return.

---

## R-05 — The four documented CSS variables

**Decision**: alias them onto the variables the floating layer already computes, in the root's `style`:

```
--selection-toolbar-available-width:  var(--bits-popover-content-available-width);
--selection-toolbar-available-height: var(--bits-popover-content-available-height);
--selection-toolbar-anchor-width:     var(--bits-popover-anchor-width);
--selection-toolbar-anchor-height:    var(--bits-popover-anchor-height);
```

**Evidence**: `internal/floating-svelte/floating-utils.svelte.js:getFloatingContentCSSVars("popover")`
maps those names onto `--bits-floating-*`, which
`use-floating-layer.svelte.js:138-142` writes from the `size` middleware — the same numbers upstream's
`size({ apply })` writes (308-334). The anchor is our virtual element, so anchor width/height are the
selection rect's dimensions, exactly as upstream.

**Alternatives considered**: re-running `size` ourselves — rejected, duplicate work with a second
observer. Precedent: `combobox-content.svelte:158-169` aliases the same variables.

---

## R-06 — Item activation and the `selectiontoolbar.select` event

**Decision**: port upstream 606-663 unchanged. A non-reactive `pointerType` field defaults to
`"touch"`; `pointerdown` records the real type and calls `preventDefault()` only for `"mouse"`;
`pointerup` activates for mouse; `click` activates for everything else (touch, pen, and the synthetic
click produced by `Enter`/`Space` on a `<button>`).

**Rationale**: the mouse `preventDefault()` is what stops the browser from collapsing the selection on
press; skipping it for touch is what keeps the native handles alive (FR-014). Defaulting to `"touch"`
is what makes keyboard activation work, since keyboard clicks carry no pointer event — this is the
FR-010 "must not require a mouse" path and it is tested directly.

The event itself is a real bubbling, cancelable `CustomEvent<{ text: string }>` dispatched on the item,
with `onSelect` attached as a `{ once: true }` listener — the same pattern already shipped in
`action-bar-item.svelte`, so consumers can listen on an ancestor.

---

## R-07 — Controlled/uncontrolled open state

**Decision**: `open = $bindable()` seeded once with `open ??= false` (upstream's `openProp ?? false`,
143-147); every internal transition writes `open` and then calls `onOpenChange`. No `defaultOpen` prop —
upstream has none, and an initial-open selection toolbar is meaningless.

**Rationale**: upstream syncs `openProp` into its store in a layout effect (209-213) but still lets a
new selection open the toolbar; a `$bindable` reproduces that exactly for `bind:open`, and CLAUDE.md §4
makes it the house pattern. Known limitation, already recorded in project memory: when the consumer
passes `open` **without** `bind:`, our writes are local and a props invalidation resets them — the same
caveat every ported component carries, and the reason the controlled test uses a binding.

---

## R-08 — Portalling to a `DocumentFragment`

**Decision**: `selection-toolbar-portal.svelte` wraps `bits-ui`'s `Portal`; when `portalContainer` is a
`DocumentFragment`, an effect appends a `display: contents` host `<div>` to it and portals into that
host, removing it on teardown.

**Rationale**: `PortalTarget` is `Element | string` (`bits/utilities/portal/types.d.ts`) and bits throws
for anything else, but upstream types `portalContainer` as `Element | DocumentFragment | null` (107).
The bridge is the pattern already proven in `action-bar-portal.svelte`. A `string` selector is accepted
as a bonus (D-4). `null`/`undefined` both mean `document.body`, matching upstream 523-524.

---

## R-09 — Direction / RTL

**Decision**: add a `dir` prop resolved through `useDirection({ dir: () => dir, element: () => ref })`
from `$lib/components/ui/direction-provider`, pass it to `Popover.Content`'s `dir`, and write it onto
the surface element in an effect (bits consumes `dir` as a prop and does not re-emit the attribute —
`combobox-content.svelte:182-188` sets the precedent).

**Rationale**: FR-015 and Principle III require RTL to work like the rest of the set. Upstream has no
`dir` prop (it inherits ambient direction through floating-ui's placement logic); adding it is an
additive divergence (D-8) with no behaviour removed. `align="start"/"end"` inversion is performed by the
floating layer once it knows the direction.

**Testing note**: placement itself cannot be asserted in jsdom (all rects are zero), so the RTL test
asserts the resolved direction reaches the surface — the input the layer branches on.

---

## R-10 — Testing strategy under jsdom

**Decision**: drive the component through the real DOM APIs it listens to, with a
`selection-toolbar.test.svelte` harness that renders a `contenteditable` container plus the toolbar:

1. build a `Range` over the fixture text, `selection.removeAllRanges(); selection.addRange(range)`;
2. dispatch the event upstream actually opens from — a `mouseup` on the container via `userEvent`;
3. `await` one animation frame (upstream defers to rAF), then assert;
4. to close, collapse/remove the range and dispatch `selectionchange` on `document`.

**Rationale**: jsdom implements `window.getSelection()`, `Range` and `requestAnimationFrame`, but does
**not** fire `selectionchange` for programmatic selection changes, so the close path has to be triggered
by dispatching the event the component subscribes to. That is the component's real contract surface, not
a stub of its internals. `Range.getBoundingClientRect()` returns zeros in jsdom, which is fine: the open
decision depends on the text being non-empty, not on the rect.

`vitest`'s `expect.requireAssertions` is on and `globals: false`, so every `it` asserts and imports its
helpers explicitly; `tests/setup.ts` already shims `ResizeObserver`, `matchMedia`, pointer capture and
`scrollIntoView`, which is what `Popover.Content` needs to mount (proved by the passing
`combobox`/`time-picker`/`phone-input` suites, which all render bits floating content).

---

## R-11 — Upstream tests

**Decision**: none exist. A search for `selection-toolbar*test*` across `.reference/diceui` returns
nothing, so the assertion floor is the MDX contract (props, `[data-state]`, the four CSS variables, the
`Escape` interaction) plus CLAUDE.md §7's six areas. Recorded so `/speckit-analyze` does not flag the
missing "port the upstream tests first" step.

---

## R-12 — Demo inventory (Principle IX)

Two upstream demos, identical in both flavours: `selection-toolbar-demo.tsx` (bold/italic/link +
separator + copy/share over a `contenteditable` article) and `selection-toolbar-info-demo.tsx`
(`onSelectionChange` driving a live word/character readout). Both become one `<ComponentPreview>`
each. The link demo's `prompt()` is replaced by a fixed placeholder URL — `prompt()` is blocked in
many browsers and would make the demo route untestable in a build/preview context; the wrapping
behaviour it demonstrates is unchanged.
