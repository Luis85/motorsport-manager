---
id: "race-practice-programme-card"
title: "Practice programme card"
description: "Reuses PracticePanel for visual objective choices and one driver's real run draft and measured report."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/practice_programme_card.gd"
symbol: "RacePracticeProgrammeCard"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "PracticePanel"
---

# Practice programme card

Reuses PracticePanel for visual objective choices and one driver's real run draft and measured report.

## Intent and purpose

Reuses PracticePanel for visual objective choices and one driver's real run draft and measured report.

## User goals

Choose a visual practice objective for one driver and relate the selected programme to actual measured laps, clean samples and retained setup.

## Used components

- [Practice run panel](practice-panel.md)

## Interactions

Objective buttons update the inherited per-driver draft. Finite tyre set, lap count and setup baseline share PracticePanel validation and commands. Run/Recall remain explicit actions; finished runs show recorded setup and observed cost instead of a new proposal. Run assumptions & limits opens read-only explanatory evidence.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Practice engineering layout](race-practice-workspace.md)
- [Practice run panel](practice-panel.md)
- [Practice-capable weekend layout](practice-weekend-view.md)

## Behavior and state

It inherits the same run validation and command signal; the full dashboard hides the duplicate driver selector. Refresh distinguishes draft preparation from active/latest/completed runs and reports clean samples and observed resource costs. No second practice controller or hidden setup score exists.

## Source and integration

Implementation: [scripts/ui/race_weekend/practice_programme_card.gd](../../scripts/ui/race_weekend/practice_programme_card.gd) (`RacePracticeProgrammeCard`, extends `PracticePanel`).

Referenced by [scripts/ui/race_weekend/practice_workspace.gd](../../scripts/ui/race_weekend/practice_workspace.gd).

## Interface

Public presentation entry points:

- `refresh() -> void`

No custom intent signals are declared by this script.

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
