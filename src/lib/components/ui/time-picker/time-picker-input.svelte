<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import type { HTMLInputAttributes } from 'svelte/elements';

	import type { Segment } from './time-engine.js';

	/** The merged attribute payload handed to the `child` snippet. */
	export type TimePickerInputChildProps = {
		type: 'text';
		inputmode: 'numeric' | 'text';
		'data-slot': 'time-picker-input';
		'data-segment': Segment;
		'data-placeholder': '' | undefined;
		'data-disabled': '' | undefined;
		'data-readonly': '' | undefined;
		'data-invalid': '' | undefined;
		disabled: boolean;
		readonly: boolean;
		value: string;
		style: string;
		class: string;
		// The symbol slot carries the attachment that registers the segment with the picker's
		// navigation, so a `child`-rendered input still takes part in arrow movement.
	} & Record<string, unknown> &
		Record<symbol, Attachment<HTMLElement>>;

	export type TimePickerInputProps = WithElementRef<
		Omit<HTMLInputAttributes, 'type' | 'value'>,
		HTMLInputElement
	> & {
		/** Which segment this input edits. Required. */
		segment: Segment;
		/** Whether this segment is disabled. OR-ed with the picker's own `disabled`. */
		disabled?: boolean;
		/** Whether this segment is read-only. OR-ed with the picker's own `readOnly`. */
		readOnly?: boolean;
		/**
		 * Render the segment onto your own `<input>` instead of the default one. The snippet receives
		 * the merged props to spread onto that element.
		 *
		 * Replaces upstream's `asChild` — documented through `CompositionProps` upstream but never
		 * destructured there, so it currently leaks onto the DOM (research R-20, divergence D-08). In
		 * `child` mode `ref` stays `null`; the props carry the registration attachment instead.
		 */
		child?: Snippet<[{ props: TimePickerInputChildProps }]>;
	};
</script>

<script lang="ts">
	import { resolveSegmentIntent } from '$lib/components/ui/segmented-input/index.js';
	import { tick } from 'svelte';
	import { createAttachmentKey } from 'svelte/attachments';

	import { maxFirstDigit, type Period, stepSegment, togglePeriod } from './time-engine.js';
	import { getTimePickerContext, getTimePickerInputGroupContext } from './time-picker.svelte.js';

	let {
		ref = $bindable(null),
		segment,
		disabled,
		readOnly,
		style,
		'aria-label': ariaLabel,
		onblur,
		oninput,
		onclick,
		onfocus,
		onkeydown,
		class: className,
		child,
		...restProps
	}: TimePickerInputProps = $props();

	const root = getTimePickerContext('<TimePicker.Input>');
	// Read purely as the provider guard upstream's `useTimePickerInputGroupContext` performs: the
	// segment registry itself lives on the root, so one `SegmentNavigation` spans the whole picker.
	getTimePickerInputGroupContext('<TimePicker.Input>');

	const id = $props.id();

	const isDisabled = $derived(disabled === true || root.disabled);
	const isReadOnly = $derived(readOnly === true || root.readOnly);

	/**
	 * `null` means "no edit in progress, show the committed text" — one nullable rune in place of
	 * upstream's `editValue` + `isEditing` pair and the `useEffect` that re-synchronised them
	 * (research R-12, divergence D-06).
	 */
	let editValue = $state<string | null>(null);
	/** The first of a possible two-digit entry, waiting for its partner. */
	let pendingDigit = $state<string | null>(null);
	/** Set by `Escape` so the blur it causes discards the edit instead of committing it. */
	let discarding = false;

	const placeholder = $derived(root.segmentPlaceholder[segment]);
	const displayValue = $derived(editValue ?? root.segmentText(segment));
	const isPlaceholder = $derived(displayValue === placeholder);

	function pad(value: number): string {
		return value.toString().padStart(2, '0');
	}

	/** The text the segment is showing right now, edit in progress or not. */
	function currentText(): string {
		return editValue ?? root.segmentText(segment);
	}

	// An attachment rather than a `ref`-gated `$effect`, so registration travels with the spread
	// props: a segment the caller renders through `child` still joins the picker's navigation.
	const attach = createAttachmentKey();

	function registerSegment(element: Element) {
		if (!(element instanceof HTMLInputElement)) return;

		root.nav.register(id, element, {
			getDisabled: () => isDisabled,
			getReadOnly: () => isReadOnly,
			// Every segment is exactly two characters wide — `09`, `59`, `AM`.
			getMaxLength: () => 2,
			setValue: (next) => root.commitSegment(segment, next)
		});

		return () => root.nav.unregister(id);
	}

	/**
	 * Re-assert the rendered text on the DOM node and re-select it.
	 *
	 * Svelte only writes `value` back when the *derived* string changes, so an edit that lands on the
	 * text already displayed (typing `5` into a segment showing `05`) would otherwise leave the raw
	 * keystroke on screen. Writing it explicitly after the flush is also what makes the selection
	 * survive — assigning `value` resets it, so the order matters. This is upstream's
	 * `queueMicrotask(() => input.select())` with `tick()` in place of the microtask, because Svelte
	 * flushes DOM writes in its own microtask and a bare one can win the race (research R-13).
	 */
	async function settle(element: HTMLInputElement): Promise<void> {
		await tick();
		element.value = displayValue;
		element.setSelectionRange(0, element.value.length);
	}

	/** The next enabled segment in document order, skipping disabled ones. `false` at the end. */
	function focusNext(): boolean {
		const index = root.nav.indexOf(id);
		if (index < 0) return false;

		const target = root.nav.seek(index, 1);
		if (target < 0) return false;

		root.nav.focusAt(target, 'all');
		return true;
	}

	/** Commit, flush, then either advance to the next segment or stay put fully selected. */
	async function settleAndAdvance(element: HTMLInputElement): Promise<void> {
		await tick();
		element.value = displayValue;
		if (focusNext()) return;
		element.setSelectionRange(0, element.value.length);
	}

	/**
	 * Commit a finished numeric segment and hand the display back to the committed value.
	 *
	 * Releasing `editValue` is what makes the clamp visible (typing `25` into a 24-hour hour shows
	 * `23`) and what keeps an authoritative parent authoritative: a function binding that declines
	 * the write leaves the segment showing its old text rather than an optimistic one. Upstream holds
	 * the raw edit instead, because its `isEditing` flag has no other way to say "nothing pending".
	 */
	function commitAndRelease(text: string): void {
		editValue = null;
		pendingDigit = null;
		root.commitSegment(segment, text);
	}

	/** Pad a single typed digit before committing it, the way blur/`Tab`/`Enter` all do. */
	function commitPendingText(text: string): void {
		if (segment === 'period') {
			root.commitSegment(segment, text);
			return;
		}
		if (text.length === 1) {
			const parsed = Number.parseInt(text, 10);
			if (Number.isNaN(parsed)) return;
			root.commitSegment(segment, pad(parsed));
			return;
		}
		root.commitSegment(segment, text);
	}

	function handleFocus(event: FocusEvent & { currentTarget: HTMLInputElement }) {
		onfocus?.(event);
		if (event.defaultPrevented) return;

		pendingDigit = null;
		if (root.openOnFocus && !root.open) root.openViaFocus();

		const element = event.currentTarget;
		void tick().then(() => element.setSelectionRange(0, element.value.length));
	}

	async function handleBlur(event: FocusEvent & { currentTarget: HTMLInputElement }) {
		onblur?.(event);
		if (event.defaultPrevented) return;

		const text = currentText();
		const shouldCommit = !discarding && text.length > 0 && text !== placeholder;

		discarding = false;
		editValue = null;
		pendingDigit = null;

		if (!shouldCommit || isDisabled || isReadOnly) return;

		commitPendingText(text);

		// Upstream defers the backfill so it reads the value the commit just wrote
		// (radix/ui/time-picker.tsx:932-959); `tick()` is the Svelte equivalent (R-13). By then focus
		// has already landed on its new target, which is what makes the test below possible.
		await tick();

		// Only a blur that leaves the *field* backfills. Upstream backfills on every blur, including
		// the one auto-advance causes when it focuses the next segment — which fills the very segment
		// the caret just arrived in and then eats the digits typed into it, so `1430` lands as
		// `14:04`. Restricting it to a real exit is what the flag is documented to mean ("a segment
		// left at its placeholder is backfilled") and what makes typing a whole time work at all
		// (User Story 1, SC-001).
		const active = document.activeElement;
		if (active && root.inputGroupElement?.contains(active)) return;

		root.backfillFromNow();
	}

	async function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
		oninput?.(event);
		if (event.defaultPrevented) return;

		const element = event.currentTarget;

		if (isDisabled || isReadOnly) {
			await settle(element);
			return;
		}

		let next = element.value;
		// A keystroke that landed *beside* the placeholder rather than replacing it. Matched as a
		// plain prefix rather than upstream's `new RegExp('^' + placeholder)`, which would misread a
		// custom placeholder containing regex metacharacters.
		if (isPlaceholder && next.length > 0 && next !== placeholder && next.startsWith(placeholder)) {
			next = next.slice(placeholder.length);
		}

		if (segment === 'period') {
			const first = next.charAt(0).toUpperCase();
			const period: Period | null =
				first === 'A' || first === '1' ? 'AM' : first === 'P' || first === '2' ? 'PM' : null;

			if (period) {
				editValue = period;
				root.commitSegment('period', period);
			}
			await settle(element);
			return;
		}

		next = next.replace(/\D/g, '');
		if (next.length > 2) next = next.slice(0, 2);

		if (next.length === 0) {
			editValue = '';
			pendingDigit = null;
			await settle(element);
			return;
		}

		const parsed = Number.parseInt(next, 10);
		if (Number.isNaN(parsed)) {
			await settle(element);
			return;
		}

		// Second half of a two-digit entry that arrived as a fresh single character, because the
		// segment re-selected itself after the first one.
		if (pendingDigit !== null && next.length === 1) {
			const combined = Number.parseInt(`${pendingDigit}${next}`, 10);
			if (!Number.isNaN(combined)) {
				commitAndRelease(pad(combined));
				await settleAndAdvance(element);
				return;
			}
		}

		const padded = pad(parsed);

		if (next.length === 2) {
			commitAndRelease(padded);
			await settleAndAdvance(element);
			return;
		}

		// A first digit that cannot be followed by a second one — `9` in a 24-hour hour, `6` in a
		// minute — is complete on its own, so it commits and advances at once.
		if (Number.parseInt(next[0] ?? '0', 10) > maxFirstDigit(segment, root.is12Hour)) {
			commitAndRelease(padded);
			await settleAndAdvance(element);
			return;
		}

		editValue = padded;
		pendingDigit = next;
		await settle(element);
	}

	function handleClick(event: MouseEvent & { currentTarget: HTMLInputElement }) {
		onclick?.(event);
		if (event.defaultPrevented) return;

		event.currentTarget.select();
	}

	async function handleKeydown(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		onkeydown?.(event);
		if (event.defaultPrevented) return;

		const element = event.currentTarget;

		// Cross-segment movement is bounded, always swallows the key, and arrives fully selected —
		// a different policy from Segmented Input's caret-gated one, which is why only the registry,
		// the disabled-skipping `seek` and `focusAt` are reused rather than `onKeydown` (R-04). It
		// stays available while read-only: navigating is not mutating.
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			event.preventDefault();

			const intent = resolveSegmentIntent(event.key, 'horizontal', root.dir);
			if (intent !== 'next' && intent !== 'previous') return;

			const index = root.nav.indexOf(id);
			if (index < 0) return;

			const target = root.nav.seek(index, intent === 'next' ? 1 : -1);
			if (target < 0) return;

			root.nav.focusAt(target, 'all');
			return;
		}

		if (isDisabled || isReadOnly) return;

		if (event.key === 'Backspace' || event.key === 'Delete') {
			if (element.selectionStart !== 0 || element.selectionEnd !== element.value.length) return;

			event.preventDefault();
			editValue = null;
			pendingDigit = null;
			root.clearSegment(segment);
			await settle(element);
			return;
		}

		if (segment === 'period') {
			const key = event.key.toLowerCase();

			if (key === 'a' || key === 'p' || key === '1' || key === '2') {
				event.preventDefault();
				const period: Period = key === 'a' || key === '1' ? 'AM' : 'PM';
				editValue = period;
				root.commitSegment('period', period);
				await settle(element);
				return;
			}

			if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
				event.preventDefault();
				const text = currentText();
				const current: Period | null = text === 'AM' || text === 'PM' ? text : null;
				const period = togglePeriod(current);
				editValue = period;
				root.commitSegment('period', period);
				await settle(element);
			}
			return;
		}

		if (event.key === 'Tab') {
			// Native tab order is left alone; only the in-progress edit is flushed first.
			const text = currentText();
			if (text.length > 0 && text !== placeholder) commitPendingText(text);
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			const text = currentText();
			if (text.length > 0 && text !== placeholder) commitPendingText(text);
			editValue = null;
			pendingDigit = null;
			await settle(element);
			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			// `discarding` makes the blur below skip its commit, which is what "discard" has to mean:
			// upstream's own Escape path reads a stale `editValue` in the blur handler and commits the
			// edit it claims to cancel (contracts/component-api.md §12, divergence D-16).
			discarding = true;
			editValue = null;
			pendingDigit = null;
			element.blur();
			return;
		}

		if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			event.preventDefault();

			const delta = event.key === 'ArrowUp' ? 1 : -1;
			const text = currentText();
			const current = text === placeholder || text === '' ? null : Number.parseInt(text, 10);
			if (current !== null && Number.isNaN(current)) return;

			const stepped = stepSegment(segment, current, delta, root.is12Hour);
			commitAndRelease(pad(stepped));
			await settle(element);
		}
	}

	const inputAttrs = $derived({
		type: 'text',
		inputmode: segment === 'period' ? 'text' : 'numeric',
		autocomplete: 'off',
		autocorrect: 'off',
		autocapitalize: 'off',
		spellcheck: false,
		translate: 'no',
		// Upstream ships four unlabelled inputs; a default name is the smallest fix. It is destructured
		// rather than merged from `...restProps` so that a caller passing a *possibly* undefined label
		// (`aria-label={maybeLabel}`) falls back to the default instead of erasing it (R-18, D-11).
		'aria-label': ariaLabel ?? segment,
		'data-slot': 'time-picker-input',
		'data-segment': segment,
		'data-placeholder': isPlaceholder ? '' : undefined,
		'data-disabled': isDisabled ? '' : undefined,
		'data-readonly': isReadOnly ? '' : undefined,
		'data-invalid': root.invalid ? '' : undefined,
		...restProps,
		disabled: isDisabled,
		readonly: isReadOnly,
		value: displayValue,
		style: `width: var(--time-picker-${segment}-input-width)${style ? `; ${style}` : ''}`,
		onblur: handleBlur,
		oninput: handleInput,
		onclick: handleClick,
		onfocus: handleFocus,
		onkeydown: handleKeydown,
		[attach]: registerSegment,
		class: cn(
			'inline-flex h-full items-center justify-center border-0 bg-transparent text-center text-sm tabular-nums transition-colors outline-none focus:bg-transparent disabled:cursor-not-allowed disabled:opacity-50',
			className
		)
	} as TimePickerInputChildProps);
</script>

{#if child}
	{@render child({ props: inputAttrs })}
{:else}
	<input bind:this={ref} {...inputAttrs} />
{/if}
