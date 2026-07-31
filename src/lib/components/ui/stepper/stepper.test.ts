import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import {
	getStepperDataState,
	getStepperFocusIntent,
	getStepperId,
	STEPPER_ACTIVATION_MODES,
	STEPPER_DATA_STATES,
	STEPPER_ORIENTATIONS
} from './index.js';
import Harness, {
	STEPPER_HARNESS_STEPS,
	type StepperHarnessApi,
	type StepperHarnessPart,
	type StepperHarnessProps,
	type StepperHarnessStep
} from './stepper.test.svelte';

/**
 * Assertion floor — every `it` block of
 * `.reference/diceui/docs/registry/bases/radix/test/stepper.test.tsx`, in file order:
 *
 *  1. renders stepper with correct initial state            → "renders three steps…" (T006)
 *  2. changes step when clicking on trigger                 → "changes step when clicking…" (T006)
 *  3. navigates with next/previous buttons                  → "navigates one step per click" (T008)
 *  4. disables previous button on first step                → "disables Previous on the first…" (T008)
 *  5. disables next button on last step                     → "disables Next on the last step" (T008)
 *  6. supports keyboard navigation with arrow keys          → "moves focus and activation…" (T010)
 *  7. supports Home and End key navigation                  → "jumps to the first and last…" (T010)
 *  8. handles validation correctly                          → "runs the validator…" (T009)
 *  9. prevents navigation when validation fails             → "blocks the move…" (T009)
 * 10. supports manual activation mode                       → "does not activate on focus…" (T011)
 * 11. handles disabled steps correctly                      → "skips a disabled step" (T011)
 * 12. supports vertical orientation                         → "swaps the arrow axis…" (T010)
 * 13. supports loop navigation                              → "wraps in both directions…" (T010)
 * 14. renders step indicators with correct states           → "reports data-state…" (T006/T007)
 * 15. handles completed steps correctly                     → "marks an explicitly completed…" (T007)
 * 16. supports non-interactive mode                         → "ignores clicks and keys…" (T011)
 * 17. has proper ARIA attributes                            → "wires the documented ARIA…" (T012)
 * 18. supports custom step positions                        → "numbers every trigger…" (T012)
 *
 * Three of them are tightened on port (research R-14): #3 drops upstream's
 * `if (!nextButton.disabled)` branch, #8 drops the React-only `act()` wrapper, and #9 drops the
 * 100 ms wall-clock sleep in favour of `vi.waitFor`.
 */

const DISABLED_MIDDLE: readonly StepperHarnessStep[] = [
	{ value: 'step1', title: 'Step 1', description: 'First step' },
	{ value: 'step2', title: 'Step 2', description: 'Second step', disabled: true },
	{ value: 'step3', title: 'Step 3', description: 'Third step' }
];

/** Renders the harness and returns the imperative handle it publishes during initialisation. */
function renderStepper(props: StepperHarnessProps = {}): StepperHarnessApi {
	let api: StepperHarnessApi | undefined;
	render(Harness, { props: { ...props, registerApi: (value) => (api = value) } });
	if (!api) throw new Error('the stepper harness did not publish its API');
	return api;
}

function list(): HTMLElement {
	return screen.getByRole('tablist');
}

function tabs(): HTMLElement[] {
	return screen.getAllByRole('tab');
}

function tab(name: RegExp): HTMLElement {
	return screen.getByRole('tab', { name });
}

function tabIndexOf(element: HTMLElement): string | null {
	return element.getAttribute('tabindex');
}

// ---------------------------------------------------------------------------
// T017 — pure helpers (data-model §4)
// ---------------------------------------------------------------------------

describe('stepper helpers', () => {
	it('enumerates the documented unions', () => {
		expect(STEPPER_ORIENTATIONS).toEqual(['horizontal', 'vertical']);
		expect(STEPPER_ACTIVATION_MODES).toEqual(['automatic', 'manual']);
		expect(STEPPER_DATA_STATES).toEqual(['inactive', 'active', 'completed']);
	});

	it('builds every element id from the root id, the variant and the step value', () => {
		expect(getStepperId('root', 'trigger', 'step1')).toBe('root-trigger-step1');
		expect(getStepperId('root', 'content', 'step1')).toBe('root-content-step1');
		expect(getStepperId('root', 'title', 'step1')).toBe('root-title-step1');
		expect(getStepperId('root', 'description', 'step1')).toBe('root-description-step1');
	});

	it('derives the data state in upstream precedence order', () => {
		const keys = ['step1', 'step2', 'step3'];
		const completed = { value: 'step1', completed: true, disabled: false };
		const plain = { value: 'step1', completed: false, disabled: false };

		// An explicit `completed` flag wins over the active check.
		expect(getStepperDataState('step1', 'step1', completed, keys)).toBe('completed');
		expect(getStepperDataState('step1', 'step1', plain, keys)).toBe('active');
		// The separator of the active step is never filled.
		expect(getStepperDataState('step1', 'step1', plain, keys, 'separator')).toBe('inactive');
		// Anything before the active step is completed, anything after it is inactive.
		expect(getStepperDataState('step3', 'step1', plain, keys)).toBe('completed');
		expect(getStepperDataState('step1', 'step3', undefined, keys)).toBe('inactive');
		expect(getStepperDataState('', 'step1', undefined, keys)).toBe('inactive');
	});

	it('maps navigation keys to focus intents per axis and reading direction', () => {
		expect(getStepperFocusIntent('ArrowRight', 'horizontal')).toBe('next');
		expect(getStepperFocusIntent('ArrowLeft', 'horizontal')).toBe('prev');
		expect(getStepperFocusIntent('ArrowDown', 'horizontal')).toBeUndefined();
		expect(getStepperFocusIntent('ArrowUp', 'horizontal')).toBeUndefined();
		expect(getStepperFocusIntent('ArrowDown', 'vertical')).toBe('next');
		expect(getStepperFocusIntent('ArrowUp', 'vertical')).toBe('prev');
		expect(getStepperFocusIntent('ArrowRight', 'vertical')).toBeUndefined();
		expect(getStepperFocusIntent('Home', 'horizontal')).toBe('first');
		expect(getStepperFocusIntent('PageUp', 'horizontal')).toBe('first');
		expect(getStepperFocusIntent('End', 'horizontal')).toBe('last');
		expect(getStepperFocusIntent('PageDown', 'horizontal')).toBe('last');
		expect(getStepperFocusIntent('Enter', 'horizontal')).toBeUndefined();
		// Only the horizontal pair inverts under `rtl`.
		expect(getStepperFocusIntent('ArrowLeft', 'horizontal', 'rtl')).toBe('next');
		expect(getStepperFocusIntent('ArrowRight', 'horizontal', 'rtl')).toBe('prev');
		expect(getStepperFocusIntent('ArrowDown', 'vertical', 'rtl')).toBe('next');
	});
});

// ---------------------------------------------------------------------------
// T006 — initial state, click navigation, controlled vs uncontrolled (US1)
// ---------------------------------------------------------------------------

describe('Stepper core step tracking (T006, US1)', () => {
	it('renders three steps and only the seeded step content', () => {
		renderStepper({ defaultValue: 'step1' });

		expect(screen.getByText('Step 1')).toBeInTheDocument();
		expect(screen.getByText('Step 2')).toBeInTheDocument();
		expect(screen.getByText('Step 3')).toBeInTheDocument();
		expect(screen.getByText('Content for Step 1')).toBeInTheDocument();
		expect(screen.queryByText('Content for Step 2')).not.toBeInTheDocument();
		expect(screen.queryByText('Content for Step 3')).not.toBeInTheDocument();
	});

	it('reports data-state and ARIA for the completed, active and upcoming steps', () => {
		renderStepper({ defaultValue: 'step2' });

		const [first, second, third] = tabs();

		expect(second).toHaveAttribute('aria-current', 'step');
		expect(second).toHaveAttribute('aria-selected', 'true');
		expect(second).toHaveAttribute('data-state', 'active');
		expect(first).toHaveAttribute('data-state', 'completed');
		expect(first).toHaveAttribute('aria-selected', 'false');
		expect(first).not.toHaveAttribute('aria-current');
		expect(third).toHaveAttribute('data-state', 'inactive');
		expect(screen.getByTestId('item-step2')).toHaveAttribute('data-state', 'active');
	});

	it('changes step when clicking on a trigger', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step1', onValueChange });

		await user.click(tab(/step 2/i));

		expect(onValueChange).toHaveBeenCalledWith('step2');
		expect(screen.getByText('Content for Step 2')).toBeInTheDocument();
		expect(screen.queryByText('Content for Step 1')).not.toBeInTheDocument();
		expect(tabs()[1]).toHaveAttribute('data-state', 'active');
	});

	it('does not fire onValueChange when the active step is re-clicked', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step1', onValueChange });

		await user.click(tab(/step 1/i));

		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('lets a bound parent drive the active step in controlled mode', async () => {
		const api = renderStepper({ binding: 'value', initialValue: 'step1' });

		expect(tabs()[0]).toHaveAttribute('data-state', 'active');

		api.setValue('step3');
		await tick();

		expect(tabs()[2]).toHaveAttribute('data-state', 'active');
		expect(screen.getByText('Content for Step 3')).toBeInTheDocument();
	});

	it('does not move on its own when an authoritative parent declines the write', async () => {
		const user = userEvent.setup();
		const onDeclinedValue = vi.fn();
		renderStepper({ binding: 'function', authoritativeValue: 'step1', onDeclinedValue });

		await user.click(tab(/step 2/i));

		expect(onDeclinedValue).toHaveBeenCalledWith('step2');
		expect(tabs()[0]).toHaveAttribute('data-state', 'active');
		expect(screen.getByText('Content for Step 1')).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// T007 — indicators and completed steps (US1)
// ---------------------------------------------------------------------------

describe('Stepper indicators (T007, US1)', () => {
	it('shows the 1-based position for inactive and active steps', () => {
		renderStepper({ defaultValue: 'step2' });

		expect(screen.getByTestId('indicator-step2')).toHaveTextContent('2');
		expect(screen.getByTestId('indicator-step3')).toHaveTextContent('3');
		expect(screen.getByTestId('indicator-step2')).toHaveAttribute('data-state', 'active');
		expect(screen.getByTestId('indicator-step3')).toHaveAttribute('data-state', 'inactive');
	});

	it('shows a check icon instead of the position for a completed step', () => {
		renderStepper({ defaultValue: 'step2' });

		const indicator = screen.getByTestId('indicator-step1');

		expect(indicator).toHaveAttribute('data-state', 'completed');
		expect(indicator).not.toHaveTextContent('1');
		expect(indicator.querySelector('svg')).not.toBeNull();
	});

	it('hands the current data state to a children snippet', () => {
		renderStepper({ defaultValue: 'step2', withIndicatorSnippet: true });

		expect(screen.getByTestId('indicator-state-step1')).toHaveTextContent('completed');
		expect(screen.getByTestId('indicator-state-step2')).toHaveTextContent('active');
		expect(screen.getByTestId('indicator-state-step3')).toHaveTextContent('inactive');
	});

	it('marks an explicitly completed step completed even when it sits after the active one', () => {
		renderStepper({
			defaultValue: 'step1',
			steps: [
				{ value: 'step1', title: 'Step 1' },
				{ value: 'step2', title: 'Step 2', completed: true },
				{ value: 'step3', title: 'Step 3' }
			]
		});

		expect(tab(/step 2/i)).toHaveAttribute('data-state', 'completed');
		expect(tab(/step 1/i)).toHaveAttribute('data-state', 'active');
	});

	it('keeps a completed step completed while a later step is active', () => {
		renderStepper({
			defaultValue: 'step2',
			steps: [
				{ value: 'step1', title: 'Step 1', completed: true },
				{ value: 'step2', title: 'Step 2' }
			]
		});

		expect(tab(/step 1/i)).toHaveAttribute('data-state', 'completed');
	});
});

// ---------------------------------------------------------------------------
// T008 — Previous / Next (US2)
// ---------------------------------------------------------------------------

describe('Stepper previous and next (T008, US2)', () => {
	it('disables Previous on the first step', () => {
		renderStepper({ defaultValue: 'step1' });

		expect(screen.getByTestId('prev')).toBeDisabled();
		expect(screen.getByTestId('next')).not.toBeDisabled();
	});

	it('disables Next on the last step', () => {
		renderStepper({ defaultValue: 'step3' });

		expect(screen.getByTestId('next')).toBeDisabled();
		expect(screen.getByTestId('prev')).not.toBeDisabled();
	});

	it('navigates one step per click in each direction', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step1', onValueChange });

		await user.click(screen.getByTestId('next'));

		expect(onValueChange).toHaveBeenLastCalledWith('step2');
		expect(tabs()[1]).toHaveAttribute('data-state', 'active');
		expect(screen.getByTestId('prev')).not.toBeDisabled();

		await user.click(screen.getByTestId('prev'));

		expect(onValueChange).toHaveBeenLastCalledWith('step1');
		expect(tabs()[0]).toHaveAttribute('data-state', 'active');
	});

	it('disables both controls when a single step is registered', () => {
		renderStepper({ defaultValue: 'step1', steps: [{ value: 'step1', title: 'Step 1' }] });

		expect(screen.getByTestId('prev')).toBeDisabled();
		expect(screen.getByTestId('next')).toBeDisabled();
	});

	it('disables both controls when no step is registered', () => {
		renderStepper({ defaultValue: '', steps: [] });

		expect(screen.getByTestId('prev')).toBeDisabled();
		expect(screen.getByTestId('next')).toBeDisabled();
	});
});

// ---------------------------------------------------------------------------
// T009 — validation (US3)
// ---------------------------------------------------------------------------

describe('Stepper validation (T009, US3)', () => {
	it('runs the validator for a forward move and commits when it resolves true', async () => {
		const user = userEvent.setup();
		const onValidate = vi.fn().mockResolvedValue(true);
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step1', onValidate, onValueChange });

		await user.click(tab(/step 2/i));

		await vi.waitFor(() => {
			expect(onValidate).toHaveBeenCalledWith('step2', 'next');
			expect(onValueChange).toHaveBeenCalledWith('step2');
		});
	});

	it('blocks the move when the validator resolves false', async () => {
		const user = userEvent.setup();
		const onValidate = vi.fn().mockResolvedValue(false);
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step1', onValidate, onValueChange });

		await user.click(tab(/step 2/i));

		await vi.waitFor(() => expect(onValidate).toHaveBeenCalledWith('step2', 'next'));

		expect(onValueChange).not.toHaveBeenCalled();
		expect(tabs()[0]).toHaveAttribute('data-state', 'active');
		expect(screen.getByText('Content for Step 1')).toBeInTheDocument();
	});

	it('treats a rejected validator like a false one', async () => {
		const user = userEvent.setup();
		const onValidate = vi.fn().mockRejectedValue(new Error('invalid'));
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step1', onValidate, onValueChange });

		await user.click(tab(/step 2/i));

		await vi.waitFor(() => expect(onValidate).toHaveBeenCalledWith('step2', 'next'));

		expect(onValueChange).not.toHaveBeenCalled();
		expect(tabs()[0]).toHaveAttribute('data-state', 'active');
	});

	it('treats a synchronously throwing validator like a false one', async () => {
		const user = userEvent.setup();
		const onValidate = vi.fn(() => {
			throw new Error('invalid');
		});
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step1', onValidate, onValueChange });

		await user.click(tab(/step 2/i));

		await vi.waitFor(() => expect(onValidate).toHaveBeenCalled());

		expect(onValueChange).not.toHaveBeenCalled();
		expect(tabs()[0]).toHaveAttribute('data-state', 'active');
	});

	it('never validates a backward trigger click', async () => {
		const user = userEvent.setup();
		const onValidate = vi.fn().mockResolvedValue(false);
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step3', onValidate, onValueChange });

		await user.click(tab(/step 1/i));

		expect(onValidate).not.toHaveBeenCalled();
		expect(onValueChange).toHaveBeenCalledWith('step1');
		expect(tabs()[0]).toHaveAttribute('data-state', 'active');
	});

	it('never validates Stepper.Prev', async () => {
		const user = userEvent.setup();
		const onValidate = vi.fn().mockResolvedValue(false);
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step2', onValidate, onValueChange });

		await user.click(screen.getByTestId('prev'));

		expect(onValidate).not.toHaveBeenCalled();
		expect(onValueChange).toHaveBeenCalledWith('step1');
	});

	it('routes Stepper.Next through the validator', async () => {
		const user = userEvent.setup();
		const onValidate = vi.fn().mockResolvedValue(false);
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step1', onValidate, onValueChange });

		await user.click(screen.getByTestId('next'));

		await vi.waitFor(() => expect(onValidate).toHaveBeenCalledWith('step2', 'next'));

		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('discards a stale validation result when the controlled value moves first', async () => {
		const user = userEvent.setup();
		let settle: ((valid: boolean) => void) | undefined;
		const onValidate = vi.fn(
			() =>
				new Promise<boolean>((resolve) => {
					settle = resolve;
				})
		);
		const onValueChange = vi.fn();
		const api = renderStepper({
			binding: 'value',
			initialValue: 'step1',
			onValidate,
			onValueChange
		});

		await user.click(tab(/step 3/i));
		await vi.waitFor(() => expect(onValidate).toHaveBeenCalledWith('step3', 'next'));

		// The consumer replaces the value while validation is still in flight.
		api.setValue('step2');
		await tick();

		settle?.(true);
		await vi.waitFor(() => expect(tabs()[1]).toHaveAttribute('data-state', 'active'));

		expect(onValueChange).not.toHaveBeenCalled();
		expect(tabs()[2]).toHaveAttribute('data-state', 'inactive');
	});
});

// ---------------------------------------------------------------------------
// T010 — keyboard navigation and roving focus
// ---------------------------------------------------------------------------

describe('Stepper keyboard navigation (T010)', () => {
	it('moves focus and activation with the horizontal arrows', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step1', onValueChange });

		tabs()[0].focus();
		await user.keyboard('{ArrowRight}');

		expect(tabs()[1]).toHaveFocus();
		expect(onValueChange).toHaveBeenCalledWith('step2');

		await user.keyboard('{ArrowLeft}');

		expect(tabs()[0]).toHaveFocus();
		expect(onValueChange).toHaveBeenLastCalledWith('step1');
	});

	it('ignores the vertical arrows in horizontal orientation', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step1', onValueChange });

		tabs()[0].focus();
		await user.keyboard('{ArrowDown}');
		await user.keyboard('{ArrowUp}');

		expect(tabs()[0]).toHaveFocus();
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('swaps the arrow axis in vertical orientation', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step1', orientation: 'vertical', onValueChange });

		expect(list()).toHaveAttribute('aria-orientation', 'vertical');
		expect(list()).toHaveAttribute('data-orientation', 'vertical');

		tabs()[0].focus();
		await user.keyboard('{ArrowDown}');

		expect(tabs()[1]).toHaveFocus();
		expect(onValueChange).toHaveBeenCalledWith('step2');

		await user.keyboard('{ArrowRight}');

		expect(tabs()[1]).toHaveFocus();
	});

	it('jumps to the first and last steps with Home, End, PageUp and PageDown', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step2', onValueChange });

		tabs()[1].focus();
		await user.keyboard('{Home}');

		expect(tabs()[0]).toHaveFocus();
		expect(onValueChange).toHaveBeenLastCalledWith('step1');

		await user.keyboard('{End}');

		expect(tabs()[2]).toHaveFocus();
		expect(onValueChange).toHaveBeenLastCalledWith('step3');

		await user.keyboard('{PageUp}');

		expect(tabs()[0]).toHaveFocus();

		await user.keyboard('{PageDown}');

		expect(tabs()[2]).toHaveFocus();
	});

	it('inverts the horizontal arrows under a right-to-left provider', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderStepper({
			mode: 'rtl-provider',
			providerDir: 'rtl',
			defaultValue: 'step1',
			onValueChange
		});

		tabs()[0].focus();
		await user.keyboard('{ArrowLeft}');

		expect(tabs()[1]).toHaveFocus();
		expect(onValueChange).toHaveBeenCalledWith('step2');

		await user.keyboard('{ArrowRight}');

		expect(tabs()[0]).toHaveFocus();
		expect(onValueChange).toHaveBeenLastCalledWith('step1');
	});

	it('wraps in both directions with loop', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step3', loop: true, onValueChange });

		tabs()[2].focus();
		await user.keyboard('{ArrowRight}');

		expect(tabs()[0]).toHaveFocus();
		expect(onValueChange).toHaveBeenLastCalledWith('step1');

		await user.keyboard('{ArrowLeft}');

		expect(tabs()[2]).toHaveFocus();
		expect(onValueChange).toHaveBeenLastCalledWith('step3');
	});

	it('stops at the ends without loop', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step3', onValueChange });

		tabs()[2].focus();
		await user.keyboard('{ArrowRight}');

		expect(tabs()[2]).toHaveFocus();
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('leaves navigation alone while a modifier is held', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step1', onValueChange });

		tabs()[0].focus();
		await user.keyboard('{Shift>}{ArrowRight}{/Shift}');

		expect(tabs()[0]).toHaveFocus();
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('keeps exactly one trigger in the tab order once the group is entered', async () => {
		const user = userEvent.setup();
		renderStepper({ defaultValue: 'step1' });

		tabs()[0].focus();
		await tick();

		expect(tabs().filter((trigger) => tabIndexOf(trigger) === '0')).toHaveLength(1);
		expect(tabIndexOf(tabs()[0])).toBe('0');

		await user.keyboard('{ArrowRight}');
		await tick();

		expect(tabs().filter((trigger) => tabIndexOf(trigger) === '0')).toHaveLength(1);
		expect(tabIndexOf(tabs()[1])).toBe('0');
	});

	it('runs a caller keydown handler before its own', async () => {
		const user = userEvent.setup();
		const onTriggerKeydown = vi.fn();
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step1', onTriggerKeydown, onValueChange });

		tabs()[0].focus();
		await user.keyboard('{ArrowRight}');

		expect(onTriggerKeydown).toHaveBeenCalled();
		expect(onValueChange).toHaveBeenCalledWith('step2');
	});
});

// ---------------------------------------------------------------------------
// T010a — Tab entry focus and the group tab stop
// ---------------------------------------------------------------------------

describe('Stepper tab entry focus (T010a)', () => {
	it('exposes the list as the group’s single tab stop', () => {
		renderStepper({ defaultValue: 'step1' });

		expect(tabIndexOf(list())).toBe('0');
		for (const trigger of tabs()) {
			expect(tabIndexOf(trigger)).toBe('-1');
		}
	});

	it('lands entry focus on the trigger of the current step', async () => {
		const user = userEvent.setup();
		renderStepper({ defaultValue: 'step2', withSiblings: true });

		screen.getByTestId('before').focus();
		await user.tab();

		expect(tabs()[1]).toHaveFocus();
	});

	it('latches the list out of the tab order on Shift+Tab and restores it on focusout', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step1', withSiblings: true, onValueChange });

		tabs()[0].focus();
		await fireEvent.keyDown(tabs()[0], { key: 'Tab', shiftKey: true });

		expect(tabIndexOf(list())).toBe('-1');
		expect(onValueChange).not.toHaveBeenCalled();

		// With the list no longer tabbable, the browser's own Shift+Tab leaves the group entirely.
		await user.tab({ shift: true });

		expect(screen.getByTestId('before')).toHaveFocus();
		await tick();

		expect(tabIndexOf(list())).toBe('0');
	});

	it('drops the list out of the tab order when every step is disabled', () => {
		renderStepper({
			defaultValue: 'step1',
			steps: STEPPER_HARNESS_STEPS.map((step) => ({ ...step, disabled: true }))
		});

		expect(tabIndexOf(list())).toBe('-1');
	});
});

// ---------------------------------------------------------------------------
// T011 — activation modes and guard rails
// ---------------------------------------------------------------------------

describe('Stepper activation modes and guards (T011)', () => {
	it('does not activate on focus in manual mode, and activates on Enter', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step1', activationMode: 'manual', onValueChange });

		tabs()[1].focus();

		expect(onValueChange).not.toHaveBeenCalled();

		await user.keyboard('{Enter}');

		expect(onValueChange).toHaveBeenCalledWith('step2');
	});

	it('activates with Space in manual mode', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step1', activationMode: 'manual', onValueChange });

		tabs()[2].focus();
		await user.keyboard('[Space]');

		expect(onValueChange).toHaveBeenCalledWith('step3');
	});

	it('moves focus without activating in manual mode', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step1', activationMode: 'manual', onValueChange });

		tabs()[0].focus();
		await user.keyboard('{ArrowRight}');

		expect(tabs()[1]).toHaveFocus();
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('ignores clicks and keys in non-interactive mode but follows the bound value', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const api = renderStepper({
			binding: 'value',
			initialValue: 'step1',
			nonInteractive: true,
			onValueChange
		});

		await user.click(tab(/step 2/i));

		expect(onValueChange).not.toHaveBeenCalled();

		tabs()[1].focus();
		await user.keyboard('{Enter}');

		expect(onValueChange).not.toHaveBeenCalled();
		expect(tabs()[0]).toHaveAttribute('data-state', 'active');

		api.setValue('step3');
		await tick();

		expect(tabs()[2]).toHaveAttribute('data-state', 'active');
	});

	it('skips a disabled step', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step1', steps: DISABLED_MIDDLE, onValueChange });

		expect(tab(/step 2/i)).toBeDisabled();
		expect(screen.getByTestId('item-step2')).toHaveAttribute('data-disabled', '');

		await user.click(tab(/step 2/i));

		expect(onValueChange).not.toHaveBeenCalled();

		tabs()[0].focus();
		await user.keyboard('{ArrowRight}');

		expect(tabs()[2]).toHaveFocus();
		expect(onValueChange).toHaveBeenCalledWith('step3');
	});

	it('disables every trigger when the root is disabled', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderStepper({ defaultValue: 'step1', disabled: true, onValueChange });

		expect(screen.getByTestId('root')).toHaveAttribute('data-disabled', '');
		for (const trigger of tabs()) {
			expect(trigger).toBeDisabled();
		}

		await user.click(tabs()[1]);

		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('leaves the other triggers enabled when only one step is disabled', () => {
		renderStepper({ defaultValue: 'step1', steps: DISABLED_MIDDLE });

		expect(screen.getByTestId('root')).not.toHaveAttribute('data-disabled');
		expect(tabs()[0]).not.toBeDisabled();
		expect(tabs()[1]).toBeDisabled();
		expect(tabs()[2]).not.toBeDisabled();
	});
});

// ---------------------------------------------------------------------------
// T012 — ARIA wiring and step positions
// ---------------------------------------------------------------------------

describe('Stepper accessibility (T012)', () => {
	it('wires the documented ARIA attributes', () => {
		renderStepper({ defaultValue: 'step1' });

		expect(list()).toHaveAttribute('aria-orientation', 'horizontal');

		const panels = screen.getAllByRole('tabpanel');

		expect(panels).toHaveLength(1);
		expect(panels[0]).toHaveAttribute('aria-labelledby', tabs()[0].id);
		expect(tabs()[0]).toHaveAttribute('aria-controls', panels[0].id);
	});

	it('numbers every trigger with its position in the set', () => {
		renderStepper({ defaultValue: 'step1' });

		tabs().forEach((trigger, index) => {
			expect(trigger).toHaveAttribute('aria-posinset', String(index + 1));
			expect(trigger).toHaveAttribute('aria-setsize', '3');
		});
	});

	it('re-indexes the remaining triggers when a step unmounts', async () => {
		const api = renderStepper({ defaultValue: 'step1' });

		api.setSteps([
			{ value: 'step1', title: 'Step 1' },
			{ value: 'step3', title: 'Step 3' }
		]);
		await tick();

		const remaining = tabs();

		expect(remaining).toHaveLength(2);
		expect(remaining[0]).toHaveAttribute('aria-posinset', '1');
		expect(remaining[1]).toHaveAttribute('aria-posinset', '2');
		expect(remaining[1]).toHaveAttribute('aria-setsize', '2');
	});

	it('describes the trigger by its title and description ids even when neither renders', () => {
		renderStepper({
			defaultValue: 'step1',
			id: 'stepper',
			withTitle: false,
			withDescription: false
		});

		expect(tabs()[0]).toHaveAttribute('id', 'stepper-trigger-step1');
		expect(tabs()[0]).toHaveAttribute(
			'aria-describedby',
			'stepper-title-step1 stepper-description-step1'
		);
	});

	it('gives the title and description the ids the trigger points at', () => {
		renderStepper({ defaultValue: 'step1', id: 'stepper' });

		expect(screen.getByText('Step 1')).toHaveAttribute('id', 'stepper-title-step1');
		expect(screen.getByText('First step')).toHaveAttribute('id', 'stepper-description-step1');
		expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'stepper-content-step1');
	});
});

// ---------------------------------------------------------------------------
// T013 — provider guard rails
// ---------------------------------------------------------------------------

describe('Stepper provider guard rails (T013)', () => {
	const ROOT_SCOPED: readonly StepperHarnessPart[] = ['List', 'Item', 'Content', 'Prev', 'Next'];
	const ITEM_SCOPED: readonly StepperHarnessPart[] = [
		'Trigger',
		'Indicator',
		'Separator',
		'Title',
		'Description'
	];

	for (const part of ROOT_SCOPED) {
		it(`throws when <Stepper.${part}> is used outside <Stepper.Root>`, () => {
			expect(() => render(Harness, { props: { mode: 'bare-part', barePart: part } })).toThrowError(
				new RegExp(`\`<Stepper\\.${part}>\` must be used within \`<Stepper\\.Root>\``)
			);
		});
	}

	for (const part of ITEM_SCOPED) {
		it(`throws when <Stepper.${part}> is used outside <Stepper.Item>`, () => {
			expect(() => render(Harness, { props: { mode: 'bare-part', barePart: part } })).toThrowError(
				new RegExp(`\`<Stepper\\.${part}>\` must be used within \`<Stepper\\.Item>\``)
			);
		});
	}

	it('throws when <Stepper.Trigger> is used outside <Stepper.List>', () => {
		expect(() =>
			render(Harness, { props: { mode: 'bare-part', barePart: 'TriggerOutsideList' } })
		).toThrowError(/`<Stepper\.Trigger>` must be used within `<Stepper\.List>`/);
	});
});

// ---------------------------------------------------------------------------
// T014 — child snippets and refs
// ---------------------------------------------------------------------------

describe('Stepper child snippets and refs (T014)', () => {
	it('renders the caller element for the root child snippet', () => {
		renderStepper({ mode: 'root-child', defaultValue: 'step1' });

		const element = screen.getByTestId('root-child');

		expect(element).toHaveAttribute('data-slot', 'stepper');
		expect(element).toHaveAttribute('data-orientation', 'horizontal');
		expect(element.tagName).toBe('SECTION');
	});

	it('hands the merged trigger props to the child snippet without registering it', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const api = renderStepper({ mode: 'trigger-child', defaultValue: 'step1', onValueChange });

		const element = screen.getByTestId('trigger-child');

		expect(element).toHaveAttribute('data-slot', 'stepper-trigger');
		expect(element).toHaveAttribute('data-state', 'active');
		expect(element).toHaveAttribute('role', 'tab');
		// The caller owns the element, so the trigger cannot self-register for roving focus.
		expect(api.getRefs().trigger).toBeNull();

		// Focus starts on the second trigger; the unregistered one is not a navigation candidate.
		tabs()[1].focus();
		await user.keyboard('{ArrowLeft}');

		expect(tabs()[1]).toHaveFocus();
		expect(onValueChange).toHaveBeenLastCalledWith('step2');
	});

	it('renders the caller element for the indicator, prev and next child snippets', () => {
		renderStepper({ mode: 'indicator-child', defaultValue: 'step1' });

		expect(screen.getByTestId('indicator-child')).toHaveAttribute('data-slot', 'stepper-indicator');
		expect(screen.getByTestId('indicator-child')).toHaveAttribute('data-state', 'active');
	});

	it('disables the prev child element on the first step', () => {
		renderStepper({ mode: 'prev-child', defaultValue: 'step1' });

		const element = screen.getByTestId('prev-child');

		expect(element).toHaveAttribute('data-slot', 'stepper-prev');
		expect(element).toBeDisabled();
	});

	it('moves forward through the next child element', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderStepper({ mode: 'next-child', defaultValue: 'step1', onValueChange });

		const element = screen.getByTestId('next-child');

		expect(element).toHaveAttribute('data-slot', 'stepper-next');

		await user.click(element);

		expect(onValueChange).toHaveBeenCalledWith('step2');
	});

	it('exposes every part through bind:ref in default mode', () => {
		const refs = renderStepper({ defaultValue: 'step1' }).getRefs();

		expect(refs.root).toHaveAttribute('data-slot', 'stepper');
		expect(refs.list).toHaveAttribute('data-slot', 'stepper-list');
		expect(refs.item).toHaveAttribute('data-slot', 'stepper-item');
		expect(refs.trigger).toHaveAttribute('data-slot', 'stepper-trigger');
		expect(refs.indicator).toHaveAttribute('data-slot', 'stepper-indicator');
		expect(refs.separator).toHaveAttribute('data-slot', 'stepper-separator');
		expect(refs.title).toHaveAttribute('data-slot', 'stepper-title');
		expect(refs.description).toHaveAttribute('data-slot', 'stepper-description');
		expect(refs.content).toHaveAttribute('data-slot', 'stepper-content');
		expect(refs.prev).toHaveAttribute('data-slot', 'stepper-prev');
		expect(refs.next).toHaveAttribute('data-slot', 'stepper-next');
	});
});

// ---------------------------------------------------------------------------
// T015 — separator placement and forceMount
// ---------------------------------------------------------------------------

describe('Stepper separator and forceMount (T015)', () => {
	it('renders a separator between adjacent steps only', () => {
		renderStepper({ defaultValue: 'step1' });

		expect(screen.getByTestId('separator-step1')).toBeInTheDocument();
		expect(screen.getByTestId('separator-step2')).toBeInTheDocument();
		expect(screen.queryByTestId('separator-step3')).not.toBeInTheDocument();
	});

	it('keeps the trailing separator mounted with forceMount', () => {
		renderStepper({ defaultValue: 'step1', separatorForceMount: true });

		expect(screen.getByTestId('separator-step3')).toBeInTheDocument();
	});

	it('never fills the separator of the active step', () => {
		renderStepper({ defaultValue: 'step2' });

		expect(screen.getByTestId('separator-step1')).toHaveAttribute('data-state', 'completed');
		expect(screen.getByTestId('separator-step2')).toHaveAttribute('data-state', 'inactive');
		expect(screen.getByTestId('separator-step1')).toHaveAttribute('data-orientation', 'horizontal');
		expect(screen.getByTestId('separator-step1')).toHaveAttribute('aria-hidden', 'true');
	});

	it('keeps inactive content mounted with forceMount', () => {
		renderStepper({ defaultValue: 'step1', contentForceMount: true });

		expect(screen.getAllByRole('tabpanel')).toHaveLength(3);
		expect(screen.getByText('Content for Step 2')).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// T015a — step registry callbacks
// ---------------------------------------------------------------------------

describe('Stepper step registry callbacks (T015a)', () => {
	it('fires onValueAdd once per item on mount, in document order', () => {
		const onValueAdd = vi.fn();
		renderStepper({ defaultValue: 'step1', onValueAdd });

		expect(onValueAdd).toHaveBeenCalledTimes(3);
		expect(onValueAdd.mock.calls.map((call) => call[0])).toEqual(['step1', 'step2', 'step3']);
	});

	it('fires onValueRemove when an item unmounts', async () => {
		const onValueRemove = vi.fn();
		const api = renderStepper({ defaultValue: 'step1', onValueRemove });

		expect(onValueRemove).not.toHaveBeenCalled();

		api.setSteps([
			{ value: 'step1', title: 'Step 1' },
			{ value: 'step3', title: 'Step 3' }
		]);
		await tick();

		expect(onValueRemove).toHaveBeenCalledWith('step2');
		expect(onValueRemove).toHaveBeenCalledTimes(1);
	});

	it('fires onValueComplete only when a step’s completed flag flips', async () => {
		const onValueComplete = vi.fn();
		const api = renderStepper({ defaultValue: 'step1', onValueComplete });

		expect(onValueComplete).not.toHaveBeenCalled();

		api.setCompleted('step2', true);
		await tick();

		expect(onValueComplete).toHaveBeenCalledWith('step2', true);
		expect(onValueComplete).toHaveBeenCalledTimes(1);

		// A registry update that leaves `completed` untouched must stay silent.
		api.setDisabled('step2', true);
		await tick();

		expect(onValueComplete).toHaveBeenCalledTimes(1);
		expect(tabs()[1]).toBeDisabled();

		api.setCompleted('step2', false);
		await tick();

		expect(onValueComplete).toHaveBeenLastCalledWith('step2', false);
		expect(onValueComplete).toHaveBeenCalledTimes(2);
	});
});

// ---------------------------------------------------------------------------
// T038 — the item's documented `data-orientation` (SC-002)
// ---------------------------------------------------------------------------

describe('Stepper item orientation (T038)', () => {
	function itemOrientations(): (string | null)[] {
		return STEPPER_HARNESS_STEPS.map((step) =>
			screen.getByTestId(`item-${step.value}`).getAttribute('data-orientation')
		);
	}

	it('marks every item horizontal by default', () => {
		renderStepper({ defaultValue: 'step1' });

		expect(itemOrientations()).toEqual(['horizontal', 'horizontal', 'horizontal']);
	});

	it('mirrors a vertical root orientation onto every item', () => {
		renderStepper({ defaultValue: 'step1', orientation: 'vertical' });

		expect(itemOrientations()).toEqual(['vertical', 'vertical', 'vertical']);
	});
});
