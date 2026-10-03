---
id: "track-editor"
title: "Circuit Atelier"
description: "Composes circuit authoring, canvas gestures, toolbar, inspector, validation, undo/redo, import/export and test-weekend intent."
kind: "page"
surface: "shipping"
source: "scripts/ui/editor.gd"
symbol: "TrackEditor"
status: "implemented"
source_pr: 28
source_commit: "dfb7cead8f01ea9b0b42a4b936b1d4c4e9bf21fa"
extends: "TrackEditorAuthoring"
---

# Circuit Atelier

Composes circuit authoring, canvas gestures, toolbar, inspector, validation, undo/redo, import/export and test-weekend intent.

## Intent and purpose

Circuit Atelier is the standalone authoring page for shaping, validating and handing off a circuit. It keeps the editable displayed draft separate from a running weekend and lets the player save work before testing a detached circuit snapshot.

## User goals

- Create or refine a road, pit route, scenery and reference image.
- Inspect readiness, recover a prior edit with Undo/Redo and save or exchange circuit files.
- Preview a reference lap or explicitly launch a test weekend, then resume authoring.

## Used components

[Editor toolbar](track-editor-toolbar.md), [editor inspector](track-editor-inspector.md), [TrackCanvas](track-canvas.md), [ContextGuide](context-guide.md), and shared [confirmation](native-confirmation.md), [file dialog](native-file-dialog.md) and [notification](native-notification.md) controls. `TrackEditorSession` owns revisions/history/compilation; `TrackEditorPort` supplies library and file operations.

## Interactions

`configure(document, port, presentation)` installs copied preferences and a new session before mounting. Canvas `edit_started`, `edit_cancelled`, `edited` and `gesture_committed` connect to checkpoint/cancel/recompile. `perform` begins a transaction; `recompile` commits against the displayed `document_revision` (or an explicit gesture revision), reloads canonical data on rejection, synchronizes history and invalidates old sketch previews. Toolbar and keyboard actions share editor methods; typing in LineEdit/TextEdit suppresses editor shortcuts. Save retains work on failure. Dirty replacement uses discard confirmation. Test emits `test_requested(document.duplicate(true))` only after `race_errors()` passes; an unapplied trace blocks testing and runtime export. The application advances the reference preview through its handle.

## Links to other pages

- [Main menu](main-menu-view.md) — Entry into Circuit Atelier.
- [Editor Point page](editor-point-page.md) — Shape and selection controls.
- [Editor Track page](editor-track-page.md) — Circuit and pit configuration.
- [Editor Features page](editor-features-page.md) — Road features and scenery.
- [Editor Reference page](editor-reference-page.md) — Image calibration.
- [Editor Checks page](editor-checks-page.md) — Readiness findings.
- [Editor World page](editor-world-page.md) — Illustration and layer controls.
- [Editor Draw page](editor-sketch-page.md) — Trace and confirmed road replacement.
- [Weekend entry](weekend-entry-view.md) — Separate staged weekend launch.

## Source and integration

Implementation: [scripts/ui/editor.gd](../../scripts/ui/editor.gd) (`TrackEditor`, extends `TrackEditorAuthoring`).

Referenced by [scripts/composition/main.gd](../../scripts/composition/main.gd), [scripts/composition/standalone_smoke.gd](../../scripts/composition/standalone_smoke.gd).

## Interface

Primary presentation entry points:

- `configure(d: Dictionary, port: TrackEditorPort = null, presentation: Dictionary = {}) -> void`
- `setup_guide() -> void`
- `fit_canvas() -> void`
- `checkpoint() -> void`
- `sync_history() -> void`
- `perform(action: Callable, rebuild_inspector: bool = false) -> void`
- `recompile(observed_revision: int = -1) -> void`
- `undo() -> void`

Emitted intent signals:

- `test_requested(document: Dictionary)`

## Related documentation

- [docs/track-editor.md](../../docs/track-editor.md)
- [Component catalog](README.md)
