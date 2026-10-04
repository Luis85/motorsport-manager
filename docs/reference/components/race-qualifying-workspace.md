---
id: "race-qualifying-workspace"
title: "Qualifying context strip"
description: "Shows both managed drivers' current attempt state, fitted set, measured best and feasible release context."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/qualifying_workspace.gd"
symbol: "RaceQualifyingWorkspace"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "PanelContainer"
---

# Qualifying context strip

Shows both managed drivers' current attempt state, fitted set, measured best and feasible release context.

## Intent and purpose

The intent is to orient the player during the single qualifying session. Its purpose is to summarize each managed driver’s current attempt, fitted set, best valid lap and the estimated feasibility of a new release alongside the circuit.

## User goals

- Check BOX/OUT/HOT/IN run state and distinguish an untimed driver from a measured best lap.
- Read the signed best-lap gap to the fastest valid lap in this session.
- Decide whether to inspect a run plan before using the host’s explicit release or recall controls.

## Used components

A native `PanelContainer` holds two driver cells with Run plan buttons and labels made through [UI helpers](ui.md) and styled with [PitwallDesign](pitwall-design.md). The strip is mounted alongside the circuit within the shared [observation workspace](race-observation-workspace.md); it does not contain a canvas. The read model supplies the qualifying-release estimate.

## Interactions

Clicking a driver’s Run plan button emits `inspect_requested(id)` to the host; it does not Send out or recall the car. Tooltips explain that the estimated required time/latest release refer to a NEW run, with latest release expressed in elapsed session seconds. These values are not a countdown for the active lap and do not guarantee clear traffic. Closed sessions distinguish an existing hot lap that may finish from no new release.

## Links to other pages

- [Base Advanced weekend host](weekend-view.md)
- [Shared race layout](race-observation-workspace.md)
- [Completed qualifying classification](session-results-panel.md)

## Behavior and state

configure binds RaceViewQuery; present reads the existing qualifying-release forecast. Latest feasible release uses elapsed session time and is not the current lap countdown. Closed sessions distinguish an existing hot lap that may finish from unavailable new releases; untimed drivers remain untimed.

## Source and integration

Implementation: [scripts/ui/race_weekend/qualifying_workspace.gd](../../../scripts/ui/race_weekend/qualifying_workspace.gd) (`RaceQualifyingWorkspace`, extends `PanelContainer`).

Referenced by [scripts/ui/weekend.gd](../../../scripts/ui/weekend.gd), [scripts/ui/weekend_support.gd](../../../scripts/ui/weekend_support.gd).

## Interface

Primary presentation entry points:

- `configure(value: RaceViewQuery) -> void`
- `present() -> void`

Emitted intent signals:

- `inspect_requested(id: int)`

## Related documentation

- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
