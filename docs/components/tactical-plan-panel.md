---
id: "tactical-plan-panel"
title: "Tactical plan panel"
description: "Stages named-driver tactical intent through Plan, evidence comparison, Review and explicit Follow-up."
kind: "component"
surface: "advanced"
source: "scripts/ui/tactical_plan_panel.gd"
symbol: "TacticalPlanPanel"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Tactical plan panel

Stages named-driver tactical intent through Plan, evidence comparison, Review and explicit Follow-up.

## Intent and purpose

Stages named-driver tactical intent through Plan, evidence comparison, Review and explicit Follow-up.

## User goals

Plan an undercut or later tyre offset against a named rival, compare alternatives, and approve the exact advice or pit-timing authority.

## Used components

Native driver/target/kind/authority `OptionButton`s, limit `SpinBox`/`CheckButton` fields, evidence `Label`s and explicit Compare/Approve/End/Reset `Button`s, built through [native control helpers](ui.md). End/Reset use its retained `ConfirmationDialog` implementation.

## Interactions

Driver, rival, tactic, lap window, reserves and contingencies form a local draft. Compare options validates it and freezes estimates; stale evidence requires refresh. Approve explicitly submits the frozen reviewed plan and revision/evidence guards. End plan and Reset draft use their own confirmation dialogs tied to driver/revision/plan. Cancel preserves the draft, validation reveals the offending field, and read-only Plan evidence opens the retained sequence rather than issuing a command.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Duel workspace binding](duel-workspace.md)
- [Strategy desk](strategy-desk.md)
- [Team orders panel](team-orders-panel.md)

## Behavior and state

configure accepts RaceViewQuery. compare_now freezes evidence; approve submits that exact reviewed authority, while end_plan has its own confirmation. Validation focuses the offending field, stale comparisons remain explicit and cancellation preserves the draft. Refresh never grants authority or silently replaces reviewed evidence.

## Source and integration

Implementation: [scripts/ui/tactical_plan_panel.gd](../../scripts/ui/tactical_plan_panel.gd) (`TacticalPlanPanel`, extends `VBoxContainer`).

Referenced by [scripts/ui/duel_workspace.gd](../../scripts/ui/duel_workspace.gd).

## Interface

Public presentation entry points:

- `configure(sim: RaceViewQuery) -> void`
- `refresh() -> void`
- `field(title: String, control: Control, parent: Node = null) -> void`
- `choose_driver(id: int) -> void`
- `changed() -> void`
- `change_kind() -> void`
- `toggle_limits() -> void`
- `edit_draft() -> void`

Emitted intent signals:

- `command_requested(action: String, payload: Dictionary)`
- `driver_selected(id: int)`
- `reading_requested(title: String, text: String, invoker: Control)`

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
