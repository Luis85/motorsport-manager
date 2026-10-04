---
id: "game-theme"
title: "Game theme"
description: "Defines shared native chrome tokens, scalable Theme resources, action styles and readable foreground ink."
kind: "helper"
surface: "shared"
source: "scripts/ui/game_theme.gd"
symbol: "GameTheme"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "RefCounted"
---

# Game theme

Defines shared native chrome tokens, scalable Theme resources, action styles and readable foreground ink.

## Intent and purpose

Give every native screen the same readable chrome, action sizing and scalable type system.

## User goals

Read labels at the selected text size and identify focused, selected, disabled and primary actions consistently across the app.

## Used components

- [Native control helpers](ui.md)
- [Minimal style adapter](minimal-race-style.md)
- [Director style adapter](director-style.md)
- [Pitwall design adapter](pitwall-design.md)

This helper supplies presentation behavior/resources to these consumers or depends on them; it is not an independently mounted page.

## Interactions

This helper creates Theme and StyleBox resources rather than a page. build applies the supplied scale/compact option; primary styles an existing button and ink_on chooses foreground contrast for a supplied fill. User actions are bound by the consuming view.

## Behavior and state

build accepts text scale and compact mode; surface and action return styles used by the UI adapters. primary styles the main action and ink_on chooses readable text for a supplied color. Use the existing adapters instead of introducing screen-local chrome palettes.

## Source and integration

Implementation: [scripts/ui/game_theme.gd](../../../scripts/ui/game_theme.gd) (`GameTheme`, extends `RefCounted`).

Referenced by [scripts/ui/main_menu.gd](../../../scripts/ui/main_menu.gd), [scripts/ui/pitwall_design.gd](../../../scripts/ui/pitwall_design.gd), [scripts/ui/settings_view.gd](../../../scripts/ui/settings_view.gd), [scripts/ui/ui.gd](../../../scripts/ui/ui.gd), [scripts/ui/weekend.gd](../../../scripts/ui/weekend.gd), [scripts/ui/weekend_support.gd](../../../scripts/ui/weekend_support.gd), [scripts/ui/race_weekend/director_style.gd](../../../scripts/ui/race_weekend/director_style.gd), [scripts/ui/race_weekend/status_badge.gd](../../../scripts/ui/race_weekend/status_badge.gd). Additional consumers use the same adapter.

## Interface

Primary presentation entry points:

- `build(scale: float = 1.0, compact: bool = false) -> Theme`
- `surface(color: Color = PANEL, border: Color = LINE, radius: int = 6, padding: int = 12) -> StyleBoxFlat`
- `action(color: Color, border: Color = LINE, scale: float = 1.0) -> StyleBoxFlat`
- `primary(button: Button, scale: float = 1.0) -> void`
- `ink_on(color: Color) -> Color`

This helper declares no custom intent signals. The host supplies callbacks or observes the native controls it constructs.

## Related documentation

- [Native control helpers](ui.md)
- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)

## Links to other pages

- [Main menu](main-menu-view.md) — owning/consuming workflow.
- [Settings](settings-view.md) — owning/consuming workflow.
- [Circuit Atelier](track-editor.md) — owning/consuming workflow.
- [Minimal race layout](minimal-race-workspace.md) — owning/consuming workflow.
- [Race Director layout](race-director-workspace.md) — owning/consuming workflow.
