# Telemetry

## Integrated components

RaceTelemetryInspector + RaceMetricChart + RaceSectorTable.

## Information contract

Recorded channels are speed in km/h, tread percentage, remaining fuel in lap units and acceleration in m/s². Current engine/brake/tyre temperatures and condition are explicitly labeled current model state, not recorded histories. Lap/sector evidence remains bounded and missing fields show —.

## Interaction and safety

One selected trace replaces the duplicated under-circuit plot. Selecting a metric never commands a car. Rival private data is concealed by the shared inspection boundary. Custom charts provide chronological/categorical labeling and textual alternatives.

## Shared acceptance

Use the [layout](layout-system.md), [responsive](responsive-behaviour.md), [accessibility](accessibility.md) and [interaction](interaction-model.md) contracts. Rendering this screen does not create a command or alter pause/speed. Actual executable coverage is recorded in [verification](verification-completion.md).
