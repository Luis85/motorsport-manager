---
id: "weather-panel"
title: "Weather panel"
description: "Shows current observed weather, surface/sector evidence and explicitly targeted hold/box intents."
kind: "component"
surface: "advanced"
source: "scripts/ui/weather_panel.gd"
symbol: "WeatherPanel"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Weather panel

Shows current observed weather, surface/sector evidence and explicitly targeted hold/box intents.

## Intent and purpose

Shows current observed weather, surface/sector evidence and explicitly targeted hold/box intents.

## User goals

Compare tyre choices under observed rainfall and measured line water, understand stress cases, and decide whether to Box or Keep plan.

## Used components

- [Metric chart](race-metric-chart.md)

## Interactions

Choose an owned driver, then Box submits the current weather advice target and safe gate; Keep plan explicitly acknowledges the current weather decision. Surface map opens the lab and Inspect sector delegates circuit observation. Forecast assumptions opens read-only limitations. Drier/trend/wetter cases are stress cases, not probabilities or private future weather.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Weather-capable weekend layout](weather-weekend-view.md)
- [Surface laboratory](surface-lab.md)
- [Strategy desk](strategy-desk.md)
- [Metric chart](race-metric-chart.md)

## Behavior and state

configure accepts RaceViewQuery; choose_driver names the target. command_requested carries explicit action payloads, surface_requested reveals the lab and sector_requested pans observation. Refresh keeps controls stable and estimates remain tied to observed conditions rather than hidden future weather.

## Source and integration

Implementation: [scripts/ui/weather_panel.gd](../../../scripts/ui/weather_panel.gd) (`WeatherPanel`, extends `VBoxContainer`).

Referenced by [scripts/ui/weather_weekend.gd](../../../scripts/ui/weather_weekend.gd).

## Interface

Public presentation entry points:

- `configure(value: RaceViewQuery) -> void`
- `refresh() -> void`
- `choose_driver(id: int) -> void`
- `payload() -> Dictionary`
- `submit_box() -> void`
- `submit_hold() -> void`

Emitted intent signals:

- `command_requested(action: String, payload: Dictionary)`
- `surface_requested`
- `sector_requested(index: int)`

## Related documentation

- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
