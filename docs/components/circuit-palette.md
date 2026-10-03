---
id: "circuit-palette"
title: "Circuit palette"
description: "Defines the light illustrated-map ink used by TrackCanvas and its painters."
kind: "helper"
surface: "shared"
source: "scripts/ui/circuit_palette.gd"
symbol: "CircuitPalette"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "RefCounted"
---

# Circuit palette

Defines the light illustrated-map ink used by TrackCanvas and its painters.

## Intent and purpose

Keep circuit terrain readable and visually consistent independently of native application chrome.

## User goals

Recognize roads, pits, grass, trees and markings while following a race or editing a circuit.

## Used components

- [Track canvas](track-canvas.md)
- [Canvas overlay painters](track-canvas-overlays.md)

This helper supplies presentation behavior/resources to these consumers or depends on them; it is not an independently mounted page.

## Interactions

No interactive controls are constructed. Consumers use the map-ink constants when drawing; a preference or camera change affects pixels rather than sporting state.

## Behavior and state

Use these constants for terrain and map drawing. Application chrome comes from GameTheme; map color is presentation data and cannot affect grip, geometry or sporting state.

## Source and integration

Implementation: [scripts/ui/circuit_palette.gd](../../scripts/ui/circuit_palette.gd) (`CircuitPalette`, extends `RefCounted`).

Referenced by [scripts/ui/track_canvas.gd](../../scripts/ui/track_canvas.gd), [scripts/ui/track_canvas_overlays.gd](../../scripts/ui/track_canvas_overlays.gd).

## Interface

The host supplies fields/children and mounts the native lifecycle; this type has no public configure/present method.

This helper declares no custom intent signals. The host supplies callbacks or observes the native controls it constructs.

## Related documentation

- [Game theme](game-theme.md)
- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)

## Links to other pages

- [Circuit Atelier](track-editor.md) — owning/consuming workflow.
- [Minimal race layout](minimal-race-workspace.md) — owning/consuming workflow.
- [Race Director layout](race-director-workspace.md) — owning/consuming workflow.
