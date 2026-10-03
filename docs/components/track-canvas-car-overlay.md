---
id: "track-canvas-car-overlay"
title: "Canvas car layer"
description: "Provides a separate mouse-transparent drawing layer for detached car frames and start lights."
kind: "component"
surface: "shared"
source: "scripts/ui/track_canvas.gd"
symbol: "TrackCanvas.CarOverlay"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "class CarOverlay"
---

# Canvas car layer

Provides a separate mouse-transparent drawing layer for detached car frames and start lights.

## Intent and purpose

Redraw moving cars and lights independently from cached circuit illustration.

## User goals

Track the actual detached car motion smoothly while road/scenery landmarks stay fixed.

## Used components

- [Track canvas](track-canvas.md)
- [Canvas overlay adapter](track-canvas-overlay-renderer.md)
- [Canvas overlay painters](track-canvas-overlays.md)

## Interactions

This internal Control ignores pointer events and delegates _draw to host.draw_cars. TrackCanvas requests redraw as the visual frame changes; all selection/input remains with the canvas/host.

## Behavior and state

TrackCanvas creates this full-rect child once. Its _draw delegates to host.draw_cars; moving dots redraw independently from cached scenery. The layer has no simulation, selection or collision authority.

## Source and integration

Implementation: [scripts/ui/track_canvas.gd](../../scripts/ui/track_canvas.gd) (`class CarOverlay`).

## Interface

This entry is implemented inside `scripts/ui/track_canvas.gd` at `class CarOverlay`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Track canvas](track-canvas.md)
- [docs/track-editor.md](../../docs/track-editor.md)
- [Component catalog](README.md)

## Links to other pages

- [Minimal race layout](minimal-race-workspace.md) — related destination or host.
- [Engineering pitwall layout](pitwall-workspace.md) — related destination or host.
- [Replay and sandbox](replay-workspace.md) — related destination or host.
