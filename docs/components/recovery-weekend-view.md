---
id: "recovery-weekend-view"
title: "Recovery-capable weekend layout"
description: "Adds recovery evidence and routes to the weather/strategy weekend stack."
kind: "layout"
surface: "advanced"
source: "scripts/ui/recovery_weekend.gd"
symbol: "RecoveryWeekendView"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "WeatherWeekendView"
---

# Recovery-capable weekend layout

Adds recovery evidence and routes to the weather/strategy weekend stack.

## Intent and purpose

Adds recovery evidence and routes to the weather/strategy weekend stack.

## User goals

Reach enhanced reliability/recovery options and observe race-control procedure within the existing weather/strategy weekend.

## Used components

- [Weather-capable weekend layout](weather-weekend-view.md)
- [Recovery panel](recovery-panel.md)

## Interactions

Recovery links select the named owned driver and reveal the existing panel. Commands route through targeted_command; refresh updates labels and debrief from detached observations. The topic is created only when the recovery mechanic exists. Revealing it does not pause the session or construct another race.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Recovery panel](recovery-panel.md)
- [Weather-capable weekend layout](weather-weekend-view.md)
- [Engineering pitwall layout](pitwall-workspace.md)
- [Advanced debrief page](advanced-debrief-page.md)

## Behavior and state

open_recovery targets a driver and reveals the registered recovery topic. Existing two-car controls remain primary; scrolling evidence is separate from action controls. refresh observes the same authoritative weekend, with no extra simulation or implicit time control.

## Source and integration

Implementation: [scripts/ui/recovery_weekend.gd](../../scripts/ui/recovery_weekend.gd) (`RecoveryWeekendView`, extends `WeatherWeekendView`).

Referenced by [scripts/ui/pitwall_workspace.gd](../../scripts/ui/pitwall_workspace.gd).

## Interface

Public presentation entry points:

- `refresh() -> void`
- `open_recovery(id: int) -> void`

No custom intent signals are declared by this script.

## Related documentation

- [docs/ui/race-weekend/layout-system.md](../../docs/ui/race-weekend/layout-system.md)
- [Component catalog](README.md)
