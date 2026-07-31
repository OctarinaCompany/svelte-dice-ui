# Contract: `media-player` public API

**Feature**: `035-port-media-player` | Source of truth: `.reference/diceui/docs/types/radix/media-player.ts`
plus `.reference/diceui/docs/registry/bases/radix/ui/media-player.tsx` at the pinned commit.

Conventions for every part unless stated otherwise:

- `ref?: HTMLElement | null` — **bindable**, `bind:this` on the rendered element.
- `class?: string` — merged **last** through `cn()`.
- `child?: Snippet<[{ props: Record<string, unknown> }]>` — the `asChild` replacement (R-10).
- `children?: Snippet` — rendered with `{@render children?.()}`.
- `...restProps` — every remaining native attribute, spread onto the rendered element.
- All prop types are exported from `src/lib/components/ui/media-player/index.ts`.

Types marked **bindable** are declared `$bindable`.

---

## 1. Barrel exports (`index.ts`)

| Short name         | Prefixed alias                 | File                                    |
| ------------------ | ------------------------------ | --------------------------------------- |
| `Root`             | `MediaPlayer`                  | `media-player.svelte`                   |
| `Video`            | `MediaPlayerVideo`             | `media-player-video.svelte`             |
| `Audio`            | `MediaPlayerAudio`             | `media-player-audio.svelte`             |
| `Controls`         | `MediaPlayerControls`          | `media-player-controls.svelte`          |
| `ControlsOverlay`  | `MediaPlayerControlsOverlay`   | `media-player-controls-overlay.svelte`  |
| `Loading`          | `MediaPlayerLoading`           | `media-player-loading.svelte`           |
| `Error`            | `MediaPlayerError`             | `media-player-error.svelte`             |
| `VolumeIndicator`  | `MediaPlayerVolumeIndicator`   | `media-player-volume-indicator.svelte`  |
| `Play`             | `MediaPlayerPlay`              | `media-player-play.svelte`              |
| `SeekBackward`     | `MediaPlayerSeekBackward`      | `media-player-seek-backward.svelte`     |
| `SeekForward`      | `MediaPlayerSeekForward`       | `media-player-seek-forward.svelte`      |
| `Seek`             | `MediaPlayerSeek`              | `media-player-seek.svelte`              |
| `Volume`           | `MediaPlayerVolume`            | `media-player-volume.svelte`            |
| `Time`             | `MediaPlayerTime`              | `media-player-time.svelte`              |
| `PlaybackSpeed`    | `MediaPlayerPlaybackSpeed`     | `media-player-playback-speed.svelte`    |
| `Loop`             | `MediaPlayerLoop`              | `media-player-loop.svelte`              |
| `Fullscreen`       | `MediaPlayerFullscreen`        | `media-player-fullscreen.svelte`        |
| `PiP`              | `MediaPlayerPiP`               | `media-player-pip.svelte`               |
| `Captions`         | `MediaPlayerCaptions`          | `media-player-captions.svelte`          |
| `Download`         | `MediaPlayerDownload`          | `media-player-download.svelte`          |
| `Settings`         | `MediaPlayerSettings`          | `media-player-settings.svelte`          |
| `Portal`           | `MediaPlayerPortal`            | `media-player-portal.svelte`            |
| `Tooltip`          | `MediaPlayerTooltip`           | `media-player-tooltip.svelte`           |

Also exported: `MediaPlayerState`, `setMediaPlayerContext`, `getMediaPlayerContext`,
`MEDIA_PLAYER_SPEEDS`, `SEEK_STEP_SHORT`, `SEEK_STEP_LONG`, `formatTime`, and every type in
`data-model.md` §2. `getMediaPlayerContext` replaces upstream's `useMediaPlayer` /
`useMediaPlayerStore` exports.

---

## 2. `Root` — `MediaPlayerRootProps`

`Omit<WithElementRef<HTMLAttributes<HTMLDivElement>>, 'onTimeUpdate' | 'onVolumeChange'>` plus:

| Prop                   | Type                                              | Default          | Bindable |
| ---------------------- | ------------------------------------------------- | ---------------- | -------- |
| `dir`                  | `'ltr' \| 'rtl'`                                  | direction context / DOM / `'ltr'` | no |
| `label`                | `string`                                          | `'Media player'` | no       |
| `tooltipDelayDuration` | `number`                                          | `600`            | no       |
| `tooltipSideOffset`    | `number`                                          | `10`             | no       |
| `autoHide`             | `boolean`                                         | `false`          | no       |
| `disabled`             | `boolean`                                         | `false`          | no       |
| `withoutTooltip`       | `boolean`                                         | `false`          | no       |
| `ref`                  | `HTMLElement \| null`                             | `null`           | **yes**  |

Callbacks: `onPlay?: () => void`, `onPause?: () => void`, `onEnded?: () => void`,
`onTimeUpdate?: (time: number) => void`, `onVolumeChange?: (volume: number) => void`,
`onMuted?: (muted: boolean) => void`, `onMediaError?: (error: MediaError | null) => void`,
`onPipError?: (error: unknown, state: 'enter' | 'exit') => void`,
`onFullscreenChange?: (fullscreen: boolean) => void`.

Snippets: `children`, `child`.

Renders: `<div data-slot="media-player" tabindex={disabled ? undefined : 0}>` with
`aria-labelledby`, `aria-describedby`, `aria-disabled`, `dir`; a `sr-only` label span; a `sr-only`
description span whose text differs for video and audio (FR-004); `{@render children()}`; and its
own `VolumeIndicator` when the tree contains none (R-12). Wrapped in `Tooltip.Provider` (R-11).

Data attributes: `data-slot="media-player"`, `data-state="fullscreen" | "windowed"`,
`data-controls-visible`, `data-disabled`.

---

## 3. Media elements

### `Video` — `MediaPlayerVideoProps` = `WithElementRef<HTMLVideoAttributes>`
### `Audio` — `MediaPlayerAudioProps` = `WithElementRef<HTMLAudioAttributes>`

No own props beyond the conventions. Both set `id={context.mediaId}`, `aria-labelledby`,
`aria-describedby`, `data-slot="media-player-video" | "media-player-audio"`, register themselves as
`state.mediaEl`, and carry the media bindings from R-01. `Video` additionally toggles playback on
`click` (FR-005) and forwards a caller-supplied `onclick` first, respecting `defaultPrevented`.
`<source>` / `<track>` children pass through `children`.

---

## 4. Containers

| Component         | Props type                          | Own props | Data attributes                                                   |
| ----------------- | ----------------------------------- | --------- | ------------------------------------------------------------------ |
| `Controls`        | `MediaPlayerControlsProps`          | —         | `data-slot="media-player-controls"`, `data-state`, `data-visible`, `data-disabled` |
| `ControlsOverlay` | `MediaPlayerControlsOverlayProps`   | —         | `data-slot="media-player-controls-overlay"`, `data-state`, `data-visible` |

Both are `WithElementRef<HTMLAttributes<HTMLDivElement>>`. Hidden via opacity + `pointer-events`,
never `display:none` (FR-006).

---

## 5. Feedback parts

### `Loading` — `MediaPlayerLoadingProps`

| Prop    | Type     | Default | Bindable |
| ------- | -------- | ------- | -------- |
| `delay` | `number` | `500`   | no       |

Renders **nothing** unless `loading && !paused`; the delay applies only once `hasPlayed` is true
(FR-008, SC-004). `role="status"`, `aria-live="polite"`, `data-slot="media-player-loading"`.
Default body: `<Spinner />`.

> Upstream's implementation names this prop `delayMs` while its published type names it `delay`; the
> published type wins (constitution II).

### `Error` — `MediaPlayerErrorProps`

| Prop          | Type                  | Default              | Bindable |
| ------------- | --------------------- | -------------------- | -------- |
| `error`       | `MediaError \| null`  | the media's own error | no      |
| `label`       | `string`              | derived from `error.code` | no  |
| `description` | `string`              | derived from `error.code` | no  |
| `onRetry`     | `() => void`          | `mediaEl.load()`     | no       |
| `onReload`    | `() => void`          | `location.reload()`  | no       |

Renders nothing when there is no error. `role="alert"`, `aria-live="assertive"`,
`aria-labelledby`/`aria-describedby`, `data-slot="media-player-error"`, `data-state`.
Default body: an icon, the label, the description and two `Button`s — "Try again" (`variant="secondary"`)
and "Reload page" (`variant="outline"`) — each `disabled` with a `Spinner` while its action is pending.

Label/description map (verbatim from upstream):

| `MediaError.code`             | Label                   | Description                                    |
| ----------------------------- | ----------------------- | ---------------------------------------------- |
| `MEDIA_ERR_ABORTED` (1)       | `Playback Interrupted`  | `Media playback was aborted`                   |
| `MEDIA_ERR_NETWORK` (2)       | `Connection Problem`    | `A network error occurred while loading the media` |
| `MEDIA_ERR_DECODE` (3)        | `Media Error`           | `An error occurred while decoding the media`   |
| `MEDIA_ERR_SRC_NOT_SUPPORTED` (4) | `Unsupported Format` | `The media format is not supported`            |
| anything else                 | `Playback Error`        | `An unknown error occurred`                    |

### `VolumeIndicator` — `MediaPlayerVolumeIndicatorProps`

No own props. Renders nothing unless `volumeIndicatorVisible`. `role="status"`, `aria-live="polite"`,
`aria-label={`Volume ${muted ? 'muted' : `${percent}%`}`}`,
`data-slot="media-player-volume-indicator"`; shows the volume icon, `Muted` or `{percent}%`, and a
10-bar graph with `ceil(volume * 10)` active bars.

---

## 6. Buttons

All extend `ButtonProps` (`variant="ghost" size="icon"`, `type="button"`, `aria-controls={mediaId}`,
`class="size-8"`), all honour `disabled || context.disabled`, all expose `data-disabled`, and all are
wrapped in `MediaPlayerTooltip`.

| Component      | Own props                  | `aria-label`                          | `aria-pressed` | `data-slot`                  | `data-state`   | Tooltip / shortcut          |
| -------------- | -------------------------- | ------------------------------------- | -------------- | ---------------------------- | -------------- | --------------------------- |
| `Play`         | —                          | `Play` / `Pause`                      | `!paused`      | `media-player-play-button`   | `off` / `on`   | Play·Pause / `Space`        |
| `SeekBackward` | `seconds?: number = 5`     | `Back {seconds} seconds`              | —              | `media-player-seek-backward` | —              | `Back {n}s` / `←` or `Shift ←` |
| `SeekForward`  | `seconds?: number = 10`    | `Forward {seconds} seconds`           | —              | `media-player-seek-forward`  | —              | `Forward {n}s` / `→` or `Shift →` |
| `Loop`         | —                          | `Enable loop` / `Disable loop`        | `loop`         | `media-player-loop`          | `off` / `on`   | loop / `R`                  |
| `Fullscreen`   | —                          | `Enter fullscreen` / `Exit fullscreen`| —              | `media-player-fullscreen`    | `off` / `on`   | Fullscreen / `F`            |
| `PiP`          | `onPipError?`, `children?: Snippet<[boolean]>` | `Enter pip` / `Exit pip` | —      | `media-player-pip`           | `off` / `on`   | Picture in picture / `P`    |
| `Captions`     | —                          | `Enable captions` / `Disable captions`| `captionsActive` | `media-player-captions`    | `off` / `on`   | Captions / `C`              |
| `Download`     | —                          | `Download`                            | —              | `media-player-download`      | —              | Download / `D`              |

`PiP`'s `children` snippet receives the current PiP state, replacing upstream's
`children?: (isPictureInPicture: boolean) => ReactNode` render prop.

---

## 7. `Seek` — `MediaPlayerSeekProps`

`Omit<Slider.RootProps, 'type' | 'value' | 'onValueChange' | 'onValueCommit' | 'min' | 'max' | 'step' | 'dir' | 'children'>` plus:

| Prop                       | Type                                              | Default   | Bindable |
| -------------------------- | ------------------------------------------------- | --------- | -------- |
| `withTime`                 | `boolean`                                         | `false`   | no       |
| `withoutChapter`           | `boolean`                                         | `false`   | no       |
| `withoutTooltip`           | `boolean`                                         | `false`   | no       |
| `tooltipThumbnailSrc`      | `string \| ((time: number) => string)`            | —         | no       |
| `tooltipTimeVariant`       | `'current' \| 'progress'`                         | `'current'` | no     |
| `tooltipSideOffset`        | `number`                                          | root's `tooltipSideOffset` | no |
| `tooltipCollisionBoundary` | `Element \| Element[]`                            | the root element | no  |
| `tooltipCollisionPadding`  | `number \| Partial<Record<'top'\|'right'\|'bottom'\|'left', number>>` | `10` | no |
| `disabled`                 | `boolean`                                         | root's `disabled` | no |

`aria-controls={mediaId}`, `aria-valuetext={`${current} of ${duration}`}`, `data-slider=""`,
`data-hovering`, `data-disabled`. Slots: `media-player-seek-container`, `media-player-seek`,
`media-player-seek-buffered`, `media-player-seek-hover-range`,
`media-player-seek-chapter-separator`, `media-player-seek-thumbnail`,
`media-player-seek-chapter-title`, `media-player-seek-time`.

`withTime` wraps the slider between a current-time and a remaining-time `span`. Chapter separators
appear only when more than one chapter cue exists and `withoutChapter` is false.

## 8. `Volume` — `MediaPlayerVolumeProps`

Same `Slider.RootProps` omission set, plus `expandable?: boolean = false`. Renders a mute `Button`
(`data-slot="media-player-volume-trigger"`, `aria-label` `Mute`/`Unmute`, `aria-pressed={muted}`,
`data-state`) and the slider (`data-slot="media-player-volume"`, `data-slider=""`, `min=0 max=1
step=0.1`, `aria-valuetext={`${percent}% volume`}`) inside
`data-slot="media-player-volume-container"`. `expandable` collapses the slider to `w-0 opacity-0`
until the container is hovered or focus-within.

## 9. `Time` — `MediaPlayerTimeProps`

| Prop      | Type                                     | Default      | Bindable |
| --------- | ---------------------------------------- | ------------ | -------- |
| `variant` | `'progress' \| 'remaining' \| 'duration'`| `'progress'` | no       |

`data-slot="media-player-time"`, `data-variant`, `dir`. `progress` renders
`<span>{current}</span><span role="separator" aria-hidden="true">/</span><span>{duration}</span>`.

---

## 10. Menus

### `PlaybackSpeed` — `MediaPlayerPlaybackSpeedProps`

| Prop           | Type                         | Default                          | Bindable |
| -------------- | ---------------------------- | -------------------------------- | -------- |
| `open`         | `boolean`                    | `defaultOpen`                    | **yes**  |
| `defaultOpen`  | `boolean`                    | `false`                          | no       |
| `onOpenChange` | `(open: boolean) => void`    | —                                | no       |
| `modal`        | `boolean`                    | `false`                          | no       |
| `sideOffset`   | `number`                     | `10`                             | no       |
| `speeds`       | `number[]`                   | `[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]` | no  |
| `disabled`     | `boolean`                    | root's `disabled`                | no       |

Trigger shows `{playbackRate}x`; the menu lists each speed with a check on the active one. Opening
sets `state.menuOpen`. `data-slot="media-player-playback-speed"` (additive — upstream sets none).

### `Settings` — `MediaPlayerSettingsProps`

Everything in `MediaPlayerPlaybackSpeedProps` plus:

| Prop                | Type                                      | Default     | Bindable |
| ------------------- | ----------------------------------------- | ----------- | -------- |
| `renditions`        | `MediaPlayerRendition[]`                  | `[]`        | no       |
| `renditionId`       | `string \| undefined`                     | `undefined` (= Auto) | **yes** |
| `onRenditionChange` | `(renditionId: string \| undefined) => void` | —        | no       |

Menu: `Speed` submenu (Badge shows `{rate}x`), `Quality` submenu (video + non-empty `renditions`
only; `Auto` first, then renditions sorted by height descending, labelled `{height}p` → `{width}p` →
`id`), `Captions` submenu (Badge shows the active track's label or `Off`; items: `Off`, then each
subtitle track, or a single disabled `No captions available`). `aria-label="Settings"`,
`data-slot="media-player-settings"`.

---

## 11. `Portal` and `Tooltip`

### `Portal` — `MediaPlayerPortalProps`

| Prop        | Type                                  | Default                     |
| ----------- | ------------------------------------- | --------------------------- |
| `container` | `Element \| DocumentFragment \| null` | `context.portalContainer`   |
| `children`  | `Snippet`                             | —                           |

Renders nothing when no container is resolved.

### `Tooltip` — `MediaPlayerTooltipProps`

| Prop            | Type                   | Default                        |
| --------------- | ---------------------- | ------------------------------ |
| `tooltip`       | `string`               | —                              |
| `shortcut`      | `string \| string[]`   | —                              |
| `delayDuration` | `number`               | root's `tooltipDelayDuration`  |
| `sideOffset`    | `number`               | root's `tooltipSideOffset`     |
| `children`      | `Snippet`              | —                              |

Renders `{@render children()}` bare when `withoutTooltip` is set or neither `tooltip` nor `shortcut`
is given. Shortcuts render as `<kbd data-slot="kbd"><abbr title={key}>{key}</abbr></kbd>`.

---

## 12. Keyboard contract (root, FR-023)

| Key(s)         | Effect                                                    | Guard                          |
| -------------- | --------------------------------------------------------- | ------------------------------ |
| `Space`, `K`   | toggle play/pause                                          | —                              |
| `ArrowRight`   | seek +5s                                                   | video, or audio with `Shift`   |
| `ArrowLeft`    | seek −5s                                                   | video, or audio with `Shift`   |
| `L` / `J`      | seek +10s / −10s                                           | —                              |
| `0`–`9`        | seek to 0 %–90 % of duration                               | —                              |
| `Home` / `End` | seek to start / end                                        | —                              |
| `ArrowUp` / `ArrowDown` | volume ±10 % + flash the volume indicator         | video only                     |
| `M`            | toggle mute (+ indicator on video)                         | —                              |
| `R`            | toggle loop                                                | —                              |
| `F`            | toggle fullscreen                                          | —                              |
| `Escape`       | exit fullscreen                                            | while fullscreen               |
| `<` / `>`      | step playback speed down / up                              | —                              |
| `C`            | toggle captions                                            | video with ≥ 1 text track      |
| `P`            | toggle Picture-in-Picture                                  | video with the PiP API         |
| `D`            | download the current source                                | a `Download` part is mounted   |

Every shortcut is suppressed while `disabled`, requires the player root or the media element to hold
focus, calls `preventDefault()` only for keys it handles, and runs after any caller `onkeydown`
(skipped when the caller called `preventDefault`).

---

## 13. Error contract

Every non-root part calls `getMediaPlayerContext('<MediaPlayer.Part>')`, which throws

```
`<MediaPlayer.Seek>` must be used within `<MediaPlayer>`.
```

when no provider is present (FR-001). Asserted per constitution III.

---

## 14. Registry entry

```jsonc
{
	"name": "media-player",
	"type": "registry:ui",
	"title": "Media Player",
	"description": "A fully featured media player component supporting video and audio playback with custom controls.",
	"registryDependencies": ["badge", "button", "dropdown-menu", "spinner", "tooltip", "direction-provider"],
	"dependencies": ["bits-ui", "@lucide/svelte"],
	"files": [ /* index.ts, media-player.svelte.ts, time.ts, and all 23 part files */ ]
}
```

Test files (`media-player.test.ts`, `media-player.test.svelte`, `media-player.test-utils.ts`) are
**not** listed.
