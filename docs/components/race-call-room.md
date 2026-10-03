---
id: "race-call-room"
title: "Director call room"
description: "Shows a frozen, named-driver decision with alternatives, exact commitment text, explicit confirmation and follow-up."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/call_room.gd"
symbol: "RaceCallRoom"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Director call room

Shows a frozen, named-driver decision with alternatives, exact commitment text, explicit confirmation and follow-up.

## Intent and purpose

Shows a frozen, named-driver decision with alternatives, exact commitment text, explicit confirmation and follow-up.

## User goals

Review a frozen situation for a named driver, choose a bounded pace/engine or physical pit/run call, and separate acceptance from observed outcome.

## Used components

[Director style](director-style.md) creates header/evidence labels and named action buttons. A native `ScrollContainer`, `GridContainer` and `PanelContainer` hold option/evidence content; commit/watch/details controls stay distinct from the reading body.

## Interactions

Selecting an option stages a choice; Confirm emits the exact reviewed payload. Race options cover two-lap pace/engine intent and physical pit entry; qualifying options cover release/recall. Stale snapshots block commitment until Refresh situation. Back and Full strategy navigate. Keep orders & watch and Watch it unfold emit an explicit watch intent that the Director host uses for 8× playback; they are time controls, not ordinary reading.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Race Director layout](race-director-workspace.md)
- [Strategy desk](strategy-desk.md)
- [Director driver card](director-car-card.md)
- [Decision review drawer](race-decision-drawer.md)

## Behavior and state

present receives displayed evidence and any accepted receipt. choose stages an option; commit emits the reviewed payload. is_stale blocks outdated evidence until refresh_snapshot. command_result keeps accepted, rejected and subsequent observed outcomes distinct; Watch is a separate host intent.

## Source and integration

Implementation: [scripts/ui/race_weekend/call_room.gd](../../scripts/ui/race_weekend/call_room.gd) (`RaceCallRoom`, extends `VBoxContainer`).

Referenced by [scripts/ui/race_director_workspace.gd](../../scripts/ui/race_director_workspace.gd).

## Interface

Public presentation entry points:

- `configure(value: RaceViewQuery) -> void`
- `present(value: Dictionary = {}, accepted: Dictionary = {}) -> void`
- `refresh_snapshot() -> void`
- `is_stale() -> bool`
- `choose(key: String) -> void`
- `commitment_text() -> String`
- `payload() -> Dictionary`
- `commit() -> void`

Emitted intent signals:

- `close_requested`
- `command_requested(action: String, payload: Dictionary)`
- `watch_requested`
- `details_requested(id: int)`

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
