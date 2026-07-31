# Contract: `tour` public API

**Feature**: `032-port-tour` | **Date**: 2026-07-31

The interface this registry item exposes to consumers. Anything not listed here is private. This
file is the reference for `/speckit-tasks` and for the demo route's API tables; the prop tables
themselves live in [plan.md § Public API](../plan.md#public-api) and are not duplicated.

---

## 1. Module contract — `$lib/components/ui/tour/index.js`

Both import styles must work, mirroring every other barrel in this repo:

```ts
import * as Tour from '$lib/components/ui/tour/index.js';   // Tour.Root, Tour.Step, Tour.Next …
import { Tour, TourStep, TourNext } from '$lib/components/ui/tour/index.js';
```

| Short name      | Prefixed alias       | File                          |
| --------------- | -------------------- | ----------------------------- |
| `Root`          | `Tour`               | `tour.svelte`                 |
| `Portal`        | `TourPortal`         | `tour-portal.svelte`          |
| `Spotlight`     | `TourSpotlight`      | `tour-spotlight.svelte`       |
| `SpotlightRing` | `TourSpotlightRing`  | `tour-spotlight-ring.svelte`  |
| `Step`          | `TourStep`           | `tour-step.svelte`            |
| `Arrow`         | `TourArrow`          | `tour-arrow.svelte`           |
| `Header`        | `TourHeader`         | `tour-header.svelte`          |
| `Title`         | `TourTitle`          | `tour-title.svelte`           |
| `Description`   | `TourDescription`    | `tour-description.svelte`     |
| `Close`         | `TourClose`          | `tour-close.svelte`           |
| `Footer`        | `TourFooter`         | `tour-footer.svelte`          |
| `StepCounter`   | `TourStepCounter`    | `tour-step-counter.svelte`    |
| `Prev`          | `TourPrev`           | `tour-prev.svelte`            |
| `Next`          | `TourNext`           | `tour-next.svelte`            |
| `Skip`          | `TourSkip`           | `tour-skip.svelte`            |

Plus every `…Props` / `…ChildProps` type, the value types, the constants, the two state classes,
the four context helpers, and the five pure helpers listed in
[plan.md § Exported types and helpers](../plan.md#exported-types-and-helpers-from-indexts).

---

## 2. Composition contract

The documented layout (`tour.mdx` lines 85–106):

```svelte
<Tour.Root>
	<Tour.Portal>
		<Tour.Spotlight />
		<Tour.SpotlightRing />
		<Tour.Step target="#el">
			<Tour.Arrow />
			<Tour.Close />
			<Tour.Header>
				<Tour.Title>…</Tour.Title>
				<Tour.Description>…</Tour.Description>
			</Tour.Header>
			<Tour.Footer>
				<Tour.StepCounter />
				<Tour.Prev />
				<Tour.Next />
				<Tour.Skip />
			</Tour.Footer>
		</Tour.Step>
	</Tour.Portal>
</Tour.Root>
```

Rules:

- **`Tour.Portal` is optional.** The upstream controlled demo omits it entirely; the spotlight, ring
  and steps then render inline. Both arrangements must work.
- **`Tour.Step` may be a direct child of `Tour.Root`** as well as of `Tour.Portal`.
- **Steps are ordered by mount order**, which for sibling steps is document order.
- **`Tour.Arrow` requires a `Tour.Step`**; every other non-root part requires a `Tour.Root`.
- **`Tour.Footer` is dual-purpose**: rendered inside a step it becomes that step's footer and
  suppresses the root's `stepFooter` snippet for that step; rendered *from* the `stepFooter` snippet
  it is the shared default and does not self-register (FR-022).

---

## 3. Behavioural contract

Numbers reference the functional requirements in [spec.md](../spec.md).

| ID     | Guarantee                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------- |
| FR-001 | `open` works uncontrolled (`defaultOpen`, seeded once) and controlled (`bind:open` or `open=` + `onOpenChange`) |
| FR-002 | `value` likewise, with `defaultValue`                                                              |
| FR-003 | Opening spotlights the current step's target and renders that step's card                          |
| FR-004 | `Next` advances; on the last step it fires `onComplete` **once** and closes                        |
| FR-005 | `Prev` goes back and is `disabled` at index `0`                                                    |
| FR-006 | `Skip` and `Close` close and fire `onSkip` (never `onComplete`)                                    |
| FR-007 | `target` accepts a CSS selector or an `HTMLElement`; both resolve identically                      |
| FR-008 | `side`/`align` with collision-aware repositioning, via the same floating layer as `popover`         |
| FR-009 | Root `sideOffset`/`alignOffset` are the per-step defaults; a step's own value wins                 |
| FR-010 | `Tour.Arrow` orients to the **placed** side and hides when it cannot be centred                    |
| FR-011 | `Tab`/`Shift+Tab` cycle only inside the step card                                                  |
| FR-012 | Focus enters the card on open, returns to the pre-open element on close; both preventable          |
| FR-013 | `Escape` closes unless prevented, and never closes while `dismissible={false}`                     |
| FR-014 | A pointer/focus interaction outside the card **and outside the target** closes, unless prevented or non-dismissible |
| FR-015 | `modal` (default `true`) locks background scroll while open, released cleanly on close             |
| FR-016 | A new step auto-scrolls its target into view, honouring `prefers-reduced-motion`                   |
| FR-017 | `scrollOffset` configures the per-edge in-view margin                                              |
| FR-018 | Spotlight cut-out and ring track the target across `resize` and `scroll`                           |
| FR-019 | A step whose target is missing renders nothing (unless `forceMount`) and never throws              |
| FR-020 | `hideWhenDetached` makes the card invisible and inert without unmounting                           |
| FR-021 | `Tour.StepCounter` renders `format(value + 1, stepCount)`; the same numbers drive `Prev`/`Next`    |
| FR-022 | The root's `stepFooter` snippet is the fallback footer for steps without one                       |
| FR-023 | `onStepEnter` / `onStepLeave` fire on the leaving step then the entering step, in that order       |
| FR-024 | `dir="rtl"` mirrors placement, arrow and footer layout                                             |
| FR-025 | Every rendered part accepts a `child` snippet receiving the merged props                           |
| FR-026 | A part used outside its provider throws a message naming the part and the provider                 |
| FR-027 | Installable via `registry.json`, documented at `/docs/components/tour`                             |

---

## 4. `data-*` contract

Consumers style from the outside through these attributes only.

| Part            | Attributes                                                        |
| --------------- | ----------------------------------------------------------------- |
| Root            | `data-slot="tour"`, `dir`                                         |
| Spotlight       | `data-slot="tour-spotlight"`, `data-state="open" \| "closed"`     |
| SpotlightRing   | `data-slot="tour-spotlight-ring"`, `data-state="open" \| "closed"` |
| Step            | `data-slot="tour-step"`, `data-side`, `data-align`, `dir`, `tabindex="-1"` |
| Arrow           | `data-slot="tour-arrow"`                                          |
| Header          | `data-slot="tour-header"`, `dir`                                  |
| Title           | `data-slot="tour-title"`, `dir`                                   |
| Description     | `data-slot="tour-description"`, `dir`                             |
| Footer          | `data-slot="tour-footer"`, `dir`                                  |
| StepCounter     | `data-slot="tour-step-counter"`                                   |
| Close           | `data-slot="tour-close"`, `aria-label="Close tour"`               |
| Prev            | `data-slot="tour-prev"`, `aria-label="Previous step"`, `disabled` |
| Next            | `data-slot="tour-next"`, `aria-label="Next step"`                 |
| Skip            | `data-slot="tour-skip"`, `aria-label="Skip tour"`                 |

`data-side` and `data-align` are emitted by the floating layer with the **placed** values, which may
differ from the requested `side`/`align` after collision avoidance. `data-slot="tour-close"` is
additive — upstream's `TourClose` carries none, and Principle VIII requires one on every part.

---

## 5. Keyboard contract (`tour.mdx` lines 334–353)

| Keys          | Behaviour                                                                            |
| ------------- | ------------------------------------------------------------------------------------ |
| `Escape`      | fires `onEscapeKeyDown`; closes unless prevented or `dismissible={false}`             |
| `Tab`         | next focusable inside the step card; wraps from the last to the first                |
| `Shift`+`Tab` | previous focusable inside the step card; wraps from the first to the last            |
| `Enter`       | activates the focused control (`Next`, `Prev`, `Skip`, `Close`)                      |
| `Space`       | activates the focused control                                                        |

No other key is handled; arrow keys are explicitly **not** step navigation upstream.

---

## 6. Registry contract

```jsonc
{
	"name": "tour",
	"type": "registry:ui",
	"title": "Tour",
	"description": "A guided tour component that highlights elements and provides step-by-step instructions to help users learn about your application.",
	"registryDependencies": ["button", "direction-provider"],
	"dependencies": ["bits-ui", "@lucide/svelte"],
	"files": [ /* the 18 non-test files of src/lib/components/ui/tour/ */ ]
}
```

`description` is upstream's own MDX front-matter description. The test files
(`tour.test.ts`, `tour.test.svelte`) are excluded. `pnpm run registry:build` regenerates
`static/r/tour.json`.
