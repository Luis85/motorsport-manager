---
id: "surface-lab"
title: "Surface laboratory"
description: "Shows observed surface channels as a station/road-width heatmap with numeric cell details."
kind: "component"
surface: "advanced"
source: "scripts/ui/surface_lab.gd"
symbol: "SurfaceLab"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Surface laboratory

Shows observed surface channels as a station/road-width heatmap with numeric cell details.

## Intent and purpose

Expose observed track-surface state across lap distance and road width so the player can inspect local conditions and locate a cell on the circuit map.

## User goals

- Compare water, rubber, grip, contamination and temperature channels.
- Read exact selected-cell values alongside the color field.
- Locate the section on the map without issuing a driving command.

## Used components

[Surface field heatmap](surface-lab-field-chart.md), a channel OptionButton, numeric detail paragraph and Locate Button built through [UI](ui.md). [WeekendView](weekend-view.md) assigns `source: RaceChartQuery` and [TrackCanvas](track-canvas.md) before mounting.

## Interactions

Channel selection updates `channel`, the chart and canvas surface-channel setting, then refreshes. Chart `chosen(station, lane)` updates inspection. Visible `_process` refresh is bounded to 0.3 seconds; `refresh` reads detached `source.surface` values and returns if unavailable. Locate centers on the station midpoint, emits canvas `navigated`, sets `inspected_fraction`, enables the surface overlay and redraws. Details show distance, seven strips, concentrations in percent, Celsius and grip multiplier. Observation does not advance race time or rewrite cells; displayed values represent the management model.

## Links to other pages

- [Surface field heatmap](surface-lab-field-chart.md) — Mouse/keyboard cell input.
- [TrackCanvas](track-canvas.md) — Location and overlay presentation.
- [Canvas surface layer](track-canvas-surface-overlay.md) — Read-only surface paint.
- [Race inspector page](race-inspector-page.md) — Task navigation host.
- [Full analysis layout](race-analysis-workspace.md) — More space with the same inspector instance.

## Source and integration

Implementation: [scripts/ui/surface_lab.gd](../../../scripts/ui/surface_lab.gd) (`SurfaceLab`, extends `VBoxContainer`).

Referenced by [scripts/ui/weekend.gd](../../../scripts/ui/weekend.gd), [scripts/ui/weekend_support.gd](../../../scripts/ui/weekend_support.gd).

## Interface

Primary entry points:

- `refresh() -> void`

No custom intent signals are declared by this script. Inherited signals and native Control events remain available.

## Related documentation

- [Track canvas](track-canvas.md)
- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
