---
id: "director-style"
title: "Director style adapter"
description: "Builds Director panels, labels, paragraphs and primary/secondary buttons from the shared native design language."
kind: "helper"
surface: "advanced"
source: "scripts/ui/race_weekend/director_style.gd"
symbol: "DirectorStyle"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "RefCounted"
---

# Director style adapter

Builds Director panels, labels, paragraphs and primary/secondary buttons from the shared native design language.

## Intent and purpose

Express Director actions and calls using the shared theme with readable native focus/disabled states.

## User goals

Distinguish the main approval action from secondary navigation and keep text readable in the Director surface.

## Used components

- [Game theme](game-theme.md)
- [Native control helpers](ui.md)

This helper supplies presentation behavior/resources to these consumers or depends on them; it is not an independently mounted page.

## Interactions

panel, label, paragraph and button construct native controls. style_button supplies normal/hover/pressed/disabled/focus styles, cached by state and primary flag. The callback belongs to the caller; the style adapter never approves a call itself.

## Behavior and state

Use the static factories for RaceDirectorWorkspace, DirectorCarCard and RaceCallRoom. Cached styles remain presentation resources. Callback binding belongs to the host and does not grant the adapter command authority.

## Source and integration

Implementation: [scripts/ui/race_weekend/director_style.gd](../../../scripts/ui/race_weekend/director_style.gd) (`DirectorStyle`, extends `RefCounted`).

Referenced by [scripts/ui/race_director_workspace.gd](../../../scripts/ui/race_director_workspace.gd), [scripts/ui/race_weekend/call_room.gd](../../../scripts/ui/race_weekend/call_room.gd), [scripts/ui/race_weekend/director_car_card.gd](../../../scripts/ui/race_weekend/director_car_card.gd).

## Interface

Primary presentation entry points:

- `panel(padding: int = 12) -> PanelContainer`
- `label(text: String = "", points: int = 14, color: Color = TEXT) -> Label`
- `paragraph(text: String = "", color: Color = MUTED) -> Label`
- `button(text: String, callback: Callable, primary: bool = false) -> Button`
- `style_button(b: Button, primary: bool = false) -> void`

This helper declares no custom intent signals. The host supplies callbacks or observes the native controls it constructs.

## Related documentation

- [Race Director layout](race-director-workspace.md)
- [Director driver card](director-car-card.md)
- [Director call room](race-call-room.md)
- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)

## Links to other pages

- [Race Director layout](race-director-workspace.md) — owning/consuming workflow.
- [Director call room](race-call-room.md) — owning/consuming workflow.
- [Director driver card](director-car-card.md) — owning/consuming workflow.
