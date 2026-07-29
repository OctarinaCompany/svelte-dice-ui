<!--
SYNC IMPACT REPORT
==================
Version change: (unversioned template) → 1.0.0
Bump rationale: Initial ratification. The file previously held only unfilled
placeholder tokens; this is the first adoption of a real constitution, not an
amendment of an existing one, so it starts at 1.0.0 (MAJOR/initial adoption).

Modified principles:
  [PRINCIPLE_1_NAME] → I. Svelte 5 Runes Only
  [PRINCIPLE_2_NAME] → II. Upstream Parity (NON-NEGOTIABLE)
  [PRINCIPLE_3_NAME] → III. Accessibility Is a MUST, Not a SHOULD
  [PRINCIPLE_4_NAME] → IV. Composition Over Reimplementation
  [PRINCIPLE_5_NAME] → V. shadcn-svelte Distribution Model

Added sections:
  Core Principles VI. TypeScript Strict, No Suppressions
  Core Principles VII. Green Gate Before Commit
  Core Principles VIII. Styling Discipline
  Core Principles IX. Every Component Is Documented
  Core Principles X. One Feature Directory Per Component
  Development Workflow  (replaces [SECTION_2_NAME])
  Quality Gates         (replaces [SECTION_3_NAME])
  Governance            (filled from [GOVERNANCE_RULES])

Removed sections: none

Templates requiring updates:
  ✅ .specify/templates/plan-template.md   — Constitution Check gate enumerated,
     Complexity Tracking retitled to reference principle numbers
  ✅ .specify/templates/spec-template.md   — Assumptions section now mandatory and
     required to record upstream divergences (Principle II)
  ✅ .specify/templates/tasks-template.md  — tests made mandatory (Principle III/VII),
     quality-gate task added to the final phase, git-commit note removed (Principle X)
  ✅ .specify/templates/checklist-template.md — reviewed, no principle-driven change needed
  ✅ .specify/templates/constitution-template.md — intentionally left as a blank template
  ⚠ .claude/skills/speckit-*/SKILL.md — intentionally NOT modified: these files are
     integrity-hashed by .specify/integrations/claude.manifest.json and rewriting them
     would invalidate the manifest. Reviewed for stale agent-specific references; the
     unattended-pipeline overrides (no /speckit-clarify, no interactive gates) are
     enforced by scripts/port-components.ps1 and by the Development Workflow section
     below instead.
  ✅ README.md — reviewed; no principle references present, no change required

Follow-up TODOs: none. No placeholder tokens remain.
-->

# svelte-dice-ui Constitution

`svelte-dice-ui` is a Svelte 5 port of the [Dice UI](https://diceui.com) React component library,
distributed as a [shadcn-svelte](https://shadcn-svelte.com) registry. Components ship as readable
source that consumers copy into their own projects.

**Upstream reference (pinned)**: <https://github.com/sadmann7/diceui> @ `d9763d82530416dfa4c81c462387b55d06bae4ec`

Every port is measured against that commit. A vendored, read-only copy lives at `.reference/diceui`.

## Core Principles

### I. Svelte 5 Runes Only

All reactive code MUST use the Svelte 5 runes API: `$state`, `$derived`, `$derived.by`, `$effect`,
`$effect.pre`, `$props`, `$bindable`, and snippets (`{#snippet}` / `{@render}`). Reactive logic that
is not markup MUST live in a `<slug>.svelte.ts` module, typically as a state class whose reactive
inputs are passed in as getter functions.

Components MUST NOT use Svelte 4 idioms: no `writable`/`readable`/`derived` stores, no `export let`,
no `createEventDispatcher`, no `$:` reactive statements, and no legacy `<slot>` elements or
`let:` slot props. Callback props (`onValueChange`) plus `$bindable` replace dispatched events.

**Rationale**: Runes are forced on repo-wide in `vite.config.ts`; mixing legacy idioms silently
disables fine-grained reactivity, breaks `bind:` on ported components, and produces source that no
longer reads like the shadcn-svelte components it ships alongside.

### II. Upstream Parity (NON-NEGOTIABLE)

Every documented prop, callback, controlled/uncontrolled mode, exposed state, variant, data
attribute, and keyboard interaction of the upstream Dice UI component MUST be reproduced. The
contract is the upstream MDX at `.reference/diceui/docs/content/docs/components/base/<name>.mdx`,
backed by the component source and its test file, all read at the pinned commit above.

Upstream JSDoc — including `@default` tags — MUST be copied onto the Svelte prop types. Every
deliberate divergence (an API renamed to fit Svelte, a prop dropped because bits-ui owns the
behaviour, a React-only escape hatch replaced by a snippet) MUST be recorded in the feature spec's
Assumptions section, with the reason and the upstream name it replaces. Undocumented drift is a
defect, not a design choice.

**Rationale**: The value of this library is that a developer who knows Dice UI already knows this
port. Silent API drift makes upstream documentation actively misleading and makes future
re-synchronisation against a newer upstream commit impossible to audit.

### III. Accessibility Is a MUST, Not a SHOULD

Each component MUST conform to the WAI-ARIA Authoring Practices pattern for its widget: correct
roles, correct `aria-*` wiring, accessible names, and correct label/description associations. Keyboard
support MUST match upstream key-for-key (`ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`, `Home`,
`End`, `Enter`, `Space`, `Escape`, `Backspace`, `Delete`, `Tab`, and any type-ahead). Focus MUST
remain visible, focus order MUST be predictable, and horizontal navigation MUST invert under
`dir="rtl"`.

Every component MUST ship colocated tests at `src/lib/components/ui/<slug>/<slug>.test.ts` asserting,
at minimum: roles and ARIA wiring, accessible names, keyboard behaviour driven through
`@testing-library/user-event`, RTL inversion, uncontrolled `defaultValue` behaviour, controlled
`value` + `onValueChange` behaviour, `disabled`/`readOnly` guard rails, and the documented error
thrown when a part is rendered outside its provider. The upstream test file's assertions are the
floor, not the ceiling.

**Rationale**: Dice UI's reason to exist is accessible behaviour; a port that keeps the markup and
loses the interaction model has ported nothing. Assertions are the only durable proof, because
accessibility regressions are invisible in a screenshot.

### IV. Composition Over Reimplementation

Behaviour MUST be sourced in this order: (1) an existing component under `src/lib/components/ui/*`,
(2) a `bits-ui` primitive, (3) bespoke code. Upstream behaviour imported from `@diceui/shared`
— collections, dismissible layers, anchor positioning, scroll locking, direction — almost always
already exists in `bits-ui` and MUST be composed rather than re-implemented.

Bespoke behaviour MUST carry a written justification in `plan.md` naming the primitive that was
evaluated and the specific capability it lacks. Running `shadcn-svelte add` mid-port is forbidden;
the base component set is already installed and MUST be composed as-is.

**Rationale**: Every hand-rolled focus trap, portal, or positioner is a permanent accessibility and
maintenance liability that duplicates audited upstream work. Requiring the justification in writing
makes the trade-off reviewable instead of accidental.

### V. shadcn-svelte Distribution Model

Components ship as **source**, not as a compiled package. Each component MUST live in exactly one
folder `src/lib/components/ui/<slug>/`, with one part per file named `<slug>-<part>.svelte` (root:
`<slug>.svelte`), reactive logic in `<slug>.svelte.ts`, and a public `index.ts` barrel exporting
short names, prefixed aliases, and prop types. Intra-repo imports MUST carry the `.js` extension.

Each component MUST append exactly one `registry:ui` entry to `registry.json` listing every file in
its folder except tests, with `name` equal to the folder slug and to the demo route segment, and
`pnpm run registry:build` MUST be run afterwards. Components MUST NOT import anything from the docs
application (`src/routes/**`, `src/lib/components/docs/**`) or depend on docs-only state — the
dependency arrow points from docs to component and never back.

**Rationale**: A registry item is copied verbatim into a consumer's repository. Any import that
reaches into the docs app, or any file missing from the registry entry, produces an install that
does not compile on the other side.

### VI. TypeScript Strict, No Suppressions

Source MUST type-check under the repository's strict configuration with zero errors and zero
warnings. `any` MUST NOT appear — neither as an annotation nor via `as any`. Props types MUST be
declared in `<script lang="ts" module>` and exported; DOM props MUST derive from
`WithElementRef<HTMLAttributes<…>>` so `ref` and `...restProps` stay typed.

`@ts-ignore`, `@ts-expect-error`, `eslint-disable` (in any form), and `svelte-ignore` are
**constitution violations, not workarounds**. Loosening `tsconfig.json`, the ESLint flat config, the
`svelte-check` invocation, or the Vitest config to make an error disappear is likewise a violation.
The cause is fixed, or the work is not done.

**Rationale**: Suppressions convert a one-line defect into a permanent, invisible one, and they
propagate into every consumer's codebase because this library ships source. An unattended pipeline
has no reviewer to notice the ignore comment.

### VII. Green Gate Before Commit

Before any component is considered complete, all four commands MUST pass:

```bash
pnpm run check              # svelte-kit sync && svelte-check
pnpm run lint               # prettier --check . && eslint .
pnpm run test:unit -- --run # vitest, single run
pnpm run build              # vite build
```

`pnpm run format` SHOULD be run first, because shadcn CLI and generator output is not
Prettier-formatted and would otherwise fail `lint`. Tests MUST NOT be skipped, marked `.todo`,
emptied of assertions, or deleted to reach green; `expect.requireAssertions` is enabled and every
`it` MUST assert. If a test genuinely encodes a wrong expectation, the test is corrected and the
reason stated in one line.

**Rationale**: These four commands are the entire safety net for an unattended pipeline. A gate that
is bypassed once is a gate that is bypassed for the remainder of the port.

### VIII. Styling Discipline

Classes MUST be composed with `cn()` from `$lib/utils.js`; multi-variant components MUST use `tv()`
from `tailwind-variants` declared in the module script and exported. The caller's `class` MUST be
destructured as `class: className` and merged **last** so consumers can always override.

Components MUST use Tailwind v4 semantic tokens only — `bg-background`, `text-muted-foreground`,
`border-border`, `bg-primary`, `text-destructive`. They MUST NOT use raw palette colours
(`bg-blue-500`, `text-gray-600`), manual `dark:` overrides (tokens already flip via CSS variables in
`src/app.css`), `space-x-*` / `space-y-*` (use `flex`/`grid` with `gap-*`), or manual `z-index` on
overlays (Dialog/Popover/Tooltip/Sheet own their stacking).

Every part MUST carry `data-slot="<slug>-<part>"`, and every piece of component state MUST be exposed
as a `data-*` attribute. Boolean data attributes MUST be written `cond ? '' : undefined` so the
attribute is absent when false and `data-[state]:` selectors behave.

**Rationale**: Consumers restyle these components; tokens and `data-*` hooks are the whole styling
API. Raw colours break theming, and state that is not surfaced as an attribute cannot be styled at
all without forking the file.

### IX. Every Component Is Documented

Each component MUST ship a demo route at `src/routes/docs/components/<slug>/+page.svelte`, where
`<slug>` equals the registry item name — the docs sidebar links there by construction. The page MUST
contain one `<ComponentPreview>` section per example on the upstream documentation page (one per
`.reference/diceui/docs/registry/bases/base/examples/<slug>-*-demo.tsx`), each titled and described,
using the shared harness from `$lib/components/docs/index.js`.

Demo state MUST be held in the page with runes; a demo MUST NOT introduce a `+page.ts` loader unless
the example genuinely requires data loading.

**Rationale**: The demo route is the port's acceptance evidence — it is where controlled bindings,
snippets, and keyboard behaviour are exercised end to end. Missing a demo means an upstream example
was never proven to work.

### X. One Feature Directory Per Component

Each component port MUST own exactly one feature directory `specs/NNN-port-<slug>/`, holding its
`spec.md`, `plan.md`, `tasks.md`, and checklists. `SPECIFY_FEATURE_DIRECTORY` and `SPECIFY_FEATURE`
are authoritative for the running phase; an agent MUST work in exactly that directory and MUST NOT
create another, renumber existing ones, or scan `specs/` to select a different feature.

All work happens on `main`. `scripts/port-components.ps1` owns the working tree: it commits after
each component and tags `port/<slug>`. Agents MUST NOT run git write commands — no `commit`, `add`,
`checkout`, `switch`, `branch`, `reset`, `stash`, `rebase`, `merge`, `push`, or `tag`. Read-only git
(`status`, `diff`, `log`, `rev-parse`, `ls-files`) is permitted. Agents MUST NOT create or modify
`.port-state.json`, `.port-state.lock`, `.port-logs/**`, `scripts/**`, `.claude/settings*.json`,
`.specify/scripts/**`, or anything under `.reference/`.

**Rationale**: The orchestrator reconstructs per-component history from its own commits and tags. An
agent that writes to the index, or spreads one component across two feature directories, corrupts
resume and retry for every component that follows.

## Development Workflow

Component ports run unattended through `scripts/port-components.ps1`, which drives one Spec Kit
pipeline per component and commits the result. The phases, in order:

| Phase         | Command              | Produces                                                               |
| ------------- | -------------------- | ---------------------------------------------------------------------- |
| **specify**   | `/speckit-specify`   | `spec.md` — user stories, functional requirements, Assumptions         |
| **plan**      | `/speckit-plan`      | `plan.md` — technical context, Constitution Check, structure           |
| **tasks**     | `/speckit-tasks`     | `tasks.md` — dependency-ordered, grouped by user story                 |
| **analyze**   | `/speckit-analyze`   | read-only cross-artifact consistency report with inline remediations   |
| **remediate** | —                    | edits to `spec.md` / `plan.md` / `tasks.md` resolving analyze findings |
| **implement** | `/speckit-implement` | component source, tests, demo route, `registry.json` entry             |
| **converge**  | `/speckit-converge`  | remaining unbuilt work appended to `tasks.md`, then implemented        |
| **verify**    | —                    | the four Quality Gates, run to green                                   |
| **commit**    | orchestrator         | commit on `main` + tag `port/<slug>`                                   |

Because the pipeline runs with no human in the loop:

- **`/speckit-clarify` is not used.** Ambiguity MUST be resolved by the agent from the feature
  description, the pinned upstream source, this constitution, and industry-standard defaults, and
  every resolution MUST be recorded in the spec's Assumptions section. A finished `spec.md` MUST
  contain zero occurrences of `[NEEDS CLARIFICATION`.
- **`/speckit-checklist` is not used** unless a phase explicitly invokes it.
- **Interactive gates are pre-approved.** Any instruction in a command, template, or checklist to ask
  the user, wait for approval, or present options MUST instead be resolved by the agent, which states
  the decision and its one-line rationale and continues to completion. A turn that ends in a question
  is a failed turn.
- **Every CLI invocation MUST be non-interactive and terminating** — `--run`, `--yes`, `--force`,
  `--no-input`. Watch modes, dev servers, and UI runners (`pnpm dev`, bare `vitest`,
  `playwright test --ui`, any `--watch`) MUST NOT be started.

## Quality Gates

A component is complete only when all four commands pass, in this order, from a clean tree:

1. `pnpm run check` — `svelte-kit sync && svelte-check --tsconfig ./tsconfig.json`, zero errors and
   zero warnings.
2. `pnpm run lint` — `prettier --check . && eslint .`, zero findings. Run `pnpm run format` before
   this gate rather than hand-fixing formatting.
3. `pnpm run test:unit -- --run` — Vitest single run, all tests passing, none skipped or `.todo`.
4. `pnpm run build` — `vite build` succeeds, including every demo route.

**Anti-cheat rule (Principle VI, restated as a gate condition).** A gate MUST NOT be made to pass by
suppression. The following make the gate result invalid regardless of exit code: `@ts-ignore`,
`@ts-expect-error`, `eslint-disable` in any form, `svelte-ignore`, `as any` or an `any` annotation,
`.skip` / `.todo` / `.only` on a test, deleting or emptying a test or its assertions, and loosening
`tsconfig.json`, the ESLint flat config, the Prettier config, the `svelte-check` invocation, or the
Vitest configuration. The root cause is fixed instead. A test that encodes a genuinely wrong
expectation MAY be corrected, provided the correction states in one line why the old expectation was
wrong.

## Governance

This constitution supersedes all other development practices, conventions, and habits in this
repository. Where `CLAUDE.md` elaborates on a principle it is binding guidance for day-to-day porting
work; where the two ever conflict, this constitution wins and `CLAUDE.md` MUST be corrected.

**Amendment procedure.** Amendments are made by editing `.specify/memory/constitution.md` through
`/speckit-constitution`. Each amendment MUST update the version line, update **Last Amended**, and
prepend a Sync Impact Report recording the version change, the principles modified, the sections
added or removed, and the status of every dependent template. Templates under `.specify/templates/`
MUST be brought into consistency in the same change. Files under `.claude/skills/` MUST NOT be
edited: they are integrity-hashed by `.specify/integrations/claude.manifest.json` and rewriting them
invalidates the manifest — encode agent-facing amendments in this document and in the orchestrator
instead.

**Versioning policy.** The constitution version follows semantic versioning:

- **MAJOR** — a principle is removed or redefined in a backward-incompatible way, or governance
  changes such that already-completed ports would no longer comply.
- **MINOR** — a principle or section is added, or existing guidance is materially expanded.
- **PATCH** — clarifications, wording, typo and formatting fixes with no change in obligation.

**Upstream pin.** The pinned upstream commit is part of the contract of Principle II. Moving the pin
is at least a MINOR amendment, MUST update the pin in this document and in the vendored
`.reference/diceui` copy together, and MUST list which already-ported components need
re-verification against the new commit.

**Compliance review.** `/speckit-plan` MUST fill its Constitution Check with a per-principle verdict
before Phase 0 research and re-check it after Phase 1 design. `/speckit-analyze` MUST report any
artifact that contradicts a principle as a finding with a concrete remediation. Any violation carried
forward MUST be recorded in `plan.md` under Complexity Tracking with the principle number, why it is
needed, and why the compliant alternative was rejected — an unrecorded violation blocks the commit
phase. Principles II, VI and VII admit no exception and MUST NOT appear in Complexity Tracking.

**Version**: 1.0.0 | **Ratified**: 2026-07-29 | **Last Amended**: 2026-07-29
