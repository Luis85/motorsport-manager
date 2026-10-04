---
id: "race-tyre-readout"
title: "Fitted and planned tyre readout"
description: "Shows fitted finite-set identity, status and planned replacement for the selected driver."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/tyre_readout.gd"
symbol: "RaceTyreReadout"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "HBoxContainer"
---

# Fitted and planned tyre readout

Shows fitted finite-set identity, status and planned replacement for the selected driver.

## Intent and purpose

The intent is to keep tyre identity and fit status explicit. Its purpose is to show the selected managed driver’s physically fitted finite set beside the planned replacement, preserving used-set condition.

## User goals

- Identify the fitted set, aggregate tread, limiting wheel and punctures.
- See whether the planned set is fresh, used, already fitted or unavailable.
- Understand that choosing a set never renews it or fits it immediately.

## Used components

Two native labels sit in fitted/planned card surfaces built with [PitwallDesign](pitwall-design.md) and [UI helpers](ui.md). It reads detached `RaceViewQuery`, uses `TyreInventory` to find fitted identity and `WheelTyres` to count usable stock; it mounts no allocation editor.

## Interactions

`present()` follows the host’s selected driver. The fitted tooltip gives usable/fresh/unusable inventory counts. Planned status says no usable set selected, already fitted, or fits only on release, formation or physical service. Punctured wheel IDs and minimum-wheel condition come from the fitted record; they are not a service diagnosis. Rival selection shows Private condition / Private plan. There are no buttons or command signals; selection and actual fitting belong to the host/domain boundary.

## Links to other pages

- [Tyres page host](advanced-tyres-page.md)
- [Finite stock selection and explicit actions](weekend-view.md)
- [Frozen physical service selection](race-pit-service-panel.md)

## Behavior and state

configure binds RaceViewQuery; present distinguishes the physically fitted set from future choice. Selecting stock elsewhere does not fit or renew a set. Limiting-wheel and missing-stock facts stay explicit; the component provides no tyre-fit command.

## Source and integration

Implementation: [scripts/ui/race_weekend/tyre_readout.gd](../../../scripts/ui/race_weekend/tyre_readout.gd) (`RaceTyreReadout`, extends `HBoxContainer`).

Referenced by [scripts/ui/weekend.gd](../../../scripts/ui/weekend.gd), [scripts/ui/weekend_support.gd](../../../scripts/ui/weekend_support.gd).

## Interface

Primary presentation entry points:

- `configure(value: RaceViewQuery) -> void`
- `present() -> void`

No custom intent signals are declared by this script. Inherited signals and native Control events remain available.

## Related documentation

- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
