---
id: "race-telemetry-inspector"
title: "Telemetry inspector"
description: "Presents recorded speed, tyre, fuel and acceleration channels plus current car state with optional teammate comparison."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/telemetry_inspector.gd"
symbol: "RaceTelemetryInspector"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Telemetry inspector

Presents recorded speed, tyre, fuel and acceleration channels plus current car state with optional teammate comparison.

## Intent and purpose

The intent is to let the player inspect recorded own-car traces without confusing them with instantaneous model state. Its purpose is to show one chosen channel, a bounded retained interval and an optional exact-time teammate comparison.

## User goals

- Inspect speed (km/h), tyre life (%), remaining fuel (lap units) or acceleration (m/s²).
- Choose a recent range or all retained samples and compare the teammate at exact elapsed timestamps.
- Read current temperatures/condition separately and recognize rival telemetry as private/unavailable.

## Used components

Composes [RaceMetricChart](race-metric-chart.md) with native metric/range selectors, a teammate check button and current-state labels. [RaceSectorTable](race-sector-table.md) and a selectable `RichTextLabel` are constructed as retained controls; at this source revision the owned-driver `present()` path does not populate their sector/history contents.

## Interactions

The metric selector changes the channel; range options choose the last 120/60/30 seconds or all retained samples (up to 120 per car). The comparison checkbox aligns exact valid timestamps; missing positions stay gaps and duplicate/invalid coordinates show comparison unavailable. Chart inspection remains read-only. Current engine/brake/tyre temperatures, damage and lifetime condition are explicitly NOT A RECORDED HISTORY. Selecting a rival replaces the trace with no private telemetry, clears sector/history controls and limits the reading to public timing.

## Links to other pages

- [Scrollable inspector page](race-inspector-page.md)
- [Recorded lap/sector review](race-results-workspace.md)
- [Public rival timing](race-timing-tower.md)

## Behavior and state

configure receives RaceViewQuery; present resolves the selected owned driver's observations and selected time range. recording normalizes existing samples for RaceMetricChart. Compatible domains align explicitly, missing samples remain gaps, and inspection cannot alter or create telemetry.

## Source and integration

Implementation: [scripts/ui/race_weekend/telemetry_inspector.gd](../../scripts/ui/race_weekend/telemetry_inspector.gd) (`RaceTelemetryInspector`, extends `VBoxContainer`).

Referenced by [scripts/ui/weekend.gd](../../scripts/ui/weekend.gd), [scripts/ui/weekend_support.gd](../../scripts/ui/weekend_support.gd).

## Interface

Primary presentation entry points:

- `configure(value: RaceViewQuery) -> void`
- `present() -> void`
- `recording(car: Dictionary) -> Dictionary`

No custom intent signals are declared by this script. Inherited signals and native Control events remain available.

## Related documentation

- [Metric chart](race-metric-chart.md)
- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
