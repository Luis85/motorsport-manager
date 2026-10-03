---
id: "race-results-workspace"
title: "Session review layout"
description: "Organizes Classification, Lap evidence, Stints & pit stops and Decisions with export and explicit next-session routes."
kind: "layout"
surface: "advanced"
source: "scripts/ui/race_weekend/results_workspace.gd"
symbol: "RaceResultsWorkspace"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Session review layout

Organizes Classification, Lap evidence, Stints & pit stops and Decisions with export and explicit next-session routes.

## Intent and purpose

The intent is to give completed sessions a coherent factual review. Its purpose is to compose classification, measured laps, physically fitted stints/visits and decision evidence while keeping advancement and original-result acceptance explicit.

## User goals

- Review practice observations, qualifying times or final race classification with their distinct semantics.
- Inspect managed-driver lap durations and available sectors, including invalid/pit annotations.
- Inspect actual tyre fitting and completed entry/exit-correlated visits, then follow debrief, notebook, replay or export routes.

## Used components

Composes [SessionResultsPanel](session-results-panel.md) (reparented from its existing host), [RaceMetricChart](race-metric-chart.md), [RaceSectorTable](race-sector-table.md), [RaceStintHistory](race-stint-history.md) and, with strategy support, [RaceJournalView](race-journal-view.md). Native page buttons, driver/range controls, visit selector and text alternatives surround the evidence.

## Interactions

Classification, Lap evidence, Stints & pit stops and Decisions buttons change local pages. Driver selection changes the inspected own-driver record; teammate comparison aligns exact lap/run IDs and is disabled for practice because runs/conditions can differ. Practice lap durations use `seconds`, preserving the crossing timestamp separately. Stints and pit-visit selection are visible only for final race results; qualifying/practice explain why garage fitting is not a racing pit stop. Back emits `close_requested`; debrief/notebook/replay/export/next emit `action_requested(action)` for the host. Notebook/replay require practice support. Next is disabled until practice, qualifying or race results are final; it does not implicitly accept an original result.

## Links to other pages

- [Host: reparenting and action routing](pitwall-workspace.md)
- [Decision debrief](advanced-debrief-page.md)
- [Circuit notebook](notebook-window.md)
- [Replay and sandbox](replay-workspace.md)

## Behavior and state

attach reparents the existing SessionResultsPanel so native row identity survives. Lap inspection preserves invalid/pit labels and missing measurements; teammate comparison requires compatible sessions. Only correlated completed entry/exit records count as measured visits. action_requested delegates navigation/export/next to the host rather than accepting or settling results during refresh.

## Source and integration

Implementation: [scripts/ui/race_weekend/results_workspace.gd](../../scripts/ui/race_weekend/results_workspace.gd) (`RaceResultsWorkspace`, extends `VBoxContainer`).

Referenced by [scripts/ui/pitwall_workspace.gd](../../scripts/ui/pitwall_workspace.gd).

## Interface

Primary presentation entry points:

- `configure(value: RaceViewQuery) -> void`
- `present() -> void`
- `attach(panel: SessionResultsPanel) -> void`
- `show_page(index: int) -> void`
- `lap_records(id: int) -> Array`
- `lap_data(records: Array) -> Dictionary`
- `refresh_pit_visits() -> void`
- `show_pit_visit(index: int) -> void`

Emitted intent signals:

- `close_requested`
- `action_requested(action: String)`

## Related documentation

- [Session classification panel](session-results-panel.md)
- [docs/ui/race-weekend/layout-system.md](../../docs/ui/race-weekend/layout-system.md)
- [Component catalog](README.md)
