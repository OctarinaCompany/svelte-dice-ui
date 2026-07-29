/speckit-tasks Generate the dependency-ordered task list for the "{{NAME}}" port ({{FEATURE_DIR}}).

Requirements for the generated tasks.md:

- Every task names concrete file paths relative to the repository root.
- Phase order: Setup (dependencies, registry stub) -> Tests -> Core component files -> Barrel and
  types -> Demo route -> Registry entry and docs polish -> Verification.
- One task per exported subcomponent listed in the plan's "Public API" section.
- One test task per behavioural area: keyboard interaction, accessibility roles and names,
  controlled vs uncontrolled state, RTL, and edge cases.
- Mark genuinely independent tasks `[P]`. Tasks touching the same file are never `[P]`.
- Tests are REQUIRED for this project, not optional - the constitution mandates them.
- The final task must be exactly: run `pnpm run check`, `pnpm run lint`,
  `pnpm run test:unit -- --run` and `pnpm run build`, and fix everything that fails.

{{PROMPT_EXTRA}}
