---
id: "ui"
title: "Native control helpers"
description: "Constructs shared labels, paragraphs, fields, buttons, panels, selectors, native notifications, confirmations and file dialogs."
kind: "helper"
surface: "shared"
source: "scripts/ui/ui.gd"
symbol: "UI"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "RefCounted"
---

# Native control helpers

Constructs shared labels, paragraphs, fields, buttons, panels, selectors, native notifications, confirmations and file dialogs.

## Intent and purpose

Provide shared native control and dialog construction so screens retain consistent styling, focus and cancellation.

## User goals

Read fields, make explicit choices, understand errors and cancel a destructive action without losing a draft.

## Used components

- [Game theme](game-theme.md)
- [Pitwall design adapter](pitwall-design.md)
- [Native notification dialog](native-notification.md)
- [Native confirmation dialog](native-confirmation.md)
- [Native file dialog](native-file-dialog.md)

This helper supplies presentation behavior/resources to these consumers or depends on them; it is not an independently mounted page.

## Interactions

Factories bind caller-supplied callbacks to native controls. confirm avoids stacking visible confirmations and focuses Cancel; its cancel path restores the invoker, while Confirm delegates focus behavior to the callback. notify restores focus on close. file_dialog restores focus on selection/cancel and invokes the file callback only after selection.

## Behavior and state

Factories use GameTheme and compatibility PitwallDesign delegates. prepare_dialog applies native scaling; confirm starts focus on Cancel and restores the invoker after closing. File callbacks are supplied by the host, keeping filesystem operations behind application/infrastructure ports. Shared immutable styles must not be modified by consumers.

## Source and integration

Implementation: [scripts/ui/ui.gd](../../scripts/ui/ui.gd) (`UI`, extends `RefCounted`).

Referenced by [scripts/composition/content_scenario_controls.gd](../../scripts/composition/content_scenario_controls.gd), [scripts/composition/main.gd](../../scripts/composition/main.gd), [scripts/composition/replay_controller.gd](../../scripts/composition/replay_controller.gd), [scripts/composition/scenario_screens.gd](../../scripts/composition/scenario_screens.gd), [scripts/composition/campaign_screens.gd](../../scripts/composition/campaign_screens.gd), [scripts/ui/battle_overlay.gd](../../scripts/ui/battle_overlay.gd), [scripts/ui/context_guide.gd](../../scripts/ui/context_guide.gd), [scripts/ui/editor.gd](../../scripts/ui/editor.gd). Additional consumers use the same adapter.

## Interface

Primary presentation entry points:

- `set_active(button: Button, active: bool, danger: bool = false) -> void`
- `race_panel(dark: bool = true, padding: int = 10) -> PanelContainer`
- `race_label(text: String, size: int = 12, accent: bool = false) -> Label`
- `race_button(text: String, callback: Callable, selected: bool = false) -> Button`
- `race_card_state(panel: PanelContainer, state: String) -> void`
- `resource_state(bar: ProgressBar, value: Label, risk: bool) -> void`
- `action_box(color: Color, border: Color = LINE) -> StyleBoxFlat`
- `box(color: Color, border: Color = LINE, radius: int = 6, padding: int = 12) -> StyleBoxFlat`

This helper declares no custom intent signals. The host supplies callbacks or observes the native controls it constructs.

## Related documentation

- [Game theme](game-theme.md)
- [Pitwall design adapter](pitwall-design.md)
- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)

## Links to other pages

- [Settings](settings-view.md) — owning/consuming workflow.
- [Circuit Atelier](track-editor.md) — owning/consuming workflow.
- [Circuit notebook](notebook-window.md) — owning/consuming workflow.
- [Engineering pitwall layout](pitwall-workspace.md) — owning/consuming workflow.
