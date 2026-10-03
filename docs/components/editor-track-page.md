---
id: "editor-track-page"
title: "Editor Track page"
description: "Edits circuit metadata, grid, start/finish, timing sectors and pit-lane configuration, and selects a vehicle preview with validation details."
kind: "page"
surface: "shipping"
source: "scripts/ui/editor_inspector_circuit.gd"
symbol: "EditorTrackPage"
status: "implemented"
source_pr: 28
source_commit: "dfb7cead8f01ea9b0b42a4b936b1d4c4e9bf21fa"
source_selector: "var track"
---

# Editor Track page

Edits circuit metadata, grid, start/finish, timing sectors and pit-lane configuration, and selects a vehicle preview with validation details.

## Intent and purpose

Configure the authored circuit’s identity, start/grid/timing and physical pit route, and expose draft validation context next to those controls.

## User goals

- Name the circuit and choose a vehicle for the heuristic preview.
- Place the grid, start/finish and two sector boundaries.
- Adjust pit entry, exit and speed or regenerate a service lane.

## Used components

[Editor inspector builder](track-editor-inspector.md) supplies LineEdit, OptionButton, SpinBox and Button fields through [UI](ui.md). The editor session supplies vehicle choices and draft compilation; `TrackDocument` and compiled geometry provide validation and warnings.

## Interactions

Name submits or commits on focus exit, guarded against inspector refresh. Vehicle selection changes `editor.vehicle` and recompiles the preview rather than authoring a vehicle into the circuit. Grid count/spacing, start fraction and pit fractions/limit call `perform`. Set S1/S2 is enabled only with a selected road point and delegates to `set_sector`. Generate service lane clears the old pits, compiles the draft and copies generated pit data in a transaction. Validation lists authoring issues plus geometry warnings and provenance notices. If road or pits are hidden/locked, the whole page’s inputs are disabled. Readiness finding navigation is on Checks; saving and testing have distinct validation boundaries.

## Links to other pages

- [Circuit Atelier](track-editor.md) — Save, runtime export and test routes.
- [Editor Point page](editor-point-page.md) — Select road points or refine pit nodes.
- [Editor Checks page](editor-checks-page.md) — Focus individual compiled findings.
- [Editor World page](editor-world-page.md) — Layer availability.

## Source and integration

Implementation: [scripts/ui/editor_inspector_circuit.gd](../../scripts/ui/editor_inspector_circuit.gd) (`var track`).

## Interface

This entry is implemented inside `scripts/ui/editor_inspector_circuit.gd` at `var track`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Editor inspector builder](track-editor-inspector.md)
- [docs/track-editor.md](../../docs/track-editor.md)
- [Component catalog](README.md)
