# Contract: Direction Provider public API

**Feature**: `002-port-direction-provider` | **Date**: 2026-07-29

The exported surface of `src/lib/components/ui/direction-provider/index.ts`. Derived from
`.reference/diceui/docs/registry/bases/radix/ui/direction.tsx`,
`.reference/diceui/packages/shared/src/hooks/use-direction.ts` and
`.reference/diceui/docs/types/radix/utilities.ts` at pin `d9763d82530416dfa4c81c462387b55d06bae4ec`.
This file is the assertion target for `direction-provider.test.ts` and the source of the demo page's
props tables.

---

## 1. Barrel

```ts
// src/lib/components/ui/direction-provider/index.ts
import Root from './direction-provider.svelte';

export type { DirectionProviderProps } from './direction-provider.svelte';

export {
	DIRECTIONS,
	DirectionProviderState,
	DirectionReader,
	getDirectionContext,
	hasDirectionContext,
	isDirection,
	resolveDomDirection,
	setDirectionContext,
	useDirection,
	type Direction,
	type UseDirectionOptions
} from './direction-provider.svelte.js';

export {
	Root,
	//
	Root as DirectionProvider
};
```

Both import styles must work:

```ts
import * as DirectionProvider from '$lib/components/ui/direction-provider/index.js'; // .Root, .useDirection
import { DirectionProvider, useDirection } from '$lib/components/ui/direction-provider/index.js';
```

Upstream exports exactly `{ DirectionProvider, useDirection }`; both names are preserved verbatim.
`Root` is the repo's namespace-friendly alias (Principle V), and the remaining exports are the shared
module later ports consume.

---

## 2. `DirectionProvider` — props

| Prop           | Type                                          | Default | Bindable | Description                                                                                                              |
| -------------- | --------------------------------------------- | ------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `dir`          | `Direction`                                   | `'ltr'` | no       | Upstream JSDoc verbatim: _"The direction of the text. `@default "ltr"`"_. Made optional so the documented default is reachable. |
| `ref`          | `HTMLDivElement \| null`                      | `null`  | **yes**  | `bind:this` on the wrapper element.                                                                                      |
| `class`        | `ClassValue`                                  | —       | no       | Merged last: `cn('contents', className)`.                                                                                |
| `children`     | `Snippet`                                     | —       | no       | Rendered with `{@render children?.()}`.                                                                                  |
| `...restProps` | `Omit<HTMLAttributes<HTMLDivElement>, 'dir'>` | —       | —        | Spread verbatim onto the wrapper (FR-010).                                                                               |

**Snippets**: `children` only. **Callbacks / events**: none — upstream defines none.
**Not present**: `direction` (upstream's legacy alias — spec Assumptions), `asChild` / `child`
(upstream has no `Slot` here — research Decision 4), `defaultDir` / `onDirChange` (nothing mutates
`dir` — research Decision 6).

### Rendered DOM

```html
<div data-slot="direction-provider" data-dir="rtl" dir="rtl" class="contents">…children…</div>
```

| Attribute   | Part                | Values           |
| ----------- | ------------------- | ---------------- |
| `data-slot` | `direction-provider` | `direction-provider` |
| `data-dir`  | `direction-provider` | `ltr` \| `rtl`   |
| `dir`       | `direction-provider` | `ltr` \| `rtl`   |

The element carries **no** `role` and **no** accessible name, and `display: contents` keeps it out of
the box tree so it cannot disturb a flex or grid parent.

---

## 3. `useDirection(options?)`

```ts
export type UseDirectionOptions = {
	/**
	 * Explicit direction override. When the getter returns a value it takes precedence over the
	 * nearest provider and over the DOM fallback.
	 */
	dir?: () => Direction | undefined;
	/**
	 * Element the DOM fallback walks up from when no provider is present.
	 * @default document.documentElement
	 */
	element?: () => HTMLElement | null | undefined;
};

export function useDirection(options?: UseDirectionOptions): DirectionReader;
```

| Aspect          | Contract                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| Call site       | during component initialisation only (reads context, opens an `$effect`)                                    |
| Throws          | never, when no provider is present (FR-005)                                                                 |
| Returns         | `DirectionReader` — `readonly current: Direction`                                                           |
| Resolution      | `options?.dir?.() ?? nearestProvider?.current ?? domDir ?? 'ltr'`                                            |
| Reactivity      | `current` re-resolves when the override getter, the provider's `dir`, or a document `dir` attribute changes  |
| SSR             | DOM step is inert (no `$effect` on the server); resolves `override ?? provider ?? 'ltr'`                     |

Upstream signature is `useDirection(dirProp?: Direction)`. The options bag with getter-valued fields
is the mechanical Svelte translation (research Decisions 2 and 3); recorded in spec Assumptions.

### `DirectionReader`

| Member    | Type        | Notes                                            |
| --------- | ----------- | ------------------------------------------------ |
| `current` | `Direction` | `$derived`; always one of `'ltr'` / `'rtl'`      |

---

## 4. Context accessors

| Export                                  | Signature                                                  | Behaviour without a provider                                    |
| --------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- |
| `setDirectionContext`                   | `(state: DirectionProviderState) => DirectionProviderState` | n/a — called by the root                                        |
| `hasDirectionContext`                   | `() => boolean`                                            | returns `false`                                                 |
| `getDirectionContext`                   | `() => DirectionProviderState`                             | throws `` `<Part>` must be used within `<DirectionProvider>`. `` |

The key is `Symbol('direction-provider')`, module-private.

---

## 5. Types and helpers

| Export                   | Signature / value                                                | Purpose                                                        |
| ------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| `Direction`              | `'ltr' \| 'rtl'`                                                  | mirrors `@diceui/shared`'s `Direction`                         |
| `DIRECTIONS`             | `['ltr', 'rtl'] as const`                                         | runtime form of the union                                      |
| `isDirection`            | `(value: unknown) => value is Direction`                          | narrows untyped DOM values; `'auto'` ⇒ `false`                 |
| `resolveDomDirection`    | `(anchor: Element \| null \| undefined) => Direction \| undefined` | `anchor.closest('[dir="ltr"], [dir="rtl"]')`, narrowed         |
| `DirectionProviderState` | class, `readonly current: Direction`                              | the provider's reactive holder                                 |
| `DirectionReader`        | class, `readonly current: Direction`                              | the reader instance type                                       |
| `UseDirectionOptions`    | type, above                                                       | reader options                                                 |
| `DirectionProviderProps` | type, §2                                                          | root props                                                     |

---

## 6. Behavioural contract (the assertions `direction-provider.test.ts` must make)

| #    | Requirement                | Assertion                                                                                                       |
| ---- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| C-01 | FR-001, US1-1              | provider `dir="ltr"` ⇒ descendant reader reports `ltr`                                                          |
| C-02 | FR-001, US1-2              | provider `dir="rtl"` ⇒ descendant reader reports `rtl`                                                          |
| C-03 | FR-002                     | provider with no `dir` ⇒ descendant reports `ltr`, and `data-dir`/`dir` are `ltr`                               |
| C-04 | FR-003, US1-3              | nested providers ⇒ inner descendant reports the inner value, outer sibling still reports the outer value        |
| C-05 | FR-005, US2-1              | reader with no provider and no ancestor `dir` ⇒ `ltr`, and rendering does **not** throw                         |
| C-06 | FR-006, US2-2              | reader with no provider under a `dir="rtl"` ancestor ⇒ `rtl`                                                    |
| C-07 | FR-006, Edge case          | ancestor `dir="auto"` ⇒ treated as absent ⇒ `ltr`; `isDirection('auto') === false`                              |
| C-08 | FR-008, US2-3, US3-1       | explicit override wins over both the DOM attribute and a provider set to the opposite value                     |
| C-09 | FR-009, SC-003 (provider)  | flipping the provider's `dir` at runtime updates every consumer without remount                                 |
| C-10 | FR-009 (DOM)               | mutating an ancestor's `dir` attribute at runtime updates a provider-less consumer                              |
| C-11 | FR-009 (override)          | changing the override getter's value at runtime updates the consumer                                            |
| C-12 | FR-010                     | `id`, `aria-label` and an arbitrary `data-*` passed to the provider appear on the rendered wrapper              |
| C-13 | FR-010, Principle VIII     | `data-slot="direction-provider"`, `data-dir`, `dir` and the `contents` class are present; caller `class` merges last |
| C-14 | Principle III              | the wrapper exposes no `role` and no accessible name; `children` render unchanged inside it                     |
| C-15 | Principle III / CLAUDE §5  | `getDirectionContext()` outside a provider throws `/must be used within/`; `hasDirectionContext()` returns `false` |
| C-16 | Principle V                | `ref` binds to the rendered `<div>`                                                                             |
| C-17 | "uncontrolled"             | no `dir` prop ⇒ component supplies `'ltr'` and consumers read it (research Decision 6)                          |
| C-18 | "controlled"               | parent owns `dir`; the component never changes it on its own across consumer interaction                        |
| C-19 | teardown                   | unmounting a reader disconnects its `MutationObserver` (spied constructor ⇒ `disconnect` called)                |
| C-20 | keyboard                   | the provider registers no key handlers: `userEvent.keyboard` over the documented key set leaves `data-dir`, the DOM and every consumer's reported value unchanged (the component is non-interactive — see research Decision 6 / plan Principle III) |

C-20 is how this port satisfies Principle III's keyboard clause: the widget has no keyboard model, and
the test proves the absence rather than asserting a map that does not exist. RTL coverage is not a
single case here — it is C-02, C-04, C-06, C-08, C-09 and C-10, because direction *is* the component.
