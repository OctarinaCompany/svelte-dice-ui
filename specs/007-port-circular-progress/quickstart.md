# Quickstart — validating the Circular Progress port

**Feature**: `007-port-circular-progress` | **Date**: 2026-07-29

How to prove the port works end to end. Everything below is non-interactive and terminating.

## Prerequisites

- Node + `pnpm` with dependencies already installed (`pnpm install` — no new packages are added by this
  feature).
- The component implemented per [plan.md](./plan.md) §Public API and
  [contracts/public-api.md](./contracts/public-api.md).

## 1. Type-check, lint, test, build

Run in this order from the repository root:

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

Expected: zero `svelte-check` errors and warnings, zero Prettier/ESLint findings, every Vitest test in
`src/lib/components/ui/circular-progress/circular-progress.test.ts` passing with none skipped, and a
successful `vite build` including the new docs route.

To run only this component's suite while iterating:

```bash
pnpm run test:unit -- --run src/lib/components/ui/circular-progress/circular-progress.test.ts
```

## 2. Regenerate the registry

```bash
pnpm run registry:build
```

Expected: `static/r/circular-progress.json` exists and inlines all eight source files listed in
[contracts/public-api.md](./contracts/public-api.md) §4, with `$lib/...` imports rewritten to registry
placeholders and no test file included.

Quick check:

```bash
node -e "const r=require('./static/r/circular-progress.json');console.log(r.name, r.files.length, r.files.map(f=>f.path.split('/').pop()).join(' '))"
```

## 3. Scenario checks

Each scenario maps to a user story in [spec.md](./spec.md) and is covered by an automated assertion; the
`+page.svelte` demo route is the visual counterpart.

| # | Scenario (spec)                        | What to assert                                                                                                   | Where                                   |
| - | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| 1 | US1 — determinate ring                 | `value={50}` ⇒ `role="progressbar"`, `aria-valuenow="50"`, `aria-valuemin="0"`, `aria-valuemax="100"`, value text `50%`, range `stroke-dashoffset ≈ circumference * 0.5` | test + "Default" preview                |
| 2 | US1 — endpoints                        | `value={0}` ⇒ `data-state="loading"`, offset = circumference; `value={100}` ⇒ `data-state="complete"`, offset ≈ 0    | test                                    |
| 3 | US1 — custom range                     | `value={25} min={0} max={50}` ⇒ `aria-valuenow="25"`, `aria-valuemax="50"`, value text `50%`                          | test                                    |
| 4 | US1 — `getValueText`                   | `getValueText={(v, _min, max) => `${v} of ${max}`}` ⇒ `aria-valuetext="25 of 50"` and the same rendered text          | test + "Interactive" preview            |
| 5 | US2 — indeterminate                    | no `value` ⇒ `aria-valuenow` **absent**, `data-state="indeterminate"`, `data-value`/`data-percentage` absent, offset ≈ circumference × 0.75, value text empty | test + "Interactive" preview (Indeterminate button) |
| 6 | US2 — reduced motion                   | the range's scoped rule is inside `@media (prefers-reduced-motion: reduce) { animation: none }`                        | source review (jsdom computes no animations) |
| 7 | US3 — size/thickness                   | `size={80} thickness={6}` ⇒ `viewBox="0 0 80 80"`, `width/height="80"`, `r="37"`, `stroke-width="6"`                   | test + "Colors" preview                 |
| 8 | US3 — class merge                      | caller `class` on Track/Range/ValueText appears **alongside** the default classes                                      | test + "Colors" preview                 |
| 9 | US3 — combined form                    | `<CircularProgress.Combined value={60} />` emits the same five `data-slot`s as the manual composition                  | test + "Combined" preview               |
| 10 | Edge — clamping / bounds              | every row of the clamping table in contracts/public-api.md §3                                                         | test                                    |
| 11 | Edge — provider guard                 | each part rendered alone throws `/must be used within/`                                                                | test                                    |
| 12 | FR-021 / SC-005 — RTL                 | `dir="rtl"` render is attribute-identical to the LTR render                                                            | test                                    |

## 4. Visual check of the docs route

`pnpm run build` compiles the route; to look at it, the orchestrator's normal preview flow applies (no dev
server is started as part of this feature's validation). The page must contain exactly four
`<ComponentPreview>` sections — **Default**, **Interactive**, **Colors**, **Combined** — plus props tables
for the root and each part, and must appear in the sidebar at `/docs/components/circular-progress` because
`registry.json` lists the item as `registry:ui` with `name: "circular-progress"`.

## 5. Consumer-install sanity (optional, non-blocking)

The generated `static/r/circular-progress.json` must not reference anything under `src/routes/**` or
`src/lib/components/docs/**` (Constitution V). Verify with:

```bash
node -e "const r=require('./static/r/circular-progress.json');const bad=r.files.filter(f=>/routes\/|components\/docs\//.test(f.content));console.log(bad.length===0?'clean':'LEAKED: '+bad.map(f=>f.path))"
```
