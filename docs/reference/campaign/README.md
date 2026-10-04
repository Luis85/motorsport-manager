# Campaign documentation

The native **Team Principal Campaign** route is a four-event first slice. Start
with [Director Desk and first Team Principal loop](director-desk-first-loop.md)
for the player route, explicit actions and save/resume behavior. The remaining
pages are implementation references: they describe authoritative records,
transactions and limits, including deeper systems that have no dedicated native
specialist screens. [Current project status](../current-state.md) is the capability
inventory.

## Core authority references

| Need | Reference |
|---|---|
| Understand dated time, checkpoint v6, storage and migration | [State, clock and storage](state-clock-storage.md) |
| Bind race entrants and facts to stable campaign identities | [Weekend boundary](weekend-boundary.md) |
| Settle time, standings, returned resources and cash together | [Weekend consequences](weekend-consequence-transaction.md) |
| Register a calendar/field and control championship transitions | [Season lifecycle](season-lifecycle.md) |
| Distinguish cash, obligations, reserves and forecasts | [Finance](finance-commitments-forecast.md) |
| Manage employment, payroll, roles and exclusive occupancy | [Personnel](people-contracts-availability.md) |
| Reserve facility/staff capacity or rent finite services | [Operations](facilities-capacity-services.md) |
| Bind engineering gates to work and install physical parts | [Engineering](engineering-parts-race-profile.md) |
| Validate and freeze the exact next race entry | [Readiness and departure](event-readiness-departure.md) |
| Review and apply replacement final-result consequences | [Result correction](result-corrections.md) |

## Management extension references

| Need | Reference |
|---|---|
| Represent guaranteed payments, earned bonuses and appearances | [Commercial](sponsorship-commercial.md) |
| Delegate bounded spending and retain decision evidence | [Mandates](delegation-mandates.md) |
| Inspect finite rival planning and review evidence | [Rivals](rival-organizations.md) |
| Recruit and develop persistent people | [People development](people-development-recruitment.md) |
| Record plans, promotion choices, prizes and next seasons | [Multi-season progression](multi-season-progression.md) |
| Conserve materials, track part life and model funding pressure | [Operational depth](operational-depth.md) |
| Share parent-business capacity and preserve academy/succession history | [Group and dynasty](group-era-dynasty.md) |

## Content and verification

The bundled default is [`config/campaigns/team-principal.json`](../../../config/campaigns/team-principal.json).
The [content reference](../content/README.md) describes strict authoring and version
compatibility. Selected campaign content and effective runtime inputs are frozen
in `CampaignManagement` v2; later departure/settlement uses that closure.

Campaign domain fixtures are executed by registered `weekend_launch_tests`, via
[`CampaignStateContracts`](../../../tests/support/campaign_state_contracts.gd).
`game_flow_coherence_ui_tests` covers native campaign entry and the compact desk;
`toolbox_campaign_tests` and `balance_campaign_presentation_tests` cover their
respective scripting and balance/presentation boundaries. Use the
[verification guide](../../how-to/verification.md) and actual registry for complete
execution. Coverage descriptions are not claims of a fresh verification run or
human balance/usability validation.

[Reference index](../README.md) · [Documentation home](../../README.md).
