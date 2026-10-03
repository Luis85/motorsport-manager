---
id: "track-canvas-overlays"
title: "Canvas overlay painters"
description: "Calculates sampled surface geometry and paints road-surface, profile, cars and editor selection from supplied values."
kind: "helper"
surface: "shared"
source: "scripts/ui/track_canvas_overlays.gd"
symbol: "TrackCanvasOverlays"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "RefCounted"
---

# Canvas overlay painters

Calculates sampled surface geometry and paints road-surface, profile, cars and editor selection from supplied values.

## Intent and purpose

Render supplied observation values and selection geometry without retaining live race entities or editor authority.

## User goals

Understand car position, start lights, surface distribution, elevation/banking and the editor's current selection.

## Used components

- [Circuit palette](circuit-palette.md)
- [Track canvas](track-canvas.md)
- [Canvas overlay adapter](track-canvas-overlay-renderer.md)

This helper supplies presentation behavior/resources to these consumers or depends on them; it is not an independently mounted page.

## Interactions

Painting methods draw into their supplied target. Surface segmentation derives from geometry, car projection uses detached frames, and selection uses the displayed document/IDs. This helper has no action controls; its caller handles visibility, invalidation and user input.

## Behavior and state

surface_geometry returns sampled segments; paint methods receive a draw target plus geometry/read-only frame/document data. TrackCanvas owns cache invalidation and layer lifetime. Painters must not commit editor mutations, retain live entrants or advance race time.

## Source and integration

Implementation: [scripts/ui/track_canvas_overlays.gd](../../scripts/ui/track_canvas_overlays.gd) (`TrackCanvasOverlays`, extends `RefCounted`).

Referenced by [scripts/ui/track_canvas.gd](../../scripts/ui/track_canvas.gd), [scripts/ui/track_canvas_overlay_renderer.gd](../../scripts/ui/track_canvas_overlay_renderer.gd).

## Interface

Primary presentation entry points:

- `surface_geometry(geometry: TrackGeometry) -> Array`
- `paint_surface(target: Control, segments: Array, values: Array, surface_channel: String, inspected_fraction: float, geometry: TrackGeometry, zoom: float, legend_style: StyleBox, screen: Callable) -> void`
- `paint_profile(target: Control, geometry: TrackGeometry, size: Vector2) -> void`
- `paint_cars(target: Control, geometry: TrackGeometry, show_preview: bool, preview_distance: float, visual_frame: Dictionary, zoom: float, dot_scale: float, show_labels: bool, size: Vector2, label_style: StyleBox, screen: Callable) -> void`
- `paint_selection(target: Control, document: Dictionary, selection_kind: String, selection_ids: Array[int], marquee_start: Vector2, marquee_end: Vector2, screen: Callable) -> void`

This helper declares no custom intent signals. The host supplies callbacks or observes the native controls it constructs.

## Related documentation

- [Track canvas](track-canvas.md)
- [docs/track-editor.md](../../docs/track-editor.md)
- [Component catalog](README.md)

## Links to other pages

- [Circuit Atelier](track-editor.md) — owning/consuming workflow.
- [Engineering pitwall layout](pitwall-workspace.md) — owning/consuming workflow.
- [Minimal race layout](minimal-race-workspace.md) — owning/consuming workflow.
