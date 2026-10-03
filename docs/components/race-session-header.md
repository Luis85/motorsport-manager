---
id: "race-session-header"
title: "Advanced session header"
description: "Shows actual event/session/clock/flag/weather identity, pause, speed, phase action and weekend utilities."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/session_header.gd"
symbol: "RaceSessionHeader"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "PanelContainer"
---

# Advanced session header

Shows actual event/session/clock/flag/weather identity, pause, speed, phase action and weekend utilities.

## Intent and purpose

Shows actual event/session/clock/flag/weather identity, pause, speed, phase action and weekend utilities.

## User goals

Orient to the circuit, current phase, clock and conditions, and deliberately control playback or approve the next stage.

## Used components

Native identity/clock/flag/weather `Label`s, phase/pause `Button`s, speed `OptionButton`, and a `MenuButton` with a native utility popup, built through [pitwall design](pitwall-design.md) and [native control helpers](ui.md).

## Interactions

Pause and speed emit action_requested; the phase button emits advance_requested for host phase validation. Weekend utilities emit IDs for Save checkpoint, Export race log, Open guide and Main menu. Opening the menu is observational. The host updates phase labels and availability, so viewing the header never approves the next phase.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Base Advanced weekend layout](weekend-view.md)
- [Advanced weekend support](weekend-view-support.md)
- [Context guide](context-guide.md)
- [Main menu](main-menu-view.md)

## Behavior and state

configure binds RaceViewQuery before mounting. action_requested carries pause/speed intent, advance_requested requires explicit phase approval, and utility_requested selects save/export/guide/menu. The host refreshes its stable controls; opening the utility menu alone does not pause the race.

## Source and integration

Implementation: [scripts/ui/race_weekend/session_header.gd](../../scripts/ui/race_weekend/session_header.gd) (`RaceSessionHeader`, extends `PanelContainer`).

Referenced by [scripts/ui/weekend.gd](../../scripts/ui/weekend.gd), [scripts/ui/weekend_support.gd](../../scripts/ui/weekend_support.gd).

## Interface

Public presentation entry points:

- `configure(value: RaceViewQuery) -> void`

Emitted intent signals:

- `action_requested(action: String, payload: Dictionary)`
- `utility_requested(id: int)`
- `advance_requested`

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
