---
id: "recovery-panel"
title: "Recovery panel"
description: "Presents selected-driver incident evidence, protection, repairs, retirement and recovery authority controls."
kind: "component"
surface: "advanced"
source: "scripts/ui/recovery_panel.gd"
symbol: "RecoveryPanel"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Recovery panel

Presents selected-driver incident evidence, protection, repairs, retirement and recovery authority controls.

## Intent and purpose

Presents selected-driver incident evidence, protection, repairs, retirement and recovery authority controls.

## User goals

Compare keeping orders, protecting resources, repair-only service and retirement using observed damage, lifetime health and published procedure.

## Used components

Native driver `Button`s, evidence `ScrollContainer`/`Label`s, severity/service `OptionButton`s, a lap `SpinBox` and a retirement `ConfirmationDialog`, built through [native control helpers](ui.md). The host receives explicit command signals.

## Interactions

Select an owned driver; Protect and Repair only submit the displayed advice target/key/gate. Retire requires confirmation and retains a classified retirement; cancel sends nothing. Emergency repair permission and work cap are a separate per-driver draft until Apply authority. Reading leaves playback unchanged; repair reduces scalar damage through real service and does not replenish lifetime health or diagnose component failures.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Recovery-capable weekend layout](recovery-weekend-view.md)
- [Team orders panel](team-orders-panel.md)
- [Physical pit-service panel](race-pit-service-panel.md)

## Behavior and state

configure receives RaceViewQuery; choose_driver preserves named targets and buttons emit command_requested. Retirement is confirmed, phase/resource restrictions disable controls with reasons, and refresh does not replace focused actions. Repair/protection do not fabricate missing physical resources or completed recovery.

## Source and integration

Implementation: [scripts/ui/recovery_panel.gd](../../scripts/ui/recovery_panel.gd) (`RecoveryPanel`, extends `VBoxContainer`).

Referenced by [scripts/ui/practice_panel.gd](../../scripts/ui/practice_panel.gd), [scripts/ui/recovery_weekend.gd](../../scripts/ui/recovery_weekend.gd).

## Interface

Public presentation entry points:

- `configure(value: RaceViewQuery) -> void`
- `refresh() -> void`
- `compact(button: Button) -> void`
- `paragraph() -> Label`
- `choose_driver(id: int) -> void`
- `payload() -> Dictionary`
- `submit_protect() -> void`
- `submit_repair() -> void`

Emitted intent signals:

- `command_requested(action: String, payload: Dictionary)`

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
