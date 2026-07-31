# Phase 1 Data Model: Media Player

**Feature**: `035-port-media-player` | **Date**: 2026-07-31

All reactive state lives in **one** class, `MediaPlayerState`, in
`src/lib/components/ui/media-player/media-player.svelte.ts`, published on context under a `Symbol`
key. Parts never own playback state; they read this class and call its methods.

---

## 1. `MediaPlayerState`

### 1.1 Constructor inputs (getter functions — never snapshots)

```ts
export type MediaPlayerStateProps = {
	getDir: () => Direction;                  // resolved via useDirection (R-09)
	getLabel: () => string;                   // @default "Media player"
	getDisabled: () => boolean;
	getAutoHide: () => boolean;
	getWithoutTooltip: () => boolean;
	getTooltipDelayDuration: () => number;    // @default 600
	getTooltipSideOffset: () => number;       // @default 10
	mediaId: string;                          // $props.id()
	labelId: string;
	descriptionId: string;
	callbacks: () => MediaPlayerCallbacks;    // onPlay, onPause, onEnded, onTimeUpdate,
	                                          // onVolumeChange, onMuted, onMediaError,
	                                          // onPipError, onFullscreenChange
};
```

### 1.2 Element references

| Field       | Type                                     | Written by                        |
| ----------- | ---------------------------------------- | --------------------------------- |
| `rootEl`    | `HTMLElement \| null`                    | Root (`bind:this`)                |
| `mediaEl`   | `HTMLVideoElement \| HTMLAudioElement \| null` | Video/Audio part (`bind:this`) |

### 1.3 Mirrored media state (`$state`, written by Svelte media bindings — R-01)

| Field          | Type                          | Binding / source                    | Writable from UI |
| -------------- | ----------------------------- | ----------------------------------- | ---------------- |
| `paused`       | `boolean` (init `true`)       | `bind:paused`                       | yes              |
| `currentTime`  | `number` (init `0`)           | `bind:currentTime`                  | yes              |
| `duration`     | `number` (init `NaN`)         | `bind:duration`                     | no               |
| `volume`       | `number` (init `1`)           | `bind:volume`                       | yes              |
| `muted`        | `boolean` (init `false`)      | `bind:muted`                        | yes              |
| `playbackRate` | `number` (init `1`)           | `bind:playbackRate`                 | yes              |
| `buffered`     | `{ start; end }[]`            | `bind:buffered`                     | no               |
| `seekable`     | `{ start; end }[]`            | `bind:seekable`                     | no               |
| `ended`        | `boolean`                     | `bind:ended`                        | no               |
| `readyState`   | `number`                      | `bind:readyState`                   | no               |
| `seeking`      | `boolean`                     | `bind:seeking`                      | no               |
| `loop`         | `boolean`                     | element property + `MutationObserver` on `loop` | yes  |
| `loading`      | `boolean`                     | `waiting`/`stalled` vs `playing`/`canplay`/`seeked`/`error` | no |
| `hasPlayed`    | `boolean`                     | latched on first `play`             | no               |
| `error`        | `MediaError \| null`          | `error` event; cleared on `emptied`/`loadstart` | no   |
| `fullscreen`   | `boolean`                     | `document.fullscreenElement === rootEl` + `fullscreenchange` | yes |
| `pip`          | `boolean`                     | `enter/leavepictureinpicture`       | yes              |
| `textTracks`   | `MediaPlayerTextTrack[]`      | `element.textTracks` + `addtrack`/`removetrack`/`change` | yes (`mode`) |

### 1.4 Derived (`$derived`)

| Field             | Definition                                                                    |
| ----------------- | ----------------------------------------------------------------------------- |
| `isVideo`         | `mediaEl instanceof HTMLVideoElement` (false before mount)                    |
| `seekableStart`   | `seekable[0]?.start ?? 0`                                                     |
| `seekableEnd`     | `seekable.at(-1)?.end ?? (Number.isFinite(duration) ? duration : 0)`          |
| `volumeLevel`     | `'off'` when `muted \|\| volume === 0`; `'high'` when `volume >= 0.5`; else `'low'` |
| `bufferedProgress`| `ended → 1`; else the buffered range containing `currentTime`, `end / seekableEnd`, clamped to `[0, 1]`; `0` when nothing is buffered |
| `chapterCues`     | cues of the `kind === 'chapters'` track → `{ startTime, endTime, text }[]`    |
| `subtitleTracks`  | tracks with `kind` in `{ subtitles, captions }`                              |
| `showingSubtitles`| `subtitleTracks.filter((t) => t.mode === 'showing')`                          |
| `captionsActive`  | `showingSubtitles.length > 0`                                                |
| `portalContainer` | `fullscreen ? rootEl : document.body` (`null` before mount / on the server)   |

### 1.5 Ephemeral UI state (upstream's `StoreState`)

| Field                    | Type      | Meaning                                                    |
| ------------------------ | --------- | ---------------------------------------------------------- |
| `controlsVisible`        | `boolean` (init `true`) | drives `data-controls-visible` / `data-visible` |
| `dragging`               | `boolean` | a seek/volume thumb is being dragged                       |
| `menuOpen`               | `boolean` | a settings/speed menu is open                              |
| `volumeIndicatorVisible` | `boolean` | the transient volume HUD is showing                        |

Invariants (FR-006, spec edge cases): `paused || menuOpen || dragging ⇒ controlsVisible === true`
and the hide timer is cleared; `menuOpen ⇒ no seek tooltip and no volume indicator`.

### 1.6 Part registration (R-12)

| Field                  | Type     | Purpose                                                     |
| ---------------------- | -------- | ------------------------------------------------------------ |
| `volumeIndicatorCount` | `number` | root renders its own indicator only when this is `0`        |
| `downloadCount`        | `number` | the `D` shortcut is a no-op when this is `0` (FR-021)       |

`registerPart(kind: 'volume-indicator' \| 'download'): () => void` increments inside `untrack` and
returns the decrementing teardown for the caller's `$effect`.

### 1.7 Methods (the whole imperative surface)

| Method                                    | Behaviour                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| `togglePlay()`                            | `paused ? play() : pause()`; swallows the rejected `play()` promise           |
| `seekTo(time)`                            | clamps to `[0, seekableEnd]`; no-op when `seekableEnd <= 0` or `duration` is `NaN` |
| `seekBy(delta)`                           | `seekTo(currentTime + delta)`                                                  |
| `seekToPercent(p)`                        | `seekTo(seekableEnd * p)`                                                      |
| `setVolume(v)`                            | clamps to `[0, 1]`                                                             |
| `toggleMute()` / `toggleLoop()`           | flips `muted` / the element's `loop` property                                  |
| `stepPlaybackRate(direction, speeds)`     | moves one entry through the speed list, clamped at both ends                   |
| `setPlaybackRate(rate)`                   |                                                                                |
| `toggleCaptions()`                        | no-op unless `isVideo && subtitleTracks.length > 0`; shows the last active track, or the first, and hides the rest |
| `showSubtitleTrack(track)` / `hideSubtitles()` | settings-menu selection                                                   |
| `toggleFullscreen()`                      | feature-detected; reports nothing on failure (state stays `windowed`)          |
| `togglePip()`                             | video only, feature-detected; failures → `onPipError(error, 'enter' \| 'exit')` |
| `download()`                              | no-op without `currentSrc`; otherwise a temporary `<a download>` click         |
| `retry()`                                 | `mediaEl.load()` on the current source                                         |
| `showControls()` / `hideControls()`       | `autoHide` timer management (3000 ms)                                          |
| `flashVolumeIndicator()`                  | shows the HUD for 2000 ms; suppressed while `menuOpen`                         |
| `onRootKeydown(event)`                    | the whole shortcut table (FR-023)                                              |
| `registerPart(kind)`                      | see §1.6                                                                       |

Every timer, RAF, listener and observer this class starts is cleared in the teardown returned by the
`$effect` that started it (constitution I; CLAUDE.md §4).

---

## 2. Supporting types (`media-player.svelte.ts`, re-exported from the barrel)

```ts
export type MediaPlayerDirection = 'ltr' | 'rtl';
export type MediaPlayerVolumeLevel = 'off' | 'low' | 'high';
export type MediaPlayerTimeVariant = 'progress' | 'remaining' | 'duration';
export type MediaPlayerSeekTooltipTimeVariant = 'current' | 'progress';
export type MediaPlayerPipErrorState = 'enter' | 'exit';

/** A named time range parsed from a `kind="chapters"` text track. */
export type MediaPlayerChapterCue = { startTime: number; endTime: number; text: string };

/** A caller-supplied playback-quality option (R-07). */
export type MediaPlayerRendition = { id: string; width?: number; height?: number };

/** The subset of `TextTrack` the player reads and writes. */
export type MediaPlayerTextTrack = {
	id: string;
	kind: TextTrackKind;
	label: string;
	language: string;
	mode: TextTrackMode;
	track: TextTrack;
};

export type MediaPlayerCollisionPadding =
	| number
	| Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;
```

---

## 3. Constants (module scope, exported)

| Name                        | Value                                | Upstream name              |
| --------------------------- | ------------------------------------ | -------------------------- |
| `MEDIA_PLAYER_SPEEDS`       | `[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]` | `SPEEDS`                   |
| `SEEK_STEP_SHORT`           | `5`                                  | same                       |
| `SEEK_STEP_LONG`            | `10`                                 | same                       |
| `FLOATING_MENU_SIDE_OFFSET` | `10`                                 | same                       |
| `SEEK_COLLISION_PADDING`    | `10`                                 | same                       |
| `CONTROLS_HIDE_DELAY`       | `3000`                               | inline `3000`              |
| `VOLUME_INDICATOR_DELAY`    | `2000`                               | inline `2000`              |
| `LOADING_DELAY`             | `500`                                | `delayMs = 500`            |
| `--seek-hover-percent`, `--seek-tooltip-x`, `--seek-tooltip-y` | CSS vars | same |

---

## 4. `time.ts` (shared module exported for reuse — deliverable 5)

```ts
/** media-chrome `timeUtils.formatTime` parity: `M:SS`, `H:MM:SS` past an hour, `-` for negatives. */
export function formatTime(seconds: number, guide?: number): string;
```

`0:00` for `NaN`/`Infinity`/negative-zero; the hour field appears when either `seconds` or `guide`
reaches 3600. No other module in the repo currently formats durations, so this is the single shared
export this port publishes for later components.

---

## 5. State transitions

**Controls visibility (FR-006, US3 §5)**

```
visible ──(autoHide && playing && !menuOpen && !dragging && 3000ms idle)──▶ hidden
visible ──(mouseleave && autoHide && playing && !menuOpen && !dragging)──▶ hidden
hidden  ──(mousemove | keydown | pause | menu opens | drag starts)───────▶ visible
```

**Loading (FR-008, SC-004)**

```
idle ──(loading && !paused && hasPlayed)──▶ pending(delay ms) ──▶ shown
idle ──(loading && !paused && !hasPlayed)─▶ shown immediately
shown|pending ──(!loading | paused)───────▶ idle (timer cleared)
```

**Seek drag (SC-003, edge case "rapid drags")**

```
idle ──(valueChange)──▶ dragging{pendingSeekTime=v}  → visual position updates immediately,
                                                       the real seek is throttled to one rAF
dragging ──(valueCommit)──▶ committing{seek(v)} ──▶ idle when |currentTime − v| < 0.5
```

**Volume indicator (FR-010)** — `hidden ──(ArrowUp/ArrowDown/M on video)──▶ shown ──(2000 ms)──▶ hidden`,
never entered while `menuOpen`.
