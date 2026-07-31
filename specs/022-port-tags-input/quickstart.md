# Quickstart — validating the `tags-input` port

How to prove this feature works end to end. Run from the repository root. Every command is
non-interactive and terminates.

## Prerequisites

- Node + `pnpm` with dependencies installed (`pnpm install`)
- No new npm dependency is introduced by this feature — `@lucide/svelte`, `bits-ui` and the test stack
  are already present

## 1. Quality gates (the acceptance bar — Constitution VII)

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

All five must succeed with zero errors and zero warnings. A gate made green by `@ts-ignore`,
`eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`, a deleted assertion or a loosened config
is an invalid result.

## 2. Focused test run

```bash
pnpm run test:unit -- --run src/lib/components/ui/tags-input/tags-input.test.ts
```

Expected: every scenario in the coverage plan (research R-19) passes — ARIA wiring, the full keyboard
set, uncontrolled and controlled value, RTL inversion, `disabled`/`readOnly` guard rails, the
provider-error throws, and the spec-specific `max` / `onValidate` / duplicate / `addOnPaste` /
`blurBehavior` / `editable` / `displayValue` / `forceMount` / form cases.

## 3. Demo route

```bash
pnpm run build
```

`vite build` prerenders every docs route, so a broken demo fails the build. To look at it manually the
usual dev server is available, but it is a watch process and must not be started by an automated phase.

The page at `/docs/components/tags-input` must contain four `<ComponentPreview>` sections, one per
upstream demo file (Constitution IX):

| Section         | Mirrors                          | What to check                                                                              |
| --------------- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| Default         | `tags-input-demo.tsx`            | label, wrapping tag list, `Add trick…` input, clear button; `editable` on                   |
| Editable        | `tags-input-editable-demo.tsx`   | three seeded tags, `addOnPaste`, `Clear` rendered as a `Button` through the `child` snippet |
| With Validation | `tags-input-validation-demo.tsx` | `max={6}`, min length 3, `"ollie"` rejected, a toast per rejection                          |
| With Sortable   | `tags-input-sortable-demo.tsx`   | drag or `Alt+Arrow` reordering, with the substitution stated in the description (R-18)      |

Plus one props table per part (Root, Label, Input, Item, ItemText, ItemDelete, Clear) — SC-005.

## 4. Registry item

```bash
pnpm run registry:build
node -e "const r=require('./registry.json'); const i=r.items.find(x=>x.name==='tags-input'); if(!i) throw new Error('missing entry'); console.log(i.files.length, 'files', i.registryDependencies, i.dependencies)"
```

Expected: `10 files [ 'direction-provider', 'checkbox-group' ] [ '@lucide/svelte' ]`, and
`static/r/tags-input.json` regenerated. The repo's cross-component import verifier must stay green —
every `$lib/components/ui/<other>` import needs its `registryDependencies` entry.

## 5. Manual smoke scenarios (mapping to the spec's user stories)

Exercised by the automated tests; listed here as the human-readable acceptance path.

1. **US1 — keyboard add/remove.** Focus the input, type `kickflip`, press `Enter` → a tag appears and
   the input clears. Press `Backspace` → the tag highlights. Press `Backspace` again → it is removed
   and focus is back in the input.
2. **US1 — navigation.** With three tags and an empty input: `ArrowLeft` highlights the last,
   `ArrowLeft` again the middle, `Home` the first, `End` the last, `Escape` clears the highlight. Under
   `dir="rtl"` the two arrow keys swap.
3. **US2 — pointer.** Click one tag's `×` → only that tag goes. Click **Clear** → the list empties,
   `onValueChange` fires with `[]`, and focus lands in the input. With an empty list and no
   `forceMount`, the clear button is not in the document.
4. **US3 — validation.** With `max={2}` and an `onValidate` rejecting short strings: a duplicate, a
   too-short value and a third tag are each rejected, `onInvalid` fires with the offending value, and
   the root carries `data-invalid`. With `addOnPaste`, pasting `a, b, a, ollie` adds only the surviving
   unique values, in one update.
5. **US4 — editing.** With `editable`, double-click a tag → an inline field appears pre-filled and
   selected. Edit and press `Enter` → the tag is replaced in place. Press `Escape` instead → the edit is
   discarded, the tag is highlighted, focus returns to the input. Without `editable`, double-clicking
   does nothing.
6. **Form.** Inside a `<form>` with `name="tags"` and `required`, submitting with zero tags is blocked
   by native validation; after adding one tag, `new FormData(form).get('tags')` returns it.

## 6. Definition of done

- [ ] All five commands in §1 green, nothing suppressed
- [ ] `tags-input.test.ts` covers the six areas of CLAUDE.md §7 plus the spec-specific cases
- [ ] Four `<ComponentPreview>` sections and seven props tables on `/docs/components/tags-input`
- [ ] Exactly one `registry:ui` entry appended, `pnpm run registry:build` run
- [ ] No file touched outside `src/lib/components/ui/tags-input/`,
      `src/routes/docs/components/tags-input/`, `registry.json`, `static/r/`, and this feature directory
