# Quickstart — validating the Gauge port

**Feature**: `008-port-gauge`. Every command here is non-interactive and terminates on its own.

## Prerequisites

- Node 22+, `pnpm` installed, dependencies already present (`pnpm install` if not).
- No new npm dependency is introduced by this feature.
- Working tree owned by the orchestrator: do not run git write commands.

## 1. Quality gates (the acceptance bar — SC-005)

Run in this order from the repo root:

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

All five must be clean. Constitution VII/VIII: a gate made green by `@ts-ignore`,
`@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`, a deleted assertion or
a loosened config is an invalid result.

To iterate on just this component's tests:

```bash
pnpm run test:unit -- --run src/lib/components/ui/gauge/gauge.test.ts
```

`circular-progress.test.ts` must stay green too — it is the regression proof that the shared geometry
module was extended without breaking its first consumer:

```bash
pnpm run test:unit -- --run src/lib/components/ui/circular-progress/circular-progress.test.ts
```

## 2. Regenerate the registry

```bash
pnpm run registry:build
```

Then verify the emitted item (`static/r/gauge.json`):

```bash
node -e "const j=require('./static/r/gauge.json'); console.log(j.name, j.type, j.files.length); j.files.forEach(f=>console.log(' ', f.target));"
```

Expect `gauge registry:ui 9` and these targets:

```text
gauge/index.ts
gauge/gauge.svelte
gauge/gauge-indicator.svelte
gauge/gauge-track.svelte
gauge/gauge-range.svelte
gauge/gauge-value-text.svelte
gauge/gauge-label.svelte
gauge/gauge-combined.svelte
circular-progress/circular-progress.svelte.ts
```

The last entry is deliberate (research.md R-02): it makes a standalone `gauge` install self-contained,
because the arc/ring geometry helpers live in that module. Confirm the alias rewriting worked:

```bash
node -e "const j=require('./static/r/gauge.json'); const f=j.files.find(x=>x.target==='gauge/gauge.svelte.ts'||x.target==='gauge/gauge.svelte'); console.log(/\\\$UI\\\$|\\\$UTILS\\\$/.test(f.content));"
```

`static/r/circular-progress.json` is also regenerated (its module gained the arc helpers) — that is
expected, and its file list is unchanged.

## 3. Scenario checks (map to spec acceptance scenarios)

| Spec scenario | Check                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| US1 #1        | `role="meter"`, `aria-valuenow="45"`, `aria-valuemin="0"`, `aria-valuemax="100"`, value text `45`, range `stroke-dashoffset` = `arcLength · 0.55` |
| US1 #2        | Root `aria-labelledby` equals the `Gauge.Label` element's `id`; label renders below the arc      |
| US1 #3        | No `value` ⇒ `data-state="indeterminate"`, no `aria-valuenow`, no `aria-describedby`, no `data-value`/`data-percentage` |
| US2 #1        | `size={180} thickness={12}` ⇒ `<svg width="180" height="180" viewBox="0 0 180 180">`, `stroke-width="12"` |
| US2 #2        | `startAngle={-90} endAngle={90}` ⇒ single-`A` path, `arcLength = π·radius`, value text `top` = `arcCenterY` px |
| US2 #3        | `startAngle={0} endAngle={360}` ⇒ `d` contains two `A` segments                                  |
| US2 #4        | `getValueText={(v, _min, max) => `${v}/${max}`}` ⇒ text and `aria-valuetext` read `75/100`       |
| US3 #1        | Range class contains `transition-[stroke-dashoffset] duration-700 ease-out`; changing `value` updates only `stroke-dashoffset` |
| US3 #2        | Per-part `class` overrides land on that part only                                                 |
| Edge cases    | Clamping, `max <= min ⇒ min + 1`, invalid `max ⇒ 100`, `thickness >= size ⇒ radius 0`, `startAngle === endAngle` renders, part-outside-root throws `/within/`, RTL geometry identical |

## 4. Visual check of the docs route

```bash
pnpm run build
```

`vite build` prerenders `/docs/components/gauge`; a broken demo fails the build. For a human eye pass,
`pnpm run preview` may be started **manually outside the automated pipeline** (it is a long-running
server and must not be launched by an unattended phase).

The page must contain five `<ComponentPreview>` sections — Default, Sizes, Colors, Variants, Combined —
plus per-part props tables (FR-018, SC-002).

## 5. Consumer-install sanity (optional, non-blocking)

`static/r/gauge.json` is a shadcn-svelte registry item; installing it into a scratch project must write
both the `gauge/` folder and `circular-progress/circular-progress.svelte.ts`, and the project must
type-check with no missing-import errors.
