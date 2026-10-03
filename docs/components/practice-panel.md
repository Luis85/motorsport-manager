---
id: "practice-panel"
title: "Practice run panel"
description: "Stages independent per-driver objectives, finite tyre-set choices, lap counts and setup baselines beside measured evidence."
kind: "component"
surface: "advanced"
source: "scripts/ui/practice_panel.gd"
symbol: "PracticePanel"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Practice run panel

Stages independent per-driver objectives, finite tyre-set choices, lap counts and setup baselines beside measured evidence.

## Intent and purpose

Stages independent per-driver objectives, finite tyre-set choices, lap counts and setup baselines beside measured evidence.

## User goals

Prepare each driver’s learning objective, real tyre set, measured lap count and setup baseline, then judge the retained measurements and resource cost.

## Used components

Native per-driver `Button`s, objective/set/baseline `OptionButton`s, lap `SpinBox`, evidence `ScrollContainer`/`Label`s and explicit Run/End session actions. [Native control helpers](ui.md) construct fields, and the retained confirmation dialog handles ending practice.

## Interactions

Driver selection preserves independent drafts. Objective, set, lap-count and baseline edits stage a run; Run submits practice_run after validation. Start practice, Recall and End practice are separate session/driver commands. End practice uses a confirmation; returning after practice results is explicit. Clean comparable evidence and missing evidence remain distinct.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Practice-capable weekend layout](practice-weekend-view.md)
- [Practice engineering layout](race-practice-workspace.md)
- [Practice programme card](race-practice-programme-card.md)
- [Advanced Tyres page](advanced-tyres-page.md)

## Behavior and state

configure accepts RaceViewQuery; choose_driver preserves each driver's draft. submit_run emits an explicit validated run request, while finish_session handles the session-end path. Refresh keeps edited drafts and distinguishes active runs, run limits, skipped/legacy practice and absent clean evidence.

## Source and integration

Implementation: [scripts/ui/practice_panel.gd](../../scripts/ui/practice_panel.gd) (`PracticePanel`, extends `VBoxContainer`).

Referenced by [scripts/ui/practice_weekend.gd](../../scripts/ui/practice_weekend.gd), [scripts/ui/race_weekend/practice_programme_card.gd](../../scripts/ui/race_weekend/practice_programme_card.gd).

## Interface

Public presentation entry points:

- `configure(value: RaceViewQuery) -> void`
- `refresh() -> void`
- `submit_run() -> void`
- `finish_session() -> void`
- `choose_driver(id: int) -> void`
- `update_draft(key: String, value: Variant) -> void`
- `has_user_edits() -> bool`
- `run_estimate_text() -> String`

Emitted intent signals:

- `command_requested(action: String, payload: Dictionary)`

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
