# Quickstart: validating the Data Grid port

How to prove the feature works end to end. Details of the surface live in
[contracts/public-api.md](./contracts/public-api.md) and [contracts/keyboard.md](./contracts/keyboard.md);
entity shapes and transitions live in [data-model.md](./data-model.md).

## Prerequisites

- Node + pnpm, dependencies installed (`pnpm install`). **No new npm package is required** —
  `@tanstack/table-core`, `bits-ui`, `svelte-sonner`, `@internationalized/date` and
  `@lucide/svelte` are already in `package.json` (research R-01).
- Every command below is non-interactive and terminates. Never start `pnpm dev`, bare `vitest`, or
  any `--watch` mode.

## 1. Quality gates — the definition of done

Run in this order, all green, nothing suppressed:

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

To iterate on this component alone while implementing:

```bash
pnpm run test:unit -- --run src/lib/components/ui/data-grid/data-grid.test.ts
```

## 2. Unit-test scenarios that prove each user story

| Story | Scenario                                                                                                      | Where it is asserted                        |
| ----- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| US1   | Double-click a short-text cell, type, press Enter → `onDataChange` receives the full array with only that field changed | DOM test through `userEvent`         |
| US1   | Each of the nine variants renders its resting display and its editor                                           | DOM test, one `describe` per variant        |
| US1   | `readOnly` blocks edit start, checkbox toggle, clear, cut and paste                                            | DOM test                                    |
| US2   | Every key in `contracts/keyboard.md` moves focus / extends selection as documented, clamping at the edges       | DOM test through `userEvent`                |
| US2   | Same keys under `dir="rtl"` invert horizontally                                                                | DOM test with an RTL harness                |
| US2   | 10 000-row grid mounts only `endIndex - startIndex + 1` rows                                                   | `DataGridVirtualizer` unit test + DOM count |
| US3   | `parseTsv` handles quoted fields, embedded tabs/newlines, ragged rows, fallback column count                   | pure unit test                              |
| US3   | `serializeCellsToTsv` emits row-major TSV with JSON for multi-select/file and ISO for dates                    | pure unit test                              |
| US3   | `coercePastedValue` accepts/skips per variant (non-numeric → skip, unknown option → skip, bad file JSON → skip) | pure unit test                              |
| US3   | Paste needing more rows opens the dialog with the right `rowsNeeded` instead of truncating                      | state-class test + DOM assertion            |
| US3   | Cut then paste clears the source cells to their empty values                                                   | state-class test                            |
| US4   | Ctrl/Cmd+F opens search and focuses the input; typing flags matches; Enter / Shift+Enter wrap                   | DOM test                                    |
| US4   | Escape closes search and returns focus to the last active match                                                | DOM test                                    |
| US5   | Ctrl/Cmd+Backspace calls `onRowsDelete` with the selected rows **and** their indices                            | DOM test                                    |
| US5   | The context menu omits "Delete rows" when `onRowsDelete` is absent                                              | DOM test                                    |
| US6   | The shortcuts dialog shows only the groups whose feature flag is set, and its filter narrows the list           | DOM test                                    |

Clipboard tests stub `navigator.clipboard` with `vi.fn()`; drag-selection and auto-scroll geometry
are asserted through the state classes, never through synthetic pixel movement (research R-05, R-06).

## 3. Manual validation on the docs route

The demo route is `src/routes/docs/components/data-grid/`. `pnpm run build` compiles it as part of
gate 4, which is the automated proof that the route works. For a human spot-check outside the
unattended pipeline:

1. `pnpm run build && pnpm run preview`
2. Open `/docs/components/data-grid`.
3. Walk the acceptance list: arrow-key navigation, Enter to edit, Escape to cancel, Shift+Arrow to
   extend a selection, Ctrl/Cmd+C then paste into a spreadsheet, Ctrl/Cmd+F to search,
   Ctrl/Cmd+`/` for the shortcuts dialog, the "Add row" footer cell.

## 4. Registry validation

```bash
pnpm run registry:build
```

Must emit `static/r/data-grid.json` containing every file in the component folder **except**
`data-grid.test.ts` and `data-grid.test.svelte`, with `$lib/...` imports rewritten to registry
placeholders. Confirm the item appears in the docs index (`src/lib/registry.ts` filters on
`type === 'registry:ui'`) and that its `name` matches the folder slug and the route segment.

## Expected outcome

All five gates green, `data-grid.test.ts` passing with no skipped or `.todo` tests, one new
`registry:ui` entry named `data-grid`, and a demo route that builds.
