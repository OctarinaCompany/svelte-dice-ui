/speckit-plan Implementation plan for the "{{NAME}}" port ({{FEATURE_DIR}}).

Before planning, read the upstream React implementation closely enough to state the exact public API
you will expose:
{{SOURCE_PATHS}}
Local upstream documentation (MDX): {{DOCS_MDX}}
Also read two or three already-ported components under `src/lib/components/ui/` so the plan matches
the conventions already established, plus `CLAUDE.md` and `.specify/memory/constitution.md`.

NON-NEGOTIABLE TECHNICAL CONSTRAINTS

- Svelte 5 runes only: $state, $derived, $derived.by, $effect, $props, $bindable. No Svelte 4 stores,
  no `export let`, no `createEventDispatcher`, no legacy slots (use snippets).
- TypeScript strict. No `any`. Public prop types exported from the barrel.
- Build on the project's existing primitives: Bits UI and `src/lib/components/ui/*`. Write bespoke
  logic only where no primitive covers the behaviour, and say so explicitly in the plan.
- Obey `.agents/skills/shadcn-svelte/rules/styling.md`, `composition.md`, `forms.md` and `icons.md`
  verbatim.
- Zero new npm dependencies unless upstream needs one; every one must be named, justified and pinned.

REACT -> SVELTE TRANSLATION RULES (translate, do not transliterate)

- Custom hooks -> a state class in a `.svelte.ts` module using runes, or a plain rune-based function.
- React context -> setContext/getContext behind a typed Symbol key plus a `getXxxContext()` helper
  that throws a clear error when used outside the provider.
- forwardRef / ref -> `bind:ref` plus `...restProps` spread onto the element.
- asChild / cloneElement / Slot -> the `child` snippet prop pattern used by Bits UI.
- Portals -> the project's existing portal primitive.
- CSS-in-JS or clsx trees -> Tailwind v4 utilities via `cn()` / `tv()`, with component state exposed
  as `data-*` attributes so consumers can style from the outside.
- useEffect cleanup -> `$effect` returning a teardown. Never mutate reactive state inside `$effect`
  where `$derived` would do.
- useMemo / useCallback -> nothing; Svelte's reactivity makes them unnecessary. Do not port them.

DELIVERABLES THE PLAN MUST SCHEDULE EXPLICITLY

1. `src/lib/components/ui/{{SLUG}}/` - one `.svelte` file per exported subcomponent, a state module
   (`{{SLUG}}.svelte.ts` or similar) where behaviour warrants it, `types.ts` if needed, and
   `index.ts` exporting both the namespace-friendly component names and the types.
2. Unit tests with vitest + @testing-library/svelte covering: rendering, every prop, controlled and
   uncontrolled state, the full keyboard interaction set, accessible names and roles, and RTL where
   applicable.
3. `src/routes/docs/components/{{SLUG}}/+page.svelte` - a demo page with one section per example from
   the upstream docs, plus a props table.
4. A registry entry for "{{SLUG}}" in `registry.json`, listing files, registryDependencies and npm
   dependencies.
5. Any shared module this component must EXPORT for later components to reuse (see the notes below).

The plan MUST contain a "Public API" section listing every exported component, its props (name, type,
default, bindable?), its snippets, and its callbacks/events, derived from the upstream source.

{{PROMPT_EXTRA}}
