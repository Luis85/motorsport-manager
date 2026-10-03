---
id: "race-sector-table"
title: "Measured sector table"
description: "Displays a bounded set of measured laps in native LAP, S1, S2, S3 and TOTAL cells."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/sector_table.gd"
symbol: "RaceSectorTable"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Measured sector table

Displays a bounded set of measured laps in native LAP, S1, S2, S3 and TOTAL cells.

## Intent and purpose

The intent is to make supplied measured lap evidence easy to scan. Its purpose is a bounded native-cell table that distinguishes absent sectors from measurements and annotates invalid or pit laps.

## User goals

- Read LAP, S1, S2, S3 and TOTAL for the latest supplied laps.
- Recognize unavailable sector measurements and invalid-lap explanations.
- See an explicit empty state before any lap evidence is supplied.

## Used components

Uses eight persistent `HBoxContainer` rows and native `Label` cells built through [UI helpers](ui.md). It receives a detached records array rather than querying or recording timing itself.

## Interactions

`present(records, limit)` displays the latest records, capped at eight rows. Positive available sector values show three decimals; unavailable/nonpositive sectors show —. Total duration uses the supplied `time` or `seconds`, with ! for an invalid lap. Tooltips distinguish invalid, pit and measured laps. It has no selection, navigation or command signals; row reading does not validate a lap or establish a fastest lap.

## Links to other pages

- [Lap evidence page](race-results-workspace.md)
- [Telemetry composition](race-telemetry-inspector.md)
- [Session classification semantics](session-results-panel.md)

## Behavior and state

present accepts lap records and a limit capped by eight stable rows. Missing/unmeasured sectors show an em dash, invalid laps keep explanatory tooltips, and no measured laps yields an empty message. Rendering never fabricates zeroes or treats a pit lap as fastest-lap evidence.

## Source and integration

Implementation: [scripts/ui/race_weekend/sector_table.gd](../../scripts/ui/race_weekend/sector_table.gd) (`RaceSectorTable`, extends `VBoxContainer`).

Referenced by [scripts/ui/weekend_support.gd](../../scripts/ui/weekend_support.gd), [scripts/ui/race_weekend/results_workspace.gd](../../scripts/ui/race_weekend/results_workspace.gd), [scripts/ui/race_weekend/telemetry_inspector.gd](../../scripts/ui/race_weekend/telemetry_inspector.gd).

## Interface

Primary presentation entry points:

- `present(records: Array, limit: int = 8) -> void`

No custom intent signals are declared by this script. Inherited signals and native Control events remain available.

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
