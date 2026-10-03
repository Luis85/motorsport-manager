---
id: "editor-reference-page"
title: "Editor Reference page"
description: "Imports and positions a reference image with opacity, dimensions, measured distance and calibration controls."
kind: "page"
surface: "shipping"
source: "scripts/ui/editor_inspector_workspace.gd"
symbol: "EditorReferencePage"
status: "implemented"
source_pr: 28
source_commit: "dfb7cead8f01ea9b0b42a4b936b1d4c4e9bf21fa"
source_selector: "var reference"
---

# Editor Reference page

Imports and positions a reference image with opacity, dimensions, measured distance and calibration controls.

## Intent and purpose

Use an embedded reference image as an authoring aid and calibrate its world scale independently of the road.

## User goals

- Import a permitted PNG/JPG and adjust its width, center and opacity.
- Measure a known span and calibrate the image around the first ruler point.
- Remove the reference without deleting the circuit.

## Used components

[Editor inspector builder](track-editor-inspector.md) builds image fields and calibration/removal Buttons. Import uses [native file dialog](native-file-dialog.md) and the injected `TrackEditorPort`; [TrackCanvas](track-canvas.md) supplies measurement and Move reference gestures.

## Interactions

Import reads through the port and applies embedded PNG, bounds-derived width/center and default opacity via `perform`. Transform fields and removal use document transactions. Known distance is temporary editor state; calibration is disabled until both ruler endpoints exist. `calibrate_reference` checks nonzero distance and resulting bounds, scales reference width/center about the first ruler point, then updates the temporary ruler. The road stays in place. Reference fields are disabled when its layer is hidden/locked. Import failure shows a notification and preserves the draft.

## Links to other pages

- [Circuit Atelier](track-editor.md) — Import failure, revision and save/export behavior.
- [Editor Point page](editor-point-page.md) — Road editing while tracing.
- [Editor World page](editor-world-page.md) — Reference layer visibility/lock.
- [Editor Draw page](editor-sketch-page.md) — Draw a candidate road over the image.

## Source and integration

Implementation: [scripts/ui/editor_inspector_workspace.gd](../../scripts/ui/editor_inspector_workspace.gd) (`var reference`).

## Interface

This entry is implemented inside `scripts/ui/editor_inspector_workspace.gd` at `var reference`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Editor inspector builder](track-editor-inspector.md)
- [docs/track-editor.md](../../docs/track-editor.md)
- [Component catalog](README.md)
