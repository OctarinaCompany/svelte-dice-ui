# Implementation Plan: Responsive Dialog

**Branch**: `027-port-responsive-dialog` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/027-port-responsive-dialog/spec.md`

## Summary

`ResponsiveDialog` is a thin, stateful switch: one composition that renders the already-ported
`Dialog` above a pixel breakpoint and the already-ported `Drawer` below it. Upstream implements the
switch with a hand-rolled `useSyncExternalStore` pub/sub store plus three ref helper hooks
(`useLazyRef`, `useAsRef`, `useIsomorphicLayoutEffect`) — React-only plumbing for tearing-free
external state. Svelte needs none of it: a single `ResponsiveDialogState` class in
`responsive-dialog.svelte.ts`, published on a `Symbol` context key, gives every part synchronous
access to `open` and `variant`.

The technical approach is therefore:

1. Port `use-mobile.ts` first as a standalone reusable rune at `src/lib/hooks/is-mobile.svelte.ts`
   (`useIsMobile()` / `IsMobile`), backed by `window.matchMedia('(max-width: <bp - 1>px)')` with an
   `$effect`-registered `change` listener and an SSR-safe `false` seed (FR-007).
2. Build `ResponsiveDialogState` on top of it: `open` (controlled/uncontrolled via `$bindable`),
   `variant = $derived(isMobile ? 'drawer' : 'dialog')`, and a variant-scoped `setOpen(next, from)`
   that ignores callbacks arriving from a branch that is no longer the active one.
3. Render the root as `{#if variant === 'drawer'}<Drawer.Root>…{:else}<Dialog.Root>…{/if}`, each branch
   rendering the same `children` snippet, and give each of the nine parts a two-branch pass-through
   to its `Dialog.*` / `Drawer.*` counterpart carrying `data-variant` and `data-slot`.
4. Add the one behaviour neither primitive owns: re-establishing focus inside the newly mounted
   content when the breakpoint is crossed while open (FR-008). A jsdom spike (see
   [research.md](./research.md), R-04) proved this is required — after the swap `document.activeElement`
   is `<body>`.

Everything else — focus trapping, escape handling, portalling, scroll lock, `aria-labelledby` /
`aria-describedby` wiring, RTL — comes free from `bits-ui` (Dialog) and `vaul-svelte` (Drawer)
through the existing `$lib/components/ui/dialog` and `$lib/components/ui/drawer` components.

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`) + Svelte 5.56 with runes forced
on repo-wide (`vite.config.ts`)

**Primary Dependencies**: `bits-ui` ^2.18.1 (via `$lib/components/ui/dialog`), `vaul-svelte`
1.0.0-next.7 (via `$lib/components/ui/drawer`), `tailwindcss` ^4.3.3, `clsx`/`tailwind-merge` through
`cn()`. **No new npm dependency is added** — `vaul-svelte` (the Svelte counterpart of the `vaul`
package the upstream MDX asks consumers to install) is already a devDependency because `Drawer` is
already installed.

**Storage**: N/A

**Testing**: Vitest 4 (jsdom, `globals: false`, `expect.requireAssertions: true`) +
`@testing-library/svelte` 5 + `@testing-library/user-event` 14. Colocated at
`src/lib/components/ui/responsive-dialog/responsive-dialog.test.ts` with a
`responsive-dialog.test.svelte` composition harness (precedent: `direction-provider.test.svelte`).

**Target Platform**: Browser (SvelteKit SSR + client hydration). The component must not touch
`window` during module evaluation or component init — only inside `$effect`.

**Project Type**: shadcn-svelte registry component (source distribution) + SvelteKit docs site

**Performance Goals**: One `MediaQueryList` listener per mounted root; no polling, no
`ResizeObserver`, no per-frame work. Mode changes cost exactly one primitive swap.

**Constraints**:

- SSR-safe: `isMobile` seeds to `false` (dialog mode) and corrects on the client after the first
  effect — this is upstream's own behaviour (`!!undefined === false`).
- Crossing the breakpoint while open must preserve `open`, must not fire `onOpenChange`, and must
  land focus inside the newly mounted content.
- No `any`, no suppression comments, no config loosening (Principle VI).

**Scale/Scope**: 1 shared hook module, 1 state module, 10 `.svelte` parts, 1 barrel, 1 test file,
1 test harness, 1 demo route (4 previews), 1 `registry.json` entry.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                        |
| ---- | ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$effect`/`$props`/`$bindable` + snippets only; `IsMobile` and `ResponsiveDialogState` live in `.svelte.ts` modules; reactive inputs enter the state class as getter functions.              |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | `responsive-dialog.tsx`, `use-mobile.ts`, `responsive-dialog.mdx` and both `*-demo.tsx` read at the pinned commit; all 10 exported parts, the `breakpoint`/`open`/`defaultOpen`/`onOpenChange` contract, the `data-variant` attribute and the drawer-only `px-4 pb-4` reproduced. Divergences D-01…D-08 recorded in spec Assumptions. |
| III  | Accessibility Is a MUST             | PASS    | WAI-ARIA modal dialog pattern inherited from `Dialog`/`Drawer`; test plan covers roles, `aria-labelledby`/`aria-describedby`, Enter/Space/Tab/Shift+Tab/Escape, focus return to trigger, RTL, and the provider-less throw. |
| IV   | Composition Over Reimplementation   | PASS    | Both branches are existing `src/lib/components/ui/*` components. One bespoke behaviour (swap focus restoration) justified below.                                                                                 |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder, one part per file, `index.ts` barrel with short names + prefixed aliases + prop types, `.js`-suffixed intra-repo imports, exactly one `registry:ui` entry, zero imports from `src/routes/**` or `$lib/components/docs/**`. |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Prop types derived from `ComponentProps<typeof Dialog.X> & ComponentProps<typeof Drawer.X>`; no `any`, no ignore comments, no config edits.                                                                      |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit --run` → `build` scheduled as the final task; no `.skip`/`.todo`.                                                                                                       |
| VIII | Styling Discipline                  | PASS    | Only `cn()` + caller `class` merged last; no colours introduced at all (the parts add no palette classes); `data-slot="responsive-dialog-<part>"` on every part and `data-variant` as the state attribute.       |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/responsive-dialog/+page.svelte` with one `<ComponentPreview>` per upstream demo file (`responsive-dialog-demo`, `responsive-dialog-confirm-demo`) plus the MDX "Variant Styling" example and a controlled example, plus props tables. |
| X    | One Feature Directory Per Component | PASS    | All artifacts under `specs/027-port-responsive-dialog/`; no git write commands; protected paths untouched.                                                                                                       |

**Bespoke behaviour justification (Principle IV)**:

1. **Swap focus restoration** (`ResponsiveDialogState.pendingFocusRestore` + the `$effect` in
   `responsive-dialog-content.svelte`). Primitives evaluated: `bits-ui` `Dialog.Content`
   (`onOpenAutoFocus`, internal focus scope) and `vaul-svelte` `Drawer.Content` / `Drawer.Root`
   (`autoFocus`). Capability lacking: both manage focus **within their own mount lifecycle** — they
   focus on *open*, not on *mount while already open*. When the breakpoint is crossed the old
   primitive is destroyed and the new one mounts with `open` already `true`, which neither treats as
   an open transition. The jsdom spike (research R-04) confirmed `document.activeElement === document.body`
   after the swap, and that `vaul-svelte` does not move focus into the drawer at all
   (`autoFocus` defaults to `false`). ~15 lines of focus code in `Content` is the minimum that
   satisfies FR-008; the alternative (forcing `autoFocus` on the drawer root permanently) would
   change ordinary open behaviour and diverge from upstream.

2. **Variant-scoped `setOpen(next, from)`**. Primitives evaluated: `bind:open` on both roots.
   Capability lacking: a two-way binding cannot distinguish a genuine user close from a callback
   emitted by a branch that is being torn down during the swap; a spurious `false` would violate
   FR-008 ("never force-closes on a breakpoint change") and FR-002 (`onOpenChange` fires only on real
   transitions). The guard is 3 lines and mirrors upstream's own `Object.is` short-circuit in
   `store.setState`.

**Post-design re-check (after Phase 1)**: re-evaluated against `research.md`, `data-model.md` and
`contracts/responsive-dialog.api.md`. All ten verdicts stand. The two findings that emerged during
Phase 0 (R-04 focus restoration, R-05 jsdom body-style leakage) were absorbed as, respectively, a
justified Principle IV exception and test-file hygiene — neither requires a suppression, a config
change, or an API divergence beyond D-01…D-08, which are now recorded in the spec's Assumptions.

Nothing else is bespoke: `IsMobile` is a direct port of upstream's `useIsMobile`, which has no
`bits-ui` equivalent (`bits-ui` exposes no media-query primitive; `runed`'s `MediaQuery` is not a
project dependency and adding it would violate the zero-new-dependency constraint).

## Public API

Every type is exported from `src/lib/components/ui/responsive-dialog/index.ts`. `WithElementRef`,
`WithoutChildrenOrChild` and `cn` come from `$lib/utils.js`.

### Shared reactive primitive — `$lib/hooks/is-mobile.svelte.js`

| Export                                                | Kind     | Signature / shape                                                          | Notes                                                                                          |
| ----------------------------------------------------- | -------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `DEFAULT_MOBILE_BREAKPOINT`                           | const    | `768`                                                                      | Upstream's `useIsMobile(mobileBreakpoint = 768)` default.                                      |
| `IsMobile`                                            | class    | `new IsMobile(getBreakpoint?: () => number)`, field `current: boolean`      | `current` is `$state`; seeded `false` (SSR-safe), corrected in an `$effect` on the client.     |
| `useIsMobile(getBreakpoint?: () => number): IsMobile` | function | Must be called during component initialisation                             | Media query is `(max-width: ${breakpoint - 1}px)`, exactly upstream's string.                  |

### `ResponsiveDialog` (Root) — `responsive-dialog.svelte`

Upstream: `ResponsiveDialogProps extends React.ComponentProps<typeof Dialog> { breakpoint?: number }`.

| Prop                   | Type                              | Default | Bindable | Notes                                                                                          |
| ---------------------- | --------------------------------- | ------- | -------- | ---------------------------------------------------------------------------------------------- |
| `breakpoint`           | `number`                          | `768`   | no       | Viewport width in px at or above which the dialog is used. `@default 768` (upstream JSDoc).    |
| `open`                 | `boolean`                         | —       | **yes**  | Controlled open state. `bind:open` supported; when passed the caller stays authoritative.      |
| `defaultOpen`          | `boolean`                         | `false` | no       | Uncontrolled seed. Ignored once `open` is bound.                                               |
| `onOpenChange`         | `(open: boolean) => void`         | —       | no       | Fires only on a real open↔closed transition — never on a mode swap (FR-002, edge case).        |
| `onOpenChangeComplete` | `(open: boolean) => void`         | —       | no       | Pass-through to whichever root is active, when that root supports it.                          |
| `children`             | `Snippet`                         | —       | no       | Rendered inside the active root.                                                               |
| `...restProps`         | intersection of both roots' props | —       | —        | Spread onto the active root (drawer-only knobs such as `direction` apply in drawer mode only). |

Snippets: `children`. Events/callbacks: `onOpenChange`, `onOpenChangeComplete`.

### Pass-through parts

All nine parts read the context, throw when used outside the root (FR-011), set
`data-slot="responsive-dialog-<part>"`, set `data-variant="dialog" | "drawer"`, merge the caller's
`class` last, and spread `...restProps`. Because `vaul-svelte` re-exports `bits-ui`'s
`DialogTriggerProps`, `DialogCloseProps`, `DialogTitleProps`, `DialogDescriptionProps` and
`DialogPortalProps` verbatim, Trigger/Close/Title/Description/Portal have a **single** prop type that
is valid for both branches.

| Component                       | File                                 | Props type                                                                                  | Snippets           | Notes                                                                                                    |
| ------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `ResponsiveDialogTrigger`       | `responsive-dialog-trigger.svelte`   | `ResponsiveDialogTriggerProps` = `Dialog.TriggerProps` (bits-ui) + `ref` bindable           | `children`, `child` | `child` replaces upstream `asChild` (D-03). `type="button"` default, as `dialog-trigger.svelte`.         |
| `ResponsiveDialogClose`         | `responsive-dialog-close.svelte`     | `ResponsiveDialogCloseProps` = `Dialog.CloseProps`                                          | `children`, `child` | Same in both modes.                                                                                       |
| `ResponsiveDialogPortal`        | `responsive-dialog-portal.svelte`    | `ResponsiveDialogPortalProps` = `Dialog.PortalProps`                                        | `children`         | No DOM of its own → carries no `data-variant` — the underlying portal renders no element; see D-07.    |
| `ResponsiveDialogOverlay`       | `responsive-dialog-overlay.svelte`   | `ResponsiveDialogOverlayProps` = `ComponentProps<Dialog.Overlay> & ComponentProps<Drawer.Overlay>` | —            | Rarely used directly — `Content` renders its own overlay.                                                 |
| `ResponsiveDialogContent`       | `responsive-dialog-content.svelte`   | see below                                                                                    | `children`         | Adds `px-4 pb-4` in drawer mode only (FR-005); owns the swap focus restoration.                            |
| `ResponsiveDialogHeader`        | `responsive-dialog-header.svelte`    | `WithElementRef<HTMLAttributes<HTMLDivElement>>`                                             | `children`         | Renders `Dialog.Header` / `Drawer.Header`.                                                                |
| `ResponsiveDialogFooter`        | `responsive-dialog-footer.svelte`    | `WithElementRef<HTMLAttributes<HTMLDivElement>> & { showCloseButton?: boolean }`             | `children`         | `showCloseButton` (`@default false`) forwarded in dialog mode only (FR-006).                              |
| `ResponsiveDialogTitle`         | `responsive-dialog-title.svelte`     | `ResponsiveDialogTitleProps` = `Dialog.TitleProps`                                           | `children`, `child` | Required for accessibility (composition rules).                                                           |
| `ResponsiveDialogDescription`   | `responsive-dialog-description.svelte` | `ResponsiveDialogDescriptionProps` = `Dialog.DescriptionProps`                             | `children`, `child` | —                                                                                                          |

`ResponsiveDialogContentProps`:

| Prop              | Type                                                        | Default | Bindable | Notes                                                             |
| ----------------- | ----------------------------------------------------------- | ------- | -------- | ------------------------------------------------------------------- |
| `ref`             | `HTMLElement \| null`                                       | `null`  | **yes**  | Bound to the active content element.                              |
| `class`           | `string`                                                    | —       | no       | Merged last, after the drawer-mode `px-4 pb-4`.                   |
| `portalProps`     | `WithoutChildrenOrChild<ComponentProps<typeof Dialog.Portal>>` | —    | no       | Forwarded to the active content's own portal.                     |
| `showCloseButton` | `boolean`                                                   | `true`  | no       | Dialog mode only (`Drawer.Content` has no close button).          |
| `children`        | `Snippet`                                                   | —       | no       | Required — a dialog without content is meaningless.               |

### Context module — `responsive-dialog.svelte.ts`

| Export                                   | Kind     | Shape                                                                                                     |
| ---------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| `ResponsiveDialogVariant`                | type     | `'dialog' \| 'drawer'`                                                                                     |
| `ResponsiveDialogState`                  | class    | `open: boolean` (derived from the getter pair), `variant: ResponsiveDialogVariant` (`$derived`), `setOpen(next, from)`, `pendingFocusRestore` + `consumeFocusRestore()` |
| `setResponsiveDialogContext(state)`      | function | Sets the `Symbol('responsive-dialog')` context                                                             |
| `hasResponsiveDialogContext()`           | function | `boolean`                                                                                                  |
| `getResponsiveDialogContext(part?)`      | function | Throws ``` `<ResponsiveDialog.Content>` must be used within `<ResponsiveDialog.Root>`. ``` when absent      |

### Barrel exports (`index.ts`)

Short names `Root, Trigger, Close, Portal, Overlay, Content, Header, Footer, Title, Description`;
prefixed aliases `ResponsiveDialog, ResponsiveDialogTrigger, …`; all `*Props` types; and the context
helpers + `ResponsiveDialogState` + `ResponsiveDialogVariant` re-exported from the state module.
`useIsMobile` is **not** re-exported from this barrel — it lives at `$lib/hooks/is-mobile.svelte.js`
so other components can consume it without importing a dialog (FR-007).

## Project Structure

### Documentation (this feature)

```text
specs/027-port-responsive-dialog/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── responsive-dialog.api.md
├── checklists/
│   └── requirements.md  # from /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/hooks/
└── is-mobile.svelte.ts                     # ← upstream hooks/use-mobile.ts (registry:hook)

src/lib/components/ui/responsive-dialog/
├── index.ts                                # barrel: short names + prefixed aliases + prop types
├── responsive-dialog.svelte                # Root      ← ResponsiveDialog
├── responsive-dialog-trigger.svelte        #           ← ResponsiveDialogTrigger
├── responsive-dialog-close.svelte          #           ← ResponsiveDialogClose
├── responsive-dialog-portal.svelte         #           ← ResponsiveDialogPortal
├── responsive-dialog-overlay.svelte        #           ← ResponsiveDialogOverlay
├── responsive-dialog-content.svelte        #           ← ResponsiveDialogContent
├── responsive-dialog-header.svelte         #           ← ResponsiveDialogHeader
├── responsive-dialog-footer.svelte         #           ← ResponsiveDialogFooter
├── responsive-dialog-title.svelte          #           ← ResponsiveDialogTitle
├── responsive-dialog-description.svelte    #           ← ResponsiveDialogDescription
├── responsive-dialog.svelte.ts             # state class + Symbol context (replaces the upstream Store)
├── responsive-dialog.test.svelte           # test-only composition harness (NOT in registry.json)
└── responsive-dialog.test.ts               # colocated tests (NOT in registry.json)

src/routes/docs/components/responsive-dialog/
└── +page.svelte                            # 4 <ComponentPreview> sections + props tables

registry.json                               # append exactly one registry:ui entry
```

**Structure Decision**: The folder slug `responsive-dialog` equals the registry item `name` and the
demo route segment `/docs/components/responsive-dialog`, as Principle V and `src/lib/registry.ts`
require. Upstream mapping is 1:1 for all ten exported components
(`.reference/diceui/docs/registry/bases/radix/ui/responsive-dialog.tsx`), with upstream's
`use-mobile.ts` becoming `src/lib/hooks/is-mobile.svelte.ts` and upstream's `use-as-ref.ts`,
`use-lazy-ref.ts`, `use-isomorphic-layout-effect.ts` and the internal `Store` dropped as React-only
plumbing (spec Assumptions). The hook ships **inside the same registry entry** as a
`registry:hook` file (the `hooks` alias `$lib/hooks` already exists in `components.json`), so the
component still appends exactly one `registry:ui` entry while remaining installable standalone.

### Registry entry (to append to `registry.json`)

```jsonc
{
	"name": "responsive-dialog",
	"type": "registry:ui",
	"title": "Responsive Dialog",
	"description": "A dialog that renders as a centered modal on desktop and a bottom drawer on mobile.",
	"registryDependencies": ["dialog", "drawer"],
	"dependencies": ["bits-ui", "vaul-svelte"],
	"files": [
		{ "path": "src/lib/hooks/is-mobile.svelte.ts", "type": "registry:hook" },
		{ "path": "src/lib/components/ui/responsive-dialog/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/responsive-dialog/responsive-dialog.svelte", "type": "registry:ui" }
		// … one entry per remaining part + responsive-dialog.svelte.ts; tests and the harness excluded
	]
}
```

## Implementation phases (what `/speckit-tasks` will expand)

| #   | Deliverable                              | Gate                                                                                                  |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| A   | `src/lib/hooks/is-mobile.svelte.ts`      | Unit-tested through the component tests; SSR-safe, one listener, teardown asserted.                    |
| B   | `responsive-dialog.svelte.ts`            | State class + Symbol context + throwing getter.                                                        |
| C   | Root + 9 parts                           | Every part carries `data-slot` + `data-variant`; `class` merged last.                                  |
| D   | `responsive-dialog.test.svelte` harness  | Composes Root/Trigger/Content/Header/Title/Description/Footer/Close with configurable props.           |
| E   | `responsive-dialog.test.ts`              | The seven test areas below.                                                                            |
| F   | Demo route (4 previews + props tables)   | One preview per upstream demo file + the MDX variant-styling example + a controlled example.           |
| G   | `registry.json` + `pnpm run registry:build` | Output in `static/r/`.                                                                              |
| H   | Quality gates                            | `format` → `check` → `lint` → `test:unit --run` → `build`, all green with zero suppressions.           |

### Test plan (Principle III floor — upstream ships no test file for this component)

1. **Rendering / roles / ARIA** — `role="dialog"` in both modes; `aria-labelledby` → `Title`,
   `aria-describedby` → `Description`, in both modes; accessible name from `Title`.
2. **Every prop** — `breakpoint` (custom value flips the mode at the custom width), `open`,
   `defaultOpen`, `onOpenChange`, `showCloseButton` on `Footer` (dialog only) and on `Content`,
   `class` merged last on every part, `data-variant` on all nine parts, arbitrary `data-*`/`id`
   forwarding, `ref` binding.
3. **Uncontrolled** — `defaultOpen` seeds; trigger click opens; `Close` click closes.
4. **Controlled** — `open` passed makes the caller authoritative (component does not self-close);
   `onOpenChange` fires with `true` then `false`; `bind:open` round-trips.
5. **Keyboard** — `Enter` and `Space` on the trigger open; `Tab` / `Shift+Tab` move within the
   content; `Escape` closes and returns focus to the trigger — asserted in **both** modes.
6. **Breakpoint transition while open** (SC-004, FR-008) — open below the breakpoint, flip the
   media query, then assert: still exactly one `role="dialog"`, the content text is unchanged, the
   variant attribute flipped `drawer` → `dialog`, `onOpenChange` was **not** called again, and
   `document.activeElement` is inside the new content. Repeat in the reverse direction, and once
   while closed (mode flips, trigger then opens the correct primitive).
7. **Guard rails / RTL** — each of the nine parts rendered without a root throws `/must be used within/`;
   with `dir="rtl"` on a wrapper, the composition still opens, labels correctly and closes on
   `Escape` (no horizontal arrow-key semantics exist for this widget — FR-010 is inheritance-only).

Test hygiene required by the jsdom spike (research R-05): an `afterEach` in this file resets
`document.body.style` (`pointerEvents`, `overflow`, `paddingRight`, `marginRight`) because the
scroll-lock layers of `bits-ui` and `vaul-svelte` leak body styles between tests in jsdom. That is
test-file hygiene, not a config change or a suppression.

## Complexity Tracking

> No constitution violations. The two bespoke behaviours are justified inline under the Constitution
> Check (Principle IV) rather than carried forward as violations, and Principles II, VI and VII are
> PASS.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | None      | —          | —                                      |
