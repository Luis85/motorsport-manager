---
id: "director-car-card"
title: "Director driver card"
description: "Summarizes a controlled driver and provides Call, Plan and Follow routes in Race Director."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/director_car_card.gd"
symbol: "DirectorCarCard"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "PanelContainer"
---

# Director driver card

Summarizes a controlled driver and provides Call, Plan and Follow routes in Race Director.

## Intent and purpose

Summarizes a controlled driver and provides Call, Plan and Follow routes in Race Director.

## User goals

Identify a named owned driver, distinguish current resource facts from finish estimates, and choose call review, plan details or camera following.

## Used components

Native identity/state/resource `Label`s, a `ProgressBar` and Call/Plan/Follow `Button`s built by [Director style](director-style.md). The parent Director owns the routes signaled by these buttons.

## Interactions

Follow emits the driver ID for observation. Race plan emits plan_requested. The main action emits call_requested; its label reflects phase and paused state, including Pause & decide or Pause & review run. The Director host owns the deliberate pause and page routing. Present updates text, tread and accepted-call follow-up without issuing an order.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Race Director layout](race-director-workspace.md)
- [Director call room](race-call-room.md)
- [Strategy desk](strategy-desk.md)

## Behavior and state

present accepts a detached car projection, phase, paused state and follow-up evidence. Signals name the target driver. Labels distinguish current state and follow-up; refresh does not issue orders, change selection through hidden actions or recalculate race state.

## Source and integration

Implementation: [scripts/ui/race_weekend/director_car_card.gd](../../../scripts/ui/race_weekend/director_car_card.gd) (`DirectorCarCard`, extends `PanelContainer`).

Referenced by [scripts/ui/race_director_workspace.gd](../../../scripts/ui/race_director_workspace.gd).

## Interface

Public presentation entry points:

- `present(value: Dictionary, phase: String, paused: bool, followup: Dictionary) -> void`

Emitted intent signals:

- `call_requested(id: int)`
- `plan_requested(id: int)`
- `follow_requested(id: int)`

## Related documentation

- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
