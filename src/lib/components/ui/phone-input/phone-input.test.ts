import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
	COUNTRY_DATA,
	type Country,
	DEFAULT_PHONE_PLACEHOLDER,
	detectCountryFromNumber,
	formatPhoneNumber,
	getCountries,
	getCountryName,
	getFlagEmoji,
	normalizePhoneInput
} from './index.js';
import Harness, { type PhoneInputHarnessProps } from './phone-input.test.svelte';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** The four-entry list of `phone-input-custom-countries-demo.tsx`, so renders stay cheap. */
const TEST_COUNTRIES: Country[] = [
	{ code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸' },
	{ code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦' },
	{ code: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽' },
	{ code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷' }
];

function renderPhone(props: PhoneInputHarnessProps = {}) {
	return render(Harness, { props: { countries: TEST_COUNTRIES, ...props } });
}

function root(): HTMLElement {
	return screen.getByTestId('root');
}

/** The rendered field, narrowed so `value` and `placeholder` are reachable. */
function field(): HTMLInputElement {
	const element = screen.getByTestId('field');
	if (!(element instanceof HTMLInputElement)) {
		throw new Error('the phone field did not render an <input>');
	}
	return element;
}

/** The country trigger. It takes no `restProps` (upstream forwards them to `Popover`), so it is
 * located through the `data-slot` every consumer styles it with. */
function trigger(): HTMLButtonElement {
	const element = document.querySelector('[data-slot="phone-input-country-select"]');
	if (!(element instanceof HTMLButtonElement)) {
		throw new Error('the country select did not render a <button>');
	}
	return element;
}

/**
 * jsdom has no layout engine, so every rect is zero and floating-ui's `hide` middleware marks the
 * popover wrapper `visibility: hidden`. Role queries inside the dropdown therefore have to opt into
 * hidden elements; in a browser the list sits in the accessibility tree as normal.
 */
const inPopover = { hidden: true } as const;

function options(): HTMLElement[] {
	return screen.getAllByRole('option', inPopover);
}

/**
 * One country row. Accessible-name matching is unavailable for the same reason as `inPopover` —
 * a hidden subtree contributes no text alternative — so rows are matched on their content.
 */
function option(name: string): HTMLElement {
	const match = options().find((element) => (element.textContent ?? '').includes(name));
	if (!match) throw new Error(`no country option matching ${name}`);
	return match;
}

/**
 * Put the caret in the search box of an open dropdown.
 *
 * Same jsdom limitation as `inPopover`: with everything reported as `visibility: hidden`, bits-ui's
 * focus scope finds no tabbable child and falls back to focusing the content container one frame
 * after opening. Wait for that, then focus the search box the way a browser would have done.
 */
async function focusSearch(): Promise<HTMLElement> {
	const search = await screen.findByPlaceholderText('Search country...');
	await waitFor(() => expect(search.closest('[data-popover-content]')).toHaveFocus());
	search.focus();
	return search;
}

/** Open the dropdown from the trigger and put the caret in the search box. */
async function openList(user: ReturnType<typeof userEvent.setup>): Promise<void> {
	await user.click(trigger());
	await focusSearch();
}

/**
 * `preventDefault()` is only observable on a cancelable event, and neither jsdom nor a browser
 * makes `input` cancelable — so the caller-cancels-the-edit path is driven with an event that is.
 * Everything else in this file goes through `userEvent`.
 */
async function cancelableInput(element: HTMLInputElement, value: string): Promise<void> {
	element.value = value;
	await fireEvent(element, new InputEvent('input', { bubbles: true, cancelable: true }));
}

// ---------------------------------------------------------------------------
// T004 — the engine, with no rendering at all (contracts/phone-engine.md)
// ---------------------------------------------------------------------------

describe('phone engine — getCountries (T004)', () => {
	it('derives one entry per row of the upstream table', () => {
		expect(COUNTRY_DATA).toHaveLength(239);
		expect(getCountries()).toHaveLength(COUNTRY_DATA.length);
	});

	it('gives every entry a unique upper-case code and a `+`-prefixed dial code', () => {
		const countries = getCountries();
		const codes = countries.map((country) => country.code);

		expect(new Set(codes).size).toBe(codes.length);
		for (const country of countries) {
			expect(country.code, country.code).toBe(country.code.toUpperCase());
			expect(country.dialCode.startsWith('+'), country.code).toBe(true);
			expect(typeof country.flag, country.code).toBe('string');
		}
	});

	it('sorts by display name', () => {
		const names = getCountries().map((country) => country.name);
		expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
	});

	it('memoises the list, and no other function mutates it', () => {
		const first = getCountries();
		expect(getCountries()).toBe(first);

		const snapshot = [...first];
		detectCountryFromNumber('+14085551234', first);
		formatPhoneNumber('+14085551234', first);

		expect(getCountries()).toBe(first);
		expect(first).toEqual(snapshot);
	});

	it('exposes the documented placeholder', () => {
		expect(DEFAULT_PHONE_PLACEHOLDER).toBe('Enter phone number');
	});
});

describe('phone engine — names and flags (T004)', () => {
	it('resolves a region name through Intl.DisplayNames', () => {
		const english = new Intl.DisplayNames(['en'], { type: 'region' });
		expect(getCountryName('US')).toBe(english.of('US'));
		expect(getCountryName('FR')).toBe(english.of('FR'));
	});

	it('honours the locale argument', () => {
		const french = new Intl.DisplayNames(['fr'], { type: 'region' });
		expect(getCountryName('US', 'fr')).toBe(french.of('US'));
	});

	it('falls back to the code when the lookup throws or finds nothing', () => {
		expect(getCountryName('')).toBe('');
		expect(getCountryName('U')).toBe('U');
	});

	it('maps a code to its regional-indicator pair', () => {
		expect(getFlagEmoji('US')).toBe('\u{1F1FA}\u{1F1F8}');
		expect(getFlagEmoji('fr')).toBe('\u{1F1EB}\u{1F1F7}');
	});
});

describe('phone engine — formatPhoneNumber (T004)', () => {
	const countries = getCountries();

	it.each([
		['', ''],
		['+', '+'],
		['abc', '+'],
		['+1', '+1'],
		['+14085551234', '+1 408 555 123 4'],
		['14085551234', '+1 408 555 123 4'],
		['+442071234567', '+44 207 123 456 7'],
		['+123', '+1 23'],
		['+12', '+1 2'],
		['+999', '+999'],
		['+99', '+99']
	])('formats %j as %j', (value, expected) => {
		expect(formatPhoneNumber(value, countries)).toBe(expected);
	});
});

describe('phone engine — detectCountryFromNumber (T004)', () => {
	const countries = getCountries();

	it('ignores a value with no leading `+`', () => {
		expect(detectCountryFromNumber('14085551234', countries)).toBeUndefined();
	});

	it('ignores a value with no digits after the `+`', () => {
		expect(detectCountryFromNumber('+', countries)).toBeUndefined();
		expect(detectCountryFromNumber('+abc', countries)).toBeUndefined();
	});

	it('returns undefined when no dial code matches', () => {
		expect(detectCountryFromNumber('+99900000', countries)).toBeUndefined();
	});

	it('returns the only match', () => {
		expect(detectCountryFromNumber('+33612345678', countries)?.code).toBe('FR');
	});

	it('prefers US when the best match is +1', () => {
		expect(detectCountryFromNumber('+14085551234', countries)?.code).toBe('US');
		expect(detectCountryFromNumber('+12', countries)?.code).toBe('US');
	});

	it('prefers the longest dial code over the +1 tie-break', () => {
		expect(detectCountryFromNumber('+12421234567', countries)?.code).toBe('BS');
	});

	it('resolves a shared non-+1 dial code to the first entry in display-name order', () => {
		// `gg`, `im`, `je` and `gb` all dial `+44`; the US tie-break is hard-coded to `+1`, so the
		// stable sort leaves Guernsey — first alphabetically — at the head of the matches.
		expect(detectCountryFromNumber('+442071234567', countries)?.code).toBe('GG');
	});

	it('never mutates the list it was given', () => {
		const input = [...countries];
		detectCountryFromNumber('+442071234567', input);
		expect(input).toEqual(countries);
	});
});

describe('phone engine — normalizePhoneInput (T004)', () => {
	it.each([
		['', '', false],
		['+', '+', true],
		['abc', '', false],
		['(408) 555-1234', '+4085551234', false],
		['+1 408', '+1408', true]
	])('normalises %j to %j', (raw, value, startsWithPlus) => {
		expect(normalizePhoneInput(raw)).toEqual({ value, startsWithPlus });
	});

	it('never produces a value that formatPhoneNumber cannot handle', () => {
		const countries = getCountries();
		const adversarial = ['', '+', 'abc', '+++123', '🙂🇺🇸', '+'.repeat(50), '9'.repeat(60)];

		for (const raw of adversarial) {
			expect(() => formatPhoneNumber(normalizePhoneInput(raw).value, countries), raw).not.toThrow();
		}
	});
});

// ---------------------------------------------------------------------------
// T005 — roles, ARIA and the accessible attribute surface
// ---------------------------------------------------------------------------

describe('PhoneInput roles and ARIA (T005)', () => {
	it('renders the root as a group with its slot marker', () => {
		renderPhone();
		expect(root()).toHaveAttribute('role', 'group');
		expect(root()).toHaveAttribute('data-slot', 'phone-input');
	});

	it('generates an id when none is supplied, and honours a caller id', () => {
		const { unmount } = renderPhone();
		expect(root().id).not.toBe('');

		unmount();
		renderPhone({ id: 'my-phone' });
		expect(root()).toHaveAttribute('id', 'my-phone');
	});

	it('lets restProps override the defaults the component emits first', () => {
		renderPhone({ rootProps: { role: 'presentation', 'data-slot': 'custom' } });
		expect(root()).toHaveAttribute('role', 'presentation');
		expect(root()).toHaveAttribute('data-slot', 'custom');
	});

	it("gives the root's placeholder precedence over the field's own", () => {
		const { unmount } = renderPhone({ placeholder: 'Root ph', fieldPlaceholder: 'Field ph' });
		expect(field()).toHaveAttribute('placeholder', 'Root ph');

		unmount();
		renderPhone({ fieldPlaceholder: 'Field ph' });
		expect(field()).toHaveAttribute('placeholder', DEFAULT_PHONE_PLACEHOLDER);
	});

	it('renders the caller element with the root props when a child snippet is given', () => {
		renderPhone({ mode: 'child', disabled: true, invalid: true, readOnly: true });

		const element = root();
		expect(element.tagName).toBe('SECTION');
		expect(element).toHaveAttribute('role', 'group');
		expect(element).toHaveAttribute('data-slot', 'phone-input');
		expect(element).toHaveAttribute('data-disabled', '');
		expect(element).toHaveAttribute('data-invalid', '');
		expect(element).toHaveAttribute('data-readonly', '');
	});

	it('renders the field as a telephone input carrying the root state', () => {
		renderPhone({ required: true, invalid: true });

		expect(field()).toHaveAttribute('type', 'tel');
		expect(field()).toHaveAttribute('inputmode', 'tel');
		expect(field()).toHaveAttribute('data-slot', 'phone-input-field');
		expect(field()).toHaveAttribute('aria-required', 'true');
		expect(field()).toHaveAttribute('aria-invalid', 'true');
	});

	it('associates a consumer label with the field', () => {
		renderPhone({ label: 'Phone number' });
		expect(screen.getByLabelText('Phone number')).toBe(field());
	});

	it('renders the country select as a button whose aria-expanded tracks the popover', async () => {
		const user = userEvent.setup();
		renderPhone();

		expect(trigger()).toHaveAttribute('data-slot', 'phone-input-country-select');
		expect(trigger()).toHaveAttribute('aria-expanded', 'false');

		await openList(user);
		expect(trigger()).toHaveAttribute('aria-expanded', 'true');
	});

	it('exposes a searchable listbox of options once open', async () => {
		const user = userEvent.setup();
		renderPhone();

		await openList(user);

		expect(screen.getByRole('listbox', inPopover)).toBeInTheDocument();
		expect(screen.getByRole('combobox', inPopover)).toHaveAttribute(
			'placeholder',
			'Search country...'
		);
		expect(options()).toHaveLength(TEST_COUNTRIES.length);
	});
});

// ---------------------------------------------------------------------------
// T006 — uncontrolled formatting as you type
// ---------------------------------------------------------------------------

describe('PhoneInput uncontrolled formatting (T006)', () => {
	it('seeds the display from defaultValue and defaultCountry', () => {
		renderPhone({ defaultValue: '+14085551234', defaultCountry: 'US' });

		expect(field()).toHaveValue('+1 408 555 123 4');
		expect(trigger()).toHaveTextContent('🇺🇸');
	});

	it('formats digits as they are typed and reports the canonical value', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderPhone({ onValueChange, withCountrySelect: false });

		await user.type(field(), '14085551234');

		expect(field()).toHaveValue('+1 408 555 123 4');
		expect(onValueChange).toHaveBeenLastCalledWith('+14085551234');
	});

	it('strips punctuation out of pasted text', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderPhone({ onValueChange, withCountrySelect: false });

		await user.click(field());
		await user.paste('+1 (408) 555-1234');

		expect(field()).toHaveValue('+1 408 555 123 4');
		expect(onValueChange).toHaveBeenLastCalledWith('+14085551234');
	});

	it('re-formats from the remaining digits after a deletion', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderPhone({ defaultValue: '+14085551234', onValueChange, withCountrySelect: false });

		await user.click(field());
		await user.keyboard('{Backspace}{Backspace}');

		expect(field()).toHaveValue('+1 408 555 12');
		expect(onValueChange).toHaveBeenLastCalledWith('+140855512');
	});

	it('re-formats from the remaining digits after a forward deletion (T028)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderPhone({ defaultValue: '+14085551234', onValueChange, withCountrySelect: false });

		const element = field();
		await user.click(element);
		// `Delete` only removes anything when there is something ahead of the caret, so start at the
		// digit after the dial code rather than at the end where `{Backspace}` was exercised.
		element.setSelectionRange(3, 3);
		await user.keyboard('{Delete}');

		// The `4` behind the caret is gone and the whole string is rebuilt from what is left, rather
		// than the separators being shuffled along.
		expect(field()).toHaveValue('+1 085 551 234');
		expect(onValueChange).toHaveBeenLastCalledWith('+1085551234');
	});

	it('never lets a letter reach the display, and snaps the DOM value back', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderPhone({ defaultValue: '+1408', onValueChange, withCountrySelect: false });

		await user.click(field());
		await user.keyboard('a');

		expect(field()).toHaveValue('+1 408');
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('lets a caller oninput cancel the edit with preventDefault', async () => {
		const onValueChange = vi.fn();
		const fieldOninput = vi.fn((event: Event) => event.preventDefault());
		renderPhone({
			defaultValue: '+1408',
			onValueChange,
			fieldOninput,
			withCountrySelect: false
		});

		await cancelableInput(field(), '+1 4085');

		expect(fieldOninput).toHaveBeenCalledTimes(1);
		expect(onValueChange).not.toHaveBeenCalled();
		expect(field()).toHaveValue('+1 408');
	});

	it('runs a caller oninput before the internal handler and keeps the edit when it does not cancel', async () => {
		const seen: string[] = [];
		const onValueChange = vi.fn(() => seen.push('internal'));
		const fieldOninput = vi.fn(() => seen.push('caller'));
		renderPhone({ defaultValue: '+1408', onValueChange, fieldOninput, withCountrySelect: false });

		await cancelableInput(field(), '+1 4085');

		expect(seen).toEqual(['caller', 'internal']);
		expect(onValueChange).toHaveBeenLastCalledWith('+14085');
	});
});

// ---------------------------------------------------------------------------
// T007 — controlled value and country
// ---------------------------------------------------------------------------

describe('PhoneInput controlled mode (T007)', () => {
	it('moves the parent binding and reports the canonical value', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onValueBinding = vi.fn();
		renderPhone({
			mode: 'controlled',
			value: '+1408',
			onValueChange,
			onValueBinding,
			withCountrySelect: false
		});

		await user.click(field());
		await user.keyboard('5');

		expect(field()).toHaveValue('+1 408 5');
		expect(onValueChange).toHaveBeenLastCalledWith('+14085');
		expect(onValueBinding).toHaveBeenLastCalledWith('+14085');
	});

	it('leaves the display where it was when an authoritative parent declines the write', async () => {
		const user = userEvent.setup();
		const onDeclinedValue = vi.fn();
		renderPhone({
			mode: 'function-binding',
			authoritative: '+1408',
			onDeclinedValue,
			withCountrySelect: false
		});

		expect(field()).toHaveValue('+1 408');

		await user.click(field());
		await user.keyboard('5');

		expect(onDeclinedValue).toHaveBeenLastCalledWith('+14085');
		expect(field()).toHaveValue('+1 408');
	});

	it('moves a bound country when one is selected', async () => {
		const user = userEvent.setup();
		const onCountryChange = vi.fn();
		const onCountryBinding = vi.fn();
		renderPhone({ mode: 'controlled', country: '', onCountryChange, onCountryBinding });

		await openList(user);
		await user.click(option('Mexico'));

		await waitFor(() => expect(onCountryChange).toHaveBeenLastCalledWith('MX'));
		expect(onCountryBinding).toHaveBeenLastCalledWith('MX');
	});

	it('leaves the selection where it was when an authoritative parent declines it', async () => {
		const user = userEvent.setup();
		const onDeclinedCountry = vi.fn();
		renderPhone({
			mode: 'function-binding',
			authoritativeCountry: 'US',
			onDeclinedCountry
		});

		await openList(user);
		await user.click(option('Mexico'));

		await waitFor(() => expect(onDeclinedCountry).toHaveBeenLastCalledWith('MX'));
		expect(trigger()).toHaveTextContent('🇺🇸');
	});

	it('seeds an empty field with the dial code of a selected country', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderPhone({ onValueChange });

		await openList(user);
		await user.click(option('Mexico'));

		await waitFor(() => expect(trigger()).toHaveTextContent('🇲🇽'));
		expect(field()).toHaveValue('+52');
		expect(onValueChange).toHaveBeenLastCalledWith('+52');
	});

	it('replaces a value holding only the old dial code, and the selection sticks', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onCountryChange = vi.fn();
		renderPhone({ onValueChange, onCountryChange });

		await user.type(field(), '+55');
		await waitFor(() => expect(trigger()).toHaveTextContent('🇧🇷'));

		await openList(user);
		await user.click(option('Mexico'));

		// Before the replacement existed, the detection effect saw the stale `+55` and snapped the
		// country straight back to Brazil — the selection could never be kept.
		await waitFor(() => expect(trigger()).toHaveTextContent('🇲🇽'));
		expect(field()).toHaveValue('+52');
		expect(onValueChange).toHaveBeenLastCalledWith('+52');
		expect(onCountryChange).toHaveBeenLastCalledWith('MX');
	});

	it('clears a full number under a different dial code, and the selection sticks', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderPhone({ defaultValue: '+14085551234', onValueChange });

		await waitFor(() => expect(trigger()).toHaveTextContent('🇺🇸'));

		await openList(user);
		await user.click(option('Brazil'));

		// The stale US number would otherwise pull detection straight back to US — the whole value
		// is replaced by the selected country's dial code so the manual selection always sticks.
		await waitFor(() => expect(trigger()).toHaveTextContent('🇧🇷'));
		expect(field()).toHaveValue('+55');
		expect(onValueChange).toHaveBeenLastCalledWith('+55');
	});

	it('keeps a number already under the selected dial code', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderPhone({ defaultValue: '+14085551234', onValueChange });

		await waitFor(() => expect(trigger()).toHaveTextContent('🇺🇸'));

		await openList(user);
		await user.click(option('Canada'));

		// US → Canada shares +1: the number survives, and the detection effect then snaps the
		// detectable value's own country back (research R-05, pinned in T009).
		await waitFor(() => expect(trigger()).toHaveTextContent('🇺🇸'));
		expect(field()).toHaveValue('+1 408 555 123 4');
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('never prefills when an authoritative parent declines the selection', async () => {
		const user = userEvent.setup();
		const onDeclinedCountry = vi.fn();
		const onValueChange = vi.fn();
		renderPhone({
			mode: 'function-binding',
			authoritativeCountry: 'US',
			onDeclinedCountry,
			onValueChange
		});

		await openList(user);
		await user.click(option('Mexico'));

		await waitFor(() => expect(onDeclinedCountry).toHaveBeenLastCalledWith('MX'));
		expect(trigger()).toHaveTextContent('🇺🇸');
		expect(field()).toHaveValue('');
		expect(onValueChange).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// T008 — the country dropdown: keyboard, search and focus
// ---------------------------------------------------------------------------

describe('PhoneInput country dropdown (T008)', () => {
	it.each(['{Enter}', ' '])('opens with %s from the trigger', async (key) => {
		const user = userEvent.setup();
		renderPhone();

		trigger().focus();
		await user.keyboard(key);

		await waitFor(() => expect(screen.getByRole('listbox', inPopover)).toBeInTheDocument());
	});

	it('filters by name, dial code and ISO code', async () => {
		const user = userEvent.setup();
		renderPhone();

		await openList(user);

		await user.keyboard('Mex');
		await waitFor(() => expect(options()).toHaveLength(1));
		expect(options()[0]).toHaveTextContent('Mexico');

		// The dial code and the ISO code are searchable too. `Command`'s fuzzy scoring keeps a weaker
		// match in the list, so what is pinned here is that the intended country wins the ranking and
		// that the list is narrower than the full set.
		await user.clear(screen.getByRole('combobox', inPopover));
		await user.keyboard('55');
		await waitFor(() => expect(options()[0]).toHaveTextContent('Brazil'));
		expect(options().length).toBeLessThan(TEST_COUNTRIES.length);

		await user.clear(screen.getByRole('combobox', inPopover));
		await user.keyboard('CA');
		await waitFor(() => expect(options()[0]).toHaveTextContent('Canada'));
		expect(options().length).toBeLessThan(TEST_COUNTRIES.length);
	});

	it('shows the empty state when nothing matches', async () => {
		const user = userEvent.setup();
		renderPhone();

		await openList(user);
		await user.keyboard('zzzz');

		await waitFor(() => expect(screen.getByText('No country found.')).toBeInTheDocument());
		expect(screen.queryAllByRole('option', inPopover)).toHaveLength(0);
	});

	it('moves the highlight with the arrow keys and jumps with Home and End', async () => {
		const user = userEvent.setup();
		renderPhone();

		await openList(user);
		await waitFor(() => expect(options()[0]).toHaveAttribute('aria-selected', 'true'));

		await user.keyboard('{ArrowDown}');
		expect(options()[1]).toHaveAttribute('aria-selected', 'true');

		await user.keyboard('{ArrowUp}');
		expect(options()[0]).toHaveAttribute('aria-selected', 'true');

		await user.keyboard('{End}');
		expect(options()[options().length - 1]).toHaveAttribute('aria-selected', 'true');

		await user.keyboard('{Home}');
		expect(options()[0]).toHaveAttribute('aria-selected', 'true');
	});

	it('selects the highlighted country with Enter, closes and focuses the field', async () => {
		const user = userEvent.setup();
		const onCountryChange = vi.fn();
		renderPhone({ onCountryChange });

		await openList(user);
		await user.keyboard('Mex');
		await waitFor(() => expect(options()).toHaveLength(1));

		await user.keyboard('{Enter}');

		await waitFor(() => expect(screen.queryByRole('listbox', inPopover)).not.toBeInTheDocument());
		expect(onCountryChange).toHaveBeenLastCalledWith('MX');
		await waitFor(() => expect(field()).toHaveFocus());
	});

	it('closes on Escape with the selection unchanged and focus back on the trigger', async () => {
		const user = userEvent.setup();
		const onCountryChange = vi.fn();
		renderPhone({ defaultCountry: 'US', onCountryChange });

		await openList(user);
		await user.keyboard('{Escape}');

		await waitFor(() => expect(screen.queryByRole('listbox', inPopover)).not.toBeInTheDocument());
		expect(onCountryChange).not.toHaveBeenCalled();
		await waitFor(() => expect(trigger()).toHaveFocus());
	});

	it('marks the selected country when the list is reopened', async () => {
		const user = userEvent.setup();
		renderPhone({ defaultCountry: 'BR' });

		await openList(user);

		const brazil = option('Brazil');
		expect(brazil).toHaveAttribute('data-checked', 'true');
		expect(option('Canada')).not.toHaveAttribute('data-checked');
	});

	it('puts the trigger before the field in the tab order', async () => {
		const user = userEvent.setup();
		renderPhone();

		await user.tab();
		expect(trigger()).toHaveFocus();

		await user.tab();
		expect(field()).toHaveFocus();
	});

	it('walks back from the field to the trigger with Shift+Tab (T028)', async () => {
		const user = userEvent.setup();
		renderPhone();

		field().focus();
		await user.tab({ shift: true });

		expect(trigger()).toHaveFocus();
	});

	it('opens and closes through a bound open prop and reports both handlers', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		const onOpenBinding = vi.fn();
		renderPhone({ mode: 'controlled', open: true, onOpenChange, onOpenBinding });

		await waitFor(() => expect(screen.getByRole('listbox', inPopover)).toBeInTheDocument());

		await user.keyboard('{Escape}');

		await waitFor(() => expect(screen.queryByRole('listbox', inPopover)).not.toBeInTheDocument());
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
		expect(onOpenBinding).toHaveBeenLastCalledWith(false);
	});

	it('lets a caller-supplied open win over the internal state', async () => {
		renderPhone({ open: true });
		await waitFor(() => expect(screen.getByRole('listbox', inPopover)).toBeInTheDocument());
	});
});

// ---------------------------------------------------------------------------
// T009 — automatic country detection through the rendered field
// ---------------------------------------------------------------------------

describe('PhoneInput country detection (T009)', () => {
	it('selects the country of a typed international prefix', async () => {
		const user = userEvent.setup();
		const onCountryChange = vi.fn();
		renderPhone({ countries: undefined, onCountryChange, withCountrySelect: false });

		await user.type(field(), '+33612345678');

		expect(onCountryChange).toHaveBeenLastCalledWith('FR');
	});

	it('resolves a shared +44 dial code to the first entry in display-name order', async () => {
		const user = userEvent.setup();
		const onCountryChange = vi.fn();
		renderPhone({ countries: undefined, onCountryChange, withCountrySelect: false });

		await user.type(field(), '+442071234567');

		expect(onCountryChange).toHaveBeenLastCalledWith('GG');
	});

	it('prefers US over the other +1 countries', async () => {
		const user = userEvent.setup();
		const onCountryChange = vi.fn();
		renderPhone({ countries: undefined, onCountryChange, withCountrySelect: false });

		await user.type(field(), '+14085551234');

		expect(onCountryChange).toHaveBeenLastCalledWith('US');
	});

	it('detects a bare number once it is long enough', async () => {
		const user = userEvent.setup();
		const onCountryChange = vi.fn();
		renderPhone({ countries: undefined, onCountryChange, withCountrySelect: false });

		await user.type(field(), '14085551234');

		expect(onCountryChange).toHaveBeenLastCalledWith('US');
	});

	it('leaves the selection alone while the prefix matches nothing', async () => {
		const user = userEvent.setup();
		const onCountryChange = vi.fn();
		renderPhone({
			countries: undefined,
			defaultCountry: 'BR',
			onCountryChange,
			withCountrySelect: false
		});

		await user.type(field(), '+999');

		expect(onCountryChange).not.toHaveBeenCalled();
	});

	it('never detects from an empty value', async () => {
		const user = userEvent.setup();
		const onCountryChange = vi.fn();
		renderPhone({
			countries: undefined,
			defaultValue: '+33',
			defaultCountry: 'FR',
			onCountryChange,
			withCountrySelect: false
		});

		await user.click(field());
		await user.clear(field());

		expect(field()).toHaveValue('');
		expect(onCountryChange).not.toHaveBeenCalled();
	});

	it('never detects from a caller value that carries no leading plus', () => {
		const onCountryChange = vi.fn();
		renderPhone({
			countries: undefined,
			defaultValue: '4085551234',
			onCountryChange,
			withCountrySelect: false
		});

		// Upstream counts `value.slice(1)`, so a caller-supplied bare number is both one digit short
		// of the ten-digit threshold and rejected by `detectCountryFromNumber`'s `+` guard.
		expect(onCountryChange).not.toHaveBeenCalled();
	});

	it('keeps a manual selection while the value cannot be detected', async () => {
		const user = userEvent.setup();
		const onCountryChange = vi.fn();
		renderPhone({ onCountryChange });

		await openList(user);
		await user.click(option('Canada'));

		await waitFor(() => expect(trigger()).toHaveTextContent('🇨🇦'));
		expect(onCountryChange).toHaveBeenCalledTimes(1);
	});

	it('overrides a manual selection once the value is independently detectable', async () => {
		const user = userEvent.setup();
		const onCountryChange = vi.fn();
		renderPhone({ defaultValue: '+14085551234', onCountryChange });

		await waitFor(() => expect(onCountryChange).toHaveBeenLastCalledWith('US'));

		await openList(user);
		await user.click(option('Canada'));

		await waitFor(() => expect(onCountryChange).toHaveBeenLastCalledWith('US'));
		expect(trigger()).toHaveTextContent('🇺🇸');
	});
});

// ---------------------------------------------------------------------------
// T010 — guard rails and the remaining edge cases
// ---------------------------------------------------------------------------

describe('PhoneInput guard rails (T010)', () => {
	it('suppresses every interaction while disabled', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderPhone({ disabled: true, onValueChange });

		expect(root()).toHaveAttribute('data-disabled', '');
		expect(field()).toBeDisabled();
		expect(trigger()).toBeDisabled();

		await user.type(field(), '1408');
		expect(onValueChange).not.toHaveBeenCalled();

		await user.click(trigger());
		expect(screen.queryByRole('listbox', inPopover)).not.toBeInTheDocument();
	});

	it('keeps a read-only field focusable but never editable, and leaves the country selectable', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onCountryChange = vi.fn();
		renderPhone({ readOnly: true, defaultValue: '+1408', onValueChange, onCountryChange });

		expect(root()).toHaveAttribute('data-readonly', '');
		expect(field()).toHaveAttribute('readonly');

		await user.click(field());
		expect(field()).toHaveFocus();
		await user.keyboard('5');
		expect(onValueChange).not.toHaveBeenCalled();
		expect(field()).toHaveValue('+1 408');

		await openList(user);
		await user.click(option('Mexico'));
		// Not `toHaveBeenLastCalledWith`: `+1408` is detectable, so upstream's effect re-runs and snaps
		// the country back to US afterwards (research R-05 quirk 2, pinned in T009).
		await waitFor(() => expect(onCountryChange).toHaveBeenCalledWith('MX'));
	});

	it('never prefills a read-only field, while the country stays selectable', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onCountryChange = vi.fn();
		renderPhone({ readOnly: true, onValueChange, onCountryChange });

		await openList(user);
		await user.click(option('Mexico'));

		await waitFor(() => expect(onCountryChange).toHaveBeenLastCalledWith('MX'));
		expect(field()).toHaveValue('');
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('hides every flag when showFlag is false', async () => {
		const user = userEvent.setup();
		renderPhone({ showFlag: false, defaultCountry: 'US' });

		expect(trigger()).not.toHaveTextContent('🇺🇸');

		await openList(user);
		for (const option of options()) {
			expect(option.textContent ?? '').not.toMatch(/\p{Regional_Indicator}/u);
		}
	});

	it('shows the placeholder swatch when the list does not contain the selected country', () => {
		renderPhone({ defaultCountry: 'FR', defaultValue: '+33612345678' });

		expect(trigger()).not.toHaveTextContent('🇫🇷');
		expect(trigger().querySelector('[data-slot="phone-input-country-swatch"]')).toBeInTheDocument();
		// Formatting reads the caller's list too, so with no `+33` entry the display falls back to the
		// three-digit dial-code guess rather than France's two-digit one.
		expect(field()).toHaveValue('+336 123 456 78');
	});

	it('reflects invalid on both the root and the field', () => {
		renderPhone({ invalid: true });

		expect(root()).toHaveAttribute('data-invalid', '');
		expect(field()).toHaveAttribute('aria-invalid', 'true');
	});

	it('ORs part-level flags with the root instead of replacing them', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const { unmount } = renderPhone({
			fieldDisabled: true,
			fieldRequired: true,
			countrySelectDisabled: true,
			onValueChange
		});

		expect(field()).toBeDisabled();
		expect(field()).toHaveAttribute('aria-required', 'true');
		expect(field()).toBeRequired();
		expect(trigger()).toBeDisabled();
		expect(root()).not.toHaveAttribute('data-disabled');

		unmount();

		renderPhone({ fieldReadOnly: true, defaultValue: '+1408', onValueChange });
		await user.click(field());
		await user.keyboard('5');
		expect(field()).toHaveValue('+1 408');
		expect(onValueChange).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// T011 — a part used outside its provider
// ---------------------------------------------------------------------------

describe('PhoneInput provider errors (T011)', () => {
	it.each([
		['bare-country-select', '<PhoneInput.CountrySelect>'],
		['bare-field', '<PhoneInput.Field>']
	] as const)('throws when %s is rendered with no root', (mode, part) => {
		expect(() => renderPhone({ mode })).toThrow(
			`\`${part}\` must be used within \`<PhoneInput.Root>\`.`
		);
	});
});

// ---------------------------------------------------------------------------
// T012 — native form participation
// ---------------------------------------------------------------------------

describe('PhoneInput form participation (T012)', () => {
	function hiddenInput(): HTMLInputElement | null {
		return document.querySelector<HTMLInputElement>('[data-slot="phone-input-form-input"]');
	}

	it('submits the canonical value from a hidden input', async () => {
		const user = userEvent.setup();
		const onSubmitted = vi.fn();
		renderPhone({ mode: 'form', name: 'phone', onSubmitted, withCountrySelect: false });

		const input = hiddenInput();
		expect(input).toHaveAttribute('type', 'hidden');
		expect(input).toHaveAttribute('name', 'phone');

		await user.type(field(), '14085551234');
		expect(input).toHaveValue('+14085551234');

		await user.click(screen.getByRole('button', { name: 'Submit' }));
		expect(onSubmitted).toHaveBeenLastCalledWith('+14085551234');
	});

	it('dispatches a bubbling input event from the hidden input on every change', async () => {
		const user = userEvent.setup();
		const onFormInput = vi.fn();
		renderPhone({ mode: 'form', withCountrySelect: false });

		screen.getByTestId('form').addEventListener('input', (event) => {
			if ((event.target as HTMLElement).dataset.slot === 'phone-input-form-input') {
				onFormInput((event.target as HTMLInputElement).value);
			}
		});

		await user.type(field(), '14');

		expect(onFormInput).toHaveBeenLastCalledWith('+14');
	});

	it('renders no hidden input outside a form', () => {
		renderPhone({ withCountrySelect: false });
		expect(hiddenInput()).toBeNull();
	});

	it('detects the form through a child snippet, and its absence too (T025)', async () => {
		const { unmount } = renderPhone({ mode: 'child-form', withCountrySelect: false });

		// The attachment travelling in the child props is the only thing that can report the
		// caller's <section> back to the root — `ref` is never bound in `child` mode.
		await waitFor(() => expect(hiddenInput()).not.toBeNull());
		expect(hiddenInput()?.closest('form')).toBe(screen.getByTestId('form'));

		unmount();
		renderPhone({ mode: 'child', withCountrySelect: false });
		await waitFor(() => expect(hiddenInput()).toBeNull());
	});

	it('keeps the child-rendered hidden input in step with the value (T025)', async () => {
		const user = userEvent.setup();
		const onSubmitted = vi.fn();
		renderPhone({ mode: 'child-form', name: 'phone', onSubmitted, withCountrySelect: false });

		await waitFor(() => expect(hiddenInput()).not.toBeNull());

		await user.type(field(), '14085551234');
		expect(hiddenInput()).toHaveValue('+14085551234');

		await user.click(screen.getByRole('button', { name: 'Submit' }));
		expect(onSubmitted).toHaveBeenLastCalledWith('+14085551234');
	});

	it('mirrors the root state onto the hidden input', () => {
		renderPhone({
			mode: 'form',
			disabled: true,
			required: true,
			readOnly: true,
			withCountrySelect: false
		});

		const input = hiddenInput();
		expect(input).toBeDisabled();
		expect(input).toHaveAttribute('required');
		expect(input).toHaveAttribute('readonly');
	});
});

// ---------------------------------------------------------------------------
// T013 — right-to-left
// ---------------------------------------------------------------------------

describe('PhoneInput in RTL (T013)', () => {
	it('keeps the trigger-then-field order and every interaction unchanged under dir="rtl"', async () => {
		const user = userEvent.setup();
		const onCountryChange = vi.fn();
		renderPhone({ mode: 'rtl', onCountryChange });

		const frame = screen.getByTestId('direction-frame');
		expect(frame).toHaveAttribute('dir', 'rtl');
		expect(trigger().compareDocumentPosition(field())).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

		await user.tab();
		expect(trigger()).toHaveFocus();
		await user.tab();
		expect(field()).toHaveFocus();

		await user.type(field(), '14085551234');
		expect(field()).toHaveValue('+1 408 555 123 4');

		trigger().focus();
		await user.keyboard('{Enter}');
		await waitFor(() => expect(screen.getByRole('listbox', inPopover)).toBeInTheDocument());
		await focusSearch();

		await user.keyboard('{ArrowDown}');
		expect(options()[1]).toHaveAttribute('aria-selected', 'true');
		await user.keyboard('{End}');
		expect(options()[options().length - 1]).toHaveAttribute('aria-selected', 'true');
		await user.keyboard('{Home}');
		expect(options()[0]).toHaveAttribute('aria-selected', 'true');

		await user.keyboard('{Escape}');
		await waitFor(() => expect(screen.queryByRole('listbox', inPopover)).not.toBeInTheDocument());
		expect(onCountryChange).toHaveBeenLastCalledWith('US');
	});
});
