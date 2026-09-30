# ECS M3 — world resources and physical logistics

## Status

**Complete.** M3 moved the authoritative physical mutation of deposits, carrier inventories, worksite buffers, production reservations, job progress, and output settlement into deterministic ECS systems. The legacy facade still owns command authorization, task selection, recipe choice, skill checks, rewards, journaling, and presentation; those policy and economy boundaries remain scheduled for M4.

## Implemented scope

- finite and infinite resource deposits are bound as `ResourceDeposit` components;
- actor and worksite inventories are bound as `Inventory` components;
- buildings are bound as `Worksite` components with a live `ProductionJob` component;
- carrier pickups and deliveries execute as stable-ID `CarrierTask` entities;
- harvesting executes as `HarvestTask` entities;
- paid work uses named reserve, progress/claim/release, and settlement systems;
- simultaneous transfer requests are sorted by transaction ID before settlement;
- ECS records bind by reference to the existing v8/v9-compatible save model and are never serialized.

## Deterministic systems

| Order | System | Responsibility |
|---:|---|---|
| 10 | `inventory-transfer` | atomic source-to-destination ownership transfer |
| 20 | `resource-harvest` | finite depletion or infinite-source collection |
| 30 | `production-reserve` | exactly-once input/substrate reservation and job creation |
| 40 | `production-job-update` | progress, worker claim, interruption, and takeover |
| 50 | `production-settlement` | failed-attempt retention or exactly-once output emission |

## Preserved boundaries

The existing domain facade continues to decide whether an action is allowed, where an actor should work, which recipe or source should be selected, whether a skill roll succeeds, and which metrics, XP, memories, orders, messages, or UI events follow. M3 changes ownership of physical state mutation, not gameplay policy or randomness.

## Invariants

1. Every transfer applies an equal source decrement and destination increment.
2. Production consumes declared inputs and finite substrate once per paid job.
3. Failed attempts retain reserved inputs and reset only the attempt progress.
4. Completion emits output and clears the paid job once.
5. Quantities never become negative and blocked requests are atomic.
6. Equal-tick carrier contention resolves by stable transaction ID.
7. Save documents retain the existing state shape; ECS bindings are reconstructed after import.

## Verification

M3 adds eleven isolated world-ECS checks and six real-engine integration checks. Existing v8 logistics tests remain the compatibility authority for finite deposits, concurrent deliveries, output contention, paid batches, interruption/resume, substrate charging, save continuation, and long-running multi-creature logistics.
