# Porting automation

Drives Claude Code in headless mode through the full Spec Kit cycle to port the
Dice UI React components to shadcn-svelte, one component at a time, unattended.

## Files

| Path                         | Purpose                                                                     |
| ---------------------------- | --------------------------------------------------------------------------- |
| `components.json`            | The 38-component manifest. **Execution order is array order.** Edit freely. |
| `port-components.ps1`        | The orchestrator.                                                           |
| `bootstrap.ps1`              | Phase 0: scaffolds the project. Run once.                                   |
| `lib/port-common.ps1`        | Shared helpers (process runner, state file, parsing). Functions only.       |
| `prompts/`                   | The system prompt and one template per phase. This is what you tune.        |
| `headless-settings.json`     | `--settings` profile: no hooks, no MCP plugins, no model pin.               |
| `port-permissions.json`      | Optional scoped-allowlist profile (`-PermissionProfile allowlist`).         |
| `tests/Test-PortHelpers.ps1` | Tier 0 unit tests. No API calls.                                            |

Generated at runtime, all gitignored: `.port-state.json`, `.port-state.lock`,
`.port-logs/`, `.reference/diceui/`.

## Quick start

```powershell
# 1. Validate everything without spending a cent
pwsh -File ./scripts/tests/Test-PortHelpers.ps1
pwsh -File ./scripts/port-components.ps1 -DryRun

# 2. Scaffold the project (SvelteKit + Tailwind v4 + shadcn-svelte + docs + CLAUDE.md)
pwsh -File ./scripts/bootstrap.ps1

# 3. Smoke-test one phase on one component
pwsh -File ./scripts/port-components.ps1 -Only status -Phases specify

# 4. Full pipeline on the easiest component
pwsh -File ./scripts/port-components.ps1 -Only status

# 5. Go / no-go: wave 0 plus the start of wave 1
pwsh -File ./scripts/port-components.ps1 -From direction-provider -To gauge

# 6. Turn it loose (add -Model sonnet to fit more into each plan usage window)
pwsh -File ./scripts/port-components.ps1
```

## How it works

Per component: `create-feature → specify → plan → tasks → analyze → remediate →
implement → verify (+ bounded fix loop) → converge → commit`.

Every Claude phase is a **fresh `claude -p` process**. Nothing is resumed across
phases: Spec Kit reads its state off disk, so a fresh session is both cheaper and
more robust (idempotent retries, per-phase logs and costs, no mid-`implement`
compaction). Continuity comes from `SPECIFY_FEATURE_DIRECTORY` and
`SPECIFY_FEATURE`, set in the **child process environment**, which
`.specify/scripts/powershell/common.ps1` prioritises over `.specify/feature.json`.

`.specify/feature.json` is a single global pointer, so runs must be sequential.
A `FileShare.None` lock on `.port-state.lock` enforces that.

### The three human gates that are neutralised

1. `speckit-specify` emits a Q1/Q2/Q3 clarification table and waits.
2. `speckit-implement` **STOPs and asks `(yes/no)`** if any item under
   `specs/<dir>/checklists/` is unchecked — and `specify` always creates that
   checklist. This is the highest-risk gate.
3. `speckit-analyze` ends with a remediation question; it is read-only by
   contract, so remediation is a separate phase driven by `--json-schema` output.

`speckit-clarify` and `speckit-checklist` are interactive by design and are never
invoked.

`prompts/system-noninteractive.txt` neutralises all of it. Three independent
detectors catch a phase that asked a question anyway: the missing
`PHASE_RESULT: SUCCESS` marker, a regex heuristic, and — the ground truth —
the per-phase **artifact contracts** in `Test-PhaseArtifacts`. The strongest
no-op detector is hashing `spec.md` against the template: the CLI can exit 0 with
`is_error: false` and the file present, and still nothing happened.

## Resuming and failures

**Resume is the default.** Phases already marked `done` in `.port-state.json` are
skipped; `-Force` re-runs them.

A component that fails after `-MaxRetries` is marked `failed`, its spec artifacts
are preserved in a `wip(<slug>)` commit, and the working tree is rolled back to
the last good commit — a half-implemented component left in the tree would break
the next component's build and cascade. `-StopOnFailure` aborts instead and
leaves the tree for inspection.

Non-retryable failures: `auth-or-quota` (aborts the whole run), `bad-model`,
`phase-budget`.

Every component gets a commit and a `port/<slug>` tag, so any damage is one
`git reset --hard port/<previous>` away.

## Billing and usage limits

The orchestrator reads `claude auth status` at startup and adapts.

**Subscription login** (`authMethod: claude.ai`, i.e. Pro/Max) — the default when
no `ANTHROPIC_API_KEY` is set. Usage is billed against the plan's limits, not per
token, so `--max-budget-usd` and the dollar accumulator are switched off
automatically: they would measure nothing. The real regulator becomes the
**usage-limit waiter**.

When a phase hits a plan limit, that is treated as a _wait_, not a failure:

- it does **not** consume one of the `-MaxRetries` attempts;
- the reset time is parsed out of the error when the message carries one
  (`Claude AI usage limit reached|<unix ts>`, or an ISO `resets at ...`), and the
  run sleeps until then; otherwise it sleeps `-RateLimitWaitMinutes` (20) and
  probes again;
- a single sleep is capped at 6 hours so a bogus timestamp cannot park the run,
  and `-MaxRateLimitWaits` (36) bounds the total;
- sleeping happens in one-minute slices, so `Ctrl-C` stays responsive.

## Model selection

Three levels, in increasing order of precedence:

1. **Default map** — Sonnet for `specify` / `tasks` / `remediate`, Opus for
   `plan`, `analyze`, `implement`, `fix`, `converge`.
2. **`-Economy`** — complexity-aware. `implement` / `fix` / `converge` drop to
   Sonnet for **S**-complexity components only; **M** and **L** stay on Opus.
   `plan` and `analyze` are never downgraded.
3. **`-Model <name>`** — overrides everything, including `analyze`.

`pwsh -File ./scripts/port-components.ps1 -DryRun -Economy` prints the resolved
model and effort per phase and complexity before you spend anything.

Why `plan` and `analyze` stay strong:

- `plan` decides the public API, the React→Svelte translation, and **which modules
  get extracted for later components to reuse** (`sortable`'s DnD core that
  `kanban` imports, `mask-input`'s formatter that `phone-input` imports,
  `color-swatch`'s colour helpers that `color-picker` imports). A weak decision
  here costs several components, not one.
- `analyze` looks for what is _missing_. A weak answer is invisible: it returns
  `verdict: ready`, the `remediate` phase is skipped, and nothing downstream
  notices. It is also short and writes no code, so keeping it strong is cheap.

Be clear-eyed about the trade-off: `-Economy` is a **quality-preserving trim, not
a large usage reduction** — only the 10 S-complexity components change behaviour,
and those are the cheap ones anyway. For a real reduction use `-Model sonnet`.

The relevant risk with a weaker model is not visibly broken code — it is **silent
under-delivery**: fewer edge cases, thinner tests, missing keyboard interactions.
The verification gate cannot catch that, because it is self-referential: the tests
it runs were written by the same model that wrote the component. Model strength
sets the quality floor, and no gate raises it.

Opus has a tighter allowance than Sonnet on subscription plans, so this choice is
what determines how many usage windows the 38 components take.

**API-key login** — dollar guards are active. `--max-budget-usd` caps every call,
scaled by the manifest's `complexity` field (S ×1, M ×1.5, L ×2.5).
`-TotalBudgetUsd` is the orchestrator's own accumulator; it aborts cleanly
**between phases**, so the state file always describes a valid boundary. The dry
run prints the worst case — the sum of the caps, not a spend estimate.

## Watching a long run

```powershell
Get-Content -Wait .port-logs/<slug>/06-implement.log      # implement/fix stream live
Get-Content .port-state.json | ConvertFrom-Json | ForEach-Object { $_.components }
```

After each component, check `.port-logs/<slug>/*.result.json` for `num_turns`
spikes (60 turns means the model is thrashing) and for
`subtype: error_max_turns`.

## Tuning

The first three components will reveal what the model gets wrong. Fix it in
`prompts/*.md` and in each component's `promptExtra` field in `components.json` —
never by editing the state machine. `CLAUDE.md` (written by bootstrap) is loaded
into every session and is the cheapest place to encode a convention.
