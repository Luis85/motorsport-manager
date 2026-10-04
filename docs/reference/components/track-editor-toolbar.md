---
id: "track-editor-toolbar"
title: "Editor toolbar builder"
description: "Builds Circuit Atelier's title, tool selectors and document/history/test actions."
kind: "helper"
surface: "shipping"
source: "scripts/ui/editor_toolbar.gd"
symbol: "TrackEditorToolbar"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "RefCounted"
---

# Editor toolbar builder

Builds Circuit Atelier's title, tool selectors and document/history/test actions.

## Intent and purpose

Build the authoring page’s persistent document actions, tool selector and selection context bar. This helper gives the player clear entry points while the editor/session retain document and history ownership.

## User goals

- Load, create, save, import or export a circuit.
- Choose a drawing/editing tool, undo/redo and inspect a reference lap.
- Explicitly test the committed road or arrange selected scenery.

## Used components

Native HFlowContainer rows, OptionButton library/tool selectors, Buttons, CheckButtons and status Labels built through [UI](ui.md). [ContextGuide](context-guide.md) is opened through the host. [TrackCanvas](track-canvas.md) provides fit/preview and presentation toggles.

## Interactions

`build(editor: Control)` assigns the host’s dirty label, tool/history/test controls and context bar. Loading a library circuit calls `confirm_discard` before `replace_document`; New uses the same host discard path. Save/import/export/bake call host methods. Test checks `race_errors`, emits a detached document or shows a notification. Fit, reference preview, racing-line and elevation toggles affect the canvas. Duplicate/group/ungroup/align/delete dispatch to `selection_action`; the context row is visible for multi-selection. The helper has no `configure` method or custom signals.

## Links to other pages

- [Circuit Atelier](track-editor.md) — Owner and transaction boundary.
- [Editor inspector builder](track-editor-inspector.md) — Corresponding authoring fields.
- [Editor Draw page](editor-sketch-page.md) — Persistent preview/replace actions are supplied by the editor side rail.

## Source and integration

Implementation: [scripts/ui/editor_toolbar.gd](../../../scripts/ui/editor_toolbar.gd) (`TrackEditorToolbar`, extends `RefCounted`).

Referenced by [scripts/ui/editor.gd](../../../scripts/ui/editor.gd).

## Interface

Primary entry points:

- `build(editor: Control) -> void`

No custom intent signals are declared by this script. Inherited signals and native Control events remain available.

## Related documentation

- [docs/how-to/track-editor.md](../../how-to/track-editor.md)
- [Component catalog](README.md)
