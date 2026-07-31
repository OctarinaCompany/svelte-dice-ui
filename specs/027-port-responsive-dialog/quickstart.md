# Quickstart / Validation Guide — Responsive Dialog

How to prove the port works. Details of the API live in
[contracts/responsive-dialog.api.md](./contracts/responsive-dialog.api.md); the reactive entities are
described in [data-model.md](./data-model.md).

## Prerequisites

- Dependencies installed (`pnpm install`). **No new package is required** — `bits-ui` and
  `vaul-svelte` are already devDependencies.
- Files in place per the Project Structure section of [plan.md](./plan.md).

## 1. Compose it

```svelte
<script lang="ts">
	import * as ResponsiveDialog from '$lib/components/ui/responsive-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
</script>

<ResponsiveDialog.Root>
	<ResponsiveDialog.Trigger>
		{#snippet child({ props })}
			<Button variant="outline" {...props}>Edit Profile</Button>
		{/snippet}
	</ResponsiveDialog.Trigger>
	<ResponsiveDialog.Content>
		<ResponsiveDialog.Header>
			<ResponsiveDialog.Title>Edit profile</ResponsiveDialog.Title>
			<ResponsiveDialog.Description>Make changes to your profile here.</ResponsiveDialog.Description>
		</ResponsiveDialog.Header>
		<ResponsiveDialog.Footer>
			<Button type="submit">Save changes</Button>
		</ResponsiveDialog.Footer>
	</ResponsiveDialog.Content>
</ResponsiveDialog.Root>
```

Expected: at a window width ≥ 768px a centered modal opens; below 768px the same markup opens a
bottom drawer. No conditional logic in the consumer (SC-001).

## 2. Run the automated checks

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

All five must be green with zero suppressions (Principle VII). To run only this component's suite:

```bash
pnpm exec vitest --run src/lib/components/ui/responsive-dialog/responsive-dialog.test.ts
```

Note: `[svelte] derived_inert` warnings on stderr during teardown originate in `bits-ui` /
`vaul-svelte` internals and do not fail the run (research R-05).

## 3. Scenario checks the test suite must cover

| # | Scenario                                                                               | Expected                                                                                              | Spec ref            |
| - | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------- |
| 1 | Media query reports desktop; activate the trigger                                      | One `role="dialog"`; every part carries `data-variant="dialog"`                                       | US1-1, FR-001/004   |
| 2 | Media query reports mobile; activate the trigger                                       | One `role="dialog"` from the drawer; parts carry `data-variant="drawer"`                              | US1-2               |
| 3 | Open, then press `Escape`                                                              | Closes; focus back on the trigger — asserted in both modes                                            | US1-3, FR-009       |
| 4 | Compose Header/Title/Description/Footer/Close in both modes                            | `aria-labelledby` → title id, `aria-describedby` → description id; `Close` closes                     | US2-1/2/3           |
| 5 | `defaultOpen` with no `open` prop                                                      | Opens on mount; internal interaction updates it                                                       | FR-002              |
| 6 | `open` passed with `onOpenChange` spy                                                  | Component never moves on its own; the spy fires once per real transition                              | FR-002              |
| 7 | Open below the breakpoint, flip the query above it                                     | Still exactly one `role="dialog"`, same content text, variant now `dialog`, no extra `onOpenChange`, `document.activeElement` inside the new content | US3-1, FR-008, SC-004 |
| 8 | Same crossing under a controlled `open`                                                | The caller's value is respected; no force-close                                                        | US3-2               |
| 9 | Cross the breakpoint while closed, then activate the trigger                           | The mode matching the current viewport opens                                                          | US3-3               |
| 10| `Enter` and `Space` on a focused trigger                                               | Opens, identically to a click                                                                          | Edge case, FR-009   |
| 11| Each of the nine parts rendered with no `Root`                                         | Throws `/must be used within/`                                                                         | FR-011              |
| 12| Wrapper with `dir="rtl"`                                                               | Opens, labels and closes correctly; no direction logic of its own                                     | FR-010              |
| 13| `Content` in drawer mode                                                               | Carries `px-4 pb-4`; a caller `class` still wins                                                       | FR-005              |
| 14| `Footer showCloseButton` in dialog vs drawer mode                                      | Close button in dialog mode only                                                                       | FR-006              |

**Driving the viewport in tests**: stub `window.matchMedia` with `vi.stubGlobal` so it returns a
`MediaQueryList`-shaped object whose `matches` is read from a mutable variable and whose
`addEventListener('change', …)` handlers are collected; a `setViewport(isMobile)` helper flips the
variable and invokes the handlers. This is why the primitive reads `mql.matches` rather than
`window.innerWidth` (research R-01).

**Body-style hygiene**: add an `afterEach` in the test file resetting `document.body.style`
(`pointerEvents`, `overflow`, `paddingRight`, `marginRight`) — the two scroll-lock layers leak these
in jsdom and a leaked `pointer-events: none` makes the next `user.click` throw (research R-05).

## 4. Manual / docs validation

```bash
pnpm run registry:build   # writes static/r/responsive-dialog.json
```

Then open `/docs/components/responsive-dialog` in a browser (a dev server is out of scope for the
unattended pipeline; `pnpm run build` must nonetheless compile the route) and confirm all four
previews render, open, close, and — by resizing the window across 768px with a dialog open — swap
without closing (SC-003, SC-004).
