---
id: "track-canvas"
title: "Track canvas"
description: "Renders a fitted illustrated circuit, detached car frames, surface/profile overlays and optional editor selection/gestures."
kind: "component"
surface: "shared"
source: "scripts/ui/track_canvas.gd"
symbol: "TrackCanvas"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "Control"
---

# Track canvas

Renders a fitted illustrated circuit, detached car frames, surface/profile overlays and optional editor selection/gestures.

## Intent and purpose

Provide one native circuit projection for race observation, library previews and transactional track authoring.

## User goals

Locate cars/track landmarks, zoom/pan/fit the circuit, inspect surface evidence or stage editor geometry changes.

## Used components

- [Circuit world illustration](circuit-world.md)
- [Circuit palette](circuit-palette.md)
- [Canvas car layer](track-canvas-car-overlay.md)
- [Canvas surface layer](track-canvas-surface-overlay.md)
- [Canvas pointer input](track-canvas-input.md)
- [Canvas gesture draft](track-canvas-gesture.md)
- [Canvas overlay adapter](track-canvas-overlay-renderer.md)
- [Canvas overlay painters](track-canvas-overlays.md)

## Interactions

Wheel input zooms, middle drag pans and F fits. Race observation emits car_selected; the host decides whether that car may become the action target. Editor gestures work on a displayed draft and emit gesture_committed(observed_revision); replacement/undo invalidate stale targets. Surface/profile/selection painting remains separate from car/scenery layers.

## Behavior and state

set_track accepts geometry and a displayed document; configure_presentation applies scenery/dot preferences. Wheel zoom, middle pan and F fit are presentation actions. RaceVisualPort and TrackPreviewHandle expose copied observations; editor gestures carry observed revisions and emit intent rather than committing canonical documents or advancing a runner.

## Source and integration

Implementation: [scripts/ui/track_canvas.gd](../../scripts/ui/track_canvas.gd) (`TrackCanvas`, extends `Control`).

Referenced by [scripts/composition/main.gd](../../scripts/composition/main.gd), [scripts/ui/battle_overlay.gd](../../scripts/ui/battle_overlay.gd), [scripts/ui/editor.gd](../../scripts/ui/editor.gd), [scripts/ui/main_menu.gd](../../scripts/ui/main_menu.gd), [scripts/ui/rejoin_overlay.gd](../../scripts/ui/rejoin_overlay.gd), [scripts/ui/replay_workspace.gd](../../scripts/ui/replay_workspace.gd), [scripts/ui/surface_lab.gd](../../scripts/ui/surface_lab.gd), [scripts/ui/track_canvas_gesture.gd](../../scripts/ui/track_canvas_gesture.gd). Additional consumers use the same adapter.

## Interface

Primary entry points (apply presentation preferences and the initial track before mounting when available):

- `configure_presentation(preferences: Dictionary) -> void`
- `set_track(g: TrackGeometry, live_document: Dictionary = {}) -> void`
- `fit() -> void`
- `world(p: Vector2) -> Vector2`
- `screen(p: Vector2) -> Vector2`
- `build_surface_geometry() -> void`
- `draw_surface(target: Control) -> void`
- `draw_cars(target: Control) -> void`

Emitted intent signals:

- `sketch_changed`
- `navigated`
- `edit_cancelled`
- `edit_started`
- `edited`
- `gesture_committed(observed_revision: int)`
- `selection_changed`
- `car_selected(id: int)`
- `measured(metres: float)`

## Related documentation

- [docs/track-editor.md](../../docs/track-editor.md)
- [Component catalog](README.md)

## Links to other pages

- [Circuit Atelier](track-editor.md) — related destination or host.
- [Grand Prix setup](grand-prix-setup.md) — related destination or host.
- [Weekend welcome and review](weekend-entry-view.md) — related destination or host.
- [Minimal race layout](minimal-race-workspace.md) — related destination or host.
- [Engineering pitwall layout](pitwall-workspace.md) — related destination or host.
- [Replay and sandbox](replay-workspace.md) — related destination or host.
