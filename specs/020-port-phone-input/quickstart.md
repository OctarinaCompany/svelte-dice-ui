# Quickstart: validating the Phone Input port

**Feature**: `020-port-phone-input` | Run everything from the repository root, `D:\Code\svelte-dice-ui`.

Design details live in [`plan.md`](./plan.md), [`data-model.md`](./data-model.md) and
[`contracts/`](./contracts). This file is the run/validate guide only.

## Prerequisites

- Node 22+, `pnpm` (the repo's package manager), dependencies installed (`pnpm install`).
- No new packages are needed — the port adds zero dependencies.
- `.reference/diceui` present (read-only) if you want to diff against upstream.

## 1. Type-check and lint

```bash
pnpm run format          # first: generated/CLI output is not prettier-formatted
pnpm run check           # svelte-kit sync && svelte-check — zero errors, zero warnings
pnpm run lint            # prettier --check . && eslint .
```

Expected: clean. A `svelte-check` warning counts as a failure (Principle VII). No `@ts-ignore`,
`eslint-disable`, `svelte-ignore` or `as any` may appear anywhere in the diff.

## 2. Unit tests

```bash
pnpm run test:unit -- --run                                          # whole suite
pnpm run test:unit -- --run src/lib/components/ui/phone-input        # this component only
```

Expected: all green, none skipped or `.todo`. The suite must cover every row of the table in
`plan.md` → Testing Plan; in particular these are the load-bearing assertions:

| Check | Expected |
| --- | --- |
| Type `14085551234` into the field | display `+1 408 555 123 4`, `onValueChange` last called with `+14085551234` |
| Type `+442071234567` | country becomes `GG` with no manual selection — `+44` is shared by `gg`, `im`, `je` and `gb`, and the `US` tie-break is hard-coded to `+1`, so the first entry in display-name order wins |
| Type `+1408…` | country becomes `US`, not another `+1` country |
| Type a letter | it never reaches the display; the DOM value snaps back |
| `Escape` on the open list | list closes, country unchanged, focus on the trigger |
| `Enter` on a highlighted country | list closes, focus moves to the field |
| `<PhoneInput.Field>` with no root | throws `/must be used within/` |
| Inside a `<form>` with `name="phone"` | a hidden input carries the canonical value; without a form, none is rendered |

## 3. Build

```bash
pnpm run build           # vite build, includes every demo route
```

Expected: success, with `/docs/components/phone-input` among the prerendered routes.

## 4. Registry output

```bash
pnpm run registry:build
```

Expected: `static/r/phone-input.json` regenerated, listing the six component files (no test files), with
`$lib/...` imports rewritten to registry placeholders. Sanity check:

```bash
node -e "const r=require('./static/r/phone-input.json'); console.log(r.name, r.files.length, r.registryDependencies)"
```

Expected output: `phone-input 6 [ 'command', 'input', 'popover', 'mask-input', 'checkbox-group' ]`.

## 5. Manual smoke test of the demo route

The pipeline is non-interactive, so **do not start `pnpm dev`**. `pnpm run build` succeeding plus the
unit tests are the acceptance evidence. If a human reviews later, the three sections at
`/docs/components/phone-input` should show:

1. **Default** — empty field with the placeholder `Enter phone number` and a flag-less swatch on the
   trigger; typing digits formats them and selects a country.
2. **Custom Countries** — trigger shows 🇺🇸, field shows `+1 408 555 123 4`, and the dropdown lists only
   United States, Canada, Mexico, Brazil.
3. **With Form** — submitting empty shows validation messages; submitting a number toasts
   `{ "country": "…", "phone": "+…" }`.

## Requirement traceability

| Spec | Validated by |
| --- | --- |
| FR-001, FR-012 | composition + provider-error tests (step 2) |
| FR-002, FR-007 | controlled/uncontrolled tests for both value and country (step 2) |
| FR-003 | formatting/normalisation tests + the engine contract tables (step 2) |
| FR-004 | `getCountries()` shape/ordering test; Custom Countries demo (steps 2, 5) |
| FR-005 | detection tests incl. the `+1`→US tie-break and both quirks (step 2) |
| FR-006, FR-011 | dropdown search/keyboard/focus-return tests (step 2) |
| FR-008 | `disabled`/`readOnly`/`data-*` tests (step 2) |
| FR-009 | hidden-input form tests (step 2) |
| FR-010 | ARIA tests (step 2) |
| FR-013 | `dir="rtl"` test (step 2) |
| FR-014 | registry build + demo route build (steps 3, 4) |
