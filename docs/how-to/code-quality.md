# Advisory code quality

## Run and read

```sh
python3 -m pip install -r requirements-quality.txt
python3 scripts/quality.py
python3 -m unittest discover -s tests -p 'test_quality*.py'
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
most **400 physical code lines**; test files at most **450**. Exactly
400/450 is allowed. Empty and comment-only lines do not count. Python
module/class/function documentation strings are excluded. Runtime strings count,
including `#` characters and nonempty lines inside a multiline string. Inline
comments do not make the code on the same line disappear.

The inventory covers project `.gd`, `.py` and TypeScript (`.ts`, `.cts`, `.mts`,
including `.d.ts` declarations) code, including nonignored untracked local work.
Data, Godot scenes, documentation and the vendored/generated directories listed
in `excluded_directories` (`vendor/`, `node_modules/`, `.generated/`, `dist/`,
`bin/`, `demos/` and similar) are not treated as handwritten source. This is a
physical code-line budget, not a statement counter. Semicolon packing, removing useful
comments and broad exclusions are not accepted remediation. Split coherent
responsibilities while preserving ownership and regression coverage.

## TypeScript

The standalone Wildlands and Scene Forge projects are measured with the same
budgets. A TypeScript line is code when it holds any token that is not a comment
or whitespace: string and template literal content is code (including every
nonempty line of a multi-line template and its `${...}` holes), `//` and `/* */`
comments, JSDoc included, are not, and regular-expression literals are code. A
`/` is read as a regular expression only where an expression may begin, using the
previous significant token, so division and comment markers inside a regular
expression are not mistaken for comments. An unterminated string, template,
comment or regular expression makes analysis incomplete; it is never counted as
zero. The reader needs no Node.js or external tool and agrees exactly with a
TypeScript-compiler-based count (with JSDoc treated as comments) on every
handwritten file in both projects.

Tests are recognised by policy, not by hard-coded paths: everything under a
`test_roots` directory (`tests/`) and every path matching a `test_patterns` glob
(`*` stays within one path segment, `**` spans segments). The patterns cover the
Wildlands Node checks (`source/wildlands/source/test-*.cts`), their shared
`test-support/` helpers, the whole `source/wildlands/source/verification/` tree
(browser suites, companion check modules, fixtures and the gate runner, none of
which ships) and Scene Forge's `tests/` tree. Every other TypeScript file,
including the CLI tools and `.d.ts` contracts, uses the source budget.

TypeScript lines longer than the `long_lines` width (160 characters, comments
included) are reported as advisory `long-line` warnings, because a size budget can
otherwise be met by packing statements onto one line. Wrap or extract by
structure instead. The summary shows files, budget overruns and long lines per
language. Existing TypeScript debt stays visible in every report; there is no
baseline that hides it, and like every other check it is a warning, not a gate.
A policy change makes the base/candidate comparison report "not comparable"
rather than inventing new or resolved debt.

## Linters

GDScript's `max-file-lines` linter rule is disabled because it counts the physical
file, not this project-specific definition. Other configured GDScript lint rules
remain active. Ruff checks Python correctness/style and complexity; gdtoolkit
checks GDScript style, formatting and cyclomatic complexity. Complexity above 15
is a review prompt. No TypeScript linter or formatter runs in this workflow;
TypeScript type checks and architecture rules stay in each project's own gate.
These metrics do not establish correctness, readability or architecture by
themselves.

## Historical rollout and closure

The [rollout record](../_archive/maintenance/quality-rollout.md) preserves original
debt and source-pinned PR #29 results. Consult a fresh complete report for the
current checkout; earlier zero-finding counts are not a continuing guarantee.

## Enforcement remains advisory

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
UI-related decisions are in `docs/_archive/design/game-flow-coherence.md`; ongoing code and
UI working rules are in `AGENTS.md`.
