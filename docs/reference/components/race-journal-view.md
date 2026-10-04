---
id: "race-journal-view"
title: "Decision journal"
description: "Renders structured accepted commands and observed outcomes from the existing strategy evidence query."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/journal_view.gd"
symbol: "RaceJournalView"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Decision journal

Renders structured accepted commands and observed outcomes from the existing strategy evidence query.

## Intent and purpose

The intent is to make accepted team decisions auditable. Its purpose is to show the latest retained command/model evidence beside observed outcomes so the player can review what was ordered and what physically happened.

## User goals

- Find a recent accepted command or observed outcome for either managed driver or the team.
- Read the estimate recorded at the time without mistaking pit-visit duration for net race-time loss.
- Recognize missing history when the bounded journal has reached capacity.

## Used components

Uses a native five-column `Tree` and 100 persistent `TreeItem` rows, with a caption built through [UI helpers](ui.md). It consumes `RaceViewQuery.strategy_state`; no other catalog component is mounted inside it.

## Interactions

`present()` refreshes when the journal sequence changes. It filters team/player records to supported evidence kinds, shows at most the latest 100 newest first, and exposes record ID, kind and evidence in row tooltips. The native table supports reading and selection; there is no command, export or navigation signal. Opening this reading never turns an unexecuted order into a physical consequence.

## Links to other pages

- [Session review: Decisions page](race-results-workspace.md)
- [Debrief: narrative and export](advanced-debrief-page.md)
- [Engineering pitwall host](pitwall-workspace.md)

## Behavior and state

configure accepts RaceViewQuery; present refreshes the factual reading. Recorded evidence is distinct from predicted alternatives or personal interpretation. Missing or unexecuted orders cannot be displayed as completed physical consequences.

## Source and integration

Implementation: [scripts/ui/race_weekend/journal_view.gd](../../../scripts/ui/race_weekend/journal_view.gd) (`RaceJournalView`, extends `VBoxContainer`).

Referenced by [scripts/ui/race_weekend/results_workspace.gd](../../../scripts/ui/race_weekend/results_workspace.gd).

## Interface

Primary presentation entry points:

- `configure(value: RaceViewQuery) -> void`
- `present() -> void`

No custom intent signals are declared by this script. Inherited signals and native Control events remain available.

## Related documentation

- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
