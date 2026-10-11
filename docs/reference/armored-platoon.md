# Armored Platoon development checkpoint

Armored Platoon is an independently versioned `armored` Wildlands game template.
It is an early integrated browser implementation, not a completed recreation or
an M1 fidelity acceptance. The [parity ledger](armored-platoon-parity.md) retains the full requested scope
and remaining gaps. The native-finish/navigation increment adds portable PBR maps,
refined original vehicles, hull-aware routes and accessible action feedback.
Implementation `de06f7c353e0a170f8f9f9681a28f2544c9393c2` and CI merge
`319eb893c6d10b3f5eaa387cbb1bdf2300465a75` share tree
`b63851baa951f93b87859c222d706e00cf6bf0f6`. The unchanged Wildlands inputs passed
**1,058/1,058 fast checks across 56 suites in 88.38 seconds** at `e9c5571c`.
The **17/17 Armored browser checks** retain raw implementation identity
`e9c5571c`. A separate source/artifact association proves their Wildlands test,
engine and demo inputs are unchanged in `de06f7c3`; the earlier raw record is
not relabeled. All **11 final CI workflows passed** on the identical-tree CI merge. The
complete Wildlands gate passed **2,491/2,491 checks across 141 suites in
1,771.98 seconds**, including **17/17 Armored browser checks**. Native export
passed **23 checks**; the additional guarded Storytelling step succeeded,
although its raw count receipt was unavailable through this environment's
artifact download route. The formerly timed-out finish suite passed **9/9**
in approximately **3.55 seconds** from CI log timestamps under its unchanged
120-second cutoff. The actual native aggregate passed **103 suites / 21,346
checks / 6 shards**, with source digest
`2c1b0164566553e7e83e4177b535f977095e2355a3986dcc41527c9ca067b823`.
Linux/Windows Runtime confidence, all four Forge/Studio workflows, Source,
Content, Standalone and Advisory quality also passed. Full logs and terminal
metadata are retained; unavailable redirected Python totals are not inferred.

The Character Studio focus repair in this implementation prevents a queued
modal-close event from overriding a newer deliberate focus choice or a reopened
dialog. The same bounded transition diagnostic improved from **17/20 to 20/20**;
**52 unit, 2 integration and 3 browser checks**, standalone handoff, type checks
and bundle freshness passed locally. The
[focus diagnosis](../_archive/armored-platoon-2026-10-11-finishes/character-focus/README.md)
retains the failure and corrected results. This is a shared authoring UI repair,
not a change to Armored gameplay or finish pixels.

The preceding `e9c5571c` Character Studio CI failed its keyboard chapter journey.
Its **221.7-second** Armored observation was interrupted for focus reproduction;
it was not a completed 30-minute observation. A fresh `de06f7c3` observation is
reported separately below; no prior counts substitute for it.

Since `e9c5571c`, only the Character Studio dialog UI, its journey test and
`bin/character-studio` changed. The recorded commit comparison confirms unchanged
Wildlands, Model Forge and Scene Forge source, the Wildlands/Forge/Process
executables, all demos and game folders. Verification of those unchanged inputs
is associated explicitly; the new Character Studio source has its own results.

The current published demo is **4,439,139 bytes**, SHA-256
`783d8dc2fba68251420b2ee61b477677994b8839be62f0660f03f0c49ceda883`.
Its engine identity is
`de4233eee6ec157e2144166cd7f05af2a8f42795356b9b75608ceb4d366919ed`.

The finish generator now precomputes bounded periodic noise fields, captures
Math functions from its own realm and writes typed-array channels directly.
All **81 recipes / 243 channel hashes** retain the original `forge-finish-v1`
pixels. Local CommonJS profiles improved by approximately **25–31%**; the
roughly **33×** improvement measured in the isolated native VM probe primarily
reflects avoiding repeated contextified global lookup. These are CPU profiles,
not browser frame-rate or hardware-performance measurements. Three Float64
fields add **384 KiB of bounded temporary storage per generator call**, plus
small lattice/index tables; no retained cache or peak-memory reduction is claimed.
The nine-check finish suite, all recipe and owner-budget assertions, and its
120-second cutoff remain unchanged.

The fresh `de06f7c3` observation completed **1,800.000 seconds / 121 samples**,
with **375/375** accepted scripted public workload commands, **7/7** exact
paused checkpoint restores and **7** mission switches. It recorded zero page
or console errors, warnings, rejections or observation failures. The frozen
committed demo and 31 tracked inputs remained unchanged; browser cleanup
completed after the final capture. This used native RAF in Chromium 151 /
SwiftShader at 960×600, without private ticks or injected gameplay state.

Of **363** friendly-vehicle snapshots, **8** reported “No safe route” and **1**
“Route obstructed”; these are samples, not distinct incidents or durations.
Allied traffic handling remains partial. Sampled JS heap used moved from
**20,374,208 to 31,212,664 bytes**, ranging **16,340,864–48,024,628 bytes**
without forced collection. These observations do not establish leak freedom,
GPU residency, target-hardware performance, ordinary human play quality or
reference fidelity. Repair/resupply were covered by separate browser checks,
not this bounded long-session workload.

The earlier `09ed672642aedee855d2d45f0e8c4a611127ca7b` full gate **failed**:
106 of 141 suites were attempted, with 2,055 accepted checks passing before
`asset-finish` exceeded its unchanged 120-second limit and was killed. Those
2,055 checks are an incomplete result, not a complete-gate pass. The timeout,
initial profiles and correction are retained in the
[performance diagnosis](../_archive/armored-platoon-2026-10-11-finishes/performance-correction/README.md).

The separate `09ed6726`-associated observation completed **1,800.000 seconds /
121 samples**, with **375/375** accepted scripted public workload commands,
**7/7** exact paused restores and **7** mission switches in Chromium 151 /
SwiftShader at 960×600. It recorded zero page/console errors, warnings,
rejections or observation failures. Its raw launch HEAD remains `3ce1c8df`;
a separate source/artifact comparison establishes its association with
`09ed6726`. This older observation does not verify current `de06f7c3`.
Conservative allied blocking appeared in **16 of 363 friendly-vehicle samples**
on that older build. Separate offline copies of five blocked contexts admitted
routes after omitting allied hulls; this does not prove every blocked sample had
the same cause or change the observed gameplay. These are sample counts, not
distinct incidents. The new observation's results must be assessed separately.

The [final evidence](../_archive/armored-platoon-2026-10-11-finishes/final/README.md) preserves source-bound results and prior failed evidence.
The earlier [v2 archive](../_archive/armored-platoon-2026-10-11-evidence/README.md)
retains its separate CI and observation. Visual fidelity remains at development
level; software observations do not establish hardware performance, leak freedom,
full Q03 or AAA/reference fidelity. Full content, infantry, multiplayer and the
installed-reference/hardware acceptance work remain open in the parity ledger.

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
Fresh sessions use `tracked-force-v2`: bounded differential track forces,
torque, terrain contact probes, gravity/resistance and continuous planar hull
collision. Hulls are yaw-oriented rectangles from authored width/length, with
a vertical interval from ground clearance and height. Continuous separating-axis
translation sweeps catch thin barriers; bounded angular subdivision and a
conservative envelope may stop turning slightly before contact. Inward velocity
is removed while tangential motion slides; vehicles do not transfer collision
impulses. This is not a pitch/roll-oriented 3D hull, full rigid-body joints,
articulated suspension or rollover simulation.

Restoring `tracked-force-v1` retains its original force/circular-contact and
combat arithmetic, without topology migration or depot service. The solver field
versions these semantics; the checkpoint and catalog envelopes remain version 1.
A new mission uses v2, while a runtime-restored old checkpoint continues its
saved solver. Browser restore separately requires a byte-equivalent installed
catalog and rejects different content packs. An old browser save made before
the depot/terrain catalog changes requires its matching old HTML build; runtime
solver compatibility does not make every old browser save loadable in this demo.

The checkpoint captures frozen catalog, solver version, exact step, ECS records,
navigation policy, RNG, accepted-command sequence, shell state and obstacle/topology state. Restore
stages admission before replacing the authority. Deterministic continuation is
tested within each solver/runtime; cross-browser lockstep is not established.
V2 additionally preserves vehicle supply transactions and finite depot stocks;
admission checks their identities, bounds and consistency before replacement,
including funded repair duration and mutual exclusion of repair/supply commitments.

## Navigation and action feedback

Fresh sessions select `navigation: "hull-route-v1"` independently of the physics
solver. Checkpoints without this field retain the original grid navigation,
including older v2 saves, and preserve the omitted field on export. Explicit
`legacy-grid-v1` is also supported; hull routing requires `tracked-force-v2`.
No restored session silently adopts a newer navigation algorithm.

Hull routing sweeps the oriented footprint between waypoints, reserves turning
clearance, smooths bounded A* routes and admits straight narrow passages. Known
stationary allies, wrecks and remembered enemy contacts can block a route; hidden
live enemy positions cannot inform it. A blocked pivot can brake, reverse for a
bounded interval after a rear-clearance check, and replan. Impossible routes
report “No safe route.” This is not traffic negotiation, advanced flanking or a
guarantee of escape from every layout.

Owned vehicle queries expose detached `actions` availability for driving,
aiming, immediate firing, repair and resupply. These use the authoritative
station and service rules; they do not advance time or expose opponents' private
capabilities. The HUD shows these reasons and keeps unavailable service controls
focusable. Fire readiness describes an immediate shot; holding the trigger can
still queue firing through reload. Tab opens orders from the canvas and traverses
controls within the HUD; Escape cancels the order flow and restores canvas focus.
Moving focus into controls releases held driving, firing and captured mouse
intentions. Natural Tab navigation remains available during orders. Unexpected
mouse-capture loss pauses; holding Escape cannot repeatedly toggle pause.

## Combat eligibility and supplies

V2 separates aggregate damage status from station eligibility. A vehicle can
move with a living driver and nonzero engine, transmission and both tracks,
even if another station makes its aggregate status disabled. Aim requires a
living gunner outside repair. Fire additionally requires a working gun and at
least two living crew. A missing loader retains the 1.8× reload duration.
Repairs need surviving crew, speed at most 0.3 m/s, yaw speed at most 0.03 rad/s,
neutral throttle/steer/cruise and no active resupply. Movement or external
component damage interrupts repair; a kit is consumed only at completion.
Onboard fire continues until completed repair extinguishes it or the vehicle
is destroyed. Repairs do not resurrect crew.

HE applies bounded radial damage to one exposed track per nearby hull, up to
25% of authored damage with linear distance falloff. The direct target is
excluded from the secondary blast. Terrain, cover and other hulls, including
wrecks, occlude it before direct-hit cover destruction; friendly vehicles are
also eligible. There is no fragment simulation, internal/crew blast model or
radial obstacle destruction. AI chooses finite AP for estimated penetrable
sampled hull/turret hits, otherwise HE against mobile targets' tracks, and holds
fire when those options are ineffective. It never selects smoke automatically;
this adds no flanking tactics or reference-calibrated armor knowledge.

An optional mission depot supplies finite ammunition and repair kits. The
`resupply` command chooses the nearest friendly in-range depot with needed
compatible stock; repeating it cancels. Service requires surviving crew, the
same stationary bounds as repair, neutral throttle/steer/cruise, released fire,
no burning and no active repair. A positive damaging hit interrupts service even
if the affected component was already at zero health. Movement or firing also interrupts service
without consuming partial stock; repair and supply cannot run together. At the
authored duration, one deterministic transaction fills selected ammunition first,
then the vehicle's remaining authored types up to total `ammoCapacity`, and
repair kits up to the vehicle's kit capacity. Competing vehicles consume remaining
stock without duplication. Depots do not replenish themselves. Faction-scoped
queries expose only that faction's depot stocks and vehicle service state.
Transport, restocking and campaign supply economics remain unimplemented.

## Content and authoring

[Game data](../concepts/armored-platoon/README.md) remains inside the existing
closed UTF-8 game-folder inventory. No global inventory limit was raised.
`content.catalog` is admitted by [armored-catalog](../../source/wildlands/source/armored-catalog.ts);
`content.visuals` selects the original authored visual package admitted by
[armored-visuals](../../source/wildlands/source/armored-visuals.ts).
Catalogs reject unknown fields, dangling gameplay references and unbounded data.

The offline visual package version 2 contains indexed geometry, native procedural
PBR finishes and stable articulation/socket/volume semantics. Version 1 retains
its scalar-only contract. Version 2 admits only embedded 128×128 RGBA8 images:
sRGB color, linear tangent normals and shared roughness/metalness maps. Pixel
data can use numeric arrays or canonical base64; transport encoding does not
change decoded pixels or resource accounting. It caps
images at 32 per asset and decoded image bytes at 2 MiB per pack, within the
unchanged game-folder limits. External URLs, unsupported resource sections,
skins and animation imports remain rejected. Renderer ownership includes shared
textures and template geometry; retiring a view releases each owned resource once.
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
reload, repairs, finite depot service, bounded HE track blast, smoke, four
platoon orders, visibility/acquisition, destructible
obstacles and original objective examples. These are approximations with focused
regression evidence; the ledger defines the unfulfilled acceptance scenarios.

Online multiplayer, the verified full vehicle/mission roster, campaigns,
Field HQ progression, infantry, machine guns, advanced logistics, production
streaming/asset caches, reference-calibrated handling and audiovisual fidelity
remain incomplete. The current and historical bounded 30-minute software
observations do not establish full Q03 acceptance. Real GPU
performance, Safari/device coverage, production stress/context-loss recovery
and shipping-host configuration remain unaccepted.
