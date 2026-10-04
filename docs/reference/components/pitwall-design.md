---
id: "pitwall-design"
title: "Pitwall design adapter"
description: "Provides race typography, spacing, surfaces, navigation styling, focus restoration and text scaling."
kind: "helper"
surface: "shared"
source: "scripts/ui/pitwall_design.gd"
symbol: "PitwallDesign"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "RefCounted"
---

# Pitwall design adapter

Provides race typography, spacing, surfaces, navigation styling, focus restoration and text scaling.

## Intent and purpose

Keep race layouts, text hierarchy and focus behavior consistent while adapting available space.

## User goals

Follow a task across the compact pitwall and a full workspace without losing focus or shrinking text to hide evidence.

## Used components

- [Game theme](game-theme.md)
- [Native control helpers](ui.md)

This helper supplies presentation behavior/resources to these consumers or depends on them; it is not an independently mounted page.

## Interactions

navigation marks an existing route button; scale_controls recursively scales native controls; linear_focus defines traversal and focus_later weakly restores a valid invoker. Factories create presentation controls only, with callbacks supplied by the host.

## Behavior and state

Use navigation and scale_controls for consistent native presentation, linear_focus for an explicit traversal order and focus_later for deferred restoration. Returned styles belong to presentation; styling or focus changes cannot alter sporting state.

## Source and integration

Implementation: [scripts/ui/pitwall_design.gd](../../../scripts/ui/pitwall_design.gd) (`PitwallDesign`, extends `RefCounted`).

Referenced by [scripts/composition/main.gd](../../../scripts/composition/main.gd), [scripts/composition/replay_controller.gd](../../../scripts/composition/replay_controller.gd), [scripts/composition/campaign_screens.gd](../../../scripts/composition/campaign_screens.gd), [scripts/ui/duel_workspace.gd](../../../scripts/ui/duel_workspace.gd), [scripts/ui/editor.gd](../../../scripts/ui/editor.gd), [scripts/ui/main_menu.gd](../../../scripts/ui/main_menu.gd), [scripts/ui/notebook_window.gd](../../../scripts/ui/notebook_window.gd), [scripts/ui/pitwall_car_card.gd](../../../scripts/ui/pitwall_car_card.gd). Additional consumers use the same adapter.

## Interface

Primary presentation entry points:

- `navigation(button: Button, selected: bool) -> void`
- `scale_controls(root: Node, factor: float) -> void`
- `linear_focus(controls: Array) -> void`
- `focus_later(control: Control) -> void`
- `race_panel(dark: bool = true, padding: int = 10) -> PanelContainer`
- `race_label(text: String, size: int = 12, accent: bool = false) -> Label`
- `race_button(text: String, callback: Callable, selected: bool = false) -> Button`
- `race_card_state(panel: PanelContainer, state: String) -> void`

This helper declares no custom intent signals. The host supplies callbacks or observes the native controls it constructs.

## Related documentation

- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)

## Links to other pages

- [Engineering pitwall layout](pitwall-workspace.md) — owning/consuming workflow.
- [Full analysis layout](race-analysis-workspace.md) — owning/consuming workflow.
- [Session review layout](race-results-workspace.md) — owning/consuming workflow.
- [Circuit Atelier](track-editor.md) — owning/consuming workflow.
