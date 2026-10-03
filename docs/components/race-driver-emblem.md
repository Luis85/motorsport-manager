---
id: "race-driver-emblem"
title: "Driver emblem"
description: "Draws an original vector helmet and number identity inside Engineering driver cards."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/driver_emblem.gd"
symbol: "RaceDriverEmblem"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "Control"
---

# Driver emblem

Draws an original vector helmet and number identity inside Engineering driver cards.

## Intent and purpose

Draws an original vector helmet and number identity inside Engineering driver cards.

## User goals

Recognize a driver by a compact original helmet illustration, number and team color beside text identity.

## Used components

A native drawing `Control` using supplied driver number/color and [native control helper](ui.md) ink constants. The emblem draws vector shapes directly and has no interactive children.

## Interactions

The host sets number and tint before drawing. Mouse input passes through; the illustration has no selection, navigation or command behavior. Adjacent host text supplies the driver’s readable identity.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Engineering driver card](pitwall-car-card.md)
- [Engineering pitwall layout](pitwall-workspace.md)

## Behavior and state

The host supplies the driver number and color as presentation fields. Drawing is decorative and mouse-transparent; it has no command or selection API and uses no photograph or licensed portrait.

## Source and integration

Implementation: [scripts/ui/race_weekend/driver_emblem.gd](../../scripts/ui/race_weekend/driver_emblem.gd) (`RaceDriverEmblem`, extends `Control`).

Referenced by [scripts/ui/pitwall_car_card.gd](../../scripts/ui/pitwall_car_card.gd).

## Interface

The host supplies fields/children and mounts the native lifecycle; this type has no public configure/present method.

No custom intent signals are declared by this script.

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
