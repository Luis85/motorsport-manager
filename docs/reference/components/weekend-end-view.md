---
id: "weekend-end-view"
title: "Weekend completion"
description: "Renders detached factual final values with menu, new-weekend and return-to-track routes."
kind: "page"
surface: "shipping"
source: "scripts/ui/weekend_end.gd"
symbol: "WeekendEndView"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Weekend completion

Renders detached factual final values with menu, new-weekend and return-to-track routes.

## Intent and purpose

Give a completed standalone weekend a factual review destination before the player moves on. It displays final classification and both managed drivers’ observed status, completed laps, pit stops and best laps.

## User goals

Review both drivers’ outcomes and the full field, revisit the finished circuit, return to the menu, or configure another weekend deliberately.

## Used components

Native managed-driver summary panels, a five-column classification Tree and footer buttons use [Minimal race style](minimal-race-style.md). [Native application shell](native-shell.md) supplies a detached WeekendSummary after saving final results.

## Interactions

Main menu emits menu_requested; Review final track emits track_requested and returns to the same terminal weekend; New weekend emits new_weekend_requested and opens configuration. The classification is observational. Navigation neither awards resources nor starts a new event.

## Links to other pages

[Minimal race layout](minimal-race-workspace.md) requests this review at results. Footer routes lead to [Main menu](main-menu-view.md), the terminal [Minimal race layout](minimal-race-workspace.md), or [Grand Prix setup](grand-prix-setup.md). Successful campaign settlement instead routes through [Campaign screen composition](campaign-screens.md) to the desk.

## Behavior and state

configure accepts WeekendSummary and text scale. Signals request navigation only; opening results cannot award resources or implicitly start another event. The shell saves the final checkpoint before mounting and routes campaign completion through factual settlement back to Director Desk.

## Source and integration

Implementation: [scripts/ui/weekend_end.gd](../../../scripts/ui/weekend_end.gd) (`WeekendEndView`, extends `VBoxContainer`).

Referenced by [scripts/composition/main.gd](../../../scripts/composition/main.gd).

## Interface

Primary presentation entry points:

- `configure(summary: Dictionary, scale: float = 1.0) -> void`

Emitted intent signals:

- `menu_requested`
- `new_weekend_requested`
- `track_requested`

## Related documentation

- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
