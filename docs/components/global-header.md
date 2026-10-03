---
id: "global-header"
title: "Global header"
description: "Shows application identity, location, optional version and Return to editor / How to play / Main menu actions."
kind: "component"
surface: "shipping"
source: "scripts/composition/main.gd"
symbol: "GlobalHeader"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "_scale_header"
---

# Global header

Shows application identity, location, optional version and Return to editor / How to play / Main menu actions.

## Intent and purpose

Orient players within native non-weekend screens and expose shared navigation/help without repeating it in every page. The header combines application identity, current location and conditional version/editor-return controls.

## User goals

Know the current destination, get control instructions, return home safely, or resume the retained editor draft after a test weekend.

## Used components

Native labels, a flexible spacer and buttons use [Native UI helpers](ui.md) and [Pitwall design](pitwall-design.md) text scaling. The [Native application shell](native-shell.md) owns the header and updates its location label.

## Interactions

How to play opens the shared help dialog; Main menu follows shell save/discard navigation. Return to editor appears when a retained editor draft exists outside the editor and honors dirty Settings handling. The header is hidden on the weekend screen. The version label hides below the width/text-scale threshold.

## Links to other pages

[How to play](how-to-play.md) explains controls. [Main menu](main-menu-view.md), [Settings](settings-view.md), [Grand Prix setup](grand-prix-setup.md), [welcome](weekend-entry-view.md) and [completion](weekend-end-view.md) share this header; Return to editor leads to [Circuit Atelier](track-editor.md).

## Behavior and state

Built by _ready and scaled by _scale_header. Weekend screens hide it in favor of their own session toolbar. Version text hides below 1280px or above 115% text scale; editor return is visible only when an editor draft exists. Navigation uses the shell save/discard checks.

## Source and integration

Implementation: [scripts/composition/main.gd](../../scripts/composition/main.gd) (`_scale_header`).

## Interface

This entry is implemented inside `scripts/composition/main.gd` at `_scale_header`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Native application shell](native-shell.md)
- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
