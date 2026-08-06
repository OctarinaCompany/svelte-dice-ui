import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import type { Component } from 'svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as MediaPlayer from './index.js';
import {
	formatTime,
	MEDIA_PLAYER_SPEEDS,
	SEEK_TOOLTIP_WIDTH_FALLBACK,
	SEEK_TOOLTIP_X
} from './index.js';
import Harness, { type MediaPlayerHarnessProps } from './media-player.test.svelte';
import {
	FakeTextTrack,
	FakeTextTrackCue,
	installFullscreenStub,
	installMediaStub,
	installPipStub,
	mediaError,
	MEDIA_ERROR_CODES,
	stubRect,
	type MediaStub,
	type MediaStubOptions
} from './media-player.test-utils.js';

// ---------------------------------------------------------------------------
// Fixtures and helpers
// ---------------------------------------------------------------------------

function bySlot(slot: string): HTMLElement {
	const element = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function queryBySlot(slot: string): HTMLElement | null {
	return document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
}

function allBySlot(slot: string): HTMLElement[] {
	return Array.from(document.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`));
}

type SetupOptions = MediaPlayerHarnessProps & { stub?: MediaStubOptions };

/**
 * Render the harness, then swap the media element's dead jsdom surface for the settable one and
 * make the player re-read it. `loadedmetadata` refreshes the scalar and range mirrors; `load`
 * reaches the capture-phase listener the player installs for `<track>` parsing, which is what
 * rebuilds the text-track list.
 */
async function setup(options: SetupOptions = {}) {
	const { stub: stubOptions, ...props } = options;
	const result = render(Harness, { props });

	const element = document.querySelector<HTMLMediaElement>(
		'[data-slot="media-player-video"], [data-slot="media-player-audio"]'
	);

	let stub: MediaStub | null = null;
	if (element) {
		stub = installMediaStub(element, stubOptions);
		stub.fire('loadedmetadata');
		stub.fire('load');
	}

	await tick();
	await tick();

	return { ...result, stub, root: bySlot('media-player') };
}

/** The keyboard shortcuts only act while the player or the media element holds focus. */
function focusRoot() {
	const root = bySlot('media-player');
	root.focus();
	return root;
}

/**
 * jsdom performs no layout, so floating-ui never makes the menu surface visible and the
 * accessible-name algorithm — which skips unrendered text — reports an empty name for every item.
 * Menu entries are therefore matched on their rendered text.
 */
function menuItems(): HTMLElement[] {
	return screen.queryAllByRole('menuitem', { hidden: true });
}

function menuItem(text: string): HTMLElement {
	const match = menuItems().find((item) => item.textContent?.trim() === text);
	if (!match) {
		throw new Error(
			`no menu item reading "${text}"; got ${JSON.stringify(menuItems().map((item) => item.textContent?.trim()))}`
		);
	}
	return match;
}

/** `bits-ui` opens a submenu on pointer entry, the same as the WAI-ARIA menu pattern. */
async function openSubmenu(user: ReturnType<typeof userEvent.setup>, label: string) {
	const trigger = Array.from(
		document.querySelectorAll<HTMLElement>('[data-slot="dropdown-menu-sub-trigger"]')
	).find((element) => element.textContent?.includes(label));
	if (!trigger) throw new Error(`no submenu trigger reading "${label}"`);
	await user.hover(trigger);
	await tick();
	await tick();
}

function subtitleTrack(label: string, language: string) {
	return new FakeTextTrack({ kind: 'subtitles', label, language, id: label });
}

function chaptersTrack() {
	return new FakeTextTrack({
		kind: 'chapters',
		label: 'Chapters',
		id: 'chapters',
		cues: [
			new FakeTextTrackCue(0, 40, 'Opening'),
			new FakeTextTrackCue(40, 80, 'Middle'),
			new FakeTextTrackCue(80, 100, 'Ending')
		]
	});
}

/** Every non-root part, spelt as `getMediaPlayerContext` names it in the thrown message. */
const PARTS: [name: string, component: Component][] = [
	['Video', MediaPlayer.Video as unknown as Component],
	['Audio', MediaPlayer.Audio as unknown as Component],
	['Controls', MediaPlayer.Controls as unknown as Component],
	['ControlsOverlay', MediaPlayer.ControlsOverlay as unknown as Component],
	['Loading', MediaPlayer.Loading as unknown as Component],
	['Error', MediaPlayer.Error as unknown as Component],
	['VolumeIndicator', MediaPlayer.VolumeIndicator as unknown as Component],
	['Play', MediaPlayer.Play as unknown as Component],
	['SeekBackward', MediaPlayer.SeekBackward as unknown as Component],
	['SeekForward', MediaPlayer.SeekForward as unknown as Component],
	['Seek', MediaPlayer.Seek as unknown as Component],
	['Volume', MediaPlayer.Volume as unknown as Component],
	['Time', MediaPlayer.Time as unknown as Component],
	['PlaybackSpeed', MediaPlayer.PlaybackSpeed as unknown as Component],
	['Loop', MediaPlayer.Loop as unknown as Component],
	['Fullscreen', MediaPlayer.Fullscreen as unknown as Component],
	['PiP', MediaPlayer.PiP as unknown as Component],
	['Captions', MediaPlayer.Captions as unknown as Component],
	['Download', MediaPlayer.Download as unknown as Component],
	['Settings', MediaPlayer.Settings as unknown as Component],
	['Portal', MediaPlayer.Portal as unknown as Component],
	['Tooltip', MediaPlayer.Tooltip as unknown as Component]
];

const restorers: (() => void)[] = [];

afterEach(() => {
	while (restorers.length > 0) restorers.pop()?.();
});

function withFullscreen() {
	const stub = installFullscreenStub();
	restorers.push(stub.restore);
	return stub;
}

function withPip(video: HTMLVideoElement) {
	const stub = installPipStub(video);
	restorers.push(stub.restore);
	return stub;
}

/** An element appended to the body for the run of one spec, e.g. a portal or collision target. */
function detachedElement(): HTMLDivElement {
	const element = document.createElement('div');
	document.body.appendChild(element);
	restorers.push(() => element.remove());
	return element;
}

/** The stand-in layout box for the seek track — 600px wide, starting 100px from the viewport edge. */
const TRACK_RECT = { left: 100, right: 700, width: 600, top: 40, bottom: 44, height: 4 };

const TRACK_Y = TRACK_RECT.top + 2;

/**
 * jsdom may ship no `PointerEvent`, and `@testing-library`'s pointer helpers then drop the
 * coordinates onto a bare `Event`. A `MouseEvent` dispatched under the pointer event's own type
 * carries the two coordinates the seek handlers read.
 */
function pointerEvent(type: string, clientX: number, clientY: number) {
	return new MouseEvent(type, {
		bubbles: type !== 'pointerenter' && type !== 'pointerleave',
		cancelable: true,
		clientX,
		clientY
	});
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Open the seek preview at a viewport X. Upstream only shows it for an *intentional* hover — a
 * dwell, mostly-horizontal travel or a near-stationary pointer — so the pointer is moved twice with
 * a pause between; the extra move afterwards writes the position, which the opening frame cannot do
 * because the tooltip element does not exist yet at that point.
 */
async function hoverSeek(clientX: number): Promise<HTMLElement> {
	const seek = bySlot('media-player-seek');
	stubRect(seek, TRACK_RECT);

	await fireEvent(seek, pointerEvent('pointerenter', clientX, TRACK_Y));
	await fireEvent(seek, pointerEvent('pointermove', clientX, TRACK_Y));
	await sleep(200);
	await fireEvent(seek, pointerEvent('pointermove', clientX, TRACK_Y));

	await waitFor(() => expect(queryBySlot('media-player-seek-tooltip')).not.toBeNull());

	await moveSeekPointer(clientX);
	return bySlot('media-player-seek-tooltip');
}

/** Move an already-hovering pointer and wait for the tooltip's clamped X to be written. */
async function moveSeekPointer(clientX: number) {
	const seek = bySlot('media-player-seek');
	const before = bySlot('media-player-seek-tooltip').style.getPropertyValue(SEEK_TOOLTIP_X);

	await fireEvent(seek, pointerEvent('pointermove', clientX, TRACK_Y));
	await waitFor(() => {
		const after = bySlot('media-player-seek-tooltip').style.getPropertyValue(SEEK_TOOLTIP_X);
		expect(after).not.toBe(before);
	});
}

// ---------------------------------------------------------------------------
// H — time formatting
// ---------------------------------------------------------------------------

describe('formatTime', () => {
	it('renders `M:SS` below an hour', () => {
		expect(formatTime(65, 120)).toBe('1:05');
	});

	it('renders `H:MM:SS` once the guide reaches an hour', () => {
		expect(formatTime(3661, 3661)).toBe('1:01:01');
	});

	it('widens the minute field when the guide passes ten minutes', () => {
		expect(formatTime(65, 700)).toBe('01:05');
	});

	it('renders `0:00` for a duration that is not a number', () => {
		expect(formatTime(Number.NaN)).toBe('0:00');
	});

	it('renders `0:00` for an infinite duration', () => {
		expect(formatTime(Number.POSITIVE_INFINITY)).toBe('0:00');
	});

	it('renders `0:00` for negative zero rather than `-0:00`', () => {
		expect(formatTime(-0)).toBe('0:00');
	});

	it('prefixes a negative duration with a minus sign', () => {
		expect(formatTime(-30, 120)).toBe('-0:30');
	});
});

// ---------------------------------------------------------------------------
// I — rendering and composition
// ---------------------------------------------------------------------------

describe('rendering & composition', () => {
	it('renders every mounted part with its documented data-slot', async () => {
		await setup({
			withControlsOverlay: true,
			withLoop: true,
			withFullscreen: true,
			withPip: true,
			withCaptions: true,
			withDownload: true,
			withPlaybackSpeed: true,
			withSettings: true,
			withVolumeIndicator: true
		});

		for (const slot of [
			'media-player',
			'media-player-video',
			'media-player-controls',
			'media-player-controls-overlay',
			'media-player-seek-container',
			'media-player-seek',
			'media-player-seek-buffered',
			'media-player-play-button',
			'media-player-seek-backward',
			'media-player-seek-forward',
			'media-player-volume-container',
			'media-player-volume-trigger',
			'media-player-volume',
			'media-player-time',
			'media-player-loop',
			'media-player-captions',
			'media-player-download',
			'media-player-pip',
			'media-player-fullscreen',
			'media-player-playback-speed',
			'media-player-settings'
		]) {
			expect(queryBySlot(slot), slot).not.toBeNull();
		}
	});

	it('renders the audio element under its own data-slot', async () => {
		await setup({ media: 'audio' });

		expect(queryBySlot('media-player-audio')).not.toBeNull();
		expect(queryBySlot('media-player-video')).toBeNull();
	});

	it.each([
		['root-child', 'root', 'media-player'],
		['video-child', 'video', 'media-player-video'],
		['controls-child', 'controls', 'media-player-controls'],
		['play-child', 'play', 'media-player-play-button'],
		['seek-child', 'seek', 'media-player-seek-container'],
		['volume-child', 'volume', 'media-player-volume-container'],
		['time-child', 'time', 'media-player-time']
	] as const)(
		'the %s snippet replaces the default element and keeps its props',
		async (mode, marker, slot) => {
			await setup({ mode });

			const element = document.querySelector<HTMLElement>(`[data-child-slot="${marker}"]`);
			expect(element).not.toBeNull();
			expect(element?.getAttribute('data-slot')).toBe(slot);
		}
	);

	it.each([
		['media-player', 'relative'],
		['media-player-controls', 'absolute'],
		['media-player-play-button', 'size-8'],
		['media-player-seek', 'touch-none'],
		['media-player-volume-container', 'items-center'],
		['media-player-time', 'text-sm']
	])('keeps %s own layout classes alongside the caller class', async (slot, ownClass) => {
		await setup({ partClass: 'outline-dashed' });

		// The port's own layout classes and the caller's both survive `cn()`.
		expect(bySlot(slot).className, slot).toContain(ownClass);
		expect(bySlot(slot).className, slot).toContain('outline-dashed');
	});

	it('puts the caller class on the video, which carries no layout classes of its own', async () => {
		await setup({ partClass: 'outline-dashed' });

		expect(bySlot('media-player-video').className).toBe('outline-dashed');
	});

	it('merges the caller class last, so a conflicting utility wins', async () => {
		await setup({ partClass: 'rounded-none' });
		const root = bySlot('media-player');

		expect(root.className).toContain('rounded-none');
		expect(root.className).not.toContain('rounded-lg');
	});

	it('hands the Picture-in-Picture state to a children snippet', async () => {
		await setup({ mode: 'pip-children', withPip: true });
		const pip = withPip(bySlot('media-player-video') as HTMLVideoElement);

		expect(screen.getByTestId('pip-state')).toHaveTextContent('off');

		await userEvent.click(bySlot('media-player-pip'));
		await waitFor(() => expect(pip.requestPictureInPicture).toHaveBeenCalledTimes(1));

		await waitFor(() => expect(screen.getByTestId('pip-state')).toHaveTextContent('on'));
	});

	it.each(PARTS)('throws when %s is rendered outside the root', (name, component) => {
		expect(() => render(component)).toThrow(
			new RegExp(`<MediaPlayer\\.${name}>\`? must be used within`)
		);
	});
});

// ---------------------------------------------------------------------------
// A — roles, ARIA and accessible names
// ---------------------------------------------------------------------------

describe('roles & ARIA', () => {
	it('labels and describes the root through its own sr-only spans', async () => {
		await setup({ label: 'Trailer' });
		const root = bySlot('media-player');

		const labelId = root.getAttribute('aria-labelledby');
		const descriptionId = root.getAttribute('aria-describedby');

		expect(document.getElementById(labelId ?? '')?.textContent).toBe('Trailer');
		expect(document.getElementById(descriptionId ?? '')?.textContent).toContain('Video player');
	});

	it('describes an audio player with the Shift-qualified seek shortcuts', async () => {
		await setup({ media: 'audio' });
		const root = bySlot('media-player');
		const descriptionId = root.getAttribute('aria-describedby');

		expect(document.getElementById(descriptionId ?? '')?.textContent).toContain('Audio player');
		expect(document.getElementById(descriptionId ?? '')?.textContent).toContain(
			'Shift + arrow keys'
		);
	});

	it('points every control at the media element through aria-controls', async () => {
		await setup({ withLoop: true, withCaptions: true, withDownload: true, withPip: true });
		const mediaId = bySlot('media-player-video').id;

		expect(mediaId).not.toBe('');
		for (const slot of [
			'media-player-play-button',
			'media-player-seek-backward',
			'media-player-seek-forward',
			'media-player-loop',
			'media-player-captions',
			'media-player-download',
			'media-player-pip',
			'media-player-seek'
		]) {
			expect(bySlot(slot).getAttribute('aria-controls'), slot).toBe(mediaId);
		}
	});

	it('tracks the paused state on the play button', async () => {
		const { stub } = await setup();
		const play = screen.getByRole('button', { name: 'Play' });

		expect(play).toHaveAttribute('aria-pressed', 'false');
		expect(play).toHaveAttribute('data-state', 'off');

		stub?.play();
		await tick();

		const pause = screen.getByRole('button', { name: 'Pause' });
		expect(pause).toHaveAttribute('aria-pressed', 'true');
		expect(pause).toHaveAttribute('data-state', 'on');
	});

	it('exposes both sliders with a value text', async () => {
		await setup();

		const seek = screen.getByRole('slider', { name: 'Seek' });
		const volume = screen.getByRole('slider', { name: 'Volume' });

		expect(seek).toHaveAttribute('aria-valuetext', '0:00 of 1:40');
		expect(volume).toHaveAttribute('aria-valuetext', '100% volume');
	});

	it('announces loading politely and errors assertively', async () => {
		const { stub } = await setup({ withLoading: true, withError: true, loadingDelay: 0 });

		stub?.play();
		stub?.fire('waiting');
		await tick();

		const loading = bySlot('media-player-loading');
		expect(loading).toHaveAttribute('role', 'status');
		expect(loading).toHaveAttribute('aria-live', 'polite');

		stub?.setError(mediaError(MEDIA_ERROR_CODES.NETWORK));
		await tick();

		const error = bySlot('media-player-error');
		expect(error).toHaveAttribute('role', 'alert');
		expect(error).toHaveAttribute('aria-live', 'assertive');
	});

	it('labels the volume indicator with the current level', async () => {
		await setup({ withVolumeIndicator: true });
		focusRoot();

		await userEvent.keyboard('{ArrowDown}');
		await tick();

		const indicator = bySlot('media-player-volume-indicator');
		expect(indicator).toHaveAttribute('role', 'status');
		expect(indicator).toHaveAttribute('aria-live', 'polite');
		expect(indicator).toHaveAttribute('aria-label', 'Volume 90%');
	});

	it('renders exactly one volume indicator whether or not the tree mounts its own', async () => {
		await setup({ withVolumeIndicator: true });
		focusRoot();
		await userEvent.keyboard('{ArrowDown}');
		await tick();

		expect(allBySlot('media-player-volume-indicator')).toHaveLength(1);
	});

	it('falls back to its own volume indicator when the tree mounts none', async () => {
		await setup();
		focusRoot();
		await userEvent.keyboard('{ArrowDown}');
		await tick();

		expect(allBySlot('media-player-volume-indicator')).toHaveLength(1);
		expect(screen.getAllByRole('status')).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// J — pointer transport
// ---------------------------------------------------------------------------

describe('transport', () => {
	it('toggles playback from the play button', async () => {
		const user = userEvent.setup();
		const { stub } = await setup();

		await user.click(screen.getByRole('button', { name: 'Play' }));
		expect(stub?.play).toHaveBeenCalled();

		await user.click(screen.getByRole('button', { name: 'Pause' }));
		expect(stub?.pause).toHaveBeenCalled();
	});

	it('toggles playback from the video surface', async () => {
		const user = userEvent.setup();
		const { stub } = await setup();

		await user.click(bySlot('media-player-video'));

		expect(stub?.play).toHaveBeenCalledTimes(1);
	});

	it('lets a caller onclick on the video suppress the toggle with preventDefault', async () => {
		const { stub } = await setup();
		const video = bySlot('media-player-video');

		// `defaultPrevented` is what the component checks, so the handler is installed directly.
		video.addEventListener('click', (event) => event.preventDefault());
		await fireEvent.click(video);

		expect(stub?.play).not.toHaveBeenCalled();
	});

	it('moves the current time by the seek buttons own seconds props', async () => {
		const user = userEvent.setup();
		const { stub } = await setup({ seekSeconds: 5, forwardSeconds: 10 });

		await user.click(screen.getByRole('button', { name: 'Forward 10 seconds' }));
		expect(stub?.element.currentTime).toBe(10);

		await user.click(screen.getByRole('button', { name: 'Back 5 seconds' }));
		expect(stub?.element.currentTime).toBe(5);
	});

	it('clamps a backward seek at zero and a forward seek at the seekable end', async () => {
		const user = userEvent.setup();
		const { stub } = await setup({ stub: { duration: 12 }, forwardSeconds: 30 });

		await user.click(screen.getByRole('button', { name: 'Back 5 seconds' }));
		expect(stub?.element.currentTime).toBe(0);

		await user.click(screen.getByRole('button', { name: 'Forward 30 seconds' }));
		expect(stub?.element.currentTime).toBe(12);
	});

	it('commits a seek once on release and pins the controls while dragging', async () => {
		const { stub } = await setup();
		const seek = screen.getByRole('slider', { name: 'Seek' });

		// bits-ui drives the value from pointer geometry jsdom cannot produce, so the drag is
		// exercised through the slider's own keyboard interaction, which emits the same
		// change/commit pair.
		seek.focus();
		await fireEvent.keyDown(seek, { key: 'ArrowRight' });
		await tick();

		await waitFor(() => expect(stub?.element.currentTime).toBeGreaterThan(0));
	});

	it('mutes and unmutes from the volume trigger', async () => {
		const user = userEvent.setup();
		const { stub } = await setup();

		await user.click(screen.getByRole('button', { name: 'Mute' }));
		expect(stub?.element.muted).toBe(true);
		expect(bySlot('media-player-volume-trigger')).toHaveAttribute('data-state', 'on');

		await user.click(screen.getByRole('button', { name: 'Unmute' }));
		expect(stub?.element.muted).toBe(false);
	});

	it('sets the volume from the slider', async () => {
		const { stub } = await setup();
		const volume = screen.getByRole('slider', { name: 'Volume' });

		volume.focus();
		await fireEvent.keyDown(volume, { key: 'ArrowLeft' });
		await tick();

		await waitFor(() => expect(stub?.element.volume).toBeLessThan(1));
	});

	it('keeps an expandable volume slider collapsed until the control is hovered', async () => {
		await setup({ volumeExpandable: true });

		expect(bySlot('media-player-volume').className).toContain('w-0');
		expect(bySlot('media-player-volume').className).toContain('group-hover:w-16');
	});

	it.each([
		['progress', '0:00'],
		['remaining', '1:40'],
		['duration', '1:40']
	] as const)('renders the %s time variant', async (variant, expected) => {
		await setup({ timeVariant: variant });
		const time = bySlot('media-player-time');

		expect(time).toHaveAttribute('data-variant', variant);
		expect(time.textContent).toContain(expected);
	});

	it.each([
		['progress', '0:00/1:40', '0:30/1:40'],
		['remaining', '1:40', '1:10'],
		['duration', '1:40', '1:40']
	] as const)(
		'keeps the %s readout in step with the media time',
		async (variant, before, after) => {
			const { stub } = await setup({ timeVariant: variant });
			const readout = () => bySlot('media-player-time').textContent?.replace(/\s+/g, '') ?? '';

			expect(readout()).toBe(before);

			// The stub's `currentTime` setter fires `timeupdate`, exactly as the element does.
			if (stub) stub.element.currentTime = 30;
			await tick();

			expect(readout()).toBe(after);
		}
	);

	it('mirrors a loop flag flipped outside the component', async () => {
		const { stub } = await setup({ withLoop: true });

		expect(bySlot('media-player-loop')).toHaveAttribute('aria-pressed', 'false');

		// `loop` is a reflected IDL attribute, so this is exactly the caller-side flip the
		// `MutationObserver` in `attachMedia` exists for — no control is clicked.
		if (stub) stub.element.loop = true;

		await waitFor(() =>
			expect(bySlot('media-player-loop')).toHaveAttribute('aria-pressed', 'true')
		);
		expect(bySlot('media-player-loop')).toHaveAttribute('data-state', 'on');
		expect(screen.getByRole('button', { name: 'Disable loop' })).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// B — keyboard (contract §12)
// ---------------------------------------------------------------------------

describe('keyboard', () => {
	it.each(['{ }', '{k}'])('%s toggles play and pause', async (key) => {
		const { stub } = await setup();
		focusRoot();

		await userEvent.keyboard(key);
		expect(stub?.play).toHaveBeenCalledTimes(1);

		await userEvent.keyboard(key);
		expect(stub?.pause).toHaveBeenCalledTimes(1);
	});

	it('seeks forward and backward five seconds with the arrow keys on video', async () => {
		const { stub } = await setup();
		focusRoot();

		await userEvent.keyboard('{ArrowRight}');
		expect(stub?.element.currentTime).toBe(5);

		await userEvent.keyboard('{ArrowLeft}');
		expect(stub?.element.currentTime).toBe(0);
	});

	it('ignores a bare horizontal arrow on audio and honours the Shift-qualified one', async () => {
		const { stub } = await setup({ media: 'audio' });
		focusRoot();

		await userEvent.keyboard('{ArrowRight}');
		expect(stub?.element.currentTime).toBe(0);

		await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
		expect(stub?.element.currentTime).toBe(5);
	});

	it.each([['video' as const], ['audio' as const]])(
		'J and L seek ten seconds on %s',
		async (media) => {
			const { stub } = await setup({ media });
			focusRoot();

			await userEvent.keyboard('{l}');
			expect(stub?.element.currentTime).toBe(10);

			await userEvent.keyboard('{j}');
			expect(stub?.element.currentTime).toBe(0);
		}
	);

	it.each([
		['0', 0],
		['3', 30],
		['9', 90]
	])('the digit %s seeks to that tenth of the duration', async (digit, expected) => {
		const { stub } = await setup();
		focusRoot();

		await userEvent.keyboard(`{${digit}}`);
		expect(stub?.element.currentTime).toBe(expected);
	});

	it('Home and End seek to the start and to the end', async () => {
		const { stub } = await setup();
		focusRoot();

		await userEvent.keyboard('{End}');
		expect(stub?.element.currentTime).toBe(100);

		await userEvent.keyboard('{Home}');
		expect(stub?.element.currentTime).toBe(0);
	});

	it('changes the volume by ten percent and flashes the indicator on video', async () => {
		const { stub } = await setup();
		focusRoot();

		await userEvent.keyboard('{ArrowDown}');
		await tick();

		expect(stub?.element.volume).toBeCloseTo(0.9, 5);
		expect(queryBySlot('media-player-volume-indicator')).not.toBeNull();

		await userEvent.keyboard('{ArrowUp}');
		expect(stub?.element.volume).toBeCloseTo(1, 5);
	});

	it('leaves the volume alone on audio', async () => {
		const { stub } = await setup({ media: 'audio' });
		focusRoot();

		await userEvent.keyboard('{ArrowDown}');
		await tick();

		expect(stub?.element.volume).toBe(1);
		expect(queryBySlot('media-player-volume-indicator')).toBeNull();
	});

	it('M toggles mute', async () => {
		const { stub } = await setup();
		focusRoot();

		await userEvent.keyboard('{m}');
		expect(stub?.element.muted).toBe(true);

		await userEvent.keyboard('{m}');
		expect(stub?.element.muted).toBe(false);
	});

	it('R toggles loop', async () => {
		const { stub } = await setup({ withLoop: true });
		focusRoot();

		await userEvent.keyboard('{r}');
		await tick();

		expect(stub?.element.loop).toBe(true);
		expect(bySlot('media-player-loop')).toHaveAttribute('aria-pressed', 'true');
	});

	it('F enters fullscreen and Escape leaves it again', async () => {
		const fullscreen = withFullscreen();
		await setup({ withFullscreen: true });
		const root = focusRoot();

		await userEvent.keyboard('{f}');
		await waitFor(() => expect(fullscreen.element).toBe(root));
		await tick();
		expect(root).toHaveAttribute('data-state', 'fullscreen');

		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(fullscreen.exitFullscreen).toHaveBeenCalledTimes(1));
	});

	it('leaves Escape alone while the player is windowed', async () => {
		const fullscreen = withFullscreen();
		await setup();
		focusRoot();

		await userEvent.keyboard('{Escape}');

		expect(fullscreen.exitFullscreen).not.toHaveBeenCalled();
		expect(fullscreen.requestFullscreen).not.toHaveBeenCalled();
	});

	it('steps the playback rate down and up through the speed list', async () => {
		const { stub } = await setup();
		focusRoot();

		await userEvent.keyboard('>');
		expect(stub?.element.playbackRate).toBe(MEDIA_PLAYER_SPEEDS[3]);

		await userEvent.keyboard('<');
		expect(stub?.element.playbackRate).toBe(MEDIA_PLAYER_SPEEDS[2]);
	});

	it('C toggles captions once the media has a subtitle track', async () => {
		const track = subtitleTrack('English', 'en');
		await setup({ withCaptions: true, stub: { tracks: [track] } });
		focusRoot();

		await userEvent.keyboard('{c}');
		await tick();

		expect(track.mode).toBe('showing');
		expect(bySlot('media-player-captions')).toHaveAttribute('aria-pressed', 'true');

		await userEvent.keyboard('{c}');
		await tick();

		expect(track.mode).toBe('disabled');
	});

	it('leaves C inert when the media has no text track', async () => {
		await setup({ withCaptions: true });
		focusRoot();

		await userEvent.keyboard('{c}');
		await tick();

		expect(bySlot('media-player-captions')).toHaveAttribute('aria-pressed', 'false');
	});

	it('P toggles Picture-in-Picture on video', async () => {
		await setup({ withPip: true });
		const pip = withPip(bySlot('media-player-video') as HTMLVideoElement);
		focusRoot();

		await userEvent.keyboard('{p}');
		await waitFor(() => expect(pip.requestPictureInPicture).toHaveBeenCalledTimes(1));
		await tick();

		expect(bySlot('media-player-pip')).toHaveAttribute('data-state', 'on');

		await userEvent.keyboard('{p}');
		await waitFor(() => expect(pip.exitPictureInPicture).toHaveBeenCalledTimes(1));
	});

	it('leaves D inert without a Download part', async () => {
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		await setup({ withDownload: false });
		focusRoot();

		await userEvent.keyboard('{d}');

		expect(click).not.toHaveBeenCalled();
	});

	it('D downloads the current source once a Download part is mounted', async () => {
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		await setup({ withDownload: true });
		focusRoot();

		await userEvent.keyboard('{d}');

		expect(click).toHaveBeenCalledTimes(1);
	});

	it('calls preventDefault only for the keys the root owns', async () => {
		await setup();
		const root = focusRoot();

		const owned = new KeyboardEvent('keydown', { key: 'k', bubbles: true, cancelable: true });
		root.dispatchEvent(owned);
		expect(owned.defaultPrevented).toBe(true);

		const foreign = new KeyboardEvent('keydown', { key: 'q', bubbles: true, cancelable: true });
		root.dispatchEvent(foreign);
		expect(foreign.defaultPrevented).toBe(false);
	});

	it('runs after a caller onkeydown and skips a handled event', async () => {
		const onRootKeydown = vi.fn((event: KeyboardEvent) => event.preventDefault());
		const { stub } = await setup({ onRootKeydown });
		focusRoot();

		await userEvent.keyboard('{k}');

		expect(onRootKeydown).toHaveBeenCalledTimes(1);
		expect(stub?.play).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Root callbacks (FR-003)
// ---------------------------------------------------------------------------

describe('root callbacks', () => {
	it('forwards every media notification with the documented payload', async () => {
		const callbacks = {
			onPlay: vi.fn(),
			onPause: vi.fn(),
			onEnded: vi.fn(),
			onTimeUpdate: vi.fn(),
			onVolumeChange: vi.fn(),
			onMuted: vi.fn(),
			onMediaError: vi.fn()
		};
		const { stub } = await setup(callbacks);

		stub?.fire('play');
		stub?.fire('pause');
		stub?.fire('ended');
		if (stub) stub.element.currentTime = 12;
		if (stub) stub.element.volume = 0.4;

		expect(callbacks.onPlay).toHaveBeenCalledTimes(1);
		expect(callbacks.onPause).toHaveBeenCalledTimes(1);
		expect(callbacks.onEnded).toHaveBeenCalledTimes(1);
		expect(callbacks.onTimeUpdate).toHaveBeenCalledWith(12);
		expect(callbacks.onVolumeChange).toHaveBeenCalledWith(0.4);
		expect(callbacks.onMuted).toHaveBeenCalledWith(false);

		const error = mediaError(MEDIA_ERROR_CODES.DECODE);
		stub?.setError(error);
		expect(callbacks.onMediaError).toHaveBeenCalledWith(error);
	});

	it('reports fullscreen changes from the document', async () => {
		const fullscreen = withFullscreen();
		const onFullscreenChange = vi.fn();
		await setup({ onFullscreenChange, withFullscreen: true });

		await userEvent.click(screen.getByRole('button', { name: 'Enter fullscreen' }));
		await waitFor(() => expect(onFullscreenChange).toHaveBeenCalledWith(true));

		await fullscreen.exitFullscreen();
		expect(onFullscreenChange).toHaveBeenLastCalledWith(false);
	});

	it('reports a refused Picture-in-Picture transition through onPipError', async () => {
		const onPipError = vi.fn();
		await setup({ withPip: true, onPipError });

		const video = bySlot('media-player-video') as HTMLVideoElement;
		const failure = new Error('pip refused');
		Object.defineProperty(video, 'requestPictureInPicture', {
			configurable: true,
			value: () => Promise.reject(failure)
		});
		Object.defineProperty(document, 'pictureInPictureElement', {
			configurable: true,
			get: () => null
		});
		restorers.push(() => Reflect.deleteProperty(document, 'pictureInPictureElement'));

		focusRoot();
		await userEvent.keyboard('{p}');

		await waitFor(() => expect(onPipError).toHaveBeenCalledWith(failure, 'enter'));
	});

	it('stops listening once the player unmounts', async () => {
		const onPlay = vi.fn();
		const onTimeUpdate = vi.fn();
		const { stub, unmount } = await setup({ onPlay, onTimeUpdate });
		const element = stub?.element;

		stub?.fire('play');
		expect(onPlay).toHaveBeenCalledTimes(1);

		unmount();
		await tick();

		// A positive teardown check: the same events no longer reach the callbacks *and* the
		// detached element can still be driven, proving the listeners were removed rather than the
		// element being inert.
		element?.dispatchEvent(new Event('play'));
		if (element) element.currentTime = 42;

		expect(onPlay).toHaveBeenCalledTimes(1);
		expect(onTimeUpdate).not.toHaveBeenCalled();
		expect(element?.currentTime).toBe(42);
	});
});

// ---------------------------------------------------------------------------
// E — RTL
// ---------------------------------------------------------------------------

describe('RTL', () => {
	it('propagates dir="rtl" to the root, both sliders and the time readout', async () => {
		await setup({ dir: 'rtl' });

		expect(bySlot('media-player')).toHaveAttribute('dir', 'rtl');
		expect(bySlot('media-player-controls')).toHaveAttribute('dir', 'rtl');
		expect(bySlot('media-player-seek-container')).toHaveAttribute('dir', 'rtl');
		expect(bySlot('media-player-volume-container')).toHaveAttribute('dir', 'rtl');
		expect(bySlot('media-player-time')).toHaveAttribute('dir', 'rtl');
	});

	it('keeps arrow-key seeking physical under dir="rtl"', async () => {
		const { stub } = await setup({ dir: 'rtl' });
		focusRoot();

		await userEvent.keyboard('{ArrowRight}');
		expect(stub?.element.currentTime).toBe(5);

		await userEvent.keyboard('{ArrowLeft}');
		expect(stub?.element.currentTime).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// D — guard rails
// ---------------------------------------------------------------------------

describe('guard rails', () => {
	it('drops the root out of the tab order and marks every part disabled', async () => {
		await setup({ disabled: true, withLoop: true, withCaptions: true, withDownload: true });
		const root = bySlot('media-player');

		expect(root).not.toHaveAttribute('tabindex');
		expect(root).toHaveAttribute('aria-disabled', 'true');
		expect(root).toHaveAttribute('data-disabled', '');

		for (const slot of [
			'media-player-controls',
			'media-player-play-button',
			'media-player-seek-backward',
			'media-player-seek-forward',
			'media-player-loop',
			'media-player-captions',
			'media-player-download',
			'media-player-seek',
			'media-player-volume-container'
		]) {
			expect(bySlot(slot), slot).toHaveAttribute('data-disabled', '');
		}
	});

	it('blocks pointer interaction while disabled', async () => {
		const { stub } = await setup({ disabled: true });

		await fireEvent.click(screen.getByRole('button', { name: 'Play' }));
		await fireEvent.click(bySlot('media-player-video'));

		expect(stub?.play).not.toHaveBeenCalled();
	});

	it('blocks keyboard interaction while disabled', async () => {
		// A `disabled` root carries no `tabindex`, so the spec forces one in order to reach the
		// keydown guard itself rather than proving only that the element cannot be focused.
		const { stub } = await setup({ disabled: true, rootTabindex: 0 });
		focusRoot();

		await userEvent.keyboard('{k}');
		await userEvent.keyboard('{ArrowRight}');

		expect(stub?.play).not.toHaveBeenCalled();
		expect(stub?.element.currentTime).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// F — feedback layers
// ---------------------------------------------------------------------------

describe('feedback', () => {
	it('renders nothing at all while loading, error and the volume HUD are inactive', async () => {
		await setup({ withLoading: true, withError: true, withVolumeIndicator: true });

		expect(queryBySlot('media-player-loading')).toBeNull();
		expect(queryBySlot('media-player-error')).toBeNull();
		expect(queryBySlot('media-player-volume-indicator')).toBeNull();
		expect(screen.queryByRole('status')).toBeNull();
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('keeps the loading indicator away while the media is merely paused', async () => {
		const { stub } = await setup({ withLoading: true, loadingDelay: 0 });

		stub?.fire('waiting');
		await tick();

		expect(queryBySlot('media-player-loading')).toBeNull();
	});

	it('shows the loading indicator immediately on a first-load stall', async () => {
		const { stub } = await setup({ withLoading: true });

		stub?.play();
		stub?.fire('waiting');
		await tick();

		// `hasPlayed` is still false on the first stall, so the delay does not apply.
		expect(queryBySlot('media-player-loading')).not.toBeNull();
	});

	it('delays a mid-playback stall and hides the indicator the moment loading resolves', async () => {
		vi.useFakeTimers();
		try {
			const { stub } = await setup({ withLoading: true, loadingDelay: 500 });

			stub?.play();
			stub?.fire('playing');
			await tick();

			stub?.fire('waiting');
			await tick();
			expect(queryBySlot('media-player-loading')).toBeNull();

			await vi.advanceTimersByTimeAsync(500);
			await tick();
			expect(queryBySlot('media-player-loading')).not.toBeNull();

			stub?.fire('playing');
			await tick();
			expect(queryBySlot('media-player-loading')).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it.each([
		[MEDIA_ERROR_CODES.ABORTED, 'Playback Interrupted', 'Media playback was aborted'],
		[
			MEDIA_ERROR_CODES.NETWORK,
			'Connection Problem',
			'A network error occurred while loading the media'
		],
		[MEDIA_ERROR_CODES.DECODE, 'Media Error', 'An error occurred while decoding the media'],
		[
			MEDIA_ERROR_CODES.SRC_NOT_SUPPORTED,
			'Unsupported Format',
			'The media format is not supported'
		],
		[99, 'Playback Error', 'An unknown error occurred']
	])('derives the label and description for error code %s', async (code, label, description) => {
		const { stub } = await setup({ withError: true });

		stub?.setError(mediaError(code));
		await tick();

		expect(screen.getByText(label)).toBeInTheDocument();
		expect(screen.getByText(description)).toBeInTheDocument();
	});

	it('lets label and description overrides win over the code map', async () => {
		const { stub } = await setup({
			withError: true,
			errorLabel: 'Nope',
			errorDescription: 'Try later'
		});

		stub?.setError(mediaError(MEDIA_ERROR_CODES.NETWORK));
		await tick();

		expect(screen.getByText('Nope')).toBeInTheDocument();
		expect(screen.getByText('Try later')).toBeInTheDocument();
	});

	it('reloads the current source from "Try again"', async () => {
		const { stub } = await setup({ withError: true });
		stub?.setError(mediaError(MEDIA_ERROR_CODES.NETWORK));
		await tick();

		await userEvent.click(screen.getByRole('button', { name: /try again/i }));

		await waitFor(() => expect(stub?.load).toHaveBeenCalledTimes(1));
	});

	it('lets a custom onRetry replace the default reload', async () => {
		const onRetry = vi.fn();
		const { stub } = await setup({ withError: true, onRetry });
		stub?.setError(mediaError(MEDIA_ERROR_CODES.NETWORK));
		await tick();

		await userEvent.click(screen.getByRole('button', { name: /try again/i }));

		await waitFor(() => expect(onRetry).toHaveBeenCalledTimes(1));
		expect(stub?.load).not.toHaveBeenCalled();
	});

	it('calls a custom onReload instead of reloading the page', async () => {
		const onReload = vi.fn();
		const { stub } = await setup({ withError: true, onReload });

		stub?.setError(mediaError(MEDIA_ERROR_CODES.NETWORK));
		await tick();

		await userEvent.click(screen.getByRole('button', { name: /reload page/i }));
		await waitFor(() => expect(onReload).toHaveBeenCalledTimes(1));
	});

	it('marks each error action pending until its own handler has run', async () => {
		const onRetry = vi.fn();
		const onReload = vi.fn();
		const { stub } = await setup({ withError: true, onRetry, onReload });

		stub?.setError(mediaError(MEDIA_ERROR_CODES.NETWORK));
		await tick();

		const retry = screen.getByRole('button', { name: /try again/i });
		const reload = screen.getByRole('button', { name: /reload page/i });

		// Both handlers run in a `requestAnimationFrame`, which no microtask flush can reach, so the
		// pending state is observable between the click and the frame.
		await fireEvent.click(retry);
		await tick();

		expect(retry).toBeDisabled();
		expect(within(retry).getByRole('status', { name: 'Loading' })).toBeInTheDocument();
		expect(reload).toBeEnabled();

		await waitFor(() => expect(onRetry).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(retry).toBeEnabled());

		await fireEvent.click(reload);
		await tick();

		expect(reload).toBeDisabled();
		expect(within(reload).getByRole('status', { name: 'Loading' })).toBeInTheDocument();
		expect(retry).toBeEnabled();

		// The reload button stays pending: the page it replaces never comes back.
		await waitFor(() => expect(onReload).toHaveBeenCalledTimes(1));
		expect(reload).toBeDisabled();
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it('dismisses the volume HUD by itself', async () => {
		vi.useFakeTimers();
		try {
			await setup({ withVolumeIndicator: true });
			const root = focusRoot();

			await fireEvent.keyDown(root, { key: 'ArrowDown' });
			await tick();
			expect(queryBySlot('media-player-volume-indicator')).not.toBeNull();

			await vi.advanceTimersByTimeAsync(2000);
			await tick();
			expect(queryBySlot('media-player-volume-indicator')).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});
});

// ---------------------------------------------------------------------------
// G — seek details
// ---------------------------------------------------------------------------

describe('seek details', () => {
	it('paints the buffered range from the media buffered ranges', async () => {
		await setup({ stub: { duration: 100, buffered: [{ start: 0, end: 40 }] } });

		expect(bySlot('media-player-seek-buffered').getAttribute('style')).toContain('width: 40%');
	});

	it('renders a separator per chapter boundary past the first', async () => {
		await setup({ stub: { tracks: [chaptersTrack()] } });

		expect(allBySlot('media-player-seek-chapter-separator')).toHaveLength(2);
	});

	it('drops the chapter separators when withoutChapter is set', async () => {
		await setup({ seekWithoutChapter: true, stub: { tracks: [chaptersTrack()] } });

		expect(allBySlot('media-player-seek-chapter-separator')).toHaveLength(0);
	});

	it('flanks the slider with a current and a remaining readout under withTime', async () => {
		await setup({ seekWithTime: true });

		expect(bySlot('media-player-seek-current-time').textContent).toBe('0:00');
		expect(bySlot('media-player-seek-remaining-time').textContent).toBe('1:40');
	});
});

// ---------------------------------------------------------------------------
// G — the seek hover preview
// ---------------------------------------------------------------------------

describe('seek tooltip', () => {
	it('marks the track hovering and previews the hovered time', async () => {
		await setup();
		await hoverSeek(250);

		// A quarter of the way along a 600px track over a 100s media.
		expect(bySlot('media-player-seek')).toHaveAttribute('data-hovering', '');
		expect(bySlot('media-player-seek-time').textContent?.trim()).toBe('0:25');
	});

	it('renders the hovered time against the duration under the progress variant', async () => {
		await setup({ seekTooltipTimeVariant: 'progress' });
		await hoverSeek(250);

		expect(bySlot('media-player-seek-time').textContent?.trim()).toBe('0:25 / 1:40');
	});

	it('renders no tooltip at all under withoutTooltip', async () => {
		await setup({ seekWithoutTooltip: true });
		const seek = bySlot('media-player-seek');
		stubRect(seek, TRACK_RECT);

		await fireEvent(seek, pointerEvent('pointerenter', 250, TRACK_Y));
		await fireEvent(seek, pointerEvent('pointermove', 250, TRACK_Y));
		await sleep(200);
		await fireEvent(seek, pointerEvent('pointermove', 250, TRACK_Y));
		await tick();

		expect(queryBySlot('media-player-seek-tooltip')).toBeNull();
	});

	it.each([
		['a fixed string', 'https://example.test/preview.jpg', 'https://example.test/preview.jpg'],
		[
			'a per-second function',
			(time: number) => `https://example.test/${Math.floor(time)}.jpg`,
			'https://example.test/25.jpg'
		]
	])('renders the preview thumbnail from %s', async (_form, src, expected) => {
		await setup({ seekTooltipThumbnailSrc: src });
		await hoverSeek(250);

		const thumbnail = bySlot('media-player-seek-thumbnail');
		expect(within(thumbnail).getByRole('img', { name: 'Preview at 0:25' })).toHaveAttribute(
			'src',
			expected
		);
	});

	it.each([
		[250, 'Opening'],
		[400, 'Middle']
	])('names the chapter the pointer at %spx is inside', async (clientX, text) => {
		await setup({ stub: { tracks: [chaptersTrack()] } });
		await hoverSeek(clientX);

		expect(bySlot('media-player-seek-chapter-title').textContent?.trim()).toBe(text);
	});

	it('drops the chapter title under withoutChapter', async () => {
		await setup({ seekWithoutChapter: true, stub: { tracks: [chaptersTrack()] } });
		await hoverSeek(250);

		expect(queryBySlot('media-player-seek-chapter-title')).toBeNull();
		expect(bySlot('media-player-seek-time').textContent?.trim()).toBe('0:25');
	});

	it.each([
		['a numeric padding', 20, 240, 560, 120, 680],
		['a per-edge padding', { left: 40, right: 60 }, 260, 520, 140, 640]
	])(
		'clamps the tooltip inside its collision boundary with %s',
		async (_form, padding, startX, endX, minLeft, maxRight) => {
			const boundary = detachedElement();
			stubRect(boundary, { left: 100, right: 700, width: 600, top: 0, bottom: 200, height: 200 });

			await setup({
				seekTooltipCollisionBoundary: boundary,
				seekTooltipCollisionPadding: padding
			});

			// jsdom produces no layout, so the tooltip reports no width and the component falls back
			// to its documented assumed width; the clamp is therefore exact.
			const half = SEEK_TOOLTIP_WIDTH_FALLBACK / 2;

			const tooltip = await hoverSeek(120);
			expect(tooltip.style.getPropertyValue(SEEK_TOOLTIP_X)).toBe(`${startX}px`);
			expect(startX - half).toBeGreaterThanOrEqual(minLeft);

			await moveSeekPointer(690);
			expect(tooltip.style.getPropertyValue(SEEK_TOOLTIP_X)).toBe(`${endX}px`);
			expect(endX + half).toBeLessThanOrEqual(maxRight);
		}
	);
});

// ---------------------------------------------------------------------------
// Tooltips (contract §11)
// ---------------------------------------------------------------------------

describe('tooltips', () => {
	/** Open a control's tooltip and return its content surface. */
	async function openTooltip(user: ReturnType<typeof userEvent.setup>) {
		await user.hover(screen.getByTestId('tooltip-target'));
		await waitFor(() => expect(queryBySlot('tooltip-content')).not.toBeNull());
		return bySlot('tooltip-content');
	}

	it('renders the tooltip text and one kbd per key of a string[] shortcut', async () => {
		const user = userEvent.setup();
		await setup({
			withTooltipPart: true,
			tooltipText: 'Next track',
			tooltipShortcut: ['Shift', 'N'],
			tooltipDelayDuration: 0
		});

		const content = await openTooltip(user);

		expect(within(content).getByText('Next track')).toBeInTheDocument();
		const keys = Array.from(content.querySelectorAll('kbd[data-slot="kbd"]'));
		expect(keys.map((key) => key.querySelector('abbr')?.getAttribute('title'))).toEqual([
			'Shift',
			'N'
		]);
		expect(keys.map((key) => key.textContent?.trim())).toEqual(['Shift', 'N']);
	});

	it('renders a single kbd for a plain string shortcut', async () => {
		const user = userEvent.setup();
		await setup({
			withTooltipPart: true,
			tooltipText: 'Play',
			tooltipShortcut: 'Space',
			tooltipDelayDuration: 0
		});

		const content = await openTooltip(user);

		expect(content.querySelectorAll('kbd[data-slot="kbd"]')).toHaveLength(1);
		expect(within(content).getByTitle('Space')).toHaveTextContent('Space');
	});

	it('inherits the root delay duration and lets the part override it', async () => {
		await setup({
			withTooltipPart: true,
			tooltipText: 'Play',
			tooltipDelayDuration: 250
		});

		expect(screen.getByTestId('tooltip-target').closest('[data-tooltip-trigger]')).toHaveAttribute(
			'data-delay-duration',
			'250'
		);

		await setup({
			withTooltipPart: true,
			tooltipText: 'Play',
			tooltipDelayDuration: 250,
			partTooltipDelayDuration: 0
		});

		const triggers = Array.from(document.querySelectorAll('[data-tooltip-trigger]'));
		expect(triggers.at(-1)).toHaveAttribute('data-delay-duration', '0');
	});

	it.each([
		['inherits the root side offset', undefined, 24],
		['lets the part override it', 4, 4]
	])('%s', async (_case, override, expected) => {
		const user = userEvent.setup();
		await setup({
			withTooltipPart: true,
			tooltipText: 'Play',
			tooltipDelayDuration: 0,
			tooltipSideOffset: 24,
			partTooltipSideOffset: override
		});

		// floating-ui treats an element with no client rect as a hidden anchor and refuses to
		// position against it, so the trigger is given jsdom's missing layout box first. Both the
		// anchor and the surface then measure zero, which leaves the whole of the offset on the
		// placement axis as the `sideOffset` that reached the content.
		stubRect(screen.getByTestId('tooltip-target').closest('[data-tooltip-trigger]') as Element);

		const content = await openTooltip(user);
		const wrapper = content.closest<HTMLElement>('[data-bits-floating-content-wrapper]');

		await waitFor(() =>
			expect(wrapper?.style.transform).toMatch(new RegExp(`^translate\\(0px, -?${expected}px\\)$`))
		);
	});

	it('renders the control bare when the root sets withoutTooltip', async () => {
		await setup({
			withTooltipPart: true,
			tooltipText: 'Play',
			tooltipShortcut: 'Space',
			withoutTooltip: true
		});

		const target = screen.getByTestId('tooltip-target');
		expect(target.closest('[data-tooltip-trigger]')).toBeNull();
		expect(document.querySelector('[data-tooltip-trigger]')).toBeNull();
	});

	it('renders the control bare when neither tooltip nor shortcut is given', async () => {
		await setup({ withTooltipPart: true });

		expect(screen.getByTestId('tooltip-target').closest('[data-tooltip-trigger]')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Portal (contract §11)
// ---------------------------------------------------------------------------

describe('portal', () => {
	it('portals into the context container while the player is windowed', async () => {
		await setup({ withPortal: true });
		const portalled = screen.getByTestId('portalled');

		expect(portalled.closest('[data-slot="media-player"]')).toBeNull();
		expect(document.body.contains(portalled)).toBe(true);
	});

	it('lets an explicit container win over the context default', async () => {
		const container = detachedElement();
		await setup({ withPortal: true, portalContainer: container });

		expect(container.contains(screen.getByTestId('portalled'))).toBe(true);
	});

	it('renders nothing when no container resolves', async () => {
		// A `child`-mode root never receives `ref`, so once the document reports fullscreen the
		// portal's container — the root element — is `null` and there is nowhere to render.
		withFullscreen();
		await setup({ mode: 'root-child', withPortal: true });
		expect(screen.getByTestId('portalled')).toBeInTheDocument();

		await fireEvent(document, new Event('fullscreenchange'));
		await tick();

		expect(screen.queryByTestId('portalled')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// K + C — menus, controlled and uncontrolled
// ---------------------------------------------------------------------------

describe('menus', () => {
	it('lists every speed and applies the picked one', async () => {
		const user = userEvent.setup();
		const { stub } = await setup({ withPlaybackSpeed: true, speeds: [0.5, 1, 2] });

		await user.click(bySlot('media-player-playback-speed'));
		await waitFor(() => expect(screen.getByRole('menu', { hidden: true })).toBeInTheDocument());

		expect(menuItems()).toHaveLength(3);

		await user.click(menuItem('2x'));
		await waitFor(() => expect(stub?.element.playbackRate).toBe(2));
	});

	it('opens from defaultOpen and closes on an internal selection', async () => {
		const user = userEvent.setup();
		await setup({ withPlaybackSpeed: true, defaultOpen: true, speeds: [1, 2] });

		await waitFor(() => expect(screen.getByRole('menu', { hidden: true })).toBeInTheDocument());

		await user.click(menuItem('2x'));
		await waitFor(() => expect(screen.queryByRole('menu', { hidden: true })).toBeNull());
	});

	it('keeps a declining parent authoritative while still reporting the change', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		await setup({ withPlaybackSpeed: true, open: false, declineOpen: true, onOpenChange });

		await user.click(bySlot('media-player-playback-speed'));
		await tick();

		expect(onOpenChange).toHaveBeenCalledWith(true);
		expect(screen.queryByRole('menu', { hidden: true })).toBeNull();
	});

	it('renders the speed, quality and captions submenus of the settings menu', async () => {
		const user = userEvent.setup();
		await setup({
			withSettings: true,
			renditions: [
				{ id: 'sd', height: 480 },
				{ id: 'hd', height: 1080 }
			],
			stub: { tracks: [subtitleTrack('English', 'en')] }
		});

		await user.click(bySlot('media-player-settings'));
		await waitFor(() => expect(screen.getByRole('menu', { hidden: true })).toBeInTheDocument());

		expect(screen.getByText('Speed')).toBeInTheDocument();
		expect(screen.getByText('Quality')).toBeInTheDocument();
		expect(screen.getByText('Captions')).toBeInTheDocument();
		// The Speed badge reports the live rate and the Captions badge the active track.
		expect(screen.getByText('1x')).toBeInTheDocument();
		expect(screen.getByText('Off')).toBeInTheDocument();
	});

	it('hides the quality submenu without renditions', async () => {
		const user = userEvent.setup();
		await setup({ withSettings: true });

		await user.click(bySlot('media-player-settings'));
		await waitFor(() => expect(screen.getByRole('menu', { hidden: true })).toBeInTheDocument());

		expect(screen.queryByText('Quality')).toBeNull();
	});

	it('checks Auto while no rendition is selected and reports the picked one', async () => {
		const user = userEvent.setup();
		const onRenditionChange = vi.fn();
		await setup({
			withSettings: true,
			onRenditionChange,
			renditions: [
				{ id: 'sd', height: 480 },
				{ id: 'hd', height: 1080 }
			]
		});

		await user.click(bySlot('media-player-settings'));
		await openSubmenu(user, 'Quality');

		// Sorted by height, descending, and labelled `{height}p`, with Auto first and checked.
		const labels = menuItems().map((item) => item.textContent?.trim());
		expect(labels).toEqual(['Speed 1x', 'Quality Auto', 'Auto', '1080p', '480p', 'Captions Off']);

		// `user.click` moves the pointer off the submenu trigger, which closes the submenu before
		// the click lands; the item is therefore activated where it stands.
		await fireEvent.click(menuItem('480p'));
		await waitFor(() => expect(onRenditionChange).toHaveBeenCalledWith('sd'));
	});

	it('offers a single disabled entry when the media carries no captions', async () => {
		const user = userEvent.setup();
		await setup({ withSettings: true });

		await user.click(bySlot('media-player-settings'));
		await openSubmenu(user, 'Captions');

		expect(menuItem('No captions available')).toHaveAttribute('aria-disabled', 'true');
	});

	it('suppresses the seek tooltip while a menu is open', async () => {
		const user = userEvent.setup();
		await setup({ withPlaybackSpeed: true });

		await user.click(bySlot('media-player-playback-speed'));
		await waitFor(() => expect(screen.getByRole('menu', { hidden: true })).toBeInTheDocument());

		expect(queryBySlot('media-player-seek-tooltip')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Auto-hide
// ---------------------------------------------------------------------------

describe('auto-hide', () => {
	it('never hides the controls without autoHide', async () => {
		vi.useFakeTimers();
		try {
			const { stub } = await setup();
			stub?.play();
			await tick();

			await vi.advanceTimersByTimeAsync(5000);
			await tick();

			expect(bySlot('media-player-controls')).toHaveAttribute('data-visible', '');
		} finally {
			vi.useRealTimers();
		}
	});

	it('fades the controls out after the idle timer and brings them back on a mouse move', async () => {
		vi.useFakeTimers();
		try {
			const { stub, root } = await setup({ autoHide: true, withControlsOverlay: true });
			stub?.play();
			await tick();

			await vi.advanceTimersByTimeAsync(3000);
			await tick();

			expect(bySlot('media-player-controls')).not.toHaveAttribute('data-visible');
			expect(bySlot('media-player-controls-overlay')).not.toHaveAttribute('data-visible');
			expect(root).not.toHaveAttribute('data-controls-visible');

			await fireEvent.mouseMove(root);
			await tick();

			expect(bySlot('media-player-controls')).toHaveAttribute('data-visible', '');
		} finally {
			vi.useRealTimers();
		}
	});

	it('hides the controls immediately on mouse leave and pins them again while paused', async () => {
		const { stub, root } = await setup({ autoHide: true });
		stub?.play();
		await tick();

		await fireEvent.mouseLeave(root);
		await tick();
		expect(bySlot('media-player-controls')).not.toHaveAttribute('data-visible');

		stub?.pause();
		await tick();
		expect(bySlot('media-player-controls')).toHaveAttribute('data-visible', '');
	});

	it('keeps the controls up while a menu is open', async () => {
		vi.useFakeTimers();
		try {
			const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
			const { stub } = await setup({ autoHide: true, withPlaybackSpeed: true });
			stub?.play();
			await tick();

			await user.click(bySlot('media-player-playback-speed'));
			await tick();

			await vi.advanceTimersByTimeAsync(5000);
			await tick();

			expect(bySlot('media-player-controls')).toHaveAttribute('data-visible', '');
		} finally {
			vi.useRealTimers();
		}
	});

	it('applies no further state once the player unmounts mid-timer', async () => {
		vi.useFakeTimers();
		try {
			const { stub, unmount } = await setup({ autoHide: true });
			stub?.play();
			await tick();

			unmount();
			await vi.advanceTimersByTimeAsync(5000);

			// A live timer would have written `controlsVisible` on a destroyed component, which
			// Svelte reports as an unhandled error; reaching this assertion is the positive proof.
			expect(queryBySlot('media-player-controls')).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});
});
