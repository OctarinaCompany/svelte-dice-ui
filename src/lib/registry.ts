import type { Pathname } from '$app/types';

import registryJson from '../../registry.json';

/** A single entry of the shadcn-svelte registry described by `registry.json`. */
export type RegistryItem = {
	name: string;
	type: string;
	title?: string;
	description?: string;
	dependencies?: string[];
	registryDependencies?: string[];
	files?: { path: string; type: string; target?: string }[];
};

export type Registry = {
	name: string;
	homepage: string;
	items: RegistryItem[];
};

/** An entry of the docs sidebar / component index, derived from a registry item. */
export type ComponentEntry = {
	name: string;
	title: string;
	description?: string;
	route: Pathname;
};

export const registry = registryJson as Registry;

/** Turn a registry item name such as `tags-input` into `Tags Input`. */
export function titleFromName(name: string): string {
	return name
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

/** Every ported component, alphabetically, as consumed by the docs sidebar and index. */
export function getComponentItems(): ComponentEntry[] {
	return registry.items
		.filter((item) => item.type === 'registry:ui')
		.map((item) => ({
			name: item.name,
			title: item.title ?? titleFromName(item.name),
			description: item.description,
			// Every `registry:ui` item must ship a demo route at
			// `src/routes/docs/components/<name>/+page.svelte` (see CLAUDE.md), so the
			// generated path is always a real route id.
			route: `/docs/components/${item.name}` as Pathname
		}))
		.sort((a, b) => a.title.localeCompare(b.title));
}
