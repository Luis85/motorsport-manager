---
id: "native-shell"
title: "Native application shell"
description: "Hosts the global header and one content destination inside scenes/main.tscn."
kind: "layout"
surface: "shipping"
source: "scripts/composition/main.gd"
symbol: "NativeShell"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "_ready"
---

# Native application shell

Hosts the global header and one content destination inside scenes/main.tscn.

## Intent and purpose

Keep one native application destination active and connect presentation to application lifecycle, commands and persistence. This composition layer assembles screens and services rather than acting as a detached reusable widget.

## User goals

Move coherently among configuration, authoring, settings, race and review while keeping saved continuations and unsaved work understandable.

## Used components

[Global header](global-header.md) and a content VBoxContainer host [Main menu](main-menu-view.md), [Grand Prix setup](grand-prix-setup.md), [welcome](weekend-entry-view.md), [Circuit Atelier](track-editor.md), [Settings](settings-view.md), [race layouts](minimal-race-workspace.md) and [completion](weekend-end-view.md). [Campaign screen composition](campaign-screens.md) and [Replay controller](replay-controller.md) handle dedicated routes.

## Interactions

The shell connects emitted view intents, creates application view/session bindings and activates the application runner. Home/quit protect dirty settings/editor work and save weekend state; failure can retain the current screen. Escape routes supported non-race destinations home or welcome back to setup. clear_screen disposes content and hides the global header for the weekend.

## Links to other pages

Begin at [Main menu](main-menu-view.md); the Minimal standalone route runs through [Grand Prix setup](grand-prix-setup.md), [welcome](weekend-entry-view.md), [Minimal race layout](minimal-race-workspace.md) and [completion](weekend-end-view.md). Advanced setup commits directly into its briefing and mounts [Race Director / Engineering](race-director-workspace.md). Campaign routing is documented in [Campaign screen composition](campaign-screens.md).

## Behavior and state

The shell mounts menu, setup, welcome, editor, settings, weekend and completion views. It injects services, connects navigation, binds the application runner and protects save/discard boundaries. PR 28 extracts campaign orchestration into CampaignScreens; this is composition code with App access, not a reusable detached widget.

## Source and integration

Implementation: [scripts/composition/main.gd](../../../scripts/composition/main.gd) (`_ready`).

## Interface

This entry is implemented inside `scripts/composition/main.gd` at `_ready`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Native application shell](native-shell.md)
- [Campaign screen composition](campaign-screens.md)
- [docs/_archive/ui/race-weekend/layout-system.md](../../_archive/ui/race-weekend/layout-system.md)
- [Component catalog](README.md)
