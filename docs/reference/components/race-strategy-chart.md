---
id: "race-strategy-chart"
title: "Strategy schedule chart"
description: "Displays supplied forecast stop schedules with estimate context and inspection."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/strategy_chart.gd"
symbol: "RaceStrategyChart"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "Control"
---

# Strategy schedule chart

Displays supplied forecast stop schedules with estimate context and inspection.

## Intent and purpose

The intent is to explain supplied forecast alternatives spatially. Its purpose is to draw estimated future set spans and stop locations against race-distance laps, with remaining-time ranges and risk context.

## User goals

- Compare the forecaster’s available alternatives and reasons an alternative is unavailable.
- Inspect each estimated stop coordinate and proposed replacement set.
- Understand that the current-distance marker and future spans are estimate context rather than executed service.

## Used components

A custom `Control` draws the timeline with [PitwallDesign](pitwall-design.md) chart styling and [GameTheme](game-theme.md) readable set-label ink. `compound_color()` also supplies shared set coloring to other charts; this chart consumes supplied alternatives and does not compute forecasts.

## Interactions

Up/Down chooses an option; Left/Right inspects stops; clicking selects an option lane and its nearest stop. `selected_text()`, tooltips and accessibility descriptions expose estimated distance, set, time range and risk. There is no selection/approval/command signal. A no-stop alternative remains an estimate; this component does not render an accepted physical pit order. Issued intents belong to the separate team timeline and require explicit host controls to change.

## Links to other pages

- [Compare page and chart toggle](strategy-desk.md)
- [Forecast assumptions and alternatives](pitwall-comparison.md)
- [Accepted windows and issued intents](race-team-intent-timeline.md)
- [Physical fitting evidence](race-stint-history.md)

## Behavior and state

present accepts detached alternative schedules. Pointer/key inspection and selected_text expose the highlighted schedule without editing it. compound_color resolves authored set styles with a fallback; the supplied schedules are estimates rather than accepted physical orders.

## Source and integration

Implementation: [scripts/ui/race_weekend/strategy_chart.gd](../../../scripts/ui/race_weekend/strategy_chart.gd) (`RaceStrategyChart`, extends `Control`).

Referenced by [scripts/ui/strategy_desk.gd](../../../scripts/ui/strategy_desk.gd), [scripts/ui/race_weekend/stint_history.gd](../../../scripts/ui/race_weekend/stint_history.gd), [scripts/ui/race_weekend/team_intent_timeline.gd](../../../scripts/ui/race_weekend/team_intent_timeline.gd).

## Interface

Primary presentation entry points:

- `present(data: Array) -> void`
- `selected_text() -> String`
- `compound_color(set_id: String, styles: Dictionary = {}) -> Color`

No custom intent signals are declared by this script. Inherited signals and native Control events remain available.

## Related documentation

- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
