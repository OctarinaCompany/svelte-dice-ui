import { vi, type Mock } from 'vitest';

/**
 * jsdom implements the media element's *properties* but no playback pipeline: `play()` raises
 * "Not implemented", `duration` is a read-only `NaN`, and `buffered` / `seekable` are always empty.
 * Every assertion about seeking, volume, buffering or errors would therefore be meaningless.
 *
 * This module installs a fake media surface per test. It shims the *environment*, never an
 * assertion, a config or a type check (research R-19), and is not collected by Vitest — the
 * `include` glob is `src/**\/*.{test,spec}.{js,ts}` — nor listed in `registry.json`.
 */

/**
 * Give `element` a fixed layout box. jsdom performs no layout, so `getBoundingClientRect()` answers
 * an all-zero rect for everything and `getClientRects()` an empty list; the seek bar's hover maths
 * divides by the track width, and floating-ui treats a box-less anchor as hidden and never
 * positions against it.
 */
export function stubRect(element: Element, rect: Partial<DOMRect> = {}): void {
	const box = {
		x: rect.left ?? 0,
		y: rect.top ?? 0,
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		width: 0,
		height: 0,
		...rect
	};

	const read = () => ({ ...box, toJSON: () => box }) as DOMRect;

	Object.defineProperty(element, 'getBoundingClientRect', { configurable: true, value: read });
	Object.defineProperty(element, 'getClientRects', {
		configurable: true,
		value: () => Object.assign([read()] as unknown as DOMRectList, { item: read })
	});
}

/** A settable `TimeRanges`. */
function timeRanges(ranges: readonly { start: number; end: number }[]): TimeRanges {
	return {
		length: ranges.length,
		start: (index: number) => ranges[index]?.start ?? 0,
		end: (index: number) => ranges[index]?.end ?? 0
	};
}

/** The four `MediaError` codes, matching the DOM constants. */
export const MEDIA_ERROR_CODES = {
	ABORTED: 1,
	NETWORK: 2,
	DECODE: 3,
	SRC_NOT_SUPPORTED: 4
} as const;

/** Build a `MediaError`-shaped value; jsdom exposes no constructible `MediaError`. */
export function mediaError(code: number, message = ''): MediaError {
	return { code, message } as MediaError;
}

/** A `TextTrackCue` carrying the `text` only `VTTCue` declares. */
export class FakeTextTrackCue extends EventTarget {
	startTime: number;
	endTime: number;
	text: string;
	id = '';

	constructor(startTime: number, endTime: number, text: string) {
		super();
		this.startTime = startTime;
		this.endTime = endTime;
		this.text = text;
	}
}

/** A `TextTrack` whose `mode` writes notify the owning list, exactly as the DOM's does. */
export class FakeTextTrack extends EventTarget {
	id: string;
	kind: TextTrackKind;
	label: string;
	language: string;
	cues: FakeTextTrackCue[] | null;

	#mode: TextTrackMode = 'disabled';
	#list: FakeTextTrackList | null = null;

	constructor(init: {
		id?: string;
		kind: TextTrackKind;
		label?: string;
		language?: string;
		mode?: TextTrackMode;
		cues?: FakeTextTrackCue[];
	}) {
		super();
		this.id = init.id ?? init.label ?? init.kind;
		this.kind = init.kind;
		this.label = init.label ?? '';
		this.language = init.language ?? '';
		this.cues = init.cues ?? null;
		this.#mode = init.mode ?? 'disabled';
	}

	get mode(): TextTrackMode {
		return this.#mode;
	}

	set mode(next: TextTrackMode) {
		if (this.#mode === next) return;
		this.#mode = next;
		this.#list?.dispatchEvent(new Event('change'));
	}

	/** @internal */
	attach(list: FakeTextTrackList) {
		this.#list = list;
	}
}

/** A `TextTrackList` supporting indexed access, `length` and the three list events. */
export class FakeTextTrackList extends EventTarget {
	#tracks: FakeTextTrack[] = [];

	get length(): number {
		return this.#tracks.length;
	}

	add(track: FakeTextTrack) {
		track.attach(this);
		this.#tracks.push(track);
		Object.defineProperty(this, String(this.#tracks.length - 1), {
			value: track,
			configurable: true,
			enumerable: true
		});
		this.dispatchEvent(new Event('addtrack'));
	}

	item(index: number): FakeTextTrack | undefined {
		return this.#tracks[index];
	}
}

export type MediaStubOptions = {
	/** @default 100 */
	duration?: number;
	/** @default 1 */
	volume?: number;
	/** @default false */
	muted?: boolean;
	/** @default "https://example.test/media.mp4" */
	currentSrc?: string;
	/** Buffered ranges. @default one range covering half the duration */
	buffered?: readonly { start: number; end: number }[];
	/** Text tracks to install before the player mounts. */
	tracks?: FakeTextTrack[];
};

export type MediaStub = {
	element: HTMLMediaElement;
	play: Mock<() => Promise<void>>;
	pause: Mock<() => void>;
	load: Mock<() => void>;
	tracks: FakeTextTrackList;
	/** Dispatch a bare media event, e.g. `waiting`, `stalled`, `playing`, `error`. */
	fire(type: string): void;
	/** Replace the reported duration and announce it. */
	setDuration(seconds: number): void;
	/** Report an error and announce it. */
	setError(error: MediaError | null): void;
	/** Add a text track after mount, announcing it on the list. */
	addTrack(track: FakeTextTrack): void;
	/** Make `play()` reject, as an autoplay policy would. */
	rejectPlay(reason?: unknown): void;
};

/**
 * Replace `element`'s media surface with a settable one. Instance properties shadow jsdom's
 * prototype getters, so nothing global is touched and `cleanup()` disposes of it with the element.
 */
export function installMediaStub(
	element: HTMLMediaElement,
	options: MediaStubOptions = {}
): MediaStub {
	let duration = options.duration ?? 100;
	let currentTime = 0;
	let volume = options.volume ?? 1;
	let muted = options.muted ?? false;
	let playbackRate = 1;
	let loop = false;
	let paused = true;
	let ended = false;
	const seeking = false;
	const readyState = 4;
	let error: MediaError | null = null;
	const buffered = options.buffered ?? [{ start: 0, end: 50 }];
	let playRejection: unknown = null;

	const tracks = new FakeTextTrackList();
	for (const track of options.tracks ?? []) tracks.add(track);

	const fire = (type: string) => {
		element.dispatchEvent(new Event(type));
	};

	const define = (name: string, descriptor: PropertyDescriptor) => {
		Object.defineProperty(element, name, { configurable: true, ...descriptor });
	};

	define('duration', {
		get: () => duration
	});
	define('currentTime', {
		get: () => currentTime,
		set: (next: number) => {
			if (currentTime === next) return;
			currentTime = next;
			fire('timeupdate');
		}
	});
	define('volume', {
		get: () => volume,
		set: (next: number) => {
			if (volume === next) return;
			volume = next;
			fire('volumechange');
		}
	});
	define('muted', {
		get: () => muted,
		set: (next: boolean) => {
			if (muted === next) return;
			muted = next;
			fire('volumechange');
		}
	});
	define('playbackRate', {
		get: () => playbackRate,
		set: (next: number) => {
			if (playbackRate === next) return;
			playbackRate = next;
			fire('ratechange');
		}
	});
	define('loop', {
		get: () => loop,
		// `loop` is a reflected IDL attribute, so a property write updates the content attribute —
		// which is what the player's `MutationObserver` watches (FR-017).
		set: (next: boolean) => {
			loop = next;
			if (next) element.setAttribute('loop', '');
			else element.removeAttribute('loop');
		}
	});
	define('paused', { get: () => paused });
	define('ended', { get: () => ended });
	define('seeking', { get: () => seeking });
	define('readyState', { get: () => readyState });
	define('error', { get: () => error });
	define('currentSrc', { get: () => options.currentSrc ?? 'https://example.test/media.mp4' });
	define('buffered', { get: () => timeRanges(buffered) });
	define('seekable', { get: () => timeRanges([{ start: 0, end: duration }]) });
	// The fake list implements exactly the surface the player reads: `length`, indexed access and
	// the three list events. jsdom's own `TextTrackList` is neither constructible nor mutable.
	define('textTracks', { get: () => tracks as unknown as TextTrackList });

	const play = vi.fn(() => {
		if (playRejection !== null) return Promise.reject(playRejection);
		if (paused) {
			paused = false;
			ended = false;
			// `playing` is a *later* event in the real pipeline — fire it from the spec when the
			// media is supposed to have actually started.
			fire('play');
		}
		return Promise.resolve();
	});
	const pause = vi.fn(() => {
		if (!paused) {
			paused = true;
			fire('pause');
		}
	});
	const load = vi.fn(() => {
		error = null;
		fire('emptied');
		fire('loadstart');
	});

	define('play', { value: play, writable: true });
	define('pause', { value: pause, writable: true });
	define('load', { value: load, writable: true });

	return {
		element,
		play,
		pause,
		load,
		tracks,
		fire,
		setDuration(seconds: number) {
			duration = seconds;
			fire('durationchange');
		},
		setError(next: MediaError | null) {
			error = next;
			fire(next ? 'error' : 'emptied');
		},
		addTrack(track: FakeTextTrack) {
			tracks.add(track);
		},
		rejectPlay(reason: unknown = new Error('play refused')) {
			playRejection = reason;
		}
	};
}

/**
 * Stub the Fullscreen API on `document` and the player root. Returns the teardown, plus setters the
 * spec uses to drive `fullscreenElement` the way the browser would.
 */
export function installFullscreenStub() {
	const original = Object.getOwnPropertyDescriptor(Document.prototype, 'fullscreenElement');
	let fullscreenElement: Element | null = null;

	Object.defineProperty(document, 'fullscreenElement', {
		configurable: true,
		get: () => fullscreenElement
	});

	function enter(element: Element) {
		fullscreenElement = element;
		document.dispatchEvent(new Event('fullscreenchange'));
	}

	const requestFullscreen = vi.fn(function (this: Element) {
		enter(this);
		return Promise.resolve();
	});
	const exitFullscreen = vi.fn(() => {
		fullscreenElement = null;
		document.dispatchEvent(new Event('fullscreenchange'));
		return Promise.resolve();
	});

	Element.prototype.requestFullscreen = requestFullscreen;
	document.exitFullscreen = exitFullscreen;

	return {
		requestFullscreen,
		exitFullscreen,
		get element() {
			return fullscreenElement;
		},
		restore() {
			if (original) Object.defineProperty(document, 'fullscreenElement', original);
			else Reflect.deleteProperty(document, 'fullscreenElement');
		}
	};
}

/** Stub the Picture-in-Picture API on a video element and on `document`. */
export function installPipStub(video: HTMLVideoElement) {
	let pictureInPictureElement: Element | null = null;

	Object.defineProperty(document, 'pictureInPictureElement', {
		configurable: true,
		get: () => pictureInPictureElement
	});

	const requestPictureInPicture = vi.fn(() => {
		pictureInPictureElement = video;
		video.dispatchEvent(new Event('enterpictureinpicture'));
		return Promise.resolve({} as PictureInPictureWindow);
	});
	const exitPictureInPicture = vi.fn(() => {
		pictureInPictureElement = null;
		video.dispatchEvent(new Event('leavepictureinpicture'));
		return Promise.resolve();
	});

	Object.defineProperty(video, 'requestPictureInPicture', {
		configurable: true,
		writable: true,
		value: requestPictureInPicture
	});
	document.exitPictureInPicture = exitPictureInPicture;

	return {
		requestPictureInPicture,
		exitPictureInPicture,
		enter() {
			pictureInPictureElement = video;
		},
		restore() {
			Reflect.deleteProperty(document, 'pictureInPictureElement');
		}
	};
}
