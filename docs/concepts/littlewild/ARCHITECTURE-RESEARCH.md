# Littlewild ECS, data-driven architecture and game-pattern research

Research date: 2026-10-03. Reviewed first quality checkpoint `0a82de68d0505542f524033cd087c03d5b843fcc` and its unchanged authored inputs. Two independent research agents inspected official and author-maintained primary sources through the GitHub connector. References are pinned to the revisions actually read. This is targeted primary-source research and implementation review, not a claim of exhaustive web search or comparative engine benchmarks.

The actionable findings and acceptance criteria are in [RESEARCH-IMPROVEMENT-PLAN.md](RESEARCH-IMPROVEMENT-PLAN.md), dispatched to a separate polishing agent. A parallel creature-asset improvement makes definitions, selection and visuals authorable under one assets tree. The final verification record distinguishes tested contracts from remaining compatibility boundaries and human/device validation.

## Shared conclusions

- Preserve one authoritative persistent model. ECS records are transient behavior projections bound to that model; introducing a second save model creates reconciliation work.
- Keep explicit update order and structural visibility. Deferred ECS commands do not provide rollback of domain values. Transactions need complete preflight and a defined commit boundary.
- Treat content previews as reviewed capabilities bound to exact data and revisions. Display metadata cannot authorize a mechanical change.
- Keep executable systems trusted and compiled while exposing validated data for creatures, tuning and visuals. Data-driven authoring does not require arbitrary executable plugins.
- Define initialization, disposal and stale-reference ownership before adding caches, relationship graphs or parallel scheduling.
- Profile representative workloads before changing storage layouts. ECS composition, cache-local storage and multi-threaded execution are separate decisions.
- Compare runtime and canonical schema acceptance at Unicode and boundary cases; structural validation complements semantic invariants.

## ECS research and review

# Littlewild ECS research and architecture review

Reviewed 2026-10-03 against worktree `/workspace/littlewild-pr25`, HEAD `0a82de68d0505542f524033cd087c03d5b843fcc`. Read-only review; no repository files edited. Read root `AGENTS.md`, `docs/architecture-refactor.md`, Littlewild M6 implementation, ECS core, composition/root, actor/economy/world runtimes, simulation pipeline and their contract tests. The parent task's complete gate is separate evidence; this note reports only the custom reproductions described below.

## Decision

Keep the current lightweight ECS and compiled, versioned simulation profile. It is a useful behavior-composition architecture for this colony simulation. It is not a data-locality optimization equivalent to a Flecs/Bevy archetype store or EnTT sparse-set implementation: its stores are JavaScript Maps holding existing nested records by reference. That distinction should govern performance claims and future work.

Prioritize three narrow correctness improvements: fail closed on partial instance initialization, make simulation ID ordering independent of host locale, and reject unwritable world-transaction targets before any resource debit. Then document and measure ECS binding/receipt lifetimes. Do not change actor-major update order, saved records, or RNG draw order to imitate another engine.

## Verified official primary sources

Research used connected GitHub file/API tools, not general web search. Direct Python HTTPS access to GitHub was blocked by the environment proxy (403); the GitHub connector supplied the sources. URLs below are commit-pinned to the revisions actually inspected; line references indicate relevant passages, not claims that the entire engines were audited.

| Source | Verified content and implication |
|---|---|
| [Flecs design](https://github.com/SanderMertens/flecs/blob/9e874bca2c05b60612cf5b671988adefc0785820/docs/DesignWithFlecs.md#L24) | Lines 24–41 recommend atomic components for reuse/data access, describe the cost of many small components, and explicitly allow complex component structures. Component count is a tradeoff, not a purity score. Lines 93–115 describe a system as query + function + ordering and allow manually running queries/systems inside an existing engine. |
| [Flecs entity lifecycle](https://github.com/SanderMertens/flecs/blob/9e874bca2c05b60612cf5b671988adefc0785820/docs/EntitiesComponents.md#L95) | Lines 95–99 explain ID recycling with a version in upper bits so stale handles can be distinguished from replacement entities. |
| [Flecs systems and pipelines](https://github.com/SanderMertens/flecs/blob/9e874bca2c05b60612cf5b671988adefc0785820/docs/Systems.md#L669) | Lines 669–675 explain deterministic pipeline order and command-buffer synchronization. Lines 1105–1110 explain that command visibility requires a merge point and write annotations because a scheduler cannot inspect arbitrary function internals. |
| [Flecs query caching](https://github.com/SanderMertens/flecs/blob/9e874bca2c05b60612cf5b671988adefc0785820/docs/Queries.md#L51) | Lines 51–89 explain archetype matching, caching matching tables, cache initialization/RAM/maintenance costs, and the recurring-query versus ad-hoc-query tradeoff. This cannot be copied literally to Littlewild's per-entity Map scan. |
| [Flecs cleanup traits](https://github.com/SanderMertens/flecs/blob/9e874bca2c05b60612cf5b671988adefc0785820/docs/ComponentTraits.md#L130) | Lines 130–131 require no dangling ECS relationship references. Lines 267–284 define Remove/Delete/Panic actions and OnDelete/OnDeleteTarget conditions. Explicit domain foreign-key lifecycle is the transferable idea. |
| [Flecs relationships and performance](https://github.com/SanderMertens/flecs/blob/9e874bca2c05b60612cf5b671988adefc0785820/docs/Relationships.md#L1881) | Lines 1881–1884 explain that relationship targets can cause table creation/cleanup, which costs more than entity creation/deletion. A generic relationship system is not free. |
| [Bevy entity lifecycle](https://github.com/bevyengine/bevy/blob/ad678262ce53b5d142fe49ee5e08caff6f00ab60/crates/bevy_ecs/src/entity/mod.rs#L18) | The module docs distinguish allocation, spawn, despawn and free; freeing bumps generation. Saved domain identity and runtime entity handles have different lifetime concerns. File blob inspected: `ad1960a686d8f7a540c03864721abf5f955a1e2d`. |
| [Bevy commands](https://github.com/bevyengine/bevy/blob/ad678262ce53b5d142fe49ee5e08caff6f00ab60/crates/bevy_ecs/src/system/commands/mod.rs#L42) | Lines 42–62 document deferred commands applied in sequence at ApplyDeferred. Lines 90–101 explain command error handling. Deferred execution does not establish rollback of arbitrary domain mutations. |
| [Bevy scheduling](https://github.com/bevyengine/bevy/blob/ad678262ce53b5d142fe49ee5e08caff6f00ab60/crates/bevy_ecs/src/schedule/config.rs#L364) | before/after include visibility of deferred effects; ignore_deferred variants do not. Lines 389–401 warn that references to unscheduled systems or other schedules do not give the desired ordering. Dependencies and commit barriers are separate contracts. |
| [Bevy QueryState](https://github.com/bevyengine/bevy/blob/ad678262ce53b5d142fe49ee5e08caff6f00ab60/crates/bevy_ecs/src/query/state.rs#L56) | Lines 56–64 document cached matching table/archetype metadata and fetch state. |
| [EnTT registry lifecycle](https://github.com/skypjack/entt/blob/e0f4c3763967db04f116863a0ec5e35110808a26/docs/md/entity.md#L154) | Lines 154–211 document IDs with versions, destruction removing components, reuse incrementing versions, and valid/current checks. |
| [EnTT iteration order](https://github.com/skypjack/entt/blob/e0f4c3763967db04f116863a0ec5e35110808a26/docs/md/entity.md#L1899) | Lines 1899–1925 explain iteration driven by the smallest component pool, with use<T> enforcing a particular leading pool. Fast iteration is not automatically canonical gameplay ordering. |
| [EnTT group constraints](https://github.com/skypjack/entt/blob/e0f4c3763967db04f116863a0ec5e35110808a26/docs/md/entity.md#L2295) | More performance imposes constraints: mutations of group-owned pools can invalidate external iterators. Littlewild's conservative structural guard is a legitimate simpler choice. |

## What the actual implementation gets right

- `ecs.ts` is domain-only; `World.set` rejects behavior, accessors, symbols, invalid numbers, cycles and sparse/decorated arrays. Entity membership and component-store getters return copied collection containers. Mutable component references are deliberate domain authority, not immutable UI read models.
- `World.flush` preflights deferred entity membership and component data before applying structural commands. `Scheduler.step` prevents reentrancy/structural mutation while updating and discards deferred requests on system exceptions. The top-of-file comment correctly assigns component-value rollback to domain transactions.
- `engine-composition.ts` uses explicit registered layer order and preserves facade identity rather than repeatedly replacing `LW.Engine`. Finalization restores prior facade/prototype/factory descriptors if definition/factory installation fails. Existing tests already cover these rollback paths; do not report them as missing.
- Actor ECS binds the authoritative native actor records by reference and tracks binding identity, avoiding duplicate serialized state. Actor `sync` removes absent entities and its marker/binding maps; `forget` explicitly cleans them. `Activity` records are reused across ticks.
- Economy settlement already has a domain snapshot/restore boundary around its scheduler, returns a presentation-neutral outbox, and marks completion only in the final post system. Chapter duplicate checks also survive reconstruction through persisted completedQuests.
- World transactions own inventory transfer, harvesting, job reservation/update/settlement, validate physical resource invariants, and destroy temporary transaction entities in finally blocks. Current tests cover staging rejection, overflow and contention order. Those are valuable real boundaries even though the public mutation edge below remains.
- `simulation-pipeline.ts` intentionally runs actors in the saved `engine.creatures` order. That actor-major sequence preserves domain/RNG compatibility and is different from a whole-world system-major scheduler. Converting to bulk ECS ticks would be a game-model change requiring equivalence evidence.
- M6 freezes and fingerprints an engine-captured profile, validates known compiled order independently of schemas, and stages profile/library/state activation atomically. Imported JSON chooses validated rules/data, not executable systems. That is the appropriate trust and reproducibility boundary for this game.

## Confirmed findings

### P2 — Failed instance initialization is silently accepted on retry

Location: `source/engine-composition.ts:130–137`. `instances.add(instance)` happens before boundary validation, initialize hooks, and composition metadata installation. If a hook throws, `initialize` later returns immediately because the instance is already in the WeakSet, even though it has only some initialized fields and no composition metadata.

Reproduction: transpile the actual source with the installed TypeScript compiler, evaluate it in a VM with an isolated facade, register one initializer that sets `instance.partial=true` then throws, finalize, initialize an explicit `{s:{}}` instance, catch, and call initialize again. Observed: first call throws `hook failed`; second returns; initializer calls=1; partial=true; composition metadata=false. This confirms the parent's independently identified defect. Normal failed constructors commonly discard the object; risk is callers or hooks retaining/reusing the partially initialized instance.

Recommended implementation: validate boundary/options before lifecycle state is recorded; use WeakMap lifecycle states such as initializing/ready/failed. Ready reinitialization is idempotent; reentrant or failed reuse throws. Mark ready only after hooks and metadata succeed. A failed hook should poison that instance rather than claim arbitrary hook side effects were rolled back. A fresh construction remains retryable. If intentional in-place retry is needed, require a documented reversible/staged initializer contract first.

Acceptance tests: throw in first and later initializer; fail metadata installation (nonextensible instance); reentrant initializer calls initialize; repeated successful initialize; fresh instance after failure; invalid options do not mark instance initialized. Preserve reverse prepare/forward initialize and historical construction boundaries.

### P2 — Accepted unwritable world records can lose resources on failure

Location: `source/world-ecs.ts:15–18`, `38–46`, `159–173`. Validation accepts a frozen plain object as an inventory because it checks values/prototype but not writable descriptors or extensibility. Transfer debits the source before writing the destination. If destination assignment throws, cleanup removes the temporary transaction entity but there is no domain resource rollback.

Executed reproduction against actual source (ECS and world runtime compiled into the same VM realm): source `{wood:5}`, destination `Object.freeze({wood:1})`, requested=2, destinationLimit=2. Observed error `Cannot assign to read only property 'wood'`; source became `{wood:3}`, destination stayed `{wood:1}`, hasSettled=false. The API accepted the data and then lost two resources on rejection.

Batch reproduction: source `{wood:5}`, first destination `{}`, second `Object.freeze({wood:0})`, two sorted transfers of 1 each. Observed stock `{wood:3}`, first destination `{wood:1}`, second `{wood:0}`, first transaction receipt=true, batch throws. This demonstrates both partial batch commit and a failed transaction losing one unit. Ordinary imported native records are mutable; this is a demonstrated public runtime contract defect, not evidence of normal player saves producing frozen inventories.

Recommended narrow change: preflight all authoritative write targets for the fields that will change, including existing nonwritable properties and missing properties on nonextensible records, before any resource mutation. Apply the same check to finite deposit stock, production job/storage/count fields and production outputs. Document whether transfers() is per-transaction atomic or whole-batch atomic. If whole-batch atomic is intended, use a detached plan over shared projected balances plus a nonthrowing commit to accepted mutable records, or snapshot/restore all touched values AND newly added keys AND receipt state. Do not add a generic scheduler rollback; it cannot know every aliased domain record or external effect. Rejecting unwritable targets before mutation is the smallest fix for this concrete defect.

Acceptance tests: frozen existing output field, nonwritable source, nonextensible destination missing resource, readonly finite stock, readonly job/count fields, failure in second transfer, unchanged resource total and duplicate markers after rejection, same transaction ID succeeds after correcting its target. Keep all existing conservation/overflow tests.

### P2 — Simulation tie-breaking depends on host locale

Locations: `source/ecs.ts:230–231`, `source/world-ecs.ts:165`; also composition registration tie-breaks and other domain sorts should be inspected consistently. IDs allow uppercase/lowercase ASCII. `localeCompare` defaults to the runtime locale/ICU collation, while `World.query` uses JavaScript's code-unit `.sort()`.

Executed Node check: `'I'.localeCompare('i','en')`=1, `'I'.localeCompare('i','tr')`=-1. Both are legal identities. Contending transfers sorted by those IDs can therefore choose a different first claimant under supported locale rules. The current built-in system orders are distinct, so system tie-breaks do not currently exercise this edge; public world batch contention does. This is separate from Unicode text limits and should not be conflated with them.

Recommended change: use one documented locale-independent comparator `(a<b ? -1 : a>b ? 1 : 0)` for simulation identities. Preserve locale-aware ordering only for player-facing alphabetical lists. Review the before/after contention winner for mixed-case/punctuation IDs because changing ordering is observable for that edge; do not silently change saved actor-major order.

Acceptance tests: shuffled batch insertion, mixed case (`I`,`i`), punctuation allowed by identity grammar, equal priorities, and English/Turkish collator environments; exact final state and claimant order must agree. Existing a/z fixtures are insufficient to exercise this property.

## Architecture improvements with evidence thresholds

### Make ownership, query access and visibility inspectable

Flecs access annotations and Bevy explicit order/deferred boundaries show why query membership alone is not a dependency declaration. Littlewild's systems query the transaction entity but read/write shared entities and native records by reference. Add lightweight development metadata for component read/write sets and structural intents to known system descriptors, or document those sets adjacent to registration. Use it to generate a useful schedule/authority report and construction assertions. Keep compiled explicit phase/order; no dependency graph or automatic parallel scheduling is required.

Document the current barrier: component value writes are visible immediately to later systems; structural requests become visible after the complete Scheduler.step, including post. A system that defers Task cannot expect a later same-step query to observe Task. First add a test confirming the chosen behavior. Add an explicit barrier only when a real mechanic requires same-tick structural visibility; adding automatic flushes can change game semantics and RNG order.

### Define binding and receipt lifetimes before cache eviction

Actor ECS has sync/forget; world/economy runtime component bindings retain source inventory/worksite/actor records by reference and have no comparable removal sync. World/economy completed-ID Sets grow for the life of their runtime. World forget(id) removes a receipt only, not the bound entity. Recreating a runtime clears transient receipts; only persisted domain facts (e.g. completed chapter/job state) can protect cross-save duplicates. Neither bounded RAM nor durable exactly-once delivery follows from the transient Sets.

Add an explicit engine-owned lifecycle operation for removed actors/worksites/deposits and replacement state, and a small diagnostic exposing entity/receipt counts. Prove monotonic saved transaction tokens or completed domain markers before retiring receipts; arbitrary LRU eviction would permit replayed transactions to pay twice. Test create/remove/replace loops, stale task/job references, save/reload duplicate handling where the domain claims it, and GC-friendly release of old native records. Quantify counts during long deterministic runs first. Current code demonstrates retention, but this review did not measure a player-visible memory leak.

The engine examples' generational IDs teach stale-reference handling, not that Littlewild must rewrite saved string IDs. Keep native IDs stable and non-reused; if reuse becomes necessary, add a generation to transient handles or tombstone validation at the reference owner. Record explicit target deletion policies for task.worksiteId, task.jobId, workerId, and inventory/deposit bindings. Prefer domain-specific cancel/release/reassign behavior over implementing a general Flecs pair graph without a query need.

### Measure before changing storage

`World.query` scans every entity, checks component membership and sorts matches for each untargeted system. `world.entities` creates a Set copy, and runtime binding helpers call it to test existence. Most actor/economy/world single operations use entityId-targeted scheduler steps, so they bypass the whole-world query. A blanket query cache might optimize a path that is not dominant.

Benchmark actor-major ticks and contested world batches at representative supported colony sizes; measure query scans/sorts, copied Sets, binding validation, economy snapshots and retained receipts. Use exact-source CPU/heap/allocation evidence. A low-risk first optimization is a direct `World.exists(id)` or `has(id)` membership operation instead of copying entities for every membership check, if profiles show it matters. Next consider driving queries from the smallest included store (EnTT's principle) while retaining canonical sorted ID results. A cache needs structural revisions and invalidation at flush; Flecs/Bevy cache stable archetypes, while Littlewild would cache a more frequently changing entity set. Do not advertise native CPU cache/vectorization benefits for nested JS Map values.

## Suggested delivery order

1. Commit lifecycle fail-closed state with focused adversarial composition tests; no save/profile version change.
2. Commit locale-independent simulation identity comparator with mixed-case contention and shuffled-input checks; review observable winner changes at the edge.
3. Commit authoritative mutation-target preflight and explicit batch atomicity documentation/tests; preserve existing native record identities and resource arithmetic.
4. Commit schedule/ownership/barrier documentation and lifecycle diagnostics; add removal ownership only to demonstrated removal paths.
5. Run representative deterministic longevity/performance workloads; optimize only measured bottlenecks while retaining export equivalence, actor/RNG order and all registered gates.

The existing M6 profile/schema and composition foundation makes this sequence feasible without a wholesale ECS rewrite. Each change should pass the Littlewild strict/typecheck, architecture and complete registered verification suite. Native state v8 and current story-envelope/profile contracts remain required; obsolete imported formats stay rejected. No claims about complete gate success, browser performance, user playtesting or deployment are made by this research note.


## Game-pattern and data-boundary research

# Littlewild: game-pattern research and concrete boundary review

Read-only review of `/workspace/littlewild-pr25/docs/concepts/littlewild` at repository commit `0a82de68d0505542f524033cd087c03d5b843fcc`, 2026-10-03. Read repository AGENTS.md, architecture-refactor.md, and Littlewild ECS/configuration/asset architecture. No authored source changes. Primary references were retrieved with the connected GitHub fetch tool, then ref-pinned and compared; this is targeted primary-source research, not a claim of general web search. Local probes executed against the existing `.generated` runtime; these are focused reproductions, not a full verification-gate result.

## Research synthesis

1. **Fixed updates, flexible rendering, explicit overload policy.** Bob Nystrom's [Game Loop](https://github.com/munificent/game-programming-patterns/blob/898b1f2e1818c80d7eed5eba98e9903ec13b7771/book/game-loop.markdown) explains why variable update duration complicates stability and reproducibility, and why browser games must participate in the platform's loop. Littlewild's `simulation-clock.ts` already follows this: deterministic `.1` simulation steps, supplied elapsed time, bounded speed/debt, discarded suspension time, and callback-failure debt reset. Preserve these semantics. Equal *accepted simulation steps* and commands are the determinism contract; equal wall time through capped frames is not. Existing `test-storage-clock.cts` covers 30/60 Hz, suspension, invalid input, reset and failure. A jittered-delivery comparison is a useful small extension only if clock behavior changes.

2. **Composition is a response to coupled responsibilities, with real lifecycle costs.** [Component](https://github.com/munificent/game-programming-patterns/blob/898b1f2e1818c80d7eed5eba98e9903ec13b7771/book/component.markdown), especially “When to Use It” and “Keep in Mind,” recommends components for large cross-domain entities while warning about initialization, wiring, indirection and communication complexity. Official Godot [Scene organization](https://github.com/godotengine/godot-docs/blob/a52125d6d0e9eee1fe5e83fea4e496fec313ddf9/tutorials/best_practices/scene_organization.rst) recommends injected dependencies and relationships managed by the owner. Those are transferable ownership principles; Godot Node aggregation is explicitly not equivalent to ECS composition. Littlewild already has a stable facade, explicit six-layer root, reverse prepare / forward initialize, compiled schedules and partial historical construction. Improve lifecycle invariants; do not replace this with another wholesale component framework.

3. **Events should communicate completed facts; queues are justified by time decoupling.** [Event Queue](https://github.com/munificent/game-programming-patterns/blob/898b1f2e1818c80d7eed5eba98e9903ec13b7771/book/event-queue.markdown) says an observer or command is simpler if only sender/receiver decoupling is needed. Delayed events must capture transient facts, and global queues introduce global-state and cycle risks. Littlewild's compiled command router and domain outboxes are a good fit. Preserve synchronous transactions and ordered actor updates; avoid a new global event bus. If presentation consumes delayed events, include the required scalar facts and stable identity when emitted, rather than querying a later mutable entity.

4. **Data-driven authoring needs three boundaries: structural JSON, schema shape, domain semantics.** Official [JSON Schema validation](https://github.com/json-schema-org/json-schema-spec/blob/4f56a9900674b27804f0ec32e3b7fdfa4efad695/specs/jsonschema-validation.md), “Overview,” “Validation Keywords for Strings,” and “Validation Keywords for Objects,” defines structural constraints, required fields, numeric bounds and string length in Unicode code points. Littlewild already rejects duplicate keys, excessive bytes/depth/nodes, non-finite numbers, accessors, sparse arrays and reserved properties; then checks compiled IDs, acquisition cycles and canonical scene state. Preserve separate semantic acceptance. The offline validators intentionally support only the bundled schema vocabulary; add focused differential acceptance cases against Ajv, not arbitrary remote schemas.

5. **Measure before changing storage layout.** [Data Locality](https://github.com/munificent/game-programming-patterns/blob/898b1f2e1818c80d7eed5eba98e9903ec13b7771/book/data-locality.markdown), “When to Use It,” calls for an observed performance problem and evidence of cache misses before restructuring. Official Godot [Data preferences](https://github.com/godotengine/godot-docs/blob/a52125d6d0e9eee1fe5e83fea4e496fec313ddf9/tutorials/best_practices/data_preferences.rst) explains Array/Dictionary/Object tradeoffs specifically for Godot's implementation. Neither reference establishes that JS Maps or plain-object component records need a typed-array rewrite. Littlewild's bound legacy records avoid shadow state and accidental save-format migration. Keep that until profiling establishes a hot path. No universal FPS or cross-platform bitwise equality claim follows from the regression suite.

## Confirmed findings and implementation plan

### P2 — Base content preview metadata can bypass committed-work safeguards

Locations: `source/story-codec.ts:99` (`currentStoryPolicy`), `:106` (trusts `preview.diff.mechanics`), `:124` (uses it to choose reimport versus retaining the engine), `source/content-runtime.ts:255` (`Registry.commit`). Candidate values are frozen, but the preview envelope and its diff are mutable. Registry.commit validates candidate shape/semantics and base revision; it does not bind the object to its reviewed candidate/diff. Story/scenario imports already use object-bound WeakMap reviews, making this inconsistency concrete.

Focused reproduction, from a fresh Node process:

```js
const root='/workspace/littlewild-pr25/docs/concepts/littlewild';
const X=require(root+'/.generated/scenario-runtime.js');
const S=require(root+'/.generated/scenario-story.js');
const C=global.LWContent;
const pack=X.builtins()[0];
const engine=X.commitScene(X.prepareScene(pack,'charted-home'));
const doc=C.registry.export();
doc.components.recipes[0].cost.wood=(doc.components.recipes[0].cost.wood||1)+1;
const preview=C.registry.prepare(doc);
console.log(S.committed(engine), preview.diff.mechanics); // true, 1
console.log(S.currentStoryPolicy(preview,engine).ok); // false
preview.diff.mechanics=0;
console.log(S.currentStoryPolicy(preview,engine).ok); // true
const next=S.applyContent(preview,engine);
console.log(next===engine,C.registry.hash===preview.fingerprint); // true, true
```

Impact is an application API safety/integrity hole for adapters handling mutable previews; the normal UI does not currently edit this diff. Do not label it a remote security exploit. The accepted mechanics changed while an already-committed colony retained its engine.

Fix: at the application boundary validate the object-bound reviewed candidate/base identity and derive an authoritative fresh diff from current registry plus that candidate. Use the same checked result for policy, compatibility reconstruction and commit. Never use caller-authored diff counts for safety decisions. Reuse a Registry-owned WeakMap review contract if implementing it there; do not accept a forged public fingerprint as proof. Freeze or copy review values for display where useful, but freezing alone is insufficient if callers can replace candidate/diff fields or forge envelopes. Preserve current non-mechanical engine identity behavior and new-story application. Do not silently apply a different candidate from the one reviewed.

Regression home: extend `test-content-boundary.cts` or an existing registered domain suite with real story/content application. Test edited `diff.mechanics`, swapped candidate, forged/copied envelope, updated public fingerprint, stale base, and valid presentation/mechanics/new-story cases. Rejections must preserve canonical engine state and all four registries/profiles. Original mechanical preview must remain blocked on charted-home committed work; valid presentation-only previews should still return the existing engine.

### P2 — Offline text bounds disagree with published JSON Schema

Locations: `source/scenario-shape.ts:76` (UTF-16 `v.length`), `source/simulation-profile.ts:138` / `:139` (UTF-16 name/description length). Contrast `content-runtime.ts` shape validation, which already uses `[...v].length`. JSON Schema uses Unicode code points, not UTF-16 code units or grapheme clusters.

Reproduction:

```js
const root='/workspace/littlewild-pr25/docs/concepts/littlewild';
const shape=require(root+'/.generated/scenario-shape.js');
const Ajv=require(root+'/node_modules/ajv/dist/2020').default;
const schema=require(root+'/source/content/scenario.schema.json');
const pack=require(root+'/.generated/scenario-runtime.js').builtins()[0];
pack.name='😀'.repeat(80);
console.log(new Ajv({strict:true}).compile(schema)(pack)); // true
console.log(shape(pack,schema).filter(e=>e.startsWith('/name'))); // /name: invalid text
```

Fix: measure code points consistently for schema minLength/maxLength and profile label limits. Retain byte limits, prohibited-character patterns, trim/nonempty semantic checks and bounded JSON traversal. A tiny local helper is sufficient; do not add a Unicode normalization policy or change schemas/save versions.

Regression home: `verification/schema-checks.ts` for Ajv/runtime shape parity; `test-simulation-profile.cts` for profile identity bounds. Cases: BMP and astral text at max and max+1, description limits, empty/whitespace labels, mixed scripts, combining marks (code-point count), and markup/control rejection. Compare structural shape acceptance separately from full semantic validation so intentional semantic-only rules are not mislabeled as schema bugs.

### P3 — Failed initialize is silently treated as completed

Location: `source/engine-composition.ts:130`. `instances.add(instance)` runs before boundary calculation and initialize hooks. Any failure leaves the instance in the successful-instance WeakSet. A later initialize call returns without finishing or publishing composition metadata.

Reproduction using the existing generated engine-composition in an isolated VM: register one initialize hook that increments a counter then throws; finalize; call initialize on a manually constructed facade instance; switch the hook's injected failure off and call initialize again. Observed `calls=1` and `instance.composition===undefined` after the second call.

Most normal constructors abandon a thrown instance, so this is lower priority than the first two. Do not promise rollback of arbitrary initialization side effects. Fix with explicit initializing/completed/failed lifecycle states: publish completed only after all hooks and metadata succeed, guard reentrancy, and either fail subsequent calls explicitly for a failed instance (safest bounded contract) or support retry only if hooks have a defined rollback/idempotency contract. Fresh instance construction after failure should work. Simply moving WeakSet.add to the end can cause recursive initialize and replay already-applied hooks.

Regression home: `test-engine-composition.cts`, using its existing `isolatedComposition()` fixture. Cover initialize hook failure, boundary failure before hooks, recursive initialize, repeated successful initialize (once), fresh construction after an injected failure, unchanged prepare order and historical partial-boundary imports.

## Verified strengths and constraints to preserve

- `simulation-profile.ts` strictly validates data-only tuning and exact compiled archetype arrays; an existing engine captures an immutable actor/economy profile. `test-simulation-profile-integration.cts` tests custom tuning and deterministic save continuation.
- `scenario-runtime.ts` stages all libraries/profile/world synchronously; launches reconstruct a fresh engine from reviewed pack and scene; transaction failures restore the prior runtime. `scenario-story.ts` layers context/profile integrity and rollback around native story import. Existing tests deliberately inject activation failures and mutate every reviewed story section.
- Asset catalogs are immutable, bundled-only declarations and do not accept scenario-registered executable animation programs. Preserve rig/socket/material validation and static runtime handler ownership.
- Process-global world/library registries remain explicitly documented compatibility debt. Existing world grids intentionally invalidate when the global world profile changes; this is a single-active-context boundary, not proof that simultaneous detached engines own independent terrain or content. Do not conflate immutable actor/economy profile capture with complete engine isolation. A future multi-world feature should inject context incrementally and add alternating-world regression; this request does not justify that migration.
- The registered gate verifies named individual evidence, summary consistency, source identity and bundle identity, with browser omissions labeled partial. Retain it, the native-v8 state contract, envelope-10 policy, strict TypeScript checks and independent Ajv schema checks. Do not replace deterministic regression with screenshot checks.

## Scoped delivery and acceptance

Dispatch a separate polishing/implementation agent for these three boundaries. Read AGENTS.md first. Maintain cohesive files and established line budgets; no broad formatting, new framework, save-version migration, physics recalibration, RNG/order change, or schema expansion. Use normal source edits and regenerate `.generated`/standalone via the existing build. Focused suite checks establish the failure cases; the complete `npm run verify` gate including browsers, `npm run typecheck`, architecture policy and unchanged characterization traces establish final integrated acceptance. Report exact source identity and unavailable checks separately. Other independent review findings (Date call guard bypass and build symlink output) should be integrated by the root reviewer; they were not analyzed in this research.
