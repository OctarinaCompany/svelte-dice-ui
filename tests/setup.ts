import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/svelte';
import { afterEach, beforeAll, vi } from 'vitest';

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
