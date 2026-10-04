---
id: "rival-scenarios-page"
title: "Rival-style scenarios"
description: "Presents the trusted rivals diagnostic collection with recipe descriptions and explicit launch controls."
kind: "page"
surface: "developer"
source: "scripts/composition/scenario_screens.gd"
symbol: "RivalScenariosPage"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "show_rival_scenarios"
---

# Rival-style scenarios

Presents the trusted rivals diagnostic collection with recipe descriptions and explicit launch controls.

## Intent and purpose

Provide trusted rival-style exercises that make starting tyre conditions and manual player pit ownership explicit before opening preparation.

## User goals

- Read how the rival exercise differs and its objective/hint.
- Inspect initial fitted M1 tread, laps and seed.
- Observe public rival behavior while making the player’s own manual pit decisions.

## Used components

[ScenarioScreens](scenario-screens.md) appends native cards directly to `host.content`. `RivalScenarios.catalog/build` resolve recipes and construct against `App.library`; [UI](ui.md) builds titles, descriptive paragraphs and primary launch Buttons.

## Interactions

`show_rival_scenarios` clears to `rival_scenarios` and displays a special condition line: all fitted M1 tyres start at the recipe tread percentage, other stock is unchanged, dry weather, calm incidents, manual player pits and the lap count. “Open preparation · seed S” launches after local confirmation only if an in-memory weekend is outside briefing/results. A null builder result reports invalid rival recipe/track; success installs the candidate, applies settings speed and shows preparation. Catalog entries are not additionally filtered in this function and cards have no enclosing grid/scroll container. Launch copy does not grant knowledge of secret rival plans.

## Links to other pages

- [Main menu](main-menu-view.md) — Advanced diagnostic menu.
- [Diagnostic scenario galleries](scenario-screens.md) — Other trusted exercises.
- [Practice weekend layout](practice-weekend-view.md) — Retained weekend host.
- [Public rival inspector](public-rival-inspector.md) — Public information boundary.
- [Advanced Tyres page](advanced-tyres-page.md) — Finite stock and manual physical service.

## Source and integration

Implementation: [scripts/composition/scenario_screens.gd](../../../scripts/composition/scenario_screens.gd) (`show_rival_scenarios`).

## Interface

This entry is implemented inside `scripts/composition/scenario_screens.gd` at `show_rival_scenarios`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Diagnostic scenario galleries](scenario-screens.md)
- [Native control helpers](ui.md)
- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
