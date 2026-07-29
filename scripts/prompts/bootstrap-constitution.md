/speckit-constitution Create the project constitution for `svelte-dice-ui`, a Svelte 5 port of the
Dice UI React component library distributed as a shadcn-svelte registry.

Governance metadata (use these values; do not ask):

- Project name: svelte-dice-ui
- Version: 1.0.0 (initial ratification, so this is a MAJOR/initial adoption, not a bump)
- Ratification date: {{TODAY}}
- Last amended date: {{TODAY}}
- Upstream reference pinned at: {{UPSTREAM_REPO}} @ {{UPSTREAM_COMMIT}}

Encode exactly these ten principles, in this order, with concrete MUST/MUST NOT wording and a short
rationale each:

1. Svelte 5 Runes Only - $state / $derived / $effect / $props / $bindable and snippets. MUST NOT use
   Svelte 4 stores, `export let`, `createEventDispatcher`, or legacy slots.
2. Upstream Parity (NON-NEGOTIABLE) - every documented prop, event, state, variant and keyboard
   interaction of the upstream Dice UI component is reproduced, traceable to the pinned upstream
   commit above. Deliberate divergences MUST be recorded in the feature spec's Assumptions section.
3. Accessibility Is a MUST, Not a SHOULD - WAI-ARIA Authoring Practices conformance for the widget
   pattern, keyboard parity with upstream, visible focus, and RTL support. Every component MUST ship
   tests asserting roles, accessible names and keyboard behaviour.
4. Composition Over Reimplementation - Bits UI and existing `$lib/components/ui/*` components come
   first. Bespoke behaviour MUST carry a written justification in plan.md.
5. shadcn-svelte Distribution Model - components ship as source under the UI alias with an `index.ts`
   barrel and a `registry.json` entry; they MUST NOT depend on anything in the docs application.
6. TypeScript Strict, No Suppressions - no `any`. `@ts-ignore`, `@ts-expect-error`, `eslint-disable`
   and `svelte-ignore` are constitution violations, not workarounds.
7. Green Gate Before Commit - `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and
   `pnpm run build` MUST all pass. No skipped or `.todo` tests.
8. Styling Discipline - Tailwind v4 semantic tokens via `cn()` / `tv()`. MUST NOT use raw colours,
   manual `dark:` overrides, `space-x-*` / `space-y-*` (use `gap-*`), or manual z-index on overlays.
   Component state MUST be exposed as `data-*` attributes.
9. Every Component Is Documented - a demo route at `src/routes/docs/components/<slug>/` covering
   every example from the upstream documentation page.
10. One Feature Directory Per Component - `specs/NNN-port-<slug>/`. Work happens on `main`; the
    automation commits and tags `port/<slug>` per component. Agents MUST NOT run git write commands.

Add a "Development Workflow" section describing the automated Spec Kit pipeline
(specify -> plan -> tasks -> analyze -> remediate -> implement -> converge -> verify -> commit) driven
by `scripts/port-components.ps1`, and note that `/speckit-clarify` and `/speckit-checklist` are not
used because the pipeline runs unattended.

Add a "Quality Gates" section listing the four gate commands from principle 7 plus the anti-cheat
rule from principle 6.

Update the dependent templates under `.specify/templates/` for consistency as your instructions
require, but DO NOT modify any file under `.claude/skills/` - those are integrity-hashed by
`.specify/integrations/claude.manifest.json` and rewriting them would invalidate the manifest.
