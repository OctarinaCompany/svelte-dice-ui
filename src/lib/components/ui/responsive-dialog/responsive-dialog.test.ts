import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Harness, {
	type ResponsiveDialogHarnessProps,
	type ResponsiveDialogHarnessRefs
} from './responsive-dialog.test.svelte';

// --- Driving the viewport ---------------------------------------------------
//
// `IsMobile` reads `mql.matches` rather than `window.innerWidth` precisely so a test can drive it:
// `matchMedia` is stubbed with a `MediaQueryList`-shaped object whose `matches` is derived from a
// mutable module-level width and whose `change` listeners are collected (quickstart.md "Driving the
// viewport in tests", research R-01).

const DESKTOP_WIDTH = 1024;
const MOBILE_WIDTH = 480;

type ChangeListener = (event: MediaQueryListEvent) => void;

let viewportWidth = DESKTOP_WIDTH;
let queries: FakeMediaQueryList[] = [];

class FakeMediaQueryList {
	readonly media: string;
	readonly listeners = new Set<ChangeListener>();
	addEventListenerCalls = 0;
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
		this.addEventListenerCalls += 1;
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

/** Set the viewport *before* mounting; no `change` event is emitted. */
function seedViewport(isMobile: boolean): void {
	viewportWidth = isMobile ? MOBILE_WIDTH : DESKTOP_WIDTH;
}

/** Flip the viewport of a mounted composition and let every listener and effect settle. */
async function setViewportWidth(width: number): Promise<void> {
	viewportWidth = width;
	for (const query of [...queries]) query.dispatch();
	await tick();
	await tick();
}

const setViewport = (isMobile: boolean): Promise<void> =>
	setViewportWidth(isMobile ? MOBILE_WIDTH : DESKTOP_WIDTH);

const liveListenerCount = (): number =>
	queries.reduce((total, query) => total + query.listeners.size, 0);

// Body-style hygiene: the scroll-lock layers of `bits-ui` and `vaul-svelte` leak body styles in
// jsdom, and a leaked `pointer-events: none` makes the next `user.click` throw (research R-05).
// The reset runs in `beforeEach` as well as `afterEach`, because Vitest unwinds `afterEach` hooks
// last-registered-first — `cleanup()` from `tests/setup.ts` therefore unmounts (and re-leaks) after
// this file's own teardown has already run.
function resetBodyStyles(): void {
	document.body.style.pointerEvents = '';
	document.body.style.overflow = '';
	document.body.style.paddingRight = '';
	document.body.style.marginRight = '';
}

beforeEach(() => {
	resetBodyStyles();
	viewportWidth = DESKTOP_WIDTH;
	queries = [];
	vi.stubGlobal('matchMedia', (media: string) => {
		const query = new FakeMediaQueryList(media);
		queries.push(query);
		return query as unknown as MediaQueryList;
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
	resetBodyStyles();
	document.documentElement.dir = '';
});

// --- Rendering helpers ------------------------------------------------------

async function renderResponsiveDialog(props: ResponsiveDialogHarnessProps = {}) {
	const result = render(Harness, { props });
	await tick();
	return result;
}

const trigger = (): HTMLElement => screen.getByRole('button', { name: 'Open' });

const queryContent = (): HTMLElement | null =>
	document.querySelector<HTMLElement>('[data-slot="responsive-dialog-content"]');

function content(): HTMLElement {
	const element = queryContent();
	if (!element) throw new Error('the responsive dialog content is not rendered');
	return element;
}

function bySlot(slot: string): HTMLElement {
	const element = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

/** `bits-ui` moves focus into freshly opened content on an animation frame — let that land first. */
const nextFrame = (): Promise<void> =>
	new Promise((resolve) => requestAnimationFrame(() => resolve()));

async function openDialog(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
	await user.click(trigger());
	await tick();
	const element = await vi.waitFor(() => content());
	await nextFrame();
	await tick();
	return element;
}

/** Resolve the effective `dir` of a node the way a browser would: nearest ancestor carrying one. */
function resolveDir(element: HTMLElement): string | null {
	return element.closest('[dir]')?.getAttribute('dir') ?? null;
}

/** Everything the WAI-ARIA dialog pattern treats as a tab stop — the list `Content` itself uses. */
const FOCUSABLE_SELECTOR = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])'
].join(',');

const focusablesIn = (element: HTMLElement): HTMLElement[] => [
	...element.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
];

const MODES = [
	{ isMobile: false, variant: 'dialog' },
	{ isMobile: true, variant: 'drawer' }
] as const;

describe('ResponsiveDialog — rendering, roles and ARIA', () => {
	it('renders a centered dialog above the breakpoint', async () => {
		const user = userEvent.setup();
		seedViewport(false);
		await renderResponsiveDialog();

		await openDialog(user);

		expect(screen.getAllByRole('dialog')).toHaveLength(1);
		expect(content()).toHaveAttribute('data-variant', 'dialog');
	});

	it('renders a bottom drawer below the breakpoint', async () => {
		const user = userEvent.setup();
		seedViewport(true);
		await renderResponsiveDialog();

		await openDialog(user);

		expect(screen.getAllByRole('dialog')).toHaveLength(1);
		expect(content()).toHaveAttribute('data-variant', 'drawer');
	});

	it('exposes the drawer role from the same composition, with no consumer branching', async () => {
		const user = userEvent.setup();
		seedViewport(false);
		await renderResponsiveDialog();
		await openDialog(user);
		expect(content()).toHaveAttribute('data-variant', 'dialog');

		await setViewport(true);

		expect(screen.getAllByRole('dialog')).toHaveLength(1);
		expect(content()).toHaveAttribute('data-variant', 'drawer');
	});
});

describe('ResponsiveDialog — IsMobile lifecycle', () => {
	it('registers exactly one change listener per mounted root', async () => {
		await renderResponsiveDialog();

		expect(queries).toHaveLength(1);
		expect(queries[0]?.media).toBe('(max-width: 767px)');
		expect(liveListenerCount()).toBe(1);
	});

	it('removes its listener on unmount', async () => {
		const { unmount } = await renderResponsiveDialog();
		expect(liveListenerCount()).toBe(1);

		unmount();
		await tick();

		expect(liveListenerCount()).toBe(0);
		expect(queries[0]?.removeEventListenerCalls).toBe(1);
	});

	it('recreates the query when the breakpoint prop changes after mount', async () => {
		const { rerender } = await renderResponsiveDialog({ breakpoint: 768 });
		expect(queries.map((query) => query.media)).toEqual(['(max-width: 767px)']);

		await rerender({ breakpoint: 1280 });
		await tick();

		expect(queries.map((query) => query.media)).toEqual([
			'(max-width: 767px)',
			'(max-width: 1279px)'
		]);
		expect(queries[0]?.listeners.size).toBe(0);
		expect(liveListenerCount()).toBe(1);
		// 1024px is desktop at 768 but mobile at 1280 — the variant re-evaluates.
		expect(trigger()).toHaveAttribute('data-variant', 'drawer');
	});
});

describe('ResponsiveDialog — keyboard', () => {
	for (const { isMobile, variant } of MODES) {
		it(`opens on Enter from the trigger in ${variant} mode`, async () => {
			const user = userEvent.setup();
			seedViewport(isMobile);
			await renderResponsiveDialog();

			trigger().focus();
			await user.keyboard('{Enter}');
			await tick();

			const element = await vi.waitFor(() => content());
			expect(element).toHaveAttribute('data-variant', variant);
		});

		it(`opens on Space from the trigger in ${variant} mode`, async () => {
			const user = userEvent.setup();
			seedViewport(isMobile);
			await renderResponsiveDialog();

			trigger().focus();
			await user.keyboard(' ');
			await tick();

			const element = await vi.waitFor(() => content());
			expect(element).toHaveAttribute('data-variant', variant);
		});

		it(`moves focus with Tab and Shift+Tab inside the open content in ${variant} mode`, async () => {
			const user = userEvent.setup();
			seedViewport(isMobile);
			await renderResponsiveDialog();
			const element = await openDialog(user);

			screen.getByTestId('first-field').focus();
			await user.tab();
			expect(screen.getByTestId('second-field')).toHaveFocus();
			expect(element.contains(document.activeElement)).toBe(true);

			await user.tab({ shift: true });
			expect(screen.getByTestId('first-field')).toHaveFocus();
		});

		it(`closes on Escape and returns focus to the trigger in ${variant} mode`, async () => {
			const user = userEvent.setup();
			seedViewport(isMobile);
			await renderResponsiveDialog();
			await openDialog(user);

			await user.keyboard('{Escape}');
			await tick();

			await vi.waitFor(() => expect(queryContent()).toBeNull());
			await vi.waitFor(() => expect(trigger()).toHaveFocus());
		});
	}

	// The dialog opens with focus already inside its content — `bits-ui`'s focus scope. The drawer
	// does not: `vaul-svelte` cancels the open auto-focus (`autoFocus` defaults to `false`), exactly
	// as upstream's React drawer does. Neither behaviour is introduced or overridden by this port.
	it('moves focus into the content when the dialog opens', async () => {
		const user = userEvent.setup();
		seedViewport(false);
		await renderResponsiveDialog();
		const element = await openDialog(user);

		expect(element.contains(document.activeElement)).toBe(true);
	});
});

describe('ResponsiveDialog — props and data attributes', () => {
	it('flips the mode at a custom breakpoint', async () => {
		seedViewport(false);
		await renderResponsiveDialog({ breakpoint: 1280 });

		expect(queries[0]?.media).toBe('(max-width: 1279px)');
		expect(trigger()).toHaveAttribute('data-variant', 'drawer');

		await setViewportWidth(1400);
		expect(trigger()).toHaveAttribute('data-variant', 'dialog');
	});

	for (const { isMobile, variant } of MODES) {
		it(`carries data-slot and data-variant on every element-rendering part in ${variant} mode`, async () => {
			const user = userEvent.setup();
			seedViewport(isMobile);
			await renderResponsiveDialog({ mode: 'with-portal', footerShowCloseButton: false });
			await openDialog(user);

			for (const part of [
				'trigger',
				'close',
				'overlay',
				'content',
				'header',
				'footer',
				'title',
				'description'
			]) {
				expect(bySlot(`responsive-dialog-${part}`)).toHaveAttribute('data-variant', variant);
			}

			// D-07: the portal renders no element of its own, so it carries no attributes at all.
			expect(document.querySelector('[data-slot="responsive-dialog-portal"]')).toBeNull();
		});

		it(`merges the caller's class last on every element-rendering part in ${variant} mode`, async () => {
			const user = userEvent.setup();
			seedViewport(isMobile);
			await renderResponsiveDialog({
				mode: 'with-portal',
				triggerClass: 'trigger-custom',
				overlayClass: 'overlay-custom',
				contentClass: 'content-custom',
				headerClass: 'header-custom',
				footerClass: 'footer-custom',
				titleClass: 'title-custom',
				descriptionClass: 'description-custom',
				closeClass: 'close-custom'
			});
			await openDialog(user);

			for (const part of [
				'trigger',
				'close',
				'overlay',
				'content',
				'header',
				'footer',
				'title',
				'description'
			]) {
				expect(bySlot(`responsive-dialog-${part}`)).toHaveClass(`${part}-custom`);
			}
		});

		it(`forwards arbitrary attributes and binds ref on Content in ${variant} mode`, async () => {
			const user = userEvent.setup();
			seedViewport(isMobile);
			await renderResponsiveDialog({
				contentRest: { id: 'profile-content', 'data-testid': 'content', 'aria-keyshortcuts': 'e' }
			});
			await openDialog(user);

			const element = content();
			expect(element).toHaveAttribute('id', 'profile-content');
			expect(element).toHaveAttribute('data-testid', 'content');
			expect(element).toHaveAttribute('aria-keyshortcuts', 'e');
			expect(screen.getByTestId('ref-report')).toHaveTextContent('responsive-dialog-content');
		});
	}

	// `onOpenChangeComplete` is a `bits-ui` dialog-root prop with no `vaul-svelte` counterpart, so
	// this port forwards it in dialog mode only (divergence D-08). Its firing *timing* belongs to
	// `bits-ui`: the completion is reported once the content's presence settles, which is why it is
	// observed on the close transition.
	it('invokes onOpenChangeComplete once a dialog-mode transition settles', async () => {
		const user = userEvent.setup();
		const onOpenChangeComplete = vi.fn();
		seedViewport(false);
		await renderResponsiveDialog({ onOpenChangeComplete });

		await openDialog(user);
		await user.keyboard('{Escape}');
		await vi.waitFor(() => expect(queryContent()).toBeNull());

		await vi.waitFor(() => expect(onOpenChangeComplete).toHaveBeenCalledWith(false));
	});

	it('never invokes onOpenChangeComplete in drawer mode', async () => {
		const user = userEvent.setup();
		const onOpenChangeComplete = vi.fn();
		seedViewport(true);
		await renderResponsiveDialog({ onOpenChangeComplete });

		await openDialog(user);
		await user.keyboard('{Escape}');
		await vi.waitFor(() => expect(queryContent()).toBeNull());
		await tick();

		expect(onOpenChangeComplete).not.toHaveBeenCalled();
	});
});

describe('ResponsiveDialog — ARIA associations', () => {
	for (const { isMobile, variant } of MODES) {
		it(`labels and describes the content from Title and Description in ${variant} mode`, async () => {
			const user = userEvent.setup();
			seedViewport(isMobile);
			await renderResponsiveDialog();
			const element = await openDialog(user);

			const title = bySlot('responsive-dialog-title');
			const description = bySlot('responsive-dialog-description');

			expect(element).toHaveAttribute('aria-labelledby', title.id);
			expect(element).toHaveAttribute('aria-describedby', description.id);
			expect(element).toHaveAccessibleName('Edit profile');
		});

		it(`closes from a Close inside the Footer in ${variant} mode`, async () => {
			const user = userEvent.setup();
			seedViewport(isMobile);
			await renderResponsiveDialog();
			await openDialog(user);

			await user.click(bySlot('responsive-dialog-close'));
			await tick();

			await vi.waitFor(() => expect(queryContent()).toBeNull());
		});
	}
});

describe('ResponsiveDialog — showCloseButton and drawer spacing', () => {
	it("renders the Footer's close button in dialog mode only", async () => {
		const user = userEvent.setup();
		seedViewport(false);
		await renderResponsiveDialog({ footerShowCloseButton: true, contentShowCloseButton: false });
		await openDialog(user);

		const footer = () => within(bySlot('responsive-dialog-footer'));
		expect(footer().getByRole('button', { name: 'Close' })).toBeInTheDocument();

		await setViewport(true);

		expect(footer().queryByRole('button', { name: 'Close' })).toBeNull();
	});

	it("renders the Content's close button when showCloseButton is true in dialog mode", async () => {
		const user = userEvent.setup();
		seedViewport(false);
		await renderResponsiveDialog({ contentShowCloseButton: true });
		await openDialog(user);

		expect(content().querySelector('[data-slot="dialog-close"]')).not.toBeNull();
	});

	it("omits the Content's close button when showCloseButton is false", async () => {
		const user = userEvent.setup();
		seedViewport(false);
		await renderResponsiveDialog({ contentShowCloseButton: false });
		await openDialog(user);

		expect(content().querySelector('[data-slot="dialog-close"]')).toBeNull();
	});

	it('never forwards showCloseButton to the drawer content', async () => {
		const user = userEvent.setup();
		seedViewport(true);
		await renderResponsiveDialog({ contentShowCloseButton: true });
		const element = await openDialog(user);

		expect(element).not.toHaveAttribute('showclosebutton');
		expect(element.querySelector('[data-slot="dialog-close"]')).toBeNull();
	});

	it('adds px-4 pb-4 in drawer mode only, and lets the caller class win', async () => {
		const user = userEvent.setup();
		seedViewport(true);
		await renderResponsiveDialog({ contentClass: 'pb-8' });
		const element = await openDialog(user);

		expect(element).toHaveClass('px-4');
		expect(element).toHaveClass('pb-8');
		expect(element).not.toHaveClass('pb-4');

		await setViewport(false);

		expect(content()).not.toHaveClass('px-4');
		expect(content()).toHaveClass('pb-8');
	});
});

describe('ResponsiveDialog — guard rails', () => {
	const parts = [
		['bare-trigger', 'Trigger'],
		['bare-close', 'Close'],
		['bare-portal', 'Portal'],
		['bare-overlay', 'Overlay'],
		['bare-content', 'Content'],
		['bare-header', 'Header'],
		['bare-footer', 'Footer'],
		['bare-title', 'Title'],
		['bare-description', 'Description']
	] as const;

	for (const [mode, part] of parts) {
		it(`throws when <ResponsiveDialog.${part}> is rendered with no root`, () => {
			expect(() => render(Harness, { props: { mode } })).toThrow(/must be used within/);
			expect(() => render(Harness, { props: { mode } })).toThrow(`\`<ResponsiveDialog.${part}>\``);
		});
	}
});

describe('ResponsiveDialog — uncontrolled', () => {
	it('seeds the open state from defaultOpen', async () => {
		seedViewport(false);
		await renderResponsiveDialog({ defaultOpen: true });

		expect(await vi.waitFor(() => content())).toBeInTheDocument();
	});

	it('updates its own state from trigger and close interaction', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		seedViewport(false);
		await renderResponsiveDialog({ onOpenChange });

		await openDialog(user);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenLastCalledWith(true);

		await user.click(bySlot('responsive-dialog-close'));
		await vi.waitFor(() => expect(queryContent()).toBeNull());

		expect(onOpenChange).toHaveBeenCalledTimes(2);
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
	});
});

describe('ResponsiveDialog — controlled', () => {
	it('round-trips through bind:open', async () => {
		const user = userEvent.setup();
		seedViewport(false);
		await renderResponsiveDialog({ binding: 'bind', open: false });

		expect(screen.getByTestId('open-report')).toHaveTextContent('false');

		await openDialog(user);

		expect(screen.getByTestId('open-report')).toHaveTextContent('true');
	});

	it('never moves on its own while the caller declines every write', async () => {
		const user = userEvent.setup();
		const onDeclinedOpen = vi.fn();
		const onOpenChange = vi.fn();
		seedViewport(false);
		await renderResponsiveDialog({
			binding: 'function',
			authoritativeOpen: true,
			onDeclinedOpen,
			onOpenChange
		});

		const element = await vi.waitFor(() => content());
		expect(element).toBeInTheDocument();

		await user.keyboard('{Escape}');
		await tick();
		await tick();

		expect(onDeclinedOpen).toHaveBeenCalledWith(false);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
		expect(queryContent()).not.toBeNull();
	});
});

describe('ResponsiveDialog — breakpoint transitions', () => {
	it('keeps an uncontrolled dialog open when the viewport crosses upwards', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		seedViewport(true);
		await renderResponsiveDialog({ onOpenChange });

		const drawer = await openDialog(user);
		expect(drawer).toHaveAttribute('data-variant', 'drawer');
		expect(onOpenChange).toHaveBeenCalledTimes(1);

		await setViewport(false);

		expect(screen.getAllByRole('dialog')).toHaveLength(1);
		expect(content()).toHaveAttribute('data-variant', 'dialog');
		expect(content()).toHaveTextContent('Make changes to your profile here.');
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(content().contains(document.activeElement)).toBe(true);
	});

	it('keeps an uncontrolled dialog open when the viewport crosses downwards', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		seedViewport(false);
		await renderResponsiveDialog({ onOpenChange });

		const dialog = await openDialog(user);
		expect(dialog).toHaveAttribute('data-variant', 'dialog');

		await setViewport(true);

		expect(screen.getAllByRole('dialog')).toHaveLength(1);
		expect(content()).toHaveAttribute('data-variant', 'drawer');
		expect(content()).toHaveTextContent('Make changes to your profile here.');
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(content().contains(document.activeElement)).toBe(true);
	});

	it('falls back to the content element when it has no focusable descendant', async () => {
		seedViewport(true);
		await renderResponsiveDialog({ mode: 'no-focusable', defaultOpen: true });
		await vi.waitFor(() => content());

		await setViewport(false);

		const element = content();
		expect(element.querySelector('button, input, [tabindex]:not([tabindex="-1"])')).toBeNull();
		expect(document.activeElement).not.toBe(document.body);
		expect(element.contains(document.activeElement)).toBe(true);
	});

	it('respects a controlled open value across a crossing in both directions', async () => {
		const onDeclinedOpen = vi.fn();
		const onOpenChange = vi.fn();
		seedViewport(true);
		await renderResponsiveDialog({
			binding: 'function',
			authoritativeOpen: true,
			onDeclinedOpen,
			onOpenChange
		});
		await vi.waitFor(() => content());

		await setViewport(false);
		expect(content()).toHaveAttribute('data-variant', 'dialog');

		await setViewport(true);
		expect(content()).toHaveAttribute('data-variant', 'drawer');

		expect(onOpenChange).not.toHaveBeenCalled();
		expect(onDeclinedOpen).not.toHaveBeenCalled();
	});

	it('opens the mode matching the current viewport after crossing while closed', async () => {
		const user = userEvent.setup();
		seedViewport(false);
		await renderResponsiveDialog();

		await setViewport(true);
		expect(queryContent()).toBeNull();

		await openDialog(user);
		expect(content()).toHaveAttribute('data-variant', 'drawer');
	});
});

describe('ResponsiveDialog — RTL', () => {
	beforeEach(() => {
		document.documentElement.dir = 'rtl';
	});

	for (const { isMobile, variant } of MODES) {
		it(`opens, labels and closes under dir="rtl" in ${variant} mode`, async () => {
			const user = userEvent.setup();
			seedViewport(isMobile);
			await renderResponsiveDialog();
			const element = await openDialog(user);

			expect(resolveDir(element)).toBe('rtl');
			expect(element).toHaveAttribute('aria-labelledby', bySlot('responsive-dialog-title').id);
			expect(element).toHaveAttribute(
				'aria-describedby',
				bySlot('responsive-dialog-description').id
			);

			await user.keyboard('{Escape}');
			await vi.waitFor(() => expect(queryContent()).toBeNull());
			await vi.waitFor(() => expect(trigger()).toHaveFocus());
		});

		it(`introduces no horizontal arrow-key behaviour of its own in ${variant} mode`, async () => {
			const user = userEvent.setup();
			seedViewport(isMobile);
			await renderResponsiveDialog();
			await openDialog(user);

			screen.getByTestId('first-field').focus();
			await user.keyboard('{ArrowLeft}{ArrowRight}');
			await tick();

			expect(queryContent()).not.toBeNull();
			expect(screen.getByTestId('first-field')).toHaveFocus();
		});
	}
});

// Upstream's MDX keyboard table calls `Space`/`Enter` on the trigger a toggle ("Opens/closes the
// dialog"). `bits-ui`'s `DialogTriggerState.onkeydown` only ever calls `handleOpen()`, and
// `vaul-svelte` re-exports that same trigger, so here the keys open and never close — recorded as
// divergence D-09. Hand-rolling a toggle would be bespoke behaviour with no justification; these
// tests pin the inherited behaviour instead.
describe('ResponsiveDialog — trigger keys open only (D-09)', () => {
	for (const { isMobile, variant } of MODES) {
		for (const [name, key] of [
			['Enter', '{Enter}'],
			['Space', ' ']
		] as const) {
			it(`does not close an open ${variant} when ${name} reaches the trigger`, async () => {
				const user = userEvent.setup();
				seedViewport(isMobile);
				await renderResponsiveDialog();
				await openDialog(user);

				trigger().focus();
				await user.keyboard(key);
				await tick();
				await tick();

				expect(queryContent()).not.toBeNull();
				expect(content()).toHaveAttribute('data-variant', variant);
			});
		}
	}
});

// D-03: the `child` snippet replaces upstream's `asChild`. All four demo previews rely on it.
describe('ResponsiveDialog — child snippet', () => {
	for (const { isMobile, variant } of MODES) {
		it(`renders Trigger, Close, Title and Description through child in ${variant} mode`, async () => {
			const user = userEvent.setup();
			seedViewport(isMobile);
			await renderResponsiveDialog({
				mode: 'child-snippet',
				triggerClass: 'trigger-custom',
				closeClass: 'close-custom',
				titleClass: 'title-custom',
				descriptionClass: 'description-custom'
			});

			const triggerElement = trigger();
			expect(triggerElement).toHaveAttribute('data-slot', 'responsive-dialog-trigger');
			expect(triggerElement).toHaveAttribute('data-variant', variant);
			expect(triggerElement).toHaveClass('trigger-custom');

			const element = await openDialog(user);

			const title = bySlot('responsive-dialog-title');
			expect(title.tagName).toBe('H2');
			expect(title).toHaveAttribute('data-variant', variant);
			expect(title).toHaveClass('title-custom');

			const description = bySlot('responsive-dialog-description');
			expect(description.tagName).toBe('P');
			expect(description).toHaveAttribute('data-variant', variant);
			expect(description).toHaveClass('description-custom');

			// The child-rendered elements still carry the ARIA wiring the default rendering does.
			expect(element).toHaveAttribute('aria-labelledby', title.id);
			expect(element).toHaveAttribute('aria-describedby', description.id);

			const close = bySlot('responsive-dialog-close');
			expect(close).toHaveAttribute('data-variant', variant);
			expect(close).toHaveClass('close-custom');

			await user.click(close);
			await vi.waitFor(() => expect(queryContent()).toBeNull());
		});

		it(`opens from a child-rendered trigger with the keyboard in ${variant} mode`, async () => {
			const user = userEvent.setup();
			seedViewport(isMobile);
			await renderResponsiveDialog({ mode: 'child-snippet' });

			trigger().focus();
			await user.keyboard('{Enter}');
			await tick();

			const element = await vi.waitFor(() => content());
			expect(element).toHaveAttribute('data-variant', variant);
		});
	}
});

describe('ResponsiveDialog — per-part ref and restProps', () => {
	const PARTS = [
		'trigger',
		'close',
		'overlay',
		'content',
		'header',
		'footer',
		'title',
		'description'
	] as const;

	for (const { isMobile, variant } of MODES) {
		it(`binds every part's ref to its rendered element in ${variant} mode`, async () => {
			const user = userEvent.setup();
			seedViewport(isMobile);
			let refs: ResponsiveDialogHarnessRefs | undefined;
			await renderResponsiveDialog({
				mode: 'with-portal',
				footerShowCloseButton: false,
				onRefs: (next) => (refs = next)
			});
			await openDialog(user);
			await tick();

			for (const part of PARTS) {
				expect(refs?.[part]).toBe(bySlot(`responsive-dialog-${part}`));
			}
		});

		it(`forwards arbitrary attributes to every part in ${variant} mode`, async () => {
			const user = userEvent.setup();
			seedViewport(isMobile);

			const partRest: NonNullable<ResponsiveDialogHarnessProps['partRest']> = {};
			for (const part of PARTS) {
				partRest[part] = {
					id: `${part}-id`,
					'data-probe': part,
					'aria-keyshortcuts': 'e'
				};
			}

			await renderResponsiveDialog({
				mode: 'with-portal',
				footerShowCloseButton: false,
				partRest,
				contentRest: partRest.content
			});
			await openDialog(user);

			for (const part of PARTS) {
				const element = bySlot(`responsive-dialog-${part}`);
				expect(element).toHaveAttribute('id', `${part}-id`);
				expect(element).toHaveAttribute('data-probe', part);
				expect(element).toHaveAttribute('aria-keyshortcuts', 'e');
			}
		});
	}
});

describe('ResponsiveDialog — portalProps', () => {
	for (const { isMobile, variant } of MODES) {
		it(`forwards portalProps to the active content's portal in ${variant} mode`, async () => {
			const user = userEvent.setup();
			seedViewport(isMobile);
			const container = document.createElement('div');
			container.id = 'portal-target';
			document.body.appendChild(container);

			try {
				await renderResponsiveDialog({ contentPortalProps: { to: container } });
				const element = await openDialog(user);

				expect(element).toHaveAttribute('data-variant', variant);
				expect(container.contains(element)).toBe(true);
			} finally {
				container.remove();
			}
		});
	}
});

describe('ResponsiveDialog — layout per variant', () => {
	it('centers the content in dialog mode', async () => {
		const user = userEvent.setup();
		seedViewport(false);
		await renderResponsiveDialog();
		const element = await openDialog(user);

		expect(element).toHaveClass(
			'fixed',
			'top-1/2',
			'left-1/2',
			'-translate-x-1/2',
			'-translate-y-1/2'
		);
	});

	it('anchors the content to the bottom in drawer mode', async () => {
		const user = userEvent.setup();
		seedViewport(true);
		await renderResponsiveDialog();
		const element = await openDialog(user);

		expect(element).toHaveAttribute('data-vaul-drawer-direction', 'bottom');
		expect(element).toHaveClass(
			'fixed',
			'data-[vaul-drawer-direction=bottom]:inset-x-0',
			'data-[vaul-drawer-direction=bottom]:bottom-0',
			'data-[vaul-drawer-direction=bottom]:rounded-t-xl'
		);
		expect(element).not.toHaveClass('top-1/2', 'left-1/2');
	});
});

describe('ResponsiveDialog — modal focus containment', () => {
	// The primitives' focus scope resolves its tab ring through `tabbable`, which treats an element
	// with no client rects as hidden — and jsdom gives every element zero rects, which would leave
	// the trap silently inert. Give elements a box, exactly as a browser would.
	beforeEach(() => {
		vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(
			() => [new DOMRect(0, 0, 120, 24)] as unknown as DOMRectList
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	for (const { isMobile, variant } of MODES) {
		it(`keeps Tab and Shift+Tab inside the open content in ${variant} mode`, async () => {
			const user = userEvent.setup();
			seedViewport(isMobile);
			await renderResponsiveDialog();
			const element = await openDialog(user);

			const focusables = focusablesIn(element);
			expect(focusables.length).toBeGreaterThan(1);
			const first = focusables[0];
			const last = focusables[focusables.length - 1];

			last?.focus();
			await user.tab();
			expect(element.contains(document.activeElement)).toBe(true);
			expect(first).toHaveFocus();

			first?.focus();
			await user.tab({ shift: true });
			expect(element.contains(document.activeElement)).toBe(true);
			expect(last).toHaveFocus();
		});
	}
});

describe('ResponsiveDialog — documented previews', () => {
	for (const { isMobile, variant } of MODES) {
		it(`closes the confirmation preview from Cancel in ${variant} mode`, async () => {
			const user = userEvent.setup();
			seedViewport(isMobile);
			await renderResponsiveDialog({ mode: 'confirm' });
			await openDialog(user);

			await user.click(screen.getByRole('button', { name: 'Cancel' }));
			await tick();

			await vi.waitFor(() => expect(queryContent()).toBeNull());
		});

		it(`keeps the confirmation preview open while its action is pending in ${variant} mode`, async () => {
			const user = userEvent.setup();
			seedViewport(isMobile);
			await renderResponsiveDialog({ mode: 'confirm' });
			await openDialog(user);

			await user.click(screen.getByTestId('confirm-action'));
			await tick();
			await tick();

			expect(screen.getByTestId('confirm-pending')).toBeInTheDocument();
			expect(queryContent()).not.toBeNull();
			expect(content()).toHaveAttribute('data-variant', variant);
		});
	}

	it('keeps variant-scoped class lists on Content and Footer across a crossing', async () => {
		const user = userEvent.setup();
		const variantClasses = {
			contentClass: 'data-[variant=dialog]:max-w-md data-[variant=drawer]:pb-8',
			footerClass: 'data-[variant=dialog]:flex-row data-[variant=drawer]:flex-col'
		};
		seedViewport(false);
		await renderResponsiveDialog(variantClasses);
		await openDialog(user);

		const assertVariantClasses = (variant: string) => {
			expect(content()).toHaveAttribute('data-variant', variant);
			expect(content()).toHaveClass('data-[variant=dialog]:max-w-md', 'data-[variant=drawer]:pb-8');
			expect(bySlot('responsive-dialog-footer')).toHaveClass(
				'data-[variant=dialog]:flex-row',
				'data-[variant=drawer]:flex-col'
			);
		};

		assertVariantClasses('dialog');
		await setViewport(true);
		assertVariantClasses('drawer');
	});
});

describe('ResponsiveDialog — root pass-through and defaultOpen', () => {
	it('passes an unhandled prop through to the active drawer root', async () => {
		const user = userEvent.setup();
		seedViewport(true);
		await renderResponsiveDialog({ rootRest: { direction: 'top' } });
		const element = await openDialog(user);

		expect(element).toHaveAttribute('data-vaul-drawer-direction', 'top');
	});

	// `bits-ui`'s `Dialog.Root` renders no element of its own and consumes only `open`,
	// `onOpenChange` and `onOpenChangeComplete`, so a drawer-only prop has nowhere to land in dialog
	// mode: the pass-through must be inert rather than leak an attribute into the dialog branch.
	it('leaves the dialog branch untouched by a drawer-only root prop', async () => {
		const user = userEvent.setup();
		seedViewport(false);
		await renderResponsiveDialog({ rootRest: { direction: 'top' } });
		const element = await openDialog(user);

		expect(element).toHaveAttribute('data-variant', 'dialog');
		expect(document.querySelector('[data-vaul-drawer-direction]')).toBeNull();
	});

	it('seeds the open state from defaultOpen in drawer mode', async () => {
		seedViewport(true);
		await renderResponsiveDialog({ defaultOpen: true });

		const element = await vi.waitFor(() => content());
		expect(element).toHaveAttribute('data-variant', 'drawer');
	});
});
