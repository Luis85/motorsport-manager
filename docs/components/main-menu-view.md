---
id: "main-menu-view"
title: "Main menu"
description: "Shows new/continue weekend, Team Principal Campaign, Circuit Atelier, settings and quit beside an illustrated circuit preview."
kind: "page"
surface: "shipping"
source: "scripts/ui/main_menu.gd"
symbol: "MainMenuView"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "HBoxContainer"
---

# Main menu

Shows new/continue weekend, Team Principal Campaign, Circuit Atelier, settings and quit beside an illustrated circuit preview.

## Intent and purpose

Provide the starting point for a standalone weekend, an existing checkpoint, the Team Principal campaign and circuit authoring. The circuit showcase previews the experience while the left column exposes explicit destinations.

## User goals

Start or resume a race, return to a campaign, create a circuit, adjust presentation preferences, or quit with a clear understanding of checkpoint availability.

## Used components

[Track canvas](track-canvas.md) supplies the optional circuit preview. [Native UI helpers](ui.md) build buttons, panels and explanatory text; [Pitwall design](pitwall-design.md) applies text scale and initial focus. Native menu popups expose Advanced scenario/replay entries.

## Interactions

Navigation buttons emit action_requested for the shell to handle. Continue is disabled with a reason when no checkpoint exists. Advanced layout preference reveals Scenario challenges and Replays & experiments; their selections emit separate signals, including the replay invoker for focus restoration. Library warnings are informational.

## Links to other pages

Grand Prix Weekend opens [Grand Prix setup](grand-prix-setup.md); Continue follows the saved interface preference: [Minimal race layout](minimal-race-workspace.md) or its saved [completion page](weekend-end-view.md), or [Race Director / Engineering](race-director-workspace.md) with final results retained in the Advanced view. Resumed active campaign weekends use Minimal. Campaign opens the [Director Desk](campaign-director-desk.md), Track editor opens [Circuit Atelier](track-editor.md), and Settings opens [Settings](settings-view.md).

## Behavior and state

configure receives detached availability flags, warnings, preferences and optional geometry. Continue is disabled with an explanation when no checkpoint exists. Advanced preference exposes retained scenario and replay menus. Buttons emit intents; the shell owns loading, creation and navigation.

## Source and integration

Implementation: [scripts/ui/main_menu.gd](../../scripts/ui/main_menu.gd) (`MainMenuView`, extends `HBoxContainer`).

Referenced by [scripts/composition/main.gd](../../scripts/composition/main.gd).

## Interface

Primary presentation entry points:

- `configure(context: Dictionary, options: Dictionary, track: TrackGeometry) -> void`

Emitted intent signals:

- `action_requested(action: String)`
- `scenario_requested(index: int)`
- `replay_requested(index: int, invoker: Control)`

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
