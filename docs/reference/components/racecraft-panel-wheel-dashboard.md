---
id: "racecraft-panel-wheel-dashboard"
title: "Four-wheel condition dashboard"
description: "Shows each physically fitted wheel with tread, temperature, pressure, load and retained damage evidence."
kind: "component"
surface: "advanced"
source: "scripts/ui/racecraft_panel.gd"
symbol: "RacecraftPanel.WheelDashboard"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "class WheelDashboard"
---

# Four-wheel condition dashboard

Shows each physically fitted wheel with tread, temperature, pressure, load and retained damage evidence.

## Intent and purpose

Inspect the four contact patches of the currently fitted physical tyre set, retaining condition evidence with the set rather than presenting an aggregate tyre bar.

## User goals

- See fitted set identity and heat-cycle count.
- Compare front-left/front-right/rear-left/rear-right tread and surface/core temperatures.
- Inspect puncture, pressure/load and graining/blistering/flat-spot evidence.

## Used components

A two-column native Button grid, heading Label and detail paragraph built with [UI](ui.md). [WeekendView](weekend-view.md) creates `RacecraftPanel.WheelDashboard`, assigns `model: RaceViewQuery` and mounts it in the wheel-condition page.

## Interactions

`refresh()` looks up the selected driver’s fitted `set_id` in finite tyre stock. Each wheel Button shows tread and two temperatures; choosing it stores `selected_wheel` and refreshes the detail paragraph. The active/puncture styling supplements explicit “PUNCTURED — replace this set” text. Pressure and load are normalized multipliers, damage remains attached to that set. The implementation assumes valid fitted-set/four-wheel data from the query; it skips refresh when the model is missing or controls are not built. Inspection has no fitting, repair or command signal.

## Links to other pages

- [Garage setup panel](racecraft-panel.md) — Separate setup drafts.
- [Advanced Tyres page](advanced-tyres-page.md) — Finite stock and physical service controls.
- [Race tyre readout](race-tyre-readout.md) — Driver-card condition summary.
- [WeekendView](weekend-view.md) — Host and selected-driver query.

## Source and integration

Implementation: [scripts/ui/racecraft_panel.gd](../../../scripts/ui/racecraft_panel.gd) (`class WheelDashboard`).

## Interface

Instantiate the nested `RacecraftPanel.WheelDashboard` class and assign `model: RaceViewQuery` before adding it to the tree. Its `_ready()` builds the controls; `refresh()` reads the current selected car. `selected_wheel` defaults to `"FL"`. The control declares no custom intent signal.

## Related documentation

- [Garage setup panel](racecraft-panel.md)
- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
