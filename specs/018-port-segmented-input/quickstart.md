# Quickstart & Validation: Segmented Input

**Feature**: `018-port-segmented-input` | **Plan**: [plan.md](./plan.md) | **API**: [contracts/public-api.md](./contracts/public-api.md)

How to run the port's proof. Every scenario below is an executable check, not a description.

---

## Prerequisites

```bash
cd D:/Code/svelte-dice-ui
pnpm install --frozen-lockfile     # only if node_modules is missing
```

No new npm dependency is introduced (`tailwind-variants` is already in `package.json`), so a fresh
install is not normally needed.

---

## Run

```bash
pnpm run format                                    # first — generator output is not prettier-formatted
pnpm run check                                     # svelte-kit sync && svelte-check, 0 errors 0 warnings
pnpm run lint                                      # prettier --check . && eslint .
pnpm run test:unit -- --run                        # vitest, single run, no watch
pnpm run build                                     # vite build, includes the new docs route
pnpm run registry:build                            # regenerates static/r/segmented-input.json
```

Target the component's own suite while iterating:

```bash
pnpm run test:unit -- --run src/lib/components/ui/segmented-input/segmented-input.test.ts
```

Never use a watch mode, `vitest` without `--run`, or `pnpm dev` (constitution, Development Workflow).

---

## Validation scenarios

Each `V-n` maps to at least one `it()` in
`src/lib/components/ui/segmented-input/segmented-input.test.ts`, driven through
`@testing-library/svelte` + `user-event` and the `segmented-input.test.svelte` harness.

### Structure, roles and ARIA (FR-001, FR-002, FR-007 — Principle III area 1)

- **V-1** — Root renders `role="group"` with `aria-orientation="horizontal"` by default and
  `"vertical"` when `orientation="vertical"`; `data-slot="segmented-input"` and
  `data-orientation` mirror it.
- **V-2** — Each item renders an `<input>` with `data-slot="segmented-input-item"` and is reachable
  by its `aria-label` through `screen.getByRole('textbox', { name })`.
- **V-3** — Native input attributes survive the round trip: `placeholder`, `maxlength`, `inputmode`,
  `pattern`, `min`, `max`, `name`, `readonly` all land on the DOM node.
- **V-4** — `disabled` / `invalid` / `required` on the root produce `data-disabled` / `data-invalid`
  / `data-required` (value `""`) on the root **and** on every item, plus `aria-invalid` /
  `aria-required` / the native `disabled` and `required` attributes on the items. When the flags are
  `false` the attributes are **absent**, not `"false"`.

### Position auto-assignment (FR-003, FR-004 — spec Edge Cases)

- **V-5** — One item ⇒ `data-position="isolated"`. Three items ⇒ `first` / `middle` / `last` in
  document order.
- **V-6** — An explicit `position="last"` on the middle item overrides the computed value; its
  siblings keep their computed positions.
- **V-7** — Conditionally rendering a fourth item re-derives positions without a remount: the
  previous `last` becomes `middle`.
- **V-8** — Items carry the position classes for the active orientation, and `class` from the caller
  wins (`cn()` merged last). Under `dir="rtl"` the seam classes are the **logical** `border-s-0`,
  never `border-l-0` (divergence D-06).
- **V-9** — A disabled item still occupies its index: it keeps `data-position="middle"` and its
  neighbours keep `first`/`last`.

### Sizes (FR-005)

- **V-10** — `size="sm" | "default" | "lg"` puts `h-8`/`h-9`/`h-11` on every item, and the size
  applies to items added later.

### Disabled / required inheritance and guard rails (FR-006 — Principle III area 6)

- **V-11** — Group `disabled` disables every item; an item with `disabled={false}` stays enabled and
  editable.
- **V-12** — Group `required` marks every item required; an item with `required={false}` is not.
- **V-13** — Group `invalid` marks every item `aria-invalid`; there is no per-item override (an
  `invalid` prop on the item does not exist and would be a type error).
- **V-14** — Typing into a disabled item changes nothing.

### Keyboard (FR-008…FR-011 — Principle III area 2)

- **V-15** — `Tab` / `Shift+Tab` walk the items in document order and out of the group.
- **V-16** — Horizontal LTR: from an empty first item, `ArrowRight` twice lands focus on the third
  item; no item's value changes.
- **V-17** — Horizontal LTR: `ArrowLeft` from the first item leaves focus on the first item (no
  wraparound); `ArrowRight` from the last leaves focus on the last.
- **V-18** — Vertical: `ArrowDown`/`ArrowUp` move between items and `ArrowLeft`/`ArrowRight` do not.
- **V-19** — Horizontal: `ArrowUp`/`ArrowDown` do not move focus.
- **V-20** — `Home` focuses the first item, `End` the last, from any item, in both orientations.
- **V-21** — Arrow navigation skips a disabled middle item: from the first item, one `ArrowRight`
  lands on the third.
- **V-22** — Caret guard (D-07): with `"abc"` in the first item and the caret at index 1,
  `ArrowRight` moves the caret inside the field and does **not** change focus; pressing it again
  from the end of the text does move focus.
- **V-23** — A caller `onkeydown` that calls `preventDefault()` suppresses segment navigation
  entirely.

### RTL (FR-012 — Principle III area 5)

- **V-24** — With `dir="rtl"` on the root, `ArrowLeft` moves toward the end of the group and
  `ArrowRight` toward the start — the mirror of V-16/V-17.
- **V-25** — With no `dir` prop but the root nested inside `<DirectionProvider dir="rtl">`, the
  resolved direction is `rtl`: the root's `dir` attribute reads `"rtl"` and arrow inversion applies.
- **V-26** — An explicit `dir="ltr"` on the root beats a surrounding `rtl` provider.
- **V-27** — Vertical `ArrowUp`/`ArrowDown` are unaffected by direction.

### Paste distribution (FR-013, FR-014 — spec US3)

- **V-28** — Three items, first focused, paste `"Ada Byron King"` ⇒ the items read `Ada`, `Byron`,
  `King` and focus lands on the third.
- **V-29** — Three items, second focused, paste a three-part value ⇒ the first item is untouched,
  the second and third receive parts one and two, the third part is discarded, and focus lands on
  the third item.
- **V-30** — Fewer parts than remaining segments: the surplus segments keep their previous values.
- **V-31** — `maxlength` splitting: paste `"5551234567"` into the phone demo's area-code segment
  (`maxlength=3`, then `maxlength=7`) ⇒ `555` and `1234567`.
- **V-32** — A `readonly` or `disabled` segment in the path is skipped and keeps its value;
  distribution continues into the next eligible segment.
- **V-33** — A single-part paste is left to the browser (the value lands in the focused field only,
  `preventDefault` not called).
- **V-34** — A caller `onpaste` that calls `preventDefault()` suppresses distribution.
- **V-35** — Distribution fires `oninput` on every written segment and updates `bind:value`; an
  authoritative function binding that rejects the write leaves that segment unchanged.

### Controlled / uncontrolled (Principle III areas 3 and 4)

- **V-36** — Uncontrolled: an item with no `value` accepts typing and reports it through `oninput`.
- **V-37** — Bound: `bind:value` reflects typing in both directions (typing updates the parent, the
  parent updating re-renders the input).
- **V-38** — Authoritative: `bind:value={get, set}` where `set` ignores the write keeps the rendered
  value pinned — the component never moves on its own.

### Composition and escape hatches (FR-016)

- **V-39** — The root's `child` snippet renders the caller's element with the full merged payload
  (`role="group"`, `aria-orientation`, `data-*`, `dir`, `class`) and no default `<div>` appears.
- **V-40** — The item's `child` snippet likewise, carrying `data-position` and the resolved
  `disabled`/`required`.
- **V-41** — `bind:ref` on the root yields the `<div>`; `bind:ref` on an item yields the `<input>`.

### Provider guard (Principle III area 6)

- **V-42** — `render(SegmentedInputItem)` outside a root throws `/within/`, with the message naming
  both `<SegmentedInput.Item>` and `<SegmentedInput.Root>`.

### The reusable module in isolation (FR-015)

- **V-43** — `resolveSegmentPosition` over the full index/count matrix, including `index === -1`.
- **V-44** — `resolveSegmentIntent` over the full key × orientation × direction matrix from
  [contracts/public-api.md § 5](./contracts/public-api.md#5-keyboard-contract), including the
  `null` cases.
- **V-45** — `splitPastedValue` against every row of the worked-example table in
  [research.md R-10](./research.md#r-10--paste-distribution), plus `""`, whitespace-only, and
  more-parts-than-segments.
- **V-46** — `SegmentNavigation` drives focus over hand-registered `<input>` elements with no
  `<SegmentedInput>` markup anywhere — the proof that Time Picker can import it.

---

## Manual check (docs route)

```bash
pnpm run build      # must succeed; the route is prerendered by the build
```

Then confirm `src/routes/docs/components/segmented-input/+page.svelte` renders four
`<ComponentPreview>` sections — **Default**, **Form Input**, **RGB Color Input**, **Vertical
Layout** — one per upstream demo file, plus the two prop tables and the keyboard table
(SC-004, Principle IX). The sidebar entry appears automatically because the route segment equals the
registry item name.

---

## Definition of done

- All six mandatory test areas of `CLAUDE.md` §7 covered (V-1…V-46).
- `registry.json` has exactly one new `registry:ui` entry and `pnpm run registry:build` has been run.
- All four quality gates green from a clean tree, with **no** `@ts-ignore`, `@ts-expect-error`,
  `eslint-disable`, `svelte-ignore`, `as any`, `.skip`, `.todo`, or config loosening anywhere in the
  diff.
