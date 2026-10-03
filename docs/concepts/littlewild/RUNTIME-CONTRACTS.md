# Runtime contracts and extension ownership

`source/runtime-contracts.d.ts` owns value-only points, action failures and gameplay
notification payloads. Engine, colony, world and interaction ports borrow these
contracts rather than declaring separate error or event protocols. Rejection text
and legacy return fields remain intact. `LWRuntimeResults.failure` adds a stable
`FailureCode`; command routing annotates older rejected results. Successful results
and Boolean authorities retain their existing values. The factory formats results;
it never decides whether a gameplay action is permitted.

The nineteen existing event names retain their text and append order. Events remain
synchronous method calls and observations on the stable engine facade. In particular,
`village-systems.emit('temper', ...)` grants the configured gameplay care opportunity
before it returns. Its authority does not depend on rendering, draining notifications,
or a delayed event bus. The regression emits a temper event on a headless real engine
and observes the grant immediately.

## Adding an application adapter

`source/application-adapters.ts` is a compiled, closed installation manifest, after
the six existing composition layers finalize. The `living-world-v1` archetype and
simulation phase identities are unchanged. Installation order is commands,
interactions, settings, scenario workflow, scenario resources, construction,
terraform, interiors. Construction precedes interiors so completion retains its
physical construction authority before interior cleanup.

Each entry declares its required global role, new methods, wrapped predecessor
methods, static changes and ordering prerequisites. The installer checks the entire
proposal before invoking a role, rejects missing roles/predecessors, duplicate IDs,
wrong order and repeated installation, then checks actual prototype/static changes
against the declaration. `describe(Engine)` returns frozen installed descriptors
with predecessor owners. Existing adapters still capture actual predecessor functions;
the manifest does not replace their gameplay logic or create another engine.

A failed preflight leaves the facade untouched. A failure during installation marks
that facade unusable for retry: an adapter may already have installed a nonconfigurable
property. Discard that bootstrap and resolve the adapter defect before rebuilding.
Factories and native reconstruction continue to use the same composed facade.

## Adding data or contracts

The domain map references `architecture/data-ownership.json` and
`architecture/contract-ownership.json`; those companions extend its metadata and are
not runtime state owners. Every JSON file below `source/content` and `source/assets`
must match exactly one ownership entry. Entries declare a stable ID, bounded path
pattern, existing context owner, kind, compiled validator role and optional embedded
global. The validator-role table in `tools/architecture-data.cts` names existing
admission authorities. Uploaded JSON cannot supply a validator, module or callback.
Known gameplay handler IDs remain data accepted by their existing closed validators.
Historical regression JSON is excluded by individually named paths and reasons;
a newly added fixture must be explicitly inventoried.

Every project declaration file has an owner. The contract checker follows triple-slash
references, erased imports, import types and resolved semantic type references in
project-owned sources. It ignores dependency declarations and compiler libraries,
and rejects outward project edges. Explicit DOM types belong to presentation ports.
Physical ECS and interior layout records have their own inward declarations;
application engine state and aggregate save validation stay in application ports.
The pure `construction-footprints.ts` projection supplies occupied cells to both
physical grids and application construction policies, so the grid does not depend
on its topology validator. Construction and terraform use the neutral coordinate
contract instead of borrowing a renderer or interior coordinate authority.

`test-architecture-extensions.cts` covers rejected adapter proposals and undeclared
changes, frozen predecessor metadata, data ownership/validator adversaries, executable
payloads, inward type contracts, valid/invalid TypeScript callers, actual facade
reconstruction and synchronous temper grants. The design follows the concrete ownership and extension plan in
`RESEARCH-IMPROVEMENT-PLAN.md`. The normal architecture and strict
compiler gates also run against the complete authored tree.
