---
id: "track-canvas-surface-overlay"
title: "Canvas surface layer"
description: "Provides the separate read-only road-surface overlay beneath the car layer."
kind: "component"
surface: "shared"
source: "scripts/ui/track_canvas_state.gd"
symbol: "TrackCanvasState.SurfaceOverlay"
status: "implemented"
source_pr: 28
source_commit: "dfb7cead8f01ea9b0b42a4b936b1d4c4e9bf21fa"
source_selector: "class SurfaceOverlay"
---

# Canvas surface layer

Provides the separate read-only road-surface overlay beneath the car layer.

## Intent and purpose

Display read-only surface evidence as a separately invalidated circuit layer.

## User goals

Inspect current water, grip or other selected channels while keeping cars visible above the surface layer.

## Used components

- [Track canvas](track-canvas.md)
- [Canvas overlay adapter](track-canvas-overlay-renderer.md)
- [Canvas overlay painters](track-canvas-overlays.md)
- [Surface laboratory](surface-lab.md)

## Interactions

The internal 0.3-second timer checks a presentation stamp and requests redraw only when relevant state changes. It ignores pointer events and delegates drawing to host.draw_surface. Layer visibility/channel/inspection come from the host rather than commands on the track model.

## Behavior and state

A 0.3-second presentation timer checks visibility, channel, inspected fraction, transform, geometry and observed total_time. Changed stamps request redraw; _draw delegates to host.draw_surface. The timer refreshes pixels rather than advancing a race.

## Source and integration

Implementation: [scripts/ui/track_canvas_state.gd](../../../scripts/ui/track_canvas_state.gd) (`class SurfaceOverlay`).

## Interface

This entry is implemented inside `scripts/ui/track_canvas_state.gd` at `class SurfaceOverlay`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Track canvas](track-canvas.md)
- [docs/how-to/track-editor.md](../../how-to/track-editor.md)
- [Component catalog](README.md)

## Links to other pages

- [Engineering pitwall layout](pitwall-workspace.md) — related destination or host.
- [Surface laboratory](surface-lab.md) — related destination or host.
- [Circuit Atelier](track-editor.md) — related destination or host.
