---
id: "editor-sketch-page"
title: "Editor Sketch page"
description: "Supports Trace → Preview → Apply with simplification, smoothing and road-width draft settings."
kind: "page"
surface: "shipping"
source: "scripts/ui/editor_inspector_workspace.gd"
symbol: "EditorSketchPage"
status: "implemented"
source_pr: 28
source_commit: "dfb7cead8f01ea9b0b42a4b936b1d4c4e9bf21fa"
source_selector: "var sketch_page"
---

# Editor Sketch page

Supports Trace → Preview → Apply with simplification, smoothing and road-width draft settings.

## Intent and purpose

Offer a staged Trace → Preview → Apply workflow for a new road while the committed circuit remains available for recovery. In the UI this topic is “Draw new layout,” with an internal `Draw` page.

## User goals

- Build a connected freehand or pen trace and close its loop.
- Tune simplification, smoothing and road width before inspecting a candidate.
- Confirm road replacement only after a valid preview, or clear the temporary trace.

## Used components

[Editor inspector builder](track-editor-inspector.md) creates trace-tool Buttons, summary, Close loop, parameter SpinBoxes and Clear trace. [TrackCanvas](track-canvas.md) owns temporary `TrackSketch` strokes/preview; persistent Preview road and Replace road Buttons are created by [Circuit Atelier](track-editor.md) outside the scrollable fields.

## Interactions

Freehand/Pen switch tools. Close loop requires at least four points; parameter changes invalidate the preview. `preview_sketch` compiles a candidate through the session and rejects blocking diagnostics without replacing the document. Replace is enabled only for a valid preview and editable road, then asks confirmation. Commit checkpoints once, copies the proposal, clears trace/selection and recompiles using the displayed revision. Replacement clears old pits/features/timing attachments while retaining scenery/reference/style; Undo restores the original. Clear trace is confirmed and clears trace history. Drawing Undo/Redo affects trace state. Unapplied strokes block Test weekend/runtime export and are protected by discard confirmation; saving writes committed road data.

## Links to other pages

- [Circuit Atelier](track-editor.md) — Persistent preview/replace actions and session history.
- [Editor Reference page](editor-reference-page.md) — Import an image to trace.
- [Editor Checks page](editor-checks-page.md) — Review generated geometry findings.
- [Editor Track page](editor-track-page.md) — Review regenerated pits/timing before driving.
- [Editor World page](editor-world-page.md) — Show and unlock the road layer.

## Source and integration

Implementation: [scripts/ui/editor_inspector_workspace.gd](../../../scripts/ui/editor_inspector_workspace.gd) (`var sketch_page`).

## Interface

This entry is implemented inside `scripts/ui/editor_inspector_workspace.gd` at `var sketch_page`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Editor inspector builder](track-editor-inspector.md)
- [docs/how-to/track-editor.md](../../how-to/track-editor.md)
- [Component catalog](README.md)
