import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Harness from './is-mobile.test.svelte';
import { DEFAULT_MOBILE_BREAKPOINT, IsMobile } from './is-mobile.svelte.js';

// `IsMobile` reads `mql.matches` rather than `window.innerWidth` (divergence D-04) precisely so a
// test can drive it: `matchMedia` is stubbed with a `MediaQueryList`-shaped object whose `matches`
// is derived from a mutable module-level width and whose `change` listeners are collected.

type ChangeListener = (event: MediaQueryListEvent) => void;

let viewportWidth = 1024;
let queries: FakeMediaQueryList[] = [];

class FakeMediaQueryList {
	readonly media: string;
	readonly listeners = new Set<ChangeListener>();
	removeEventListenerCalls = 0;

	readonly #maxWidth: number;

	constructor(media: string) {
		this.media = media;
		const parsed = /\(max-width:\s*(-?\d+)px\)/.exec(media);
		this.#maxWidth = parsed ? Number(parsed[1]) : Number.NaN;
	}

	get matches(): boolean {
		return Number.isNaN(this.#maxWidth) ? false : viewportWidth <= this.#maxWidth;
	}

	addEventListener(type: string, listener: ChangeListener): void {
		if (type !== 'change') return;
		this.listeners.add(listener);
	}

	removeEventListener(type: string, listener: ChangeListener): void {
		if (type !== 'change') return;
		this.listeners.delete(listener);
		this.removeEventListenerCalls += 1;
	}

	dispatch(): void {
		const event = { matches: this.matches, media: this.media } as MediaQueryListEvent;
		for (const listener of [...this.listeners]) listener(event);
	}
}

async function setViewportWidth(width: number): Promise<void> {
	viewportWidth = width;
	for (const query of [...queries]) query.dispatch();
	await tick();
}

const liveListenerCount = (): number =>
	queries.reduce((total, query) => total + query.listeners.size, 0);

const reportedCurrent = (): string => screen.getByTestId('is-mobile').textContent ?? '';

beforeEach(() => {
	viewportWidth = 1024;
	queries = [];
	vi.stubGlobal('matchMedia', (media: string) => {
		const query = new FakeMediaQueryList(media);
		queries.push(query);
		return query as unknown as MediaQueryList;
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('useIsMobile', () => {
	it('exposes the upstream default breakpoint', () => {
		expect(DEFAULT_MOBILE_BREAKPOINT).toBe(768);
	});

	it('queries (max-width: 767px) for the default breakpoint', async () => {
		render(Harness);
		await tick();

		expect(queries.map((query) => query.media)).toEqual(['(max-width: 767px)']);
	});

	it('returns an IsMobile instance seeded false for SSR parity', async () => {
		viewportWidth = 480;
		let instance: IsMobile | undefined;
		let currentAtInit: boolean | undefined;
		render(Harness, {
			props: {
				onInstance: (isMobile) => {
					instance = isMobile;
					// Read during component initialisation, before the effect has run: `current` is
					// seeded `false`, mirroring upstream's `!!undefined` first render.
					currentAtInit = isMobile.current;
				}
			}
		});

		expect(instance).toBeInstanceOf(IsMobile);
		expect(currentAtInit).toBe(false);

		await tick();
		expect(instance?.current).toBe(true);
	});

	it('tracks the stubbed MediaQueryList through its change events', async () => {
		render(Harness);
		await tick();
		expect(reportedCurrent()).toBe('false');

		await setViewportWidth(480);
		expect(reportedCurrent()).toBe('true');

		await setViewportWidth(1024);
		expect(reportedCurrent()).toBe('false');
	});

	it('corrects current from matches on mount when the viewport is already narrow', async () => {
		viewportWidth = 480;
		render(Harness);
		await tick();

		expect(reportedCurrent()).toBe('true');
	});

	it('registers exactly one change listener and removes it on unmount', async () => {
		const { unmount } = render(Harness);
		await tick();
		expect(liveListenerCount()).toBe(1);

		unmount();
		await tick();

		expect(liveListenerCount()).toBe(0);
		expect(queries[0]?.removeEventListenerCalls).toBe(1);
	});

	it('recreates the query when the breakpoint getter changes', async () => {
		const { rerender } = render(Harness, { props: { breakpoint: 768 } });
		await tick();
		expect(queries.map((query) => query.media)).toEqual(['(max-width: 767px)']);
		expect(reportedCurrent()).toBe('false');

		await rerender({ breakpoint: 1280 });
		await tick();

		expect(queries.map((query) => query.media)).toEqual([
			'(max-width: 767px)',
			'(max-width: 1279px)'
		]);
		expect(queries[0]?.listeners.size).toBe(0);
		expect(liveListenerCount()).toBe(1);
		// 1024px is desktop at 768 but mobile at 1280.
		expect(reportedCurrent()).toBe('true');
	});

	it('stays false and does not throw when matchMedia is unavailable', async () => {
		vi.stubGlobal('matchMedia', undefined);

		expect(() => render(Harness)).not.toThrow();
		await tick();

		expect(reportedCurrent()).toBe('false');
		expect(queries).toHaveLength(0);
	});
});
