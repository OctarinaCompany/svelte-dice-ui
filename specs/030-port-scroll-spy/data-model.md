# Phase 1 Data Model: Scroll Spy

Entities are the runtime state objects of the component, not persisted data — this is a UI library.
Each maps to one entity in the spec's "Key Entities" section.

---

## 1. `SectionRegistry` — `section-observer.svelte.ts`

The set of content sections currently eligible for visibility tracking. Deliberately standalone: it
imports nothing from the rest of the folder so `tour` can reuse it (spec Assumption; research D-6).

| Field / member                          | Type                          | Notes                                                                                     |
| --------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------- |
| `#entries`                               | `Map<string, Element>`        | Non-reactive. Upstream `sectionMapRef` (line 157). Last registration for an id wins.        |
| `#version`                               | `$state<number>`              | Bumped on every membership change; the observer effect reads it (research R-03).            |
| `version` (getter)                       | `number`                      | Reactive read handle.                                                                       |
| `size` (getter)                          | `number`                      | Reads `#version` first, so it is reactive.                                                  |
| `register(id, element)`                  | `void`                        | No-op when `id` is falsy (**FR-012**). Bumps `#version` only when membership truly changed.  |
| `unregister(id)`                         | `void`                        | No-op when absent. Bumps `#version` on real removal.                                        |
| `has(id)`                                | `boolean`                     | Gate for observer-driven activation (upstream line 260).                                    |
| `elements()`                             | `Iterable<Element>`           | What the observer observes.                                                                 |

**Validation rules**: `id === ''` (or any falsy id) is never stored — FR-012. Re-registering the same
id with the same element does not bump `#version` (prevents an effect loop when a section re-runs its
registration effect with unchanged inputs).

**State transitions**: `absent → registered` (`register`), `registered → absent` (`unregister`, run
from the section's `$effect` teardown, i.e. on unmount or on a `value` change).

---

## 2. Observer wrapper — `section-observer.svelte.ts` (functions, no state)

| Export                                                     | Signature                                                                              | Notes                                                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `SectionObserverOptions`                                    | `{ root?: Element \| null; rootMargin?: string; threshold?: number \| number[] }`      | Mirrors `IntersectionObserverInit` minus `Document` roots (upstream passes an `HTMLElement \| null`).                |
| `pickTopmostEntry(entries)`                                 | `(entries: readonly IntersectionObserverEntry[]) => IntersectionObserverEntry \| null` | **Pure.** Filters `isIntersecting`, reduces to the smallest `boundingClientRect.top`. `null` for an empty set (upstream lines 249-257). |
| `observeSections(elements, onTopmost, options)`             | `=> () => void`                                                                        | Creates the observer, coalesces each batch into one `requestAnimationFrame`, calls `onTopmost(element)`. Teardown disconnects **and** cancels the pending frame. |

**Invariants**

- SSR / no-`IntersectionObserver` environment ⇒ `observeSections` subscribes to nothing and returns a
  no-op teardown, so callers never branch (the `observeScrollPosition` precedent).
- At most one pending `requestAnimationFrame` exists per wrapper instance; a new batch cancels the
  previous one (upstream lines 244-247), so activation cannot flap within a frame.
- `onTopmost` is never called for a non-intersecting entry, and never called at all for an empty
  intersecting set — the previous active value therefore survives (spec Edge Case 1).

---

## 3. `ScrollSpyState` — `scroll-spy.svelte.ts`

One instance per `<ScrollSpy.Root>`, published on the `Symbol('scroll-spy')` context. Owns the
active value, the configuration and the programmatic scroll. Reactive inputs arrive as **getter
functions** (`CLAUDE.md` §4).

### Constructor props (`ScrollSpyStateProps`)

| Prop                  | Type                                    | Source                                     |
| --------------------- | --------------------------------------- | ------------------------------------------- |
| `getValue`            | `() => string`                          | Root's `$bindable value` (seeded `?? ''`).  |
| `setValue`            | `(value: string) => void`               | Writes `value`, then `onValueChange?.(v)`.  |
| `getOffset`           | `() => number`                          | Root prop, default `0`.                     |
| `getScrollBehavior`   | `() => ScrollBehavior`                  | Root prop, default `getDefaultScrollBehavior()`. |
| `getScrollContainer`  | `() => HTMLElement \| null`             | Root prop, default `null`.                  |
| `getOrientation`      | `() => ScrollSpyOrientation`            | Root prop, default `'horizontal'`.          |
| `getDir`              | `() => Direction`                       | `useDirection({ dir, element })`.           |

### Members

| Member                        | Kind                               | Notes                                                                                                       |
| ----------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `value` (getter)              | derived read of `getValue()`       | The single active section id shared by every part (**FR-001**).                                              |
| `orientation` / `dir` (getters)| `$derived`                        | Published as `data-orientation` / `dir` by every part (**FR-009**, **FR-015**).                              |
| `sections`                    | `SectionRegistry`                  | Entity 1.                                                                                                     |
| `#isScrolling`                | plain `boolean`                    | Non-reactive (research R-04). Gate for observer updates (**FR-005**).                                        |
| `#settleTimeout`              | plain `number \| null`             | `window.setTimeout` id for the 500 ms window.                                                                 |
| `#lastAppliedValue`           | plain `string`                     | Distinguishes an external `value` change from the component's own write (research R-06).                     |
| `setValue(next)`              | method                             | `Object.is` guard; writes through; fires `onValueChange` only for truthy `next` (upstream lines 138-148).     |
| `isActive(id)`                | method → `boolean`                 | `this.value === id`; drives `data-state`.                                                                     |
| `scrollToSection(id)`         | method                             | Entity behaviour below.                                                                                       |
| `onObserverTopmost(element)`  | method                             | Ignored while `#isScrolling`; ignored unless `element.id` is truthy **and** registered; else `setValue(id)`.  |
| `syncExternalValue()`         | method                             | Called from the root's `$effect`; scrolls when `value !== #lastAppliedValue` after the first run.             |
| `dispose()`                   | method                             | Clears `#settleTimeout`. Called from the root's `$effect` teardown (**FR-018**).                              |

### `scrollToSection(id)` — state transition detail

```text
target = scrollContainer ? scrollContainer.querySelector('#'+id) : document.getElementById(id)
if (!target)  → setValue(id); return                       # FR-004 edge case: value still recorded
#isScrolling = true                                        # FR-005 window opens
setValue(id)                                               # immediate activation, no wait for scroll
if (scrollContainer)
    top = targetRect.top - containerRect.top + readScrollMetrics(container).scrollTop - offset
    scrollContainer.scrollTo({ top, behavior })
else
    top = targetRect.top + window.scrollY - offset
    window.scrollTo({ top, behavior })
clearTimeout(#settleTimeout); #settleTimeout = setTimeout(() => #isScrolling = false, 500)
```

Rapid repeated clicks: each call clears the previous timeout, so only the most recent click's window
governs — spec Edge Case "Rapid repeated clicks". `id` is used inside a CSS selector for the
container branch exactly as upstream does; ids with CSS-special characters are upstream's documented
"undefined" territory and are not guarded (spec Edge Case 3).

---

## 4. Context

| Item                       | Value                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| Key                        | `const SCROLL_SPY_CONTEXT_KEY = Symbol('scroll-spy')`                                     |
| `setScrollSpyContext(s)`   | Called once by the root during initialisation; returns the state.                         |
| `getScrollSpyContext(part)`| Throws `` `<ScrollSpy.${part}>` must be used within `<ScrollSpy.Root>`.`` when absent (**FR-014**). |

Consumers: `Nav` (`'Nav'`), `Link` (`'Link'`), `Viewport` (`'Viewport'`), `Section` (`'Section'`).

---

## 5. Per-part local state

| Part       | Local state                                    | Purpose                                                                                              |
| ---------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Root       | `ref`, `rootElement` (for direction fallback)  | `bind:this`; the `useDirection` DOM-fallback anchor.                                                  |
| Link       | `isActive = $derived(state.isActive(value))`   | `data-state`. No local mutable state.                                                                 |
| Section    | `ref`                                          | Registered with `state.sections` in an `$effect` keyed on `(ref, value)`; teardown unregisters.        |
| Nav/Viewport | `ref`                                        | Layout only.                                                                                          |

---

## 6. Entity ↔ spec mapping

| Spec entity        | Implementation                                                          |
| ------------------ | ----------------------------------------------------------------------- |
| Scroll Spy (root)  | `ScrollSpyState` + `scroll-spy.svelte`                                  |
| Scroll Spy Nav     | `scroll-spy-nav.svelte` (context read only)                             |
| Scroll Spy Link    | `scroll-spy-link.svelte` + `ScrollSpyState.isActive` / `scrollToSection`|
| Scroll Spy Viewport| `scroll-spy-viewport.svelte` (context read only)                        |
| Scroll Spy Section | `scroll-spy-section.svelte` + `SectionRegistry`                         |
