import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
	{
		ignores: [
			'.svelte-kit/',
			'.reference/',
			'.port-logs/',
			'build/',
			'dist/',
			'node_modules/',
			'static/r/'
		]
	},
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// Svelte 5 `$props()` destructuring frequently discards props on purpose.
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_'
				}
			]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		}
	},
	{
		// `src/lib/components/ui/**` is the distributed registry: it is copied into
		// consumer projects that may not even be SvelteKit apps. Its primitives take an
		// arbitrary `href` prop from the caller and must not import `$app/paths`, so the
		// SvelteKit-only navigation rule does not apply there. It stays enforced for
		// everything under `src/routes/**`, where links are ours to resolve.
		files: ['src/lib/components/ui/**/*.svelte'],
		rules: {
			'svelte/no-navigation-without-resolve': 'off'
		}
	}
);
