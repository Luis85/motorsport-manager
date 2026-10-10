# Armored Platoon development checkpoint

Armored Platoon is an independently versioned `armored` Wildlands game template.
It is an early integrated browser implementation, not a completed recreation or
an M1 fidelity acceptance. The [parity ledger](armored-platoon-parity.md) retains
the full requested scope and remaining gaps. The [dated integration record](../_archive/armored-platoon-2026-10-10-integration.md)
records branch ancestry and verification limits.

## Build and play

From the repository root, with Node.js 22+:

```sh
cd source/wildlands
npm ci
npm run build:cli
npm run build:demos
cd ../..
bin/wildlands validate-game --game docs/concepts/armored-platoon
bin/wildlands build-game --game docs/concepts/armored-platoon --output work/armored-platoon.html
```

Open the generated HTML in a desktop browser with WebGL2. The artifact includes
its code, pinned Three renderer and original Forge geometry and works offline.
Use the in-game controls guide for keyboard/mouse and controller bindings.
Start a mission from the briefing, drive and aim, select ammunition, fire,
switch camera/station, command platoon vehicles, and pause/save/load.
Browser persistence failures are reported; saves are not a durable backup service.

## Authority and units

[Armored contracts](../../source/wildlands/source/armored-contracts.d.ts) define
metres, seconds and kilograms, right-handed +Y up, local +Z forward and radians.
Forge recipes use degrees, converted at the boundary. The existing
[Wildlands ECS](../../source/wildlands/source/ecs.ts) owns plain component storage
and ordered systems. The armored application advances fixed 1/60 second ticks;
queries and render calls do not advance time. RTS retains its 0.1 second step.

Commands validate their whole payload, ownership and accepted sequence before
mutation. Physics owns transforms; player and AI submit the same motor inputs.
The `tracked-force-v1` solver applies bounded differential track forces, torque,
terrain contact probes, gravity/resistance and approximate collision response.
It does not implement full rigid-body joints, articulated suspension, rollover,
or accurate hull footprints. Those omissions prevent handling parity approval.

The checkpoint captures frozen catalog, solver version, exact step, ECS records,
RNG, accepted-command sequence, shell state and obstacle/topology state. Restore
stages admission before replacing the authority. Deterministic continuation is
tested within this solver/runtime; cross-browser lockstep is not established.

## Content and authoring

[Game data](../concepts/armored-platoon/README.md) remains inside the existing
closed UTF-8 game-folder inventory. No global inventory limit was raised.
`content.catalog` is admitted by [armored-catalog](../../source/wildlands/source/armored-catalog.ts);
`content.visuals` selects the original authored visual package admitted by
[armored-visuals](../../source/wildlands/source/armored-visuals.ts).
Catalogs reject unknown fields, dangling gameplay references and unbounded data.

The current offline visual package contains scalar PBR materials, indexed
geometry and stable articulation/socket/volume semantics. It explicitly rejects
external URLs, unsupported resource sections, skins and animation imports.
Texture streaming, GLB/KTX2 production ingest and distribution are remaining
requirements, not implied by a successful Three JSON load.

Follow the [guarded authoring workflow](../how-to/armored-platoon-authoring.md).
Model Forge owns geometry; Scene Forge composes it; policy remains game data.
Semantic volumes can retain exact bounds without hidden collision meshes in the
visible export. The original models are distinct development assets, not
production-textured reference-quality tanks.

## Scope limits

Implemented foundations include chase/gunner/binocular presentation, driving,
fixed-trajectory shells, angular armor outcomes, component damage, finite ammo,
reload, repairs, smoke, four platoon orders, visibility/acquisition, destructible
obstacles and original objective examples. These are approximations with focused
regression evidence; the ledger defines the unfulfilled acceptance scenarios.

Online multiplayer, the verified full vehicle/mission roster, campaigns,
Field HQ progression, infantry, machine guns, advanced logistics, production
streaming/asset caches, reference-calibrated handling and audiovisual fidelity
remain incomplete. No real GPU performance, Safari/device coverage, 30-minute
soak or shipping-host configuration has been accepted.
