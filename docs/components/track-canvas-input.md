---
id: "track-canvas-input"
title: "Canvas pointer input"
description: "Interprets native mouse/button/motion input for TrackCanvas tools, selection and navigation."
kind: "helper"
surface: "shared"
source: "scripts/ui/track_canvas_input.gd"
symbol: "TrackCanvasInput"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "RefCounted"
---

# Canvas pointer input

Interprets native mouse/button/motion input for TrackCanvas tools, selection and navigation.

## Intent and purpose

Translate pointer intent into bounded canvas navigation, selection and temporary editor gestures.

## User goals

Select a point or object, drag the intended editable target and pan/zoom without changing canonical geometry accidentally.

## Used components

- [Track canvas](track-canvas.md)
- [Canvas gesture draft](track-canvas-gesture.md)

This helper supplies presentation behavior/resources to these consumers or depends on them; it is not an independently mounted page.

## Interactions

dispatch routes mouse buttons and motion by tool/editing state. Press and selection respect layer visibility/locks; TrackCanvasGesture captures the targets/revision. Camera changes emit navigation and stop automatic refitting until the player explicitly fits again.

## Behavior and state

dispatch routes to button/press_at/select_at/motion. View pan/zoom and editor temporary gestures remain canvas presentation state; TrackCanvasGesture freezes drag targets. Canonical edits and history remain in TrackEditorSession rather than the input helper.

## Source and integration

Implementation: [scripts/ui/track_canvas_input.gd](../../scripts/ui/track_canvas_input.gd) (`TrackCanvasInput`, extends `RefCounted`).

Referenced by [scripts/ui/track_canvas.gd](../../scripts/ui/track_canvas.gd).

## Interface

Primary presentation entry points:

- `dispatch(canvas: TrackCanvas, event: InputEvent) -> void`
- `button(canvas: TrackCanvas, event: InputEventMouseButton) -> void`
- `press_at(canvas: TrackCanvas, event: InputEventMouseButton) -> void`
- `select_at(canvas: TrackCanvas, event: InputEventMouseButton, p: Vector2) -> void`
- `motion(canvas: TrackCanvas, event: InputEventMouseMotion) -> void`

This helper declares no custom intent signals. The host supplies callbacks or observes the native controls it constructs.

## Related documentation

- [Canvas gesture draft](track-canvas-gesture.md)
- [docs/track-editor.md](../../docs/track-editor.md)
- [Component catalog](README.md)

## Links to other pages

- [Circuit Atelier](track-editor.md) — owning/consuming workflow.
- [Minimal race layout](minimal-race-workspace.md) — owning/consuming workflow.
- [Grand Prix setup](grand-prix-setup.md) — owning/consuming workflow.
