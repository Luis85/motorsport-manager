---
id: "weather-scenarios-page"
title: "Weather scenarios"
description: "Presents the trusted weather diagnostic collection with recipe descriptions and explicit launch controls."
kind: "page"
surface: "developer"
source: "scripts/composition/scenario_screens.gd"
symbol: "WeatherScenariosPage"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "show_weather_scenarios"
---

# Weather scenarios

Presents the trusted weather diagnostic collection with recipe descriptions and explicit launch controls.

## Intent and purpose

Offer trusted weather recipes as reproducible exercises for reading conditions and considering tyre/strategy choices under a named weather mode.

## User goals

- Read each exercise’s objective and hint.
- Choose a lap count, weather mode and seed shown on its launch button.
- Inspect weather and surface evidence in the opened weekend.

## Used components

[ScenarioScreens](scenario-screens.md) creates a two-column native GridContainer with expanding card panels and labels/primary Buttons through [UI](ui.md). `ScenarioCatalog.read("weather")` and `WeatherScenarios.valid/build` resolve the family; `App.library` supplies circuits.

## Interactions

`show_weather_scenarios` clears to `weather_scenarios` and skips recipes failing the family validator. “Open N laps · MODE · seed S” identifies the exercise. If `App.weekend` exists outside briefing/results, a local confirmation asks to replace the active weekend; otherwise launch proceeds directly. Launch calls the weather builder, reports a null candidate as invalid weather scenario or track, then installs it, sets settings speed and shows the weekend. This route does not use the dry gallery’s `requires_entry_confirmation` check or the shipping configuration/welcome staging.

## Links to other pages

- [Main menu](main-menu-view.md) — Advanced Scenario challenges.
- [Diagnostic scenario galleries](scenario-screens.md) — Family navigation.
- [Weather weekend layout](weather-weekend-view.md) — Weather-capable weekend host.
- [Weather panel](weather-panel.md) — Forecast and observed conditions.
- [Surface laboratory](surface-lab.md) — Inspect actual station/strip observations.

## Source and integration

Implementation: [scripts/composition/scenario_screens.gd](../../../scripts/composition/scenario_screens.gd) (`show_weather_scenarios`).

## Interface

This entry is implemented inside `scripts/composition/scenario_screens.gd` at `show_weather_scenarios`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Diagnostic scenario galleries](scenario-screens.md)
- [Native control helpers](ui.md)
- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
