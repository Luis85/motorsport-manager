---
id: "race-gamepad-navigation"
title: "Race gamepad navigation"
description: "Adds native focus navigation and bounded controller shortcuts to an Advanced workspace."
kind: "helper"
surface: "advanced"
source: "scripts/ui/race_weekend/gamepad_navigation.gd"
symbol: "RaceGamepadNavigation"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "Node"
---

# Race gamepad navigation

Adds native focus navigation and bounded controller shortcuts to an Advanced workspace.

## Intent and purpose

Add controller access to the existing Advanced focus and navigation model while respecting embedded modal windows.

## User goals

Move focus, activate a focused control, switch owned drivers and reach Find or decision review from a controller.

## Used components

- [Pitwall design adapter](pitwall-design.md)
- [Find workspace dialog](pitwall-navigator.md)
- [Decision review drawer](race-decision-drawer.md)

This helper supplies presentation behavior/resources to these consumers or depends on them; it is not an independently mounted page.

## Interactions

configure adds missing all-device A/B/D-pad UI bindings without removing keyboard bindings. Start explicitly toggles pause in active phases; shoulders switch drivers, Y opens Find, X opens decision review, and B closes full view/detail. Visible embedded windows suppress these shortcuts. A/D-pad retain native GUI handling; no-focus input restores the Watch button.

## Behavior and state

configure binds a Control root. Input handling respects modal windows and focused editors so global race shortcuts do not reach dialogs. Actual physical-controller usability remains a separate validation activity.

## Source and integration

Implementation: [scripts/ui/race_weekend/gamepad_navigation.gd](../../scripts/ui/race_weekend/gamepad_navigation.gd) (`RaceGamepadNavigation`, extends `Node`).

Referenced by [scripts/ui/pitwall_workspace.gd](../../scripts/ui/pitwall_workspace.gd).

## Interface

Primary presentation entry points:

- `configure(value: Control) -> void`

This helper declares no custom intent signals. The host supplies callbacks or observes the native controls it constructs.

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)

## Links to other pages

- [Engineering pitwall layout](pitwall-workspace.md) — owning/consuming workflow.
- [Full analysis layout](race-analysis-workspace.md) — owning/consuming workflow.
- [Session review layout](race-results-workspace.md) — owning/consuming workflow.
