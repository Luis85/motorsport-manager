---
id: "editor-point-page"
title: "Editor Point page"
description: "Shows fields and selection actions for road/pit points, scenery or multi-selection."
kind: "page"
surface: "shipping"
source: "scripts/ui/editor_inspector_selection.gd"
symbol: "EditorPointPage"
status: "implemented"
source_pr: 28
source_commit: "dfb7cead8f01ea9b0b42a4b936b1d4c4e9bf21fa"
source_selector: "var point"
---

# Editor Point page

Shows fields and selection actions for road/pit points, scenery or multi-selection.

## Intent and purpose

Provide precise selection editing beside direct canvas manipulation. The page changes its fields for multi-selection, scenery, a pit point, a road control point or no selection.

## User goals

- Move selected geometry accurately and shape a road corner with handles.
- Rotate, scale or distribute a selection as one edit.
- Remove a selected item while retaining a usable closed road.

## Used components

[Editor inspector builder](track-editor-inspector.md) constructs native labels, SpinBoxes, CheckButtons and Buttons through [UI](ui.md). [TrackCanvas](track-canvas.md) supplies selection state; `TrackEdit` supplies selection transforms and `TrackDocument` supplies smooth/split operations.

## Interactions

Multi-selection exposes rotation, scale and horizontal/vertical distribution; road transforms carry handles while retaining widths/elevations. Scenery exposes coordinates, rotation, scale and deletion. Pit mode exposes pit coordinates/deletion. Road mode adds aligned handles, Smooth, sharp-corner, split-next-segment and Delete. With nothing selected, Smooth all and canvas shortcut guidance are shown. Mutating fields call editor `perform`; selection transforms call `apply_selection_result` and commit via `recompile` with the observed draft revision. The appropriate hidden/locked layer disables the page. Selection alone does not commit an edit; road deletion retains at least four points.

## Links to other pages

- [Circuit Atelier](track-editor.md) — Transaction and history owner.
- [Editor Track page](editor-track-page.md) — Pit gates and timing sectors.
- [Editor Features page](editor-features-page.md) — Select scenery placements.
- [Editor World page](editor-world-page.md) — Unlock/show editable layers.

## Source and integration

Implementation: [scripts/ui/editor_inspector_selection.gd](../../scripts/ui/editor_inspector_selection.gd) (`var point`).

## Interface

This entry is implemented inside `scripts/ui/editor_inspector_selection.gd` at `var point`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Editor inspector builder](track-editor-inspector.md)
- [Circuit Atelier](track-editor.md)
- [docs/track-editor.md](../../docs/track-editor.md)
- [Component catalog](README.md)
