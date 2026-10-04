# Strategy analysis

> **Historical record.** Scope, version claims and validation below belong to the
> named milestone. See [current project status](../../../reference/current-state.md)
> and [the documentation index](../../../README.md) for current behavior.


## Integrated components

StrategyDesk + PitwallComparison + RaceStrategyChart + RaceAnalysisWorkspace.

## Information contract

Compare shows three actual forecast candidates, low/high remaining time, rejoin and net pit loss. Plan edits starting set, 0–3 windows, objectives and reserves. Control exposes current domain ownership and bounded overrides. The timeline draws candidate supplied stops against race-distance laps.

## Interaction and safety

Focus reuses the same inspector and fixed approvals; no separate strategy draft is created. A chart toggle exposes detailed schedules. Estimates hold stated assumptions, not predicted rival stops or probabilities. Drafts are labeled unapplied until approval; stale revisions remain guarded.

## Shared acceptance

Use the [layout](layout-system.md), [responsive](responsive-behaviour.md), [accessibility](accessibility.md) and [interaction](interaction-model.md) contracts. Rendering this screen does not create a command or alter pause/speed. Actual executable coverage is recorded in [verification](verification-completion.md).
