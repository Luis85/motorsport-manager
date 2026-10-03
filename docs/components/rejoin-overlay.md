---
id: "rejoin-overlay"
title: "Pit rejoin overlay"
description: "Paints observational rejoin uncertainty at the circuit's fixed pit exit."
kind: "component"
surface: "advanced"
source: "scripts/ui/rejoin_overlay.gd"
symbol: "RejoinOverlay"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "Control"
---

# Pit rejoin overlay

Paints observational rejoin uncertainty at the circuit's fixed pit exit.

## Intent and purpose

Paints observational rejoin uncertainty at the circuit's fixed pit exit.

## User goals

Locate the fixed pit exit and its uncertainty band on the circuit before making a stop decision.

## Used components

A mouse-transparent drawing `Control` attached to [TrackCanvas](track-canvas.md), using geometry and a detached rejoin forecast. It constructs no interactive child controls.

## Interactions

The host supplies canvas, forecast and enabled state; the Layers toggle turns this optional estimate overlay on or off. The drawing layer ignores mouse input and has no Box or plan-approval action. The exit band stays on fixed circuit geometry and labels uncertain traffic timing; it never animates a hypothetical car or represents an observed future finish.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Track canvas](track-canvas.md)
- [Strategy-capable weekend layout](strategy-weekend-view.md)
- [Strategy desk](strategy-desk.md)

## Behavior and state

StrategyWeekendView supplies the TrackCanvas and forecaster presentation. The overlay redraws projected observation only; it does not move authoritative cars, enforce a rejoin outcome or replace estimated ranges with a guaranteed position.

## Source and integration

Implementation: [scripts/ui/rejoin_overlay.gd](../../scripts/ui/rejoin_overlay.gd) (`RejoinOverlay`, extends `Control`).

Referenced by [scripts/ui/strategy_weekend.gd](../../scripts/ui/strategy_weekend.gd).

## Interface

The host supplies fields/children and mounts the native lifecycle; this type has no public configure/present method.

No custom intent signals are declared by this script.

## Related documentation

- [Strategy-capable weekend layout](strategy-weekend-view.md)
- [Track canvas](track-canvas.md)
- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
