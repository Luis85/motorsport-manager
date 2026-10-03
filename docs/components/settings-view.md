---
id: "settings-view"
title: "Settings"
description: "Stages display, circuit, text scale and Minimal/Advanced race-interface preferences before Apply."
kind: "page"
surface: "shipping"
source: "scripts/ui/settings_view.gd"
symbol: "SettingsView"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Settings

Stages display, circuit, text scale and Minimal/Advanced race-interface preferences before Apply.

## Intent and purpose

Let players preview and deliberately save presentation preferences, with a visible distinction between the staged draft and saved settings. Preference changes select future screen composition rather than recreating a weekend.

## User goals

Choose readable text size, Minimal or Advanced race presentation and Advanced starting view; adjust window/circuit display and default speed; locate local data; leave or retry saving without losing an unsaved draft.

## Used components

[Native UI helpers](ui.md) build responsive display/circuit/data sections and controls. [Pitwall design](pitwall-design.md) scales the preview; [native confirmation](native-confirmation.md) protects unsaved changes and [native notification](native-notification.md) reports folder-opening errors.

## Interactions

Editing updates a copied draft and unsaved status. Apply emits a copied draft to the shell; save_result marks success or retains changes after failure. Back and header navigation confirm discarding changed settings. Advanced start/racing-line controls are disabled in Minimal. Copy data path uses the clipboard; Open data folder asks the OS to open the supplied location.

## Links to other pages

[Main menu](main-menu-view.md) opens and receives Back from Settings. [Native application shell](native-shell.md) saves/applies preferences. The next race opening selects [Minimal race layout](minimal-race-workspace.md), [Race Director layout](race-director-workspace.md) or [Engineering pitwall](pitwall-workspace.md).

## Behavior and state

configure copies settings and displays the local data path. save_requested emits the draft; the shell persists it and save_result renders errors. Back/discard retains cancellation semantics. Advanced remembers Director/Engineering, and changes affect the next weekend composition rather than hot-swapping a focused live command.

## Source and integration

Implementation: [scripts/ui/settings_view.gd](../../scripts/ui/settings_view.gd) (`SettingsView`, extends `VBoxContainer`).

Referenced by [scripts/composition/main.gd](../../scripts/composition/main.gd).

## Interface

Primary presentation entry points:

- `configure(value: Dictionary, path: String) -> void`
- `has_changes() -> bool`
- `save_result(error: String) -> void`
- `confirm_discard(callback: Callable) -> void`

Emitted intent signals:

- `save_requested(draft: Dictionary)`
- `back_requested`

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
