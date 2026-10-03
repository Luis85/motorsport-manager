---
id: "strategy-weekend-view"
title: "Strategy-capable weekend layout"
description: "Adds strategy, debrief, team/battle panels and observational battle/rejoin overlays to WeekendView."
kind: "layout"
surface: "advanced"
source: "scripts/ui/strategy_weekend.gd"
symbol: "StrategyWeekendView"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "WeekendView"
---

# Strategy-capable weekend layout

Adds strategy, debrief, team/battle panels and observational battle/rejoin overlays to WeekendView.

## Intent and purpose

Adds strategy, debrief, team/battle panels and observational battle/rejoin overlays to WeekendView.

## User goals

Relate each owned driver’s plan and decision to team cooperation, pit trade-offs and measured consequences.

## Used components

- [Base Advanced weekend layout](weekend-view.md)
- [Strategy desk](strategy-desk.md)
- [Team orders panel](team-orders-panel.md)
- [Battle overlay](battle-overlay.md)
- [Pit rejoin overlay](rejoin-overlay.md)

## Interactions

Compare opens the selected driver’s strategy. Box this lap, Release now, Recall, Keep plan and More actions route explicit named payloads through the application command adapter. Team Watch selects and follows the observed car without changing time. The rejoin Layers toggle is visual. Debrief export uses the injected presentation service and does not rewrite result history.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Strategy desk](strategy-desk.md)
- [Team orders panel](team-orders-panel.md)
- [Advanced debrief page](advanced-debrief-page.md)
- [Weather-capable weekend layout](weather-weekend-view.md)

## Behavior and state

open_strategy targets an owned driver; targeted_command passes explicit payloads through the inherited command adapter. Approval, Box and Keep plan remain distinct actions. Refresh reads existing strategy evidence and export uses the presentation port; navigation alone never advances time.

## Source and integration

Implementation: [scripts/ui/strategy_weekend.gd](../../scripts/ui/strategy_weekend.gd) (`StrategyWeekendView`, extends `WeekendView`).

Referenced by [scripts/ui/weather_weekend.gd](../../scripts/ui/weather_weekend.gd).

## Interface

Public presentation entry points:

- `refresh() -> void`
- `update_more_actions(id: int) -> void`
- `open_strategy(id: int) -> void`
- `targeted_command(action: String, payload: Dictionary) -> void`
- `box_from_card(id: int) -> void`
- `keep_plan(id: int) -> void`
- `select_driver(id: int) -> void`
- `export_evidence() -> void`

No custom intent signals are declared by this script.

## Related documentation

- [docs/ui/race-weekend/layout-system.md](../../docs/ui/race-weekend/layout-system.md)
- [Component catalog](README.md)
