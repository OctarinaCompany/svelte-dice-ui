# Phase 0 Research: Stat

**Feature**: `004-port-stat` | **Date**: 2026-07-29

Every Technical Context field was resolvable from the repository and the pinned upstream copy; no
`NEEDS CLARIFICATION` marker survives into `plan.md`. The open items were design decisions, not
unknowns, and each is resolved below.

Sources read at pin `d9763d82530416dfa4c81c462387b55d06bae4ec`:
`docs/registry/bases/radix/ui/stat.tsx`, `docs/registry/bases/base/ui/stat.tsx` (diffed —
one line differs), `docs/types/radix/stat.ts`,
`docs/content/docs/components/radix/stat.mdx`, and all three
`docs/registry/bases/radix/examples/stat-{demo,variants-demo,layout-demo}.tsx`.

Repository references read: `src/lib/components/ui/status/*` (closest precedent — variant-only,
`tv()` in a module script, `.test.svelte` harness), `src/lib/components/ui/separator/separator.svelte`,
`src/lib/components/ui/dropdown-menu/{index.ts,dropdown-menu-trigger.svelte}`,
`src/lib/components/docs/component-preview.svelte`, `src/lib/registry.ts`, `src/lib/utils.ts`,
`src/app.css`, `registry.json`, `components.json`, `vite.config.ts`, `CLAUDE.md`,
`.specify/memory/constitution.md`, and
`.agents/skills/shadcn-svelte/rules/{styling,composition,forms,icons}.md`.
Also read: `node_modules/bits-ui/dist/bits/menu/components/menu-trigger.svelte`.

---

## R1 — Does this component need a `stat.svelte.ts` state module?

**Decision**: **No.** The folder ships seven `.svelte` files and `index.ts`, and nothing else. The
two `tv()` tables and the three `resolve*` helpers live in the `<script lang="ts" module>` block of
the part that owns them (`stat-indicator.svelte`, `stat-trend.svelte`) and are re-exported by the
barrel.

**Rationale**: CLAUDE.md §3 and Constitution I place *reactive logic that is not markup* in
`<slug>.svelte.ts`. `Stat` has no reactive logic at all: no `$state`, no collection, no selection, no
highlight index, no controlled/uncontrolled value, no keyboard state machine, no context. Every part
is a pure function of its own props. Creating an empty-but-present `stat.svelte.ts` to satisfy the
letter of a directory template would add a file to `registry.json` that consumers must copy for no
behaviour. `status` — the repository's only other variant-only port — sets exactly this precedent:
`statusVariants`, `STATUS_VARIANTS` and `resolveStatusVariant` all live in `status.svelte`'s module
script and are re-exported from `index.ts`.

**Alternatives considered**: (a) `stat.svelte.ts` holding both `tv()` tables — legitimate, and it
would centralise the class strings, but it splits each part from its own variant table, diverging
from `status` and from every shadcn-svelte component in the repo (`button.svelte` also declares
`buttonVariants` inline); (b) a `types.ts` — rejected, `verbatimModuleSyntax` + the "prop types live
in the part's module script" rule (Constitution VI) already covers it, and a separate types file
would be a second place to keep in sync.

---

## R2 — `cva` → `tv()`, and what happens to an unrecognised runtime key?

**Decision**: Both variant tables use `tv()` from `tailwind-variants`, declared in the module script
and exported (`statIndicatorVariants`, `statTrendVariants`). Variant keys and their defaults are
unchanged from upstream. Each axis gets a `readonly` tuple of its legal values plus a
`resolveStatX(value?: string): X` guard that maps anything outside the tuple to that axis's default,
and the **resolved** value is what reaches both the class table and the `data-*` attribute.

**Rationale**: Constitution VIII requires `tv()` for multi-variant components; the divergence from
`cva` is already recorded in the spec's Assumptions. The guard is required by the spec's Edge Cases
("an unsupported/misspelled `variant`, `color`, or `trend` value … still renders using the
variant-table's default class fallback for that axis rather than crashing") and reproduces the
`status` port's `resolveStatusVariant` exactly. Normalising *before* the attribute is written also
means `data-variant`/`data-color`/`data-trend` can only ever hold a value from the documented
`DataAttributesTable`, so a consumer's `data-[variant=icon]:` selector cannot be defeated by dirty
data.

**Note on the ordering of the two axes**: `tailwind-variants` applies variant groups in declaration
order, so `variant` **must** be declared before `color`, matching `cva`. That is what makes
`color: "success"`'s `text-success` win over `variant: "default"`'s `text-muted-foreground` — and it
is why `tv()`'s built-in `tailwind-merge` pass is load-bearing rather than cosmetic.

**Alternatives considered**: (a) let an unknown key fall through and emit no classes for that axis,
literally matching `cva` — reproduces a bug rather than an API, produces an unstyled element, and
would put an undocumented value into `data-variant`; (b) throw on an unknown key — upstream does not
throw, and TypeScript already prevents it for typed callers; (c) `cn()` with a hand-written lookup
object (upstream's own approach for `StatTrend`) — rejected for the trend part too, so both axes are
described by one mechanism.

---

## R3 — How is `StatSeparator` composed, and what is its props type?

**Decision**: `stat-separator.svelte` renders the repository's own
`$lib/components/ui/separator/index.js` `Root`, forwarding `data-slot="stat-separator"` and
`class={cn('my-2', className)}`, with `SeparatorPrimitive.RootProps` (from `bits-ui`) as its props
type.

**Rationale**: Principle IV's tier 1 — an existing `src/lib/components/ui/*` component — applies
directly, and `.agents/skills/shadcn-svelte/rules/composition.md` mandates `<Separator />` over a raw
`<hr>` or a bordered `div`. The repo's `separator.svelte` already destructures
`'data-slot': dataSlot = 'separator'`, so the slot override upstream performs is a supported prop
rather than a hack. `bits-ui`'s `Separator.Root` supplies `role="separator"` + `aria-orientation`, or
`role="none"` when `decorative` — behaviour that a hand-rolled `<hr>` would lose. This makes
`separator` the component's single `registryDependency` and pulls in no new npm package (`bits-ui` is
already a dependency of the repo and of the `separator` registry item).

**One refinement over upstream**: upstream writes `className="my-2" {...props}`, so a caller-supplied
`className` **replaces** `my-2` entirely. Here `cn('my-2', className)` merges, so a caller's
`class="my-4"` still wins on the conflicting axis (tailwind-merge) while non-conflicting utilities
are kept. Constitution VIII ("the caller's `class` MUST be merged last") requires the merging form;
the observable difference is limited to a caller who passes unrelated classes and expected the
component's own margin to vanish.

**Alternatives considered**: (a) render `<hr>` directly — violates composition.md and drops the
ARIA handling; (b) import `Separator` from `bits-ui` directly — skips tier 1 for tier 2 with no
gain, and would lose the repo's own separator styling, causing the rule to render invisibly.

---

## R4 — How is the "action" indicator composed with the menu?

**Decision**: The demo writes upstream's composition verbatim —

```svelte
<DropdownMenu.Trigger>
	<Stat.Indicator variant="action"><EllipsisIcon /></Stat.Indicator>
</DropdownMenu.Trigger>
```

— with **no** `child` snippet on the trigger and **no** `child` prop on `Stat.Indicator`.

**Rationale**: this was the single point where `spec.md` misdescribed upstream, and re-reading
`stat-demo.tsx` settled it. Upstream's `<DropdownMenuTrigger>` carries **no** `asChild`, so Radix
renders its own `<button>` and `StatIndicator` is ordinary content inside it; no cloning and no
prop-forwarding occur. `bits-ui`'s `Menu.Trigger` renders `<button {...mergedProps}>` when no `child`
snippet is supplied (`menu-trigger.svelte:36`), so the plain composition produces byte-comparable DOM
— `<button data-slot="dropdown-menu-trigger">` wrapping `<div data-slot="stat-indicator" data-variant="action">`
— and inherits bits-ui's focus management, `aria-haspopup`/`aria-expanded`/`aria-controls`, and
`Enter`/`Space`/`ArrowDown`/`Escape` handling for free. The full reconciliation, including the two
`spec.md` sentences corrected, is in `plan.md` § "Spec reconciliation".

**Layout check**: with the trigger button as the grid's 2nd child, `grid-cols-[1fr_auto]`
auto-placement lands it in column 2 / row 1 — the same cell
`**:data-[slot=stat-indicator]:col-start-2` would have targeted. The layout is identical either way,
which is why upstream never noticed the difference.

**Alternatives considered**: (a) `DropdownMenu.Trigger`'s `child` snippet spreading the merged props
onto `Stat.Indicator` — removes the wrapper, but the indicator is a `<div>`: it would receive
`type="button"` and `disabled` (invalid on a div), would not be focusable, and would answer neither
`Enter` nor `Space`. A deliberate accessibility regression to satisfy a phrasing that upstream itself
does not satisfy; rejected under Principle III. (b) Adding a `child` snippet prop to
`StatIndicator` so it can render onto a `<button>` — the cleanest *Svelte* answer, but the spec's
Assumptions explicitly fix `StatIndicator` as "a plain styled `div`" with no `asChild`/`child` prop,
and `docs/types/radix/stat.ts` documents none; adding one would be undocumented API drift
(Principle II). Worth revisiting only if a future upstream commit adds `asChild` there.

---

## R5 — Does the grid mirror correctly under `dir="rtl"`?

**Decision**: Yes, with no extra code. The upstream class list is copied verbatim.

**Rationale**: CSS Grid line numbering is inline-direction-relative — under `direction: rtl`, grid
column 1 is the rightmost track and `grid-column-start: 2` resolves to the left. So
`grid-cols-[1fr_auto]` plus `**:data-[slot=stat-indicator]:col-start-2` mirrors automatically.
`gap-x-4`/`gap-y-1`, `col-span-*`, `row-span-*` and `self-start` are all direction-agnostic or
block-axis, and the component uses no `ml-*`/`mr-*`/`left-*`/`right-*`/`text-left` that would need a
logical-property replacement. There is no horizontal keyboard navigation to invert (FR-014 is purely
a layout requirement here), so RTL coverage in the tests is a rendered-attribute/rule assertion, not
a `user-event` one.

**Alternatives considered**: replacing `col-start-2` with an explicit `[grid-column-start:2]` or
adding `rtl:` variants — unnecessary, and it would diverge from upstream's class string for no
behavioural gain.

---

## R6 — What is the correct accessibility contract for a presentational metric card?

**Decision**: No `role`, no `aria-label`, no `aria-describedby`, no live region on any part. The
label and value are ordinary text and are therefore already in the accessibility tree. Tests assert
this positively (text is queryable by `getByText`, the card exposes no widget role) rather than
asserting nothing.

**Rationale**: the WAI-ARIA Authoring Practices define patterns for *widgets*; a static
label/value/description card is not one, and the MDX documents no role, no keyboard interaction and
no ARIA attribute for any of the seven parts. Adding `role="group"` + `aria-labelledby` would be
invented API (Principle II) and would make screen readers announce a group boundary upstream users do
not get. The one genuinely interactive scenario — the action indicator — derives its entire ARIA and
keyboard contract from `DropdownMenu.Trigger` (R4), which is where the keyboard assertions belong.
`Separator`'s `role` is likewise owned by `bits-ui`.

**Consequence for the mandated test areas**: "controlled vs uncontrolled" and "`disabled`/`readOnly`
guard rails" have **no** counterpart in this component — there is no value-bearing prop and no
disabled state anywhere in the upstream source. Rather than fabricate them, `stat.test.ts` covers the
analogous surface that does exist: props are stateless and re-render on change (a prop-driven
rerender flips `data-variant`/`data-color`/`data-trend` and the class rows), and no part throws when
used outside `Stat` (there is no provider — asserted explicitly, because "throws outside its
provider" is the one required area whose *absence* is itself part of this component's contract).

---

## R7 — Should anything be extracted as a shared module for later ports?

**Decision**: **No.** Nothing is extracted. `stat` exports only its own symbols.

**Rationale**: the tempting candidate is the semantic colour-theme map
(`default`/`success`/`info`/`warning`/`error` → `bg-*/10 text-* border-*/20`), which `status` already
spells out and `stat` now spells out again. Extracting it to, say, `$lib/components/ui/_shared/` would
create a cross-folder import that breaks Principle V's copy-one-folder installation model: a consumer
running `add stat` would receive a file referencing a folder they do not have, and `registry:build`'s
`$lib/...` → placeholder rewriting has no entry for a shared non-registry path. The duplication is
four short class strings, and shadcn-style distribution deliberately prefers duplication over a
shared runtime. The single source of truth that *does* matter — the colour tokens themselves — is
already shared, in `src/app.css`.

**Alternatives considered**: (a) a `registry:lib` item holding the map — possible, but it makes every
colour-bearing component depend on a second registry item for a constant, and no upstream component
does this; (b) exporting `STAT_INDICATOR_COLORS` for other ports to import — same cross-folder
problem; other ports should declare their own tuple.

---

## R8 — Do the semantic tokens needed already exist?

**Decision**: Yes. No change to `src/app.css`, no new token, no `@theme inline` entry.

**Rationale**: `--success`, `--warning`, `--info` (plus `-foreground` companions) are declared for
both `:root` and `.dark` at `src/app.css:24-29` / `:65-70` and exposed through `@theme inline` at
`:108-113`; `--destructive` predates them. The mapping table in CLAUDE.md §6 covers every upstream
colour this component uses: `green-*` → `success`, `blue-*` → `info`, `orange-*` → `warning`,
`red-*` → `destructive`. Upstream's `dark:text-green-400` / `dark:text-red-400` overrides are dropped
entirely, because the tokens already flip with the theme — keeping them would violate the "no manual
`dark:`" rule and double-apply.

**Alternatives considered**: adding a distinct `--stat-*` token family — rejected outright by
Constitution VIII and by the "no theme changes" scope exclusion in the spec.

---

## R9 — Which npm dependencies does this port add?

**Decision**: **Zero.** `registry.json`'s `dependencies` for the item is `["tailwind-variants"]` (the
one package the shadcn CLI cannot infer from the source, matching the `status` entry) and
`registryDependencies` is `["separator"]`. Both are already installed at
`tailwind-variants@^3.3.0` and via `bits-ui@^2.18.1` respectively; `pnpm install` is not re-run and
`package.json` is not edited.

**Rationale**: upstream's only third-party import is `class-variance-authority`, which the port
replaces with the already-present `tailwind-variants` (spec Assumptions). `@lucide/svelte` is used by
the demo route only, is already a devDependency, and — per `components.json`'s `iconLibrary: "lucide"`
and `icons.md` — is imported per-icon (`@lucide/svelte/icons/dollar-sign`), so it belongs to neither
the component nor the registry entry.
