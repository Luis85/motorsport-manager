# Advisory code quality

## Run and read

```sh
python3 -m pip install -r requirements-quality.txt
python3 scripts/quality.py
python3 -m unittest discover -s tests -p 'test_quality.py'
```

The independent **Advisory code quality** Actions workflow runs on pushes and pull
requests. Findings and tool-infrastructure problems emit warnings, not merge
failures. The existing Godot verification and architecture checks are unchanged.
A green advisory job does **not** mean the code has no findings: read its job
summary and `quality-report` artifact. The checker tests also run in this workflow;
a failure produces an explicit warning and retains `self-tests.log`.

The artifact contains `quality.json`, `summary.md`, and one raw log per tool.
`analysis_complete` is false if analysis could not be performed reliably. A
missing executable, timeout, malformed tool output or runner failure is not a
clean finding set. Thirty individual warning annotations are emitted across rule
families; additional findings remain in full in JSON and tool logs.

## Project policy

`quality-policy.json` owns the executable budgets. Source files may contain at
most **400 physical code lines**; files under `tests/` at most **450**. Exactly
400/450 is allowed. Empty and comment-only lines do not count. Python
module/class/function documentation strings are excluded. Runtime strings count,
including `#` characters and nonempty lines inside a multiline string. Inline
comments do not make the code on the same line disappear.

The inventory covers project `.gd` and `.py` code, including nonignored untracked
local work. Data, Godot scenes, documentation and vendored/generated directories
listed in the policy are not treated as handwritten source. This is a physical
code-line budget, not a statement counter. Semicolon packing, removing useful
comments and broad exclusions are not accepted remediation. Split coherent
responsibilities while preserving ownership and regression coverage.

GDScript's `max-file-lines` linter rule is disabled because it counts the physical
file, not this project-specific definition. Other configured GDScript lint rules
remain active. Ruff checks Python correctness/style and complexity; gdtoolkit
checks GDScript style, formatting and cyclomatic complexity. Complexity above 15
is a review prompt. These metrics do not establish correctness, readability or
architecture by themselves.

## Initial debt and rollout

The recovered UI repair tree `7e5cf5a5fb4af99a2b9fd76df637454095b45f1a`
measured 265 source/test files, with these four size warnings:

| File | Code lines | Budget |
|---|---:|---:|
| `scripts/domain/race_sim.gd` | 752 | 400 |
| `scripts/ui/weekend.gd` | 619 | 400 |
| `scripts/ui/track_canvas.gd` | 593 | 400 |
| `scripts/ui/pitwall_workspace.gd` | 420 | 400 |

This is a dated review inventory, **not** a suppression baseline. Current Actions
reports always rescan the complete inventory, so new violations remain visible.
Prioritize changed hotspots and cohesive ownership splits over mechanical file
splitting or a repository-wide formatting commit. The scene shell and editor
controller are below the source budget after extracting presentation builders.

No scheduled enforcement ratchet is enabled. Switching advisory checks to
blocking checks requires an explicit project decision after triaging debt.
`python3 scripts/quality.py --strict` is an optional local failure mode; it is not
used by CI. `--loc-only` deliberately produces a partial report without the
external tools and is labeled incomplete. Neither mode replaces functional tests.

## Extending checks safely

Pin intentional tool updates in `requirements-quality.txt`, review resulting
report changes, and add adverse fixtures when changing counters or output parsers.
Keep source identity, bounded escaped annotations and raw logs. Never convert a
tool crash to success merely to keep the advisory job green. Detailed research and
UI-related decisions are in `docs/design/game-flow-coherence.md`; ongoing code and
UI working rules are in `AGENTS.md`.
