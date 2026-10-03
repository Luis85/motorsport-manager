---
id: "race-decision-drawer"
title: "Decision review drawer"
description: "Guides an owned driver through evidence, action preparation, confirmation and observed command outcome."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/decision_drawer.gd"
symbol: "RaceDecisionDrawer"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Decision review drawer

Guides an owned driver through evidence, action preparation, confirmation and observed command outcome.

## Intent and purpose

Guides an owned driver through evidence, action preparation, confirmation and observed command outcome.

## User goals

Compare observed facts with estimated options and approve, acknowledge or reject a named-driver decision with a visible follow-up.

## Used components

- [Status badge](race-status-badge.md)
- [Pitwall forecast comparison](pitwall-comparison.md)

## Interactions

Select an issue from the frozen snapshot; Box, Save fuel or Release first prepares exact commitment text, and the repeated confirmation action submits it. Back to review clears only the pending choice. Keep plan explicitly acknowledges the displayed issue without changing pit orders or playback. Refresh requests new evidence; Full strategy navigates. Stale evidence blocks action, and accepted/rejected/executing/outcome states remain separate.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Engineering pitwall layout](pitwall-workspace.md)
- [Strategy desk](strategy-desk.md)
- [Decision queue](race-decision-queue.md)
- [Director call room](race-call-room.md)

## Behavior and state

present freezes a review snapshot; select_issue changes the reviewed issue. Stale evidence requires refresh_requested rather than silent forecast replacement. command_result renders acceptance/rejection, and keeping a plan acknowledges only the reviewed issue. Per-driver receipts do not become a second command journal.

## Source and integration

Implementation: [scripts/ui/race_weekend/decision_drawer.gd](../../scripts/ui/race_weekend/decision_drawer.gd) (`RaceDecisionDrawer`, extends `VBoxContainer`).

Referenced by [scripts/ui/pitwall_workspace.gd](../../scripts/ui/pitwall_workspace.gd).

## Interface

Public presentation entry points:

- `configure(value: RaceViewQuery) -> void`
- `present(value: Dictionary, new_review: bool = false) -> void`
- `refresh_state() -> void`
- `prepare(action: String) -> void`
- `keep_plan() -> void`
- `command_result(accepted: bool, reason: String, action: String) -> void`
- `reset_review() -> void`
- `select_issue(index: int) -> void`

Emitted intent signals:

- `command_requested(action: String, payload: Dictionary)`
- `refresh_requested(id: int)`
- `detail_requested(id: int)`

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
