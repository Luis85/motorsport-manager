---
id: "race-pit-service-panel"
title: "Physical pit-service panel"
description: "Presents the two owned cars' approach, entry, queue, service and exit states from actual pit evidence."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/pit_service_panel.gd"
symbol: "RacePitServicePanel"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Physical pit-service panel

Presents the two owned cars' approach, entry, queue, service and exit states from actual pit evidence.

## Intent and purpose

The intent is to explain the progress and outcome of a physical racing pit visit. Its purpose is to show both managed cars from approach through entry, queue, whole-car service and exit without presenting a forecast as a countdown.

## User goals

- See whether a stop is approaching, queued, servicing, exiting, canceled, complete or interrupted.
- Check the planned/locked set, repair request and measured last completed visit.
- Understand when cancellation remains available and when service selection is frozen.

## Used components

Each managed-driver card uses [RaceStatusBadge](race-status-badge.md) for its state and five phase chips, native labels, and a `ProgressBar` for a known whole-car service duration. [PitwallDesign](pitwall-design.md) and [UI helpers](ui.md) build the surfaces. `RaceViewQuery` supplies detached car/policy/reliability/journal evidence.

## Interactions

`update_records()` tracks accepted pit/cancel commands and only correlates a pit exit to its recorded entry by `related_id`. `present()` updates two stable cards. Reading exposes instructions such as cancellation closing after entry; it provides no buttons or command signal. A service progress bar appears only during service with an available duration. Practice/qualifying display NOT APPLICABLE because garage fitting/transit is not a race visit. Queue duration and individual-wheel progress are not measured.

## Links to other pages

- [Team: Pit service host](team-orders-panel.md)
- [Tyre selection and stop-plan page](advanced-tyres-page.md)
- [Completed physical visit review](race-results-workspace.md)

## Behavior and state

configure accepts RaceViewQuery; update_records correlates retained visits and present keeps both car rows stable. The whole-car service timer is separate from pit-lane duration and individual-wheel progress. Missing visits stay unavailable and this panel cannot schedule, cancel or execute a stop.

## Source and integration

Implementation: [scripts/ui/race_weekend/pit_service_panel.gd](../../scripts/ui/race_weekend/pit_service_panel.gd) (`RacePitServicePanel`, extends `VBoxContainer`).

Referenced by [scripts/ui/team_orders_panel.gd](../../scripts/ui/team_orders_panel.gd).

## Interface

Primary presentation entry points:

- `configure(value: RaceViewQuery) -> void`
- `present() -> void`
- `update_records() -> void`
- `describe(id: int) -> Dictionary`

No custom intent signals are declared by this script. Inherited signals and native Control events remain available.

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
