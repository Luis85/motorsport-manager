---
id: "grand-prix-setup"
title: "Grand Prix setup"
description: "Combines a circuit library, TrackCanvas preview and catalog-backed weekend/car/weather/lap controls."
kind: "page"
surface: "shipping"
source: "scripts/composition/main.gd"
symbol: "GrandPrixSetup"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "show_library"
---

# Grand Prix setup

Combines a circuit library, TrackCanvas preview and catalog-backed weekend/car/weather/lap controls.

## Intent and purpose

Let the player select and validate a weekend configuration before entry. The library preview makes the chosen circuit concrete; catalog-backed selectors expose available authored content and custom options.

## User goals

Choose a circuit and vehicle, configure weather/race length and available presets, inspect an authored scenario, edit a circuit, or return without replacing the saved weekend.

## Used components

A native ItemList and [Track canvas](track-canvas.md) show the library/preview. [Content scenario controls](content-scenario-controls.md) offer authored scenario entry. [Native UI helpers](ui.md) build flowing setup fields; [native notification](native-notification.md) reports validation failures.

## Interactions

Circuit/car changes refresh the preview. Edit selected circuit opens authoring. Minimal exposes weather and race laps, then Review weekend stages WeekendLaunch and opens welcome. Advanced exposes additional weather mode, qualifying duration, incident intensity and seed fields; Open weekend briefing stages configuration and opens the Advanced race directly, with replacement confirmation when required. An empty library offers Create a circuit; a missing content catalog shows an unavailable explanation.

## Links to other pages

[Main menu](main-menu-view.md) opens setup. [Circuit Atelier](track-editor.md) can supply a test draft and receives circuit editing. Minimal Review weekend reaches [Weekend welcome](weekend-entry-view.md); Advanced briefing reaches [Race Director layout](race-director-workspace.md) or [Engineering pitwall](pitwall-workspace.md).

## Behavior and state

show_library stages a new WeekendLaunch. Missing content shows an unavailable explanation; an empty library adds an editor recovery route. Selection never starts a race. Authored scenario review is an alternate entry. Minimal Review weekend validates and stages configuration, then opens WeekendEntryView. Advanced Open weekend briefing instead opens the retained race view directly after staging and any required replacement confirmation.

## Source and integration

Implementation: [scripts/composition/main.gd](../../../scripts/composition/main.gd) (`show_library`).

## Interface

This entry is implemented inside `scripts/composition/main.gd` at `show_library`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Native application shell](native-shell.md)
- [Weekend welcome and review](weekend-entry-view.md)
- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
