# Phase 0 Research: Data Grid

All unknowns in the Technical Context are resolved here. No `NEEDS CLARIFICATION` markers remain.

Upstream read at the pinned commit `d9763d82530416dfa4c81c462387b55d06bae4ec`:
`docs/components/data-grid/*.tsx` (10 files), `docs/hooks/use-data-grid.ts` (3541 lines),
`docs/lib/data-grid.ts`, `docs/types/data-grid.ts`, `docs/types/radix/data-grid.ts`,
`docs/registry/bases/radix/examples/data-grid-demo.tsx`,
`docs/content/docs/components/radix/data-grid.mdx`.

---

## R-01 — Virtualization without a new npm dependency

**Decision**: Write `DataGridVirtualizer` in `data-grid-virtualizer.svelte.ts` — a fixed-height
windowing class. Public surface: `scrollTop` / `viewportHeight` (written from a `scroll` listener
and a `ResizeObserver` on the grid container), `rowHeight`, `count`, `overscan`; derived
`startIndex`, `endIndex`, `virtualItems: { index, start, size }[]`, `totalSize`; methods
`scrollToIndex(index, { align: 'start' | 'center' | 'end' })` and `measure()`.

**Rationale**: Row height is *known exactly* — `getRowHeightValue(rowHeight)` returns 36/56/76/96 px
— so the window is pure arithmetic:
`start = clamp(floor(scrollTop / h) - overscan)`, `end = clamp(ceil((scrollTop + viewportHeight) / h) + overscan)`.
The whole class is ~120 lines and is a pure function of five numbers, so it is unit-testable without
any layout. It satisfies FR-002 and SC-003 exactly.

**Alternatives considered**:

- `@tanstack/virtual-core` (framework-agnostic sibling of the `@tanstack/react-virtual` upstream
  uses). Rejected: it is a **new npm dependency**, and the capability it adds over the arithmetic
  above is dynamic per-item measurement through `ResizeObserver` — which returns 0 for every element
  under jsdom, so it would make the virtualization layer untestable in this repo's test environment
  while adding no behaviour the fixed-height case needs.
- `bits-ui`. Rejected: has no virtualizer. `$lib/components/ui/listbox`'s `virtual` prop is *virtual
  focus* (`aria-activedescendant` roving), a different concept.
- No virtualization (render every row). Rejected: violates FR-002 and SC-003.

---

## R-02 — Replacing `useSyncExternalStore` + `store.batch()`

**Decision**: Delete the store entirely. Each of the 14 slices becomes a `$state` / `$state.raw`
field on one of five classes; every `useMemo` selector becomes `$derived`; `store.batch(fn)` becomes
plain sequential assignment.

**Rationale**: The store exists to (a) let React components subscribe to individual slices and
(b) coalesce multi-slice writes into one notification via `queueMicrotask`. Svelte 5 gives both for
free: reads are tracked per-field, and effects/renders already run once per microtask flush. Keeping
a manual store would be a transliteration, explicitly forbidden by the task's translation rules, and
would fight fine-grained reactivity.

**Alternatives considered**: keeping a single `$state` object with all 14 slices — rejected, any
write would invalidate every reader; a `SvelteMap`-based store — rejected, no benefit and it carries
the self-invalidation hazard noted in this repo's prior porting experience.

---

## R-03 — TanStack Table bridge

**Decision**: Reuse the exact bridge `src/lib/components/ui/data-table/data-table.svelte.ts` proved:
`createTable(resolvedOptions)` once, then `Object.defineProperties(table.options, { data, columns,
state })` installing getters that read `$state.raw` slices. Row models: `getCoreRowModel`,
`getFilteredRowModel`, `getSortedRowModel` (upstream's exact three). `columnResizeMode: 'onChange'`,
`columnResizeDirection: dir`.

**Rationale**: Proven in-repo, zero new dependency, and it makes `table.getRowModel()` /
`column.getIsSorted()` calls inside templates register fine-grained dependencies. The getters must
be installed *after* `createTable` because `createTable` spreads its options (which would evaluate
the getters once and freeze them).

**Alternatives considered**: recreating the table on every data change — rejected, loses column
sizing/pinning identity and thrashes the row model; a community Svelte adapter — rejected, new
dependency.

**Divergence noted**: upstream puts 25 callbacks on `table.options.meta` and reads them from every
cell. `meta` is a plain object handed to `createTable` and is not reactive, so the port puts those
callbacks on `DataGridState` and publishes it through a Symbol context (Divergence 2).

---

## R-04 — Direction / RTL

**Decision**: Use the already-ported `$lib/components/ui/direction-provider`:
`useDirection(() => dirProp)` inside `createDataGrid`, exactly as upstream calls
`useDirection(dirProp)`. The resolved direction feeds navigation, selection extension,
`getColumnPinningStyle`, `scrollCellIntoView` and `columnResizeDirection`.

**Rationale**: The spec's Assumption ("if it is not yet present in `src/lib/components/ui/`, the
plan MUST add it as a prerequisite") is satisfied — it *is* present, exports
`useDirection`/`DirectionProvider`/`Direction`, and `data-table` already lists it in its
`registryDependencies`. No prerequisite work needed.

---

## R-05 — Clipboard under jsdom

**Decision**: Split the clipboard path in three:
1. **Pure** — `serializeCellsToTsv(cells, opts)` and `parseTsv(text, fallbackColumnCount)` and
   `coercePastedValue(rawValue, cellOpts)` in `data-grid-utils.ts`, no DOM, no clipboard.
2. **Orchestration** — `DataGridClipboardState.copy() / cut() / paste(expandRows?)`, which call
   `navigator.clipboard.writeText/readText` and then the pure functions.
3. **DOM effects** — cut-cell marking (`data-cut`), paste-dialog open state, post-paste range
   selection, `toast.success/error` copy.

Tests drive (1) directly with fixtures, drive (2) with `navigator.clipboard` replaced by
`{ writeText: vi.fn(), readText: vi.fn() }` via `Object.defineProperty(navigator, 'clipboard', …)`,
and assert (3) in the DOM.

**Rationale**: jsdom implements no Clipboard API and `userEvent`'s clipboard emulation does not
cover programmatic `navigator.clipboard.readText()`. This split is exactly what the task's guidance
asks for and keeps 100 % of the parse/coerce logic under assertion.

**Alternatives considered**: `user-event`'s `setup({ writeToClipboard: true })` — rejected, it only
covers copy/paste **events**, not the async API upstream uses.

---

## R-06 — Cell-range selection without pointer geometry

**Decision**: All range arithmetic lives in `DataGridSelectionState` as pure methods over cell
positions — `selectRange(start, end, isSelecting?)`, `toggleCell(pos)`, `selectAll()`,
`selectColumn(columnId)`, `clear()`, `extend(direction, opts)` — and is tested by calling those
methods with synthetic positions. DOM tests cover only the discrete events jsdom produces:
`click`, `ctrl/meta+click`, `shift+click`, `contextmenu`, and keydown-driven extension.

Drag-to-select (`mousedown` → `mouseenter` → `mouseup`) and the edge auto-scroll loop are
implemented (they are real behaviour) but asserted at the state level: a test calls
`onCellMouseDown(0,'a')`, `onCellMouseEnter(2,'c')`, `onCellMouseUp()` and asserts the resulting
`selectedCells` set, rather than simulating pixel movement.

**Rationale**: jsdom returns a zero rect for every element, so `getBoundingClientRect`-driven
auto-scroll and hit-testing cannot be simulated faithfully. Asserting the arithmetic is both
stronger and honest.

---

## R-07 — Search-match and selection lookups at 10 000 rows

**Decision**: Selection is a `Set<string>` of `"rowIndex:columnId"` keys (upstream's `getCellKey`
format, kept verbatim so `parseCellKey` round-trips). Two `$derived` projections give O(1) per-row
lookups without every row re-reading the whole set: `cellSelectionMap: Map<number, Set<string>>` and
`searchMatchesByRow: Map<number, Set<string>>`. Rows read only their own entry.

**Rationale**: Mirrors upstream's `cellSelectionMap` memo, which exists for the same reason. Under
Svelte the projection is a `$derived` instead of a `useMemo` + stable-reference dance — the
reference-stability code upstream needs (to defeat `React.memo`) is dropped, since Svelte re-renders
only the DOM that actually changed.

---

## R-08 — `React.memo` comparators

**Decision**: Drop all five of them (`DataGridRow`, `DataGridCell`, `DataGridSearch`,
`PasteDialog`, `ContextMenu`, `DataGridColumnResizer`). Keyed `{#each … (row.id)}` /
`(cell.id)` blocks plus fine-grained `$derived` give the same or better update granularity.

**Rationale**: The task's translation rules say `useMemo`/`useCallback` port to nothing. The memo
comparators are pure React reconciliation plumbing with no behavioural meaning. Their *logic* is
still honoured indirectly: the props they compared (focus, editing, selection, search match,
readOnly, rowHeight, pinning, dir) are exactly the reactive fields each part reads.

---

## R-09 — Cell editors: which primitive for which variant

| Variant        | Composition                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| `short-text`   | `contenteditable` div inside `CellWrapper` (upstream's approach; keeps the cell in flow, no input remount)   |
| `long-text`    | `ui/popover` + `ui/textarea`, 300 ms debounced auto-save, Ctrl/Cmd+Enter to commit, Escape to revert         |
| `number`       | native `<input type="number">` with `min`/`max`/`step` from `meta.cell`                                     |
| `url`          | `contenteditable` when editing; `<a target="_blank" rel="noopener noreferrer">` when not; `getUrlHref` blocks `javascript:`/`data:`/`vbscript:`/`file:` |
| `checkbox`     | `ui/checkbox`; toggles on click/Space/Enter with **no** edit mode                                           |
| `select`       | `ui/select` + `ui/badge` for the resting display                                                            |
| `multi-select` | `ui/popover` + `ui/command` + `ui/badge`, resting display truncated by `ui/badge-overflow`                  |
| `date`         | `ui/popover` + `ui/calendar`; stored as a `YYYY-MM-DD` string via `formatDateToString`/`parseLocalDate`     |
| `file`         | `ui/popover` + `ui/file-upload` (`Dropzone`, `List`, `Item`, `ItemPreview`, `ItemMetadata`, `ItemDelete`) + `ui/skeleton` for in-flight uploads |

**Rationale**: `file-upload` already exports `formatBytes`, `getFileIcon` and a root state that
enforces `accept` / `maxFiles` / `maxSize` — precisely the `CellOpts` a `file` column declares, so
the file cell composes it instead of re-implementing a dropzone. `badge-overflow` already
implements upstream's `useBadgeOverflow` hook (line-count-aware visible/hidden split), so the
multi-select cell composes it rather than porting the hook again.

**One escape hatch dropped**: upstream seeds the long-text editor with the typed character via
`document.execCommand('insertText', …)` so it joins the textarea's native undo stack.
`execCommand` is deprecated and unimplemented in jsdom; the port sets the value and moves the
caret instead (Divergence 8). Observable behaviour is identical; only the browser-native undo
history inside the textarea differs.

---

## R-10 — Search-match highlight colours

**Decision**: upstream's `bg-yellow-100 dark:bg-yellow-900/30` (match) and `bg-orange-200
dark:bg-orange-900/50` (active match) map to `bg-warning/15` and `bg-warning/35`, using the
`warning` token CLAUDE.md §6 already declares in `src/app.css` for both `:root` and `.dark`.

**Rationale**: Principle VIII forbids raw palette colours and manual `dark:` overrides. `warning` is
the documented mapping for upstream's `orange-*`/`yellow-*`, it flips with the theme automatically,
and two different alpha levels preserve the visual distinction between "a match" and "*the* match"
without inventing a new token.

**Alternatives considered**: adding a dedicated `--highlight` token — rejected, CLAUDE.md says to add
a token only when none of the four status colours fits, and `warning` fits.
