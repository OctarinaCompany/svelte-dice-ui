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

/**
 * A route id the docs app links to. Every one of them is parameterless.
 *
 * Deliberately *not* the whole `Pathname` union: `resolve()`'s parameter list is the distributive
 * conditional `ResolveArgs<T>`, so a value typed as every route at once asks TypeScript to relate one
 * union-typed argument to a union of per-route argument tuples — a comparison it stops attempting
 * once the route list grows past a couple of dozen entries, which this registry has. Parameterless
 * route ids all instantiate `resolve()` identically, so the two static docs routes stand in for the
 * generated component ones as well.
 */
export type DocsRoute = Extract<Pathname, '/docs' | '/docs/components'>;

/** An entry of the docs sidebar / component index, derived from a registry item. */
export type ComponentEntry = {
	name: string;
	title: string;
	description?: string;
	route: DocsRoute;
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
			// generated path is always a real, parameterless route id — see `DocsRoute`.
			route: `/docs/components/${item.name}` as DocsRoute
		}))
		.sort((a, b) => a.title.localeCompare(b.title));
}
