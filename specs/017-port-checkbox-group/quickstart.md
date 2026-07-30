# Quickstart: validating the Checkbox Group port

Runnable validation for `specs/017-port-checkbox-group`. Every scenario below maps to at least one
colocated assertion in `src/lib/components/ui/checkbox-group/checkbox-group.test.ts`; the demo route is
the manual counterpart. Design detail lives in [data-model.md](./data-model.md) and
[contracts/public-api.md](./contracts/public-api.md) — this file does not repeat it.

## Prerequisites

- Node + `pnpm` installed, dependencies already present (`pnpm install` if the tree is cold).
- No new npm dependency is introduced by this feature.
- Upstream reference available read-only at `.reference/diceui` (never modified).

## Commands (non-interactive only)

```bash
pnpm run format                                   # first: generator output is not prettier-clean
pnpm run check                                    # svelte-kit sync && svelte-check — 0 errors, 0 warnings
pnpm run lint                                     # prettier --check . && eslint .
pnpm run test:unit -- --run                       # vitest, single run, no watch
pnpm run test:unit -- --run src/lib/components/ui/checkbox-group   # this component only, while iterating
pnpm run build                                    # vite build, includes the new docs route
pnpm run registry:build                           # after appending the registry.json entry
```

Never start `pnpm dev`, bare `vitest`, or any `--watch`/UI runner.

## Validation scenarios

| #    | Scenario                       | How to run it                                                                                                  | Expected outcome                                                                                                                                              |
| ---- | ------------------------------ | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V-1  | Roles, names, wiring           | Render Root + Label + Description + List + 3 Items + Message                                                    | `getByRole('group', { name: 'Favorite tricks' })`; each item `role="checkbox"`, `type="button"`, `aria-checked="false"`, `aria-disabled="false"`; `aria-orientation="vertical"` |
| V-2  | No dangling idrefs (R-08)      | Render with, then without, a `Description`; then with `hideOnError` while invalid                               | `aria-describedby` names only rendered ids, and is absent when none is rendered; every id in `aria-labelledby`/`aria-describedby` resolves to an element        |
| V-3  | Uncontrolled                   | `defaultValue={['kickflip']}` + `onValueChange` spy, click "Heelflip"                                           | Kickflip starts checked; callback receives `['kickflip','heelflip']`; both render checked                                                                      |
| V-4  | Controlled, parent accepts     | Harness with `bind:value`                                                                                       | Clicking updates the parent's state and the rendered state together                                                                                            |
| V-5  | Controlled, parent declines    | Harness with `bind:value={() => authoritative, (next) => { received = next; }}`                                 | `onValueChange`/setter receive the next value; **rendered `aria-checked` does not move** (US1 AS-5)                                                            |
| V-6  | Keyboard                       | `user.tab()` ×3, `user.keyboard(' ')`, `user.keyboard('{Enter}')` inside a `<form>`                             | Each item is its own tab stop in document order; `Space` toggles and keeps focus; `Enter` neither toggles nor submits                                          |
| V-7  | One toggle per click (R-06)    | Click the indicator glyph; then click the same item twice                                                       | `onValueChange` called once per click; second click unchecks                                                                                                  |
| V-8  | Validation                     | `onValidate` returning `'Maximum 2 items allowed'`, then `['a','b']`, then `true`                               | Message renders (array joined with a space); group/list/items get `data-invalid` + `aria-invalid`; returning `true` clears message and state                    |
| V-9  | `invalid` prop + empty message | `invalid` with a `<Message />` that has no children and no validation message                                   | `data-invalid` present everywhere; the message region renders nothing (spec edge case)                                                                        |
| V-10 | Guard rails                    | `disabled` group; `readOnly` group with `defaultValue`; each part rendered outside its provider                 | Disabled: every item `disabled`, out of the tab order, no callback. Read-only: `aria-checked` unchanged, no callback, still focusable. Parts throw `/must be used within/` |
| V-11 | Native form                    | `<form>` + `required` (no `name`) submit; then check one and submit; then `name="tricks"` with two checked; then a `type="reset"` button | Empty required submit is blocked (`onSubmit` not called, `form.checkValidity()` false, input `validity.valueMissing`); after checking, submit fires once; `new FormData(form).getAll('tricks')` equals the checked values; reset restores `defaultValue` and clears the message |
| V-12 | Orientation + RTL              | `orientation="horizontal"`; `dir="rtl"`; a `DirectionProvider dir="rtl"` ancestor with no `dir` prop            | `data-orientation`/`aria-orientation` on the group, `data-orientation` on list and items; `dir="rtl"` rendered; provider-resolved direction matches; Tab order and `Space` unchanged |

## Manual check (docs route)

```bash
pnpm run build   # must succeed; the route is statically analysed by the build
```

Then, in a normal (non-agent) session, open `/docs/components/checkbox-group` and confirm the five
previews — **Default, Animated, Horizontal, With Validation, Multi Selection** — are each interactive
with no console error, that the validation preview shows/hides its description via `hideOnError`, and
that the multi-selection preview extends the range when `Shift` is held while focus is inside the list.

## Definition of done

1. V-1…V-12 are covered by passing assertions, none skipped, `expect.requireAssertions` satisfied.
2. All four gates green from a clean tree, with no `@ts-ignore` / `@ts-expect-error` /
   `eslint-disable` / `svelte-ignore` / `as any` / `.skip` / `.todo` anywhere in the diff.
3. `registry.json` has exactly one new `checkbox-group` entry and `pnpm run registry:build` has
   regenerated `static/r/`.
4. `src/routes/docs/components/checkbox-group/+page.svelte` renders one `<ComponentPreview>` per
   upstream demo file plus the seven prop tables.
</content>
