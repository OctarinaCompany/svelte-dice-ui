# Quickstart: Validating the Combobox Port

**Feature**: `026-port-combobox` | **Date**: 2026-07-31

How to prove the port works end to end. Every command is non-interactive and terminates.

## Prerequisites

- Node + `pnpm`, dependencies installed (`pnpm install`). **No new npm dependency is added by this
  feature** — `bits-ui` and `@lucide/svelte` are already in `package.json`.
- The upstream reference at `.reference/diceui` (read-only).

## 1. Type check

```bash
pnpm run check
```

Expected: `svelte-check found 0 errors and 0 warnings`. This is the gate that proves the Root's
`generics="Multiple extends boolean = false"` and `ComboboxValue<Multiple>` narrow correctly through
`$bindable` in both single and multiple compositions (both are exercised by
`combobox.test.svelte` and by the demo route).

## 2. Unit tests

```bash
pnpm run test:unit -- --run
```

Expected: all suites pass, none skipped. `src/lib/components/ui/combobox/combobox.test.ts` must
cover, at minimum, the eight groups listed in `plan.md` → "Test Plan". Spot-check these, which are
the ones most likely to regress:

| Assertion                                                                     | Requirement            |
| ----------------------------------------------------------------------------- | ---------------------- |
| `input` has `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded="false"` when closed, and `aria-controls` equal to the content's id when open | FR-030, US3 §6 |
| `aria-activedescendant` equals the highlighted option's `id` after `ArrowDown` | FR-030                 |
| `Home` / `End` jump to the first / last **visible** option                     | FR-025                 |
| `PageUp`/`PageDown` move the highlight **only** when `modal`                   | FR-026                 |
| `Tab` closes a non-modal popover but is swallowed by a modal one               | FR-029                 |
| `Enter` with an empty filtered list closes and reverts, leaving the value alone | FR-027                 |
| typing `flp` keeps `Kickflip`/`Heelflip` and drops `FS 540` (fuzzy)             | FR-004                 |
| `exactMatch` keeps only substring matches                                      | FR-004                 |
| `onFilter` fully replaces the built-in matcher                                 | FR-006                 |
| `manualFiltering` renders the caller's list verbatim                           | FR-007                 |
| a group and its separator disappear when filtering empties the group           | FR-020                 |
| `<Combobox.Empty>` is `role="status"` + `aria-live="polite"` and appears only when the list is empty | FR-021 |
| multiple: selecting keeps the popover open, clears the input, and adds a badge  | FR-009, FR-010         |
| `ArrowLeft` from an empty input highlights the last badge; `Enter` removes it   | FR-012, FR-013         |
| `Backspace` with typed text removes **no** badge                                | FR-014                 |
| `dir="rtl"` lands on anchor, input, trigger and content                         | FR-038                 |
| `disabled` / `readOnly` suppress value and input changes                        | FR-035, FR-036         |
| every non-root part rendered bare throws `/must be used within/`                | constitution III       |
| `<Combobox.Item value="">` throws `/cannot be an empty string/`                 | spec Edge Cases        |

## 3. Lint and format

```bash
pnpm run format
pnpm run lint
```

Expected: clean. `format` must run first — generated registry output is not Prettier-formatted.

Manual anti-cheat scan (Principle VI — these must all return nothing):

```bash
grep -rn "@ts-ignore\|@ts-expect-error\|eslint-disable\|svelte-ignore\|as any\|: any" \
  src/lib/components/ui/combobox src/routes/docs/components/combobox
grep -rn "\.skip\|\.todo\|\.only" src/lib/components/ui/combobox
```

## 4. Build (proves the demo route)

```bash
pnpm run build
```

Expected: success, including `/docs/components/combobox`.

## 5. Registry

```bash
pnpm run registry:build
```

Expected: `static/r/combobox.json` written. Verify it lists **23** files and no test file:

```bash
node -e "const r=require('./static/r/combobox.json');console.log(r.files.length, r.files.map(f=>f.path||f.target).filter(p=>/test/.test(p)))"
```

Expected output: `23 []`.

Also verify the entry in `registry.json` declares `direction-provider` and `checkbox-group` in
`registryDependencies` — the repo's cross-component-import verifier fails the build otherwise
(see commit `4f81f61`).

## 6. Manual scenarios (optional, against the demo route)

Only if a browser is available; the automated gates above are the authoritative evidence.

1. **Default** — type `kick`, confirm the list narrows, press `Enter`, confirm the input reads
   `Kickflip`, the popover closed, and focus stayed in the input. (US1)
2. **With Groups** — type `540`, confirm only the group containing `FS 540` and its label remain,
   and the separator around the emptied groups is gone. (US4 §1)
3. **With Multiple Selection** — pick three options in a row without the popover closing, confirm
   three badges; press `ArrowLeft` twice from the empty input and confirm the highlight walks
   backwards; press `Enter` and confirm that badge disappears. (US2)
4. **With Debounce** — type quickly, confirm the loading `role="progressbar"` appears, then either
   results or the "No trick found." status. (US4 §3–4)
5. **RTL** — wrap the preview in `<DirectionProvider dir="rtl">` (or set `dir="rtl"` on the root)
   and confirm the anchor, input, trigger and popover all mirror. (US5)

## Definition of done

- [ ] `pnpm run check` — 0 errors, 0 warnings
- [ ] `pnpm run lint` — clean
- [ ] `pnpm run test:unit -- --run` — all pass, none skipped
- [ ] `pnpm run build` — succeeds
- [ ] `pnpm run registry:build` — `static/r/combobox.json` has 23 files, no tests
- [ ] Anti-cheat greps return nothing
- [ ] `specs/026-port-combobox/checklists/requirements.md` fully `- [X]`
