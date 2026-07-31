# Quickstart — validating the Selection Toolbar port

How to prove the component works end to end. See [contracts/selection-toolbar.md](./contracts/selection-toolbar.md)
for the API and [data-model.md](./data-model.md) for the state it exposes.

## Prerequisites

- Node + `pnpm` installed, dependencies present (`pnpm install`). **No new packages are required** —
  `bits-ui` already ships the floating layer this component composes.
- Files from `plan.md` §Deliverables in place under `src/lib/components/ui/selection-toolbar/`.

## 1. Static gates (non-interactive, in this order)

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

Expected: zero errors and zero warnings from each. `check` must show no `any`, no ignore comments and
no `svelte-ignore`; a gate made green by suppression is an invalid result (constitution VII).

## 2. Unit suite in isolation

```bash
pnpm run test:unit -- --run src/lib/components/ui/selection-toolbar/selection-toolbar.test.ts
```

Expected: every test passes, none skipped or `.todo`. The suite must cover the six areas listed in
`plan.md` §Tests. Selection is driven through the real APIs — build a `Range`, `addRange` it, dispatch
`mouseup` on the container with `userEvent`, await one animation frame, assert; close by collapsing the
range and dispatching `selectionchange` on `document` (jsdom does not emit it for programmatic changes —
see research R-10).

## 3. Demo route

```bash
pnpm run build && pnpm run preview   # then open /docs/components/selection-toolbar
```

Manual scenarios, one per acceptance path in the spec:

| # | Action                                                                | Expected                                                                          |
| - | --------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1 | Select a phrase in the first demo's editable article                  | Toolbar appears above the selection, centred, with bold/italic/link ∣ copy/share   |
| 2 | Press the bold item with the mouse                                     | Text wraps in `<strong>`, the selection survives, the toolbar stays anchored       |
| 3 | `Tab` to an item and press `Enter`                                     | Same action fires — the keyboard path (FR-010)                                     |
| 4 | Click into empty space outside the toolbar                             | Selection clears, toolbar closes (FR-009)                                          |
| 5 | Reselect, then press `Escape`                                          | Selection clears, toolbar closes (FR-008)                                          |
| 6 | Select text near the top edge of the viewport                          | Toolbar flips below the selection instead of clipping (FR-006, SC-003)             |
| 7 | Scroll the page with the toolbar open                                  | Toolbar stays glued to the selection                                               |
| 8 | Select text **outside** the editable container                         | Nothing appears (FR-004)                                                           |
| 9 | Select text in the second demo                                         | Word/character readout updates live with the exact selected text (FR-003)          |
| 10| Extend an existing selection with `Shift`+click                        | Toolbar repositions without closing and reopening                                  |
| 11| Switch the docs theme to dark                                          | Surface, separator and item hover states flip via tokens — no hard-coded colours   |

## 4. Registry output

```bash
pnpm run registry:build
```

Expected: `static/r/selection-toolbar.json` is produced, lists all six source files (no test files), and
rewrites `$lib/...` imports to registry placeholders. `registry.json` must contain exactly one new item
named `selection-toolbar`, with `registryDependencies: ["button", "direction-provider"]` and
`dependencies: ["bits-ui"]`.

## 5. Parity spot-check against upstream

Open `.reference/diceui/docs/content/docs/components/radix/selection-toolbar.mdx` beside the demo route
and confirm: all 15 root props exist with the same names and defaults, `[data-state]` takes `open`/`closed`,
the four `--selection-toolbar-*` variables resolve to real pixel values on the open surface
(`getComputedStyle($0).getPropertyValue('--selection-toolbar-anchor-width')` in devtools), and `Escape`
is the only documented keyboard interaction. Divergences must match the D-1…D-8 table in `plan.md` and
the spec's Assumptions — nothing else.
