---
id: "track-editor-inspector"
title: "Editor inspector builder"
description: "Builds the editor's Point, Track, Features, Reference, Checks, World and Draw inspector pages from the displayed draft."
kind: "helper"
surface: "shipping"
source: "scripts/ui/editor_inspector.gd"
symbol: "TrackEditorInspector"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "RefCounted"
---

# Editor inspector builder

Builds the editor's Point, Track, Features, Reference, Checks, World and Draw inspector pages from the displayed draft.

## Intent and purpose

Rebuild the authoring fields appropriate to the displayed draft and selection. The helper organizes precise editing and readiness feedback without owning canonical document state.

## User goals

- Inspect road/pit/scenery selection and edit exact values.
- Switch between circuit, feature, reference, checks, world and drawing topics.
- Understand why a draft needs correction before a test weekend.

## Used components

Seven scrollable inspector pages created by the host’s `inspector_page`: [Point](editor-point-page.md), [Track](editor-track-page.md), [Features](editor-features-page.md), [Reference](editor-reference-page.md), [Checks](editor-checks-page.md), [World](editor-world-page.md) and [Draw](editor-sketch-page.md). Native fields use [UI](ui.md); the editor owns the topic selector and persistent sketch-action controls.

## Interactions

`render(editor: Control)` sets `_refreshing_inspector`, remembers the tab, clears/rebuilds the page fields and restores the selected topic. Name-field focus exit checks the refresh guard before committing. Document callbacks call `perform`, `apply_selection_result` or other editor methods; selectors and ruler/sketch settings can change presentation state without a document commit. Hidden/locked point layers disable Point input; either unavailable road/pit layer disables Track; either unavailable feature/scenery layer disables Features; reference locking disables Reference. The actual last page is internally named `Draw`, displayed as “Draw new layout.” It updates persistent sketch controls after rebuilding. There is no configuration lifecycle or custom signal on this RefCounted helper.

## Links to other pages

- [Circuit Atelier](track-editor.md) — Displayed revision, session transactions and lifecycle.
- [Editor toolbar builder](track-editor-toolbar.md) — Document and tool actions outside the inspector.

## Source and integration

Implementation: [scripts/ui/editor_inspector.gd](../../scripts/ui/editor_inspector.gd) (`TrackEditorInspector`, extends `RefCounted`).

Referenced by [scripts/ui/editor.gd](../../scripts/ui/editor.gd).

## Interface

Primary entry points:

- `render(editor: Control) -> void`

No custom intent signals are declared by this script. Inherited signals and native Control events remain available.

## Related documentation

- [Circuit Atelier](track-editor.md)
- [docs/track-editor.md](../../docs/track-editor.md)
- [Component catalog](README.md)
