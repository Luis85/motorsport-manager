---
id: "weekend-entry-view"
title: "Weekend welcome and review"
description: "Shows a detached staged launch summary, circuit preview and explicit start/back actions before replacing the existing weekend."
kind: "page"
surface: "shipping"
source: "scripts/ui/weekend_entry.gd"
symbol: "WeekendEntryView"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Weekend welcome and review

Shows a detached staged launch summary, circuit preview and explicit start/back actions before replacing the existing weekend.

## Intent and purpose

Provide the welcome/review step between configuration and replacing a saved weekend. The player sees a detached circuit, metadata and a concise practice/qualifying/race outline before explicit start approval.

## User goals

Check the chosen circuit, car, weather and race length, read an authored scenario brief when present, return to configuration, or start practice with the reviewed launch revision.

## Used components

[Track canvas](track-canvas.md) previews detached geometry; native header, step panels and footer use [Minimal race style](minimal-race-style.md). [Native notification](native-notification.md) displays an optional scenario brief. Composition uses [native confirmation](native-confirmation.md) when replacing an existing weekend.

## Interactions

Back emits back_requested. Start practice emits start_requested(data.revision); the shell validates/persists the launch before mounting the race. Cancellation preserves the previous weekend. show_error keeps the player on the review page with retry feedback. Starting practice does not send either driver out.

## Links to other pages

[Grand Prix setup](grand-prix-setup.md) or [authored scenario controls](content-scenario-controls.md) opens this page; Back returns to setup. Successful entry reaches [Minimal race layout](minimal-race-workspace.md) through [Native application shell](native-shell.md).

## Behavior and state

configure receives the launch projection, geometry and scale. start_requested carries the observed launch revision; the shell rechecks replacement/commit and persistence. show_error keeps the staged welcome available on failure. Back/cancel preserve the previously active event.

## Source and integration

Implementation: [scripts/ui/weekend_entry.gd](../../scripts/ui/weekend_entry.gd) (`WeekendEntryView`, extends `VBoxContainer`).

Referenced by [scripts/composition/main.gd](../../scripts/composition/main.gd).

## Interface

Primary presentation entry points:

- `configure(value: Dictionary, geometry: TrackGeometry, scale: float = 1.0) -> void`
- `show_error(message: String) -> void`

Emitted intent signals:

- `start_requested(revision: int)`
- `back_requested`

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
