---
id: "editor-features-page"
title: "Editor Features page"
description: "Edits authored road features and decorative scenery placement using supported code-owned kinds."
kind: "page"
surface: "shipping"
source: "scripts/ui/editor_inspector_circuit.gd"
symbol: "EditorFeaturesPage"
status: "implemented"
source_pr: 28
source_commit: "dfb7cead8f01ea9b0b42a4b936b1d4c4e9bf21fa"
source_selector: "var features"
---

# Editor Features page

Edits authored road features and decorative scenery placement using supported code-owned kinds.

## Intent and purpose

Author range-based road annotations and choose scenery placement presets without treating decoration as racing collision geometry.

## User goals

- Add and refine curb/runoff/barrier/tunnel/bridge spans.
- Choose a validated scenery preset and place its objects on the map.
- Remove an obsolete annotation or last scenery object.

## Used components

[Editor inspector builder](track-editor-inspector.md) creates feature/preset OptionButtons, dimensional SpinBoxes and add/remove Buttons through [UI](ui.md). Session placement choices/help supply bounded presets; [TrackCanvas](track-canvas.md) performs scenery placement.

## Interactions

Selecting a feature refreshes fields without changing the draft. From/To percentages, width, clearance and side update through `perform`; remove resets feature selection. Add begins at the selected road point’s fraction (or zero) and appends a four-percent wrapped span. The scenery picker copies a current validated preset and switches to Place scenery; refresh discards removed/stale cached preset values. Remove last scenery object is a document transaction. If features or scenery are hidden/locked, page inputs are disabled. Bridge/tunnel spans are top-down annotations; road heights determine elevation data.

## Links to other pages

- [Circuit Atelier](track-editor.md) — Document transaction owner.
- [Editor Point page](editor-point-page.md) — Move, rotate, scale or delete placed scenery.
- [Editor World page](editor-world-page.md) — Illustration and layer controls.
- [Editor Checks page](editor-checks-page.md) — Inspect geometry findings.

## Source and integration

Implementation: [scripts/ui/editor_inspector_circuit.gd](../../../scripts/ui/editor_inspector_circuit.gd) (`var features`).

## Interface

This entry is implemented inside `scripts/ui/editor_inspector_circuit.gd` at `var features`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Editor inspector builder](track-editor-inspector.md)
- [docs/how-to/track-editor.md](../../how-to/track-editor.md)
- [Component catalog](README.md)
