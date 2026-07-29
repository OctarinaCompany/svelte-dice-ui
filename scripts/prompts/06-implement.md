/speckit-implement Implement the "{{NAME}}" port for feature {{FEATURE_DIR}}.

The pre-flight checklist gate is PRE-APPROVED: print the table, then proceed without asking.

Reminders that override anything ambiguous in tasks.md:

- Svelte 5 runes only, TypeScript strict, and the shadcn-svelte rules files obeyed verbatim
  (`.agents/skills/shadcn-svelte/rules/*.md`).
- Before writing each subcomponent, re-read the corresponding upstream React file so the behaviour
  matches rather than approximates:
  {{SOURCE_PATHS}}
  Upstream documentation (MDX), for the demo page examples: {{DOCS_MDX}}
- Read two or three already-ported components under `src/lib/components/ui/` and match their file
  layout, naming, barrel shape, styling approach and test style exactly.
- Mark each task "[X]" in tasks.md as you complete it, not in a batch at the end.
- Add the registry entry for "{{SLUG}}" to `registry.json`.
- Do not start a dev server or a watcher. Do not touch git.
- When every task is done, run these in order and fix everything that fails before ending your turn:
  pnpm run check
  pnpm run lint
  pnpm run test:unit -- --run
  pnpm run build

{{PROMPT_EXTRA}}
