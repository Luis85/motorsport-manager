---
id: "editor-checks-page"
title: "Editor Checks page"
description: "Displays track readiness findings and routes to affected authored geometry."
kind: "page"
surface: "shipping"
source: "scripts/ui/editor_inspector_workspace.gd"
symbol: "EditorChecksPage"
status: "implemented"
source_pr: 28
source_commit: "dfb7cead8f01ea9b0b42a4b936b1d4c4e9bf21fa"
source_selector: "var checks"
---

# Editor Checks page

Displays track readiness findings and routes to affected authored geometry.

## Intent and purpose

Make compiler readiness findings inspectable before driving or exporting runtime data, with explicit blocking/advisory status and a route to each affected location.

## User goals

- Count blocking and advisory findings.
- Locate a crossing, pit-angle or tight-radius issue on the map.
- Understand what still requires manual review.

## Used components

[Editor inspector builder](track-editor-inspector.md) creates count/message Labels and finding Buttons using [UI](ui.md). `TrackEditorSession.diagnostics` supplies findings; [TrackCanvas](track-canvas.md) shows them and the focused geometry.

## Interactions

The page displays current `editor.findings`, including severity/code buttons with the detailed message as tooltip and visible paragraph. Choosing a finding calls `focus_finding(index)`, centers the canvas on the finding fraction, ensures a usable zoom, selects its nearby segment and updates status. It changes selection/view rather than repairing the document. Empty findings explicitly advise testing a lap and inspecting pits. Coverage describes sampled crossings, vertical separation, pit angles and tight radii, not certified edge/envelope/structural clearance. `race_errors` separately blocks test/runtime export on error findings or unapplied trace.

## Links to other pages

- [Circuit Atelier](track-editor.md) — Explicit test and runtime-export validation.
- [Editor Point page](editor-point-page.md) — Correct the selected geometry.
- [Editor Track page](editor-track-page.md) — Pit and timing configuration.
- [Editor Draw page](editor-sketch-page.md) — Preview blocks invalid road replacement.

## Source and integration

Implementation: [scripts/ui/editor_inspector_workspace.gd](../../../scripts/ui/editor_inspector_workspace.gd) (`var checks`).

## Interface

This entry is implemented inside `scripts/ui/editor_inspector_workspace.gd` at `var checks`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Editor inspector builder](track-editor-inspector.md)
- [docs/how-to/track-editor.md](../../how-to/track-editor.md)
- [Component catalog](README.md)
