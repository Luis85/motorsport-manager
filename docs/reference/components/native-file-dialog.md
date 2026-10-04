---
id: "native-file-dialog"
title: "Native file dialog"
description: "Provides shared scaled open/save selection with host-supplied filters and a callback."
kind: "component"
surface: "shared"
source: "scripts/ui/ui.gd"
symbol: "NativeFileDialog"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "file_dialog"
---

# Native file dialog

Provides shared scaled open/save selection with host-supplied filters and a callback.

## Intent and purpose

Let a caller select an import/export path through a shared scaled native dialog.

## User goals

Choose a file or save destination with the relevant filters, or cancel without changing the current draft.

## Used components

- [Native control helpers](ui.md)
- [Pitwall design adapter](pitwall-design.md)

## Interactions

file_dialog selects open/save mode, filesystem access and supplied filters, then sizes the window to available space. File selection dismisses, restores the invoker and calls callback(path). Cancel restores focus without the callback; actual reading/writing and failure feedback belong to the caller's port/service.

## Behavior and state

UI.file_dialog prepares the native dialog and routes file_selected to the caller. Selection itself does not grant a widget direct disk authority; the caller uses its injected port for import/export. Cancel closes without running the file callback.

## Source and integration

Implementation: [scripts/ui/ui.gd](../../../scripts/ui/ui.gd) (`file_dialog`).

## Interface

This entry is implemented inside `scripts/ui/ui.gd` at `file_dialog`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Native control helpers](ui.md)
- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)

## Links to other pages

- [Circuit Atelier](track-editor.md) — related destination or host.
- [Circuit notebook](notebook-window.md) — related destination or host.
- [Replay and sandbox](replay-workspace.md) — related destination or host.
- [Scenario author dialog](scenario-author.md) — related destination or host.
