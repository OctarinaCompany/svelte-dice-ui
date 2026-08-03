import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/svelte';
import { afterEach, beforeAll, beforeEach, vi } from 'vitest';

// jsdom implements neither of these, and Bits UI primitives (and therefore every
// ported Dice UI component built on top of them) rely on both.
beforeAll(() => {
	globalThis.ResizeObserver ??= class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	};

	if (!Element.prototype.hasPointerCapture) {
		Element.prototype.hasPointerCapture = () => false;
		Element.prototype.setPointerCapture = () => {};
		Element.prototype.releasePointerCapture = () => {};
	}

	if (!Element.prototype.scrollIntoView) {
		Element.prototype.scrollIntoView = () => {};
	}

	// jsdom implements `Range` but performs no layout, so it ships neither of these. Anything that
	// anchors a floating surface to a text selection (`selection-toolbar`) measures the range, so
	// the two missing methods answer with the same all-zero box jsdom returns for elements.
	if (!Range.prototype.getBoundingClientRect) {
		Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
		Range.prototype.getClientRects = () =>
			Object.assign([] as unknown as DOMRectList, { item: () => null });
	}

	globalThis.matchMedia ??= ((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false
	})) as unknown as typeof globalThis.matchMedia;
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

/**
 * Drop dismissible layers left behind by a previous spec.
 *
 * `bits-ui` arms a 1ms timer when a floating layer is enabled, whose callback re-registers the layer
 * in a module-global stack. The timer is not cancelled on teardown, so a component destroyed inside
 * that window has its layer put *back* after `onDestroyEffect` removed it — permanently, with its
 * document listeners still attached (huntabyte/bits-ui#2080).
 *
 * That matters here because `isResponsibleLayer()` only ever consults the topmost entry: once a dead
 * layer sits on top, a live layer's outside-interaction handler decides it is not responsible and
 * returns silently — no callback, no close, no error. Whether the dead entry or the live one ends up
 * last depends on timing, which is why it surfaced as a spec that passed locally and failed on a
 * slower CI runner.
 *
 * This runs before each spec, when nothing is mounted and every entry is stale by definition. It
 * asserts nothing and relaxes nothing — it stops one spec's leak from reaching the next.
 */
beforeEach(() => {
	const layers = (
		globalThis as {
			bitsDismissableLayers?: Map<{ opts?: { ref?: { current?: Element | null } } }, unknown>;
		}
	).bitsDismissableLayers;
	if (!layers) return;

	for (const layer of [...layers.keys()]) {
		if (!layer?.opts?.ref?.current?.isConnected) layers.delete(layer);
	}
});
