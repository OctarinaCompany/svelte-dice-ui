import type { Direction } from '$lib/components/ui/direction-provider/index.js';
import { resolveSegmentIntent } from '$lib/components/ui/segmented-input/index.js';
import {
	DomOrderedCollection,
	type DomOrderedEntry
} from '$lib/components/ui/speed-dial/speed-dial-collection.svelte.js';

/** What every column item publishes at registration time, read live so it is never stale. */
export type ColumnItemMeta = {
	readonly value: number | string;
	readonly getSelected: () => boolean;
};

/** What every column publishes at registration time. */
export type ColumnMeta = {
	readonly getItems: () => readonly DomOrderedEntry<ColumnItemMeta>[];
};

/**
 * Focus the first candidate that actually takes focus, in preference order
 * (radix/ui/time-picker.tsx:79-91).
 *
 * A candidate that already has focus ends the walk — re-focusing it would be a no-op that hides a
 * later, focusable candidate — and so does the first one that succeeds. Nothing focusable leaves the
 * active element exactly where it was.
 */
export function focusFirstOf(elements: readonly HTMLElement[]): void {
	const previous = document.activeElement;

	for (const element of elements) {
		if (element === previous) return;
		element.focus({ preventScroll: false });
		if (document.activeElement !== previous) return;
	}
}

function wrap(index: number, length: number, step: 1 | -1): number {
	if (length === 0) return -1;
	if (step === 1) return index < length - 1 ? index + 1 : 0;
	return index > 0 ? index - 1 : length - 1;
}

export type ColumnNavigationProps = {
	readonly getDir: () => Direction;
};

/**
 * The wrap-around focus model of a multi-column roulette picker: several independent,
 * simultaneously-visible columns, each committing its own value while the panel stays open.
 *
 * Written once here and **exported for reuse** — a Date Picker's day/month/year columns or a
 * Duration Picker need exactly this and nothing more. bits-ui's `Select` / `Listbox` / `Menu` were
 * evaluated and rejected: all of them close on selection, own their own value and model a single
 * list (research R-14). The document-ordered registry underneath is `DomOrderedCollection`, composed
 * rather than rewritten, and the RTL key mapping is `segmented-input`'s `resolveSegmentIntent`.
 *
 * Ordering is document order throughout: upstream's per-keystroke numeric sort is provably a no-op
 * for every column it generates, and document order is additionally correct for a caller who
 * composes `<TimePicker.Column>` with their own item set (research R-15).
 *
 * ```ts
 * const nav = new ColumnNavigation({ getDir: () => root.dir });
 * ```
 */
export class ColumnNavigation {
	// $derived below is lazy at runtime (evaluated only when the field is read), but svelte-check's
	// static analysis cannot see that and flags the field as used before its constructor assignment.
	#props!: ColumnNavigationProps;

	/** Every registered column, in document order. */
	readonly columns = new DomOrderedCollection<ColumnMeta>();

	/** How many columns are currently registered and attached. */
	readonly count: number = $derived(this.columns.size);

	constructor(props: ColumnNavigationProps) {
		this.#props = props;
	}

	/** Idempotent — re-registering the same id replaces the entry. */
	registerColumn(id: string, element: HTMLElement, meta: ColumnMeta): void {
		this.columns.register(id, element, meta);
	}

	/** No-op for an unknown id. */
	unregisterColumn(id: string): void {
		this.columns.unregister(id);
	}

	/** `-1` while the column is unregistered. */
	indexOfColumn(id: string): number {
		return this.columns.indexById.get(id) ?? -1;
	}

	/** Which registered column contains `element`, or `-1`. */
	columnIndexOf(element: Element | null): number {
		if (!element) return -1;
		return this.columns.ordered.findIndex((column) => column.element.contains(element));
	}

	/**
	 * Focus the column's selected item, falling back to its first focusable one — upstream's
	 * `focusFirst(selected ? [selected, ...items] : items)` (radix/ui/time-picker.tsx:1556-1563).
	 */
	focusPreferredIn(columnIndex: number): void {
		const column = this.columns.ordered[columnIndex];
		if (!column) return;

		const items = column.meta.getItems();
		if (items.length === 0) return;

		const selected = items.find((item) => item.meta.getSelected());
		const elements = items.map((item) => item.element);

		focusFirstOf(selected ? [selected.element, ...elements] : elements);
	}

	/**
	 * Previous/next item in the same column, **wrapping** at both ends. The target is focused *and*
	 * clicked: arrowing through a column selects as it moves, which is upstream behaviour rather than
	 * an accident (radix/ui/time-picker.tsx:1777-1779).
	 */
	moveWithinColumn(columnId: string, itemId: string, step: 1 | -1): void {
		const column = this.columns.ordered[this.indexOfColumn(columnId)];
		if (!column) return;

		const items = column.meta.getItems();
		const current = items.findIndex((item) => item.id === itemId);
		if (current === -1) return;

		const target = items[wrap(current, items.length, step)];
		if (!target) return;

		target.element.focus();
		target.element.click();
	}

	/** Previous/next column, **wrapping**, landing on that column's selected item else its first. */
	moveAcrossColumns(fromColumnId: string, step: 1 | -1): void {
		const current = this.indexOfColumn(fromColumnId);
		if (current === -1) return;

		const target = wrap(current, this.columns.ordered.length, step);
		if (target === -1) return;

		this.focusPreferredIn(target);
	}

	/**
	 * The column items' whole keyboard contract.
	 *
	 * `ArrowUp`/`ArrowDown` walk the column; `ArrowLeft`/`ArrowRight` walk the columns through
	 * `resolveSegmentIntent`, so they invert under `dir="rtl"` (research R-16); `Tab`/`Shift+Tab` walk
	 * the columns direction-independently, matching every other tab order. Only the keys it handles
	 * are `preventDefault()`ed, and a caller handler that already prevented the event vetoes all of
	 * it.
	 */
	onItemKeydown(event: KeyboardEvent, columnId: string, itemId: string): void {
		if (event.defaultPrevented) return;

		if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			event.preventDefault();
			this.moveWithinColumn(columnId, itemId, event.key === 'ArrowDown' ? 1 : -1);
			return;
		}

		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			const intent = resolveSegmentIntent(event.key, 'horizontal', this.#props.getDir());
			if (intent !== 'next' && intent !== 'previous') return;

			event.preventDefault();
			this.moveAcrossColumns(columnId, intent === 'next' ? 1 : -1);
			return;
		}

		if (event.key === 'Tab') {
			event.preventDefault();
			this.moveAcrossColumns(columnId, event.shiftKey ? -1 : 1);
		}
	}
}
