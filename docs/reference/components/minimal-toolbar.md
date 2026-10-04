---
id: "minimal-toolbar"
title: "Minimal session toolbar"
description: "Keeps Menu, session identity, clock, playback, speed, Strategy and explicit phase approval above observation."
kind: "component"
surface: "shipping"
source: "scripts/ui/race_weekend/minimal/workspace.gd"
symbol: "MinimalToolbar"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "build_toolbar"
---

# Minimal session toolbar

Keeps Menu, session identity, clock, playback, speed, Strategy and explicit phase approval above observation.

## Intent and purpose

Keep session identity, playback and explicit phase approval in one consistent top row. The toolbar distinguishes approving the next session from running time within the current one.

## User goals

Pause/play, choose speed, understand the session clock or lap/flag state, open an estimate, approve the next phase or leave through the menu.

## Used components

Native buttons, OptionButton and identity/clock labels use [Minimal race style](minimal-race-style.md). The owning [Minimal race layout](minimal-race-workspace.md) supplies MinimalRaceControls and opens [Strategy comparison](minimal-strategy-comparison.md).

## Interactions

Pause/Play and 1×–16× speed issue explicit playback intents. The primary button follows actual stage availability and is disabled during formation/lights and closed returning sessions. Strategy enables only for a running selected managed driver during race. Space/1–5 shortcuts are suppressed while engine, speed or Strategy popups are open. Menu emits navigation; the shell’s leave path pauses/saves.

## Links to other pages

The toolbar belongs to [Minimal race layout](minimal-race-workspace.md). Strategy opens [Strategy comparison](minimal-strategy-comparison.md), results approval opens [completion](weekend-end-view.md), and Menu leads to [Main menu](main-menu-view.md).

## Behavior and state

Pause/Play and speed use MinimalRaceControls; Space and 1–5 shortcuts are suppressed while engine, speed or Strategy popups are open. Strategy is available only for a running managed car in a live race. Phase actions follow real briefing/practice/qualifying/formation/lights/results states and never advance merely during refresh.

## Source and integration

Implementation: [scripts/ui/race_weekend/minimal/workspace.gd](../../../scripts/ui/race_weekend/minimal/workspace.gd) (`build_toolbar`).

## Interface

This entry is implemented inside `scripts/ui/race_weekend/minimal/workspace.gd` at `build_toolbar`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Minimal race layout](minimal-race-workspace.md)
- [docs/reference/race-weekend/minimal.md](../race-weekend/minimal.md)
- [Component catalog](README.md)
