---
id: "race-timing-tower"
title: "Advanced timing tower"
description: "Keeps native classification rows persistent and emits stable driver-selection intent."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/timing_tower.gd"
symbol: "RaceTimingTower"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "PanelContainer"
---

# Advanced timing tower

Keeps native classification rows persistent and emits stable driver-selection intent.

## Intent and purpose

The intent is to keep live classification available while the player observes and chooses a car to inspect. Its purpose is a stable, compact native timing table with session-dependent gap/lap and state text.

## User goals

- Follow order, estimated race gaps, fitted compound and each entrant’s current state.
- Select a managed driver or inspect a rival using stable driver identity.
- Distinguish OUT/HOT/IN/BOX attempts, grid positions, racing observations, finished/lapped cars and retirements.

## Used components

A native five-column `Tree` retains one row per rank and maps current entries to driver IDs. Labels and chrome use [UI helpers](ui.md), [PitwallDesign](pitwall-design.md) and [GameTheme](game-theme.md). It reads `RaceViewQuery`, not live entities.

## Interactions

Selecting a native row emits `driver_selected(id)` from row metadata; reordering cannot retarget a command by rank. `present()` returns the displayed detached order and updates persistent rows with signals blocked. Race gaps prefixed ~ are distance/speed estimates; finished gaps use measured times/laps. Practice/qualifying use the retained qualifying-style best/time state display; the separate results panel supplies practice’s unranked measured-observation semantics. Tooltips include public name/team, intent, tyre summary and best lap. Selection opens inspection; it grants no command authority over rivals.

## Links to other pages

- [Shared timing/circuit layout](race-observation-workspace.md)
- [Selection routing host](weekend-view.md)
- [Final session-aware classification](session-results-panel.md)
- [Owned-driver versus rival inspection](race-telemetry-inspector.md)

## Behavior and state

configure accepts RaceViewQuery; present updates actual classification and returns the displayed order to the host. driver_selected carries an ID rather than row rank. Text, tooltips and public rival inspection stay separate from command authority.

## Source and integration

Implementation: [scripts/ui/race_weekend/timing_tower.gd](../../scripts/ui/race_weekend/timing_tower.gd) (`RaceTimingTower`, extends `PanelContainer`).

Referenced by [scripts/ui/weekend.gd](../../scripts/ui/weekend.gd), [scripts/ui/weekend_support.gd](../../scripts/ui/weekend_support.gd).

## Interface

Primary presentation entry points:

- `configure(value: RaceViewQuery) -> void`
- `present() -> Array`

Emitted intent signals:

- `driver_selected(id: int)`

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
