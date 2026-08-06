---
name: svelte-dice-ui
description: Install and use svelte-dice-ui components — a Svelte 5 port of Dice UI distributed as a shadcn-svelte registry (kanban, data-table, data-grid, sortable, tags-input, file-upload, media-player, tour, stepper, color-picker, phone-input, mention, masonry, marquee, timeline, gauge, and 25 more). Use whenever the project needs a UI component that shadcn-svelte itself does not provide, or when the user mentions svelte-dice-ui, Dice UI, or asks for one of the components listed below.
---

# svelte-dice-ui

A Svelte 5 port of [Dice UI](https://diceui.com), shipped as a **shadcn-svelte registry**: every
component is installed as source into `$lib/components/ui/<slug>/` and owned by the consuming
project. There is no npm package to depend on.

**Requirements:** Svelte 5, SvelteKit 2, Tailwind CSS 4, Node 20+, and a `components.json` at the
project root (i.e. `shadcn-svelte init` has been run).

## Installing a component

Components install by **full URL** — shadcn-svelte 1.x has a single `registry` field in
`components.json` and no support for named registries, so `@dice/kanban`-style specifiers do not
exist. Do not edit `components.json` to point at this registry either: the CLI expects a
`styles/<style>/index.json` layout that this registry does not publish.

```bash
pnpm dlx shadcn-svelte@latest add \
  https://raw.githubusercontent.com/OctarinaCompany/svelte-dice-ui/main/static/r/kanban.json
```

Several at once, in one command:

```bash
pnpm dlx shadcn-svelte@latest add \
  https://raw.githubusercontent.com/OctarinaCompany/svelte-dice-ui/main/static/r/data-table.json \
  https://raw.githubusercontent.com/OctarinaCompany/svelte-dice-ui/main/static/r/tags-input.json
```

Dependencies resolve on their own: shadcn primitives (`button`, `popover`, …) come from the
project's configured registry, and svelte-dice-ui's own dependencies are relative paths inside this
registry. Installing `phone-input` also pulls `mask-input`, `checkbox-group` and
`direction-provider`; installing `data-table` also pulls `sortable`. npm dependencies
(`bits-ui`, `tailwind-variants`, `@lucide/svelte`, `qrcode`, `@tanstack/table-core`, …) are
installed by the CLI when it prompts for a package manager.

The browsable catalogue with descriptions and dependency lists is
`https://raw.githubusercontent.com/OctarinaCompany/svelte-dice-ui/main/static/r/index.json`.

## Theme tokens

Four components use status colours a stock shadcn-svelte theme does not define — `banner`,
`data-grid`, `stat` and `status` need `--success`, `--warning` and/or `--info` with their
`-foreground` companions. They declare those in their registry item, so the CLI writes them into
`src/app.css` on install: the light values into `:root`, the dark values into `.dark`, and the
`--color-*` mappings into `@theme inline` so they flip with the theme like every other token.

Nothing to do by hand. If a component renders uncoloured, the stylesheet did not get patched —
check that `src/app.css` has the usual `:root` / `.dark` / `@theme inline` structure, and copy the
missing variables from the `cssVars` block of
`https://raw.githubusercontent.com/OctarinaCompany/svelte-dice-ui/main/static/r/<slug>.json`.

## Catalogue

| Component            | What it is                                                       |
| -------------------- | ---------------------------------------------------------------- |
| `action-bar`         | A floating bar of contextual actions for selected items.         |
| `angle-slider`       | A circular slider for angles, single value or range.             |
| `badge-overflow`     | Badges that measure available space and collapse the overflow.   |
| `banner`             | A viewport banner with queuing, priority and auto-dismiss.       |
| `checkbox-group`     | A checkbox group with validation and shift-range selection.      |
| `circular-progress`  | A ring progress indicator, determinate or indeterminate.         |
| `color-picker`       | Colour selection across several input methods.                   |
| `color-swatch`       | Displays a colour value, including transparency.                 |
| `data-grid`          | An editable grid: cell selection, clipboard, nine cell variants. |
| `data-table`         | Filtering, sorting and pagination over tabular data.             |
| `direction-provider` | Publishes RTL/LTR to descendants, with a DOM `dir` fallback.     |
| `editable`           | Edit text in place.                                              |
| `file-upload`        | Drag and drop, previews and progress.                            |
| `gauge`              | A value along a configurable arc.                                |
| `kanban`             | A drag-and-drop board with animated reflow.                      |
| `key-value`          | Key–value pairs with paste support.                              |
| `listbox`            | Keyboard-navigable selection lists and grids.                    |
| `marquee`            | Continuous horizontal or vertical scrolling.                     |
| `mask-input`         | Formats input against a pattern.                                 |
| `masonry`            | A responsive masonry layout.                                     |
| `media-player`       | Video and audio with custom controls.                            |
| `mention`            | Suggests and inserts mentions on a trigger character.            |
| `pending`            | Disables interaction and wires ARIA while pending.               |
| `phone-input`        | Country detection and international formatting.                  |
| `qr-code`            | Generates and displays QR codes.                                 |
| `relative-time-card` | Relative time with timezone information.                         |
| `responsive-dialog`  | A modal on desktop, a drawer on mobile.                          |
| `scroll-spy`         | Navigation that tracks scroll position.                          |
| `scroller`           | Scroll shadows and navigation buttons.                           |
| `segmented-input`    | Connected fields as one visual unit.                             |
| `selection-toolbar`  | A toolbar that appears on text selection.                        |
| `sortable`           | Drag-and-drop reordering.                                        |
| `speed-dial`         | A floating button revealing a set of actions.                    |
| `stack`              | Stacked items that fan out on hover.                             |
| `stat`               | A key metric with trend and indicator.                           |
| `status`             | A status badge with an animated ping.                            |
| `stepper`            | Multi-step progress.                                             |
| `swap`               | Swaps between two states on click or hover.                      |
| `tags-input`         | Tags with add, edit and remove.                                  |
| `timeline`           | Chronological events, both orientations.                         |
| `tour`               | A guided tour that highlights elements.                          |

**Not ported** — do not attempt to install these, they do not exist in the registry: `cropper`,
`rating`, `compare-slider`, `avatar-group`, `fps`. Upstream's headless utilities (`portal`,
`presence`, `visually-hidden`, `composition`, `client-only`) have no port either: use Bits UI
portals and visually-hidden, Svelte transitions for presence, the `child` snippet for composition,
and SvelteKit's `browser` flag for client-only.

## Using a component

Every component exports a namespace **and** prefixed aliases. Import with the `.js` extension.

```svelte
<script lang="ts">
	import * as TagsInput from '$lib/components/ui/tags-input/index.js';
	// or: import { TagsInput, TagsInputInput } from '$lib/components/ui/tags-input/index.js';

	let value = $state(['svelte', 'kit']);
</script>

<TagsInput.Root bind:value>
	<TagsInput.Input placeholder="Add a tag…" />
</TagsInput.Root>
```

Conventions that hold across the whole library:

- **Controlled and uncontrolled.** Every value-bearing prop is `$bindable`, so `bind:value` makes the
  parent authoritative; without a binding, `defaultValue` seeds the component and it manages itself.
  `onValueChange` fires in both modes.
- **Compound parts require their root.** Rendering `<TagsInput.Item>` outside `<TagsInput.Root>`
  throws a message naming both — if you see that error, a part escaped its provider.
- **RTL** comes from `<DirectionProvider.Root dir="rtl">`, falling back to the nearest DOM `dir`.
- **Styling** uses shadcn semantic tokens only. `class` from the caller is merged last, so it always
  wins. Every part carries `data-slot="<slug>-<part>"` plus `data-*` state attributes
  (`data-disabled`, `data-state`, `data-orientation`, …) for styling hooks.
- **Snippets, not render props.** Anywhere upstream React took a render prop, this port takes a typed
  `Snippet`.

## Finding a component's exact API

In order of cost:

1. **Read the installed source** — `src/lib/components/ui/<slug>/index.ts` lists every exported
   part, and each part's `Props` type sits in its `<script lang="ts" module>` block with the JSDoc
   for every prop, including `@default`.
2. **Not installed yet?** Fetch
   `https://raw.githubusercontent.com/OctarinaCompany/svelte-dice-ui/main/static/r/<slug>.json` — the
   payload embeds the full source of every file, so the API is readable without installing.
3. **Worked examples** live in the upstream repo's docs site under
   `src/routes/docs/components/<slug>/+page.svelte`, one section per usage pattern.

Never guess a prop name: these components have large APIs and the source is authoritative.

## Known limits

- The upstream test suite runs in jsdom, which computes no layout, runs no animation and resolves no
  media. Anything involving drag geometry, animation, pointer positioning or media playback should
  be checked in a real browser, not just assumed correct.
- `data-grid` and `data-table` are large; prefer `data-table` unless in-cell editing is required.
