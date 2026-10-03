---
id: "minimal-status-gauge"
title: "Minimal status gauge"
description: "Draws redundant tyre-wheel, condition or segmented stress cues beside textual instrument values."
kind: "component"
surface: "shipping"
source: "scripts/ui/race_weekend/minimal/gauge.gd"
symbol: "MinimalStatusGauge"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "Control"
---

# Minimal status gauge

Draws redundant tyre-wheel, condition or segmented stress cues beside textual instrument values.

## Intent and purpose

Add a compact visual cue beside the driver card’s actual textual values. Wheel segments make low tread and punctures visible; stress uses ten segments and ordinary condition uses a filled line.

## User goals

Notice a changing condition quickly while retaining adjacent numbers and explanations for precise interpretation.

## Used components

This is a custom-drawn native Control using [Minimal race style](minimal-race-style.md) ink. It composes no child widgets; the surrounding labels belong to [Minimal driver condition card](minimal-driver-card.md).

## Interactions

The gauge ignores pointer input. present snaps nonnegative values to half units and redraws only on amount/color changes; present_wheels copies changed observations. Resize requests redraw. Wheel punctures draw a cross; low tread changes color.

## Links to other pages

[Minimal driver condition card](minimal-driver-card.md) owns these gauges inside the [two-driver instrument row](minimal-driver-row.md) and [Minimal race layout](minimal-race-workspace.md).

## Behavior and state

present updates the shown amount/color and present_wheels copies wheel observations. Equal values avoid redraw; punctures use a cross and low tread changes ink. The gauge ignores mouse input and never replaces the adjacent numeric/text explanation.

## Source and integration

Implementation: [scripts/ui/race_weekend/minimal/gauge.gd](../../scripts/ui/race_weekend/minimal/gauge.gd) (`MinimalStatusGauge`, extends `Control`).

Referenced by [scripts/ui/race_weekend/minimal/driver_card.gd](../../scripts/ui/race_weekend/minimal/driver_card.gd).

## Interface

Primary entry points:

- `present(amount: float, color: Color) -> void`
- `present_wheels(values: Array) -> void`

No custom intent signals are declared by this script. Inherited signals and native Control events remain available.

## Related documentation

- [docs/race-weekend-minimal.md](../../docs/race-weekend-minimal.md)
- [Component catalog](README.md)
