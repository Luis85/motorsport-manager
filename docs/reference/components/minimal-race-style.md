---
id: "minimal-race-style"
title: "Minimal style adapter"
description: "Adapts GameTheme into scalable Minimal race, welcome, completion and campaign controls."
kind: "helper"
surface: "shared"
source: "scripts/ui/race_weekend/minimal/style.gd"
symbol: "MinimalRaceStyle"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "RefCounted"
---

# Minimal style adapter

Adapts GameTheme into scalable Minimal race, welcome, completion and campaign controls.

## Intent and purpose

Apply the shared chrome and selected text scale to Minimal and its adjacent shipping screens.

## User goals

Read the weekend, review and campaign interfaces consistently and recognize the primary next action.

## Used components

- [Game theme](game-theme.md)

This helper supplies presentation behavior/resources to these consumers or depends on them; it is not an independently mounted page.

## Interactions

theme delegates to GameTheme; label rounds the scaled font size and button builds a 36×scale minimum-height native action with the caller's callback. surface and primary delegate shared styles. This helper owns neither playback nor scene navigation.

## Behavior and state

theme, label, button and surface use the selected text scale and shared chrome tokens. primary marks the main action. This adapter does not control simulation state or alter CircuitPalette's illustrated map ink.

## Source and integration

Implementation: [scripts/ui/race_weekend/minimal/style.gd](../../../scripts/ui/race_weekend/minimal/style.gd) (`MinimalRaceStyle`, extends `RefCounted`).

Referenced by [scripts/ui/weekend_end.gd](../../../scripts/ui/weekend_end.gd), [scripts/ui/weekend_entry.gd](../../../scripts/ui/weekend_entry.gd), [scripts/ui/campaign/director_desk.gd](../../../scripts/ui/campaign/director_desk.gd), [scripts/ui/race_weekend/minimal/driver_card.gd](../../../scripts/ui/race_weekend/minimal/driver_card.gd), [scripts/ui/race_weekend/minimal/gauge.gd](../../../scripts/ui/race_weekend/minimal/gauge.gd), [scripts/ui/race_weekend/minimal/strategy_comparison.gd](../../../scripts/ui/race_weekend/minimal/strategy_comparison.gd), [scripts/ui/race_weekend/minimal/workspace.gd](../../../scripts/ui/race_weekend/minimal/workspace.gd), [scripts/ui/race_weekend/minimal/timing_presenter.gd](../../../scripts/ui/race_weekend/minimal/timing_presenter.gd).

## Interface

Primary presentation entry points:

- `surface(color: Color = PANEL, border: Color = LINE, padding: int = 12) -> StyleBoxFlat`
- `theme(scale: float) -> Theme`
- `label(text: String, size: int, scale: float, muted: bool = false) -> Label`
- `button(text: String, callback: Callable, scale: float, toggle: bool = false) -> Button`
- `primary(button: Button, scale: float) -> void`

This helper declares no custom intent signals. The host supplies callbacks or observes the native controls it constructs.

## Related documentation

- [Circuit palette](circuit-palette.md)
- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)

## Links to other pages

- [Minimal race layout](minimal-race-workspace.md) — owning/consuming workflow.
- [Weekend welcome and review](weekend-entry-view.md) — owning/consuming workflow.
- [Weekend completion](weekend-end-view.md) — owning/consuming workflow.
- [Campaign Director Desk](campaign-director-desk.md) — owning/consuming workflow.
