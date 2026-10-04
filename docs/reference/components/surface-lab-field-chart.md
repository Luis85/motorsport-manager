---
id: "surface-lab-field-chart"
title: "Surface field heatmap"
description: "Draws a station-by-lane surface heatmap with a visible inspected cell."
kind: "component"
surface: "advanced"
source: "scripts/ui/surface_lab.gd"
symbol: "SurfaceLab.FieldChart"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "class FieldChart"
---

# Surface field heatmap

Draws a station-by-lane surface heatmap with a visible inspected cell.

## Intent and purpose

Draw a lap-distance-by-road-strip heatmap with an explicit inspected cell and keyboard access, providing a navigable visual companion to numeric surface readings.

## User goals

- Compare channel intensity across one lap.
- Move inspection to a cell by click or arrow keys.
- Keep the selected station/strip visible while reading details in the host.

## Used components

A nested custom Control created by [SurfaceLab](surface-lab.md), using supplied `values`, `channel`, `station` and `lane`. [UI](ui.md) supplies styles; `RaceVisualPort` supplies code-owned station/lane dimensions. Numeric reading and channel picker belong to the parent.

## Interactions

The chart accepts focus and draws values as clamped color intensities, with lane guides, selected-cell outline and focus outline. Water, grip and other channels use distinct ink; captions distinguish concentration, grip and temperature scales. Empty values omit the field. A left click inside `field_rect` clamps station/lane, grabs focus and emits `chosen(station, lane)`. Left/right wrap around the lap; up/down clamp at road-width edges. The host consumes that signal and updates details/redraw; the chart never dispatches race commands.

## Links to other pages

- [Surface laboratory](surface-lab.md) — Channel selection, numerical values and Locate action.
- [TrackCanvas](track-canvas.md) — Map location and surface overlay.
- [Race inspector page](race-inspector-page.md) — Hosting workspace.

## Source and integration

Implementation: [scripts/ui/surface_lab.gd](../../../scripts/ui/surface_lab.gd) (`class FieldChart`).

## Interface

Instantiate the nested `SurfaceLab.FieldChart` Control. Supply `values: Array`, `channel`, `station` and `lane`, and redraw when observations change. `field_rect()` returns the clickable/drawn heatmap area. `chosen(station: int, lane: int)` emits inspection intent; the parent supplies the selected cell’s numerical description.

## Related documentation

- [Surface laboratory](surface-lab.md)
- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
