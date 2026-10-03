---
id: "race-practice-workspace"
title: "Practice engineering layout"
description: "Places both drivers' independent programme cards, readiness badges and explicit session actions in one full view."
kind: "layout"
surface: "advanced"
source: "scripts/ui/race_weekend/practice_workspace.gd"
symbol: "RacePracticeWorkspace"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Practice engineering layout

Places both drivers' independent programme cards, readiness badges and explicit session actions in one full view.

## Intent and purpose

Places both drivers' independent programme cards, readiness badges and explicit session actions in one full view.

## User goals

Prepare and monitor both drivers’ independent practice programmes together, then end the session and review retained evidence.

## Used components

- [Practice programme card](race-practice-programme-card.md)
- [Status badge](race-status-badge.md)

## Interactions

Both cards share the inline PracticePanel drafts through the host. Start practice emits session intent only while optional practice is available. Run and Recall remain named per-driver actions. End practice delegates the inherited confirmation and Return to briefing is explicit after results. Back returns to the pitwall without erasing drafts or manufacturing qualifying results.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Practice-capable weekend layout](practice-weekend-view.md)
- [Practice run panel](practice-panel.md)
- [Qualifying context strip](race-qualifying-workspace.md)

## Behavior and state

configure accepts the existing RaceViewQuery. Both cards share their existing per-driver drafts with the inline practice panel. command_requested forwards named run/session intents; close_requested returns to the pitwall. Skipped, legacy, closed and run-limit states remain visible as evidence rather than new opportunities.

## Source and integration

Implementation: [scripts/ui/race_weekend/practice_workspace.gd](../../scripts/ui/race_weekend/practice_workspace.gd) (`RacePracticeWorkspace`, extends `VBoxContainer`).

Referenced by [scripts/ui/practice_weekend.gd](../../scripts/ui/practice_weekend.gd), [scripts/ui/pitwall_finishing_guide.gd](../../scripts/ui/pitwall_finishing_guide.gd).

## Interface

Public presentation entry points:

- `configure(value: RaceViewQuery) -> void`
- `present() -> void`

Emitted intent signals:

- `command_requested(action: String,payload: Dictionary)`
- `close_requested`

## Related documentation

- [docs/ui/race-weekend/layout-system.md](../../docs/ui/race-weekend/layout-system.md)
- [Component catalog](README.md)
