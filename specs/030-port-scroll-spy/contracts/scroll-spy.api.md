# Contract: `scroll-spy` public surface

The interface this feature exposes is (a) the barrel
`src/lib/components/ui/scroll-spy/index.ts` and (b) the DOM it renders. Both are copied verbatim
into consumer repositories by the shadcn-svelte registry, so both are the contract.

## 1. Barrel exports — `$lib/components/ui/scroll-spy/index.js`

```ts
// components — short names (namespace style) + prefixed aliases
export {
	Root, Nav, Link, Viewport, Section,
	//
	Root as ScrollSpy,
	Nav as ScrollSpyNav,
	Link as ScrollSpyLink,
	Viewport as ScrollSpyViewport,
	Section as ScrollSpySection
};

// prop types (one per part) + child-props payloads
export type {
	ScrollSpyRootProps, ScrollSpyProps /* alias of Root */, ScrollSpyChildProps,
	ScrollSpyNavProps, ScrollSpyNavChildProps,
	ScrollSpyLinkProps, ScrollSpyLinkChildProps,
	ScrollSpyViewportProps, ScrollSpyViewportChildProps,
	ScrollSpySectionProps, ScrollSpySectionChildProps
};

// runes module — state, context, defaults
export {
	DEFAULT_OFFSET, DEFAULT_ORIENTATION, DEFAULT_THRESHOLD, SCROLL_SETTLE_DELAY,
	SCROLL_SPY_ORIENTATIONS,
	getDefaultScrollBehavior,
	getScrollSpyContext, setScrollSpyContext,
	ScrollSpyState,
	type ScrollSpyOrientation, type ScrollSpyStateProps
} from './scroll-spy.svelte.js';

// reusable observer module — the stability promise to the `tour` port
export {
	observeSections, pickTopmostEntry, SectionRegistry,
	type SectionObserverOptions
} from './section-observer.svelte.js';
```

Both import styles must work:

```ts
import * as ScrollSpy from '$lib/components/ui/scroll-spy/index.js'; // ScrollSpy.Root, ScrollSpy.Link
import { ScrollSpy, ScrollSpyLink } from '$lib/components/ui/scroll-spy/index.js';
```

## 2. Component props

Authoritative table: see **plan.md § Public API**. Contract-level invariants:

- Every part accepts its element's full `HTMLAttributes` and spreads `...restProps` onto the
  rendered element; `class` is merged **last** via `cn()`.
- `ref` is `$bindable(null)` on every part and stays `null` when `child` is supplied.
- `Link.value` and `Section.value` are **required**; every other prop is optional.
- `value` on the root is `$bindable`; `bind:value` and `value` + `onValueChange` are both supported.
- No prop is renamed relative to upstream except `asChild` → `child` (a snippet) and React's
  `onClick` → Svelte's `onclick`.

## 3. Rendered DOM contract

| Part     | Element  | Required attributes                                                                              | Default classes                                                     |
| -------- | -------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Root     | `div`    | `data-slot="scroll-spy"`, `data-orientation`, `dir`                                              | `flex` + `flex-row` (horizontal) \| `flex-col` (vertical)           |
| Nav      | `nav`    | `data-slot="scroll-spy-nav"`, `data-orientation`, `dir`                                          | `flex gap-2` + `flex-col` (horizontal) \| `flex-row` (vertical)     |
| Link     | `a`      | `data-slot="scroll-spy-link"`, `data-orientation`, `data-state="active"\|"inactive"`, `href="#{value}"` | `rounded px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[state=active]:bg-accent data-[state=active]:text-foreground` |
| Viewport | `div`    | `data-slot="scroll-spy-viewport"`, `data-orientation`, `dir`                                     | `flex flex-1 flex-col gap-8`                                        |
| Section  | `div`    | `data-slot="scroll-spy-section"`, `data-orientation`, `id="{value}"`                             | none (upstream applies none)                                        |

In `child` mode the same attribute payload is handed to the snippet as `props`, **except** that
`Link` omits `href` (upstream line 387: `href={asChild ? undefined : …}`).

`data-state` is the literal string `"active"`/`"inactive"` (not the boolean `'' | undefined` form),
because upstream's `data-[state=active]:` selectors match on the value.

## 4. Behavioural contract

| ID     | Guarantee                                                                                                                        |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| B-01   | Exactly one link carries `data-state="active"` whenever `value` matches one of the rendered links' `value`s.                       |
| B-02   | Clicking a link calls `event.preventDefault()`, then the caller's `onclick`, then sets `value` and scrolls.                        |
| B-03   | `onValueChange` fires for every change to a **truthy** value, from a click or from the observer; never for an equal value.         |
| B-04   | For 500 ms after a click-triggered scroll starts, observer entries do not change `value`.                                          |
| B-05   | The observer activates the intersecting section with the smallest `boundingClientRect.top` that is registered; an empty intersecting set leaves `value` unchanged. |
| B-06   | A section whose `value` is falsy is never registered and can never be activated by the observer.                                   |
| B-07   | Clicking a link whose section is absent from the DOM still sets `value` and fires `onValueChange`, and performs no scroll.         |
| B-08   | Unmounting disconnects the observer, cancels any pending animation frame and clears the settle timeout.                            |
| B-09   | `Nav`/`Link`/`Viewport`/`Section` outside a root throw ``​`<ScrollSpy.{Part}>` must be used within `<ScrollSpy.Root>`.``          |
| B-10   | `dir` resolves as `dir` prop → nearest `<DirectionProvider>` → ambient DOM `dir` → `'ltr'`.                                        |
| B-11   | With `scrollContainer` set, measurement and scrolling target that element; otherwise the window.                                   |
| B-12   | Default `scrollBehavior` is `'auto'` under `prefers-reduced-motion: reduce`, `'smooth'` otherwise.                                 |

## 5. Registry contract — `registry.json`

```jsonc
{
	"name": "scroll-spy",
	"type": "registry:ui",
	"title": "Scroll Spy",
	"description": "Navigation links that track scroll position and scroll to their section on click.",
	"registryDependencies": ["direction-provider", "scroller"],
	"dependencies": [],
	"files": [
		{ "path": "src/lib/components/ui/scroll-spy/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/scroll-spy/scroll-spy.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/scroll-spy/scroll-spy-nav.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/scroll-spy/scroll-spy-link.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/scroll-spy/scroll-spy-viewport.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/scroll-spy/scroll-spy-section.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/scroll-spy/scroll-spy.svelte.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/scroll-spy/section-observer.svelte.ts", "type": "registry:ui" }
	]
}
```

`dependencies` is empty: `bits-ui` is not imported by this component (nothing in it needs a bits-ui
primitive), and `direction-provider` / `scroller` are registry, not npm, dependencies.
`scroll-spy.test.ts` and `scroll-spy.test.svelte` are excluded, per Principle V.

## 6. Docs contract

`src/routes/docs/components/scroll-spy/+page.svelte` — route segment equals the registry `name`,
so the docs sidebar (`src/lib/registry.ts`) links to it by construction. One `<ComponentPreview>`
per upstream example file plus the MDX-only Sticky Layout example, and one props table per part.
