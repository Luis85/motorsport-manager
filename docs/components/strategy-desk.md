---
id: "strategy-desk"
title: "Strategy desk"
description: "Groups per-driver reading, local stop-plan drafts and explicit control/delegation actions."
kind: "component"
surface: "advanced"
source: "scripts/ui/strategy_desk.gd"
symbol: "StrategyDesk"
status: "implemented"
source_pr: 28
source_commit: "dfb7cead8f01ea9b0b42a4b936b1d4c4e9bf21fa"
extends: "StrategyDeskPresentation"
---

# Strategy desk

Groups per-driver reading, local stop-plan drafts and explicit control/delegation actions.

## Intent and purpose

Groups per-driver reading, local stop-plan drafts and explicit control/delegation actions.

## User goals

Compare alternatives, draft finite-set stop windows, and choose which pace, engine, pits, racecraft and qualifying channels the player or engineer owns.

## Used components

- [Strategy schedule chart](race-strategy-chart.md)

## Interactions

Compare, Plan and Control keep driver-specific drafts. Edit starting set/objective/up to three stop windows without fitting tyres or delegating authority. Approve plan explicitly submits a validated plan; Clear plan takes manual pit ownership. Forecast Box commits the displayed safe entry/set rather than approving the draft. Control changes and temporary resource intents are separate explicit commands; Refresh preserves edited drafts.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Engineering pitwall layout](pitwall-workspace.md)
- [Decision review drawer](race-decision-drawer.md)
- [Advanced Tyres page](advanced-tyres-page.md)
- [Team orders panel](team-orders-panel.md)
- [Strategy schedule chart](race-strategy-chart.md)

## Behavior and state

configure binds RaceViewQuery. show_topic selects Read/Plan/Control; editing remains local until apply/Approve. Forecast previews do not fit tyres or create a physical pit call. refresh preserves edited per-driver drafts and has_user_edits supports leave confirmation.

## Source and integration

Implementation: [scripts/ui/strategy_desk.gd](../../scripts/ui/strategy_desk.gd) (`StrategyDesk`, extends `StrategyDeskPresentation`).

Referenced by [scripts/ui/recovery_panel.gd](../../scripts/ui/recovery_panel.gd), [scripts/ui/strategy_weekend.gd](../../scripts/ui/strategy_weekend.gd), [scripts/ui/team_orders_panel.gd](../../scripts/ui/team_orders_panel.gd), [scripts/ui/weather_panel.gd](../../scripts/ui/weather_panel.gd), [scripts/ui/weather_weekend.gd](../../scripts/ui/weather_weekend.gd).

## Interface

Public presentation entry points:

- `configure(sim: RaceViewQuery) -> void`
- `refresh(force: bool = false) -> void`
- `stack_field(parent: Node, text: String, control: Control) -> void`
- `show_topic(index: int) -> void`
- `select_driver(id: int) -> void`
- `populate_sets(control: OptionButton, selected: String) -> void`
- `new_draft(template: String) -> void`
- `load_current(discard: bool) -> void`

Emitted intent signals:

- `command_requested(action: String, payload: Dictionary)`
- `preview_changed(forecast: Dictionary)`

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
