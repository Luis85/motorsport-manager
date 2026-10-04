---
id: "race-observation-workspace"
title: "Race observation layout"
description: "Defines the shared horizontal timing, circuit and selected-task/driver-rail observation body."
kind: "layout"
surface: "advanced"
source: "scripts/ui/race_weekend/race_workspace.gd"
symbol: "RaceObservationWorkspace"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "HBoxContainer"
---

# Race observation layout

Defines the shared horizontal timing, circuit and selected-task/driver-rail observation body.

## Intent and purpose

Defines the shared horizontal timing, circuit and selected-task/driver-rail observation body.

## User goals

See timing, circuit position and the relevant inspector or driver rail together during race and qualifying observation.

## Used components

A native `HBoxContainer`; [WeekendView](weekend-view.md) supplies [timing](race-timing-tower.md), [TrackCanvas](track-canvas.md) and its selected-task inspector. The wrapper itself constructs no duplicate observation or controls.

## Interactions

This shared HBox provides native expansion and spacing. The host inserts timing, circuit and rail/inspector controls and handles selection, camera and session actions. The container has no custom command or navigation event.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Base Advanced weekend layout](weekend-view.md)
- [Engineering pitwall layout](pitwall-workspace.md)
- [Advanced timing tower](race-timing-tower.md)
- [Track canvas](track-canvas.md)
- [Qualifying context strip](race-qualifying-workspace.md)

## Behavior and state

WeekendView mounts the existing components into this HBoxContainer and PitwallWorkspace adapts/reparents the rail when space changes. The layout shares spatial observation across qualifying and race while their session controls remain in the header. It has no model or command API.

## Source and integration

Implementation: [scripts/ui/race_weekend/race_workspace.gd](../../../scripts/ui/race_weekend/race_workspace.gd) (`RaceObservationWorkspace`, extends `HBoxContainer`).

Referenced by [scripts/ui/weekend.gd](../../../scripts/ui/weekend.gd), [scripts/ui/weekend_support.gd](../../../scripts/ui/weekend_support.gd).

## Interface

The host supplies fields/children and mounts the native lifecycle; this type has no public configure/present method.

No custom intent signals are declared by this script.

## Related documentation

- [Base Advanced weekend layout](weekend-view.md)
- [Engineering pitwall layout](pitwall-workspace.md)
- [docs/_archive/ui/race-weekend/layout-system.md](../../_archive/ui/race-weekend/layout-system.md)
- [Component catalog](README.md)
