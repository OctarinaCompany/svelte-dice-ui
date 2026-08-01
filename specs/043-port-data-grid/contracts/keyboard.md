# Contract: Keyboard interaction

`Mod` = `Ctrl` on Windows/Linux, `Cmd` on macOS (`event.ctrlKey || event.metaKey`).
"→ inverted" marks bindings whose horizontal direction flips when the resolved direction is `rtl`.

Every row below is a test case in `data-grid.test.ts` (Constitution III, area 2).

## Navigation — a cell is focused, not editing

| Keys                | Action                                                | RTL       |
| ------------------- | ----------------------------------------------------- | --------- |
| `ArrowUp`           | focus one row up, clamped at 0                        | —         |
| `ArrowDown`         | focus one row down, clamped at last row               | —         |
| `ArrowLeft`         | focus previous navigable column, clamped              | → inverted |
| `ArrowRight`        | focus next navigable column, clamped                  | → inverted |
| `Tab`               | focus next navigable cell                             | → inverted |
| `Shift+Tab`         | focus previous navigable cell                         | → inverted |
| `Home`              | first navigable column, same row                      | —         |
| `End`               | last navigable column, same row                       | —         |
| `Mod+Home`          | first row, first navigable column                     | —         |
| `Mod+End`           | last row, last navigable column                       | —         |
| `Mod+ArrowUp`       | first row, same column                                | —         |
| `Mod+ArrowDown`     | last row, same column                                 | —         |
| `Mod+ArrowLeft`     | first navigable column, same row (`home`)             | —         |
| `Mod+ArrowRight`    | last navigable column, same row (`end`)               | —         |
| `PageUp`            | up one page (one viewport of rows)                    | —         |
| `PageDown`          | down one page                                         | —         |
| `Alt+ArrowUp`       | up one page                                           | —         |
| `Alt+ArrowDown`     | down one page                                         | —         |
| `Alt+PageUp`        | left 5 columns (`pageleft`)                           | → inverted |
| `Alt+PageDown`      | right 5 columns (`pageright`)                         | → inverted |

Every move scrolls the target into view (vertically through the virtualizer when the row is not
mounted, horizontally through `scrollCellIntoView` which accounts for pinned-column widths).

## Selection

| Keys                        | Action                                                           | RTL        |
| --------------------------- | ---------------------------------------------------------------- | ---------- |
| `Shift+Arrow*`              | extend the rectangle by one cell from `range.start ?? focusedCell` | → inverted |
| `Mod+Shift+ArrowUp`         | extend to row 0                                                   | —          |
| `Mod+Shift+ArrowDown`       | extend to the last row                                            | —          |
| `Mod+Shift+ArrowLeft`       | extend to the first navigable column                              | → inverted (last column) |
| `Mod+Shift+ArrowRight`      | extend to the last navigable column                               | → inverted (first column) |
| `Mod+A`                     | select every cell of every row                                    | —          |
| `Escape` (selection exists) | clear the selection, keep focus                                   | —          |
| `Escape` (no selection)     | blur the focused cell                                             | —          |
| `Mod+Click`                 | toggle that one cell in/out of the selection                      | —          |
| `Shift+Click`               | rectangle from `focusedCell`; plain focus when there is no anchor  | —          |

`Shift+Tab` is navigation, never selection extension (upstream excludes `Tab` from the shift branch).

## Editing

| Keys                     | Precondition                            | Action                                                        |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------- |
| `Enter`                  | focused, not editing, not `readOnly`    | start editing (`checkbox` toggles instead)                    |
| `F2`                     | idem                                    | start editing                                                 |
| `Space`                  | idem                                    | start editing (`checkbox` toggles)                            |
| printable character      | idem                                    | start editing, seeded with that character (not for `checkbox`) |
| double-click             | idem                                    | start editing                                                 |
| `Enter`                  | editing                                 | commit, exit, focus one row down                              |
| `Mod+Enter`              | editing a `long-text` cell              | commit and close the popover                                  |
| `Tab` / `Shift+Tab`      | editing                                 | commit, exit, focus next/previous cell (→ inverted)           |
| `Escape`                 | editing                                 | discard the in-progress edit, stay focused                    |
| `Shift+Enter`            | focused, `onRowAdd` given, not `readOnly` | add a row below; focus what the callback returns             |
| `Delete` / `Backspace`   | not `readOnly`, selection or focus      | reset every selected cell to its variant's empty value        |
| `Mod+Backspace` / `Mod+Delete` | `onRowsDelete` given, not `readOnly` | delete the selected rows; focus the row now at that index    |

## Clipboard

| Keys      | Precondition                          | Action                                                     |
| --------- | ------------------------------------- | ---------------------------------------------------------- |
| `Mod+C`   | focus exists                          | serialize the selection (or the focused cell) to TSV, write to clipboard, clear cut marks, toast `N cells copied` |
| `Mod+X`   | not `readOnly`                        | same serialization + write, mark the cells cut, toast `N cells cut` |
| `Mod+V`   | `enablePaste`, not `readOnly`         | read the clipboard and run the paste flow (data-model § Paste) |

## Search — requires `enableSearch`

| Keys              | Precondition        | Action                                                  |
| ----------------- | ------------------- | ------------------------------------------------------- |
| `Mod+F`           | anywhere in the grid | toggle the search box open and focus its input          |
| `Enter`           | search open         | advance to the next match, wrapping                     |
| `Shift+Enter`     | search open         | go to the previous match, wrapping                      |
| `Escape`          | search open         | close, clear query and matches, focus the last active match |

While search is open and no cell is editing, the grid swallows `Enter` and `Escape` and passes
nothing else through to navigation.

## General

| Keys      | Action                                  |
| --------- | --------------------------------------- |
| `Mod+/`   | open the keyboard-shortcuts dialog      |
| `Escape`  | close the shortcuts dialog (Dialog owns it) |

## Precedence

Handled in this order by `DataGridState.handleKeydown`, matching upstream:

1. `Mod+F` (when `enableSearch`) — always wins.
2. Search-open branch (`Enter` / `Shift+Enter` / `Escape`), then swallow.
3. `editingCell !== null` → return; the cell variant owns `Enter` / `Tab` / `Escape`.
4. `Mod+Backspace` / `Mod+Delete` row deletion.
5. `focusedCell === null` → return.
6. `Mod+A`, `Mod+C`, `Mod+X`, `Mod+V`.
7. `Delete` / `Backspace` cell clearing.
8. `Shift+Enter` row insertion.
9. The navigation `switch`, then the `shiftKey && key !== 'Tab'` selection-extension branch,
   otherwise clear the selection and navigate.
