---
id: "session-results-panel"
title: "Session classification panel"
description: "Renders stable session-aware classification with distinct practice, qualifying and final-race semantics."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/session_results_panel.gd"
symbol: "SessionResultsPanel"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Session classification panel

Renders stable session-aware classification with distinct practice, qualifying and final-race semantics.

## Intent and purpose

The intent is to explain a completed session using its correct sporting meaning. Its purpose is a stable native classification table whose presentation distinguishes practice observations, qualifying valid times and final race outcomes.

## User goals

- Read a final race’s laps, pit count, best lap, measured finish gaps, lapped finishes and retirements.
- Distinguish timed qualifying entries from NO TIME, without assigning pole to untimed drivers.
- Read practice samples/runs as unranked observations and recognize unavailable data.

## Used components

A six-column native `Tree` uses one persistent `TreeItem` per entrant; heading and summary labels come from [UI helpers](ui.md). It receives `RaceViewQuery` and converts it to a detached display dictionary with `presentation()`.

## Interactions

`refresh()` changes existing rows only when the detached display changes. An unfinished session hides the classification and points readers to live timing. Practice columns show no rank, best recorded `seconds`, sample/run counts and MEASURED/NO DATA; qualifying uses best valid qualifying time and POLE/gap only for timed entries; race results show DNF/UNCLASSIFIED and lap/time gaps. Resize switches short names to full names above the wide-layout threshold. Table selection is native reading; this panel exposes no driver-selection, acceptance, export or advance command signal.

## Links to other pages

- [Full review layout](race-results-workspace.md)
- [Retained results page host](pitwall-workspace.md)
- [Live classification](race-timing-tower.md)

## Behavior and state

configure accepts RaceViewQuery; presentation supplies a detached display model and refresh changes stable rows only when needed. Pending sessions hide classification, practice is unranked measured observation, untimed qualifying is not pole, and final results retain laps, finish time and retirements. Wider layouts show full names.

## Source and integration

Implementation: [scripts/ui/race_weekend/session_results_panel.gd](../../scripts/ui/race_weekend/session_results_panel.gd) (`SessionResultsPanel`, extends `VBoxContainer`).

Referenced by [scripts/ui/pitwall_workspace.gd](../../scripts/ui/pitwall_workspace.gd), [scripts/ui/race_weekend/results_workspace.gd](../../scripts/ui/race_weekend/results_workspace.gd).

## Interface

Primary presentation entry points:

- `configure(value: RaceViewQuery) -> void`
- `refresh() -> void`
- `presentation(sim: RaceViewQuery) -> Dictionary`

No custom intent signals are declared by this script. Inherited signals and native Control events remain available.

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
