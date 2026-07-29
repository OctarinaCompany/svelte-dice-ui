# Phase 1 Data Model: Port Direction Provider

**Feature**: `002-port-direction-provider` | **Date**: 2026-07-29

Direction Provider carries exactly one datum — a two-valued enum — but it is the *resolution* of that
datum that is the feature. The entities below are the compile-time types, the reactive holders, and
the precedence rule that connects them.

---

## Entity 1 — `Direction` (closed union)

The only value the component carries. Mirrors `.reference/diceui/packages/shared/src/types.ts`.

```ts
export const DIRECTIONS = ['ltr', 'rtl'] as const;
export type Direction = (typeof DIRECTIONS)[number];
```

| Value   | Meaning                                | Source                            |
| ------- | -------------------------------------- | --------------------------------- |
| `'ltr'` | Left-to-right text and layout flow     | default (FR-002, FR-007)          |
| `'rtl'` | Right-to-left text and layout flow     | provider prop or DOM `dir`        |

Lifetime: none. It is never persisted, never serialised, and exists only for the lifetime of the
component tree that declares or reads it (spec, Key Entities).

**Validation rule (spec Edge Cases)**: values arriving from untyped sources — a DOM `dir` attribute is
the only such source — are narrowed by a guard, and anything outside the union (`"auto"`, `""`, a
typo) is treated exactly as if the attribute were absent:

```ts
export function isDirection(value: unknown): value is Direction {
	return value === 'ltr' || value === 'rtl';
}
```

At the type level the provider's `dir` prop is the union itself, so an invalid value is a compile
error rather than a runtime concern (spec Edge Cases, final bullet).

---

## Entity 2 — `DirectionProviderState` (the provider's reactive holder)

One instance per `<DirectionProvider>`. Constructed by the root and published on context; it is what
descendants read.

```ts
type DirectionProviderStateProps = {
	getDir: () => Direction;
};

export class DirectionProviderState {
	#props: DirectionProviderStateProps;
	readonly current: Direction = $derived(this.#props.getDir());

	constructor(props: DirectionProviderStateProps) {
		this.#props = props;
	}
}
```

| Field     | Kind       | Meaning                                                             |
| --------- | ---------- | ------------------------------------------------------------------- |
| `current` | `$derived` | The provider's resolved direction, live when the root's `dir` prop changes (FR-009, SC-003). |

The input is a **getter**, per CLAUDE.md §4 — a value captured in the constructor would freeze on the
direction present at mount and break the runtime language-switcher scenario.

**State transitions**: the only transition is `'ltr' ⇄ 'rtl'`, driven exclusively by the parent
reassigning the `dir` prop. The class never writes `current`; there is no internal transition.

---

## Entity 3 — Direction context (the nesting relationship)

```ts
const DIRECTION_CONTEXT_KEY = Symbol('direction-provider');

export function setDirectionContext(state: DirectionProviderState): DirectionProviderState;
export function hasDirectionContext(): boolean;
export function getDirectionContext(): DirectionProviderState; // throws when absent
```

| Accessor                 | Behaviour when no provider is above                                                    | Used by                                      |
| ------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------- |
| `hasDirectionContext()`  | returns `false`                                                                        | `useDirection` (FR-005: must not throw)       |
| `getDirectionContext()`  | throws `` `<Part>` must be used within `<DirectionProvider>`. ``                       | later ports whose parts require a provider    |

**Relationship — nearest provider wins (FR-003)**: Svelte's `setContext` shadows an outer value for
the whole subtree of the component that calls it, so nesting resolves to the innermost provider with
no bookkeeping. Both providers' `DirectionProviderState` instances stay alive and independent; a
descendant of the outer provider that is a *sibling* of the inner one still reads the outer value.

```
DirectionProvider dir="rtl"      → state A (current = 'rtl')
├── Consumer                      → reads A  → 'rtl'
└── DirectionProvider dir="ltr"   → state B (current = 'ltr'), shadows A
    └── Consumer                  → reads B  → 'ltr'
```

---

## Entity 4 — `DirectionReader` (the resolution rule)

One instance per `useDirection()` call. Holds no authored state of its own except the cached DOM
observation; everything else is resolution.

```ts
export class DirectionReader {
	#getDirProp: () => Direction | undefined;
	#getElement: () => HTMLElement | null | undefined;
	#context: DirectionProviderState | undefined; // captured once, at init
	#domDir = $state<Direction | undefined>(undefined);

	readonly current: Direction = $derived(
		this.#getDirProp() ?? this.#context?.current ?? this.#domDir ?? 'ltr'
	);
}
```

### The precedence chain

| # | Source                        | Requirement    | Wins over                     |
| - | ----------------------------- | -------------- | ----------------------------- |
| 1 | explicit `options.dir()`       | FR-008, US3    | everything                    |
| 2 | nearest provider (`context`)   | FR-001, FR-003 | DOM attribute and the default |
| 3 | nearest recognised DOM `dir`   | FR-006         | the default                   |
| 4 | `'ltr'`                        | FR-002, FR-007 | —                             |

Steps 1–2 and 4 are upstream's chain verbatim (`dirProp ?? contextDir ?? "ltr"`); step 3 is this
port's documented strengthening (spec Assumption 2). Coalescing is `??`, never `||`, so the
distinction between "absent" and "present" is preserved exactly as upstream.

### The DOM observation (step 3's data source)

`#domDir` is the one piece of authored reactive state in the feature. It is written **only** by the
effect below and read **only** by `current`.

| Aspect      | Detail                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| Anchor      | `this.#getElement() ?? document.documentElement`                                                       |
| Lookup      | `anchor.closest('[dir="ltr"], [dir="rtl"]')?.getAttribute('dir')`, narrowed by `isDirection`            |
| Reactivity  | `MutationObserver` on `document.documentElement`, `{ attributes: true, attributeFilter: ['dir'], subtree: true }` |
| Teardown    | the `$effect` returns `() => observer.disconnect()`                                                    |
| SSR         | `$effect` does not run on the server ⇒ `#domDir` stays `undefined` ⇒ chain falls through to step 4     |
| Loop safety | the effect reads `#getElement()` and the DOM; it never reads `#domDir`, so no self-trigger              |

Selecting `[dir="ltr"], [dir="rtl"]` rather than `[dir]` is what implements the `dir="auto"` edge
case: an unrecognised value does not match, so the walk continues to the next ancestor and, finding
none, yields `undefined`.

**State transitions of `#domDir`**: `undefined → 'ltr' | 'rtl'` on the effect's first run, then any
value → any value whenever a `dir` attribute anywhere in the document changes. Reset to nothing on
teardown (the instance is discarded with its component).

---

## Entity 5 — `DirectionProviderProps` (the rendered contract)

```ts
export type DirectionProviderProps = WithElementRef<
	Omit<HTMLAttributes<HTMLDivElement>, 'dir'>,
	HTMLDivElement
> & {
	/**
	 * The direction of the text.
	 * @default "ltr"
	 */
	dir?: Direction;
};
```

`dir` is omitted from the base before being re-declared so `svelte/elements`' loose
`dir?: string | null` cannot widen the union (research Decision 9). `children` and `class` arrive
through `HTMLAttributes` / `WithElementRef` as they do for every other component in the repo.

### Rendered attribute payload

| Attribute                        | Value                        | Why                                                              |
| -------------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| `data-slot="direction-provider"` | constant                     | Principle VIII — every part carries its slot                     |
| `data-dir`                       | `'ltr'` \| `'rtl'`           | Principle VIII — the component's only state, exposed for styling |
| `dir`                            | `'ltr'` \| `'rtl'`           | native bidi inheritance + the FR-006 fallback's lookup target    |
| `class`                          | `cn('contents', className)`  | layout-transparent by default, caller overrides last             |
| `...restProps`                   | forwarded verbatim           | FR-010                                                           |

`data-dir` is a value attribute, not a boolean, so the `cond ? '' : undefined` rule does not apply —
it is always present and always one of the two literals.

---

## Entity relationship summary

```
DirectionProviderProps.dir ──getter──▶ DirectionProviderState.current
                                              │ setContext(Symbol)
                                              ▼
                       hasDirectionContext() / getDirectionContext()
                                              │
UseDirectionOptions.dir ──┐                   │            document DOM `dir`
                          ▼                   ▼                     │
                    DirectionReader.current  ◀─────────────────┐    │
                    = dir() ?? ctx.current ?? domDir ?? 'ltr'  └─ MutationObserver
```
