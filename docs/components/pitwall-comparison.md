---
id: "pitwall-comparison"
title: "Pitwall forecast comparison"
description: "Displays forecaster alternatives together with time estimates, risks and draft context."
kind: "component"
surface: "advanced"
source: "scripts/ui/pitwall_comparison.gd"
symbol: "PitwallComparison"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Pitwall forecast comparison

Displays forecaster alternatives together with time estimates, risks and draft context.

## Intent and purpose

Displays forecaster alternatives together with time estimates, risks and draft context.

## User goals

Compare the active or unapplied draft plan with supplied alternatives and understand estimate bands, risk and rejoin context.

## Used components

Native option labels arranged in shared `VBoxContainer`/`HBoxContainer` content, built through [native control helpers](ui.md) and [pitwall design](pitwall-design.md). The caller supplies forecast alternatives rather than a live model.

## Interactions

The host calls present with detached forecast values. Reading a card changes neither draft nor plan; this presenter emits no command or selection signal. Unavailable alternatives retain an explicit reason.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Strategy desk](strategy-desk.md)
- [Decision review drawer](race-decision-drawer.md)
- [Engineering pitwall layout](pitwall-workspace.md)

## Behavior and state

present accepts a detached forecast and an optional draft flag. All numeric alternatives come from the supplied forecaster result; unavailable alternatives stay explicit. This presenter has no command signal and does not approve or execute a strategy.

## Source and integration

Implementation: [scripts/ui/pitwall_comparison.gd](../../scripts/ui/pitwall_comparison.gd) (`PitwallComparison`, extends `VBoxContainer`).

Referenced by [scripts/ui/pitwall_workspace.gd](../../scripts/ui/pitwall_workspace.gd), [scripts/ui/race_weekend/decision_drawer.gd](../../scripts/ui/race_weekend/decision_drawer.gd).

## Interface

Public presentation entry points:

- `present(forecast: Dictionary, is_draft: bool = false) -> void`

No custom intent signals are declared by this script.

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
