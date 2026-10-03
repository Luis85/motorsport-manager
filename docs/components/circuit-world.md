---
id: "circuit-world"
title: "Circuit world illustration"
description: "Caches decorative world-space scenery, road batches, pits and authored features beneath TrackCanvas."
kind: "component"
surface: "shared"
source: "scripts/ui/circuit_world.gd"
symbol: "CircuitWorld"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "Node2D"
---

# Circuit world illustration

Caches decorative world-space scenery, road batches, pits and authored features beneath TrackCanvas.

## Intent and purpose

Make the circuit feel like an illustrated place while caching decoration separately from moving cars.

## User goals

Orient around a circuit using stable scenery and road/pit landmarks; switch scenery detail without changing the race.

## Used components

- [Circuit palette](circuit-palette.md)
- [Track canvas](track-canvas.md)

## Interactions

configure rebuilds decorative geometry when its supplied track/document changes. TrackCanvas controls transforms, reference texture and layer visibility. Panning does not reseed gameplay or move track nodes.

## Behavior and state

configure receives track geometry, a document and the rich-scenery preference. Camera transforms reuse the decoration rather than regenerating it; scenery randomness is independent of gameplay randomness. Reference textures and visibility are supplied by the host.

## Source and integration

Implementation: [scripts/ui/circuit_world.gd](../../scripts/ui/circuit_world.gd) (`CircuitWorld`, extends `Node2D`).

Referenced by [scripts/ui/track_canvas.gd](../../scripts/ui/track_canvas.gd).

## Interface

Primary presentation entry points:

- `configure(g: TrackGeometry, d: Dictionary, rich: bool = true) -> void`
- `blob(center: Vector2, radius: Vector2, phase: float, color: Color) -> void`
- `prepare_road_batches() -> void`

No custom intent signals are declared by this script. Inherited signals and native Control events remain available.

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)

## Links to other pages

- [Circuit Atelier](track-editor.md) — related destination or host.
- [Main menu](main-menu-view.md) — related destination or host.
- [Grand Prix setup](grand-prix-setup.md) — related destination or host.
- [Minimal race layout](minimal-race-workspace.md) — related destination or host.
