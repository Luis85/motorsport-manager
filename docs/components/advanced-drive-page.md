---
id: "advanced-drive-page"
title: "Advanced Drive page"
description: "Hosts selected-driver pace, engine, send/recall and physical pit controls in the retained base inspector."
kind: "page"
surface: "advanced"
source: "scripts/ui/weekend.gd"
symbol: "AdvancedDrivePage"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "var command_page"
---

# Advanced Drive page

Hosts selected-driver pace, engine, send/recall and physical pit controls in the retained base inspector.

## Intent and purpose

Hosts selected-driver pace, engine, send/recall and physical pit controls in the retained base inspector.

## User goals

Give the selected owned driver pace/engine intent, release or recall a session run, or manage a physical pit order in the correct phase.

## Used components

Uses [native control helpers](ui.md) to construct fields and buttons, with [Advanced weekend support](weekend-view-support.md) supplying selection, phase availability and dispatch.

Native pace/engine/set `OptionButton`s, delegation/repair `CheckButton`s, lap/setup `SpinBox` fields and explicit release/recall/pit `Button`s. [Advanced weekend support](weekend-view-support.md) supplies their selection, phase availability and command dispatch.

## Interactions

Driving and Pit service subtopics reveal the existing controls. Pace, engine, Send out, Recall, Box at next entry and Cancel dispatch through the owning weekend adapter. Rival selection stays observational; garage, phase, ownership and safe-entry checks constrain actions. Choose a fresh or used set opens Tyres; Open complete setup opens the setup inspector.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Base Advanced weekend layout](weekend-view.md)
- [Advanced Tyres page](advanced-tyres-page.md)
- [Garage setup panel](racecraft-panel.md)
- [Strategy desk](strategy-desk.md)

## Behavior and state

Controls route through WeekendViewSupport.dispatch and the existing command adapter. Ownership, phase, garage and safe-gate conditions determine availability. Rival selection is observational and cannot acquire these manual channels.

## Source and integration

Implementation: [scripts/ui/weekend.gd](../../scripts/ui/weekend.gd) (`var command_page`).

## Interface

This entry is implemented inside `scripts/ui/weekend.gd` at `var command_page`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Base Advanced weekend layout](weekend-view.md)
- [Advanced weekend support](weekend-view-support.md)
- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
