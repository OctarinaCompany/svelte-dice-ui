import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
	applyCurrencyMask,
	applyMask,
	applyPercentageMask,
	DEFAULT_CURRENCY,
	DEFAULT_LOCALE,
	fromUnmaskedIndex,
	getUnmaskedValue,
	isCurrencyAtEnd,
	isCurrencyMask,
	MASK_PATTERN_KEYS,
	MASK_PATTERNS,
	resolveMaskPattern,
	toUnmaskedIndex,
	type MaskPattern
} from './index.js';
import Harness, { type MaskInputHarnessProps } from './mask-input.test.svelte';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** The rendered field, narrowed to `HTMLInputElement` so `selectionStart` is reachable. */
function field(): HTMLInputElement {
	const element = screen.getByTestId('mask-input');
	if (!(element instanceof HTMLInputElement)) {
		throw new Error('the mask input did not render an <input>');
	}
	return element;
}

function renderField(props: MaskInputHarnessProps = {}): HTMLInputElement {
	render(Harness, { props });
	return field();
}

/** The `de-DE`/`EUR` string Intl produces here, so the expectation cannot drift with ICU. */
function eur(value: number, minimumFractionDigits: number): string {
	return new Intl.NumberFormat('de-DE', {
		style: 'currency',
		currency: 'EUR',
		minimumFractionDigits,
		maximumFractionDigits: 2
	}).format(value);
}

// ---------------------------------------------------------------------------
// T004 — the engine, with no rendering at all (US5, quickstart rows 10 and 19)
// ---------------------------------------------------------------------------

describe('mask engine — table shape (T004)', () => {
	const expectedKeys = [
		'phone',
		'ssn',
		'date',
		'time',
		'creditCard',
		'creditCardExpiry',
		'zipCode',
		'zipCodeExtended',
		'currency',
		'percentage',
		'licensePlate',
		'ipv4',
		'macAddress',
		'isbn',
		'ein'
	];

	it('exposes the fifteen documented keys in upstream declaration order', () => {
		expect(Object.keys(MASK_PATTERNS)).toEqual(expectedKeys);
		expect([...MASK_PATTERN_KEYS]).toEqual(expectedKeys);
	});

	it('gives every entry a pattern string plus a transform and a validate function', () => {
		for (const key of MASK_PATTERN_KEYS) {
			const entry = MASK_PATTERNS[key];
			expect(typeof entry.pattern, key).toBe('string');
			expect(typeof entry.transform, key).toBe('function');
			expect(typeof entry.validate, key).toBe('function');
		}
	});

	it('exposes the documented defaults', () => {
		expect(DEFAULT_CURRENCY).toBe('USD');
		expect(DEFAULT_LOCALE).toBe('en-US');
	});

	it('resolves a key to its entry, passes an object through and leaves undefined alone', () => {
		const custom: MaskPattern = { pattern: '###' };
		expect(resolveMaskPattern('phone')).toBe(MASK_PATTERNS.phone);
		expect(resolveMaskPattern(custom)).toBe(custom);
		expect(resolveMaskPattern(undefined)).toBeUndefined();
	});

	it('detects currency masks by key or by pattern symbol', () => {
		expect(isCurrencyMask({ mask: 'currency' })).toBe(true);
		expect(isCurrencyMask({ mask: undefined, pattern: '$###,###.##' })).toBe(true);
		expect(isCurrencyMask({ mask: undefined, pattern: '€###,###.##' })).toBe(true);
		expect(isCurrencyMask({ mask: 'phone', pattern: '(###) ###-####' })).toBe(false);
	});

	it('knows which locales put the currency symbol after the number', () => {
		expect(isCurrencyAtEnd({ currency: 'USD', locale: 'en-US' })).toBe(false);
		expect(isCurrencyAtEnd({ currency: 'EUR', locale: 'de-DE' })).toBe(true);
	});
});

describe('mask engine — applyMask (T004)', () => {
	it('applies a basic pattern mask', () => {
		expect(applyMask({ value: '1234567890', pattern: '(###) ###-####' })).toBe('(123) 456-7890');
	});

	it('handles partial input', () => {
		expect(applyMask({ value: '123', pattern: '(###) ###-####' })).toBe('(123');
	});

	it('applies a transformed value', () => {
		const transform = (value: string) => value.replace(/\D/g, '');
		expect(applyMask({ value: transform('1a2b3c'), pattern: '###-###' })).toBe('123');
	});

	it('applies the currency mask with USD', () => {
		expect(
			applyMask({
				value: '1234.56',
				pattern: '$###,###.##',
				currency: 'USD',
				locale: 'en-US',
				mask: 'currency'
			})
		).toBe('$1,234.56');
	});

	it('applies the currency mask with EUR', () => {
		expect(
			applyMask({
				value: '1234.56',
				pattern: '€###,###.##',
				currency: 'EUR',
				locale: 'de-DE',
				mask: 'currency'
			})
		).toMatch(/1\.234,56\s+€/);
	});

	it('applies the percentage mask', () => {
		expect(applyMask({ value: '25.5', pattern: '##.##%' })).toBe('25.5%');
	});

	it('leaves an ipv4 value untouched', () => {
		expect(applyMask({ value: '192168111', pattern: '###.###.###.###', mask: 'ipv4' })).toBe(
			'192168111'
		);
	});
});

describe('mask engine — applyCurrencyMask (T004)', () => {
	it('formats USD by default', () => {
		expect(applyCurrencyMask({ value: '1234.56' })).toBe('$1,234.56');
	});

	it('formats EUR', () => {
		expect(applyCurrencyMask({ value: '1234.56', currency: 'EUR', locale: 'de-DE' })).toMatch(
			/1\.234,56\s+€/
		);
	});

	it('formats GBP', () => {
		expect(applyCurrencyMask({ value: '1234.56', currency: 'GBP', locale: 'en-GB' })).toBe(
			'£1,234.56'
		);
	});

	it('formats JPY without forcing decimals', () => {
		expect(applyCurrencyMask({ value: '1234', currency: 'JPY', locale: 'ja-JP' })).toMatch(
			/[¥￥]1,234/
		);
	});

	it('handles an empty value', () => {
		expect(applyCurrencyMask({ value: '' })).toBe('');
	});

	it('handles invalid numeric values', () => {
		expect(applyCurrencyMask({ value: 'abc' })).toBe('');
	});

	it('adds group separators for large numbers', () => {
		expect(applyCurrencyMask({ value: '1234567.89' })).toBe('$1,234,567.89');
	});

	it('handles partial decimal input', () => {
		expect(applyCurrencyMask({ value: '123.4' })).toBe('$123.4');
	});

	it('handles integer input', () => {
		expect(applyCurrencyMask({ value: '123' })).toBe('$123');
	});

	it('handles incremental input correctly', () => {
		expect(applyCurrencyMask({ value: '1' })).toBe('$1');
		expect(applyCurrencyMask({ value: '12' })).toBe('$12');
		expect(applyCurrencyMask({ value: '123' })).toBe('$123');
		expect(applyCurrencyMask({ value: '123.' })).toBe('$123.');
		expect(applyCurrencyMask({ value: '123.4' })).toBe('$123.4');
		expect(applyCurrencyMask({ value: '123.45' })).toBe('$123.45');
	});

	it('falls back to USD on an unknown currency and locale', () => {
		expect(
			applyCurrencyMask({ value: '123.45', currency: 'INVALID', locale: 'invalid-locale' })
		).toBe('$123.45');
	});
});

describe('mask engine — applyPercentageMask (T004)', () => {
	it('formats a percentage', () => {
		expect(applyPercentageMask('25.5')).toBe('25.5%');
	});

	it('handles an empty value', () => {
		expect(applyPercentageMask('')).toBe('');
	});

	it('limits decimal places', () => {
		expect(applyPercentageMask('25.555')).toBe('25.55%');
	});
});

describe('mask engine — getUnmaskedValue (T004)', () => {
	it('removes non-digits by default', () => {
		expect(getUnmaskedValue({ value: '(123) 456-7890' })).toBe('1234567890');
	});

	it('applies a custom transform', () => {
		expect(
			getUnmaskedValue({
				value: 'abc-123',
				transform: (value) => value.replace(/[^A-Z0-9]/gi, '').toUpperCase()
			})
		).toBe('ABC123');
	});
});

describe('mask engine — caret index conversion (T004)', () => {
	const masked = '(123) 456-7890';
	const pattern = '(###) ###-####';

	it('converts a masked caret to an unmasked index', () => {
		expect(toUnmaskedIndex({ masked, pattern, caret: 9 })).toBe(6);
	});

	it('converts an unmasked index back to a masked caret', () => {
		expect(fromUnmaskedIndex({ masked, pattern, unmaskedIndex: 6 })).toBe(9);
	});

	it('round-trips every slot of the phone pattern', () => {
		for (let unmaskedIndex = 1; unmaskedIndex <= 10; unmaskedIndex++) {
			const caret = fromUnmaskedIndex({ masked, pattern, unmaskedIndex });
			expect(toUnmaskedIndex({ masked, pattern, caret })).toBe(unmaskedIndex);
		}
	});
});

describe('mask engine — MASK_PATTERNS validation (T004)', () => {
	it('validates phone numbers', () => {
		const { validate } = MASK_PATTERNS.phone;
		expect(validate?.('1234567890')).toBe(true);
		expect(validate?.('123456789')).toBe(false);
		expect(validate?.('12345678901')).toBe(false);
	});

	it('validates dates', () => {
		vi.useFakeTimers();
		try {
			vi.setSystemTime(new Date(2025, 11, 15));
			const { validate } = MASK_PATTERNS.date;
			expect(validate?.('12252023')).toBe(true);
			expect(validate?.('13252023')).toBe(false);
			expect(validate?.('12322023')).toBe(false);
			expect(validate?.('02292023')).toBe(false);
			expect(validate?.('02292024')).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});

	it('validates times', () => {
		const { validate } = MASK_PATTERNS.time;
		expect(validate?.('1430')).toBe(true);
		expect(validate?.('2430')).toBe(false);
		expect(validate?.('1460')).toBe(false);
	});

	it('validates credit card numbers with the Luhn checksum', () => {
		const { validate } = MASK_PATTERNS.creditCard;

		expect(validate?.('4242424242424242')).toBe(true);
		expect(validate?.('4000000000000002')).toBe(true);
		expect(validate?.('5555555555554444')).toBe(true);
		expect(validate?.('378282246310005')).toBe(true);
		expect(validate?.('6011111111111117')).toBe(true);

		expect(validate?.('1231231231231231')).toBe(false);
		expect(validate?.('4242424242424243')).toBe(false);
		expect(validate?.('1234567890123456')).toBe(false);
		expect(validate?.('1111111111111111')).toBe(false);

		// All zeros technically pass Luhn (sum 0), which upstream documents rather than special-cases.
		expect(validate?.('0000000000000000')).toBe(true);

		expect(validate?.('123456789012')).toBe(false);
		expect(validate?.('12345678901234567890')).toBe(false);
		expect(validate?.('123')).toBe(false);
		expect(validate?.('')).toBe(false);
		expect(validate?.('abcd')).toBe(false);
	});

	it('validates credit card expiry dates against the frozen clock', () => {
		vi.useFakeTimers();
		try {
			vi.setSystemTime(new Date(2025, 11, 15));
			const { validate } = MASK_PATTERNS.creditCardExpiry;

			expect(validate?.('1226')).toBe(true);
			expect(validate?.('0126')).toBe(true);
			expect(validate?.('1225')).toBe(true);
			expect(validate?.('1239')).toBe(true);

			expect(validate?.('1125')).toBe(false);
			expect(validate?.('1224')).toBe(false);

			expect(validate?.('0025')).toBe(false);
			expect(validate?.('1325')).toBe(false);

			expect(validate?.('125')).toBe(false);
			expect(validate?.('12255')).toBe(false);
			expect(validate?.('')).toBe(false);
			expect(validate?.('ab25')).toBe(false);

			expect(validate?.('1240')).toBe(true);
			expect(validate?.('1250')).toBe(true);
			expect(validate?.('1299')).toBe(false);
			expect(validate?.('1200')).toBe(false);
			expect(validate?.('1230')).toBe(true);
			expect(validate?.('1249')).toBe(true);
			expect(validate?.('1275')).toBe(true);
			expect(validate?.('1276')).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});

	it('validates ipv4 addresses', () => {
		const { validate } = MASK_PATTERNS.ipv4;
		expect(validate?.('192168001001')).toBe(true);
		expect(validate?.('256168001001')).toBe(false);
		expect(validate?.('192168001')).toBe(true);
		expect(validate?.('192168111')).toBe(true);
		expect(validate?.('1921680010011')).toBe(false);
		expect(validate?.('192.168.1.1')).toBe(true);
		expect(validate?.('192.168.1.256')).toBe(false);
	});

	it('validates currency amounts', () => {
		const { validate } = MASK_PATTERNS.currency;
		expect(validate?.('123.45')).toBe(true);
		expect(validate?.('123')).toBe(true);
		expect(validate?.('123.456')).toBe(false);
		expect(validate?.('abc')).toBe(false);
	});

	it('validates percentages, honouring min and max', () => {
		const { validate } = MASK_PATTERNS.percentage;
		expect(validate?.('25.5')).toBe(true);
		expect(validate?.('100')).toBe(true);
		expect(validate?.('101')).toBe(false);
		expect(validate?.('-5')).toBe(false);
		expect(validate?.('5', { min: 10, max: 20 })).toBe(false);
		expect(validate?.('15', { min: 10, max: 20 })).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// T005 — roles, ARIA, state attributes, focus traversal (quickstart row 11)
// ---------------------------------------------------------------------------

describe('MaskInput accessibility and attributes (T005)', () => {
	it('renders a native textbox carrying the component slot', () => {
		const input = renderField();
		expect(screen.getByRole('textbox')).toBe(input);
		expect(input).toHaveAttribute('data-slot', 'mask-input');
	});

	it('applies the shared input class string', () => {
		const input = renderField();
		expect(input).toHaveClass('h-8', 'w-full', 'rounded-lg', 'border');
	});

	it('merges a caller class last', () => {
		const input = renderField({ class: 'custom-class' });
		expect(input).toHaveClass('custom-class');
	});

	it('forwards the element through bind:ref', () => {
		const onRef = vi.fn();
		const input = renderField({ onRef });
		expect(onRef).toHaveBeenCalledWith(input);
	});

	it('always emits aria-invalid and adds data-invalid only when invalid', () => {
		const input = renderField();
		expect(input).toHaveAttribute('aria-invalid', 'false');
		expect(input).not.toHaveAttribute('data-invalid');

		cleanup();

		const invalidInput = renderField({ invalid: true });
		expect(invalidInput).toHaveAttribute('aria-invalid', 'true');
		expect(invalidInput).toHaveAttribute('data-invalid', '');
	});

	it('reflects the disabled state natively and as a data attribute', () => {
		const input = renderField({ disabled: true });
		expect(input).toBeDisabled();
		expect(input).toHaveAttribute('data-disabled', '');
	});

	it('reflects the readonly state natively and as a data attribute', () => {
		const input = renderField({ readonly: true });
		expect(input).toHaveAttribute('readonly');
		expect(input).toHaveAttribute('data-readonly', '');
	});

	it('reflects the required state natively and as a data attribute', () => {
		const input = renderField({ required: true });
		expect(input).toBeRequired();
		expect(input).toHaveAttribute('data-required', '');
	});

	it('omits the state data attributes when the states are off', () => {
		const input = renderField();
		expect(input).not.toHaveAttribute('data-disabled');
		expect(input).not.toHaveAttribute('data-readonly');
		expect(input).not.toHaveAttribute('data-required');
	});

	it('is reachable by its associated <label>', () => {
		renderField({ label: 'Phone number', mask: 'phone' });
		expect(screen.getByLabelText('Phone number')).toBe(field());
	});

	it('is reachable by aria-label', () => {
		renderField({ 'aria-label': 'Card number', mask: 'creditCard' });
		expect(screen.getByLabelText('Card number')).toBe(field());
	});

	it('takes and releases focus with Tab and Shift+Tab', async () => {
		const user = userEvent.setup();
		renderField({ withOuterInputs: true, mask: 'phone' });

		const before = screen.getByTestId('before');
		const after = screen.getByTestId('after');

		before.focus();
		await user.tab();
		expect(field()).toHaveFocus();

		await user.tab();
		expect(after).toHaveFocus();

		await user.tab({ shift: true });
		expect(field()).toHaveFocus();

		await user.tab({ shift: true });
		expect(before).toHaveFocus();
	});

	it('calls the caller focus and blur handlers', async () => {
		const user = userEvent.setup();
		const onfocus = vi.fn();
		const onblur = vi.fn();
		const input = renderField({ mask: 'phone', placeholder: 'Enter phone', onfocus, onblur });

		await user.click(input);
		expect(onfocus).toHaveBeenCalled();
		expect(input).toHaveAttribute('placeholder', 'Enter phone');

		await user.tab();
		expect(onblur).toHaveBeenCalled();
		expect(input).toHaveAttribute('placeholder', 'Enter phone');
	});
});

// ---------------------------------------------------------------------------
// T006 — live formatting for every pattern (quickstart rows 1, 2, 3)
// ---------------------------------------------------------------------------

describe('MaskInput live formatting (T006)', () => {
	it.each([
		['phone', '1234567890', '(123) 456-7890', '1234567890'],
		['ssn', '123456789', '123-45-6789', '123456789'],
		['date', '12252023', '12/25/2023', '12252023'],
		['time', '1430', '14:30', '1430'],
		['creditCard', '1234567890123456', '1234 5678 9012 3456', '1234567890123456'],
		['creditCardExpiry', '1225', '12/25', '1225'],
		['zipCode', '12345', '12345', '12345'],
		['zipCodeExtended', '123456789', '12345-6789', '123456789'],
		['currency', '1234.56', '$1,234.56', '1234.56'],
		['percentage', '25.5', '25.5%', '25.5'],
		['licensePlate', 'abc123', 'ABC-123', 'ABC123'],
		['ipv4', '192168111', '192168111', '192168111'],
		['macAddress', '001b44113ab7', '00:1B:44:11:3A:B7', '001B44113AB7'],
		['isbn', '9780123456789', '978-0-123-45678-9', '9780123456789'],
		['ein', '123456789', '12-3456789', '123456789']
	] as const)('formats the %s pattern while typing', async (mask, typed, masked, unmasked) => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const input = renderField({ mask, onValueChange });

		await user.type(input, typed);

		expect(input).toHaveValue(masked);
		expect(onValueChange).toHaveBeenLastCalledWith(masked, unmasked);
	});

	it('applies a custom mask object exactly like a built-in one', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const customMask: MaskPattern = {
			pattern: '##-##-##',
			transform: (value) => value.replace(/[^A-Z0-9]/gi, '').toUpperCase(),
			validate: (value) => /^[A-Z0-9]{6}$/.test(value)
		};
		const input = renderField({ mask: customMask, onValueChange });

		await user.type(input, 'ab12cd');

		expect(input).toHaveValue('AB-12-CD');
		expect(onValueChange).toHaveBeenLastCalledWith('AB-12-CD', 'AB12CD');
	});

	it('formats EUR in the de-DE locale', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const input = renderField({
			mask: 'currency',
			currency: 'EUR',
			locale: 'de-DE',
			onValueChange
		});

		await user.type(input, '1234,56');

		const expected = eur(1234.56, 2);
		expect(input).toHaveValue(expected);
		expect(onValueChange).toHaveBeenLastCalledWith(expected, '1234.56');
	});

	it('formats GBP in the en-GB locale', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const input = renderField({
			mask: 'currency',
			currency: 'GBP',
			locale: 'en-GB',
			onValueChange
		});

		await user.type(input, '1234.56');

		expect(input).toHaveValue('£1,234.56');
		expect(onValueChange).toHaveBeenLastCalledWith('£1,234.56', '1234.56');
	});

	it('formats JPY without decimals', async () => {
		const user = userEvent.setup();
		const input = renderField({ mask: 'currency', currency: 'JPY', locale: 'ja-JP' });

		await user.type(input, '1234');

		expect(input.value).toMatch(/[¥￥]1,234/);
	});

	it('falls back to USD in en-US for an unrecognized currency and locale', async () => {
		const user = userEvent.setup();
		const input = renderField({
			mask: 'currency',
			currency: 'INVALID',
			locale: 'invalid-locale'
		});

		await user.type(input, '123.45');

		expect(input).toHaveValue('$123.45');
	});

	it('accepts currency digits one at a time', async () => {
		const user = userEvent.setup();
		const input = renderField({ mask: 'currency' });

		await user.type(input, '1');
		expect(input).toHaveValue('$1');
		await user.type(input, '2');
		expect(input).toHaveValue('$12');
		await user.type(input, '3');
		expect(input).toHaveValue('$123');
		await user.type(input, '.');
		expect(input).toHaveValue('$123.');
		await user.type(input, '45');
		expect(input).toHaveValue('$123.45');
	});

	it('leaves the typed text alone when withoutMask is set', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onValidate = vi.fn();
		const input = renderField({ mask: 'phone', withoutMask: true, onValueChange, onValidate });

		await user.type(input, '1234567890');

		expect(input).toHaveValue('1234567890');
		expect(onValueChange).toHaveBeenLastCalledWith('1234567890', '1234567890');
		expect(onValidate).toHaveBeenLastCalledWith(true, '1234567890');
	});

	it('leaves the typed text alone when no mask is given', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const input = renderField({ onValueChange });

		await user.type(input, 'abc-123');

		expect(input).toHaveValue('abc-123');
		expect(onValueChange).toHaveBeenLastCalledWith('abc-123', 'abc-123');
	});
});

// ---------------------------------------------------------------------------
// T007 — caret positioning after programmatic reformatting (rows 4–8, SC-002)
// ---------------------------------------------------------------------------

describe('MaskInput caret positioning (T007)', () => {
	it('keeps the caret in place when inserting in the middle of a credit card', async () => {
		const user = userEvent.setup();
		const input = renderField({ mask: 'creditCard' });

		await user.type(input, '4242424242424242');
		expect(input).toHaveValue('4242 4242 4242 4242');

		input.setSelectionRange(13, 13);
		expect(input.selectionStart).toBe(13);

		await user.keyboard('{Backspace}');
		expect(input).toHaveValue('4242 4242 4224 242');
		expect(input.selectionStart).toBe(12);

		await user.keyboard('4');
		expect(input).toHaveValue('4242 4242 4242 4242');
		expect(input.selectionStart).toBe(13);
	});

	it('keeps the caret in place when inserting at the beginning', async () => {
		const user = userEvent.setup();
		const input = renderField({ mask: 'creditCard' });

		await user.type(input, '424242');
		expect(input).toHaveValue('4242 42');

		input.setSelectionRange(0, 0);
		await user.keyboard('1');

		expect(input).toHaveValue('1424 242');
		expect(input.selectionStart).toBe(1);
	});

	it('steps the caret past a literal when inserting before a separator', async () => {
		const user = userEvent.setup();
		const input = renderField({ mask: 'creditCard' });

		await user.type(input, '4242');
		expect(input).toHaveValue('4242');

		input.setSelectionRange(4, 4);
		await user.keyboard('5');

		expect(input).toHaveValue('4242 5');
		expect(input.selectionStart).toBe(6);
	});

	it('keeps the caret in place when deleting inside a phone number', async () => {
		const user = userEvent.setup();
		const input = renderField({ mask: 'phone' });

		await user.type(input, '5551234567');
		expect(input).toHaveValue('(555) 123-4567');

		input.setSelectionRange(10, 10);
		await user.keyboard('{Backspace}');
		expect(input).toHaveValue('(555) 124-567');
		expect(input.selectionStart).toBe(8);

		await user.keyboard('3');
		expect(input).toHaveValue('(555) 123-4567');
		expect(input.selectionStart).toBe(9);
	});

	it('keeps the caret in place when editing a date mask with Delete', async () => {
		const user = userEvent.setup();
		const input = renderField({ mask: 'date' });

		await user.type(input, '12252025');
		expect(input).toHaveValue('12/25/2025');

		input.setSelectionRange(3, 3);
		await user.keyboard('{Delete}');
		expect(input).toHaveValue('12/52/025');

		input.setSelectionRange(3, 3);
		await user.keyboard('2');
		expect(input).toHaveValue('12/25/2025');
		expect(input.selectionStart).toBe(4);
	});

	it('keeps the caret at the end when typing at the end', async () => {
		const user = userEvent.setup();
		const input = renderField({ mask: 'creditCard' });

		await user.type(input, '4242');
		expect(input).toHaveValue('4242');
		expect(input.selectionStart).toBe(4);

		await user.keyboard('4');
		expect(input).toHaveValue('4242 4');
		expect(input.selectionStart).toBe(6);
	});

	it('keeps the caret in place when editing the middle of an SSN', async () => {
		const user = userEvent.setup();
		const input = renderField({ mask: 'ssn' });

		await user.type(input, '123456789');
		expect(input).toHaveValue('123-45-6789');

		input.setSelectionRange(7, 7);
		await user.keyboard('{Backspace}');
		expect(input).toHaveValue('123-46-789');
		expect(input.selectionStart).toBe(5);

		await user.keyboard('5');
		expect(input).toHaveValue('123-45-6789');
		expect(input.selectionStart).toBe(6);
	});

	it('does not let the caret jump while typing rapidly in the middle', async () => {
		const user = userEvent.setup();
		const input = renderField({ mask: 'creditCard' });

		await user.type(input, '42424242');
		expect(input).toHaveValue('4242 4242');

		input.setSelectionRange(5, 5);
		await user.keyboard('111');

		expect(input).toHaveValue('4242 1114 242');
		expect(input.selectionStart).toBe(8);
	});

	it('keeps the caret when Backspace removes the slot before a literal', async () => {
		const user = userEvent.setup();
		const input = renderField({ mask: 'phone' });

		await user.type(input, '5551');
		expect(input).toHaveValue('(555) 1');

		input.setSelectionRange(6, 6);
		await user.keyboard('{Backspace}');

		expect(input).toHaveValue('(551');
		expect(input.selectionStart).toBe(3);
	});

	it('keeps the caret in place with a controlled component', async () => {
		const user = userEvent.setup();
		const input = renderField({ mode: 'controlled', mask: 'creditCard' });

		await user.type(input, '4242');
		expect(input).toHaveValue('4242');

		input.setSelectionRange(2, 2);
		await user.keyboard('1');

		expect(input).toHaveValue('4214 2');
		expect(input.selectionStart).toBe(3);
	});

	it('keeps the caret near the edit when editing EUR currency in the middle', async () => {
		const user = userEvent.setup();
		const input = renderField({ mask: 'currency', currency: 'EUR', locale: 'de-DE' });

		await user.type(input, '123456');
		expect(input.value).toContain('1');
		expect(input.value).toContain('234');
		expect(input.value).toContain('56');

		const endPosition = input.selectionStart ?? 0;

		const middlePosition = input.value.indexOf('234');
		input.setSelectionRange(middlePosition, middlePosition);

		await user.keyboard('{Backspace}');

		const newPosition = input.selectionStart ?? 0;
		expect(newPosition).toBeLessThan(endPosition - 2);
		expect(newPosition).toBeGreaterThan(0);
	});

	it('keeps the caret in place when editing USD currency in the middle', async () => {
		const user = userEvent.setup();
		const input = renderField({ mask: 'currency', currency: 'USD', locale: 'en-US' });

		await user.type(input, '123456');
		expect(input.value).toBe('$123,456');

		input.setSelectionRange(1, 1);
		await user.keyboard('9');

		expect(input.value).toBe('$9,123,456');
		expect(input.selectionStart).toBe(2);
	});

	it('replaces a selection on paste and leaves the caret after the pasted slots', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const input = renderField({ mask: 'phone', onValueChange });

		await user.type(input, '555');
		expect(input).toHaveValue('(555');

		input.setSelectionRange(1, 4);
		await user.paste('12');

		expect(input).toHaveValue('(12');
		expect(input.selectionStart).toBe(3);
		expect(onValueChange).toHaveBeenLastCalledWith('(12', '12');
	});

	it('parks the caret before a trailing currency symbol on paste', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const input = renderField({
			mask: 'currency',
			currency: 'EUR',
			locale: 'de-DE',
			onValueChange
		});

		await user.click(input);
		await user.paste('1234,56');

		const expected = eur(1234.56, 2);
		expect(input).toHaveValue(expected);

		const caret = input.selectionStart ?? -1;
		expect(expected.slice(caret)).toMatch(/^\s*€$/);
		expect(expected.slice(0, caret)).toMatch(/\d$/);
		// Upstream returns from the currency branch before notifying (contract D-10).
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('parks the caret at the end on paste when the currency symbol leads', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const input = renderField({ mask: 'currency', onValueChange });

		await user.click(input);
		await user.paste('1234.56');

		expect(input).toHaveValue('$1,234.56');
		expect(input.selectionStart).toBe('$1,234.56'.length);
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('parks the caret before the percent sign on paste', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const input = renderField({ mask: 'percentage', onValueChange });

		await user.click(input);
		await user.paste('25.5');

		expect(input).toHaveValue('25.5%');
		expect(input.selectionStart).toBe('25.5%'.length - 1);
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('leaves a select-all deletion to the browser', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const input = renderField({ mask: 'creditCard', onValueChange });

		await user.type(input, '4242424242424242');
		expect(input).toHaveValue('4242 4242 4242 4242');

		await user.keyboard('{Control>}a{/Control}');
		await user.keyboard('{Backspace}');

		// The component never calls preventDefault() on a non-collapsed selection, so the native
		// deletion goes through and empties the field.
		expect(input).toHaveValue('');
		expect(onValueChange).toHaveBeenLastCalledWith('', '');
	});
});

// ---------------------------------------------------------------------------
// T008 — validation modes (quickstart row 9)
// ---------------------------------------------------------------------------

describe('MaskInput validation modes (T008)', () => {
	it.each([
		['onChange', true, false],
		['onBlur', false, true],
		['onSubmit', false, false],
		['onTouched', false, true],
		['all', true, true]
	] as const)(
		'the %s mode validates on change=%s and on blur=%s',
		async (validationMode, onChangeFires, onBlurFires) => {
			const user = userEvent.setup();
			const onValidate = vi.fn();
			const input = renderField({ mask: 'phone', validationMode, onValidate });

			await user.type(input, '123');

			if (onChangeFires) {
				expect(onValidate).toHaveBeenLastCalledWith(false, '123');
			} else {
				expect(onValidate).not.toHaveBeenCalled();
			}

			onValidate.mockClear();

			await user.tab();

			if (onBlurFires) {
				expect(onValidate).toHaveBeenLastCalledWith(false, '123');
			} else {
				expect(onValidate).not.toHaveBeenCalled();
			}
		}
	);

	it('validates on every change once the field has been blurred in onTouched mode', async () => {
		const user = userEvent.setup();
		const onValidate = vi.fn();
		const input = renderField({ mask: 'phone', validationMode: 'onTouched', onValidate });

		await user.type(input, '123');
		await user.tab();
		expect(onValidate).toHaveBeenCalled();

		onValidate.mockClear();

		await user.click(input);
		await user.type(input, '4');
		expect(onValidate).toHaveBeenLastCalledWith(false, '1234');
	});

	it('reports a complete value as valid', async () => {
		const user = userEvent.setup();
		const onValidate = vi.fn();
		const input = renderField({ mask: 'phone', onValidate });

		await user.type(input, '5551234567');

		expect(onValidate).toHaveBeenLastCalledWith(true, '5551234567');
	});

	it('runs a custom validate function', async () => {
		const user = userEvent.setup();
		const onValidate = vi.fn();
		const customMask: MaskPattern = {
			pattern: '###',
			validate: (value) => parseInt(value, 10) > 100
		};
		const input = renderField({ mask: customMask, onValidate });

		await user.type(input, '150');
		expect(onValidate).toHaveBeenLastCalledWith(true, '150');

		await user.clear(input);
		await user.type(input, '50');
		expect(onValidate).toHaveBeenLastCalledWith(false, '50');
	});

	it('forwards min and max into the pattern validator', async () => {
		const user = userEvent.setup();
		const onValidate = vi.fn();
		const input = renderField({ mask: 'percentage', min: '10', max: '20', onValidate });

		await user.type(input, '5');
		expect(onValidate).toHaveBeenLastCalledWith(false, '5');

		await user.clear(input);
		await user.type(input, '15');
		expect(onValidate).toHaveBeenLastCalledWith(true, '15');
	});
});

// ---------------------------------------------------------------------------
// T009 — guard rails and the remaining edge cases (rows 12, 15, 16, 17)
// ---------------------------------------------------------------------------

describe('MaskInput guard rails (T009)', () => {
	it('suppresses typing, deletion and paste while disabled', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const input = renderField({
			mask: 'phone',
			defaultValue: '555',
			disabled: true,
			onValueChange
		});

		expect(input).toHaveValue('(555');

		await user.type(input, '1234');
		await user.keyboard('{Backspace}{Delete}');
		// A disabled field cannot be focused, so the paste is delivered straight to the element.
		await fireEvent.paste(input, { clipboardData: { getData: () => '9999' } });

		expect(input).toHaveValue('(555');
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('suppresses typing, deletion and paste while readonly', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const input = renderField({
			mask: 'phone',
			defaultValue: '555',
			readonly: true,
			onValueChange
		});

		expect(input).toHaveValue('(555');

		await user.click(input);
		await user.type(input, '1234');
		input.setSelectionRange(4, 4);
		await user.keyboard('{Backspace}');
		input.setSelectionRange(1, 1);
		await user.keyboard('{Delete}');
		await user.paste('9999');

		expect(input).toHaveValue('(555');
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it.each([
		['zipCode', '5', 'numeric'],
		['phone', '14', 'numeric'],
		['date', '10', 'numeric'],
		['ipv4', '15', 'decimal'],
		['macAddress', '17', undefined],
		['isbn', '17', undefined]
	] as const)('derives maxlength %s -> %s and inputmode %s', (mask, maxlength, inputmode) => {
		const input = renderField({ mask });
		expect(input).toHaveAttribute('maxlength', maxlength);
		if (inputmode) {
			expect(input).toHaveAttribute('inputmode', inputmode);
		} else {
			expect(input).not.toHaveAttribute('inputmode');
		}
	});

	it.each(['currency', 'percentage'] as const)(
		'gives the %s mask a decimal inputmode and no maxlength',
		(mask) => {
			const input = renderField({ mask });
			expect(input).toHaveAttribute('inputmode', 'decimal');
			expect(input).not.toHaveAttribute('maxlength');
		}
	);

	it('gives a custom object mask a maxlength but no inputmode', () => {
		const input = renderField({ mask: { pattern: '##-##' } });
		expect(input).toHaveAttribute('maxlength', '5');
		expect(input).not.toHaveAttribute('inputmode');
	});

	it('lets the caller override the derived inputmode', () => {
		const input = renderField({ mask: 'phone', inputmode: 'text' });
		expect(input).toHaveAttribute('inputmode', 'text');
	});

	it('holds back masking and notification until an IME composition ends', async () => {
		const onValueChange = vi.fn();
		const input = renderField({ mask: 'phone', onValueChange });

		await fireEvent.compositionStart(input);
		await fireEvent.input(input, { target: { value: 'あ' } });

		expect(onValueChange).not.toHaveBeenCalled();

		await fireEvent.compositionEnd(input);
		await fireEvent.input(input, { target: { value: '1' } });

		expect(input).toHaveValue('(1');
		expect(onValueChange).toHaveBeenLastCalledWith('(1', '1');
	});
});

describe('MaskInput placeholder resolution (T009)', () => {
	it('swaps to the mask placeholder while focused', async () => {
		const user = userEvent.setup();
		const input = renderField({
			mask: 'phone',
			placeholder: 'Enter phone',
			maskPlaceholder: '(___) ___-____'
		});

		expect(input).toHaveAttribute('placeholder', 'Enter phone');
		await user.click(input);
		expect(input).toHaveAttribute('placeholder', '(___) ___-____');
		await user.tab();
		expect(input).toHaveAttribute('placeholder', 'Enter phone');
	});

	it('keeps the regular placeholder when no mask placeholder is given', async () => {
		const user = userEvent.setup();
		const input = renderField({ mask: 'phone', placeholder: 'Enter phone' });

		expect(input).toHaveAttribute('placeholder', 'Enter phone');
		await user.click(input);
		expect(input).toHaveAttribute('placeholder', 'Enter phone');
		await user.tab();
		expect(input).toHaveAttribute('placeholder', 'Enter phone');
	});

	it('shows nothing unfocused when only a mask placeholder is given', async () => {
		const user = userEvent.setup();
		const input = renderField({ mask: 'phone', maskPlaceholder: '(___) ___-____' });

		expect(input).not.toHaveAttribute('placeholder');
		await user.click(input);
		expect(input).toHaveAttribute('placeholder', '(___) ___-____');
		await user.tab();
		expect(input).not.toHaveAttribute('placeholder');
	});

	it('emits no placeholder at all when neither is given', async () => {
		const user = userEvent.setup();
		const input = renderField({ mask: 'phone' });

		expect(input).not.toHaveAttribute('placeholder');
		await user.click(input);
		expect(input).not.toHaveAttribute('placeholder');
	});

	it('keeps the regular placeholder in both states when withoutMask is set', async () => {
		const user = userEvent.setup();
		const input = renderField({
			mask: 'phone',
			withoutMask: true,
			placeholder: 'Enter phone',
			maskPlaceholder: '(___) ___-____'
		});

		expect(input).toHaveAttribute('placeholder', 'Enter phone');
		await user.click(input);
		expect(input).toHaveAttribute('placeholder', 'Enter phone');
	});

	it('swaps the currency mask placeholder while focused', async () => {
		const user = userEvent.setup();
		const input = renderField({
			mask: 'currency',
			placeholder: 'Enter amount',
			maskPlaceholder: '$0.00'
		});

		expect(input).toHaveAttribute('placeholder', 'Enter amount');
		await user.click(input);
		expect(input).toHaveAttribute('placeholder', '$0.00');
		await user.tab();
		expect(input).toHaveAttribute('placeholder', 'Enter amount');
	});

	it('swaps the percentage mask placeholder while focused', async () => {
		const user = userEvent.setup();
		const input = renderField({
			mask: 'percentage',
			placeholder: 'Enter percentage',
			maskPlaceholder: '0.00%'
		});

		expect(input).toHaveAttribute('placeholder', 'Enter percentage');
		await user.click(input);
		expect(input).toHaveAttribute('placeholder', '0.00%');
		await user.tab();
		expect(input).toHaveAttribute('placeholder', 'Enter percentage');
	});

	it('swaps a custom mask placeholder while focused', async () => {
		const user = userEvent.setup();
		const customMask: MaskPattern = {
			pattern: '###-###',
			transform: (value) => value.replace(/[^A-Z0-9]/gi, '').toUpperCase(),
			validate: (value) => /^[A-Z0-9]{6}$/.test(value)
		};
		const input = renderField({
			mask: customMask,
			placeholder: 'Enter code',
			maskPlaceholder: 'ABC-123'
		});

		expect(input).toHaveAttribute('placeholder', 'Enter code');
		await user.click(input);
		expect(input).toHaveAttribute('placeholder', 'ABC-123');
		await user.tab();
		expect(input).toHaveAttribute('placeholder', 'Enter code');
	});
});

// ---------------------------------------------------------------------------
// T010 — RTL (quickstart row 13, FR-019, research R-10)
// ---------------------------------------------------------------------------

describe('MaskInput in RTL (T010)', () => {
	async function drive(dir: 'ltr' | 'rtl') {
		const user = userEvent.setup();
		render(Harness, { props: { mask: 'phone', dir } });
		const input = field();

		await user.type(input, '5551234567');
		input.setSelectionRange(10, 10);
		await user.keyboard('{Backspace}');
		await user.keyboard('3');
		input.setSelectionRange(1, 4);
		await user.paste('99');

		const result = { value: input.value, caret: input.selectionStart };
		cleanup();
		return result;
	}

	it('inherits the ambient direction rather than setting its own', () => {
		const input = renderField({ mask: 'phone', dir: 'rtl' });

		expect(input).not.toHaveAttribute('dir');
		expect(input.closest('[dir="rtl"]')).toBe(screen.getByTestId('direction-frame'));
		expect(getComputedStyle(input).direction).toBe('rtl');
	});

	it('masks and positions the caret identically in both directions', async () => {
		const rtl = await drive('rtl');
		const ltr = await drive('ltr');

		expect(rtl).toEqual(ltr);
		expect(rtl.value).toBe('(991) 234-567');
		expect(rtl.caret).toBe(13);
	});
});

// ---------------------------------------------------------------------------
// T011 — controlled, uncontrolled and the `child` snippet (rows 14, 18)
// ---------------------------------------------------------------------------

describe('MaskInput controlled and uncontrolled (T011)', () => {
	it('seeds an uncontrolled field from defaultValue and owns it afterwards', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const input = renderField({ mask: 'phone', defaultValue: '123', onValueChange });

		expect(input).toHaveValue('(123');

		await user.click(input);
		await user.keyboard('4567890');

		expect(input).toHaveValue('(123) 456-7890');
		expect(onValueChange).toHaveBeenLastCalledWith('(123) 456-7890', '1234567890');
	});

	it('writes every change back through bind:value', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onValueBinding = vi.fn();
		const input = renderField({
			mode: 'controlled',
			mask: 'phone',
			onValueChange,
			onValueBinding
		});

		await user.type(input, '5551234567');

		expect(input).toHaveValue('(555) 123-4567');
		expect(onValueChange).toHaveBeenLastCalledWith('(555) 123-4567', '5551234567');
		expect(onValueBinding).toHaveBeenLastCalledWith('(555) 123-4567');
	});

	it('leaves the field where it was when a function binding declines the write', async () => {
		const user = userEvent.setup();
		const onDeclinedValue = vi.fn();
		const input = renderField({
			mode: 'function-binding',
			mask: 'phone',
			authoritative: '(555',
			onDeclinedValue
		});

		expect(input).toHaveValue('(555');

		await user.click(input);
		await user.keyboard('1');

		expect(onDeclinedValue).toHaveBeenCalledWith('(555) 1');
		expect(input).toHaveValue('(555');
	});

	it('applies masking and caret behaviour on a caller-supplied element', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const input = renderField({ mode: 'child', mask: 'phone', onValueChange });

		expect(input).toHaveAttribute('data-child-slot', 'mask-input');
		expect(input).toHaveAttribute('data-slot', 'mask-input');

		await user.type(input, '5551234567');
		expect(input).toHaveValue('(555) 123-4567');
		expect(onValueChange).toHaveBeenLastCalledWith('(555) 123-4567', '5551234567');

		input.setSelectionRange(10, 10);
		await user.keyboard('{Backspace}');
		expect(input).toHaveValue('(555) 124-567');
		expect(input.selectionStart).toBe(8);
	});

	it('submits the masked value with the surrounding form', async () => {
		const user = userEvent.setup();
		const onSubmitted = vi.fn();
		const input = renderField({ mode: 'form', mask: 'phone', name: 'phone', onSubmitted });

		await user.type(input, '5551234567');
		await user.click(screen.getByRole('button', { name: 'Submit' }));

		expect(onSubmitted).toHaveBeenCalledWith('(555) 123-4567');
	});
});
