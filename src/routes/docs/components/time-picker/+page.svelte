<script lang="ts">
	import { ComponentPreview } from '$lib/components/docs/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as TimePicker from '$lib/components/ui/time-picker/index.js';
	import { toast } from 'svelte-sonner';

	// --- Controlled state ----------------------------------------------------
	let controlled = $state('14:30');

	// --- With form -----------------------------------------------------------
	// Upstream drives this example with react-hook-form + zod; neither has a Svelte analogue in this
	// repo, so the single rule — an appointment time is required — is a few lines of rune state.
	let appointmentTime = $state('09:00');
	let submitted = $state(false);

	const timeError = $derived(
		submitted && appointmentTime === '' ? 'Please select an appointment time.' : undefined
	);

	function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitted = true;

		if (appointmentTime === '') return;

		toast.success(`Appointment scheduled for: ${appointmentTime}`);
	}

	const rootProps = [
		{
			prop: 'value',
			type: 'string',
			default: '—',
			description:
				'Bindable 24-hour value — "HH:mm", or "HH:mm:ss" when showSeconds. An unset segment serialises as "--"; "" means nothing is set.'
		},
		{
			prop: 'defaultValue',
			type: 'string',
			default: "''",
			description: 'Seeds the value once when uncontrolled.'
		},
		{
			prop: 'onValueChange',
			type: '(value: string) => void',
			default: '—',
			description: 'Called on every actual change, in both controlled and uncontrolled modes.'
		},
		{
			prop: 'open',
			type: 'boolean',
			default: '—',
			description: 'Bindable open state of the dropdown.'
		},
		{
			prop: 'defaultOpen',
			type: 'boolean',
			default: 'false',
			description: 'Seeds the open state once when uncontrolled.'
		},
		{
			prop: 'onOpenChange',
			type: '(open: boolean) => void',
			default: '—',
			description: 'Called whenever the dropdown opens or closes.'
		},
		{
			prop: 'openOnFocus',
			type: 'boolean',
			default: 'false',
			description: 'Opens the dropdown when a segment is focused, without stealing the caret.'
		},
		{
			prop: 'inputGroupClickAction',
			type: "'focus' | 'open'",
			default: "'focus'",
			description: 'What a click on empty input-group space does.'
		},
		{
			prop: 'min / max',
			type: 'string',
			default: '—',
			description: 'Accepted for upstream parity and readable from the context, but not enforced.'
		},
		{
			prop: 'hourStep / minuteStep / secondStep',
			type: 'number',
			default: '1',
			description: 'The arrow-key increment and the matching dropdown column granularity.'
		},
		{
			prop: 'segmentPlaceholder',
			type: 'string | { hour?; minute?; second?; period? }',
			default: "'--'",
			description:
				'What an unset segment shows. Its length also drives that segment’s --time-picker-*-input-width.'
		},
		{
			prop: 'locale',
			type: 'string',
			default: 'the runtime locale',
			description:
				'Decides 12-hour versus 24-hour display through Intl — never a locale table. The stored value stays 24-hour.'
		},
		{
			prop: 'dir',
			type: "'ltr' | 'rtl'",
			default: 'DirectionProvider, else DOM [dir], else ltr',
			description:
				'Added here: horizontal arrows invert under rtl, between segments and between columns alike.'
		},
		{
			prop: 'name',
			type: 'string',
			default: '—',
			description: 'Field name of the hidden input rendered inside a form.'
		},
		{
			prop: 'disabled',
			type: 'boolean',
			default: 'false',
			description: 'Disables every segment, the trigger and Clear, and sets [data-disabled].'
		},
		{
			prop: 'readOnly',
			type: 'boolean',
			default: 'false',
			description:
				'Keeps segments focusable but immutable, makes Clear and dropdown selection no-ops, and sets [data-readonly].'
		},
		{
			prop: 'required',
			type: 'boolean',
			default: 'false',
			description: 'Mirrored onto the hidden form input.'
		},
		{
			prop: 'invalid',
			type: 'boolean',
			default: 'false',
			description: 'Sets [data-invalid] on the root, group, trigger and segments.'
		},
		{
			prop: 'showSeconds',
			type: 'boolean',
			default: 'false',
			description:
				'Serialises "HH:mm:ss" rather than "HH:mm", and backfills the second on blur. It does not render the second column — compose TimePicker.Second for that.'
		},
		{
			prop: 'id',
			type: 'string',
			default: '$props.id()',
			description: 'Seeds the input group, label and trigger ids.'
		},
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered root element.'
		},
		{
			prop: 'class',
			type: 'string',
			default: '—',
			description: 'Merged last through cn(), so a caller can always override the layout.'
		},
		{
			prop: 'children / child',
			type: 'Snippet',
			default: '—',
			description:
				'child renders the picker onto your own element and replaces upstream’s asChild; ref stays null in that mode and the props carry an attachment that keeps form detection working.'
		}
	];

	const partProps = [
		{
			part: 'TimePicker.Label',
			description:
				'label with id={labelId} and for={inputGroupId}, so the group actually resolves an accessible name.'
		},
		{
			part: 'TimePicker.InputGroup',
			description:
				'div[role=group] carrying the four --time-picker-*-input-width variables, the popover anchor, and the click policy.'
		},
		{
			part: 'TimePicker.Input',
			description:
				'One always-editable segment. Requires segment="hour" | "minute" | "second" | "period"; takes its own disabled / readOnly, OR-ed with the root’s, and defaults aria-label to the segment name.'
		},
		{
			part: 'TimePicker.Separator',
			description: 'span[aria-hidden] whose children default to ":".'
		},
		{
			part: 'TimePicker.Trigger',
			description:
				'Popover trigger; children default to a clock icon. Carries data-state, aria-expanded and aria-controls from bits-ui.'
		},
		{
			part: 'TimePicker.Content',
			description:
				'Popover content anchored on the input group, defaulting to side="bottom" align="start" sideOffset={6}.'
		},
		{
			part: 'TimePicker.Column / ColumnItem',
			description:
				'The generic column and its items, exported here so you can build a column the generated ones do not cover. ColumnItem takes value, selected and format.'
		},
		{
			part: 'TimePicker.Hour / Minute / Second',
			description:
				'Generated columns honouring hourStep / minuteStep / secondStep. format defaults to "numeric" for Hour and "2-digit" for the other two.'
		},
		{
			part: 'TimePicker.Period',
			description: 'AM/PM column. Renders nothing at all when the resolved format is 24-hour.'
		},
		{
			part: 'TimePicker.Clear',
			description: 'Ghost Button resetting the value to ""; a no-op while disabled or read-only.'
		}
	];

	const keyboard = [
		{
			keys: '0–9',
			description:
				'Numeric segments. Zero-pads instantly and auto-advances after two digits, or after one when it exceeds the segment’s maximum first digit (1 for a 12-hour hour, 2 for a 24-hour hour, 5 for minute and second).'
		},
		{ keys: 'A, 1', description: 'Sets the period segment to AM.' },
		{ keys: 'P, 2', description: 'Sets the period segment to PM.' },
		{
			keys: 'ArrowRight, ArrowLeft',
			description:
				'Moves between segments, or between dropdown columns. Bounded between segments and wrapping between columns; inverted under dir="rtl".'
		},
		{
			keys: 'Tab, Shift+Tab',
			description:
				'Native tab order between segments, committing the in-progress edit first; wraps between dropdown columns, direction-independently.'
		},
		{
			keys: 'ArrowUp, ArrowDown',
			description:
				'Steps the focused segment with wrap-around and re-selects it; inside the dropdown, moves within the column with wrap-around and selects as it moves.'
		},
		{
			keys: 'Enter',
			description:
				'Commits the in-progress edit and keeps the segment focused and selected. On the trigger it toggles the dropdown; on a column item it selects, leaving the dropdown open.'
		},
		{
			keys: 'Space',
			description: 'Toggles the dropdown from the trigger; activates a focused column item.'
		},
		{
			keys: 'Escape',
			description:
				'Discards the in-progress edit and blurs the segment; closes an open dropdown without changing the value.'
		},
		{
			keys: 'Backspace, Delete',
			description:
				'Resets a fully selected segment to its placeholder, dropping that field from the value — and the whole value to "" once nothing is left.'
		}
	];
</script>

<svelte:head>
	<title>Time Picker — svelte-dice-ui</title>
</svelte:head>

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Time Picker</h1>
		<p class="text-muted-foreground">
			An accessible time picker with inline editing and dropdown selection. It adapts to 12-hour or
			24-hour display from the locale, and always stores a 24-hour string.
		</p>
	</div>

	<ComponentPreview title="Default" description="Mirrors time-picker-demo.tsx.">
		<TimePicker.Root class="w-[280px]">
			<TimePicker.Label>Select Time</TimePicker.Label>
			<TimePicker.InputGroup>
				<TimePicker.Input segment="hour" />
				<TimePicker.Separator />
				<TimePicker.Input segment="minute" />
				<TimePicker.Input segment="period" />
				<TimePicker.Trigger />
			</TimePicker.InputGroup>
			<TimePicker.Content>
				<TimePicker.Hour />
				<TimePicker.Minute />
				<TimePicker.Period />
			</TimePicker.Content>
		</TimePicker.Root>
	</ComponentPreview>

	<ComponentPreview
		title="With step"
		description="Mirrors time-picker-step-demo.tsx. hourStep, minuteStep and secondStep set both the arrow increment and the column granularity."
	>
		<TimePicker.Root class="w-[280px]" defaultValue="10:00" minuteStep={15} secondStep={10}>
			<TimePicker.Label>Meeting Time (15 min intervals)</TimePicker.Label>
			<TimePicker.InputGroup>
				<TimePicker.Input segment="hour" />
				<TimePicker.Separator />
				<TimePicker.Input segment="minute" />
				<TimePicker.Trigger />
			</TimePicker.InputGroup>
			<TimePicker.Content>
				<TimePicker.Hour />
				<TimePicker.Minute />
				<TimePicker.Second />
			</TimePicker.Content>
		</TimePicker.Root>
	</ComponentPreview>

	<ComponentPreview
		title="With seconds"
		description="Mirrors time-picker-seconds-demo.tsx. showSeconds drives the serialised arity; composing TimePicker.Second adds the column."
	>
		<TimePicker.Root class="w-[280px]" defaultValue="14:30:45" showSeconds>
			<TimePicker.Label>Select Time with Seconds</TimePicker.Label>
			<TimePicker.InputGroup>
				<TimePicker.Input segment="hour" />
				<TimePicker.Separator />
				<TimePicker.Input segment="minute" />
				<TimePicker.Separator />
				<TimePicker.Input segment="second" />
				<TimePicker.Trigger />
			</TimePicker.InputGroup>
			<TimePicker.Content>
				<TimePicker.Hour />
				<TimePicker.Minute />
				<TimePicker.Second />
			</TimePicker.Content>
		</TimePicker.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Custom placeholders"
		description="Mirrors time-picker-placeholder-demo.tsx. The placeholder length also sizes the segment, through --time-picker-*-input-width."
	>
		<div class="flex flex-col gap-6">
			<TimePicker.Root class="w-[280px]" segmentPlaceholder="--">
				<TimePicker.Label>Default (--)</TimePicker.Label>
				<TimePicker.InputGroup>
					<TimePicker.Input segment="hour" />
					<TimePicker.Separator />
					<TimePicker.Input segment="minute" />
					<TimePicker.Input segment="period" />
					<TimePicker.Trigger />
				</TimePicker.InputGroup>
				<TimePicker.Content>
					<TimePicker.Hour />
					<TimePicker.Minute />
					<TimePicker.Period />
				</TimePicker.Content>
			</TimePicker.Root>

			<TimePicker.Root
				class="w-[280px]"
				segmentPlaceholder={{ hour: 'hh', minute: 'mm', period: 'aa' }}
			>
				<TimePicker.Label>Custom (hh:mm aa)</TimePicker.Label>
				<TimePicker.InputGroup>
					<TimePicker.Input segment="hour" />
					<TimePicker.Separator />
					<TimePicker.Input segment="minute" />
					<TimePicker.Input segment="period" />
					<TimePicker.Trigger />
				</TimePicker.InputGroup>
				<TimePicker.Content>
					<TimePicker.Hour />
					<TimePicker.Minute />
					<TimePicker.Period />
				</TimePicker.Content>
			</TimePicker.Root>
		</div>
	</ComponentPreview>

	<ComponentPreview
		title="Open on focus"
		description="Mirrors time-picker-open-on-focus-demo.tsx. The dropdown opens as soon as a segment is focused, and the caret stays in the field."
	>
		<TimePicker.Root class="w-[280px]" openOnFocus>
			<TimePicker.Label>Meeting Time</TimePicker.Label>
			<TimePicker.InputGroup>
				<TimePicker.Input segment="hour" />
				<TimePicker.Separator />
				<TimePicker.Input segment="minute" />
				<TimePicker.Input segment="period" />
				<TimePicker.Trigger />
			</TimePicker.InputGroup>
			<TimePicker.Content>
				<TimePicker.Hour />
				<TimePicker.Minute />
				<TimePicker.Period />
			</TimePicker.Content>
		</TimePicker.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Input group click action"
		description="Mirrors time-picker-input-group-click-action-demo.tsx. A click on empty group space either focuses the first segment or opens the dropdown."
	>
		<div class="flex flex-col gap-8">
			<TimePicker.Root class="w-[280px]">
				<TimePicker.Label>Click empty space to focus</TimePicker.Label>
				<TimePicker.InputGroup>
					<TimePicker.Input segment="hour" />
					<TimePicker.Separator />
					<TimePicker.Input segment="minute" />
					<TimePicker.Input segment="period" />
					<TimePicker.Trigger />
				</TimePicker.InputGroup>
				<TimePicker.Content>
					<TimePicker.Hour />
					<TimePicker.Minute />
					<TimePicker.Period />
				</TimePicker.Content>
			</TimePicker.Root>

			<TimePicker.Root class="w-[280px]" inputGroupClickAction="open">
				<TimePicker.Label>Click empty space to open the dropdown</TimePicker.Label>
				<TimePicker.InputGroup>
					<TimePicker.Input segment="hour" />
					<TimePicker.Separator />
					<TimePicker.Input segment="minute" />
					<TimePicker.Input segment="period" />
					<TimePicker.Trigger />
				</TimePicker.InputGroup>
				<TimePicker.Content>
					<TimePicker.Hour />
					<TimePicker.Minute />
					<TimePicker.Period />
				</TimePicker.Content>
			</TimePicker.Root>
		</div>
	</ComponentPreview>

	<ComponentPreview
		title="Controlled state"
		description="Mirrors time-picker-controlled-demo.tsx, with bind:value in place of the useState pair."
	>
		<div class="flex flex-col gap-4">
			<TimePicker.Root class="w-[280px]" bind:value={controlled}>
				<TimePicker.Label>Controlled Time Picker</TimePicker.Label>
				<TimePicker.InputGroup>
					<TimePicker.Input segment="hour" />
					<TimePicker.Separator />
					<TimePicker.Input segment="minute" />
					<TimePicker.Trigger />
				</TimePicker.InputGroup>
				<TimePicker.Content>
					<TimePicker.Hour />
					<TimePicker.Minute />
					<TimePicker.Clear />
				</TimePicker.Content>
			</TimePicker.Root>
			<div class="flex gap-2">
				<Button variant="outline" size="sm" onclick={() => (controlled = '09:00')}>
					Set 9:00 AM
				</Button>
				<Button variant="outline" size="sm" onclick={() => (controlled = '14:30')}>
					Set 2:30 PM
				</Button>
				<Button variant="outline" size="sm" onclick={() => (controlled = '')}>Clear</Button>
			</div>
			<div class="text-sm text-muted-foreground">
				Selected time:
				<span class="font-mono font-semibold">{controlled || 'None'}</span>
			</div>
		</div>
	</ComponentPreview>

	<ComponentPreview
		title="With form"
		description="Mirrors time-picker-form-demo.tsx. A native <form> with Field and rune state stands in for react-hook-form and zod, which have no Svelte analogue here."
	>
		<form onsubmit={onSubmit} class="flex w-[280px] flex-col gap-4">
			<Field.FieldGroup>
				<Field.Field data-invalid={timeError ? '' : undefined}>
					<Field.FieldLabel for="time-picker-form-hour">Appointment time</Field.FieldLabel>
					<TimePicker.Root
						bind:value={appointmentTime}
						name="appointmentTime"
						required
						invalid={Boolean(timeError)}
					>
						<TimePicker.InputGroup>
							<TimePicker.Input segment="hour" id="time-picker-form-hour" />
							<TimePicker.Separator />
							<TimePicker.Input segment="minute" />
							<TimePicker.Input segment="period" />
							<TimePicker.Trigger />
						</TimePicker.InputGroup>
						<TimePicker.Content>
							<TimePicker.Hour />
							<TimePicker.Minute />
							<TimePicker.Period />
						</TimePicker.Content>
					</TimePicker.Root>
					{#if timeError}
						<Field.FieldError>{timeError}</Field.FieldError>
					{:else}
						<Field.FieldDescription>Select your preferred appointment time.</Field.FieldDescription>
					{/if}
				</Field.Field>
				<div class="flex justify-end">
					<Button type="submit">Schedule appointment</Button>
				</div>
			</Field.FieldGroup>
		</form>
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API Reference</h2>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">TimePicker.Root</h3>
			<p class="text-sm text-muted-foreground">
				The container that owns the value and the dropdown state, and renders a hidden input inside
				a <code>&lt;form&gt;</code>. The pure engine — <code>getIs12Hour</code>,
				<code>parseTimeString</code>, <code>formatTimeValue</code>, <code>stepSegment</code> and the
				column-value builders — is exported from the same module, as is
				<code>ColumnNavigation</code>, so both can be reused without rendering a picker.
			</p>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Prop</Table.Head>
						<Table.Head>Type</Table.Head>
						<Table.Head>Default</Table.Head>
						<Table.Head>Description</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each rootProps as row (row.prop)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.prop}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.type}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.default}</Table.Cell>
							<Table.Cell>{row.description}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Parts</h3>
			<p class="text-sm text-muted-foreground">
				Every part takes <code>ref</code>, <code>class</code> merged last, a
				<code>child</code>
				snippet in place of upstream’s <code>asChild</code>, and spreads the rest onto its element.
			</p>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Part</Table.Head>
						<Table.Head>Description</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each partProps as row (row.part)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.part}</Table.Cell>
							<Table.Cell>{row.description}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">CSS variables</h3>
			<p class="text-sm text-muted-foreground">
				<code>TimePicker.InputGroup</code> writes
				<code>--time-picker-hour-input-width</code>, <code>--time-picker-minute-input-width</code>,
				<code>--time-picker-second-input-width</code>
				and <code>--time-picker-period-input-width</code> from the resolved placeholder lengths (the
				period gets an extra half character so AM/PM never clips). Each segment reads its own
				variable, so a <code>style</code> on one <code>TimePicker.Input</code> overrides just that segment.
			</p>
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Keyboard Interactions</h3>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Key</Table.Head>
						<Table.Head>Description</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each keyboard as row (row.keys)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.keys}</Table.Cell>
							<Table.Cell>{row.description}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</section>
</article>
