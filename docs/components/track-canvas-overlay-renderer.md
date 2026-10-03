---
id: "track-canvas-overlay-renderer"
title: "Canvas overlay adapter"
description: "Adapts TrackCanvas cache and detached presentation fields to the pure overlay painters."
kind: "helper"
surface: "shared"
source: "scripts/ui/track_canvas_overlay_renderer.gd"
symbol: "TrackCanvasOverlayRenderer"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "RefCounted"
---

# Canvas overlay adapter

Adapts TrackCanvas cache and detached presentation fields to the pure overlay painters.

## Intent and purpose

Keep host cache/state adaptation separate from pure read-only drawing calculations.

## User goals

See current cars, surface observations and profile information without display refresh altering the model.

## Used components

- [Track canvas](track-canvas.md)
- [Canvas overlay painters](track-canvas-overlays.md)

This helper supplies presentation behavior/resources to these consumers or depends on them; it is not an independently mounted page.

## Interactions

build_surface_geometry checks the host geometry identity and rebuilds sampled segments only when needed. The draw methods forward current host values to painters; they do not handle input, author a new observation or commit a draft.

## Behavior and state

build_surface_geometry reuses the host geometry cache; draw_surface, draw_profile and draw_cars delegate to TrackCanvasOverlays. The adapter owns no independent state, scheduler or mutation boundary.

## Source and integration

Implementation: [scripts/ui/track_canvas_overlay_renderer.gd](../../scripts/ui/track_canvas_overlay_renderer.gd) (`TrackCanvasOverlayRenderer`, extends `RefCounted`).

Referenced by [scripts/ui/track_canvas.gd](../../scripts/ui/track_canvas.gd).

## Interface

Primary presentation entry points:

- `build_surface_geometry(host: TrackCanvas) -> void`
- `draw_surface(host: TrackCanvas, target: Control) -> void`
- `draw_profile(host: TrackCanvas) -> void`
- `draw_cars(host: TrackCanvas, target: Control) -> void`

This helper declares no custom intent signals. The host supplies callbacks or observes the native controls it constructs.

## Related documentation

- [Canvas overlay painters](track-canvas-overlays.md)
- [docs/track-editor.md](../../docs/track-editor.md)
- [Component catalog](README.md)

## Links to other pages

- [Circuit Atelier](track-editor.md) — owning/consuming workflow.
- [Engineering pitwall layout](pitwall-workspace.md) — owning/consuming workflow.
- [Minimal race layout](minimal-race-workspace.md) — owning/consuming workflow.
