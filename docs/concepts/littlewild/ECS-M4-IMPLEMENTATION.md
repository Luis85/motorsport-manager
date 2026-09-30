# ECS M4 — economy, quests, and progression

## Status

**Implemented.** M4 establishes one deterministic, atomic settlement boundary for financial and progression state while preserving the existing v8 simulation state, v9 portable-story envelope, content-library schemas, command semantics, and presentation behavior.

## Ownership

### Economy ECS

`source/economy-ecs.js` owns mutation of:

- guide and actor coin balances;
- shared research points;
- player and actor XP and levels;
- actor bond and RPG capability points granted on level-up;
- current and lifetime-earned prestige;
- selected numeric progression statistics;
- persistent chapter-completion identifiers.

The service binds components by reference to the existing state records. It validates the complete settlement before mutation, applies systems in a fixed order, rolls back every touched record on failure, and returns a neutral outbox describing level and balance changes.

### Domain facade

The existing engine layers continue to own:

- command authorization and feature gates;
- reward selection and domain meaning;
- physical inventory, market stock, buildings, islands, and topology;
- quest and market histories;
- ledgers, memories, logs, narration, and presentation events;
- deterministic gameplay randomness and skill checks.

This keeps commands distinct from systems and prevents the ECS from becoming an application-service or UI layer.

## Deterministic settlement order

| Order | System | Responsibility |
|---:|---|---|
| 10 | `settlement-plan` | validate and expose the approved immutable plan |
| 20 | `wallet-settlement` | apply guide and actor balance deltas atomically |
| 30 | `shared-research-settlement` | apply shared research delta |
| 40 | `xp-progression` | award XP, process deterministic level loops, and grant configured bonuses |
| 50 | `prestige-settlement` | update current and lifetime-earned prestige |
| 60 | `stat-settlement` | apply bounded numeric statistics |
| 70 | `chapter-settlement` | persist exactly-once chapter completion |
| 80 | `settlement-outbox` | produce presentation-neutral settlement facts |

## Migrated paths

- chapter claims and wish/research rewards;
- lessons, specialization, and field-study costs/rewards;
- companion purchases and warehouse sales;
- adventure return rewards, including prestige;
- Growth research and prestige purchases;
- island purchases;
- market sale proceeds and XP;
- trade purchases/sales and shared-income splitting;
- all player/actor XP helper paths.

Market and quest code settles financial/progression results before consuming physical goods or recording histories. A rejected settlement therefore cannot leave inventory and balances out of sync.

## Compatibility

- No serialized ECS cache or duplicate balance tree is added.
- Existing `player`, creature, `rp`, `progression`, `stats`, and `completedQuests` records remain authoritative.
- Runtime duplicate IDs protect one engine instance; chapter IDs remain idempotent after export/import through the existing completion record.
- Littlewild and Emberworks continue to use the same compiled mechanics and content schemas.
