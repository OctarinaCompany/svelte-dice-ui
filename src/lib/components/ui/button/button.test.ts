import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './index.js';

const label = (text: string) => createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

describe('Button', () => {
	it('renders a button with an accessible name', () => {
		render(Button, { props: { children: label('Save') } });

		expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
	});

	it('fires onclick when activated from the keyboard', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();

		render(Button, { props: { children: label('Save'), onclick } });

		await user.tab();
		expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();

		await user.keyboard('{Enter}');
		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('renders an anchor when `href` is provided', () => {
		render(Button, { props: { children: label('Docs'), href: '/docs' } });

		expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs');
	});
});
