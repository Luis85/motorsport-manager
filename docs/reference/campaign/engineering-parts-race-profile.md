# Engineering pipeline, physical parts and race performance profile

Implemented domain/application contract for work-backed engineering, physical parts and frozen race performance inputs. The Director Desk exposes work summaries; a dedicated engineering screen remains future presentation.

This contract introduces the first end-to-end development slice from organizational work to one validated, manufactured and installed physical part. It deliberately reuses TM-05 people, TM-06 operations capacity and TM-04 cash commitments rather than creating parallel staff, machine or cost models.

## Authority split

- `CampaignEngineering` owns projects, validated designs, physical part instances and the gate-to-work-order audit trail.
- `CampaignOperations` remains the only source of dated staff/facility/provider work.
- `CampaignPersonnel` remains the only source of exclusive people reservations.
- `CampaignEconomy` remains the only source of binding and settled cash.
- `RacePerformanceProfile` is a frozen race input derived from installed physical parts. The race simulator consumes it; campaign code does not edit a live `RaceSim`.

Research/project state, design state, physical inventory and installed race configuration are different records. Completing research does not create a design; validating a design does not create a physical part; manufacturing a part does not install it.

## Pipeline

The first bounded pipeline is:

```text
investigation
→ concept
→ detailed_design
→ prototype
→ validation
→ production
→ integration
→ complete
```

Each gate must be bound to one previously scheduled `CampaignOperations` work order with the required facility family:

| Gate | Capacity family |
|---|---|
| Investigation | Design office |
| Concept | Design office |
| Detailed design | Design office |
| Prototype | Preparation workshop |
| Validation | Test / validation |
| Production | Preparation workshop |
| Integration | Preparation workshop |

A gate can advance only when its work order has physically reached the end of its reserved campaign-time interval. The work order is indexed exactly once and remains immutable evidence.

## Designs and physical parts

Successful validation publishes one `CampaignEngineeringDesign` containing the bounded capability delta that was declared when the project began.

Successful production requires that validated design and publishes one unique `CampaignPartInstance`. Production also creates one explicit `development` cash commitment for declared material cost; the project does not hide material cost in a progress percentage.

Successful integration installs that exact instance onto the named stable campaign car. The part keeps:

- project identity;
- design identity;
- production work order;
- production slot;
- condition;
- installed car identity;
- installation slot; and
- integration work order.

The engineering gate uses an explicit material commitment as its authoritative production-cost boundary. TM-15 [operational depth](operational-depth.md) separately adds suppliers, conserved raw-material stock and explicit consumption; production does not infer that consumption or manufacturing scrap from a completed design.

## Race-performance seam

Installed parts are projected into `RacePerformanceProfile`, a versioned per-car set of bounded basis-point multipliers for:

- top-speed capability;
- lateral capability;
- acceleration capability; and
- braking capability.

The supported delta range is intentionally small and bounded. Multiple installed parts compose additively inside that limit, and their physical part IDs remain in the frozen source list.

The profile is a **race input**, not a result bonus. Native checkpoint schema v12 freezes one profile for every entrant. Existing v10 and v11 race/replay data remain readable under their original model identity and receive baseline performance rather than invented campaign parts.

Runtime effects are applied only where the existing simulation already has a corresponding vehicle capability seam:

- acceleration and braking limits use the per-car profile;
- straight/corner speed envelopes consume the profile without changing track geometry;
- the read-only race forecaster uses the same profile directionally.

The racing line, classification, incident history and final result are never rewritten after the fact.

## Campaign-to-race projection

`CampaignEngineeringQuery.race_profiles()` maps stable campaign car IDs onto race-local IDs immediately before weekend construction. The resulting detached array must cover every entrant exactly once.

The existing `RaceRecord` ruleset includes these frozen profiles, so the immutable campaign weekend manifest's rules hash already covers the installed-part configuration used by the race.

## Checkpoint and migration

Campaign checkpoint schema version 5 introduced the engineering projection; current version 6 retains it with management authority. Version-4 operations checkpoints migrate with empty engineering authority beginning at the restored campaign slot. Existing generic `development` commitments are retained in an explicit legacy index rather than assigned invented projects. Migration does not invent historical research, designs, parts or fitted performance.

Every existing competition, finance, personnel, operations and weekend transaction must carry engineering forward unchanged unless it explicitly owns an engineering change.

## Implemented extensions and remaining limits

TM-15 [operational depth](operational-depth.md) adds persistent latent uncertainty/confidence evidence, raw-material procurement/explicit consumption and physical part wear/repair on the same instance. It does not silently reroll observations or diagnose individual components from aggregate race damage.

Failed-prototype simulation, accumulated organizational knowledge, multiple production copies/batches, homologation, facility construction, staff-skill effects on quality/duration and dedicated engineering specialist UI remain separate depth. Calibrated balance is not established by automated profile-effect tests. The engineering authority retains traceable progression from reserved work to a real fitted object through the tested race-model seam.

## Implementation and coverage

Authority and application owners: [engineering.gd](../../../scripts/domain/campaign/engineering.gd), [engineering_transaction.gd](../../../scripts/application/campaign/engineering_transaction.gd), [engineering_query.gd](../../../scripts/application/campaign/engineering_query.gd).

Contract fixtures: [campaign_engineering_contracts.gd](../../../tests/support/campaign_engineering_contracts.gd).

Campaign fixtures run through registered `weekend_launch_tests`, via
`CampaignStateContracts`. The [verification guide](../../how-to/verification.md) defines
complete-suite execution; this reference describes coverage, not a fresh pass.
