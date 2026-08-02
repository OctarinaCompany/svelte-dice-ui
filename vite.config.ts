import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

/**
 * `paths.base` is typed as `'' | \`/${string}\``, which `process.env` cannot satisfy on its own.
 * Checking the shape here turns a malformed `BASE_PATH` into a build-time error naming the variable,
 * rather than a site whose every asset silently 404s.
 */
function toBasePath(value: string | undefined): '' | `/${string}` {
	if (!value) return '';
	if (!value.startsWith('/')) {
		throw new Error(`BASE_PATH must start with "/" — received "${value}".`);
	}
	if (value.endsWith('/')) {
		throw new Error(`BASE_PATH must not end with "/" — received "${value}".`);
	}
	return value as `/${string}`;
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// The docs site is a static export served by GitHub Pages: every route is prerendered
			// (`src/routes/+layout.ts`), there is no server code and no dynamic route.
			adapter: adapter(),

			// Pages serves this repository from `/svelte-dice-ui/`, not from the domain root. The
			// workflow sets `BASE_PATH`; leaving it unset keeps `pnpm dev` and `pnpm preview` at `/`.
			paths: { base: toBasePath(process.env.BASE_PATH) },

			prerender: {
				handleHttpError: ({ path, referrer, message }) => {
					// The media player's "Error state" demo deliberately points at a file that does not
					// exist — that missing file *is* the demo. Everything else that 404s is a real broken
					// link and must still fail the build.
					if (path.endsWith('/media/nonexistent-video.mp4')) return;
					throw new Error(`${message} (linked from ${referrer})`);
				}
			}
		}),
		svelteTesting()
	],
	test: {
		environment: 'jsdom',
		globals: false,
		setupFiles: ['./tests/setup.ts'],
		include: ['src/**/*.{test,spec}.{js,ts}'],
		expect: { requireAssertions: true }
	}
});
