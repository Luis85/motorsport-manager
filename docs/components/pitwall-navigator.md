---
id: "pitwall-navigator"
title: "Find workspace dialog"
description: "Offers a searchable, read-only destination picker for Advanced topics and subtasks."
kind: "component"
surface: "advanced"
source: "scripts/ui/pitwall_navigator.gd"
symbol: "PitwallNavigator"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "ConfirmationDialog"
---

# Find workspace dialog

Offers a searchable, read-only destination picker for Advanced topics and subtasks.

## Intent and purpose

Offers a searchable, read-only destination picker for Advanced topics and subtasks.

## User goals

Find a specialist task by terms such as fuel, wheels or pit box without memorizing the Advanced topic hierarchy.

## Used components

A native `ConfirmationDialog` containing a search `LineEdit`, result `ItemList`, description/caption `Label`s and open/close/clear `Button`s, with [native control helpers](ui.md) and [pitwall design](pitwall-design.md) for styling/focus.

## Interactions

Search filters destination rows and updates a description/count. Enter or Open emits the selected topic/subtopic; Escape or close restores the invoker’s focus. Weather and recovery entries depend on configured availability. Opening a destination delegates navigation, never applies a race order.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Engineering pitwall layout](pitwall-workspace.md)
- [Strategy desk](strategy-desk.md)
- [Team orders panel](team-orders-panel.md)
- [Weather panel](weather-panel.md)
- [Recovery panel](recovery-panel.md)

## Behavior and state

configure supplies weather/recovery availability and text scale. show_picker remembers the invoking control; choosing a row emits destination_requested(topic, subtopic). Filtering, reading descriptions and closing the picker cannot execute race commands; close restores focus.

## Source and integration

Implementation: [scripts/ui/pitwall_navigator.gd](../../scripts/ui/pitwall_navigator.gd) (`PitwallNavigator`, extends `ConfirmationDialog`).

Referenced by [scripts/ui/pitwall_workspace.gd](../../scripts/ui/pitwall_workspace.gd).

## Interface

Public presentation entry points:

- `configure(has_weather: bool, scale_factor: float, has_recovery: bool = false) -> void`
- `show_picker(focus: Control) -> void`
- `filter_views(query: String) -> void`
- `search_key(event: InputEvent) -> void`
- `open_selected() -> void`
- `close_picker() -> void`
- `clear_search() -> void`
- `describe_selection() -> void`

Emitted intent signals:

- `destination_requested(topic: int, subtopic: int)`

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
