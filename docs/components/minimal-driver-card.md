---
id: "minimal-driver-card"
title: "Minimal driver condition card"
description: "Keeps one managed driver's measured lap, tyres, fuel, condition, damage, estimated stress and live modes visible as read-only instruments."
kind: "component"
surface: "shipping"
source: "scripts/ui/race_weekend/minimal/driver_card.gd"
symbol: "MinimalDriverCard"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "PanelContainer"
---

# Minimal driver condition card

Keeps one managed driver's measured lap, tyres, fuel, condition, damage, estimated stress and live modes visible as read-only instruments.

## Intent and purpose

Keep one managed driver’s condition visible alongside the other driver without requiring a workspace change. The card separates fitted tyres, measured laps and condition from estimated stress or fuel finish margin.

## User goals

Compare both drivers’ current resources, notice punctures or aggregate damage, identify the selected command target, and read current pace/engine modes before choosing an action elsewhere.

## Used components

[Minimal status gauges](minimal-status-gauge.md) supplement native labels for tyres, car condition and stress. [Minimal race style](minimal-race-style.md) supplies typography and selected-border styling; [Minimal timing presenter](minimal-race-timing-presenter.md) provides readouts, rank and selection.

## Interactions

The card exposes tooltips and textual selection state, with no action or driver-selection signal. Repeated unchanged readouts skip label updates. Empty data hides the card. Compact mode changes padding/separation and shortens the stress cause note while keeping numeric instruments.

## Links to other pages

The [two-driver instrument row](minimal-driver-row.md) hosts both cards in [Minimal race layout](minimal-race-workspace.md). Commands and driver selection live in the [Minimal pitwall](minimal-pitwall.md); [timing](minimal-timing-table.md) provides classification context.

## Behavior and state

configure binds a stable driver ID and text scale; present consumes a detached readout and selection marker. Empty data hides the card; limiting-wheel/puncture and unavailable values remain explicit. set_compact changes padding and separation, and shortens the stress cause note, while retaining numeric information and meters. Cards never select drivers or issue orders.

## Source and integration

Implementation: [scripts/ui/race_weekend/minimal/driver_card.gd](../../scripts/ui/race_weekend/minimal/driver_card.gd) (`MinimalDriverCard`, extends `PanelContainer`).

Referenced by [scripts/ui/race_weekend/minimal/workspace.gd](../../scripts/ui/race_weekend/minimal/workspace.gd).

## Interface

Primary presentation entry points:

- `configure(id: int, scale: float) -> void`
- `present(data: Dictionary, position: int, selected: bool) -> void`
- `set_compact(value: bool) -> void`
- `text(value: String, points: int, muted: bool = false) -> Label`

No custom intent signals are declared by this script. Inherited signals and native Control events remain available.

## Related documentation

- [docs/race-weekend-minimal.md](../../docs/race-weekend-minimal.md)
- [Component catalog](README.md)
