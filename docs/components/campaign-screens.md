---
id: "campaign-screens"
title: "Campaign screen composition"
description: "Routes Team Principal creation/resume, Director Desk, departure, race return and campaign errors."
kind: "helper"
surface: "shipping"
source: "scripts/composition/campaign_screens.gd"
symbol: "CampaignScreens"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "show_campaign"
---

# Campaign screen composition

Routes Team Principal creation/resume, Director Desk, departure, race return and campaign errors.

## Intent and purpose

Coordinate the Team Principal route separately from the native shell while keeping campaign transactions and persistence in their existing authorities. PR 28 extracts this orchestration into a RefCounted collaborator.

## User goals

Create/resume a career, read the desk between events, explicitly advance/depart, continue a frozen active weekend and return with factual settlement/debrief.

## Used components

A native ScrollContainer hosts [Campaign Director Desk](campaign-director-desk.md). [Campaign error](campaign-error.md) handles failed loading/creation/projection; [native notifications](native-notification.md) report transaction or save failures. The host mounts [Minimal race layout](minimal-race-workspace.md) for active campaign weekends.

## Interactions

show_campaign resolves existing or default campaign content, validates the checkpoint, and resumes an active manifest instead of showing a planning desk. Desk intents run explicit advance/departure transactions and save through App. At weekend completion, factual result staging and follow-up precede returning to the desk. Guide visibility is saved as a presentation preference. The helper orchestrates these operations; it does not become a campaign economy or time authority.

## Links to other pages

[Main menu](main-menu-view.md) enters the campaign. Valid inactive campaigns reach [Director Desk](campaign-director-desk.md); active events reach [Minimal race layout](minimal-race-workspace.md); unrecoverable entry failures show [Campaign error](campaign-error.md). The [Native application shell](native-shell.md) owns this collaborator.

## Behavior and state

PR 28 moves campaign orchestration out of main.gd. New careers require the validated default CampaignDefinition; records and every calendar circuit freeze into the campaign snapshot. Advance/depart/settle use existing transactions and storage. show_campaign mounts a detached CampaignDirectorDesk projection when no active manifest exists; an active manifest resumes the Minimal weekend. Domain/application transactions remain authoritative.

## Source and integration

Implementation: [scripts/composition/campaign_screens.gd](../../scripts/composition/campaign_screens.gd) (`show_campaign`).

## Interface

`CampaignScreens` is a registered `RefCounted` class constructed with its native shell host. `show_campaign()` opens/resumes the route; `_advance_campaign()`, `_start_campaign_event()` and `_settle_campaign_weekend()` orchestrate existing transactions. It is not a Control mounted in the scene tree.

## Related documentation

- [Campaign screen composition](campaign-screens.md)
- [Campaign Director Desk](campaign-director-desk.md)
- [docs/campaign/director-desk-first-loop.md](../../docs/campaign/director-desk-first-loop.md)
- [Component catalog](README.md)
