---
id: "race-stint-history"
title: "Measured stint history"
description: "Plots both drivers' physically fitted tyre intervals on the same distance-lap domain."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/stint_history.gd"
symbol: "RaceStintHistory"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "Control"
---

# Measured stint history

Plots both drivers' physically fitted tyre intervals on the same distance-lap domain.

## Intent and purpose

The intent is to support comparison of what both managed cars physically fitted. Its purpose is a common distance-lap chart of measured tyre fitting intervals, separate from forecast schedules and approved plans.

## User goals

- Compare the actual fitted-set spans of both teammates.
- Inspect set identity, interval start/end and whether a set was replaced or remains fitted at finish.
- Recognize absence of recorded stints instead of inferring planned stops were executed.

## Used components

A custom `Control` draws both lanes with [PitwallDesign](pitwall-design.md) chart styling. It uses [RaceStrategyChart](race-strategy-chart.md) only for the shared authored set-color helper and [GameTheme](game-theme.md) for readable set labels. The host supplies a detached chart model.

## Interactions

Up/Down or D-pad selects a driver; Left/Right selects that driver’s stint; clicking selects the lane and a measured interval and gives focus. `selection_changed(text)` updates the adjacent host text alternative; `selected_text()` and accessibility descriptions describe the inspected span. Open intervals stop at actual current distance, including finish/retirement distance, and are never extended to a planned future fit. There is no command signal.

## Links to other pages

- [Final race stint review](race-results-workspace.md)
- [Retained one-driver plot](weekend-view-support-stint-plot.md)
- [Accepted windows and issued intents](race-team-intent-timeline.md)

## Behavior and state

present copies the detached stint model; selected_text and selection_changed describe the inspected interval. Pointer, arrow keys and D-pad inspect driver/stint only. An open interval ends at measured current distance or finish; planned stops are never extrapolated into fitted stints.

## Source and integration

Implementation: [scripts/ui/race_weekend/stint_history.gd](../../../scripts/ui/race_weekend/stint_history.gd) (`RaceStintHistory`, extends `Control`).

Referenced by [scripts/ui/race_weekend/results_workspace.gd](../../../scripts/ui/race_weekend/results_workspace.gd).

## Interface

Primary presentation entry points:

- `present(value: Dictionary) -> void`
- `resize_chart() -> void`
- `selected_text() -> String`

Emitted intent signals:

- `selection_changed(text: String)`

## Related documentation

- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
