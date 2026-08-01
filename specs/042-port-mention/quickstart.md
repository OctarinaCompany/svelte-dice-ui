# Quickstart: validating the Mention port

**Feature**: `042-port-mention` | **Date**: 2026-08-01

How to run and prove the component end to end. See [`contracts/public-api.md`](./contracts/public-api.md)
for the interface and [`data-model.md`](./data-model.md) for the algorithms — neither is repeated here.

## Prerequisites

- `pnpm install` already run; `.reference/diceui` present and untouched.
- Node with `pnpm`; every command below terminates on its own (no watch modes, no dev server).

## Quality gates — the definition of done

Run in this order, from the repository root:

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

All five must be clean. No `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`,
`as any`, `.skip`/`.todo`, or config loosening may be used to get there (Constitution VI/VII).

Run only this component's suite while iterating:

```bash
pnpm run test:unit -- --run src/lib/components/ui/mention/mention.test.ts
```

Rebuild the registry after `registry.json` is edited:

```bash
pnpm run registry:build   # writes static/r/mention.json
```

## Validation scenarios

Each maps to a spec user story and is covered by an automated test; the manual column is how to
confirm the same thing on the demo route.

| # | Scenario | Story | Expected outcome |
| - | -------- | ----- | ---------------- |
| 1 | Focus the field, type `@` | US1 | Popup opens anchored near the caret, all enabled items visible |
| 2 | Continue typing `kck` | US1 / US4 | Only fuzzy-matching items remain |
| 3 | Click an item | US1 | Text becomes `@<label> `, caret sits after the space, focus stays in the field, value list gains the item's `value` |
| 4 | Type `hello @` mid-sentence, pick an item, type ` world` | US1 | Text before the trigger and after the caret is byte-for-byte preserved (SC-005) |
| 5 | Type `contact me at foo@bar.com` | US3 | Popup never opens at the inner `@` (SC-003) |
| 6 | Type `@` then a space | US3 | Popup closes |
| 7 | `ArrowDown` ×2, `ArrowUp`, `Home`, `End`, `Enter` | US2 | Highlight moves one item at a time, jumps to first/last, `Enter` selects the highlighted item (SC-002) |
| 8 | `Escape` with the popup open | US2 | Popup closes, value unchanged, focus still in the field |
| 9 | Inspect the field while open | US2 | `role="combobox"`, `aria-expanded="true"`, `aria-controls` → the listbox id, `aria-autocomplete="list"`, `aria-activedescendant` → the highlighted option id (SC-004) |
| 10 | Caret right after an inserted mention, `Backspace` | US5 | The whole mention text disappears in one step and its value leaves the list (SC-006) |
| 11 | Select a range spanning a mention, `Delete` | US5 | Same, for every overlapping mention |
| 12 | Caret adjacent to a mention, `ArrowLeft`/`ArrowRight` | US5 | Caret jumps over the whole mention |
| 13 | Root with `trigger="#"`, type `@` then `#` | US4 | Only `#` opens the popup |
| 14 | Root with a starts-with `onFilter`, type `re` | US4 | Visible items are exactly the callback's output; `exactMatch` is ignored |
| 15 | Filter down to zero matches | US4 | Popup closes automatically and the highlight clears |
| 16 | Root with `dir="rtl"` | US6 | Field and popup content both carry `dir="rtl"` (SC-008) |
| 17 | Root with `disabled`, then with `readonly` | Edge | Typing changes nothing; `onValueChange` never fires |
| 18 | Render `<Mention.Item>` with no root | Edge | Throws ``` `<Mention.Item>` must be used within `<Mention.Root>`. ``` |
| 19 | Root with `name` inside a `<form>` | Edge | A hidden input submits the comma-joined value list, honouring `disabled`/`required` |

### Test-environment caveats

- **The popup is invisible to `getByRole` in jsdom.** Query `[data-slot="mention-content"]` and
  `[data-slot="mention-item"]`, then assert `role`/`aria-*` with `toHaveAttribute`. Same workaround
  as `combobox.test.ts`.
- **Uncontrolled state must be exercised inside one render** — `rerender()` resets a non-bound
  `$bindable` prop.
- **`expect.requireAssertions` is on**: every `it` must assert at least once, and a teardown test must
  assert something positive (e.g. the observer/listener count), not merely that a callback was not
  called after unmount.
- jsdom performs no layout, so `getCaretRect` returns an all-zero-ish box. Positioning correctness is
  therefore asserted structurally (an anchor object is produced, and it is handed to the content),
  not geometrically.

## Manual check on the demo route

```bash
pnpm run build     # proves the route compiles; the pipeline never starts a dev server
```

Then, in an interactive session outside the pipeline, `/docs/components/mention` shows one section
per upstream example: **Default** (`mention-demo.tsx`), **Custom Trigger**
(`mention-custom-trigger-demo.tsx`), **With Custom Filter** (`mention-custom-filter-demo.tsx`), plus
the API reference tables.

## Installability check (SC-009)

`static/r/mention.json` must, after `pnpm run registry:build`, contain every file of
`src/lib/components/ui/mention/` except the two test files, list `combobox`,
`direction-provider` and `checkbox-group` under `registryDependencies`, and list `bits-ui` under
`dependencies`.
