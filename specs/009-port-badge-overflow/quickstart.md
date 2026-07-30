# Quickstart — validating the Badge Overflow port

**Feature**: `009-port-badge-overflow`. Every command here is non-interactive and terminates on its own.

## Prerequisites

- Node 22+, `pnpm` installed, dependencies already present (`pnpm install` if not).
- **No new npm dependency** is introduced by this feature.
- Working tree owned by the orchestrator: do not run git write commands.

## 1. Quality gates (the acceptance bar — SC-005)

Run in this order from the repo root:

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

All five must be clean. Constitution VI/VII: a gate made green by `@ts-ignore`, `@ts-expect-error`,
`eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`, a deleted assertion, or a loosened
`tsconfig` / ESLint / Prettier / `svelte-check` / Vitest config is an invalid result. In particular,
**`tests/setup.ts` and `vite.config.ts` must not change** — the jsdom layout stubs this component needs
are installed inside its own test file (research R-07).

To iterate on just this component's tests:

```bash
pnpm run test:unit -- --run src/lib/components/ui/badge-overflow/badge-overflow.test.ts
```

## 2. Regenerate the registry

```bash
pnpm run registry:build
```

Then verify the emitted item (`static/r/badge-overflow.json`):

```bash
node -e "const j=require('./static/r/badge-overflow.json'); console.log(j.name, j.type, j.files.length); j.files.forEach(f=>console.log(' ', f.target));"
```

Expect `badge-overflow registry:ui 4` and these targets:

```text
badge-overflow/index.ts
badge-overflow/badge-overflow.svelte
badge-overflow/badge-overflow-indicator.svelte
badge-overflow/badge-overflow.svelte.ts
```

The test file and `badge-overflow.test.svelte` must **not** appear. Confirm `$lib/utils.js` was rewritten
to the `$UTILS$` placeholder and that no `$lib/components/docs` or `src/routes` import leaked in:

```bash
node -e "const j=require('./static/r/badge-overflow.json'); const s=JSON.stringify(j); console.log('utils placeholder:', s.includes('\$UTILS\$')); console.log('docs leak:', /components\/docs|src\/routes/.test(s));"
```

Expect `utils placeholder: true` and `docs leak: false`.

## 3. Test plan — what `badge-overflow.test.ts` must prove

Fixtures: the jsdom layout stubs and controllable `ResizeObserver` from research R-07, installed in a
local `beforeEach` and torn down by the global `afterEach`. Badge width is deterministic:
`BADGE_PADDING + label.length * CHAR_WIDTH`.

| # | Area (Constitution III)         | Scenario                                                                                                        | Requirement       |
| - | ------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------- |
| 1 | Rendering                       | Both siblings render; measurement row has `items.length + 1` element children and `aria-hidden="true"`.           | FR-006            |
| 2 | Rendering                       | Container carries `data-slot="badge-overflow"`, `data-line-count`, `data-hidden-count`, and `class="flex flex-wrap"` merged with the caller's `class` last. | FR-013, FR-015    |
| 3 | Pre-measurement / SSR           | Before any measurement: no `data-measured`, exactly `getPlaceholderCount(n, lineCount)` badges, no indicator, a `min-height` declaration. Table of `lineCount` 1/2/3 → 3/5/8 items and 20/44/68px. | FR-010            |
| 4 | SSR                             | `render()` from `svelte/server` produces that placeholder markup and touches no browser global (assert by rendering with `ResizeObserver`/`window` untouched — the server bundle has no DOM). | FR-010            |
| 5 | Core split (P1)                 | Narrow container: visible badges' summed widths + gaps ≤ container width; indicator present; `data-hidden-count` equals `items.length - visibleBadges`. | FR-001, FR-004, SC-001 |
| 6 | Core split (P1)                 | Wide container: every item visible, **no** indicator, `data-hidden-count="0"`.                                    | FR-001            |
| 7 | Prop `lineCount` (P2)           | Same items and width at `lineCount` 1, 2, 3 → strictly non-decreasing visible counts; no line exceeds the width.  | FR-003, SC-001    |
| 8 | Prop `lineCount` (P2)           | `lineCount` defaults to `1` when omitted (`data-line-count="1"`).                                                 | FR-003            |
| 9 | Prop `badge` (P2)               | The custom badge snippet's markup renders for every visible item, in `items` order.                              | FR-001            |
| 10 | Prop `overflow` (P2)           | With an `overflow` snippet: the custom indicator renders and receives the hidden count; the default `data-slot="badge-overflow-indicator"` does not appear. | FR-005            |
| 11 | Prop `overflow` (P2)           | Without it: the default indicator renders `+{count}` with `data-count` and upstream's class string.              | FR-005            |
| 12 | Prop `getBadgeLabel`           | Primitive items with no extractor use the item itself as the label (numbers coerce).                             | FR-002            |
| 13 | Prop `getBadgeLabel` — throw   | Object items with no extractor throw ``/`getBadgeLabel` is required when using array of objects/`` exactly.       | FR-002, US3-AC5   |
| 14 | Prop `getBadgeLabel`           | Object items **with** an extractor: labels and widths come from the extractor.                                    | FR-002            |
| 15 | Props `class` / `style`        | Caller `class` wins the `cn()` merge; caller `style` is appended after the computed `gap`.                       | FR-013            |
| 16 | Prop `ref`                     | `bind:ref` populates with the visible container element; stays `null` in `child` mode.                            | —                 |
| 17 | Prop `child`                   | `child` renders onto the caller's element with every `props` entry applied and `content` rendering the same badges + indicator. | FR-014            |
| 18 | `restProps`                    | An arbitrary attribute (`id`, `data-testid`, `onclick`) lands on the visible container only.                     | FR-016            |
| 19 | Resize (P1)                    | Widen and narrow through the `ResizeObserver` double: the split and `data-hidden-count` update with no prop change and no remount. | FR-007, SC-002    |
| 20 | Resize teardown                | Unmount calls `.disconnect()` on the observer exactly once; no listener remains.                                  | —                 |
| 21 | Items change (P2/FR-011)       | Adding and removing items re-measures and updates the split — the consumer-owned-state case that replaces the controlled/uncontrolled pair. | FR-008, FR-011    |
| 22 | Keyboard / focus               | The container has no `role`, is not focusable, and `Tab` visits the consumer's interactive badges in DOM order.   | Principle III (R-08) |
| 23 | RTL                            | Under `dir="rtl"`: identical visible/hidden split and identical DOM order; the container inherits `dir`.          | FR-012, SC-004    |
| 24 | Edge — empty                   | `items: []` → no badges, no indicator, `data-empty` present.                                                      | Edge case         |
| 25 | Edge — nothing fits            | Container narrower than one badge + indicator: the indicator still renders once measured.                         | Edge case         |
| 26 | Edge — duplicate labels        | Two items with the same label share one measured width and both still render.                                     | data-model §1     |
| 27 | Pure helpers                   | `computeVisibleSplit`, `getPlaceholderCount`, `getPlaceholderHeight`, `resolveBadgeLabel`, `readContainerMetrics` unit-tested directly, including the non-finite `gap` guard (research R-02) and the "final item does not reserve indicator space" case (research R-05). | —                 |
| 28 | Typing                         | A primitive-array render without `getBadgeLabel` and an object-array render with it both appear in the harness, so `pnpm run check` exercises research R-03. | FR-002            |

`expect.requireAssertions` is on: every `it` must assert at least once. Interactions go through
`@testing-library/user-event`, never raw `fireEvent`, wherever `userEvent` can express them.

## 4. Manual verification of the demo route

The build gate already compiles `src/routes/docs/components/badge-overflow/+page.svelte`. To eyeball
the three sections, the orchestrator does **not** start a dev server; instead confirm structurally:

```bash
node -e "const s=require('fs').readFileSync('src/routes/docs/components/badge-overflow/+page.svelte','utf8'); console.log('previews:', (s.match(/<ComponentPreview/g)||[]).length);"
```

Expect `previews: 3` — one per upstream demo file (`badge-overflow-demo.tsx`,
`badge-overflow-multiline-demo.tsx`, `badge-overflow-interactive-demo.tsx`), per Principle IX and
SC-006. The page must also contain the two props tables and must not add a `+page.ts`.

Confirm the sidebar/index picks the component up (it is derived from `registry.json`):

```bash
node -e "const r=require('./registry.json'); const i=r.items.find(x=>x.name==='badge-overflow'); console.log(!!i, i&&i.type, i&&i.files.length);"
```

Expect `true registry:ui 4`.

## 5. Done criteria

- [ ] All five commands in §1 pass from a clean tree, with no suppression anywhere in the diff.
- [ ] `static/r/badge-overflow.json` matches §2.
- [ ] Every row of the §3 table is a passing `it` (or a passing `describe` block of them).
- [ ] §4 reports `previews: 3` and `true registry:ui 4`.
- [ ] `git status` shows changes only under `src/lib/components/ui/badge-overflow/`,
      `src/routes/docs/components/badge-overflow/`, `registry.json`, `static/r/`, and
      `specs/009-port-badge-overflow/`.
