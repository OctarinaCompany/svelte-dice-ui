Set up the complete toolchain for this project. A minimal SvelteKit skeleton has already been
scaffolded at the repository root ({{REPO_ROOT}}) and `pnpm install` has been run. Your job is to turn
it into a working shadcn-svelte component-registry project. Do everything in this one turn.

PROJECT PURPOSE (read `README.md`)
`svelte-dice-ui` is a Svelte 5 port of the Dice UI React component library, distributed as a
**shadcn-svelte registry**: components live as source in this repository, are documented on a
SvelteKit docs site, and are installable by consumers through `registry.json`.

READ FIRST

- `.agents/skills/shadcn-svelte/SKILL.md`, `cli.md`, `customization.md` and every file in `rules/`.
- `.reference/diceui/docs/` - the upstream React docs app, for how it structures its registry, its
  demo pages and its component docs. Read-only; never modify it.

DO ALL OF THE FOLLOWING

1. Tailwind CSS v4 - install and wire it (`@tailwindcss/vite` plus `src/app.css` containing
   `@import "tailwindcss";`), imported from the root layout.

2. shadcn-svelte - initialise it non-interactively with base colour `zinc`, CSS file `src/app.css`
   and the UI alias `$lib/components/ui`. This must produce `components.json` and `src/lib/utils.ts`
   with `cn()`. Use the CLI (`pnpm dlx shadcn-svelte@latest init ...`) with explicit flags so it never
   prompts.

3. Pre-install the base component set in ONE `pnpm dlx shadcn-svelte@latest add --yes --overwrite`
   invocation, so no later port has to add a primitive mid-run:
   accordion alert avatar badge button calendar card checkbox collapsible command context-menu
   dialog drawer dropdown-menu empty field hover-card input input-group label popover progress
   radio-group scroll-area select separator sheet skeleton sonner spinner switch table tabs textarea
   toggle toggle-group tooltip
   If a name is rejected by the CLI, drop just that name, continue, and list the dropped ones in your
   summary.

4. Testing - vitest, @testing-library/svelte, @testing-library/user-event, @testing-library/jest-dom,
   jsdom. Create `vitest.config.ts` (or extend `vite.config.ts`) with a jsdom environment, a setup
   file registering jest-dom matchers, and an include pattern covering
   `src/lib/components/ui/**/*.test.ts`. Add a smoke test that passes.

5. Linting and formatting - eslint with `typescript-eslint` and `eslint-plugin-svelte`, prettier with
   `prettier-plugin-svelte` and `prettier-plugin-tailwindcss`. Configure them so the existing
   skeleton passes cleanly.

6. TypeScript - ensure strict mode is on in `tsconfig.json`.

7. Registry - create `registry.json` at the repository root following the shadcn-svelte registry
   schema (`name`, `homepage`, `items: []`), plus a `registry:build` script. Leave `items` empty; each
   ported component appends its own entry.

8. Docs site shell under `src/routes/`:
   - `src/routes/+layout.svelte` importing `app.css`.
   - `src/routes/docs/+layout.svelte` with a sidebar whose component list is derived from
     `registry.json` (not hard-coded).
   - `src/routes/docs/components/+page.svelte` - an index of ported components.
   - `src/lib/components/docs/component-preview.svelte` - a reusable preview harness (titled section,
     bordered preview area, optional description) that every future demo page uses.
   - A home page linking to the docs.

9. `package.json` scripts, exactly these names (the orchestrator invokes them literally):
   `dev`, `build`, `preview`, `check` (svelte-kit sync + svelte-check), `check:watch`, `lint`,
   `format`, `test:unit` (vitest), `registry:build`.

10. Write `CLAUDE.md` at the repository root documenting the porting conventions that every future
    component must follow. This file is auto-loaded into every subsequent automated session, so it is
    the single most valuable artifact you produce here. It must cover, concretely and with short code
    examples taken from what you actually set up:
    - Directory layout of a ported component under `src/lib/components/ui/<slug>/`, and the
      `index.ts` barrel shape (namespace-friendly exports plus exported types).
    - Svelte 5 rune conventions: `$props()` with an exported `Props` type, `$bindable` for
      controlled/uncontrolled props, state classes in `.svelte.ts` modules, `$effect` teardown.
    - The context pattern: typed Symbol key, `setXxxContext` / `getXxxContext`, throwing when used
      outside the provider.
    - Styling: `cn()` / `tv()`, semantic Tailwind tokens only, state exposed via `data-*` attributes,
      no `space-*`, no manual `dark:`, no manual z-index on overlays.
    - Test conventions: file location, what must be asserted (roles, keyboard, controlled and
      uncontrolled, RTL), and how to render with @testing-library/svelte.
    - Demo route conventions: path `src/routes/docs/components/<slug>/+page.svelte`, use of
      `component-preview.svelte`, one section per upstream example.
    - How to add a `registry.json` entry.
    - The React -> Svelte translation table (hooks -> state classes, context -> setContext/getContext,
      forwardRef -> `bind:ref` + restProps, asChild -> `child` snippet, portals, CSS-in-JS -> `cn()`).
    - Where the upstream reference lives (`.reference/diceui`, read-only) and how to find a
      component's source, docs MDX, examples and tests inside it.

11. Verify your own work before ending the turn. Run and make green, in this order:
    pnpm run check
    pnpm run lint
    pnpm run test:unit -- --run
    pnpm run build
    Fix everything that fails. Do not suppress anything.

Do not create any `specs/` directory, do not touch `.specify/`, `.claude/`, `scripts/` or
`.reference/`, and do not run any git command.
