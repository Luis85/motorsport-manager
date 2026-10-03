---
id: "editor-world-page"
title: "Editor World page"
description: "Offers illustration presets and per-layer visibility/lock controls for the editor."
kind: "page"
surface: "shipping"
source: "scripts/ui/editor_inspector.gd"
symbol: "EditorWorldPage"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "var look"
---

# Editor World page

Offers illustration presets and per-layer visibility/lock controls for the editor.

## Intent and purpose

Adjust the circuit illustration and workspace layer availability while preserving the distinction between saved scenery style and temporary editing controls.

## User goals

- Choose meadow, woodland or coastal surroundings and summer/autumn colors.
- Show or lock road, pit, scenery, feature and reference layers.
- Show a construction grid while editing.

## Used components

[Editor inspector builder](track-editor-inspector.md) creates environment/season OptionButtons and layer/grid CheckButtons through [UI](ui.md). [TrackCanvas](track-canvas.md) owns `layer_state`, grid visibility and reference preview; [CircuitWorld](circuit-world.md) renders the illustration.

## Interactions

Environment and season update `document.visual` through `perform` and are undoable authored values. Visible/Locked toggles call canvas `set_layer`; construction grid toggles `show_grid` and redraws. Layer switches stay workspace-local: they do not delete content, change exports or hide the race road. Hidden or locked layers reject relevant editing gestures/fields. Reference preview remains application-owned and stops when editing changes geometry; it is a reference dot over the baked line.

## Links to other pages

- [Circuit Atelier](track-editor.md) — History and preview lifetime.
- [Editor Point page](editor-point-page.md) — Controls gated by the selected layer.
- [Editor Features page](editor-features-page.md) — Author actual scenery/annotations.
- [Editor Reference page](editor-reference-page.md) — Reference transform and calibration.

## Source and integration

Implementation: [scripts/ui/editor_inspector.gd](../../scripts/ui/editor_inspector.gd) (`var look`).

## Interface

This entry is implemented inside `scripts/ui/editor_inspector.gd` at `var look`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Editor inspector builder](track-editor-inspector.md)
- [docs/track-editor.md](../../docs/track-editor.md)
- [Component catalog](README.md)
