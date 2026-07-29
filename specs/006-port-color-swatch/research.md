# Phase 0 Research — Color Swatch

**Feature**: `006-port-color-swatch` | **Date**: 2026-07-29

All `NEEDS CLARIFICATION` items raised while filling the Technical Context are resolved below. Every
decision was taken from the pinned upstream source, this repo's already-ported components, the
constitution, or a directly executed probe — no open questions remain.

## Sources read

| File                                                                    | Why                                                      |
| ----------------------------------------------------------------------- | -------------------------------------------------------- |
| `.reference/diceui/docs/registry/bases/radix/ui/color-swatch.tsx`        | The implementation contract (121 lines, one component)   |
| `.reference/diceui/docs/content/docs/components/radix/color-swatch.mdx`  | The documented API, a11y contract, data-attribute table  |
| `.reference/diceui/docs/types/radix/color-swatch.ts`                     | The prop JSDoc incl. every `@default` and `@example`     |
| `.reference/diceui/docs/registry/bases/radix/examples/color-swatch-{,sizes-,transparency-}demo.tsx` | The three demo sections to reproduce |
| `.reference/diceui/docs/registry/bases/radix/ui/color-picker.tsx`        | To confirm what wave 3 will need to reuse                |
| `src/lib/components/ui/status/`, `swap/`, `stat/`                        | Established repo conventions (barrel, `tv()`, `child`)   |
| `CLAUDE.md`, `.specify/memory/constitution.md`, `.agents/skills/shadcn-svelte/rules/*.md` | Binding rules                          |

**Upstream test file: none exists.** Verified by searching the whole vendored tree for a test filename
containing `color` — no match, and `docs/registry/bases/radix/test/` contains only `editable`,
`mask-input`, `rating`, `scroll-spy`, `speed-dial` and `stepper`. Constitution III's "upstream test file is
the floor" therefore resolves to "the MDX's documented contract is the floor"; our tests are written from
the MDX + source directly.

---

## D-001 — State class or not?

**Decision**: No state class, no `color-swatch.svelte.ts`, no context. Derive everything with `$derived`
in the component and keep the pure logic in a non-reactive `color.ts`.

**Rationale**: The upstream component holds no `useState`, no `useRef`, no `useEffect` and no context — its
only hook is a `useMemo` over two props, and Constitution/translation rules say `useMemo` is not ported at
all. Introducing a class would create a reactive container around nothing and would violate the "translate,
do not transliterate" instruction. `status.svelte` and `stat-indicator.svelte` set the precedent in this
repo: variant-only components have no `.svelte.ts`.

**Alternatives considered**: A `ColorSwatchState` class taking getter functions — rejected, it would add a
constructor, five getters and an indirection for three `$derived` lines. A `.svelte.ts` holding only the
`tv()` object — rejected, the repo's convention (`status`, `stat`) is to export `tv()` from the component's
module script.

---

## D-002 — How to detect a valid CSS colour

**Decision**: Keep upstream's `CSS.supports('color', value)` behind the same guard —
`typeof CSS !== 'undefined' && typeof CSS.supports === 'function'` → call it; otherwise return `true`; any
throw → `false`.

**Rationale**: It is the platform's own parser, so it stays correct as CSS gains colour syntaxes, and it is
what the spec's Assumptions section already commits to. The "assume valid when the API is missing" fallback
is what makes SSR render the colour rather than a blank box; the browser then re-evaluates on hydration.
No colour-parsing dependency may be added (zero-new-dependency constraint).

**Probe (executed against this repo's jsdom)** — `CSS.supports` exists in jsdom and behaves correctly for
every documented format, so tests need no shim:

| Input                     | `CSS.supports('color', …)` |
| ------------------------- | -------------------------- |
| `blue`, `currentColor`    | `true`                     |
| `#3b82f6`, `  #3b82f6  `  | `true`                     |
| `#ff000080`, `#f00a`      | `true`                     |
| `rgba(1,2,3,0.5)`, `rgb(1 2 3 / 50%)` | `true`         |
| `hsl(217 91% 60% / 0.5)`  | `true`                     |
| `oklch(0.7 0.1 200 / 0.5)`, `lab(50% 40 59.5)`, `color(display-p3 1 0 0)` | `true` |
| `transparent`             | `true`                     |
| `not-a-color`, `""`       | `false`                    |

**Alternatives considered**: A hand-written regex validator — rejected, it would drift from the platform
and reject valid modern syntax. A `culori`/`colord` dependency — rejected, new dependency and a behaviour
change for `transparent` and slash-alpha forms.

---

## D-003 — The "no colour selected" gradient token

**Decision**: Port upstream's diagonal slash verbatim except for the colour reference: upstream's
`hsl(var(--destructive))` becomes `var(--destructive)`.

**Rationale**: Upstream targets a shadcn theme whose `--destructive` holds bare HSL channels. This repo is
Tailwind v4 / shadcn-svelte `nova`, where `src/app.css` defines `--destructive: oklch(0.577 0.245 27.325)`
(and `oklch(0.704 0.191 22.216)` in `.dark`) — a *complete* colour. Wrapping it in `hsl()` would produce an
invalid declaration and the slash would not render at all. Using the token directly keeps the theme flip
working and satisfies CLAUDE.md §6 / Constitution VIII (semantic tokens, no raw palette, no manual `dark:`).

**Alternatives considered**: `text-destructive` + `currentColor` in the gradient — rejected, it would let a
caller's `class` accidentally recolour the empty-state slash and it changes the cascade upstream relies on.

---

## D-004 — Merging the caller's `style` with the computed background

**Decision**: Destructure `style` out of `restProps` and emit
`"<background-declaration>; forced-color-adjust: none<; caller style>"` — computed first, caller last.

**Rationale**: React merges two `CSSProperties` objects with the caller's spread last, so the caller wins.
Svelte's `style` attribute is a string, and in CSS a later declaration of the same property wins, so
string concatenation with the caller appended last reproduces the exact same precedence. `style` must be
destructured explicitly, otherwise the `{...restProps}` spread and our own `style=` would collide and the
last one written would silently discard the other.

**Probe (jsdom)**: setting the composed string as a `style` attribute round-trips byte-for-byte through
`getAttribute('style')`, and `el.style.background` / `el.style.backgroundColor` parse correctly (colours
normalised to `rgb()` form). Tests therefore assert on `getAttribute('style')` for gradient strings (exact,
stable) and may use `el.style.backgroundColor` for the flat-colour case.

**Alternatives considered**: A `style` object prop — rejected, not a Svelte idiom and it would break
`restProps` typing. Emitting the background as an inline `class` via arbitrary-value Tailwind — rejected,
the value is dynamic and Tailwind v4 cannot generate classes for runtime strings.

---

## D-005 — Keyboard interaction and RTL scope

**Decision**: No keyboard handling, no `tabindex`, no focus management. RTL support means "assert nothing
mirrors and nothing breaks", tested by rendering inside `<DirectionProvider dir="rtl">` and asserting the
attributes and classes are byte-identical to the LTR render.

**Rationale**: `role="img"` is a static, non-interactive role; the WAI-ARIA Authoring Practices define no
keyboard pattern for it, and upstream attaches no handlers. Making the swatch focusable would be a parity
break *and* an a11y regression (a focusable element with no action). Interactivity is delegated to a
wrapping trigger through the `child` snippet, exactly as spec Assumption "`role="img"` vs interactive role"
states. The component has no directional content — the only geometry is a square — so the RTL requirement
in Constitution III reduces to "no physical-side utilities", which is verifiable statically and by an
equality assertion.

**Alternatives considered**: Adding `tabindex="0"` when a caller passes `onclick` — rejected, invented API,
not upstream, and it would produce an interactive element with role `img`.

---

## D-006 — Where the reusable colour module lives

**Decision**: `src/lib/components/ui/color-swatch/color.ts`, re-exported from the component barrel and
importable directly. Wave-3 `color-picker` declares `registryDependencies: ["color-swatch"]`.

**Rationale**: Confirmed need — upstream's `color-picker.tsx` (1678 lines) does **not** import
`ColorSwatch`; it re-declares its own `parseColorString` and repeats the checkerboard gradient inline (with
an 8px tile instead of the swatch's 10px). That duplication is exactly what FR-012/SC-005 exist to prevent,
so `getColorBackgroundStyle` takes a `checkerboardSize` option (default `'10px'`) and wave 3 passes `'8px'`.
Constitution V forbids shipping a file that no registry item lists, which rules out a bare `src/lib/`
module; the component folder is the only location where the file is both owned and installable.

**Alternatives considered**: `src/lib/utils/color.ts` with its own `registry:lib` item — rejected, it would
create a second registry item for a non-component and break the "one folder per component" rule.
Duplicating the helpers in `color-picker` later — rejected, that is the defect SC-005 forbids.

---

## D-007 — `asChild` → `child`, and the missing `children`

**Decision**: `child?: Snippet<[{ props: ColorSwatchChildProps }]>` following `status.svelte` /
`swap.svelte` verbatim: build one `$derived` attribute object, render it either through the snippet or onto
the default `<div>`. The props type uses `WithoutChildren<…>` so `children` is not accepted at all.

**Rationale**: Upstream types the component as `Omit<React.ComponentProps<'div'>, 'children'>` — a swatch
has no content, only a background. Reproducing that omission is Principle II parity, and it removes the
`{@render children?.()}` branch entirely. Sharing one attribute object between the two branches guarantees
a `child` element is styled exactly like the default one, which is the invariant the existing ported
components already document in comments.

**Alternatives considered**: Accepting `children` anyway "for convenience" — rejected, undocumented drift.

---

## D-008 — Data attributes beyond upstream's two

**Decision**: Emit upstream's `data-slot="color-swatch"` and `data-disabled`, plus `data-size`,
`data-transparent` and `data-empty`.

**Rationale**: Constitution VIII: "every piece of component state MUST be exposed as a `data-*` attribute".
The size variant, whether the checkerboard is being rendered, and whether the swatch is in its "no colour"
state are precisely the component's state, and consumers cannot target them otherwise (the background lives
in an inline style, which no selector can match on). These are additive — every upstream attribute is still
present with its upstream value — so Principle II parity holds; the addition is recorded in the spec's
Assumptions section. Booleans are written `cond ? '' : undefined` so they are absent when false.

**Alternatives considered**: Upstream's two attributes only — rejected, it violates Principle VIII and
makes `withoutTransparency` and `size` unstylable from the outside.
