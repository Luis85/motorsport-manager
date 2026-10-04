---
id: "scenario-author"
title: "Scenario author dialog"
description: "Stages a challenge brief around a frozen ScenarioDraft in a native confirmation dialog."
kind: "component"
surface: "advanced"
source: "scripts/ui/scenario_author.gd"
symbol: "ScenarioAuthor"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "ConfirmationDialog"
---

# Scenario author dialog

Stages a challenge brief around a frozen ScenarioDraft in a native confirmation dialog.

## Intent and purpose

Stages a challenge brief around a frozen ScenarioDraft in a native confirmation dialog.

## User goals

Describe a challenge and two approaches around a frozen replay/sandbox state with an explicit observational goal and limitations.

## Used components

A native `ConfirmationDialog` containing `LineEdit`, `TextEdit`, `OptionButton`, labels and vertically scrolling brief content, built through [native control helpers](ui.md). ScenarioDraft supplies frozen entry/goal validation.

## Interactions

Edit bounded title, briefing, approaches, hint and goal fields. Export scenario validates the brief and builds data from ScenarioDraft, emitting scenario_ready for the host export route. Invalid data keeps the form open with a notice; Cancel frees the draft dialog. This dialog has no tactical commands and cannot force an outcome.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Replay and sandbox](replay-workspace.md)
- [Authored scenario selector](content-scenario-controls.md)

## Behavior and state

configure receives the draft plus optional existing authored values. submit validates and emits scenario_ready(data); the host handles export. Naming objectives or reading the frozen entry does not issue simulation commands or turn observed goals into rewards.

## Source and integration

Implementation: [scripts/ui/scenario_author.gd](../../../scripts/ui/scenario_author.gd) (`ScenarioAuthor`, extends `ConfirmationDialog`).

Referenced by [scripts/ui/replay_workspace.gd](../../../scripts/ui/replay_workspace.gd).

## Interface

Public presentation entry points:

- `configure(draft: ScenarioDraft, existing: Dictionary = {}) -> void`
- `submit() -> void`

Emitted intent signals:

- `scenario_ready(data: Dictionary)`

## Related documentation

- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
