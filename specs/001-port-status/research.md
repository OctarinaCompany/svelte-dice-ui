# Phase 0 Research: Port Status Component

**Feature**: `001-port-status` | **Date**: 2026-07-29

The Technical Context in [plan.md](./plan.md) contains **zero** `NEEDS CLARIFICATION` markers. This
document records the decisions that removed the ambiguity, each with its rationale and the
alternatives that were rejected.

## Sources read (pinned commit `d9763d82530416dfa4c81c462387b55d06bae4ec`)

| File                                                                                                           | Why                                                         |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `.reference/diceui/docs/registry/bases/radix/ui/status.tsx`                                                    | canonical implementation (`asChild` variant)                |
| `.reference/diceui/docs/registry/bases/base/ui/status.tsx`                                                     | confirms the two bases differ only in the slot escape hatch |
| `.reference/diceui/docs/content/docs/components/radix/status.mdx`                                              | API contract, data-attribute table, accessibility notes     |
| `.reference/diceui/docs/types/radix/status.ts`                                                                 | the JSDoc to copy onto the Svelte props                     |
| `.reference/diceui/docs/registry/bases/radix/examples/status-demo.tsx` + `-variants-`, `-text-only-`, `-list-` | one demo section each                                       |
| `src/lib/components/ui/badge/{badge.svelte,index.ts}`                                                          | repo precedent for `tv()` in a module script                |
| `src/lib/components/ui/alert/{alert.svelte,index.ts}`                                                          | repo precedent for a multi-part barrel                      |
| `src/lib/components/ui/dialog/dialog-content.svelte`                                                           | repo precedent for the `child` snippet                      |
| `src/lib/{utils.ts,registry.ts}`, `src/app.css`, `tests/setup.ts`, `vite.config.ts`, `eslint.config.js`        | project constraints                                         |
| `.agents/skills/shadcn-svelte/rules/{styling,composition,forms,icons}.md`                                      | binding style rules                                         |

**No upstream test file exists** for `status` (searched `.reference/diceui` for `*status*`: only
source, MDX, types, demos and generated registry JSON). The assertion floor from Principle III is
therefore set by the MDX contract and this project's own test conventions, not by an upstream suite.

---

## Decision 1 — `asChild` becomes a `child` snippet

**Decision**: Replace upstream's `asChild?: boolean` (Radix `Slot`) with
`child?: Snippet<[{ props: StatusChildProps }]>` on the root only. When present, the snippet renders
in place of the default `<div>` and receives the fully merged attribute object.

**Rationale**: Svelte has no runtime prop-merging primitive equivalent to Radix `Slot` — there is no
way to inspect and clone "the single child element". `CLAUDE.md` §10 already mandates the `child`
snippet as the translation for `asChild`/`Slot`, and `dialog-content.svelte` shows the exact shape
already in the repo. Naming it `child` (not `asChild`) matches bits-ui, so a developer who uses any
other component in this project sees the same spelling.

**Alternatives considered**:

- `<svelte:element this={as}>` with an `as` prop (the `badge.svelte` approach). Rejected: it can
  render an arbitrary _tag_ but cannot accept a caller-supplied _element with its own props and
  children_, so `<Status child>` onto `<Button variant="ghost">` would be impossible — and upstream's
  documented use case is exactly "render as a link or button".
- Importing a slot primitive from `bits-ui`. Rejected: bits-ui exposes the `child` pattern only
  through stateful primitives; there is no standalone slot component to compose, so this would add a
  runtime dependency purely for a type alias.
- Keeping a boolean `asChild` and reading `children` reflectively. Rejected: `React.Children`
  inspection has no Svelte equivalent (`CLAUDE.md` §10, last row).

**Consequences documented in the API**: in `child` mode `children` is not rendered and `ref` is not
populated, because the caller owns the element. Both are JSDoc'd and asserted.

## Decision 2 — `cva` becomes `tv()` in the root's module script

**Decision**: Translate upstream's `cva(...)` table into `tv(...)` declared in
`<script lang="ts" module>` of `status.svelte`, exported as `statusVariants`, with
`export type StatusVariant = VariantProps<typeof statusVariants>['variant']` — but declared as an
explicit union so it is not `undefined`-widened (see Decision 6).

**Rationale**: Constitution VIII mandates `tv()` from `tailwind-variants` for multi-variant
components, and `badge.svelte`/`alert.svelte` already place it in the module script and export it.
Upstream also exports `statusVariants`, so the export name is upstream parity, not invention.

**Alternatives considered**: a separate `status-variants.ts`. Rejected: it adds a registry file and
an import hop for a table that exactly one component uses, and it breaks the established
`badge.svelte` precedent that later ports will copy.

## Decision 3 — no `status.svelte.ts`, no context module

**Decision**: Ship only `status.svelte`, `status-indicator.svelte`, `status-label.svelte`,
`index.ts`.

**Rationale**: `CLAUDE.md` §4/§5 require a `.svelte.ts` state class and a Symbol-keyed context _when
there is reactive logic or shared state_. Status has neither: it holds no value, has no keyboard
state machine, and its parts never talk to each other — the root colours the indicator through a
pure CSS descendant selector (`**:data-[slot=status-indicator]:bg-…`), exactly as upstream does. An
empty runes module and a context that carries nothing would be dead weight copied into every
consumer's project.

**Alternatives considered**: putting the variant into context so `status-indicator.svelte` could
compute its own colour. Rejected: it diverges from upstream's CSS-only mechanism, would break
`data-slot`-based restyling from the outside, and would make the indicator throw when used
standalone — behaviour upstream does not have.

**Recorded as a convention**: this is the project's reference _variant-only_ port; stateful compound
components still follow the §4/§5 pattern.

## Decision 4 — colour variants map to semantic tokens, `dark:` pairs dropped

**Decision**: Translate every palette utility to this project's tokens and delete upstream's
`dark:` companions.

| Upstream (radix + base, identical)                                                                               | Ported                                                                                    |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `border-transparent bg-muted text-muted-foreground **:data-[slot=status-indicator]:bg-muted-foreground`          | unchanged                                                                                 |
| `border-green-500/20 bg-green-500/10 text-green-600 …:bg-green-600 dark:text-green-400 …dark:bg-green-400`       | `border-success/20 bg-success/10 text-success **:data-[slot=status-indicator]:bg-success` |
| `border-destructive/20 bg-destructive/10 text-destructive **:data-[slot=status-indicator]:bg-destructive`        | unchanged                                                                                 |
| `border-orange-500/20 bg-orange-500/10 text-orange-600 …:bg-orange-600 dark:text-orange-400 …dark:bg-orange-400` | `border-warning/20 bg-warning/10 text-warning **:data-[slot=status-indicator]:bg-warning` |
| `border-blue-500/20 bg-blue-500/10 text-blue-600 …:bg-blue-600 dark:text-blue-400 …dark:bg-blue-400`             | `border-info/20 bg-info/10 text-info **:data-[slot=status-indicator]:bg-info`             |

**Rationale**: Constitution VIII forbids raw palette colours and manual `dark:` overrides;
`CLAUDE.md` §6 defines this exact mapping table. Upstream needs the `dark:` pairs only because it
uses fixed palette steps; `--success`/`--warning`/`--info` already carry distinct `:root` and `.dark`
values in `src/app.css` and are exposed via `@theme inline`, so the light/dark shift happens in the
token. Dropping the `dark:` classes preserves the _behaviour_ while satisfying the styling rule —
this is a translation, not a loss of parity.

**Verified**: all six tokens (`--success`, `--success-foreground`, `--warning`,
`--warning-foreground`, `--info`, `--info-foreground`) exist in both `:root` and `.dark` in
`src/app.css`, so **no theme change is needed and none will be made**.

**Alternatives considered**: keeping `green-500` etc. for pixel parity. Rejected outright by
Principle VIII and by the shadcn-svelte styling rule "No raw color values for status/state
indicators".

## Decision 5 — the ping stays CSS-only

**Decision**: Port the indicator's classes verbatim:
`relative flex size-2 shrink-0 rounded-full` +
`before:absolute before:inset-0 before:animate-ping before:rounded-full before:bg-inherit` +
`after:absolute after:inset-[2px] after:rounded-full after:bg-inherit`.

**Rationale**: `animate-ping` is a core Tailwind v4 utility, and `bg-inherit` on both pseudo-elements
is what makes the dot inherit the variant colour the root sets on the indicator — that is the
mechanism behind FR-003. No JavaScript, no timer, no observer, therefore nothing for `$effect` to
tear down and nothing that can leak. The MDX explicitly notes the animation "runs continuously".

**`prefers-reduced-motion`**: not added. Upstream adds none, spec Assumptions say the port does not
add one, and inventing it would be undocumented drift (Principle II). Consumers can override through
`data-slot="status-indicator"`.

## Decision 6 — unknown `variant` values fall back to `default`

**Decision**: Export `STATUS_VARIANTS` (a readonly tuple) and
`resolveStatusVariant(value?: string): StatusVariant`. The root computes
`const resolved = $derived(resolveStatusVariant(variant))` and uses it for **both** `tv()` and
`data-variant`.

**Rationale**: The spec's Edge Cases require a fallback to the neutral treatment for values arriving
from untyped data. `tv()`/`cva` alone do not do this — an unrecognised key yields base classes only,
so the badge would render half-styled with a bogus `data-variant`. Nine lines of normalisation make
FR-002 ("defaulting to `default` when no variant is specified") true at runtime as well as in the
type system, and give the test suite something concrete to assert.

**Parity note**: this is a deliberate, spec-sanctioned divergence — upstream would render
`data-variant="bogus"` with base classes only. It is additive (typed callers see no difference) and
is already recorded in the spec's Edge Cases.

**Alternatives considered**: widening the prop to `string`. Rejected — it would delete the type
safety that is the point of the union, and `AutoTypeTable` upstream documents a closed union.

## Decision 7 — long-label behaviour

**Decision**: Keep upstream's `overflow-hidden whitespace-nowrap` and `w-fit` on the root, verbatim.
The badge sizes to its content and does not stretch; a very long label produces a wide badge whose
overflow is clipped, not wrapped.

**Rationale**: The spec's Edge Case originally described the text _wrapping to the next line_, which
directly contradicts `whitespace-nowrap`. Principle II is non-negotiable and the constitution
supersedes all other guidance (Governance), so upstream's classes win. Leaving the contradiction in
place would have produced a guaranteed `/speckit-analyze` finding, so the edge-case bullet in
`spec.md` has been corrected to describe the real, ported behaviour and an Assumptions entry records
the correction. **The one-line reason: the original wording described behaviour that upstream's own
base classes make impossible.**

**Alternatives considered**: adding `whitespace-normal`/`text-wrap` to satisfy the original wording.
Rejected: undocumented drift from the pinned upstream, and it would change the badge's shape in
every existing Dice UI layout.

## Decision 8 — no new dependency, and no shared module

**Decision**: Zero npm additions. Zero shared modules exported for later components.

**Rationale**: `tailwind-variants`, `clsx`, `tailwind-merge` and `svelte` already cover everything;
`bits-ui` would be a runtime dependency bought for a type alias. On sharing: a `registry:ui` item is
copied verbatim into a consumer's project, so a cross-component import must itself be an installable
registry item. The only candidate — a three-line `{ props: Record<string, unknown> }` type — does not
justify a `registry:lib` entry, and `$lib/utils.ts` cannot carry it because consumers install
shadcn-svelte's own `utils.ts`. The reusable artifact is the documented pattern; components that
already depend on `bits-ui` reuse its exported `WithChild` type instead.

**Verified**: `node_modules/bits-ui/dist/shared/index.d.ts:34` re-exports `WithChild`, `Without` and
`WithChildren`, so that fallback is real.

## Decision 9 — testing `bind:ref` and `child` needs a harness component

**Decision**: Add `src/lib/components/ui/status/status.test.svelte`, a single prop-driven harness,
alongside `status.test.ts`.

**Rationale**: `@testing-library/svelte`'s `render()` cannot express `bind:ref`, and a `child`
snippet that must spread `props` onto a real element cannot be expressed with `createRawSnippet`
(whose `render` returns a raw HTML string, with no place to apply the passed props). A tiny `.svelte`
harness is the honest way to exercise both without weakening the assertions. Vitest's `include` is
`src/**/*.{test,spec}.{js,ts}`, so a `.svelte` file is never collected as a suite — it is only
imported. It is excluded from `registry.json` for the same reason the test file is.

**Alternatives considered**: skipping the `ref` and `child` assertions. Rejected — `child` is user
story P3 and `ref` is the `forwardRef` translation; both must be proven.

## Decision 10 — accessibility posture

**Decision**: No `role`, no `aria-*` added by the component. Accessibility is asserted through: the
label text being the readable content, `getByRole('link' | 'button', { name })` working in `child`
mode, focus never being suppressed, and every variant remaining distinguishable by text alone.

**Rationale**: The MDX's Accessibility section says only "uses `div` elements with proper ARIA
attributes when needed", "colour is not the only means of conveying information", and "supports
keyboard navigation when used with interactive elements via `asChild`". `role="status"` is an ARIA
live region — an event-driven announcement pattern that upstream deliberately does not implement
here; adding it would announce every badge on a dashboard on mount. Spec Assumptions already record
this as out of scope.

**RTL**: no work needed and none invented. The root is `inline-flex … gap-1.5` with zero physical
direction utilities (`ml-*`, `mr-*`, `left-*`, `right-*`), so visual order follows the ambient
`dir` for free. The test asserts this property directly rather than asserting a computed layout that
jsdom cannot produce.
