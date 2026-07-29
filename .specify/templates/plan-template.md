# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]

**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]

**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]

**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]

**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]

**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]

**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]

**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]

**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Record a verdict (PASS / VIOLATION) plus one line of evidence for each principle of
`.specify/memory/constitution.md`. Principles II, VI and VII admit no exception — a VIOLATION there
blocks the plan.

| #    | Principle                           | Verdict | Evidence                                                               |
| ---- | ----------------------------------- | ------- | ---------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 |         | [runes + snippets only; state class in `<slug>.svelte.ts`]             |
| II   | Upstream Parity (NON-NEGOTIABLE)    |         | [upstream files read at the pinned commit; divergences in Assumptions] |
| III  | Accessibility Is a MUST             |         | [ARIA pattern, keyboard map, RTL, required test areas]                 |
| IV   | Composition Over Reimplementation   |         | [primitive composed, or written justification below]                   |
| V    | shadcn-svelte Distribution Model    |         | [folder layout, `index.ts` barrel, `registry.json` entry, no docs dep] |
| VI   | TypeScript Strict, No Suppressions  |         | [no `any`, no ignore comments, no config loosening]                    |
| VII  | Green Gate Before Commit            |         | [four gate commands planned; no skipped tests]                         |
| VIII | Styling Discipline                  |         | [semantic tokens via `cn()`/`tv()`, `data-slot`, `data-*` state]       |
| IX   | Every Component Is Documented       |         | [one `<ComponentPreview>` per upstream demo file]                      |
| X    | One Feature Directory Per Component |         | [work confined to this directory; no git write commands]               |

**Bespoke behaviour justification (Principle IV)**: [For each hand-written behaviour, name the
`bits-ui` / `$lib/components/ui/*` primitive evaluated and the specific capability it lacks. Write
"None — all behaviour composed" if nothing is bespoke.]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete file list
  for this component. The layout is fixed by constitution Principles V and IX -
  one folder per component, one part per file, colocated tests, one demo route,
  one registry entry. Expand `<slug>` and the real part names.
-->

```text
src/lib/components/ui/<slug>/
├── index.ts                    # barrel: short names + prefixed aliases + prop types
├── <slug>.svelte               # Root
├── <slug>-<part>.svelte        # one file per part
├── <slug>.svelte.ts            # state class(es) + Symbol context key (runes module)
└── <slug>.test.ts              # colocated tests (NOT listed in registry.json)

src/routes/docs/components/<slug>/
└── +page.svelte                # one <ComponentPreview> per upstream demo file

registry.json                   # append exactly one registry:ui entry
```

**Structure Decision**: [Name every part file and map it to its upstream counterpart under
`.reference/diceui`. Confirm the demo route slug equals the folder slug equals the registry
item name.]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified.** An unrecorded violation
> blocks the commit phase. Principles II, VI and VII MUST NOT appear here — they admit no exception.

| Principle | Violation                       | Why Needed         | Compliant Alternative Rejected Because    |
| --------- | ------------------------------- | ------------------ | ----------------------------------------- |
| [e.g. IV] | [e.g. hand-rolled positioner]   | [current need]     | [why the bits-ui primitive is not enough] |
| [e.g. IX] | [e.g. upstream demo not ported] | [specific problem] | [why the demo cannot be reproduced]       |
