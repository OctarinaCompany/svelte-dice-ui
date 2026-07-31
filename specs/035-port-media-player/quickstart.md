# Quickstart: validating the Media Player port

**Feature**: `035-port-media-player` | Run everything from the repository root, non-interactively.

Design details live in [`contracts/media-player-api.md`](./contracts/media-player-api.md) and
[`data-model.md`](./data-model.md); this file is the run/verify guide.

## Prerequisites

- Node + `pnpm` already installed (`pnpm install` has been run).
- No new npm dependency is introduced by this feature — `pnpm install` should be a no-op.
- Never start a watch mode, a dev server or a UI runner.

## 1. Quality gates (constitution VII — run in this order)

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

All five must be green with no `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`,
`as any`, or skipped test.

## 2. Focused test run

```bash
pnpm run test:unit -- --run src/lib/components/ui/media-player/media-player.test.ts
```

Expected: every suite below passes.

| Suite                       | Proves                                                                    |
| --------------------------- | -------------------------------------------------------------------------- |
| `rendering & composition`   | root + each part renders, `data-slot` attributes present, `child` snippet replaces the default element |
| `roles & ARIA`              | `aria-labelledby`/`aria-describedby` wiring, `aria-controls`, `aria-pressed`, slider `aria-valuetext`, `role="status"`/`role="alert"` |
| `transport`                 | play/pause toggle, seek ±, seek slider commit, volume + mute, time formatting (US1) |
| `keyboard`                  | one case per row of the keyboard contract §12, including the video/audio `Shift` split and the `disabled` suppression (US2) |
| `feedback`                  | loading delay behaviour, error label/description map + retry/reload, transient volume indicator (US3) |
| `composition & menus`       | speed menu, settings submenus (speed/captions/quality), `renditions` gating (US4) |
| `controlled / uncontrolled` | `defaultOpen` vs `bind:open`; `renditionId` vs `bind:renditionId`; callbacks fire with the right payload |
| `RTL`                       | `dir="rtl"` reaches the root and both sliders; physical key direction is unchanged |
| `guard rails`               | `disabled` blocks pointer and keyboard; every part throws ``must be used within `<MediaPlayer>` `` outside the root |

## 3. Demo route

```bash
pnpm run build     # builds every route, including /docs/components/media-player
```

Then, when a browser is available (not part of the automated gate), open
`/docs/components/media-player` and confirm the six sections mirror upstream:
Default, Audio, Settings menu, HLS, Error handling, Playlist — plus the props tables.

Manual checks that automation cannot cover (they need a real media pipeline):

1. Play the default video; the seek thumb tracks playback and the time display ticks each second.
2. Drag the seek thumb near the player's left/right edge — the hover tooltip stays inside the player.
3. Press `F`, then `Escape`; `data-state` on the root flips `windowed` → `fullscreen` → `windowed`.
4. Press `ArrowUp`/`ArrowDown` on the video; the volume HUD appears and self-dismisses after ~2 s.
5. Open the settings menu on the Settings demo; Speed/Captions/Quality submenus show a check on the
   active entry, and the controls do not auto-hide while the menu is open.
6. Switch the page to `dir="rtl"` (the demo's RTL section); sliders mirror, `ArrowRight` still seeks
   forward.

## 4. Registry

```bash
pnpm run registry:build
```

Expected: `static/r/media-player.json` is written and lists every file of
`src/lib/components/ui/media-player/` except the three test-only files.

Verify the docs index picks it up:

```bash
node -e "const r=require('./registry.json');const i=r.items.find(x=>x.name==='media-player');console.log(i.type, i.files.length, i.registryDependencies.join(','))"
```

Expected: `registry:ui`, a file count matching the folder (26 source files), and
`badge,button,dropdown-menu,spinner,tooltip,direction-provider`.

## 5. Definition of done

- [ ] Five commands in §1 green, nothing suppressed.
- [ ] Every keyboard row in the contract has at least one assertion.
- [ ] Captions/text-track support present (settings submenu + `C` shortcut + `Captions` part).
- [ ] `/docs/components/media-player` renders all six upstream examples plus props tables.
- [ ] `registry.json` has exactly one new `registry:ui` entry and `static/r/media-player.json` exists.
