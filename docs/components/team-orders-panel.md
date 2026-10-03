---
id: "team-orders-panel"
title: "Team orders panel"
description: "Groups team instructions, battles, physical pit-box state and accepted-plan inspection."
kind: "component"
surface: "advanced"
source: "scripts/ui/team_orders_panel.gd"
symbol: "TeamOrdersPanel"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Team orders panel

Groups team instructions, battles, physical pit-box state and accepted-plan inspection.

## Intent and purpose

Groups team instructions, battles, physical pit-box state and accepted-plan inspection.

## User goals

Coordinate the two owned drivers, inspect their battles and shared box, and review accepted intent without assuming a guaranteed swap or service order.

## Used components

- [Physical pit-service panel](race-pit-service-panel.md)
- [Team intent timeline](race-team-intent-timeline.md)

## Interactions

Cooperate, Battles, Pit box and Plans switch topic evidence. Apply team instruction sends a named hold/yield draft; Cancel cooperation and Cancel pit priority explicitly revoke their respective orders. Named pit priority and stop cancellation remain command actions. Watch follows a car observationally; Review plan emits a strategy route. Refresh shows physical queue facts and estimated arrivals separately.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Strategy-capable weekend layout](strategy-weekend-view.md)
- [Strategy desk](strategy-desk.md)
- [Physical pit-service panel](race-pit-service-panel.md)
- [Team intent timeline](race-team-intent-timeline.md)

## Behavior and state

configure accepts RaceViewQuery; selections form a local draft until an explicit command_requested. watch_requested and plan_requested name a driver and delegate navigation. refresh preserves stable controls; cancellation uses the existing command boundary, not local removal of a binding order.

## Source and integration

Implementation: [scripts/ui/team_orders_panel.gd](../../scripts/ui/team_orders_panel.gd) (`TeamOrdersPanel`, extends `VBoxContainer`).

Referenced by [scripts/ui/strategy_weekend.gd](../../scripts/ui/strategy_weekend.gd).

## Interface

Public presentation entry points:

- `configure(value: RaceViewQuery) -> void`
- `refresh() -> void`
- `text(value: String, color: Color = UI.MUTED) -> Label`
- `show_topic(index: int) -> void`
- `draft() -> Dictionary`
- `cancel(key: String) -> void`
- `status_text(record: Dictionary, empty: String) -> String`

Emitted intent signals:

- `command_requested(action: String, payload: Dictionary)`
- `watch_requested(driver_id: int)`
- `plan_requested(driver_id: int)`

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
