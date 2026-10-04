---
id: "public-rival-inspector"
title: "Public rival inspector"
description: "Masks private command/setup controls when the inspected car is a rival and presents only public-profile information."
kind: "helper"
surface: "advanced"
source: "scripts/ui/public_rival_inspector.gd"
symbol: "PublicRivalInspector"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "RefCounted"
---

# Public rival inspector

Masks private command/setup controls when the inspected car is a rival and presents only public-profile information.

## Intent and purpose

Let the player inspect observed rival behavior while preserving private rival information and command boundaries.

## User goals

Read a rival's name, team, public tendency, observed compound and running state without confusing them with an owned driver.

## Used components

- [Advanced timing tower](race-timing-tower.md)
- [Inspector scroll layout](race-inspector-page.md)
- [Practice-capable weekend layout](practice-weekend-view.md)
- [Native control helpers](ui.md)

This helper supplies presentation behavior/resources to these consumers or depends on them; it is not an independently mounted page.

## Interactions

configure adds public-description masks to Drive/Telemetry/Tyres/Setup content. During rival inspection, present hides private resource/plan/telemetry controls and replaces those pages with public copy. restore returns each control to its previous visibility before the next refresh; profiles-disabled weekends bypass masking.

## Behavior and state

configure binds the existing weekend view; conceal and restore track affected controls, and present applies the selected-car privacy boundary. Rival inspection grants neither command authority nor access to hidden rival plans.

## Source and integration

Implementation: [scripts/ui/public_rival_inspector.gd](../../../scripts/ui/public_rival_inspector.gd) (`PublicRivalInspector`, extends `RefCounted`).

Referenced by [scripts/ui/practice_weekend.gd](../../../scripts/ui/practice_weekend.gd).

## Interface

Primary presentation entry points:

- `configure(view: WeekendView) -> void`
- `present(view: PracticeWeekendView) -> void`
- `restore() -> void`
- `conceal(control: Control) -> void`

This helper declares no custom intent signals. The host supplies callbacks or observes the native controls it constructs.

## Related documentation

- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)

## Links to other pages

- [Practice-capable weekend layout](practice-weekend-view.md) — owning/consuming workflow.
- [Race Director layout](race-director-workspace.md) — owning/consuming workflow.
- [Advanced Drive page](advanced-drive-page.md) — owning/consuming workflow.
- [Advanced Tyres page](advanced-tyres-page.md) — owning/consuming workflow.
