# Quickstart: validating the Listbox port

Prerequisites: repo dependencies installed (`pnpm install`). All commands run from the repository root and
terminate on their own — no watch modes, no dev server.

## 1. Quality gates (the definition of done)

```bash
pnpm run format                 # first: generator output is not prettier-formatted
pnpm run check                  # svelte-kit sync && svelte-check — 0 errors, 0 warnings
pnpm run lint                   # prettier --check . && eslint .
pnpm run test:unit -- --run     # vitest single run
pnpm run build                  # vite build, includes the new demo route
```

Focused test run while iterating:

```bash
pnpm run test:unit -- --run src/lib/components/ui/listbox/listbox.test.ts
```

No gate may be satisfied by a suppression (`@ts-ignore`, `eslint-disable`, `svelte-ignore`, `as any`,
`.skip`/`.todo`, deleted assertions, loosened config) — see constitution §Quality Gates.

## 2. Registry

```bash
pnpm run registry:build         # after appending the "listbox" entry to registry.json
```

Expected: `static/r/listbox.json` exists, lists the 7 non-test files with inlined content, and contains no
`src/lib/...` import paths (they are rewritten to registry placeholders). See
[contracts/listbox-api.md](./contracts/listbox-api.md) §Registry contract.

## 3. Demo route

`pnpm run build` must compile `src/routes/docs/components/listbox/+page.svelte`, which contains one
`<ComponentPreview>` per upstream example — Default, Horizontal Orientation, Grid Layout, Grouped Items —
plus an API-reference table per part. The docs sidebar links to `/docs/components/listbox` by construction
(slug == registry item name).

## 4. Scenario checks (each maps to a spec user story)

Every scenario below is covered by an automated test in
`src/lib/components/ui/listbox/listbox.test.ts`; the table is the mapping, not a manual script.

| Spec                | Scenario                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| US1 / FR-003–004    | Click an option → sole selection; click it again → selection clears; `Enter`/`Space` equivalent  |
| US2 / FR-005–009    | `multiple`: two clicks → two selections; re-click removes only that one; `aria-multiselectable`  |
| US2 / FR-007        | `Ctrl+A` and `Cmd+A` select every enabled option; no-op in single mode                           |
| US2 / FR-008        | `Shift+ArrowDown` twice grows the range; `Shift+ArrowUp` shrinks it; anchor stays put            |
| US3 / FR-010–021    | `Tab`, `Shift+Tab`, arrows, `Home`/`End`, `PageUp`/`PageDown`, typeahead, `Escape`, disabled skip |
| US3 / FR-017        | The active option holds **real DOM focus** (`toHaveFocus()`), root is the only `tabindex="0"`    |
| US4 / FR-012–013    | `orientation="mixed"` with stubbed item rects: row/column moves and `loop` wrapping              |
| US5 / FR-023–024    | `role="group"` + `aria-labelledby` → label `id`; arrows cross group boundaries                   |
| US6 / FR-028        | `dir="rtl"` prop **and** an ambient `<DirectionProvider dir="rtl">` both invert horizontal arrows |
| Edge cases          | `value=""` throws; disabled root/item guard rails; zero enabled items is a no-op; each part outside its provider throws the documented error |
| FR-026              | `virtual`: state moves, `.focus()`/`.scrollIntoView()` are not called                            |
| FR-027              | Inside a `<form>`, `FormData.getAll(name)` returns the selection; `disabled` suppresses it       |

### jsdom notes that make these deterministic

- `getBoundingClientRect()` returns zeros, so grid tests stub per-item rects through the harness's
  `columns` prop (research R-07). Without the stub every item reports the same `top` and the grid collapses
  to one row.
- `scrollIntoView` and pointer-capture are already shimmed in `tests/setup.ts`.
- Typeahead uses a 1000 ms timer: drive it with `vi.useFakeTimers()` + `userEvent.setup({ advanceTimers })`,
  and assert the buffer reset by advancing past 1000 ms.

## 5. Manual smoke (optional, not part of the gate)

`pnpm run build && pnpm run preview` then open `/docs/components/listbox`: tab into each demo, arrow
through it, type a few letters, and confirm the focus ring follows the active option and the check
indicator appears on selection.
