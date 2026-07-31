<script lang="ts">
	import { ComponentPreview } from '$lib/components/docs/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Stepper from '$lib/components/ui/stepper/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { toast } from 'svelte-sonner';

	const setupSteps = [
		{
			value: 'account',
			title: 'Account Setup',
			description: 'Create your account and verify email'
		},
		{
			value: 'profile',
			title: 'Profile Information',
			description: 'Add your personal details and preferences'
		},
		{
			value: 'payment',
			title: 'Payment Details',
			description: 'Set up billing and payment methods'
		},
		{
			value: 'complete',
			title: 'Complete Setup',
			description: 'Review and finish your account setup'
		}
	];

	const orderSteps = [
		{ value: 'placed', title: 'Order Placed', description: 'Your order has been placed' },
		{ value: 'processing', title: 'Processing', description: 'We are preparing your items' },
		{ value: 'shipped', title: 'Shipped', description: 'Your order is on its way to you' },
		{ value: 'delivered', title: 'Delivered', description: 'Order delivered to your address' }
	];

	// ── With Validation ──────────────────────────────────────────────────────────
	// A plain local validator stands in for react-hook-form + zod, which have no Svelte analogue
	// here and are not worth a dependency for a demo (research R-13).

	const validationSteps = [
		{
			value: 'account',
			title: 'Account Setup',
			description: 'Create your account',
			fields: ['username', 'email'] as const
		},
		{
			value: 'profile',
			title: 'Profile Info',
			description: 'Complete your profile',
			fields: ['firstName', 'lastName', 'bio'] as const
		},
		{ value: 'review', title: 'Review', description: 'Review your information', fields: [] }
	];

	type ValidationField = 'username' | 'email' | 'firstName' | 'lastName' | 'bio';

	const validationRules: Record<ValidationField, (value: string) => string | undefined> = {
		username: (value) =>
			value.trim().length < 3
				? 'Username must be at least 3 characters'
				: /^[a-zA-Z0-9_]+$/.test(value)
					? undefined
					: 'Username can only contain letters, numbers and underscores',
		email: (value) =>
			/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? undefined : 'Enter a valid email',
		firstName: (value) => (value.trim() ? undefined : 'First name is required'),
		lastName: (value) => (value.trim() ? undefined : 'Last name is required'),
		bio: (value) => (value.trim().length < 10 ? 'Bio must be at least 10 characters' : undefined)
	};

	let validationStep = $state('account');
	let validationValues = $state<Record<ValidationField, string>>({
		username: '',
		email: '',
		firstName: '',
		lastName: '',
		bio: ''
	});
	let validationErrors = $state<Partial<Record<ValidationField, string>>>({});

	const validationIndex = $derived(validationSteps.findIndex((s) => s.value === validationStep));

	function validateFields(fields: readonly ValidationField[]): boolean {
		const errors: Partial<Record<ValidationField, string>> = {};

		for (const field of fields) {
			const message = validationRules[field](validationValues[field]);
			if (message) errors[field] = message;
		}

		validationErrors = errors;
		return Object.keys(errors).length === 0;
	}

	function onValidate(_value: string, direction: 'next' | 'prev'): boolean {
		if (direction === 'prev') return true;

		const current = validationSteps.find((step) => step.value === validationStep);
		if (!current) return true;

		const isValid = validateFields(current.fields);
		if (!isValid) {
			toast.info('Please complete all required fields to continue', {
				description: 'Fix the validation errors and try again.'
			});
		}

		return isValid;
	}

	// ── With Form ────────────────────────────────────────────────────────────────

	const formSteps = [
		{
			value: 'personal',
			title: 'Personal Details',
			description: 'Enter your basic information',
			fields: ['formFirstName', 'formLastName', 'formEmail'] as const
		},
		{
			value: 'about',
			title: 'About You',
			description: 'Tell us more about yourself',
			fields: ['formBio'] as const
		},
		{
			value: 'professional',
			title: 'Professional Info',
			description: 'Add your professional details',
			fields: ['formCompany', 'formWebsite'] as const
		}
	];

	type FormField =
		'formFirstName' | 'formLastName' | 'formEmail' | 'formBio' | 'formCompany' | 'formWebsite';

	const formRules: Record<FormField, (value: string) => string | undefined> = {
		formFirstName: (value) =>
			value.trim().length < 2 ? 'First name must be at least 2 characters' : undefined,
		formLastName: (value) =>
			value.trim().length < 2 ? 'Last name must be at least 2 characters' : undefined,
		formEmail: (value) =>
			/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? undefined : 'Enter a valid email address',
		formBio: (value) =>
			value.trim().length < 10 ? 'Bio must be at least 10 characters' : undefined,
		formCompany: (value) =>
			value.trim().length < 2 ? 'Company name must be at least 2 characters' : undefined,
		formWebsite: (value) =>
			value.trim() === '' || /^https?:\/\/\S+$/.test(value) ? undefined : 'Enter a valid URL'
	};

	let formStep = $state('personal');
	let formValues = $state<Record<FormField, string>>({
		formFirstName: '',
		formLastName: '',
		formEmail: '',
		formBio: '',
		formCompany: '',
		formWebsite: ''
	});
	let formErrors = $state<Partial<Record<FormField, string>>>({});

	const formIndex = $derived(formSteps.findIndex((s) => s.value === formStep));

	function validateFormFields(fields: readonly FormField[]): boolean {
		const errors: Partial<Record<FormField, string>> = {};

		for (const field of fields) {
			const message = formRules[field](formValues[field]);
			if (message) errors[field] = message;
		}

		formErrors = errors;
		return Object.keys(errors).length === 0;
	}

	function onFormValidate(_value: string, direction: 'next' | 'prev'): boolean {
		if (direction === 'prev') return true;

		const current = formSteps.find((step) => step.value === formStep);
		if (!current) return true;

		const isValid = validateFormFields(current.fields);
		if (!isValid) toast.info('Please complete all required fields to continue');

		return isValid;
	}

	function onFormSubmit(event: SubmitEvent) {
		event.preventDefault();

		const current = formSteps[formIndex];
		if (current && !validateFormFields(current.fields)) return;

		toast.success('Profile submitted', {
			description: `${formValues.formFirstName} ${formValues.formLastName}`
		});
	}

	const rootProps = [
		{
			prop: 'value',
			type: 'string',
			default: '—',
			description: 'The active step value. Bindable; controlled when bound or passed.'
		},
		{
			prop: 'defaultValue',
			type: 'string',
			default: "''",
			description: 'Seeds `value` once when the component is uncontrolled.'
		},
		{
			prop: 'onValueChange',
			type: '(value: string) => void',
			default: '—',
			description: 'Called when the active step actually changes.'
		},
		{
			prop: 'onValidate',
			type: '(value, direction) => boolean | Promise<boolean>',
			default: '—',
			description: 'Gates forward moves. `false` or a rejection blocks the change.'
		},
		{
			prop: 'onValueAdd / onValueRemove',
			type: '(value: string) => void',
			default: '—',
			description: 'Called when a `Stepper.Item` registers or unregisters.'
		},
		{
			prop: 'onValueComplete',
			type: '(value: string, completed: boolean) => void',
			default: '—',
			description: "Called when a step's `completed` flag flips."
		},
		{
			prop: 'activationMode',
			type: "'automatic' | 'manual'",
			default: "'automatic'",
			description: 'Whether keyboard focus activates a step, or `Enter`/`Space` does.'
		},
		{
			prop: 'orientation',
			type: "'horizontal' | 'vertical'",
			default: "'horizontal'",
			description: 'Layout axis, published as `data-orientation` on every part.'
		},
		{
			prop: 'dir',
			type: "'ltr' | 'rtl'",
			default: 'resolved',
			description: 'Reading direction; falls back to `<DirectionProvider>`, then the DOM.'
		},
		{
			prop: 'disabled',
			type: 'boolean',
			default: 'false',
			description: 'Disables every trigger and blocks interaction.'
		},
		{
			prop: 'loop',
			type: 'boolean',
			default: 'false',
			description: 'Arrow-key navigation wraps around the ends.'
		},
		{
			prop: 'nonInteractive',
			type: 'boolean',
			default: 'false',
			description: 'Blocks step navigation; the active step still follows `value`.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render the root onto your own element.'
		}
	];

	const listProps = [
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered `<div role="tablist">`.'
		},
		{
			prop: 'class',
			type: 'string',
			default: '—',
			description: 'Merged last through `cn()`.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render the list onto your own element.'
		}
	];

	const itemProps = [
		{
			prop: 'value',
			type: 'string',
			default: '— (required)',
			description: 'The unique value that links the item with its content.'
		},
		{
			prop: 'completed',
			type: 'boolean',
			default: 'false',
			description: 'Marks the step completed regardless of its position.'
		},
		{
			prop: 'disabled',
			type: 'boolean',
			default: 'false',
			description: 'Disables this step; roving focus skips over it.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render the item onto your own element.'
		}
	];

	const triggerProps = [
		{
			prop: 'disabled',
			type: 'boolean',
			default: '—',
			description: 'Effective disabled is `disabled || step.disabled || root.disabled`.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render the trigger onto your own element; it then cannot self-register.'
		}
	];

	const indicatorProps = [
		{
			prop: 'children',
			type: 'Snippet<[StepperDataState]>',
			default: '—',
			description: 'Receives the step data state. Defaults to a check icon or the position.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render the indicator onto your own element.'
		}
	];

	const separatorProps = [
		{
			prop: 'forceMount',
			type: 'boolean',
			default: 'false',
			description: 'Keeps the separator mounted after the last step.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render the separator onto your own element.'
		}
	];

	const titleProps = [
		{
			prop: 'class',
			type: 'string',
			default: '—',
			description: 'Merged last through `cn()`. The id is `${rootId}-title-${itemValue}`.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render the title onto your own element.'
		}
	];

	const descriptionProps = [
		{
			prop: 'class',
			type: 'string',
			default: '—',
			description: 'Merged last through `cn()`. The id is `${rootId}-description-${itemValue}`.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render the description onto your own element.'
		}
	];

	const contentProps = [
		{
			prop: 'value',
			type: 'string',
			default: '— (required)',
			description: 'The unique value that links the content with its item.'
		},
		{
			prop: 'forceMount',
			type: 'boolean',
			default: 'false',
			description: 'Keeps the panel mounted while the step is inactive.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render the content onto your own element.'
		}
	];

	const navigationProps = [
		{
			prop: 'disabled',
			type: 'boolean',
			default: '—',
			description: 'Merged with the automatic first-step / last-step guard.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render the control onto your own element, e.g. a styled `Button`.'
		}
	];

	const propTables = [
		{ part: 'Stepper.Root', rows: rootProps },
		{ part: 'Stepper.List', rows: listProps },
		{ part: 'Stepper.Item', rows: itemProps },
		{ part: 'Stepper.Trigger', rows: triggerProps },
		{ part: 'Stepper.Indicator', rows: indicatorProps },
		{ part: 'Stepper.Separator', rows: separatorProps },
		{ part: 'Stepper.Title', rows: titleProps },
		{ part: 'Stepper.Description', rows: descriptionProps },
		{ part: 'Stepper.Content', rows: contentProps },
		{ part: 'Stepper.Prev / Stepper.Next', rows: navigationProps }
	];

	const dataAttributes = [
		{ part: 'Stepper.Root', attribute: '[data-orientation]', value: '"horizontal" | "vertical"' },
		{ part: 'Stepper.Root', attribute: '[data-disabled]', value: 'present when disabled' },
		{ part: 'Stepper.List', attribute: '[data-orientation]', value: '"horizontal" | "vertical"' },
		{
			part: 'Stepper.Item',
			attribute: '[data-state]',
			value: '"inactive" | "active" | "completed"'
		},
		{
			part: 'Stepper.Trigger',
			attribute: '[data-state]',
			value: '"inactive" | "active" | "completed"'
		},
		{
			part: 'Stepper.Indicator',
			attribute: '[data-state]',
			value: '"inactive" | "active" | "completed"'
		},
		{
			part: 'Stepper.Separator',
			attribute: '[data-state]',
			value: '"inactive" | "completed" — never "active"'
		}
	];

	const keyboardShortcuts = [
		{ keys: 'Tab', description: 'Moves focus into the list, onto the current step trigger.' },
		{ keys: 'Shift + Tab', description: 'Moves focus out of the stepper.' },
		{
			keys: 'Enter, Space',
			description: 'Activates the focused step in `manual` activation mode.'
		},
		{ keys: 'ArrowLeft, ArrowUp', description: 'Moves focus to the previous step trigger.' },
		{ keys: 'ArrowRight, ArrowDown', description: 'Moves focus to the next step trigger.' },
		{ keys: 'Home, PageUp', description: 'Moves focus to the first enabled step trigger.' },
		{ keys: 'End, PageDown', description: 'Moves focus to the last enabled step trigger.' }
	];
</script>

<svelte:head>
	<title>Stepper — svelte-dice-ui</title>
</svelte:head>

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Stepper</h1>
		<p class="text-muted-foreground">
			A component that guides users through a multi-step process with clear visual progress
			indicators.
		</p>
	</div>

	<ComponentPreview
		title="Default"
		description="Mirrors stepper-demo.tsx — horizontal, indicator-only triggers, one content panel per step."
	>
		<Stepper.Root defaultValue="account" class="w-full max-w-md">
			<Stepper.List>
				{#each setupSteps as step (step.value)}
					<Stepper.Item value={step.value}>
						<Stepper.Trigger>
							<Stepper.Indicator />
						</Stepper.Trigger>
						<Stepper.Separator />
					</Stepper.Item>
				{/each}
			</Stepper.List>
			{#each setupSteps as step (step.value)}
				<Stepper.Content
					value={step.value}
					class="flex flex-col items-center gap-4 rounded-md border bg-card p-4 text-card-foreground"
				>
					<div class="flex flex-col items-center gap-px text-center">
						<h3 class="text-lg font-semibold">{step.title}</h3>
						<p class="text-muted-foreground">{step.description}</p>
					</div>
					<p class="text-sm">Content for {step.title} goes here.</p>
				</Stepper.Content>
			{/each}
		</Stepper.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Vertical"
		description="Mirrors stepper-vertical-demo.tsx — a vertical axis with titles, descriptions and an absolutely positioned separator."
		class="items-stretch"
	>
		<Stepper.Root defaultValue="shipped" orientation="vertical">
			<Stepper.List>
				{#each orderSteps as step (step.value)}
					<Stepper.Item value={step.value}>
						<Stepper.Trigger class="not-last:pb-6">
							<Stepper.Indicator />
							<div class="flex flex-col gap-1">
								<Stepper.Title>{step.title}</Stepper.Title>
								<Stepper.Description>{step.description}</Stepper.Description>
							</div>
						</Stepper.Trigger>
						<Stepper.Separator
							class="absolute inset-y-0 top-5 left-3.5 -z-10 -order-1 h-full -translate-x-1/2"
						/>
					</Stepper.Item>
				{/each}
			</Stepper.List>
			{#each orderSteps as step (step.value)}
				<Stepper.Content
					value={step.value}
					class="flex flex-col gap-4 rounded-lg border bg-card p-6 text-card-foreground"
				>
					<div class="flex flex-col gap-px">
						<h4 class="font-semibold">{step.title}</h4>
						<p class="text-sm text-muted-foreground">{step.description}</p>
					</div>
					<p class="text-sm">
						This is the content for {step.title}. You can add forms, information, or any other
						content here.
					</p>
				</Stepper.Content>
			{/each}
		</Stepper.Root>
	</ComponentPreview>

	<ComponentPreview
		title="With Validation"
		description="Mirrors stepper-validation-demo.tsx — the page owns `value` and `onValidate` gates every forward move. A local validator stands in for react-hook-form and zod."
		class="items-stretch"
	>
		<Stepper.Root bind:value={validationStep} {onValidate} class="w-full">
			<Stepper.List>
				{#each validationSteps as step (step.value)}
					<Stepper.Item value={step.value}>
						<Stepper.Trigger>
							<Stepper.Indicator />
							<div class="flex flex-col gap-1">
								<Stepper.Title>{step.title}</Stepper.Title>
								<Stepper.Description>{step.description}</Stepper.Description>
							</div>
						</Stepper.Trigger>
						<Stepper.Separator class="mx-4" />
					</Stepper.Item>
				{/each}
			</Stepper.List>

			<Stepper.Content
				value="account"
				class="flex flex-col gap-4 rounded-md border bg-card p-4 text-card-foreground"
			>
				<Field.Field data-invalid={validationErrors.username ? '' : undefined}>
					<Field.FieldLabel for="stepper-username">Username</Field.FieldLabel>
					<Input
						id="stepper-username"
						placeholder="Enter username"
						bind:value={validationValues.username}
					/>
					{#if validationErrors.username}
						<Field.FieldError>{validationErrors.username}</Field.FieldError>
					{/if}
				</Field.Field>
				<Field.Field data-invalid={validationErrors.email ? '' : undefined}>
					<Field.FieldLabel for="stepper-email">Email</Field.FieldLabel>
					<Input
						id="stepper-email"
						type="email"
						placeholder="Enter email"
						bind:value={validationValues.email}
					/>
					{#if validationErrors.email}
						<Field.FieldError>{validationErrors.email}</Field.FieldError>
					{/if}
				</Field.Field>
			</Stepper.Content>

			<Stepper.Content
				value="profile"
				class="flex flex-col gap-4 rounded-md border bg-card p-4 text-card-foreground"
			>
				<div class="grid gap-4 sm:grid-cols-2">
					<Field.Field data-invalid={validationErrors.firstName ? '' : undefined}>
						<Field.FieldLabel for="stepper-first-name">First Name</Field.FieldLabel>
						<Input
							id="stepper-first-name"
							placeholder="Enter first name"
							bind:value={validationValues.firstName}
						/>
						{#if validationErrors.firstName}
							<Field.FieldError>{validationErrors.firstName}</Field.FieldError>
						{/if}
					</Field.Field>
					<Field.Field data-invalid={validationErrors.lastName ? '' : undefined}>
						<Field.FieldLabel for="stepper-last-name">Last Name</Field.FieldLabel>
						<Input
							id="stepper-last-name"
							placeholder="Enter last name"
							bind:value={validationValues.lastName}
						/>
						{#if validationErrors.lastName}
							<Field.FieldError>{validationErrors.lastName}</Field.FieldError>
						{/if}
					</Field.Field>
				</div>
				<Field.Field data-invalid={validationErrors.bio ? '' : undefined}>
					<Field.FieldLabel for="stepper-bio">Bio</Field.FieldLabel>
					<Textarea
						id="stepper-bio"
						placeholder="Tell us about yourself…"
						class="min-h-20"
						bind:value={validationValues.bio}
					/>
					{#if validationErrors.bio}
						<Field.FieldError>{validationErrors.bio}</Field.FieldError>
					{/if}
				</Field.Field>
			</Stepper.Content>

			<Stepper.Content
				value="review"
				class="grid gap-4 rounded-md border bg-card p-4 text-card-foreground sm:grid-cols-2 lg:grid-cols-3"
			>
				{#each Object.entries(validationValues) as [name, entry] (name)}
					<div class="flex flex-col gap-1 rounded-md border p-2">
						<span class="text-sm font-medium">{name}</span>
						<p class="text-sm">{entry || 'Not provided'}</p>
					</div>
				{/each}
			</Stepper.Content>

			<div class="flex items-center justify-between">
				<Stepper.Prev>
					{#snippet child({ props })}
						<Button {...props} variant="outline">Previous</Button>
					{/snippet}
				</Stepper.Prev>
				<div class="text-sm text-muted-foreground">
					Step {validationIndex + 1} of {validationSteps.length}
				</div>
				{#if validationIndex === validationSteps.length - 1}
					<Button onclick={() => toast.success('Setup complete')}>Complete Setup</Button>
				{:else}
					<Stepper.Next>
						{#snippet child({ props })}
							<Button {...props}>Next</Button>
						{/snippet}
					</Stepper.Next>
				{/if}
			</div>
		</Stepper.Root>
	</ComponentPreview>

	<ComponentPreview
		title="With Form"
		description="Mirrors stepper-form-demo.tsx — a multi-step form built from Field, Input and Textarea, where each step is validated before the stepper advances."
		class="items-stretch"
	>
		<form class="w-full" onsubmit={onFormSubmit}>
			<Stepper.Root bind:value={formStep} onValidate={onFormValidate}>
				<Stepper.List>
					{#each formSteps as step (step.value)}
						<Stepper.Item value={step.value}>
							<Stepper.Trigger>
								<Stepper.Indicator />
								<div class="flex flex-col gap-px">
									<Stepper.Title>{step.title}</Stepper.Title>
									<Stepper.Description>{step.description}</Stepper.Description>
								</div>
							</Stepper.Trigger>
							<Stepper.Separator class="mx-4" />
						</Stepper.Item>
					{/each}
				</Stepper.List>

				<Stepper.Content value="personal" class="flex flex-col gap-4">
					<div class="grid gap-4 sm:grid-cols-2">
						<Field.Field data-invalid={formErrors.formFirstName ? '' : undefined}>
							<Field.FieldLabel for="stepper-form-first-name">First Name</Field.FieldLabel>
							<Input
								id="stepper-form-first-name"
								placeholder="John"
								bind:value={formValues.formFirstName}
							/>
							{#if formErrors.formFirstName}
								<Field.FieldError>{formErrors.formFirstName}</Field.FieldError>
							{/if}
						</Field.Field>
						<Field.Field data-invalid={formErrors.formLastName ? '' : undefined}>
							<Field.FieldLabel for="stepper-form-last-name">Last Name</Field.FieldLabel>
							<Input
								id="stepper-form-last-name"
								placeholder="Doe"
								bind:value={formValues.formLastName}
							/>
							{#if formErrors.formLastName}
								<Field.FieldError>{formErrors.formLastName}</Field.FieldError>
							{/if}
						</Field.Field>
					</div>
					<Field.Field data-invalid={formErrors.formEmail ? '' : undefined}>
						<Field.FieldLabel for="stepper-form-email">Email</Field.FieldLabel>
						<Input
							id="stepper-form-email"
							placeholder="john.doe@example.com"
							bind:value={formValues.formEmail}
						/>
						{#if formErrors.formEmail}
							<Field.FieldError>{formErrors.formEmail}</Field.FieldError>
						{/if}
					</Field.Field>
				</Stepper.Content>

				<Stepper.Content value="about">
					<Field.Field data-invalid={formErrors.formBio ? '' : undefined}>
						<Field.FieldLabel for="stepper-form-bio">Bio</Field.FieldLabel>
						<Textarea
							id="stepper-form-bio"
							placeholder="Tell us about yourself…"
							class="min-h-30"
							bind:value={formValues.formBio}
						/>
						{#if formErrors.formBio}
							<Field.FieldError>{formErrors.formBio}</Field.FieldError>
						{:else}
							<Field.FieldDescription>
								Write a brief description about yourself.
							</Field.FieldDescription>
						{/if}
					</Field.Field>
				</Stepper.Content>

				<Stepper.Content value="professional" class="flex flex-col gap-4">
					<Field.Field data-invalid={formErrors.formCompany ? '' : undefined}>
						<Field.FieldLabel for="stepper-form-company">Company</Field.FieldLabel>
						<Input
							id="stepper-form-company"
							placeholder="Acme Inc."
							bind:value={formValues.formCompany}
						/>
						{#if formErrors.formCompany}
							<Field.FieldError>{formErrors.formCompany}</Field.FieldError>
						{/if}
					</Field.Field>
					<Field.Field data-invalid={formErrors.formWebsite ? '' : undefined}>
						<Field.FieldLabel for="stepper-form-website">Website</Field.FieldLabel>
						<Input
							id="stepper-form-website"
							placeholder="https://example.com"
							bind:value={formValues.formWebsite}
						/>
						{#if formErrors.formWebsite}
							<Field.FieldError>{formErrors.formWebsite}</Field.FieldError>
						{:else}
							<Field.FieldDescription>
								Optional: your personal or company website.
							</Field.FieldDescription>
						{/if}
					</Field.Field>
				</Stepper.Content>

				<div class="mt-4 flex items-center justify-between">
					<Stepper.Prev>
						{#snippet child({ props })}
							<Button {...props} variant="outline">Previous</Button>
						{/snippet}
					</Stepper.Prev>
					<div class="text-sm text-muted-foreground">
						Step {formIndex + 1} of {formSteps.length}
					</div>
					{#if formIndex === formSteps.length - 1}
						<Button type="submit">Complete</Button>
					{:else}
						<Stepper.Next>
							{#snippet child({ props })}
								<Button {...props}>Next</Button>
							{/snippet}
						</Stepper.Next>
					{/if}
				</div>
			</Stepper.Root>
		</form>
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API Reference</h2>

		{#each propTables as table (table.part)}
			<div class="flex flex-col gap-3">
				<h3 class="text-base font-medium tracking-tight">{table.part}</h3>
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
						{#each table.rows as row (row.prop)}
							<Table.Row>
								<Table.Cell class="font-medium">{row.prop}</Table.Cell>
								<Table.Cell class="font-mono text-xs">{row.type}</Table.Cell>
								<Table.Cell class="font-mono text-xs">{row.default}</Table.Cell>
								<Table.Cell class="text-muted-foreground">{row.description}</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
		{/each}

		<div class="flex flex-col gap-3">
			<h3 class="text-base font-medium tracking-tight">Data attributes</h3>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Part</Table.Head>
						<Table.Head>Attribute</Table.Head>
						<Table.Head>Value</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each dataAttributes as row (`${row.part}-${row.attribute}`)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.part}</Table.Cell>
							<Table.Cell class="font-mono text-xs">{row.attribute}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.value}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-base font-medium tracking-tight">Keyboard interactions</h3>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Key</Table.Head>
						<Table.Head>Description</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each keyboardShortcuts as row (row.keys)}
						<Table.Row>
							<Table.Cell class="font-mono text-xs">{row.keys}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.description}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</section>
</article>
