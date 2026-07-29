/speckit-specify Port the Dice UI React component "{{NAME}}" (slug: {{SLUG}}) to this SvelteKit + shadcn-svelte project.

FEATURE SCOPE - AUTHORITATIVE, DO NOT DEVIATE
SPECIFY_FEATURE_DIRECTORY = {{FEATURE_DIR}}
SPECIFY_FEATURE = {{FEATURE_LABEL}}
The feature directory and a spec.md template stub already exist. Fill that spec.md in place. Do not
create, number, or move any other feature directory.

READ FIRST, IN THIS ORDER

1. The upstream React source, vendored read-only in this repository:
   {{SOURCE_PATHS}}
   If any of those paths do not exist, glob `.reference/diceui` for "{{SLUG}}" and read what you find
   (the registry component, any standalone package, the examples, and any test file).
2. The upstream documentation page, available locally as MDX (read the file; do not fetch the web):
   {{DOCS_MDX}}
   Canonical URL for reference only: {{DOCS_URL}}
3. `.specify/memory/constitution.md` - project principles, non-negotiable.
4. `CLAUDE.md` and `components.json` - project conventions and path aliases.
5. `.agents/skills/shadcn-svelte/SKILL.md` and its `rules/*.md`.
6. `src/lib/components/ui/` - the components already ported. Match their conventions.

WHAT "PORT" MEANS IN THIS PROJECT
This is the binding scope. Keep the spec's wording user-focused and technology-agnostic where the
template asks for it, but every item below must be covered by requirements and success criteria.

- Behavioural parity: every documented behaviour, state, variant, prop, event and slot of the
  upstream component is reproduced for Svelte consumers.
- Accessibility parity: the same ARIA roles, states, properties, focus management and keyboard
  interactions as upstream, at minimum. Where upstream is weaker than the WAI-ARIA Authoring
  Practices pattern for this kind of widget, follow the APG instead.
- Internationalisation: right-to-left layouts work, using the project's existing direction context
  where one applies.
- Distribution parity: the component ships as source under the project's UI alias directory with an
  index barrel, and is installable through the project's own component registry, exactly like a
  first-party shadcn-svelte component.
- Documentation parity: a demo page exists that exercises every example shown on the upstream docs
  page.
- Composition first: any capability already provided by the project's existing UI components, or by
  the underlying headless primitive library, is composed rather than re-implemented.

EXPLICITLY OUT OF SCOPE

- Any other component listed in scripts/components.json.
- Changes to the Tailwind theme, base colours, or global CSS.
- Visual redesign: match upstream's visual behaviour, adapted to this project's design tokens.
- React compatibility shims of any kind.

{{PROMPT_EXTRA}}

Write the specification now. Resolve every ambiguity yourself and record the decision under
Assumptions. The finished spec must contain no [NEEDS CLARIFICATION] markers, and
{{FEATURE_DIR}}/checklists/requirements.md must end with every item checked.
