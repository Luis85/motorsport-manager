---
id: "race-read-panel"
title: "Read the race panel"
description: "Provides a bounded observational spotlight and stable routes into both-driver reading and race radio."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/race_read_panel.gd"
symbol: "RaceReadPanel"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "PanelContainer"
---

# Read the race panel

Provides a bounded observational spotlight and stable routes into both-driver reading and race radio.

## Intent and purpose

Provides a bounded observational spotlight and stable routes into both-driver reading and race radio.

## User goals

Get a calm summary of the currently important trade-off, then read both drivers or full radio history.

## Used components

Native headline/detail `Label`s and two `Button`s, built with [native control helpers](ui.md) and [pitwall design](pitwall-design.md). It has no editable draft or nested chart.

## Interactions

Read both drivers emits a non-targeted reading request for a fixed snapshot; Race radio emits a navigation request. The panel renders a supplied focus snapshot and has no car-command or playback action.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Engineering pitwall layout](pitwall-workspace.md)
- [Race radio inspector](race-radio-inspector.md)
- [Engineering driver card](pitwall-car-card.md)

## Behavior and state

present accepts a detached snapshot.focus projection and updates only changed text. reading_requested and radio_requested ask the host to reveal existing reading surfaces. Tooltip evidence remains available beyond the bounded caption; neither route executes an order or changes playback.

## Source and integration

Implementation: [scripts/ui/race_weekend/race_read_panel.gd](../../scripts/ui/race_weekend/race_read_panel.gd) (`RaceReadPanel`, extends `PanelContainer`).

Referenced by [scripts/ui/pitwall_workspace.gd](../../scripts/ui/pitwall_workspace.gd).

## Interface

Public presentation entry points:

- `present(snapshot: Dictionary) -> void`

Emitted intent signals:

- `reading_requested`
- `radio_requested`

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
