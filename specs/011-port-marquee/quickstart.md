# Quickstart: validating the Marquee port

How to prove the port works end to end. Run these in order; each one is non-interactive and
terminates on its own. Nothing here starts a dev server or a watch mode.

## Prerequisites

- Dependencies installed (`pnpm install`) — no new packages are needed for this feature.
- The four component files, `marquee.svelte.ts`, `index.ts`, the demo route, the `src/app.css`
  additions and the `registry.json` entry all in place (see `plan.md` → Deliverables & Sequencing).

---

## 1. Quality gates (the constitutional definition of "done")

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

Expected: five clean exits. `check` must report **zero warnings** as well as zero errors — the
`role="marquee"` + `tabindex` + `onkeydown` combination on the root is the likely source if a11y
warnings appear; the fix is the merged-attribute-spread described in research R-04, never a
`svelte-ignore`.

`test:unit` must show no skipped and no todo tests.

---

## 2. Targeted test run

```bash
pnpm run test:unit -- --run src/lib/components/ui/marquee/marquee.test.ts
```

Expected: all assertions in the ten test areas of `plan.md` → Test Plan pass. Spot-check that the
run includes at least one case from each of: roles/ARIA, keyboard, RTL, guard rails, reduced motion,
`child` composition, `bind:ref`, and the pure helpers.

---

## 3. Registry build

```bash
pnpm run registry:build
```

Expected: exits clean and writes `static/r/marquee.json`. Then verify by inspection that the emitted
item contains:

- six `files` entries with inlined `content`, and **no** test file;
- `registryDependencies: ["direction-provider"]`;
- a `cssVars.theme` block with all six `--animate-marquee-*` variables;
- a `css` block with all six `@keyframes`;
- `$lib/...` imports rewritten to registry placeholders.

```bash
node -e "const i=require('./static/r/marquee.json');console.log(i.files.length,Object.keys(i.cssVars.theme).length,Object.keys(i.css).length)"
```

Expected output: `6 6 6`.

---

## 4. Static verification of the acceptance scenarios

Each scenario in `spec.md` maps to an automated assertion; this table is what to grep for if a
scenario is ever reported as unmet.

| Spec scenario                                 | Where it is proven                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| US1-1 two adjacent copies                     | `marquee.test.ts` — "renders exactly two content tracks" (`allBySlot(container,'marquee-content')`)     |
| US1-2 `autoFill` duplicates to fill           | `marquee.test.ts` — measured-size case with a stubbed `ResizeObserver`; multiplier > 1                  |
| US1-3 reduced motion                          | `marquee.test.ts` — both tracks carry `motion-reduce:animate-none`; item text still present             |
| US2-1 hover pause                             | `marquee.test.ts` — `group` on root, `group-hover:[animation-play-state:paused]` on the tracks          |
| US2-2 Space pauses/resumes with a focus ring  | `marquee.test.ts` — `userEvent.tab()` + `userEvent.keyboard('{ }')`, `data-paused` toggles              |
| US2-3 not tabbable when opted out             | `marquee.test.ts` — `pauseOnKeyboard={false}` ⇒ no `tabindex`, `userEvent.tab()` moves past             |
| US3-1 vertical axis                           | `marquee.test.ts` — `side="top"` ⇒ `data-orientation="vertical"`, `h-full flex-col`                     |
| US3-2 RTL mirroring                           | `marquee.test.ts` — `<DirectionProvider dir="rtl">` ⇒ `animate-marquee-left-rtl`                        |
| US3-3 decorative edges                        | `marquee.test.ts` — `aria-hidden`, `pointer-events-none`, `data-side`, `data-size`                      |
| Edge: `speed={0}`                             | `marquee.test.ts` — finite positive `--marquee-duration`; unit test of `computeMarqueeDuration`         |
| Edge: `loopCount` 0 / `Infinity` / 3          | unit tests of `resolveLoopCount`                                                                        |
| Edge: zero measured size                      | unit test of `computeMarqueeDuration` (unmeasured branch)                                               |
| Edge: no children                             | `marquee.test.ts` — renders without throwing, both tracks empty                                         |

---

## 5. Visual check (optional, non-blocking)

`pnpm run build` already compiles the demo route, which is the gate that matters for CI. If a human
later opens the docs site, `/docs/components/marquee` should show four sections — Default, Logo
Showcase, Vertical Layout, With RTL — each scrolling smoothly with no visible seam, the first pausing
on hover and on Space, and the RTL one scrolling in the mirrored direction. With the OS "reduce
motion" setting on, all four should be static with every item readable.

---

## What "done" means

- All five gate commands green, with no suppression comment anywhere in the diff
  (`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip`, `.todo`).
- `static/r/marquee.json` regenerated.
- `specs/011-port-marquee/` is the only spec directory touched, and no git write command was run —
  the orchestrator commits.
</content>
