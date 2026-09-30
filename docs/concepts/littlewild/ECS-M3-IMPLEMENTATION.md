# ECS M3 — world resources and physical logistics

## Goal

Move the authoritative mutation of deposits, worksite inventories, production jobs, and carrier transfers into deterministic ECS systems while preserving the current v8/v9 save shape, authored content schemas, task-selection policy, economy rules, rewards, and presentation.

## Scope

M3 introduces explicit world-facing components and systems for:

- finite resource deposits and harvesting claims;
- worksite input/output inventories;
- production-job progress and exactly-once completion;
- carrier cargo, pickup, movement hand-off, and delivery;
- deterministic contention between multiple actors;
- conservation checks across source, cargo, destination, and consumed inputs.

The existing domain facade remains responsible for command authorization, task selection, recipe choice, progression, rewards, journaling, and UI-facing notifications. Those boundaries move in M4.

## Component ownership

| Component | Authoritative data | M3 owner |
|---|---|---|
| `ResourceDeposit` | resource kind, remaining quantity, stable source ID | resource systems |
| `Inventory` | bounded item quantities on actors and world entities | transfer systems |
| `Worksite` | stable worksite ID, accepted inputs, buffered outputs | production systems |
| `ProductionJob` | recipe/input reservation, elapsed work, completion token | production systems |
| `CarrierTask` | source, destination, item, requested and carried quantities | logistics systems |
| `Transform` / `Task` / `Intent` | actor location and activity lifecycle | M2 activity systems |

Definitions such as recipes and item metadata remain immutable resources, not entities.

## Required invariants

1. **Conservation:** every successful transfer has an equal source decrement and destination increment; production consumes declared inputs once and emits declared outputs once.
2. **Exactly once:** a completed task or production job cannot complete again when stepped, resumed, imported, or observed by another facade layer.
3. **No negative quantities:** deposits, inventories, reservations, and cargo never become negative.
4. **Stable identity:** sources, worksites, jobs, and carriers use stable IDs rather than array position.
5. **Deterministic conflict order:** equal-tick claims are resolved by scheduler order and stable entity ID.
6. **Atomic failure:** blocked capacity, missing inputs, stale source IDs, and invalid destinations leave all authoritative quantities unchanged.
7. **Compatibility:** exports retain the existing serialized world and actor records; transient ECS components are reconstructed on import.

## Verification gates

- focused unit tests for deposits, inventory capacity, atomic pickup/delivery, and production completion;
- multi-actor contention tests proving deterministic allocation;
- conservation ledgers before and after harvest, transfer, production, save, and resume;
- real-engine integration tests using the existing colony facade;
- complete `verify-v15.py` gate and deterministic standalone rebuild;
- no content-library schema changes and no M4 economy/reward migration.

## Completion definition

M3 is complete when world-resource and physical-logistics mutations are executed through named ECS systems, the legacy facade delegates rather than duplicates those mutations, all conservation and exactly-once fixtures pass, and the rebuilt standalone artifact is committed with verification evidence.
