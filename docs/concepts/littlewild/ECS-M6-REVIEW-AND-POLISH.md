# ECS M6 review and polishing pass

## Review scope

This pass reviewed the completed M1–M6 architecture as one system, with emphasis on the new M6 boundaries:

- versioned rule data and compiled composition identity;
- scenario-pack and portable-story migrations;
- engine construction and profile lifetime;
- validation, preview, activation, rollback, and capture;
- content/runtime separation and imported-JSON safety;
- deterministic continuation and release evidence;
- publication workflow behavior on PR25.

The review used the M5 compatibility baseline, both bundled scenario packs, retained v5/v6/v8/v9 fixtures, the standalone build, browser contracts, and the complete verification gate.

## Findings and resolutions

### 1. Publication was verified but not delivered

The first M6 publication run reconstructed the checksum-pinned patch and passed all 987 checks, but GitHub rejected its final push because the workflow attempted to restore its own workflow file without `workflows` permission. Only the temporary publisher commit reached the branch.

**Resolution:** fast-forward the branch to the already-created verified M6 commit object, restore the read-only verifier, and keep publication mechanics outside the product architecture. The product source was not changed to work around CI permissions.

### 2. Rule data and runtime topology needed one explicit contract

The first M6 draft validated actor and economy rules, but represented the selected rules and component list separately from the compiled engine and scheduler topology. That left the exact engine layers and system order implicit in code.

**Resolution:** `simulation-profile.js` validates one immutable profile containing rule values and the `living-world-v1` compiled archetype. The archetype pins engine layers, the high-level pipeline, actor dynamics/activity, world transactions, and economy transactions. JSON can tune approved numeric data but cannot add, remove, rename, or reorder behavior.

### 3. Migrations belonged outside the scenario runtime

Pack and experience migrations were embedded in `scenario-runtime.js`, mixing schema evolution with validation, preview, and launch orchestration.

**Resolution:** `scenario-migrations.js` now owns schema-1→2 pack migration and context-1→2 migration. Inputs are copied, ambiguous legacy declarations fail closed, unsupported versions are rejected explicitly, and migration notes remain visible through CLI and UI review.

### 4. Simulation identity needed an independent review guard

Envelope 10 originally protected the complete experience with one deterministic fingerprint. A simulation change could be detected, but the import UI and commit boundary could not distinguish content/world changes from simulation-profile changes.

**Resolution:** envelope 10 carries both the experience fingerprint and an independent simulation-profile fingerprint. Import previews expose whether the active simulation changes, and commit rejects a stale profile review independently of the rest of the experience.

### 5. Engine profile lifetime needed to be instance-stable

A process-wide selected profile is useful while constructing an engine, but an existing engine must not change when another pack becomes active.

**Resolution:** each engine captures a deeply frozen profile at construction. Actor ECS, economy ECS, and the domain pipeline are created from that captured profile. Activating another scenario updates the process registry for future construction without mutating existing engines.

### 6. Profile activation needed the same rollback boundary as libraries and world data

The first M6 draft applied rule selections directly to prepared engines while library/world commit rollback remained separate.

**Resolution:** scene launch stages Base, Adventure, World, Growth, simulation profile, world profile, and imported state as one reviewed unit. A failed commit restores all registries and profiles. Preview, validation, CLI operations, and capture remain non-mutating.

## Separation-of-concerns result

| Concern | Owner after polishing |
|---|---|
| Entity/component storage and deterministic system scheduling | `ecs.js` and domain ECS modules |
| Numeric actor/economy tuning | Versioned simulation profile data |
| Permitted system topology and order | Compiled `living-world-v1` archetype contract |
| Engine assembly and lifetime | Stable engine facade and composition root |
| Pack/context version upgrades | `scenario-migrations.js` |
| Pack validation, preview, launch, capture | `scenario-runtime.js` |
| Portable save wrapping and stale-review guards | `scenario-story.js` |
| Rendering, camera, DOM, files, and device state | Presentation/application modules |

No imported document can register executable systems, handlers, commands, callbacks, modules, source text, or arbitrary components.

## Verification outcome

The polishing pass adds two focused suites and extends schema, release, and browser coverage:

- simulation-profile unit checks: 15/15;
- real-engine profile integration: 15/15;
- scenario schema and CLI: 47/47;
- release contracts: 58/58;
- browser checks: 89/89;
- browser contracts: 16/16;
- complete gate: **1,006/1,006 across 27 suites**.

The rebuilt standalone artifact is 3,788,823 bytes with SHA-256 `73a1d790ec3ca2c04f57ff4dab16c3c68184b871dd555a7b613c2809861be96c`.

## Remaining deliberate debt

- Content registries remain process-global and support one active experience per document.
- Mature direct facade methods remain compatibility adapters while callers move incrementally to command envelopes.
- Large historical modules remain protected by behavioral fixtures rather than being split mechanically.
- Deterministic fingerprints are stale-review identifiers, not cryptographic signatures or trust proofs.
- Native Godot runtime files are outside this Littlewild concept PR and were not altered by M1–M6.
