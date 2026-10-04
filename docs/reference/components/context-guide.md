---
id: "context-guide"
title: "Context guide"
description: "Provides a resumable, non-modal walkthrough with host-supplied steps, reveal callbacks and target controls."
kind: "component"
surface: "shared"
source: "scripts/ui/context_guide.gd"
symbol: "ContextGuide"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "Control"
---

# Context guide

Provides a resumable, non-modal walkthrough with host-supplied steps, reveal callbacks and target controls.

## Intent and purpose

Teach the current workflow in place while preserving access to its actions and evidence.

## User goals

Find the next relevant control, read its explanation, resume a dismissed guide and complete the workflow at a chosen pace.

## Used components

- [Native control helpers](ui.md)
- [Pitwall design adapter](pitwall-design.md)
- [Pitwall finishing guide](pitwall-finishing-guide.md)

## Interactions

Open resumes the stored step; Back/Next reveal the supplied targets, Restart returns to step zero and Dismiss stores progress. Long copy scrolls while guide actions remain outside the scroll. A failed progress write adds a visible warning; no guide step performs the described race command.

## Behavior and state

configure binds a guide key and steps. Opening or advancing reveals UI without issuing race commands. Progress is stored through injected presentation services. PitwallFinishingGuide can supply a placement region to keep the guide away from commit controls.

## Source and integration

Implementation: [scripts/ui/context_guide.gd](../../../scripts/ui/context_guide.gd) (`ContextGuide`, extends `Control`).

Referenced by [scripts/ui/editor.gd](../../../scripts/ui/editor.gd), [scripts/ui/strategy_weekend.gd](../../../scripts/ui/strategy_weekend.gd), [scripts/ui/weekend_support.gd](../../../scripts/ui/weekend_support.gd).

## Interface

Primary presentation entry points:

- `configure(key: String, value: Array) -> void`
- `open_guide() -> void`
- `show_step(index: int) -> void`
- `next_step() -> void`
- `store_progress() -> void`
- `dismiss() -> void`

No custom intent signals are declared by this script. Inherited signals and native Control events remain available.

## Related documentation

- [Native control helpers](ui.md)
- [Pitwall finishing guide](pitwall-finishing-guide.md)
- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)

## Links to other pages

- [Circuit Atelier](track-editor.md) — related destination or host.
- [Engineering pitwall layout](pitwall-workspace.md) — related destination or host.
- [Strategy-capable weekend layout](strategy-weekend-view.md) — related destination or host.
- [Practice-capable weekend layout](practice-weekend-view.md) — related destination or host.
