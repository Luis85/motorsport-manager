---
id: "practice-scenarios-page"
title: "Practice scenarios"
description: "Presents the trusted practice diagnostic collection with recipe descriptions and explicit launch controls."
kind: "page"
surface: "developer"
source: "scripts/composition/scenario_screens.gd"
symbol: "PracticeScenariosPage"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "show_practice_scenarios"
---

# Practice scenarios

Presents the trusted practice diagnostic collection with recipe descriptions and explicit launch controls.

## Intent and purpose

Choose a trusted practice exercise before its briefing, emphasizing deliberate run planning and measured evidence rather than entering a race directly.

## User goals

- Read a practice objective and hint.
- Open the exercise’s briefing with its displayed seed.
- Plan independent driver runs and compare measured results.

## Used components

[ScenarioScreens](scenario-screens.md) appends native panels directly to `host.content`, each with title, objective/hint and primary Button. `PracticeScenarios.catalog()` supplies file-backed recipes and `PracticeScenarios.build(recipe, App.library)` constructs the candidate.

## Interactions

`show_practice_scenarios` clears to `practice_scenarios`; unlike the dry/weather/recovery render loops, it iterates the validated service catalog without an additional card-level `valid` filter. Buttons read “Open briefing · seed S.” A local confirmation is required only for an existing in-memory weekend outside briefing/results. Launch reports an invalid practice recipe/track on null, otherwise replaces the weekend, applies settings speed and enters its briefing. This layout has no collection-level GridContainer or ScrollContainer in this function. Starting a practice run remains a later explicit pitwall action.

## Links to other pages

- [Main menu](main-menu-view.md) — Advanced scenario route.
- [Diagnostic scenario galleries](scenario-screens.md) — Trusted collection boundary.
- [Practice weekend layout](practice-weekend-view.md) — Practice/replay/result routes.
- [Practice run panel](practice-panel.md) — Stage and submit per-driver runs.
- [Practice workspace](race-practice-workspace.md) — Expanded measured evidence.

## Source and integration

Implementation: [scripts/composition/scenario_screens.gd](../../scripts/composition/scenario_screens.gd) (`show_practice_scenarios`).

## Interface

This entry is implemented inside `scripts/composition/scenario_screens.gd` at `show_practice_scenarios`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Diagnostic scenario galleries](scenario-screens.md)
- [Native control helpers](ui.md)
- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
