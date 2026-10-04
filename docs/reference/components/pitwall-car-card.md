---
id: "pitwall-car-card"
title: "Engineering driver card"
description: "Presents one owned driver's resources, decision evidence and explicit routes into details."
kind: "component"
surface: "advanced"
source: "scripts/ui/pitwall_car_card.gd"
symbol: "PitwallCarCard"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "RefCounted"
---

# Engineering driver card

Presents one owned driver's resources, decision evidence and explicit routes into details.

## Intent and purpose

Presents one owned driver's resources, decision evidence and explicit routes into details.

## User goals

Keep one owned driver’s fitted tyres, estimated finish fuel, pit ownership and open issue in view, then reach the appropriate details.

## Used components

- [Driver emblem](race-driver-emblem.md)

## Interactions

The name opens the supplied details route. The card reparents existing host action controls rather than implementing another command channel. Refresh displays the driver’s current readout; stacking only changes layout.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Engineering pitwall layout](pitwall-workspace.md)
- [Strategy desk](strategy-desk.md)
- [Practice run panel](practice-panel.md)

## Behavior and state

build binds the host panel and existing controls; refresh reads RaceViewQuery for a stable driver ID. set_stacked adapts the rail layout. The card reuses the current driver's decisions and does not mutate the sporting model during refresh.

## Source and integration

Implementation: [scripts/ui/pitwall_car_card.gd](../../../scripts/ui/pitwall_car_card.gd) (`PitwallCarCard`, extends `RefCounted`).

Referenced by [scripts/ui/pitwall_workspace.gd](../../../scripts/ui/pitwall_workspace.gd).

## Interface

Public presentation entry points:

- `refresh(model: RaceViewQuery, id: int) -> void`
- `build(host: PanelContainer, existing: Dictionary, car: Dictionary, details: Callable) -> void`
- `set_stacked(stacked: bool) -> void`

No custom intent signals are declared by this script.

## Related documentation

- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
