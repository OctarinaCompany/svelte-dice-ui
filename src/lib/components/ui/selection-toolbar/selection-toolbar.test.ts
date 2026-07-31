import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	DEFAULT_ALIGN_OFFSET,
	DEFAULT_SIDE_OFFSET,
	SELECTION_TOOLBAR_ALIGNMENTS,
	SELECTION_TOOLBAR_ITEM_SELECT,
	SELECTION_TOOLBAR_ITEM_SELECT_OPTIONS,
	SELECTION_TOOLBAR_SIDES,
	type SelectionToolbarItemSelectEvent
} from './index.js';
import Harness, {
	SELECTION_TOOLBAR_HARNESS_OUTSIDE_TEXT,
	SELECTION_TOOLBAR_HARNESS_SECOND_TEXT,
	SELECTION_TOOLBAR_HARNESS_TEXT,
	type SelectionToolbarHarnessControls,
	type SelectionToolbarHarnessRefs
} from './selection-toolbar.test.svelte';

type HarnessProps = Record<string, unknown>;

/** The phrase of the fixture's second block that cross-element ranges end on. */
const SECOND_PHRASE = 'A second paragraph';

/** Every `bind:ref` starts out unset; specs overwrite this through the harness's `onRefs`. */
const NO_REFS: SelectionToolbarHarnessRefs = { root: null, item: null, separator: null };

/** Nodes a spec appended to `document.body` itself, torn down after testing-library's cleanup. */
const hosts: HTMLElement[] = [];

afterEach(() => {
	for (const host of hosts.splice(0)) host.remove();
});

function createHost(id?: string): HTMLElement {
	const host = document.createElement('div');
	if (id) host.id = id;
	document.body.appendChild(host);
	hosts.push(host);
	return host;
}

function renderToolbar(props: HarnessProps = {}) {
	return render(Harness, { props });
}

/** The surface is portalled outside the render container, so every query goes through `screen`. */
function toolbar(): HTMLElement {
	return screen.getByRole('toolbar');
}

function queryToolbar(): HTMLElement | null {
	return screen.queryByRole('toolbar');
}

function item(name: string): HTMLElement {
	return screen.getByRole('button', { name });
}

function bySlot(slot: string): HTMLElement {
	const element = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

/** `style` is assembled by `mergeProps`, so the raw attribute is the reliable thing to assert on. */
function styleOf(element: HTMLElement): string {
	return element.getAttribute('style') ?? '';
}

function selection(): Selection {
	const current = window.getSelection();
	if (!current) throw new Error('jsdom returned no Selection');
	return current;
}

/** The first text node with actual content — the fixture's blocks are separated by whitespace nodes. */
function firstTextNode(root: HTMLElement): Text {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	let node = walker.nextNode();
	while (node && !node.nodeValue?.trim()) node = walker.nextNode();
	if (!node) throw new Error('the fixture rendered no text node');
	return node as Text;
}

/** Puts a real `Range` over `phrase` inside `root` — the input the component actually reads. */
function selectPhrase(root: HTMLElement, phrase: string): Range {
	const node = firstTextNode(root);
	const start = node.data.indexOf(phrase);
	if (start < 0) throw new Error(`"${phrase}" is not part of the fixture text`);

	const range = document.createRange();
	range.setStart(node, start);
	range.setEnd(node, start + phrase.length);

	const current = selection();
	current.removeAllRanges();
	current.addRange(range);
	return range;
}

/**
 * Puts a `Range` that starts inside `startRoot` and ends inside `endRoot`, so its
 * `commonAncestorContainer` is an `Element` rather than the `Text` node `selectPhrase` produces.
 */
function selectAcross(
	startRoot: HTMLElement,
	startPhrase: string,
	endRoot: HTMLElement,
	endPhrase: string
): Range {
	const startNode = firstTextNode(startRoot);
	const endNode = firstTextNode(endRoot);
	const start = startNode.data.indexOf(startPhrase);
	const end = endNode.data.indexOf(endPhrase);
	if (start < 0) throw new Error(`"${startPhrase}" is not part of the start fixture text`);
	if (end < 0) throw new Error(`"${endPhrase}" is not part of the end fixture text`);

	const range = document.createRange();
	range.setStart(startNode, start);
	range.setEnd(endNode, end + endPhrase.length);

	const current = selection();
	current.removeAllRanges();
	current.addRange(range);
	return range;
}

/** Upstream defers every read to the next animation frame, so specs have to wait for one. */
async function frames(count = 2): Promise<void> {
	for (let index = 0; index < count; index += 1) {
		await new Promise<number>((resolve) => requestAnimationFrame(resolve));
	}
	await tick();
}

/**
 * Waits out both asynchronous gaps in the layer stack: the `afterSleep(1)` before the dismissible
 * layer attaches its listeners, and the 10 ms debounce it puts on an outside interaction.
 */
async function settle(): Promise<void> {
	await tick();
	await new Promise((resolve) => setTimeout(resolve, 30));
	await frames();
}

function editor(): HTMLElement {
	return screen.getByTestId('editor');
}

/** Select `phrase` in the editable fixture and raise the `mouseup` the component opens from. */
async function openWith(phrase: string, target: HTMLElement = editor()): Promise<void> {
	selectPhrase(editor(), phrase);
	await fireEvent.mouseUp(target);
	await frames();
	await settle();
}

/** Records every `selectiontoolbar.select` that reaches the document. */
function recordSelectEvents(): { events: SelectionToolbarItemSelectEvent[]; stop: () => void } {
	const events: SelectionToolbarItemSelectEvent[] = [];
	const listener = (event: Event) => events.push(event as SelectionToolbarItemSelectEvent);
	document.addEventListener(SELECTION_TOOLBAR_ITEM_SELECT, listener);
	return {
		events,
		stop: () => document.removeEventListener(SELECTION_TOOLBAR_ITEM_SELECT, listener)
	};
}

/** Records every `pointerdown` that reaches the document, so `defaultPrevented` can be inspected. */
function recordPointerDowns(): { events: PointerEvent[]; stop: () => void } {
	const events: PointerEvent[] = [];
	const listener = (event: Event) => events.push(event as PointerEvent);
	document.addEventListener('pointerdown', listener);
	return { events, stop: () => document.removeEventListener('pointerdown', listener) };
}

// ---------------------------------------------------------------------------
// Module constants — the documented option lists and defaults
// ---------------------------------------------------------------------------

describe('selection toolbar module exports', () => {
	it('enumerates the documented sides, alignments and offsets', () => {
		expect(SELECTION_TOOLBAR_SIDES).toEqual(['top', 'right', 'bottom', 'left']);
		expect(SELECTION_TOOLBAR_ALIGNMENTS).toEqual(['start', 'center', 'end']);
		expect(DEFAULT_SIDE_OFFSET).toBe(8);
		expect(DEFAULT_ALIGN_OFFSET).toBe(0);
	});

	it('names the bubbling, cancelable select event exactly as upstream', () => {
		expect(SELECTION_TOOLBAR_ITEM_SELECT).toBe('selectiontoolbar.select');
		expect(SELECTION_TOOLBAR_ITEM_SELECT_OPTIONS).toEqual({ bubbles: true, cancelable: true });
	});
});

// ---------------------------------------------------------------------------
// T005 — roles, ARIA, data attributes, CSS variables and the `child` snippets
// ---------------------------------------------------------------------------

describe('selection toolbar roles and ARIA (T005, FR-012, FR-018, FR-020)', () => {
	it('renders nothing until a selection opens it', () => {
		renderToolbar({ container: 'scoped' });
		expect(queryToolbar()).toBeNull();
	});

	it('exposes the documented role, accessible name and data attributes once open', async () => {
		renderToolbar({ container: 'scoped' });
		await openWith('brown fox');

		const surface = toolbar();
		expect(surface).toHaveAttribute('aria-label', 'Text formatting toolbar');
		expect(surface).toHaveAttribute('data-slot', 'selection-toolbar');
		expect(surface).toHaveAttribute('data-state', 'open');
	});

	it('resolves a side and an alignment onto the open surface', async () => {
		renderToolbar({ container: 'scoped', side: 'top', align: 'center' });
		await openWith('brown fox');

		expect(toolbar()).toHaveAttribute('data-side', 'top');
		expect(toolbar()).toHaveAttribute('data-align', 'center');
	});

	it('aliases the four documented custom properties onto the floating layer’s own', async () => {
		renderToolbar({ container: 'scoped' });
		await openWith('brown fox');

		const style = styleOf(toolbar());
		expect(style).toMatch(
			/--selection-toolbar-available-width:\s*var\(--bits-popover-content-available-width\)/
		);
		expect(style).toMatch(
			/--selection-toolbar-available-height:\s*var\(--bits-popover-content-available-height\)/
		);
		expect(style).toMatch(/--selection-toolbar-anchor-width:\s*var\(--bits-popover-anchor-width\)/);
		expect(style).toMatch(
			/--selection-toolbar-anchor-height:\s*var\(--bits-popover-anchor-height\)/
		);
	});

	it('keeps a caller’s own declarations after the aliased ones', async () => {
		renderToolbar({ container: 'scoped', rootStyle: 'opacity: 0.5;' });
		await openWith('brown fox');

		expect(styleOf(toolbar())).toMatch(/opacity:\s*0\.5/);
	});

	it('merges the caller’s class last', async () => {
		renderToolbar({ container: 'scoped', rootClass: 'custom-toolbar' });
		await openWith('brown fox');

		expect(toolbar()).toHaveClass('custom-toolbar');
	});

	it('slots every part', async () => {
		renderToolbar({ container: 'scoped' });
		await openWith('brown fox');

		expect(bySlot('selection-toolbar')).toBe(toolbar());
		expect(item('Bold')).toHaveAttribute('data-slot', 'selection-toolbar-item');
		expect(bySlot('selection-toolbar-separator')).toBeInTheDocument();
	});

	it('renders the separator as a decorative vertical rule', async () => {
		renderToolbar({ container: 'scoped' });
		await openWith('brown fox');

		const separator = screen.getByTestId('separator');
		expect(separator).toHaveAttribute('role', 'separator');
		expect(separator).toHaveAttribute('aria-orientation', 'vertical');
		expect(separator).toHaveAttribute('aria-hidden', 'true');
	});

	it('renders the caller’s element for the root `child` snippet and leaves `ref` null', async () => {
		let refs: SelectionToolbarHarnessRefs = NO_REFS;
		renderToolbar({
			container: 'scoped',
			rootChild: true,
			onRefs: (next: SelectionToolbarHarnessRefs) => (refs = next)
		});
		await openWith('brown fox');

		const surface = toolbar();
		expect(surface.tagName).toBe('SECTION');
		expect(surface).toHaveAttribute('data-testid', 'root-child');
		expect(surface).toHaveAttribute('data-slot', 'selection-toolbar');
		expect(document.querySelectorAll('[data-slot="selection-toolbar"]')).toHaveLength(1);
		expect(refs.root).toBeNull();
	});

	it('renders the caller’s element for the separator `child` snippet', async () => {
		let refs: SelectionToolbarHarnessRefs = NO_REFS;
		renderToolbar({
			container: 'scoped',
			separatorChild: true,
			onRefs: (next: SelectionToolbarHarnessRefs) => (refs = next)
		});
		await openWith('brown fox');

		const separator = screen.getByTestId('separator-child');
		expect(separator).toHaveAttribute('data-slot', 'selection-toolbar-separator');
		expect(separator).toHaveAttribute('role', 'separator');
		expect(screen.queryByTestId('separator')).toBeNull();
		expect(refs.separator).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// T006 — keyboard
// ---------------------------------------------------------------------------

/**
 * A live `Tab` or `Enter` cannot be driven through `userEvent` here: its emulated focus move
 * empties `window.getSelection()`, jsdom then delivers a `selectionchange` with no text, and the
 * toolbar closes — which is the component behaving exactly as documented, on an input no browser
 * produces (focusing a `<button>` never collapses the document selection). The tab order is
 * therefore asserted structurally, and the keyboard activation path is driven with the bare `click`
 * a browser synthesises for `Enter`/`Space` on a `<button>` — no pointer event precedes it, which is
 * the whole point of that branch (research R-06).
 */
describe('selection toolbar keyboard (T006, FR-008, FR-010)', () => {
	it('gives every item its own tab stop, in DOM order', async () => {
		renderToolbar({ container: 'scoped' });
		await openWith('brown fox');

		const bold = item('Bold');
		const italic = item('Italic');

		// No roving tabindex: upstream ships a flat list of independently tabbable buttons.
		expect(bold).not.toHaveAttribute('tabindex');
		expect(italic).not.toHaveAttribute('tabindex');
		// The surface itself never takes the tab order.
		expect(toolbar()).toHaveAttribute('tabindex', '-1');
		expect(bold.compareDocumentPosition(italic) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it('activates a focused item without a pointer, as Enter and Space do', async () => {
		const onSelect = vi.fn();
		renderToolbar({
			container: 'scoped',
			items: [{ key: 'bold', label: 'Bold', onSelect }]
		});
		await openWith('brown fox');

		const bold = item('Bold');
		bold.focus();
		await fireEvent.click(bold);

		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect.mock.calls[0][0]).toBe('brown fox');
	});

	it('keeps the toolbar open after a keyboard activation', async () => {
		renderToolbar({ container: 'scoped' });
		await openWith('brown fox');

		const bold = item('Bold');
		bold.focus();
		await fireEvent.click(bold);

		expect(queryToolbar()).not.toBeNull();
	});

	it('closes and clears the live selection on Escape', async () => {
		const user = userEvent.setup();
		renderToolbar({ container: 'scoped' });
		await openWith('brown fox');
		expect(toolbar()).toBeInTheDocument();

		await user.keyboard('{Escape}');
		await settle();

		expect(queryToolbar()).toBeNull();
		expect(selection().rangeCount).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// T007 — uncontrolled state
// ---------------------------------------------------------------------------

describe('selection toolbar uncontrolled state (T007, FR-001, FR-003)', () => {
	it('opens itself on a non-empty selection and reports the trimmed text', async () => {
		const onSelectionChange = vi.fn();
		renderToolbar({ container: 'scoped', onSelectionChange });
		await openWith('brown fox');

		expect(toolbar()).toBeInTheDocument();
		expect(onSelectionChange).toHaveBeenCalledWith('brown fox');
	});

	it('reports the trimmed text for a selection padded with whitespace', async () => {
		const onSelectionChange = vi.fn();
		renderToolbar({ container: 'scoped', onSelectionChange });
		await openWith(' brown fox ');

		expect(onSelectionChange).toHaveBeenCalledWith('brown fox');
	});

	it('closes and reports an empty string when the selection is collapsed', async () => {
		const onSelectionChange = vi.fn();
		renderToolbar({ container: 'scoped', onSelectionChange });
		await openWith('brown fox');
		onSelectionChange.mockClear();

		selection().removeAllRanges();
		document.dispatchEvent(new Event('selectionchange'));
		await frames();

		expect(queryToolbar()).toBeNull();
		expect(onSelectionChange).toHaveBeenCalledWith('');
	});

	it('stays open and updates in place when the selection is extended', async () => {
		const onSelectionChange = vi.fn();
		const onOpenChange = vi.fn();
		renderToolbar({ container: 'scoped', onSelectionChange, onOpenChange });
		await openWith('brown fox');
		expect(onOpenChange).toHaveBeenCalledTimes(1);

		await openWith('brown fox jumps');

		expect(toolbar()).toBeInTheDocument();
		expect(onSelectionChange).toHaveBeenLastCalledWith('brown fox jumps');
		// Extending a selection is not a close/reopen: `open` never transitioned a second time.
		expect(onOpenChange).toHaveBeenCalledTimes(1);
	});

	it('ignores an all-whitespace selection', async () => {
		const onSelectionChange = vi.fn();
		renderToolbar({ container: 'scoped', onSelectionChange });
		await openWith(' ');

		expect(queryToolbar()).toBeNull();
		expect(onSelectionChange).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// T008 — controlled state
// ---------------------------------------------------------------------------

describe('selection toolbar controlled state (T008, FR-002)', () => {
	it('writes the new open state back through the binding and notifies once', async () => {
		const onOpenChange = vi.fn();
		const bindings: (boolean | undefined)[] = [];
		renderToolbar({
			container: 'scoped',
			binding: 'open',
			onOpenChange,
			onOpenBinding: (open: boolean | undefined) => bindings.push(open)
		});
		await openWith('brown fox');

		expect(toolbar()).toBeInTheDocument();
		expect(bindings.at(-1)).toBe(true);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenCalledWith(true);
	});

	it('lets the parent close it, and does not reopen on its own', async () => {
		let controls: SelectionToolbarHarnessControls | undefined;
		renderToolbar({
			container: 'scoped',
			binding: 'open',
			onControls: (next: SelectionToolbarHarnessControls) => (controls = next)
		});
		await openWith('brown fox');
		expect(toolbar()).toBeInTheDocument();

		controls?.setOpen(false);
		await frames();
		expect(queryToolbar()).toBeNull();

		// The selection is still live, but nothing may raise the surface without a new event.
		expect(selection().rangeCount).toBe(1);
		await frames(3);
		expect(queryToolbar()).toBeNull();
	});

	it('notifies with the next boolean on every transition, never twice for one event', async () => {
		const onOpenChange = vi.fn();
		renderToolbar({ container: 'scoped', binding: 'open', onOpenChange });
		await openWith('brown fox');
		expect(onOpenChange.mock.calls).toEqual([[true]]);

		selection().removeAllRanges();
		document.dispatchEvent(new Event('selectionchange'));
		await frames();

		expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
	});
});

// ---------------------------------------------------------------------------
// T009 — RTL
// ---------------------------------------------------------------------------

describe('selection toolbar RTL (T009, FR-015)', () => {
	it('forwards an explicit dir onto the floating surface', async () => {
		renderToolbar({ container: 'scoped', dir: 'rtl' });
		await openWith('brown fox');

		expect(toolbar()).toHaveAttribute('dir', 'rtl');
	});

	it('inherits the direction from a DirectionProvider ancestor', async () => {
		renderToolbar({ container: 'scoped', providerDir: 'rtl' });
		await openWith('brown fox');

		expect(toolbar()).toHaveAttribute('dir', 'rtl');
	});

	it('falls back to ltr with no provider and no explicit dir', async () => {
		renderToolbar({ container: 'scoped' });
		await openWith('brown fox');

		expect(toolbar()).toHaveAttribute('dir', 'ltr');
	});
});

// ---------------------------------------------------------------------------
// T010 — guard rails
// ---------------------------------------------------------------------------

describe('selection toolbar container scoping (T010a, FR-004)', () => {
	it('ignores a selection made outside the scoped container', async () => {
		const onSelectionChange = vi.fn();
		renderToolbar({ container: 'scoped', onSelectionChange });

		const outside = screen.getByTestId('outside');
		selectPhrase(outside, SELECTION_TOOLBAR_HARNESS_OUTSIDE_TEXT);
		await fireEvent.mouseUp(editor());
		await frames();

		expect(queryToolbar()).toBeNull();
		expect(onSelectionChange).not.toHaveBeenCalled();
	});

	it('reacts to a selection made inside the scoped container', async () => {
		renderToolbar({ container: 'scoped' });
		await openWith('lazy dog');

		expect(toolbar()).toBeInTheDocument();
	});

	it('tracks the whole document when no container is given', async () => {
		renderToolbar();

		const outside = screen.getByTestId('outside');
		selectPhrase(outside, SELECTION_TOOLBAR_HARNESS_OUTSIDE_TEXT);
		await fireEvent.mouseUp(outside);
		await frames();

		expect(toolbar()).toBeInTheDocument();
	});

	it('neither opens nor closes while the container is scoped but unresolved', async () => {
		const onSelectionChange = vi.fn();
		const onOpenChange = vi.fn();
		renderToolbar({ container: 'null', onSelectionChange, onOpenChange });

		selectPhrase(editor(), 'brown fox');
		await fireEvent.mouseUp(document.body);
		await frames();

		expect(queryToolbar()).toBeNull();
		expect(onSelectionChange).not.toHaveBeenCalled();
		expect(onOpenChange).not.toHaveBeenCalled();
	});
});

describe('selection toolbar item activation (T010b/T010c, FR-010, FR-014)', () => {
	it('dispatches a bubbling, cancelable event carrying the selected text', async () => {
		const user = userEvent.setup();
		const recorder = recordSelectEvents();
		renderToolbar({ container: 'scoped' });
		await openWith('brown fox');

		await user.click(item('Bold'));

		expect(recorder.events).toHaveLength(1);
		expect(recorder.events[0].bubbles).toBe(true);
		expect(recorder.events[0].cancelable).toBe(true);
		expect(recorder.events[0].detail).toEqual({ text: 'brown fox' });
		recorder.stop();
	});

	it('prevents the default of a mouse pointerdown and activates on pointerup, once', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		const pointers = recordPointerDowns();
		renderToolbar({ container: 'scoped', items: [{ key: 'bold', label: 'Bold', onSelect }] });
		await openWith('brown fox');

		const bold = item('Bold');
		await user.pointer([
			{ keys: '[MouseLeft>]', target: bold },
			{ keys: '[/MouseLeft]', target: bold }
		]);

		expect(pointers.events.at(-1)?.defaultPrevented).toBe(true);
		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect.mock.calls[0][0]).toBe('brown fox');

		// A bare `click` after a mouse press must not activate a second time.
		await fireEvent.click(bold);
		expect(onSelect).toHaveBeenCalledTimes(1);
		pointers.stop();
	});

	it('never prevents a touch pointerdown and activates on click instead', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		const pointers = recordPointerDowns();
		renderToolbar({ container: 'scoped', items: [{ key: 'bold', label: 'Bold', onSelect }] });
		await openWith('brown fox');

		const bold = item('Bold');
		await user.pointer([
			{ keys: '[TouchA>]', target: bold },
			{ keys: '[/TouchA]', target: bold }
		]);

		expect(pointers.events.at(-1)?.defaultPrevented).toBe(false);
		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect.mock.calls[0][0]).toBe('brown fox');
		pointers.stop();
	});

	it('lets a caller onclick suppress the non-mouse activation with preventDefault', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		renderToolbar({
			container: 'scoped',
			items: [
				{
					key: 'bold',
					label: 'Bold',
					onSelect,
					onclick: (event: MouseEvent) => event.preventDefault()
				}
			]
		});
		await openWith('brown fox');

		// Touch activates on `click`, so that is the handler a caller cancels on this path.
		const bold = item('Bold');
		await user.pointer([
			{ keys: '[TouchA>]', target: bold },
			{ keys: '[/TouchA]', target: bold }
		]);

		expect(onSelect).not.toHaveBeenCalled();
	});

	it('lets a caller onpointerup suppress the mouse activation with preventDefault', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		renderToolbar({
			container: 'scoped',
			items: [
				{
					key: 'bold',
					label: 'Bold',
					onSelect,
					onpointerup: (event: PointerEvent) => event.preventDefault()
				}
			]
		});
		await openWith('brown fox');

		const bold = item('Bold');
		await user.pointer([
			{ keys: '[MouseLeft>]', target: bold },
			{ keys: '[/MouseLeft]', target: bold }
		]);

		expect(onSelect).not.toHaveBeenCalled();
	});

	it('never activates a disabled item', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		renderToolbar({
			container: 'scoped',
			items: [{ key: 'bold', label: 'Bold', disabled: true, onSelect }]
		});
		await openWith('brown fox');

		const bold = item('Bold');
		expect(bold).toBeDisabled();
		await user.pointer([
			{ keys: '[MouseLeft>]', target: bold },
			{ keys: '[/MouseLeft]', target: bold }
		]);
		await fireEvent.click(bold);

		expect(onSelect).not.toHaveBeenCalled();
	});
});

describe('selection toolbar outside dismissal (T010d, FR-009)', () => {
	it('drops the browser’s ranges on a pointer press outside the surface', async () => {
		renderToolbar({ container: 'scoped' });
		await openWith('brown fox');
		expect(toolbar()).toBeInTheDocument();

		await fireEvent.pointerDown(screen.getByTestId('outside'));
		await settle();

		expect(queryToolbar()).toBeNull();
		expect(selection().rangeCount).toBe(0);
	});

	it('closes and leaves nothing selected after a full click outside', async () => {
		const user = userEvent.setup();
		renderToolbar({ container: 'scoped' });
		await openWith('brown fox');

		await user.click(screen.getByTestId('outside-button'));
		await settle();

		expect(queryToolbar()).toBeNull();
		// A real press re-seats a collapsed caret where it landed, so the assertion is on the text,
		// not on `rangeCount`: nothing is selected any more.
		expect(selection().toString()).toBe('');
	});

	it('dismisses nothing when the press lands on the surface itself', async () => {
		renderToolbar({ container: 'scoped' });
		await openWith('brown fox');

		// `fireEvent` rather than `userEvent`: the latter emulates the focus a real press would move
		// into the surface, and that emulation empties the document selection (see the keyboard note).
		await fireEvent.pointerDown(screen.getByTestId('separator'));
		await settle();

		expect(toolbar()).toBeInTheDocument();
		expect(selection().rangeCount).toBe(1);
	});

	it('dismisses nothing when the press lands on one of its items', async () => {
		const user = userEvent.setup();
		renderToolbar({ container: 'scoped' });
		await openWith('brown fox');

		await user.click(item('Bold'));
		await settle();

		expect(toolbar()).toBeInTheDocument();
		expect(selection().rangeCount).toBe(1);
	});
});

describe('selection toolbar provider guard rails (T010e, FR-016)', () => {
	it('throws when an item is rendered outside a root', () => {
		expect(() => renderToolbar({ mode: 'bare-item' })).toThrow(
			/`<SelectionToolbar\.Item>` must be used within `<SelectionToolbar>`\./
		);
	});

	it('throws when a separator is rendered outside a root', () => {
		expect(() => renderToolbar({ mode: 'bare-separator' })).toThrow(
			/`<SelectionToolbar\.Separator>` must be used within `<SelectionToolbar>`\./
		);
	});

	it('names the failing part in the error, so the message is actionable', () => {
		expect(() => renderToolbar({ mode: 'bare-item' })).toThrow(/within/);
		expect(SELECTION_TOOLBAR_HARNESS_TEXT).toContain('brown fox');
	});
});

// ---------------------------------------------------------------------------
// T024 — portalContainer, end to end
// ---------------------------------------------------------------------------

describe('selection toolbar portalling (T024, FR-013)', () => {
	it('portals to document.body by default, outside the render container', async () => {
		const { container } = renderToolbar({ container: 'scoped' });
		await openWith('brown fox');

		const surface = toolbar();
		expect(container).not.toContainElement(surface);
		expect(document.body).toContainElement(surface);
	});

	it('portals into a caller-supplied element', async () => {
		const host = createHost();
		renderToolbar({ container: 'scoped', portalContainer: host });
		await openWith('brown fox');

		expect(host).toContainElement(toolbar());
	});

	it('portals into the element a CSS selector resolves to', async () => {
		const host = createHost('selection-toolbar-portal-target');
		renderToolbar({
			container: 'scoped',
			portalContainer: '#selection-toolbar-portal-target'
		});
		await openWith('brown fox');

		expect(host).toContainElement(toolbar());
	});

	it('portals into a DocumentFragment through a display:contents host', async () => {
		const fragment = document.createDocumentFragment();
		const view = renderToolbar({ container: 'scoped', portalContainer: fragment });
		await openWith('brown fox');

		const host = fragment.querySelector<HTMLElement>('[data-slot="selection-toolbar-portal-host"]');
		expect(host).not.toBeNull();
		expect(host?.style.display).toBe('contents');
		expect(host?.querySelector('[data-slot="selection-toolbar"]')).not.toBeNull();
		// The whole surface lives in the detached fragment: nothing leaked into the document.
		expect(queryToolbar()).toBeNull();

		view.unmount();
		await tick();

		expect(fragment.querySelector('[data-slot="selection-toolbar-portal-host"]')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// T025 — teardown of the tracking effect
// ---------------------------------------------------------------------------

describe('selection toolbar teardown (T025)', () => {
	it('removes every tracking listener on unmount', async () => {
		const onSelectionChange = vi.fn();
		const onOpenChange = vi.fn();
		const view = renderToolbar({ container: 'scoped', onSelectionChange, onOpenChange });
		await openWith('brown fox');
		expect(toolbar()).toBeInTheDocument();

		const editorElement = editor();
		view.unmount();
		await frames();
		// The close the unmount itself performs is not what this spec is about.
		onSelectionChange.mockClear();
		onOpenChange.mockClear();

		selectPhrase(editorElement, 'lazy dog');

		// While attached, `mouseup`/`scroll`/`resize` each schedule a frame and `selectionchange`
		// reads the live selection. After teardown none of the four does anything at all — asserted
		// on the work itself rather than on the callbacks, because a listener that survives its
		// component throws inside the dispatch instead of reaching them.
		const raf = vi.spyOn(globalThis, 'requestAnimationFrame');
		const reads = vi.spyOn(window, 'getSelection');
		editorElement.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
		window.dispatchEvent(new Event('scroll'));
		window.dispatchEvent(new Event('resize'));
		document.dispatchEvent(new Event('selectionchange'));
		const scheduled = raf.mock.calls.length;
		const selectionReads = reads.mock.calls.length;
		raf.mockRestore();
		reads.mockRestore();
		await frames();

		expect(scheduled).toBe(0);
		expect(selectionReads).toBe(0);
		expect(onSelectionChange).not.toHaveBeenCalled();
		expect(onOpenChange).not.toHaveBeenCalled();
		expect(queryToolbar()).toBeNull();
	});

	it('cancels both frames that were still pending when the component went away', async () => {
		const view = renderToolbar({ container: 'scoped' });
		await openWith('brown fox');

		// Both queues hold a read at this point: `mouseup` schedules one, `scroll` the other, and
		// neither frame has run yet — the dispatches below are synchronous on purpose.
		const editorElement = editor();
		selectPhrase(editorElement, 'lazy dog');

		const raf = vi.spyOn(globalThis, 'requestAnimationFrame');
		editorElement.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
		window.dispatchEvent(new Event('scroll'));
		const pending = raf.mock.results.map((result) => result.value as number);
		raf.mockRestore();
		// Exactly the two tokens the tracker owns — nothing else scheduled a frame in that window.
		expect(pending).toHaveLength(2);

		const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame');
		view.unmount();
		const cancelled = cancel.mock.calls.map((call) => call[0]);
		cancel.mockRestore();
		await frames();

		expect(cancelled).toContain(pending[0]);
		expect(cancelled).toContain(pending[1]);
	});
});

// ---------------------------------------------------------------------------
// T026 — scheduleUpdate(): repositioning on scroll and resize
// ---------------------------------------------------------------------------

describe('selection toolbar repositioning (T026)', () => {
	it('re-reads the live selection on scroll while open', async () => {
		const onSelectionChange = vi.fn();
		renderToolbar({ container: 'scoped', onSelectionChange });
		await openWith('brown fox');
		onSelectionChange.mockClear();

		// The range moves with no `selectionchange` of its own — only the scroll drives the re-read.
		selectPhrase(editor(), 'lazy dog');
		window.dispatchEvent(new Event('scroll'));
		await frames();

		expect(onSelectionChange).toHaveBeenCalledWith('lazy dog');
		expect(toolbar()).toBeInTheDocument();
	});

	it('re-reads the live selection on resize while open', async () => {
		const onSelectionChange = vi.fn();
		renderToolbar({ container: 'scoped', onSelectionChange });
		await openWith('brown fox');
		onSelectionChange.mockClear();

		selectPhrase(editor(), 'lazy dog');
		window.dispatchEvent(new Event('resize'));
		await frames();

		expect(onSelectionChange).toHaveBeenCalledWith('lazy dog');
	});

	it('coalesces a burst of scroll and resize events into a single frame', async () => {
		renderToolbar({ container: 'scoped' });
		await openWith('brown fox');

		const raf = vi.spyOn(globalThis, 'requestAnimationFrame');
		window.dispatchEvent(new Event('scroll'));
		window.dispatchEvent(new Event('resize'));
		window.dispatchEvent(new Event('scroll'));
		window.dispatchEvent(new Event('resize'));
		const scheduled = raf.mock.calls.length;
		raf.mockRestore();
		await frames();

		expect(scheduled).toBe(1);
	});

	it('schedules no read at all while the toolbar is closed', async () => {
		const onSelectionChange = vi.fn();
		renderToolbar({ container: 'scoped', onSelectionChange });

		selectPhrase(editor(), 'brown fox');
		window.dispatchEvent(new Event('scroll'));
		window.dispatchEvent(new Event('resize'));
		await frames();

		expect(queryToolbar()).toBeNull();
		expect(onSelectionChange).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// T027 — selections that span element boundaries
// ---------------------------------------------------------------------------

describe('selection toolbar cross-element selections (T027, FR-004)', () => {
	it('opens once for a range spanning two blocks inside the container', async () => {
		const onSelectionChange = vi.fn();
		const onOpenChange = vi.fn();
		renderToolbar({ container: 'scoped', onSelectionChange, onOpenChange });
		expect(SELECTION_TOOLBAR_HARNESS_SECOND_TEXT).toContain(SECOND_PHRASE);

		const range = selectAcross(
			screen.getByTestId('editor-primary'),
			'lazy dog',
			screen.getByTestId('editor-secondary'),
			SECOND_PHRASE
		);
		// The branch this spec exists for: an `Element` common ancestor, not a `Text` node.
		expect(range.commonAncestorContainer.nodeType).toBe(Node.ELEMENT_NODE);

		await fireEvent.mouseUp(editor());
		await frames();
		await settle();

		expect(toolbar()).toBeInTheDocument();
		expect(onOpenChange.mock.calls).toEqual([[true]]);
		const text = onSelectionChange.mock.calls[0][0] as string;
		expect(text).toContain('lazy dog');
		expect(text).toContain(SECOND_PHRASE);
	});

	it('ignores a range that straddles the container boundary', async () => {
		const onSelectionChange = vi.fn();
		renderToolbar({ container: 'scoped', onSelectionChange });

		const range = selectAcross(
			screen.getByTestId('editor-primary'),
			'lazy dog',
			screen.getByTestId('outside'),
			'Prose'
		);
		expect(range.commonAncestorContainer.nodeType).toBe(Node.ELEMENT_NODE);

		await fireEvent.mouseUp(editor());
		await frames();

		expect(queryToolbar()).toBeNull();
		expect(onSelectionChange).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// T028 — the remaining documented part-level API surface
// ---------------------------------------------------------------------------

describe('selection toolbar part API surface (T028)', () => {
	it('hands onSelect the select event whose detail matches its text argument', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		renderToolbar({ container: 'scoped', items: [{ key: 'bold', label: 'Bold', onSelect }] });
		await openWith('brown fox');

		await user.click(item('Bold'));

		const [text, event] = onSelect.mock.calls[0] as [string, SelectionToolbarItemSelectEvent];
		expect(text).toBe('brown fox');
		expect(event.type).toBe(SELECTION_TOOLBAR_ITEM_SELECT);
		expect(event.bubbles).toBe(true);
		expect(event.cancelable).toBe(true);
		expect(event.detail.text).toBe(text);
	});

	it('renders the caller’s element for the item `child` snippet and leaves `ref` null', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		let refs: SelectionToolbarHarnessRefs = NO_REFS;
		renderToolbar({
			container: 'scoped',
			itemChild: true,
			items: [{ key: 'bold', label: 'Bold', onSelect }],
			onRefs: (next: SelectionToolbarHarnessRefs) => (refs = next)
		});
		await openWith('brown fox');

		const bold = item('Bold');
		expect(bold).toHaveAttribute('data-child', 'item');
		expect(bold).toHaveAttribute('data-slot', 'selection-toolbar-item');
		expect(bold).toHaveAttribute('data-testid', 'item-bold');
		expect(bold).toHaveClass('size-8');
		expect(refs.item).toBeNull();

		// The merged props carry the activation handlers, so the caller's element still selects.
		await user.click(bold);
		expect(onSelect).toHaveBeenCalledTimes(1);
	});

	it('populates every part’s `ref` with the rendered element in default mode', async () => {
		let refs: SelectionToolbarHarnessRefs = NO_REFS;
		renderToolbar({
			container: 'scoped',
			items: [{ key: 'bold', label: 'Bold' }],
			onRefs: (next: SelectionToolbarHarnessRefs) => (refs = next)
		});
		await openWith('brown fox');

		expect(refs.root).toBe(toolbar());
		expect(refs.item).toBe(item('Bold'));
		expect(refs.separator).toBe(screen.getByTestId('separator'));
	});

	it('lets a caller override the root’s default accessible name', async () => {
		renderToolbar({ container: 'scoped', rootAriaLabel: 'Formatting' });
		await openWith('brown fox');

		expect(toolbar()).toHaveAttribute('aria-label', 'Formatting');
		expect(screen.queryByLabelText('Text formatting toolbar')).toBeNull();
	});
});
