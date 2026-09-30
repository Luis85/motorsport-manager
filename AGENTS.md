# Repository working rules

## Protect the game contract

Read `docs/architecture-refactor.md` and the relevant feature guide before editing.
Keep domain dependencies inward. UI emits intent and renders detached values; it
must not tick a simulation, retain a live aggregate, mutate race/campaign
resources, or perform persistence directly. TrackEditorSession owns document
revisions and history. Existing sporting characterization, save compatibility and
the complete registered verification suite are mandatory. Do not weaken
assertions to fit UI.

The player-facing race interface defaults to Minimal: Send out, Box this lap,
Push, Calm, engine mode and the bounded read-only Strategy comparison. Advanced
may be selected explicitly and mounts the retained Race Director/Engineering
presentation over the same authoritative weekend. Neither interface may create a
second simulation, take time control during navigation, or bypass command and
persistence boundaries.

Campaign time is a separate dated-slot domain. It must not reuse the race tick,
read the wall clock, or place competition/economy consequences inside RaceSim,
replay, result presentation or the standalone receipt archive.

## UI changes

Use `GameTheme` through the existing UI/MinimalRaceStyle adapters for native
chrome; use `CircuitPalette` for illustrated-map ink. Do not introduce another
screen-local palette. Preserve full labels, keyboard focus, explicit disabled
reasons, and the selected text scale. Prefer spacing/reflow over smaller text.
Use the shared confirmation and file-dialog helpers. Destructive confirmations
start on Cancel; cancellation keeps the draft and restores the invoker's focus.
Test menus, setup, settings, editor, welcome, both pitwall modes and results
together.

## Size and maintainability budgets

`quality-policy.json` is the executable source of truth: at most **400 physical
code lines per source file** and **450 per test file**. Equality is permitted.
Blank lines, comments and Python module/class/function documentation strings are
excluded. Runtime string content is code, including multiline GDScript strings.
This is not a statement count. Do not delete useful comments, compress statements,
add blanket exclusions, or split files arbitrarily to satisfy the number.
Extract cohesive responsibilities with explicit ownership and regression tests.

The new quality workflow is advisory. Existing violations remain visible rather
than being hidden behind a baseline. New work should meet the budget; report and
explain any exception in the PR. No time-based enforcement ratchet is enabled.
Do not make these checks blocking without an explicit policy decision.

## Local checks

```sh
python3 -m pip install -r requirements-quality.txt
python3 scripts/quality.py
python3 -m unittest discover -s tests -p 'test_*.py'
python3 scripts/check_architecture.py
python3 scripts/verify.py --godot /path/to/pinned/godot
```

`quality.py` runs pinned GDScript/Python lint, check-only formatting and complexity
checks. It writes JSON, Markdown, complete findings and individual tool logs to
`reports/quality/`. `--loc-only` is explicitly partial analysis; `--strict` is an
optional local failure mode and is not used in CI. Missing/crashed tools are not
a clean result. Neither advisory quality nor a focused native test run replaces
the full six-shard Godot gate. Do not auto-format the entire legacy tree in an
unrelated feature change.

Include exact source identity, executed checks, skipped/unavailable checks and
native visual evidence in the handoff. Screenshots of synthetic fixture states
are not evidence of a completed physical race, campaign balance or human
usability validation.

Advisory rollout, report interpretation and the initial debt inventory: `docs/code-quality.md`.
