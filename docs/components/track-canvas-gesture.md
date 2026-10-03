---
id: "track-canvas-gesture"
title: "Canvas gesture draft"
description: "Freezes pointer-drag targets, layer ownership and observed document revision while editing a temporary canvas draft."
kind: "helper"
surface: "shipping"
source: "scripts/ui/track_canvas_gesture.gd"
symbol: "TrackCanvasGesture"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "RefCounted"
---

# Canvas gesture draft

Freezes pointer-drag targets, layer ownership and observed document revision while editing a temporary canvas draft.

## Intent and purpose

Keep drag edits temporary and tied to the document revision and targets observed at pointer-down. The helper allows responsive visual editing while the editor session remains the canonical mutation/history owner.

## User goals

Move road points/handles, pit points, scenery, references or a multi-selection predictably, with stale targets and locked layers prevented from committing unintended edits.

## Used components

[Track canvas](track-canvas.md) supplies the draft, coordinate transform, selection and signals; [canvas input](track-canvas-input.md) drives the gesture. Pure TrackEdit operations build changed draft values. [Circuit Atelier](track-editor.md) receives the observed revision through the canvas commit signal.

## Interactions

begin cancels prior gesture state and stops reference preview. move ignores tiny unchanged movement, supports Control snapping, checks draft identity/revision/selection/layer editability and emits edit_started once. commit emits gesture_committed with the original revision only after a change. cancel emits edit_cancelled when needed so the host restores its draft; the helper does not restore canonical data itself.

## Links to other pages

[Circuit Atelier](track-editor.md) owns the editor/session integration; [Track canvas](track-canvas.md) renders the gesture and [canvas input](track-canvas-input.md) translates pointer events. See the [Editor Point page](editor-point-page.md) for complementary coordinate editing.

## Behavior and state

begin captures gesture context; move updates only the preview draft. current rejects stale replacements/revisions and commit emits the observed revision for TrackEditorSession. cancel emits edit_cancelled after changes, allowing the host to restore the preview. It retains no canonical session, simulation or aggregate.

## Source and integration

Implementation: [scripts/ui/track_canvas_gesture.gd](../../scripts/ui/track_canvas_gesture.gd) (`TrackCanvasGesture`, extends `RefCounted`).

Referenced by [scripts/ui/track_canvas.gd](../../scripts/ui/track_canvas.gd), [scripts/ui/track_canvas_input.gd](../../scripts/ui/track_canvas_input.gd).

## Interface

Primary entry points:

- `begin(canvas: TrackCanvas, drag_kind: String, offset: Vector2) -> void`
- `targets(canvas: TrackCanvas) -> Array`
- `current(canvas: TrackCanvas) -> bool`
- `layer(canvas: TrackCanvas) -> String`
- `move(canvas: TrackCanvas, event: InputEventMouseMotion) -> void`
- `movement(canvas: TrackCanvas, p: Vector2, relative: Vector2) -> Dictionary`
- `commit(canvas: TrackCanvas) -> void`
- `cancel(canvas: TrackCanvas) -> void`

This RefCounted helper declares no custom signals. It updates or emits through the supplied host controls; it is not a native Control.

## Related documentation

- [docs/track-editor.md](../../docs/track-editor.md)
- [Component catalog](README.md)
