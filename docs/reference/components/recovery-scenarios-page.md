---
id: "recovery-scenarios-page"
title: "Recovery scenarios"
description: "Presents the trusted recovery diagnostic collection with recipe descriptions and explicit launch controls."
kind: "page"
surface: "developer"
source: "scripts/composition/scenario_screens.gd"
symbol: "RecoveryScenariosPage"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "show_recovery_scenarios"
---

# Recovery scenarios

Presents the trusted recovery diagnostic collection with recipe descriptions and explicit launch controls.

## Intent and purpose

Present trusted recovery exercises in a vertically scrollable collection for exploring reliability, warnings and recovery choices with a known recipe.

## User goals

- Browse recovery exercises and read objectives/hints.
- Choose a deterministic lap count and seed.
- Inspect the resulting recovery state and explicit available actions.

## Used components

[ScenarioScreens](scenario-screens.md) constructs a vertical ScrollContainer with horizontal scrolling disabled, a filling VBox and native card panels. `ScenarioCatalog.read("recovery")`, `RecoveryScenarios.valid/build` and `App.library` supply recipes/circuits; [UI](ui.md) supplies labels, launch Buttons and failure notifications.

## Interactions

`show_recovery_scenarios` clears to `recovery_scenarios` and skips invalid family recipes. “Open N laps · seed S” launches after a local replacement confirmation only when an existing in-memory weekend is outside briefing/results. The callback builds through `RecoveryScenarios`, reports invalid recovery scenario/track on null, installs the candidate, copies settings speed and opens the weekend. Vertical scrolling distinguishes this collection from the dry/weather grids. Browsing and cancelling the retained dialog do not construct/install a candidate.

## Links to other pages

- [Main menu](main-menu-view.md) — Advanced diagnostic entry.
- [Diagnostic scenario galleries](scenario-screens.md) — Other collection routes.
- [Recovery weekend layout](recovery-weekend-view.md) — Recovery-capable host after launch.
- [Recovery panel](recovery-panel.md) — Warnings and command controls.
- [Advanced debrief](advanced-debrief-page.md) — Observed decisions and recovery consequences.

## Source and integration

Implementation: [scripts/composition/scenario_screens.gd](../../../scripts/composition/scenario_screens.gd) (`show_recovery_scenarios`).

## Interface

This entry is implemented inside `scripts/composition/scenario_screens.gd` at `show_recovery_scenarios`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Diagnostic scenario galleries](scenario-screens.md)
- [Native control helpers](ui.md)
- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
