---
id: "battle-overlay"
title: "Battle overlay"
description: "Draws paired battle outlines and labels from projected physical car positions."
kind: "component"
surface: "advanced"
source: "scripts/ui/battle_overlay.gd"
symbol: "BattleOverlay"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "Control"
---

# Battle overlay

Draws paired battle outlines and labels from projected physical car positions.

## Intent and purpose

Draws paired battle outlines and labels from projected physical car positions.

## User goals

Recognize a current two-car contest on the circuit and relate its label to the observed cars.

## Used components

A mouse-transparent drawing `Control` over [TrackCanvas](track-canvas.md). It draws from the host canvas projection and has no interactive child widgets.

## Interactions

This mouse-transparent drawing layer has no selection or command action. Its host supplies the canvas; frame redraws project observed battle positions and labels.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Track canvas](track-canvas.md)
- [Team orders panel](team-orders-panel.md)
- [Strategy-capable weekend layout](strategy-weekend-view.md)

## Behavior and state

Hosted over TrackCanvas by StrategyWeekendView. It redraws observation only; screen proximity never creates a collision or a sporting battle.

## Source and integration

Implementation: [scripts/ui/battle_overlay.gd](../../../scripts/ui/battle_overlay.gd) (`BattleOverlay`, extends `Control`).

Referenced by [scripts/ui/strategy_weekend.gd](../../../scripts/ui/strategy_weekend.gd).

## Interface

The host supplies fields/children and mounts the native lifecycle; this type has no public configure/present method.

No custom intent signals are declared by this script.

## Related documentation

- [Track canvas](track-canvas.md)
- [Strategy-capable weekend layout](strategy-weekend-view.md)
- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
