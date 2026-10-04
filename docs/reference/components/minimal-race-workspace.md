---
id: "minimal-race-workspace"
title: "Minimal race layout"
description: "Composes the default toolbar, timing table, TrackCanvas, selected-driver pitwall, two condition cards and read-only Strategy popup."
kind: "layout"
surface: "shipping"
source: "scripts/ui/race_weekend/minimal/workspace.gd"
symbol: "MinimalRaceWorkspace"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Minimal race layout

Composes the default toolbar, timing table, TrackCanvas, selected-driver pitwall, two condition cards and read-only Strategy popup.

## Intent and purpose

Provide the default race experience as one coherent screen across practice, qualifying, formation, start, race and terminal classification. Observation, manual driver actions and explicit session approvals stay visible together.

## User goals

Manage two drivers, approve each next phase, control playback, follow classification and circuit motion, monitor resources, and compare strategy estimates on demand.

## Used components

[Session toolbar](minimal-toolbar.md), [timing table](minimal-timing-table.md), [Track canvas](track-canvas.md), [driver action panel](minimal-pitwall.md), [two-driver row](minimal-driver-row.md) and [Strategy comparison](minimal-strategy-comparison.md) are composed here. [Minimal timing presenter](minimal-race-timing-presenter.md) updates rows/cards; [Minimal race style](minimal-race-style.md) supplies chrome.

## Interactions

Driver selectors, owned timing rows and owned car clicks select the target. Send out, Box this lap, Push/Calm and engine choices use MinimalRaceControls with availability reasons. Space toggles playback, 1–5 select speed and F fits the canvas when popups are closed. Strategy open/refresh explicitly requests a detached estimate; ordinary 5 Hz refresh does not. Menu emits a leave intent that pauses through confirm_leave; results_requested asks the shell for final review.

## Links to other pages

[Weekend welcome](weekend-entry-view.md) enters this layout. [Main menu](main-menu-view.md) resumes saved sessions. [Weekend completion](weekend-end-view.md) reviews final results and can return to this terminal track; campaign events return through [Campaign screen composition](campaign-screens.md).

## Behavior and state

configure receives MinimalRaceHandle and copied preferences. Ordinary refresh runs at 5 Hz; forecasts run only on explicit open/refresh. Driver actions go through MinimalRaceControls and actual phase availability. Popup focus suppresses race shortcuts, stale engine menus close, and PR 28 delegates row rendering to MinimalRaceTimingPresenter.

## Source and integration

Implementation: [scripts/ui/race_weekend/minimal/workspace.gd](../../../scripts/ui/race_weekend/minimal/workspace.gd) (`MinimalRaceWorkspace`, extends `VBoxContainer`).

Referenced by [scripts/composition/main.gd](../../../scripts/composition/main.gd), [scripts/composition/standalone_smoke.gd](../../../scripts/composition/standalone_smoke.gd).

## Interface

Primary presentation entry points:

- `configure(value: MinimalRaceHandle, options: Dictionary = {}) -> void`
- `refresh() -> void`
- `confirm_leave(callback: Callable) -> void`
- `label(text: String, points: int = 14, muted: bool = false) -> Label`
- `button(text: String, callback: Callable, toggle: bool = false) -> Button`
- `build_toolbar() -> void`
- `build_body() -> void`
- `build_pitwall() -> void`

Emitted intent signals:

- `menu_requested`
- `new_weekend_requested`
- `results_requested`

## Related documentation

- [Minimal timing presenter](minimal-race-timing-presenter.md)
- [docs/reference/race-weekend/minimal.md](../race-weekend/minimal.md)
- [Component catalog](README.md)
