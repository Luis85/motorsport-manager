---
id: "strategy-scenarios"
title: "Dry strategy scenarios"
description: "Presents the trusted dry diagnostic collection with recipe descriptions and explicit launch controls."
kind: "page"
surface: "developer"
source: "scripts/composition/scenario_screens.gd"
symbol: "StrategyScenarios"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "show_strategy_scenarios"
---

# Dry strategy scenarios

Presents the trusted dry diagnostic collection with recipe descriptions and explicit launch controls.

## Intent and purpose

Present trusted dry strategy recipes so a developer or Advanced player can choose a reproducible strategy exercise with its objective and hint before launch.

## User goals

- Compare dry-strategy exercises by title and objective.
- See lap count and seed before opening.
- Inspect strategy decisions during the resulting weekend.

## Used components

[ScenarioScreens](scenario-screens.md) builds a two-column GridContainer with expanding native panels, title/objective/hint labels, a vertical spacer and a primary Open Button per valid recipe. `ScenarioCatalog.read("dry")`, `WeekendScenarios.valid/build` and `App.library` supply the diagnostic data and construction. Launch failure uses [native notification](native-notification.md).

## Interactions

`show_strategy_scenarios` clears to `strategy_scenarios`; invalid dry recipes are skipped by the render loop. Buttons say “Open N-lap scenario · seed S.” Opening checks `App.requires_entry_confirmation()`, which can include saved continuation as well as active in-memory state; its retained local dialog says “Replace the active weekend?” and asks to export evidence. Only launch/Confirm calls `WeekendScenarios.build`; a null candidate reports invalid scenario, track or initial plan. Success replaces `App.weekend`, applies settings speed and opens the weekend. This dry route differs from the other family galleries’ live-phase-only replacement condition.

## Links to other pages

- [Main menu](main-menu-view.md) — Advanced scenario menu route.
- [Diagnostic scenario galleries](scenario-screens.md) — Common composition and family destinations.
- [Strategy weekend layout](strategy-weekend-view.md) — Strategy-aware observation/decisions after launch.
- [Strategy desk](strategy-desk.md) — Explicit strategy plan controls.
- [Advanced debrief](advanced-debrief-page.md) — Recorded decisions and consequences.

## Source and integration

Implementation: [scripts/composition/scenario_screens.gd](../../scripts/composition/scenario_screens.gd) (`show_strategy_scenarios`).

## Interface

This entry is implemented inside `scripts/composition/scenario_screens.gd` at `show_strategy_scenarios`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Diagnostic scenario galleries](scenario-screens.md)
- [Native control helpers](ui.md)
- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
