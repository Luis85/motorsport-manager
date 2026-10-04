---
id: "notebook-window"
title: "Circuit notebook"
description: "Separates remembered run facts from editable personal notes in a native notebook window."
kind: "page"
surface: "advanced"
source: "scripts/ui/notebook_window.gd"
symbol: "NotebookWindow"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "Window"
---

# Circuit notebook

Separates remembered run facts from editable personal notes in a native notebook window.

## Intent and purpose

Separates remembered run facts from editable personal notes in a native notebook window.

## User goals

Remember a completed original or sandbox run, compare retained facts, and keep personal circuit notes without changing sporting results.

## Used components

Uses [native control helpers](ui.md) for labels/actions and [pitwall design](pitwall-design.md) for scaling and focus restoration.

Native `Window`, `ItemList`, filter `OptionButton`, evidence `ScrollContainer`, note `TextEdit`, action `Button`s, discard `ConfirmationDialog` and export `FileDialog`. NotebookPort and the injected presentation service supply persistence; they are application dependencies, not nested UI widgets.

## Interactions

Filter/select remembered runs, edit and save a bounded note, explicitly remember a completed run, confirm forgetting an entry, or export the saved notebook. Switching entries, filtering or closing with a dirty note asks to discard it; cancel retains the draft. Close returns focus to the invoker.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Practice-capable weekend layout](practice-weekend-view.md)
- [Race Director layout](race-director-workspace.md)
- [Replay and sandbox](replay-workspace.md)

## Behavior and state

open receives a parent, optional sealed run, notebook path and focus invoker. Save, remember, forget and export use the injected NotebookPort. Dirty selection/filter/close transitions require discard handling; forgetting a run is confirmed and cancellation preserves edits. Historical notes never alter a race result.

## Source and integration

Implementation: [scripts/ui/notebook_window.gd](../../../scripts/ui/notebook_window.gd) (`NotebookWindow`, extends `Window`).

Referenced by [scripts/composition/main.gd](../../../scripts/composition/main.gd), [scripts/ui/practice_weekend.gd](../../../scripts/ui/practice_weekend.gd), [scripts/ui/race_director_workspace.gd](../../../scripts/ui/race_director_workspace.gd).

## Interface

Public presentation entry points:

- `open(parent: Node, source: RaceRecord = null, path: String = NotebookPort.PATH, return_focus: Control = null) -> NotebookWindow`
- `dirty() -> bool`
- `reload(prefer: String = "") -> void`
- `refill(prefer: String = "") -> void`
- `select_run(index: int) -> void`
- `request_selection(index: int) -> void`
- `request_filter(index: int) -> void`
- `edit_changed() -> void`

No custom intent signals are declared by this script.

## Related documentation

- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
