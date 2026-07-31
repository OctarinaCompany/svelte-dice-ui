# Quickstart: verifying the Sortable port

**Feature**: `036-port-sortable` | **Phase**: 1

Everything below is non-interactive and terminates on its own (constitution §Development Workflow).

## Prerequisites

```bash
pnpm install --frozen-lockfile   # nothing new to install — this port adds zero dependencies (R-25)
```

## 1. Quality gates — the definition of done

Run in this order, from the repository root:

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

All five must be clean. Nothing may be made to pass by suppression (constitution VI/VII): no
`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`, and
no config loosening.

## 2. Component tests only, while iterating

```bash
pnpm run test:unit -- --run src/lib/components/ui/sortable
```

Expected: every area of constitution III is covered — see [contracts/sortable-api.md](./contracts/sortable-api.md)
§8–§10 for the exact keyboard, announcement and `data-*` rows the suite asserts, and
[plan.md](./plan.md) §Test plan for the group-by-group breakdown.

## 3. Registry

```bash
pnpm run registry:build
```

Expected: `static/r/sortable.json` is written and contains the nine files listed in
[contracts/sortable-api.md](./contracts/sortable-api.md) §11, with `$lib/...` imports rewritten to
registry placeholders and **no** reference to `sortable.test.ts` or `sortable.test.svelte`.

Verify the item is picked up by the docs index:

```bash
node -e "const r=require('./registry.json');const i=r.items.find(x=>x.name==='sortable');if(!i)throw new Error('missing');console.log(i.type,i.files.length)"
```

Expected output: `registry:ui 9`.

## 4. Build proves the demo route

`pnpm run build` prerenders every docs route. A green build is the evidence that
`/docs/components/sortable` compiles with all six sections
(contracts §12). To eyeball it, the orchestrator does not start a dev server; instead:

```bash
pnpm run build && pnpm run preview --port 4173 &   # only if a human is driving; never in the pipeline
```

## 5. Manual acceptance walkthrough (for a human reviewer, not the pipeline)

At `/docs/components/sortable`:

| Scenario | Steps | Expected |
| -------- | ----- | -------- |
| SC-001 pointer reorder | Press on a card in **Default**, move it past a neighbour, release | The neighbour shifts during the drag; the order is committed on release |
| SC-002 keyboard reorder | `Tab` to a card, `Space`, `ArrowRight`, `Space` | The card moves one position and keeps focus |
| US2 AS-4 cancel | `Space`, `ArrowDown`, `Escape` | The card returns to its original position; nothing is committed |
| SC-003 announcements | Repeat the above with a screen reader, or inspect `[data-slot="sortable-live-region"]` in devtools | Text matches contracts §9 at every step |
| US3 AS-1 handle | In **With Handle**, drag the row body, then the grip button | Only the grip starts a drag |
| US3 AS-2 overlay | Drag in **With Dynamic Overlay** | A floating copy of the dragged card follows the pointer and disappears on drop |
| SC-005 orientation | Switch the **Orientation** section between vertical / horizontal / mixed | Reordering works in all three; arrow keys follow the orientation |
| SC-006 RTL | In the **RTL** section, press `ArrowLeft` on a grabbed item | The item moves toward the visual left |
