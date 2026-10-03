---
id: "weather-weekend-view"
title: "Weather-capable weekend layout"
description: "Adds a contextual weather topic and circuit-sector inspection to the strategy stack."
kind: "layout"
surface: "advanced"
source: "scripts/ui/weather_weekend.gd"
symbol: "WeatherWeekendView"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "StrategyWeekendView"
---

# Weather-capable weekend layout

Adds a contextual weather topic and circuit-sector inspection to the strategy stack.

## Intent and purpose

Adds a contextual weather topic and circuit-sector inspection to the strategy stack.

## User goals

Inspect weather and circuit-sector evidence within the strategy weekend without changing the authoritative session.

## Used components

- [Strategy-capable weekend layout](strategy-weekend-view.md)
- [Weather panel](weather-panel.md)

## Interactions

Weather links select a named driver and reveal the existing panel. Inspect sector pans the camera and shows surface inspection. Weather commands still route through the inherited adapter; reading, topic switching and sector observation preserve playback.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Weather panel](weather-panel.md)
- [Surface laboratory](surface-lab.md)
- [Recovery-capable weekend layout](recovery-weekend-view.md)
- [Strategy-capable weekend layout](strategy-weekend-view.md)

## Behavior and state

open_weather reveals the selected driver's existing weather panel. inspect_weather_sector moves the observation camera and overlay only. Refresh reads the same weekend/weather mechanics; switching panels cannot claim control, pause or tick a second simulation.

## Source and integration

Implementation: [scripts/ui/weather_weekend.gd](../../scripts/ui/weather_weekend.gd) (`WeatherWeekendView`, extends `StrategyWeekendView`).

Referenced by [scripts/ui/recovery_weekend.gd](../../scripts/ui/recovery_weekend.gd).

## Interface

Public presentation entry points:

- `refresh() -> void`
- `open_weather(id: int) -> void`
- `inspect_weather_sector(index: int) -> void`

No custom intent signals are declared by this script.

## Related documentation

- [docs/ui/race-weekend/layout-system.md](../../docs/ui/race-weekend/layout-system.md)
- [Component catalog](README.md)
