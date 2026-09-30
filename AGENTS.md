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
replay, result presentation or the standalone receipt archive. Weekend facts enter
through the immutable manifest/receipt boundary. Points eligibility, scoring and
financial values must be explicit versioned policy input. Stage time, standings,
returned resources, financial postings and the receipt on detached values, then
publish one complete checkpoint or none. Never infer component diagnoses or
consumption absent from the factual result, and never repair a partial campaign
projection by silently fabricating its missing event.

`CampaignCompetition` is the campaign sporting authority. New settlements require
an explicit series rule pack, accepted entry field, active ordered calendar and
the exact next-event manifest. Calendar dates/revisions/hashes and stable
person/team/car mappings must agree before consequences stage. Standings rebuild
from immutable awards; points then successive finishing counts determine order,
and unresolved ties stay shared. Do not assign a fabricated calendar or entry
registry to non-empty legacy sporting history. Provisional results, corrections,
season prizes and promotion require explicit later contracts rather than
approximation inside final-only settlement.

`CampaignEconomy` is the integer cash and binding-commitment authority. Cash,
open commitments, reserve policy and forecast assumptions are different values:
never make an unsigned offer, hypothetical prize or optimistic assumption
spendable. Every posting needs exactly one event or settled-commitment source and
must reconcile to opening cash. Commitments settle at their contractual due slot,
not when a report is opened. Finance history cannot be dated after campaign time;
planning changes freeze during an active weekend, while existing due obligations
continue inside the atomic return transaction. Payroll and recurring schedules
must create explicit dated commitments and must not also be charged through
project summaries. Legacy ledgers migrate losslessly from an explicit authority
slot; do not fabricate prior commitments.

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
