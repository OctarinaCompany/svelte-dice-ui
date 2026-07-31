# Quickstart: validating the Scroll Spy port

How to prove this feature works end to end. Details of the API live in
[contracts/scroll-spy.api.md](./contracts/scroll-spy.api.md); state shapes live in
[data-model.md](./data-model.md). No implementation code here.

## Prerequisites

- Node + `pnpm` with dependencies already installed (`pnpm install`).
- No new packages are required by this feature — if `pnpm install` wants to add one, the port has
  drifted from the plan.
- Files expected to exist before validation: the eight files under
  `src/lib/components/ui/scroll-spy/` listed in the contract, plus
  `scroll-spy.test.ts` + `scroll-spy.test.svelte`, `src/routes/docs/components/scroll-spy/+page.svelte`,
  and the `scroll-spy` entry in `registry.json`.

## 1. Quality gates (must all be green, in this order)

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

Expected: zero errors and zero warnings from `check`; zero findings from `lint`; every test passing
with none skipped or `.todo`; `build` succeeding including the new demo route.

Anti-cheat: a gate made green by `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`,
`as any`, `.skip`/`.todo`, a deleted assertion, or a config change is an invalid result
(Constitution VI/VII).

## 2. Focused test run for this component

```bash
pnpm run test:unit -- --run src/lib/components/ui/scroll-spy/scroll-spy.test.ts
```

Expected: all groups from plan.md § Testing Strategy pass — rendering/structure, every prop,
uncontrolled, controlled, passive activation, keyboard, RTL, guard rails, teardown, `child` snippet.

Spot-checks that the run is meaningful rather than vacuous:

- The passive-activation group must fail if `pickTopmostEntry` is changed to return the *last*
  intersecting entry instead of the topmost.
- The suppression group must fail if the 500 ms settle window is removed.
- The teardown group must contain a positive pre-unmount assertion (observer callback → value
  changes) before the post-unmount "no further change" assertion, so it cannot pass vacuously.

## 3. Registry build

```bash
pnpm run registry:build
```

Expected: `static/r/scroll-spy.json` is produced, contains all eight component files with `$lib/…`
imports rewritten to registry placeholders, and lists `direction-provider` and `scroller` as
`registryDependencies`. `scroll-spy.test.ts` / `scroll-spy.test.svelte` must **not** appear.

## 4. Demo route review (manual, from the build output)

`pnpm run build` compiling `src/routes/docs/components/scroll-spy/+page.svelte` is the automated
gate. The page must contain four `<ComponentPreview>` sections and five props tables:

| Section          | Mirrors                             | What it demonstrates                                                      |
| ---------------- | ----------------------------------- | ------------------------------------------------------------------------- |
| Default          | `scroll-spy-demo.tsx`               | `offset={16}`, `scrollContainer` bound to the viewport `ref`, 4 sections. |
| Vertical         | `scroll-spy-vertical-demo.tsx`      | `orientation="vertical"`, `offset={10}`, wide sections.                   |
| Controlled       | `scroll-spy-controlled-demo.tsx`    | page-owned `$state` via `bind:value` + `onValueChange`.                   |
| Sticky Layout    | MDX "Sticky Layout" example         | window scrolling (no `scrollContainer`), `sticky top-…` on the nav.       |

Do not start `pnpm dev` to review it — the pipeline is non-interactive (Constitution, Development
Workflow).

## 5. Acceptance mapping

| Spec item        | Where it is proven                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| SC-001 / US1     | Passive-activation tests driving the stubbed `IntersectionObserver` (research R-10).                   |
| SC-002 / US2     | Click tests: `preventDefault`, immediate `data-state="active"`, suppression window under fake timers.  |
| SC-003           | Every prop, callback and data attribute in the contract has at least one assertion.                    |
| SC-004 / US4     | The four demo sections above; `pnpm run build` proves they compile.                                    |
| SC-005 / FR-015  | RTL tests: `dir="rtl"` prop and `<DirectionProvider dir="rtl">` ancestor.                              |
| FR-014           | Guard-rail tests — each part rendered bare throws `/must be used within/`.                             |
| FR-018           | Teardown test — observer disconnected, frame cancelled, timeout cleared on unmount.                    |
