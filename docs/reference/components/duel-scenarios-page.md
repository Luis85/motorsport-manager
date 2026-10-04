---
id: "duel-scenarios-page"
title: "Strategic duel scenarios"
description: "Presents the trusted duels diagnostic collection with recipe descriptions and explicit launch controls."
kind: "page"
surface: "developer"
source: "scripts/composition/scenario_screens.gd"
symbol: "DuelScenariosPage"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "show_duel_scenarios"
---

# Strategic duel scenarios

Presents the trusted duels diagnostic collection with recipe descriptions and explicit launch controls.

## Intent and purpose

Present strategic-duel exercises with their circuit and starting-condition assumptions visible, allowing deliberate entry into an untimed-grid preparation scenario.

## User goals

- Compare duel objectives/hints and circuit/lap count.
- See fitted tread, calm incident conditions and seed.
- Open preparation and form a tactical plan for the exercise.

## Used components

[ScenarioScreens](scenario-screens.md) builds a vertical ScrollContainer with horizontal scrolling disabled and a filling VBox of native cards. `ScenarioCatalog.read("duels")` supplies recipes; `ScenarioCatalog.build_duel(recipe, App.library)` constructs them. [UI](ui.md) supplies copy, primary Buttons and errors.

## Interactions

`show_duel_scenarios` clears to `duel_scenarios` and uses the collection intro at size 27. Each card adds circuit, laps, fitted-tyre tread, untimed-grid and calm-incident copy; the launch Button says “Open preparation · seed S.” Unlike dry/weather/recovery, this rendering loop has no additional `valid` filter. Existing in-memory weekends outside briefing/results trigger a retained local confirmation asking to save/export evidence. Launch validates through `build_duel`, reports a shipped-recipe/circuit error on null, then installs the candidate, copies settings speed and opens preparation. Scrolling and reading do not execute tactical commands.

## Links to other pages

- [Main menu](main-menu-view.md) — Advanced Scenario challenges.
- [Diagnostic scenario galleries](scenario-screens.md) — Retained composition.
- [Duel workspace binding](duel-workspace.md) — Tactical-plan route in the existing pitwall.
- [Tactical plan panel](tactical-plan-panel.md) — Explicit per-driver tactical plan controls.
- [Practice weekend layout](practice-weekend-view.md) — Existing weekend workspace host.

## Source and integration

Implementation: [scripts/composition/scenario_screens.gd](../../../scripts/composition/scenario_screens.gd) (`show_duel_scenarios`).

## Interface

This entry is implemented inside `scripts/composition/scenario_screens.gd` at `show_duel_scenarios`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Diagnostic scenario galleries](scenario-screens.md)
- [Native control helpers](ui.md)
- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
