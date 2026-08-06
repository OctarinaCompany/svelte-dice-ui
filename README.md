# svelte-dice-ui

A Svelte 5 port of [Dice UI](https://diceui.com), distributed as a
[shadcn-svelte](https://shadcn-svelte.com) registry.

Every component ships as **source you own**, not as a dependency. You install it into your own
`$lib/components/ui/` and edit it freely — the same model as shadcn-svelte itself.

[![Svelte 5](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev)
[![SvelteKit 2](https://img.shields.io/badge/SvelteKit-2-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev/docs/kit)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Highlights

- **41 components**, ported one by one from the upstream React source.
- **Svelte 5 runes throughout** — `$state`, `$derived`, `$props`, `$bindable`. No stores, no
  `export let`, no `createEventDispatcher`, no legacy slots.
- **Controlled _and_ uncontrolled** out of the box: every value-bearing prop is `$bindable` and also
  accepts a `defaultValue` plus an `onValueChange` callback.
- **Accessibility is a requirement, not a nice-to-have.** Roles, ARIA wiring, focus management, full
  keyboard support and RTL are ported and tested. Where upstream is weaker than the
  [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/) pattern for a widget, the APG wins.
- **3 800+ tests** covering roles, keyboard, controlled/uncontrolled, RTL and guard rails.
- **Composition over reimplementation** — built on [Bits UI](https://bits-ui.com) and the existing
  shadcn-svelte primitives wherever they already solve the problem.

## Requirements

|              |     |
| ------------ | --- |
| Svelte       | 5   |
| SvelteKit    | 2   |
| Tailwind CSS | 4   |
| Node         | 20+ |

A working shadcn-svelte setup (a `components.json` at your project root) is expected.

## Installation

The built registry lives in `static/r/`, one JSON file per component, and is committed to the
repository. Point the shadcn-svelte CLI at any of those files:

```bash
npx shadcn-svelte@latest add \
  https://raw.githubusercontent.com/OctarinaCompany/svelte-dice-ui/main/static/r/kanban.json
```

Deploy the docs site and `https://<your-host>/r/<component>.json` serves the same files.

Or skip the CLI entirely: copy a component folder straight out of `src/lib/components/ui/`, together
with anything its `registryDependencies` lists. There is nothing clever in the packaging — the files
are the product.

Dependencies resolve automatically — installing `data-table` also pulls in `sortable` and
`direction-provider`.

## Usage

Each component exports both a namespace and prefixed aliases, so either style works:

```svelte
<script lang="ts">
	import * as TagsInput from '$lib/components/ui/tags-input/index.js';

	let value = $state(['svelte', 'kit']);
</script>

<TagsInput.Root bind:value>
	<TagsInput.Input placeholder="Add a tag…" />
</TagsInput.Root>
```

Uncontrolled usage needs no binding at all:

```svelte
<TagsInput.Root defaultValue={['svelte']} onValueChange={(v) => console.log(v)}>
	<TagsInput.Input />
</TagsInput.Root>
```

## Components

Run the docs site (`pnpm dev`) for a live demo page per component, mirroring every upstream example.

| Component            | Description                                                      |
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

## Not ported

Five upstream components are **not** part of this port:

| Component        | What it is                                                                       |
| ---------------- | -------------------------------------------------------------------------------- |
| `cropper`        | Canvas-based image cropping with gesture handling — the largest remaining piece. |
| `rating`         | Star rating with fractional values and keyboard support.                         |
| `compare-slider` | Before/after image comparison with a draggable divider.                          |
| `avatar-group`   | Overlapping avatars with an overflow indicator.                                  |
| `fps`            | A frame-rate meter, primarily a development aid.                                 |

They are simply not done yet rather than deliberately excluded. Contributions are welcome.

Upstream's headless utilities (`portal`, `presence`, `visually-hidden`, `composition`,
`client-only`) have no port either, because Svelte and Bits UI already cover them: portals and
visually-hidden come from Bits UI, `presence` maps onto Svelte transitions, `composition` onto the
`child` snippet used throughout this repo, and `client-only` onto SvelteKit's `browser` flag.

## Development

```bash
pnpm install
pnpm dev              # docs site, with a demo page per component
```

Quality gates — all must pass, and nothing may be suppressed to make them pass:

```bash
pnpm format           # prettier
pnpm check            # svelte-check
pnpm lint             # prettier --check && eslint
pnpm test:unit --run  # vitest
pnpm build
```

`pnpm registry:build` regenerates `static/r/` from `registry.json`.

### Repository layout

```
src/lib/components/ui/<slug>/      one folder per component: parts, <slug>.svelte.ts, index.ts, tests
src/routes/docs/components/<slug>/ the demo page, one section per upstream example
registry.json                      the registry manifest; static/r/ is its build output
.reference/diceui/                 read-only vendored upstream React source
```

Conventions are documented in [`CLAUDE.md`](CLAUDE.md): file layout, the rune patterns, the context
pattern, styling rules, and what every test must cover.

## Contributing

Issues and pull requests are welcome, particularly for the five components listed above.

A port is expected to reproduce upstream's behaviour, accessibility and documented API, ship a demo
page mirroring every upstream example, add a registry entry, and pass the gates without
`@ts-ignore`, `eslint-disable`, `svelte-ignore`, `.skip` or loosened configs.

One caveat worth knowing before you trust a green test run: the suite executes in jsdom, which runs
no CSS engine, computes no animations, resolves no media sources and returns zero-sized layout
boxes. Whole classes of defect are invisible to it — this port has shipped animations that never
ran and drags that never landed, all under a fully green suite. Anything involving animation,
pointer geometry, media playback or layout measurement needs checking in a real browser too.

## Credits

All component design and behaviour originate from [Dice UI](https://diceui.com) by
[Sadman Sakib](https://github.com/sadmann7), MIT licensed. This project is an independent port, not
affiliated with or endorsed by the Dice UI authors.

Built on [shadcn-svelte](https://shadcn-svelte.com), [Bits UI](https://bits-ui.com),
[Tailwind CSS](https://tailwindcss.com) and [TanStack Table](https://tanstack.com/table).

## License

[MIT](LICENSE)
