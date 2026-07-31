import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
	computeSpotlight,
	DEFAULT_ALIGN_OFFSET,
	DEFAULT_SCROLL_OFFSET,
	DEFAULT_SIDE_OFFSET,
	DEFAULT_SPOTLIGHT_PADDING,
	getDefaultScrollBehavior,
	isTargetInViewport,
	resolveTarget,
	scrollTargetIntoView,
	TOUR_ALIGNS,
	TOUR_SIDES,
	TourArrow,
	TourStep,
	TourStepRegistry,
	type TourStepData
} from './index.js';
import Harness, {
	TOUR_HARNESS_TARGET_IDS,
	type TourHarnessApi,
	type TourHarnessChildPart,
	type TourHarnessPart,
	type TourHarnessProps
} from './tour.test.svelte';

/** jsdom's viewport, which every geometry expectation below is derived from. */
const VIEWPORT = { width: window.innerWidth, height: window.innerHeight };

/** Nodes a spec appended to `document.body` itself, torn down after testing-library's cleanup. */
const hosts: HTMLElement[] = [];

afterEach(() => {
	for (const host of hosts.splice(0)) host.remove();
});

/**
 * jsdom performs no layout, so `bits-ui`'s floating layer never reports itself as positioned and
 * leaves `visibility: hidden` on its wrapper — reproducible with a bare
 * `<Popover.Content customAnchor=… />`, and never observable in a browser. jsdom's
 * `getComputedStyle` inherits that down to every control in the card, which would make both the
 * accessibility tree and `bits-ui`'s own focus scope treat the whole card as hidden.
 *
 * Overriding that one declaration restores the browser's behaviour, so the role, accessible-name
 * and focus assertions below measure the component rather than the environment (research R-10).
 * Everything else about the layer renders exactly as it ships.
 */
beforeAll(() => {
	const style = document.createElement('style');
	style.textContent = '[data-bits-floating-content-wrapper] { visibility: visible !important; }';
	document.head.appendChild(style);
});

function createHost(): HTMLElement {
	const host = document.createElement('div');
	document.body.appendChild(host);
	hosts.push(host);
	return host;
}

function setup(props: TourHarnessProps = {}) {
	return render(Harness, { props });
}

/** Render, and hand back the imperative handle the harness publishes during initialisation. */
function setupWithApi(props: TourHarnessProps = {}) {
	let api: TourHarnessApi | undefined;
	const result = render(Harness, {
		props: { ...props, registerApi: (published) => (api = published) }
	});

	if (!api) throw new Error('the harness never published its imperative API');
	return { ...result, api };
}

/**
 * The step card is portalled outside the render container, so every query goes through `screen`.
 *
 * `hidden: true` is load-bearing: jsdom performs no layout, so `bits-ui`'s floating layer never
 * reports itself as positioned and leaves `visibility: hidden` on its wrapper — reproducible with a
 * bare `<Popover.Content customAnchor=… />` and never observable in a browser. Opting into
 * accessibility-hidden elements keeps these role and accessible-name assertions honest here
 * (research R-10).
 */
function card(): HTMLElement {
	const found = queryCard();
	if (!found) throw new Error('no step card was rendered');
	return found;
}

/**
 * The open card, if there is one. A step that has just stopped being current stays mounted for the
 * length of its exit presence, so "the card" is specifically the one reporting `data-state="open"`.
 */
function queryCard(): HTMLElement | null {
	const cards = screen.queryAllByRole('dialog');
	return cards.find((element) => element.getAttribute('data-state') === 'open') ?? cards[0] ?? null;
}

/** A control inside the step card, queried by its documented accessible name. */
function control(name: string): HTMLElement {
	return within(card()).getByRole('button', { name });
}

/** The one part with `slot` inside the open card, or — for the root and the overlay — in the page. */
function bySlot(slot: string): HTMLElement {
	const element = queryBySlot(slot);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function allBySlot(slot: string): HTMLElement[] {
	const open = queryCard();
	const scope = open?.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`);
	if (scope && scope.length > 0) return Array.from(scope);

	return Array.from(document.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`)).filter(
		(element) => element.closest('[role="dialog"][data-state="closed"]') === null
	);
}

function queryBySlot(slot: string): HTMLElement | null {
	return allBySlot(slot)[0] ?? null;
}

/** The positioned wrapper `bits-ui`'s floating layer puts around the open step card. */
function floatingWrapper(): HTMLElement {
	const wrapper = card().closest<HTMLElement>('[data-bits-floating-content-wrapper]');
	if (!wrapper) throw new Error('the step card is not inside a floating wrapper');
	return wrapper;
}

/**
 * Where the floating layer has placed `element`. Throws — and so keeps a `waitFor` retrying — while
 * the layer is still measuring, which it signals with a `translate(0, -200%)` parking transform.
 */
function translateOf(element: HTMLElement): { x: number; y: number } {
	const match = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(styleOf(element));
	if (!match)
		throw new Error(`the floating layer has not placed the card yet: ${styleOf(element)}`);
	return { x: Number(match[1]), y: Number(match[2]) };
}

function nextButton(): HTMLElement {
	return bySlot('tour-next');
}

function prevButton(): HTMLElement {
	return bySlot('tour-prev');
}

function styleOf(element: HTMLElement): string {
	return element.getAttribute('style') ?? '';
}

/**
 * Waits out both asynchronous gaps in `bits-ui`'s layer stack: the `afterSleep(1)` before the
 * dismissible layer attaches its listeners, and the 10 ms debounce it puts on an outside
 * interaction (the `selection-toolbar` precedent).
 */
async function settle(): Promise<void> {
	await tick();
	await new Promise((resolve) => setTimeout(resolve, 30));
	await tick();
}

/**
 * jsdom performs no layout, so `getBoundingClientRect()` answers all zeros for everything. Every
 * geometry assertion here stubs it per element id and restores it in `tests/setup.ts`'s
 * `vi.restoreAllMocks()` (research R-10).
 */
function stubRects(rects: Record<string, DOMRect>): void {
	vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
		return rects[this.id] ?? FALLBACK_RECT;
	});
}

/**
 * Everything the spec did not name a box for, including the step card itself. It sits away from the
 * origin on purpose: `bits-ui`'s dismissible layer only treats a press as outside when its
 * coordinates fall outside the card's rect, and jsdom reports `(0, 0)` for every synthetic pointer
 * event, so an all-zero card would swallow every outside interaction.
 */
const FALLBACK_RECT = new DOMRect(200, 400, 320, 200);

/** What `document.documentElement` and `document.body` measure once {@link stubLayout} is in force. */
const VIEWPORT_RECT = new DOMRect(0, 0, VIEWPORT.width, VIEWPORT.height);

/**
 * {@link stubRects} plus the two further readings `bits-ui` and Floating UI take before they will
 * place anything: `getClientRects()`, which `bits-ui` reads as "is the anchor still on screen" and
 * which jsdom answers empty for *every* element, and the document element's client box, which jsdom
 * reports as `0 × 0` and which Floating UI would otherwise treat as a zero-sized viewport.
 *
 * Without it the layer parks the card at `translate(0, -200%)` forever and nothing about placement —
 * the resolved offsets, or `hideWhenDetached` — is observable. With it the arithmetic runs exactly
 * as it ships, against the boxes the spec declared (research R-10).
 */
function stubLayout(rects: Record<string, DOMRect>): void {
	function rectFor(element: Element): DOMRect {
		if (element === document.documentElement || element === document.body) return VIEWPORT_RECT;
		return rects[element.id] ?? FALLBACK_RECT;
	}

	vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
		return rectFor(this);
	});
	vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
		const rect = rectFor(this);
		return Object.assign([rect] as unknown as DOMRectList, { item: () => rect });
	});
	vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(VIEWPORT.width);
	vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(VIEWPORT.height);
}

/** The three harness targets, each with a distinct box, so a moved spotlight is observable. */
const TARGET_RECTS: Record<string, DOMRect> = {
	[TOUR_HARNESS_TARGET_IDS[0]]: new DOMRect(50, 100, 100, 50),
	[TOUR_HARNESS_TARGET_IDS[1]]: new DOMRect(300, 200, 80, 40),
	[TOUR_HARNESS_TARGET_IDS[2]]: new DOMRect(600, 300, 60, 30)
};

/** What the ring's inline style must read for a target box, at the default padding of `4`. */
function ringStyleFor(rect: DOMRect, padding = DEFAULT_SPOTLIGHT_PADDING): string {
	const { rect: box } = computeSpotlight(rect, padding, VIEWPORT);
	return `left: ${box.x}px; top: ${box.y}px; width: ${box.width}px; height: ${box.height}px`;
}

/** A minimal step record; only the fields a spec cares about need overriding. */
function stepRecord(overrides: Partial<TourStepData> = {}): TourStepData {
	return {
		target: '#tour-target-0',
		side: 'bottom',
		sideOffset: DEFAULT_SIDE_OFFSET,
		align: 'center',
		alignOffset: DEFAULT_ALIGN_OFFSET,
		collisionBoundary: [],
		collisionPadding: 0,
		arrowPadding: 0,
		sticky: 'partial',
		hideWhenDetached: false,
		avoidCollisions: true,
		required: false,
		...overrides
	};
}

// ---------------------------------------------------------------------------
// Roles, ARIA and accessible names (T004, FR-011a, FR-021, contracts §4)
// ---------------------------------------------------------------------------

describe('Tour roles and ARIA', () => {
	it('exposes the step card as a modal dialog named by its title and described by its description', () => {
		setup({ defaultOpen: true });

		const dialog = screen.getByRole('dialog', { name: 'Step 1' });
		expect(dialog).toHaveAttribute('aria-modal', 'true');

		const titleId = bySlot('tour-title').id;
		const descriptionId = bySlot('tour-description').id;
		expect(dialog).toHaveAttribute('aria-labelledby', titleId);
		expect(dialog).toHaveAttribute('aria-describedby', descriptionId);
		expect(titleId).not.toBe('');
		expect(descriptionId).not.toBe('');
	});

	it('lets a caller supply the title and description ids, and keeps the wiring', () => {
		setup({ defaultOpen: true, titleId: 'my-title', descriptionId: 'my-description' });

		expect(bySlot('tour-title')).toHaveAttribute('id', 'my-title');
		expect(bySlot('tour-description')).toHaveAttribute('id', 'my-description');
		expect(card()).toHaveAttribute('aria-labelledby', 'my-title');
		expect(card()).toHaveAttribute('aria-describedby', 'my-description');
	});

	it('drops `aria-modal` when the tour is not modal', () => {
		setup({ defaultOpen: true, modal: false });

		expect(card()).not.toHaveAttribute('aria-modal');
	});

	it('gives every control its documented accessible name', () => {
		setup({ defaultOpen: true, withSkip: true });

		expect(control('Close tour')).toBe(bySlot('tour-close'));
		expect(control('Previous step')).toBe(prevButton());
		expect(control('Next step')).toBe(nextButton());
		expect(control('Skip tour')).toBe(bySlot('tour-skip'));
	});

	it('names `Tour.Next` after its visible label on the last step', async () => {
		const user = userEvent.setup();
		setup({ defaultOpen: true, stepCount: 2 });

		expect(nextButton()).toHaveAttribute('aria-label', 'Next step');

		await user.click(nextButton());

		expect(nextButton()).toHaveTextContent('Finish');
		expect(nextButton()).toHaveAttribute('aria-label', 'Finish tour');
	});

	it('renders the step counter through the default format', () => {
		setup({ defaultOpen: true });

		expect(bySlot('tour-step-counter')).toHaveTextContent('1 / 3');
	});

	it('lets a caller-supplied `format` replace the counter text', () => {
		setup({
			defaultOpen: true,
			counterFormat: (current, total) => `Step ${current} of ${total}`
		});

		expect(bySlot('tour-step-counter')).toHaveTextContent('Step 1 of 3');
	});

	it('carries the documented `data-slot` on every rendered part', () => {
		setup({ defaultOpen: true, withSkip: true, withArrow: true });

		for (const slot of [
			'tour',
			'tour-spotlight',
			'tour-spotlight-ring',
			'tour-step',
			'tour-arrow',
			'tour-header',
			'tour-title',
			'tour-description',
			'tour-close',
			'tour-footer',
			'tour-step-counter',
			'tour-prev',
			'tour-next',
			'tour-skip'
		]) {
			expect(queryBySlot(slot), `missing [data-slot="${slot}"]`).not.toBeNull();
		}
	});
});

// ---------------------------------------------------------------------------
// Guided walkthrough (T004a, US1, FR-003/004/005)
// ---------------------------------------------------------------------------

describe('Tour guided walkthrough', () => {
	it('spotlights the first step and shows exactly one card', () => {
		stubRects(TARGET_RECTS);
		setup({ defaultOpen: true });

		expect(allBySlot('tour-step')).toHaveLength(1);
		expect(card()).toHaveTextContent('Step 1');
		expect(card()).toHaveTextContent('Description 1');
		expect(bySlot('tour-step-counter')).toHaveTextContent('1 / 3');

		expect(bySlot('tour-spotlight')).toHaveAttribute('data-state', 'open');
		expect(styleOf(bySlot('tour-spotlight-ring'))).toContain(
			ringStyleFor(TARGET_RECTS[TOUR_HARNESS_TARGET_IDS[0]])
		);
	});

	it('moves the card, the counter and the spotlight to the next target', async () => {
		stubRects(TARGET_RECTS);
		const user = userEvent.setup();
		setup({ defaultOpen: true });

		await user.click(nextButton());

		expect(allBySlot('tour-step')).toHaveLength(1);
		expect(card()).toHaveTextContent('Step 2');
		expect(bySlot('tour-step-counter')).toHaveTextContent('2 / 3');
		expect(styleOf(bySlot('tour-spotlight-ring'))).toContain(
			ringStyleFor(TARGET_RECTS[TOUR_HARNESS_TARGET_IDS[1]])
		);
	});

	it('goes back with `Prev`, which is disabled again at the first step', async () => {
		const user = userEvent.setup();
		setup({ defaultOpen: true });

		expect(prevButton()).toBeDisabled();

		await user.click(nextButton());
		expect(prevButton()).toBeEnabled();

		await user.click(prevButton());
		expect(card()).toHaveTextContent('Step 1');
		expect(prevButton()).toBeDisabled();
	});

	it('completes exactly once on the last step, closes, and never skips', async () => {
		const user = userEvent.setup();
		const onComplete = vi.fn();
		const onSkip = vi.fn();
		setup({ defaultOpen: true, stepCount: 2, onComplete, onSkip });

		await user.click(nextButton());
		await user.click(nextButton());

		expect(onComplete).toHaveBeenCalledTimes(1);
		expect(onSkip).not.toHaveBeenCalled();
		await waitFor(() => expect(queryCard()).not.toBeInTheDocument());
	});
});

// ---------------------------------------------------------------------------
// Keyboard interaction and focus (T005, US2, FR-011/012/013)
// ---------------------------------------------------------------------------

describe('Tour keyboard interaction', () => {
	it('moves focus into the card on open', async () => {
		setup({ defaultOpen: true });

		await waitFor(() => expect(card().contains(document.activeElement)).toBe(true));
	});

	it('keeps `Tab` inside the step card, never reaching the page behind it', async () => {
		// `delay: null`, for the same reason as the `Enter` test below: `bits-ui`'s focus scope
		// reclaims focus to the card whenever it cannot rank the card's controls by measured
		// visibility, which under jsdom is always. The default delay yields between the keydown and
		// the focus change, leaving the scope a window to steal focus back — which made this
		// assertion fail roughly one run in five.
		const user = userEvent.setup({ delay: null });
		setup({ defaultOpen: true });
		await settle();

		// `Prev` is disabled on the first step, so the card's tabbables are `Close` then `Next`.
		const close = bySlot('tour-close');
		close.focus();
		expect(close).toHaveFocus();

		await user.tab();

		expect(nextButton()).toHaveFocus();
		expect(card().contains(document.activeElement)).toBe(true);
		expect(screen.getByTestId('outside-button')).not.toHaveFocus();
		expect(screen.getByTestId('tour-trigger')).not.toHaveFocus();
	});

	it('keeps `Shift+Tab` inside the step card', async () => {
		const user = userEvent.setup();
		setup({ defaultOpen: true });
		await settle();

		const close = bySlot('tour-close');
		close.focus();
		expect(close).toHaveFocus();

		await user.tab({ shift: true });

		// The wrap at the very edge of the card belongs to `bits-ui`'s focus scope, which ranks its
		// candidates by measured visibility and therefore cannot be driven under jsdom (research
		// R-10). What is asserted here is the part that matters and *is* observable: neither
		// direction reaches the dimmed page behind the card.
		expect(card().contains(document.activeElement)).toBe(true);
		expect(screen.getByTestId('tour-trigger')).not.toHaveFocus();
		expect(screen.getByTestId('outside-button')).not.toHaveFocus();
	});

	it('activates the focused control with `Enter`', async () => {
		// `delay: null` runs the key sequence without yielding between events. `bits-ui`'s focus scope
		// reclaims focus to the card whenever it cannot rank the card's controls by measured
		// visibility — which under jsdom is always — and the default delay leaves it a window to do
		// so between focusing a control and pressing the key.
		const user = userEvent.setup({ delay: null });
		setup({ defaultOpen: true });
		await settle();

		nextButton().focus();
		expect(nextButton()).toHaveFocus();

		await user.keyboard('{Enter}');

		await waitFor(() => expect(card()).toHaveTextContent('Step 2'));
	});

	it('activates the focused control with `Space`', async () => {
		const user = userEvent.setup({ delay: null });
		const onSkip = vi.fn();
		setup({ defaultOpen: true, onSkip });
		await settle();

		const close = bySlot('tour-close');
		close.focus();
		expect(close).toHaveFocus();

		await user.keyboard('[Space]');

		expect(onSkip).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(queryCard()).toBeNull());
	});

	it('closes on `Escape` and reports it through `onEscapeKeyDown`', async () => {
		const user = userEvent.setup();
		const onEscapeKeyDown = vi.fn();
		setup({ defaultOpen: true, onEscapeKeyDown });

		await user.keyboard('{Escape}');

		expect(onEscapeKeyDown).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(queryCard()).not.toBeInTheDocument());
	});

	it('leaves the tour open when `onEscapeKeyDown` prevents the default', async () => {
		const user = userEvent.setup();
		setup({
			defaultOpen: true,
			onEscapeKeyDown: (event) => event.preventDefault()
		});

		await user.keyboard('{Escape}');

		expect(card()).toBeInTheDocument();
	});

	it('returns focus to the element that held it before the tour opened', async () => {
		const user = userEvent.setup();
		setupWithApi({ boundOpen: true });

		const trigger = screen.getByTestId('tour-trigger');
		trigger.focus();
		expect(trigger).toHaveFocus();

		await user.click(trigger);

		// Assert focus really left the trigger first — a bare "focus came back" would pass even if
		// the tour never took focus at all (quickstart.md's teardown-assertion warning).
		await waitFor(() => expect(card().contains(document.activeElement)).toBe(true));
		expect(trigger).not.toHaveFocus();

		await user.keyboard('{Escape}');

		await waitFor(() => expect(trigger).toHaveFocus());
	});

	it('leaves focus alone when `onCloseAutoFocus` prevents the default', async () => {
		const user = userEvent.setup();
		setupWithApi({
			boundOpen: true,
			onCloseAutoFocus: (event) => event.preventDefault()
		});

		const trigger = screen.getByTestId('tour-trigger');
		trigger.focus();
		await user.click(trigger);
		await waitFor(() => expect(card().contains(document.activeElement)).toBe(true));

		await user.keyboard('{Escape}');
		await waitFor(() => expect(queryCard()).not.toBeInTheDocument());

		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(trigger).not.toHaveFocus();
	});

	it('reports `onOpenAutoFocus` as the card takes focus', async () => {
		const onOpenAutoFocus = vi.fn();
		setup({ defaultOpen: true, onOpenAutoFocus });

		await waitFor(() => expect(onOpenAutoFocus).toHaveBeenCalledTimes(1));
	});

	it('leaves focus where it was when `onOpenAutoFocus` prevents the default', async () => {
		const user = userEvent.setup();
		setup({ boundOpen: true, onOpenAutoFocus: (event) => event.preventDefault() });

		const trigger = screen.getByTestId('tour-trigger');
		trigger.focus();
		// Assert the trigger held focus *before* the tour opened, so "focus never moved" cannot pass
		// on a tour that simply never took focus (quickstart.md's teardown-assertion warning).
		expect(trigger).toHaveFocus();

		await user.click(trigger);
		await waitFor(() => expect(queryCard()).toBeInTheDocument());
		await settle();

		expect(trigger).toHaveFocus();
		expect(card().contains(document.activeElement)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Uncontrolled vs controlled (T006, US3, FR-001/002)
// ---------------------------------------------------------------------------

describe('Tour controlled and uncontrolled state', () => {
	it('seeds `defaultOpen` and `defaultValue` once and then manages itself', async () => {
		const user = userEvent.setup();
		setup({ defaultOpen: true, defaultValue: 1 });

		expect(card()).toHaveTextContent('Step 2');

		await user.click(nextButton());
		expect(card()).toHaveTextContent('Step 3');
	});

	it('reports every uncontrolled move through `onValueChange`', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		setup({ defaultOpen: true, onValueChange });

		await user.click(nextButton());

		expect(onValueChange).toHaveBeenCalledTimes(1);
		expect(onValueChange).toHaveBeenCalledWith(1);
	});

	it('lets an authoritative parent decline the move while still reporting it', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onDeclinedValue = vi.fn();
		setup({ mode: 'controlled', initialOpen: true, onValueChange, onDeclinedValue });

		expect(card()).toHaveTextContent('Step 1');

		await user.click(nextButton());

		expect(onValueChange).toHaveBeenCalledWith(1);
		expect(onDeclinedValue).toHaveBeenCalledWith(1);
		// The parent owns `value`, so the card must not move on its own (US3 scenario 2).
		expect(card()).toHaveTextContent('Step 1');
	});

	it('follows a controlled `value` driven from outside', async () => {
		const { api } = setupWithApi({ mode: 'controlled', initialOpen: true });

		expect(card()).toHaveTextContent('Step 1');

		api.setValue(2);
		await tick();

		expect(card()).toHaveTextContent('Step 3');
		expect(bySlot('tour-step-counter')).toHaveTextContent('3 / 3');
	});

	it('follows a controlled `open` driven from outside', async () => {
		const { api } = setupWithApi({ mode: 'controlled' });

		expect(queryCard()).not.toBeInTheDocument();

		api.setOpen(true);
		await tick();
		expect(card()).toBeInTheDocument();

		api.setOpen(false);
		await tick();
		await waitFor(() => expect(queryCard()).not.toBeInTheDocument());
	});

	it('reports the out-of-range index to a controlled parent when the tour completes', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onComplete = vi.fn();
		const { api } = setupWithApi({
			mode: 'controlled',
			initialOpen: true,
			stepCount: 2,
			onValueChange,
			onComplete
		});

		api.setValue(1);
		await tick();
		await user.click(nextButton());

		expect(onComplete).toHaveBeenCalledTimes(1);
		expect(onValueChange).toHaveBeenCalledWith(2);
	});
});

// ---------------------------------------------------------------------------
// Modal, footer fallback, step lifecycle (T006a, FR-015/022/023)
// ---------------------------------------------------------------------------

describe('Tour modal, footer fallback and step lifecycle', () => {
	it('locks background scrolling while a modal tour is open, and releases it on close', async () => {
		const user = userEvent.setup();
		setup({ defaultOpen: true });

		// Assert the lock is live before asserting it is released.
		expect(document.body.style.overflow).toBe('hidden');

		await user.keyboard('{Escape}');
		await waitFor(() => expect(document.body.style.overflow).toBe(''));
	});

	it('releases the scroll lock when the tour unmounts', () => {
		const { unmount } = setup({ defaultOpen: true });
		expect(document.body.style.overflow).toBe('hidden');

		unmount();
		expect(document.body.style.overflow).toBe('');
	});

	it('never touches background scrolling when `modal` is false', () => {
		setup({ defaultOpen: true, modal: false });

		expect(document.body.style.overflow).toBe('');
		expect(card()).toBeInTheDocument();
	});

	it('renders the root `stepFooter` for a step that declares none', () => {
		setup({ defaultOpen: true });

		expect(allBySlot('tour-footer')).toHaveLength(1);
		expect(screen.queryByTestId('own-footer')).not.toBeInTheDocument();
	});

	it('renders only the step’s own footer when it declares one', async () => {
		setup({ defaultOpen: true, ownFooter: true });

		await waitFor(() => expect(allBySlot('tour-footer')).toHaveLength(1));
		expect(screen.getByTestId('own-footer')).toBeInTheDocument();
	});

	it('renders no footer at all when neither is supplied', () => {
		setup({ defaultOpen: true, withSharedFooter: false });

		expect(allBySlot('tour-footer')).toHaveLength(0);
		expect(card()).toBeInTheDocument();
	});

	it('fires `onStepLeave` then `onStepEnter`, once each, in that order', async () => {
		const user = userEvent.setup();
		const calls: string[] = [];
		setup({
			defaultOpen: true,
			onStepEnter: (index) => calls.push(`enter:${index}`),
			onStepLeave: (index) => calls.push(`leave:${index}`)
		});

		await user.click(nextButton());
		expect(calls).toEqual(['leave:0', 'enter:1']);

		calls.length = 0;
		await user.click(prevButton());
		expect(calls).toEqual(['leave:1', 'enter:0']);
	});
});

// ---------------------------------------------------------------------------
// RTL (T007, FR-024, SC-005)
// ---------------------------------------------------------------------------

describe('Tour right-to-left', () => {
	it('publishes `dir="rtl"` on every part that documents it', () => {
		setup({ defaultOpen: true, dir: 'rtl' });

		for (const slot of [
			'tour',
			'tour-step',
			'tour-header',
			'tour-title',
			'tour-description',
			'tour-footer'
		]) {
			expect(bySlot(slot), `[data-slot="${slot}"] is missing dir`).toHaveAttribute('dir', 'rtl');
		}
	});

	it('defaults to `ltr` with no provider, no `dir` prop and no ambient `[dir]`', () => {
		setup({ defaultOpen: true });

		expect(bySlot('tour')).toHaveAttribute('dir', 'ltr');
		expect(bySlot('tour-step')).toHaveAttribute('dir', 'ltr');
	});

	it('keeps navigation working in RTL, with `Prev` before `Next` in reading order', async () => {
		const user = userEvent.setup();
		setup({ defaultOpen: true, dir: 'rtl' });

		const footer = bySlot('tour-footer');
		const controls = Array.from(footer.querySelectorAll('[data-slot]')).map((element) =>
			element.getAttribute('data-slot')
		);
		expect(controls).toEqual(['tour-step-counter', 'tour-prev', 'tour-next']);

		await user.click(nextButton());
		expect(card()).toHaveTextContent('Step 2');
	});

	it('mirrors nothing in the geometry itself — the cut-out is measured, not sided', () => {
		const rect = new DOMRect(50, 100, 100, 50);

		expect(computeSpotlight(rect, 4, VIEWPORT)).toEqual(computeSpotlight(rect, 4, { ...VIEWPORT }));
	});
});

// ---------------------------------------------------------------------------
// Spotlight styling and offset inheritance (T007a, US5, FR-009/028)
// ---------------------------------------------------------------------------

describe('Tour spotlight styling and offsets', () => {
	it('keeps a caller class on the ring alongside the component’s own', () => {
		stubRects(TARGET_RECTS);
		setup({ defaultOpen: true, ringClass: 'rounded-xl border-2 border-primary' });

		const ring = bySlot('tour-spotlight-ring');
		expect(ring).toHaveClass('fixed', 'ring-[3px]');
		expect(ring).toHaveClass('rounded-xl', 'border-2', 'border-primary');
	});

	it('lets a caller class win on conflict, because it is merged last', () => {
		stubRects(TARGET_RECTS);
		setup({ defaultOpen: true, ringClass: 'ring-0' });

		const ring = bySlot('tour-spotlight-ring');
		expect(ring).toHaveClass('ring-0');
		expect(ring).not.toHaveClass('ring-[3px]');
	});

	it('applies the root `spotlightPadding` symmetrically on all four edges', () => {
		stubRects(TARGET_RECTS);
		setup({ defaultOpen: true, spotlightPadding: 12 });

		expect(styleOf(bySlot('tour-spotlight-ring'))).toContain(
			ringStyleFor(TARGET_RECTS[TOUR_HARNESS_TARGET_IDS[0]], 12)
		);
	});

	it('records the root offsets on a step that declares none', () => {
		const registry = new TourStepRegistry();
		registry.register(stepRecord({ sideOffset: DEFAULT_SIDE_OFFSET, alignOffset: 0 }));

		expect(registry.at(0)?.sideOffset).toBe(DEFAULT_SIDE_OFFSET);
		expect(registry.at(0)?.alignOffset).toBe(DEFAULT_ALIGN_OFFSET);
	});

	it('records a step’s own offsets when it declares them', () => {
		const registry = new TourStepRegistry();
		registry.register(stepRecord({ sideOffset: 32, alignOffset: 8 }));

		expect(registry.at(0)?.sideOffset).toBe(32);
		expect(registry.at(0)?.alignOffset).toBe(8);
	});

	it('renders both an inheriting and an overriding step without disturbing the other', async () => {
		const user = userEvent.setup();
		setup({ defaultOpen: true, sideOffset: 24, stepSideOffset: 32, stepAlignOffset: 8 });

		expect(card()).toHaveTextContent('Step 1');

		await user.click(nextButton());
		expect(card()).toHaveTextContent('Step 2');
		expect(card()).toHaveAttribute('data-side');
		expect(card()).toHaveAttribute('data-align');
	});

	it('resolves each rendered step’s offsets from the root, and lets the step override them', async () => {
		stubLayout(TARGET_RECTS);
		const user = userEvent.setup();
		const { api } = setupWithApi({
			defaultOpen: true,
			sideOffset: 24,
			alignOffset: 4,
			stepSideOffset: 32,
			stepAlignOffset: 8
		});

		// The step declaring nothing takes the root's pair; the one declaring its own keeps them.
		await waitFor(() => expect(api.getStepData(0)?.sideOffset).toBe(24));
		expect(api.getStepData(0)?.alignOffset).toBe(4);
		expect(api.getStepData(1)?.sideOffset).toBe(32);
		expect(api.getStepData(1)?.alignOffset).toBe(8);

		// …and both values reach `Popover.Content`: each card sits its own `sideOffset` below its
		// target, on the main axis the placed side runs along.
		const first = TARGET_RECTS[TOUR_HARNESS_TARGET_IDS[0]];
		await waitFor(() => expect(translateOf(floatingWrapper()).y).toBe(first.bottom + 24));

		await user.click(nextButton());

		const second = TARGET_RECTS[TOUR_HARNESS_TARGET_IDS[1]];
		await waitFor(() => expect(translateOf(floatingWrapper()).y).toBe(second.bottom + 32));
	});

	it('shifts a start-aligned card by the `alignOffset` it resolved', async () => {
		stubLayout(TARGET_RECTS);
		const user = userEvent.setup();
		const second = TARGET_RECTS[TOUR_HARNESS_TARGET_IDS[1]];

		// `alignOffset` moves nothing while the card is centred, and collision avoidance would shift
		// the card off the very offset being measured — hence `align="start"` and no avoidance.
		const inheriting = setup({
			defaultOpen: true,
			alignOffset: 4,
			stepAlign: 'start',
			stepAvoidCollisions: false
		});
		await user.click(nextButton());
		await waitFor(() => expect(translateOf(floatingWrapper()).x).toBe(second.left + 4));
		inheriting.unmount();

		setup({
			defaultOpen: true,
			alignOffset: 4,
			stepAlign: 'start',
			stepAlignOffset: 8,
			stepAvoidCollisions: false
		});
		await user.click(nextButton());
		await waitFor(() => expect(translateOf(floatingWrapper()).x).toBe(second.left + 8));
	});

	it('exposes the documented side and align option lists', () => {
		expect(TOUR_SIDES).toEqual(['top', 'right', 'bottom', 'left']);
		expect(TOUR_ALIGNS).toEqual(['start', 'center', 'end']);
	});
});

// ---------------------------------------------------------------------------
// Edge cases and guard rails (T008, US4, FR-006/007/013/014/016-020/026/029/030)
// ---------------------------------------------------------------------------

describe('Tour dismissal paths', () => {
	it('fires `onSkip` exactly once and never `onComplete` when `Skip` is used', async () => {
		const user = userEvent.setup();
		const onSkip = vi.fn();
		const onComplete = vi.fn();
		setup({ defaultOpen: true, withSkip: true, onSkip, onComplete });

		await user.click(bySlot('tour-skip'));

		expect(onSkip).toHaveBeenCalledTimes(1);
		expect(onComplete).not.toHaveBeenCalled();
		await waitFor(() => expect(queryCard()).not.toBeInTheDocument());
	});

	it('fires `onSkip` exactly once when `Close` is used', async () => {
		const user = userEvent.setup();
		const onSkip = vi.fn();
		const onComplete = vi.fn();
		setup({ defaultOpen: true, onSkip, onComplete });

		await user.click(bySlot('tour-close'));

		expect(onSkip).toHaveBeenCalledTimes(1);
		expect(onComplete).not.toHaveBeenCalled();
	});

	it('fires `onSkip` exactly once when `Escape` closes the tour', async () => {
		const user = userEvent.setup();
		const onSkip = vi.fn();
		const onComplete = vi.fn();
		setup({ defaultOpen: true, onSkip, onComplete });

		await user.keyboard('{Escape}');

		expect(onSkip).toHaveBeenCalledTimes(1);
		expect(onComplete).not.toHaveBeenCalled();
	});

	it('closes on an outside pointer interaction, reporting both outside callbacks', async () => {
		const user = userEvent.setup();
		const onSkip = vi.fn();
		const onPointerDownOutside = vi.fn();
		const onInteractOutside = vi.fn();
		stubRects(TARGET_RECTS);
		setup({ defaultOpen: true, onSkip, onPointerDownOutside, onInteractOutside });
		await settle();

		await user.click(screen.getByTestId('outside-button'));

		// `bits-ui`'s dismissible layer debounces its outside handler by 10ms.
		await waitFor(() => expect(onPointerDownOutside).toHaveBeenCalledTimes(1));
		expect(onInteractOutside).toHaveBeenCalledTimes(1);
		expect(onSkip).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(queryCard()).not.toBeInTheDocument());
	});

	it('stays open when `onInteractOutside` prevents the default', async () => {
		const user = userEvent.setup();
		stubRects(TARGET_RECTS);
		setup({
			defaultOpen: true,
			onInteractOutside: (event) => event.preventDefault()
		});
		await settle();

		await user.click(screen.getByTestId('outside-button'));
		await settle();

		expect(card()).toBeInTheDocument();
	});

	it('never closes from a click on the spotlighted target itself', async () => {
		const user = userEvent.setup();
		stubRects(TARGET_RECTS);
		setup({ defaultOpen: true });
		await settle();

		await user.click(screen.getByTestId(TOUR_HARNESS_TARGET_IDS[0]));
		await settle();

		expect(card()).toBeInTheDocument();
	});

	it('suppresses both `Escape` and outside interaction while `dismissible` is false', async () => {
		const user = userEvent.setup();
		const onEscapeKeyDown = vi.fn();
		stubRects(TARGET_RECTS);
		setup({ defaultOpen: true, dismissible: false, onEscapeKeyDown });
		await settle();

		await user.keyboard('{Escape}');
		expect(onEscapeKeyDown).toHaveBeenCalledTimes(1);
		expect(card()).toBeInTheDocument();

		await user.click(screen.getByTestId('outside-button'));
		await settle();
		expect(card()).toBeInTheDocument();
	});
});

describe('Tour edge cases', () => {
	it('renders nothing for a step whose target matches no element', () => {
		setup({ defaultOpen: true, missingTarget: true });

		expect(queryCard()).not.toBeInTheDocument();
		expect(queryBySlot('tour-spotlight-ring')).toBeNull();
	});

	it('renders that step anyway when it is force-mounted', async () => {
		setup({ defaultOpen: true, missingTarget: true, stepForceMount: true });

		await waitFor(() => expect(queryCard()).not.toBeNull());
		expect(card()).toHaveTextContent('Step 1');
	});

	it('renders no card at all when no step is registered', () => {
		setup({ defaultOpen: true, stepCount: 0 });

		expect(queryCard()).not.toBeInTheDocument();
		expect(bySlot('tour-spotlight')).toBeInTheDocument();
	});

	it('resolves a selector, an element and a `bind:this` element to the same node', () => {
		const element = createHost();
		element.id = 'resolve-me';

		expect(resolveTarget('#resolve-me')).toBe(element);
		expect(resolveTarget(element)).toBe(element);
		expect(resolveTarget('#nothing-here')).toBeNull();
		expect(resolveTarget(undefined)).toBeNull();
	});

	it('positions against the very same node whether the target is a selector or an element', () => {
		stubRects(TARGET_RECTS);
		const { unmount } = setup({ defaultOpen: true });
		const bySelector = styleOf(bySlot('tour-spotlight-ring'));
		unmount();

		stubRects(TARGET_RECTS);
		setup({ defaultOpen: true, elementTarget: true });

		expect(styleOf(bySlot('tour-spotlight-ring'))).toBe(bySelector);
	});

	it('keeps the spotlight and ring mounted while closed when they are force-mounted', () => {
		stubRects(TARGET_RECTS);
		const { unmount } = setup({ defaultOpen: true });
		unmount();

		stubRects(TARGET_RECTS);
		setup({ spotlightForceMount: true, ringForceMount: true });

		expect(bySlot('tour-spotlight')).toHaveAttribute('data-state', 'closed');
		// A ring with no measured cut-out yet renders nothing, exactly as upstream (tour.tsx:1313).
		expect(queryBySlot('tour-spotlight-ring')).toBeNull();
	});

	it('renders neither the spotlight nor the ring while closed without `forceMount`', () => {
		setup({});

		expect(queryBySlot('tour-spotlight')).toBeNull();
		expect(queryBySlot('tour-spotlight-ring')).toBeNull();
	});

	it('renders the tour into a caller-supplied portal container', async () => {
		const host = createHost();
		setup({ defaultOpen: true, portalContainer: host });

		await waitFor(() => expect(host.querySelector('[data-slot="tour-step"]')).not.toBeNull());
	});

	it('renders into `document.body` when no container is given', async () => {
		const { container } = setup({ defaultOpen: true });

		await waitFor(() => expect(queryBySlot('tour-step')).not.toBeNull());
		expect(container.querySelector('[data-slot="tour-step"]')).toBeNull();
	});

	it('renders inline when the portal is omitted entirely', async () => {
		setup({ defaultOpen: true, withPortal: false });

		await waitFor(() => expect(queryCard()).toBeInTheDocument());
	});

	it('lands on the second target when `Next` is activated twice in immediate succession', async () => {
		stubRects(TARGET_RECTS);
		const user = userEvent.setup();
		setup({ defaultOpen: true });

		await user.click(nextButton());
		await user.click(nextButton());

		expect(card()).toHaveTextContent('Step 3');
		expect(styleOf(bySlot('tour-spotlight-ring'))).toContain(
			ringStyleFor(TARGET_RECTS[TOUR_HARNESS_TARGET_IDS[2]])
		);
	});

	it('re-resolves a target that only mounts once its step becomes current', async () => {
		const user = userEvent.setup();
		const { api } = setupWithApi({ defaultOpen: true, stepCount: 2 });

		api.setTargets([TOUR_HARNESS_TARGET_IDS[0]]);
		await tick();
		await user.click(nextButton());
		await waitFor(() => expect(queryCard()).toBeNull());

		api.setTargets([...TOUR_HARNESS_TARGET_IDS]);
		await waitFor(() => expect(queryCard()).not.toBeNull());
		expect(card()).toHaveTextContent('Step 2');
	});
});

describe('Tour `hideWhenDetached`', () => {
	it('records the flag on the step that declares it and leaves its neighbours off', async () => {
		const { api } = setupWithApi({ defaultOpen: true, stepHideWhenDetached: true });

		await waitFor(() => expect(api.getStepData(0)?.hideWhenDetached).toBe(true));
		expect(api.getStepData(1)?.hideWhenDetached).toBe(false);
	});

	it('hides the card, without unmounting it, once its target has scrolled out of view', async () => {
		const scrolledAway = new DOMRect(50, -5000, 100, 50);
		stubLayout({ ...TARGET_RECTS, [TOUR_HARNESS_TARGET_IDS[0]]: scrolledAway });
		setup({ defaultOpen: true, stepHideWhenDetached: true });

		// The target really has gone: out of view on the documented reading, and clamped hard against
		// the top edge by the cut-out arithmetic.
		expect(isTargetInViewport(scrolledAway, undefined, VIEWPORT)).toBe(false);
		expect(computeSpotlight(scrolledAway, DEFAULT_SPOTLIGHT_PADDING, VIEWPORT).rect.y).toBe(0);

		await waitFor(() => expect(styleOf(floatingWrapper())).toContain('visibility: hidden'));

		// The other half of FR-020: invisible and inert, never unmounted.
		expect(card()).toBeInTheDocument();
		expect(card()).toHaveAttribute('data-state', 'open');
	});

	it('leaves the card visible while its target is still in view', async () => {
		stubLayout(TARGET_RECTS);
		setup({ defaultOpen: true, stepHideWhenDetached: true });

		const first = TARGET_RECTS[TOUR_HARNESS_TARGET_IDS[0]];
		await waitFor(() =>
			expect(translateOf(floatingWrapper()).y).toBe(first.bottom + DEFAULT_SIDE_OFFSET)
		);
		expect(styleOf(floatingWrapper())).not.toContain('visibility: hidden');
	});

	it('never hides a step that did not opt in, however far its target has scrolled', async () => {
		const scrolledAway = new DOMRect(50, -5000, 100, 50);
		stubLayout({ ...TARGET_RECTS, [TOUR_HARNESS_TARGET_IDS[0]]: scrolledAway });
		setup({ defaultOpen: true });

		await waitFor(() =>
			expect(translateOf(floatingWrapper()).y).toBe(scrolledAway.bottom + DEFAULT_SIDE_OFFSET)
		);
		expect(styleOf(floatingWrapper())).not.toContain('visibility: hidden');
	});
});

describe('Tour target tracking', () => {
	it('follows the target across `resize` and `scroll`, and stops on unmount', async () => {
		const rects = { ...TARGET_RECTS };
		vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
			this: Element
		) {
			return rects[this.id] ?? new DOMRect(0, 0, 0, 0);
		});

		const { unmount } = setup({ defaultOpen: true });
		const ring = bySlot('tour-spotlight-ring');
		expect(styleOf(ring)).toContain(ringStyleFor(TARGET_RECTS[TOUR_HARNESS_TARGET_IDS[0]]));

		const resized = new DOMRect(10, 20, 30, 40);
		rects[TOUR_HARNESS_TARGET_IDS[0]] = resized;
		window.dispatchEvent(new Event('resize'));
		await tick();
		expect(styleOf(bySlot('tour-spotlight-ring'))).toContain(ringStyleFor(resized));

		const scrolled = new DOMRect(11, 21, 31, 41);
		rects[TOUR_HARNESS_TARGET_IDS[0]] = scrolled;
		window.dispatchEvent(new Event('scroll'));
		await waitFor(() =>
			expect(styleOf(bySlot('tour-spotlight-ring'))).toContain(ringStyleFor(scrolled))
		);

		// The listeners were demonstrably live above; now prove the teardown really removed them.
		unmount();
		rects[TOUR_HARNESS_TARGET_IDS[0]] = new DOMRect(999, 999, 9, 9);
		window.dispatchEvent(new Event('resize'));
		window.dispatchEvent(new Event('scroll'));

		expect(queryBySlot('tour-spotlight-ring')).toBeNull();
	});

	it('cancels a queued animation frame when the active step unmounts', () => {
		stubRects(TARGET_RECTS);
		const frameIds: number[] = [];
		const requestFrame = window.requestAnimationFrame.bind(window);
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
			const id = requestFrame(callback);
			frameIds.push(id);
			return id;
		});
		const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame');

		const { unmount } = setup({ defaultOpen: true });

		const before = frameIds.length;
		window.dispatchEvent(new Event('scroll'));
		expect(frameIds.length).toBeGreaterThan(before);

		const queued = frameIds[frameIds.length - 1];
		unmount();

		expect(cancelFrame.mock.calls.flat()).toContain(queued);
	});
});

describe('Tour geometry and scrolling helpers', () => {
	it('pads the cut-out on every edge and clamps it to the viewport', () => {
		const { rect, maskPath } = computeSpotlight(new DOMRect(50, 100, 100, 50), 4, VIEWPORT);

		expect(rect).toEqual({ x: 46, y: 96, width: 108, height: 58 });
		expect(maskPath).toContain('46px 96px');
		expect(maskPath).toContain('154px 154px');
	});

	it('never produces a negative origin for a target at the top-left corner', () => {
		const { rect } = computeSpotlight(new DOMRect(0, 0, 20, 20), 8, VIEWPORT);

		expect(rect.x).toBe(0);
		expect(rect.y).toBe(0);
	});

	it('clamps the cut-out to the viewport for an oversized target', () => {
		const { rect } = computeSpotlight(
			new DOMRect(0, 0, VIEWPORT.width * 2, VIEWPORT.height * 2),
			0,
			VIEWPORT
		);

		expect(rect.width).toBe(VIEWPORT.width);
		expect(rect.height).toBe(VIEWPORT.height);
	});

	it('defaults `padding` to the documented value', () => {
		expect(computeSpotlight(new DOMRect(100, 100, 10, 10), undefined, VIEWPORT).rect).toEqual(
			computeSpotlight(new DOMRect(100, 100, 10, 10), DEFAULT_SPOTLIGHT_PADDING, VIEWPORT).rect
		);
	});

	it('reads the per-edge scroll offsets when deciding whether a target is in view', () => {
		const inView = { top: 150, bottom: 200, left: 10, right: 50 };
		expect(isTargetInViewport(inView, undefined, VIEWPORT)).toBe(true);

		// A larger top inset pushes the same box out of the "already visible" band.
		expect(isTargetInViewport(inView, { top: 300 }, VIEWPORT)).toBe(false);
		expect(isTargetInViewport({ ...inView, left: -5 }, undefined, VIEWPORT)).toBe(false);
		expect(DEFAULT_SCROLL_OFFSET).toEqual({ top: 100, bottom: 100, left: 0, right: 0 });
	});

	it('scrolls an out-of-view target to the top inset, and never past zero', () => {
		const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
		const element = document.createElement('div');
		element.getBoundingClientRect = () => new DOMRect(0, 900, 10, 10);

		scrollTargetIntoView(element, 'auto');
		expect(scrollTo).toHaveBeenCalledWith({ top: 800, behavior: 'auto' });

		scrollTo.mockClear();
		element.getBoundingClientRect = () => new DOMRect(0, -400, 10, 10);
		scrollTargetIntoView(element, 'auto');
		expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
	});

	it('does nothing for a target that is already in view', () => {
		const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
		const element = document.createElement('div');
		element.getBoundingClientRect = () => new DOMRect(10, 150, 40, 50);

		scrollTargetIntoView(element, 'auto');

		expect(scrollTo).not.toHaveBeenCalled();
	});

	it('honours `prefers-reduced-motion: reduce` when no behaviour is given', () => {
		const matchMedia = vi.spyOn(window, 'matchMedia');

		matchMedia.mockReturnValue({ matches: true } as MediaQueryList);
		expect(getDefaultScrollBehavior()).toBe('auto');

		matchMedia.mockReturnValue({ matches: false } as MediaQueryList);
		expect(getDefaultScrollBehavior()).toBe('smooth');
	});

	it('auto-scrolls the next target into view on an uncontrolled move', async () => {
		const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
		const user = userEvent.setup();
		stubRects({
			...TARGET_RECTS,
			[TOUR_HARNESS_TARGET_IDS[1]]: new DOMRect(0, 900, 10, 10)
		});
		setup({ defaultOpen: true, scrollBehavior: 'auto' });

		await user.click(nextButton());

		expect(scrollTo).toHaveBeenCalledWith({ top: 800, behavior: 'auto' });
	});

	it('scrolls to the root `scrollOffset`’s top inset rather than the default one', async () => {
		const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
		const user = userEvent.setup();
		stubRects({
			...TARGET_RECTS,
			[TOUR_HARNESS_TARGET_IDS[1]]: new DOMRect(0, 900, 10, 10)
		});
		setup({
			defaultOpen: true,
			scrollBehavior: 'auto',
			scrollOffset: { top: 250, bottom: 40, left: 10, right: 10 }
		});

		await user.click(nextButton());

		// 900 − 250. The default inset of 100 would have landed on 800.
		expect(scrollTo).toHaveBeenCalledWith({ top: 650, behavior: 'auto' });
	});

	it('leaves a target the custom insets already count as visible where it is', async () => {
		const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
		const user = userEvent.setup();
		const scrollOffset = { top: 250, bottom: 40, left: 10, right: 10 };
		const roomy = new DOMRect(20, 300, 80, 400);
		stubRects({ ...TARGET_RECTS, [TOUR_HARNESS_TARGET_IDS[1]]: roomy });
		setup({ defaultOpen: true, scrollBehavior: 'auto', scrollOffset });

		// The very same box is out of view under the defaults, so the insets are doing the work here
		// rather than the box happening to sit inside both bands.
		expect(isTargetInViewport(roomy, undefined, VIEWPORT)).toBe(false);
		expect(isTargetInViewport(roomy, scrollOffset, VIEWPORT)).toBe(true);

		await user.click(nextButton());

		expect(scrollTo).not.toHaveBeenCalled();
	});

	it('never auto-scrolls when `autoScroll` is disabled', async () => {
		const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
		const user = userEvent.setup();
		stubRects({
			...TARGET_RECTS,
			[TOUR_HARNESS_TARGET_IDS[1]]: new DOMRect(0, 900, 10, 10)
		});
		setup({ defaultOpen: true, autoScroll: false });

		await user.click(nextButton());

		expect(scrollTo).not.toHaveBeenCalled();
	});
});

describe('Tour step collision options', () => {
	it('records every documented collision option on the step that declares it', async () => {
		const boundary = createHost();
		const { api } = setupWithApi({
			defaultOpen: true,
			stepCollisionBoundary: boundary,
			stepCollisionPadding: { top: 12, bottom: 6 },
			stepArrowPadding: 9,
			stepSticky: 'always',
			stepAvoidCollisions: false,
			stepRequired: true
		});

		await waitFor(() => expect(api.getStepData(1)?.arrowPadding).toBe(9));
		expect(api.getStepData(1)?.collisionBoundary).toBe(boundary);
		expect(api.getStepData(1)?.collisionPadding).toEqual({ top: 12, bottom: 6 });
		expect(api.getStepData(1)?.sticky).toBe('always');
		expect(api.getStepData(1)?.avoidCollisions).toBe(false);
		expect(api.getStepData(1)?.required).toBe(true);
	});

	it('leaves a step that declares none of them on the documented defaults', async () => {
		const { api } = setupWithApi({ defaultOpen: true });

		await waitFor(() => expect(api.getStepData(0)).toBeDefined());
		expect(api.getStepData(0)).toMatchObject({
			collisionPadding: 0,
			arrowPadding: 0,
			sticky: 'partial',
			avoidCollisions: true,
			required: false
		});
		expect(api.getStepData(0)?.collisionBoundary).toEqual([]);
	});

	it('places the card on the side it asked for once collision avoidance is off', async () => {
		stubLayout(TARGET_RECTS);
		const user = userEvent.setup();
		setup({ defaultOpen: true, stepAvoidCollisions: false });

		await user.click(nextButton());

		// The one option of the six the floating layer surfaces: with avoidance off nothing flips or
		// shifts, so the card lands exactly `sideOffset` below the target on the requested side.
		const second = TARGET_RECTS[TOUR_HARNESS_TARGET_IDS[1]];
		await waitFor(() =>
			expect(translateOf(floatingWrapper()).y).toBe(second.bottom + DEFAULT_SIDE_OFFSET)
		);
		expect(card()).toHaveAttribute('data-side', 'bottom');
	});

	it('carries `required` without changing anything else about the step', async () => {
		const user = userEvent.setup();
		setup({ defaultOpen: true, stepRequired: true });

		await user.click(nextButton());
		expect(card()).toHaveTextContent('Step 2');

		// It is stored for API parity and never read, so a required step still dismisses like any
		// other (spec Assumptions).
		await user.click(bySlot('tour-close'));
		await waitFor(() => expect(queryCard()).not.toBeInTheDocument());
	});
});

describe('Tour step registry', () => {
	it('renumbers later steps when one unregisters', () => {
		const registry = new TourStepRegistry();
		const first = registry.register(stepRecord({ target: '#a' }));
		const second = registry.register(stepRecord({ target: '#b' }));
		const third = registry.register(stepRecord({ target: '#c' }));

		expect(registry.indexOf(third)).toBe(2);

		registry.unregister(second);

		expect(registry.count).toBe(2);
		expect(registry.indexOf(first)).toBe(0);
		expect(registry.indexOf(third)).toBe(1);
		expect(registry.at(1)?.target).toBe('#c');
	});

	it('does not bump the registry when a step re-registers unchanged data', () => {
		const registry = new TourStepRegistry();
		const id = registry.register(stepRecord());
		const version = registry.version;

		// The defaults are fresh objects on every prop read, so identity alone must not count as a
		// change — otherwise a step would bump the registry on every tick.
		registry.update(id, stepRecord());
		expect(registry.version).toBe(version);

		registry.update(id, stepRecord({ sideOffset: 32 }));
		expect(registry.version).not.toBe(version);
	});

	it('ignores an update or removal for an unknown id', () => {
		const registry = new TourStepRegistry();
		registry.register(stepRecord());
		const version = registry.version;

		registry.update('step-404', stepRecord({ sideOffset: 99 }));
		registry.unregister('step-404');

		expect(registry.version).toBe(version);
		expect(registry.count).toBe(1);
	});

	it('drops a step from the tour when it unmounts mid-tour', async () => {
		const { api } = setupWithApi({ defaultOpen: true });

		expect(bySlot('tour-step-counter')).toHaveTextContent('1 / 3');

		api.setStepCount(2);
		await tick();

		// The last step unmounts and the remaining indices shift down, without the tour throwing
		// (spec Edge Case, "a step is unmounted while the tour is open").
		await waitFor(() => expect(bySlot('tour-step-counter')).toHaveTextContent('1 / 2'));
		expect(card()).toHaveTextContent('Step 1');
	});

	it('resets an out-of-range index when the tour is opened from outside', async () => {
		const { api } = setupWithApi({ boundOpen: true, defaultValue: 7 });

		expect(queryCard()).not.toBeInTheDocument();

		api.setOpen(true);
		await tick();

		await waitFor(() => expect(queryCard()).toBeInTheDocument());
		expect(card()).toHaveTextContent('Step 1');
		expect(bySlot('tour-step-counter')).toHaveTextContent('1 / 3');
	});
});

describe('Tour guard rails', () => {
	/** Every part that reads the root's state, and therefore names `<Tour.Root>` as its provider. */
	const ROOT_SCOPED: TourHarnessPart[] = [
		'Portal',
		'Spotlight',
		'SpotlightRing',
		'Step',
		'Header',
		'StepCounter',
		'Close',
		'Prev',
		'Next',
		'Skip'
	];

	/** Every part that reads the enclosing step's state, and so names `<Tour.Step>` instead. */
	const STEP_SCOPED: TourHarnessPart[] = ['Title', 'Description', 'Footer'];

	it('throws when `Tour.Step` is used outside a `Tour.Root`', () => {
		expect(() => render(TourStep, { props: { target: '#nowhere' } })).toThrow(
			'`<Tour.Step>` must be used within `<Tour.Root>`.'
		);
	});

	it('throws when `Tour.Arrow` is used outside a `Tour.Step`', () => {
		expect(() => render(TourArrow)).toThrow('`<Tour.Arrow>` must be used within `<Tour.Step>`.');
	});

	for (const part of ROOT_SCOPED) {
		it(`names both \`Tour.${part}\` and its provider when it is rendered with no root`, () => {
			expect(() => setup({ mode: 'bare-part', barePart: part })).toThrow(
				`\`<Tour.${part}>\` must be used within \`<Tour.Root>\`.`
			);
		});
	}

	for (const part of STEP_SCOPED) {
		it(`names both \`Tour.${part}\` and its provider when it is rendered outside a step`, () => {
			// Inside a `<Tour.Root>`, so the root lookup these parts also make is satisfied and the
			// message that surfaces is the one naming the step they are really missing.
			expect(() => setup({ mode: 'stepless-part', barePart: part })).toThrow(
				`\`<Tour.${part}>\` must be used within \`<Tour.Step>\`.`
			);
		});
	}

	it('names the step as `Tour.Arrow`’s provider through the harness too', () => {
		expect(() => setup({ mode: 'bare-part', barePart: 'Arrow' })).toThrow(
			'`<Tour.Arrow>` must be used within `<Tour.Step>`.'
		);
	});
});

// ---------------------------------------------------------------------------
// `Tour.Arrow` (T036, FR-010)
// ---------------------------------------------------------------------------

describe('Tour arrow', () => {
	it('renders inside the step card at the documented default size', () => {
		setup({ defaultOpen: true, withArrow: true });

		const arrow = bySlot('tour-arrow');
		expect(card()).toContainElement(arrow);
		expect(arrow.tagName).toBe('SPAN');

		const glyph = arrow.querySelector('svg');
		expect(glyph).toHaveAttribute('width', '10');
		expect(glyph).toHaveAttribute('height', '5');
	});

	it('lets a caller override both dimensions', () => {
		setup({ defaultOpen: true, withArrow: true, arrowWidth: 24, arrowHeight: 12 });

		const glyph = bySlot('tour-arrow').querySelector('svg');
		expect(glyph).toHaveAttribute('width', '24');
		expect(glyph).toHaveAttribute('height', '12');
	});
});

// ---------------------------------------------------------------------------
// The `child` snippet (T008a, FR-025)
// ---------------------------------------------------------------------------

describe('Tour `child` snippet', () => {
	const CASES: {
		part: TourHarnessChildPart;
		testId: string;
		tag: string;
		slot: string;
		props?: TourHarnessProps;
	}[] = [
		{ part: 'root', testId: 'root-child', tag: 'SECTION', slot: 'tour' },
		{
			part: 'spotlight',
			testId: 'spotlight-child',
			tag: 'ASIDE',
			slot: 'tour-spotlight',
			props: { defaultOpen: true }
		},
		{
			part: 'spotlight-ring',
			testId: 'ring-child',
			tag: 'ASIDE',
			slot: 'tour-spotlight-ring',
			props: { defaultOpen: true }
		},
		{
			part: 'step',
			testId: 'step-child',
			tag: 'ARTICLE',
			slot: 'tour-step',
			props: { defaultOpen: true }
		},
		{
			part: 'arrow',
			testId: 'arrow-child',
			tag: 'I',
			slot: 'tour-arrow',
			props: { defaultOpen: true, withArrow: true }
		},
		{
			part: 'header',
			testId: 'header-child',
			tag: 'HEADER',
			slot: 'tour-header',
			props: { defaultOpen: true }
		},
		{
			part: 'title',
			testId: 'title-child',
			tag: 'H2',
			slot: 'tour-title',
			props: { defaultOpen: true }
		},
		{
			part: 'description',
			testId: 'description-child',
			tag: 'P',
			slot: 'tour-description',
			props: { defaultOpen: true }
		},
		{
			part: 'close',
			testId: 'close-child',
			tag: 'BUTTON',
			slot: 'tour-close',
			props: { defaultOpen: true }
		},
		{
			part: 'footer',
			testId: 'footer-child',
			tag: 'FOOTER',
			slot: 'tour-footer',
			props: { defaultOpen: true }
		},
		{
			part: 'step-counter',
			testId: 'counter-child',
			tag: 'OUTPUT',
			slot: 'tour-step-counter',
			props: { defaultOpen: true }
		},
		{
			part: 'prev',
			testId: 'prev-child',
			tag: 'BUTTON',
			slot: 'tour-prev',
			props: { defaultOpen: true }
		},
		{
			part: 'next',
			testId: 'next-child',
			tag: 'BUTTON',
			slot: 'tour-next',
			props: { defaultOpen: true }
		},
		{
			part: 'skip',
			testId: 'skip-child',
			tag: 'BUTTON',
			slot: 'tour-skip',
			props: { defaultOpen: true, withSkip: true }
		}
	];

	for (const testCase of CASES) {
		it(`renders \`${testCase.part}\` onto the caller's own element with the merged props`, async () => {
			setup({ ...testCase.props, childPart: testCase.part });

			const element = await screen.findByTestId(testCase.testId);
			expect(element.tagName).toBe(testCase.tag);
			expect(element).toHaveAttribute('data-slot', testCase.slot);
		});
	}

	it('passes `dir` through to the parts that publish it', () => {
		setup({ defaultOpen: true, dir: 'rtl', childPart: 'title' });

		expect(screen.getByTestId('title-child')).toHaveAttribute('dir', 'rtl');
	});

	it('passes the accessible name and the disabled state through to a `Prev` child', () => {
		setup({ defaultOpen: true, childPart: 'prev' });

		const prev = screen.getByTestId('prev-child');
		expect(prev).toHaveAttribute('aria-label', 'Previous step');
		expect(prev).toBeDisabled();
	});

	it('still advances the tour from a `Next` child', async () => {
		const user = userEvent.setup();
		setup({ defaultOpen: true, childPart: 'next' });

		await user.click(screen.getByTestId('next-child'));

		expect(card()).toHaveTextContent('Step 2');
	});

	it('hands the formatted text to a `StepCounter` child', () => {
		setup({ defaultOpen: true, childPart: 'step-counter' });

		expect(screen.getByTestId('counter-child')).toHaveTextContent('1 / 3');
	});
});
