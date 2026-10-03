---
id: "race-metric-chart"
title: "Metric chart"
description: "Plots observed chronological samples or independent categorical cases with inspection and text alternatives."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/metric_chart.gd"
symbol: "RaceMetricChart"
status: "implemented"
source_pr: 28
source_commit: "dfb7cead8f01ea9b0b42a4b936b1d4c4e9bf21fa"
extends: "RaceMetricChartData"
---

# Metric chart

Plots observed chronological samples or independent categorical cases with inspection and text alternatives.

## Intent and purpose

The intent is to support precise inspection of evidence. Its purpose is to plot supplied chronological recordings or independent same-horizon stress cases using a domain that keeps their meaning intact.

## User goals

- Inspect a measured value at its original elapsed-time, lap or run coordinate.
- Compare compatible recordings while retaining unmatched positions as gaps.
- Read independent case values without interpreting them as probabilities or a time series.

## Used components

A custom `Control` draws the plot, labels, selected readout and focus outline with [PitwallDesign chart styling](pitwall-design.md). It does not mount a nested chart or own a data recorder.

## Interactions

Left/Right or D-pad Left/Right inspect positions; Home/End choose first/latest, and clicking chooses the nearest horizontal position and gives the chart focus. `selected_text()` and accessibility descriptions expose values and unavailable positions. Trace comparison uses solid circles and dashed squares. `align_recordings()` rejects invalid/duplicate coordinates and joins exact coordinates without interpolation; absent measurements remain null. `present_cases()` keeps categories separate. There are no command signals.

## Links to other pages

- [Recorded telemetry host](race-telemetry-inspector.md)
- [Measured lap evidence host](race-results-workspace.md)
- [Independent weather stress-case host](weather-panel.md)

## Behavior and state

present_samples preserves explicit positions and null gaps; present_cases keeps categories independent. align_recordings compares compatible domains without shifting missing values. Keyboard/pointer inspection changes chart selection only; selected_text supplies an accessible description and unavailable values never become zero measurements.

## Source and integration

Implementation: [scripts/ui/race_weekend/metric_chart.gd](../../scripts/ui/race_weekend/metric_chart.gd) (`RaceMetricChart`, extends `RaceMetricChartData`).

Referenced by [scripts/ui/weather_panel.gd](../../scripts/ui/weather_panel.gd), [scripts/ui/weekend_support.gd](../../scripts/ui/weekend_support.gd), [scripts/ui/race_weekend/results_workspace.gd](../../scripts/ui/race_weekend/results_workspace.gd), [scripts/ui/race_weekend/telemetry_inspector.gd](../../scripts/ui/race_weekend/telemetry_inspector.gd).

## Interface

Primary presentation entry points:

- `present(next_title: String, next_unit: String, next_series: Array, low: float, high: float) -> void`
- `finite_value(value: Variant) -> bool`
- `padded_range(values: Array) -> Vector2`
- `present_samples(next_title: String, next_unit: String, values: Array, low: float, high: float, positions: Array, labels: Array = [], axis: String = "Elapsed s", secondary: Array = [], secondary_name: String = "") -> void`
- `present_cases(next_title: String, labels: Array, values: Array, low: float = 0.0, high: float = 100.0) -> void`
- `sample_label(index: int) -> String`
- `selected_text() -> String`
- `plot_area() -> Rect2`

No custom intent signals are declared by this script. Inherited signals and native Control events remain available.

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
