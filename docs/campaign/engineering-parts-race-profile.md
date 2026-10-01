# Engineering pipeline, physical parts and race performance profile

Status: TM-07 campaign foundation on PR #27.

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

The first slice does not yet consume raw-material stock or model manufacturing scrap. The explicit material commitment is the current authoritative cost boundary.

## Race-performance seam

Installed parts are projected into `RacePerformanceProfile`, a versioned per-car set of bounded basis-point multipliers for:

- top-speed capability;
- lateral capability;
- acceleration capability; and
- braking capability.

The supported delta range is intentionally small and bounded. Multiple installed parts compose additively inside that limit, and their physical part IDs remain in the frozen source list.

The profile is a **race input**, not a result bonus. A new native checkpoint schema v12 freezes one profile for every entrant. Existing v10 and v11 race/replay data remain readable under their original model identity and receive baseline performance rather than invented campaign parts.

Runtime effects are applied only where the existing simulation already has a corresponding vehicle capability seam:

- acceleration and braking limits use the per-car profile;
- straight/corner speed envelopes consume the profile without changing track geometry;
- the read-only race forecaster uses the same profile directionally.

The racing line, classification, incident history and final result are never rewritten after the fact.

## Campaign-to-race projection

`CampaignEngineeringQuery.race_profiles()` maps stable campaign car IDs onto race-local IDs immediately before weekend construction. The resulting detached array must cover every entrant exactly once.

The existing `RaceRecord` ruleset includes these frozen profiles, so the immutable campaign weekend manifest's rules hash already covers the installed-part configuration used by the race.

## Checkpoint and migration

Campaign checkpoint schema version 5 adds the engineering projection. Version-4 operations checkpoints migrate with empty engineering authority beginning at the restored campaign slot. Existing generic `development` commitments are retained in an explicit legacy index rather than assigned invented projects. Migration does not invent historical research, designs, parts or fitted performance.

Every existing competition, finance, personnel, operations and weekend transaction must carry engineering forward unchanged unless it explicitly owns an engineering change.

## Explicit exclusions

TM-07 does not yet model:

- engineering uncertainty or failed prototypes;
- accumulated organizational knowledge;
- multiple physical copies of one design;
- raw materials and supplier stock;
- part wear or post-race component diagnosis;
- homologation/regulatory approval;
- repair/rebuild workflows;
- production batches;
- facility construction;
- staff skill effects on quality or duration;
- campaign engineering UI;
- calibrated balance claims.

Those belong to subsequent engineering/inventory and product-UI milestones. TM-07's purpose is to establish traceable, non-magical progression from scarce work capacity to a real fitted object with a tested race-model seam.
