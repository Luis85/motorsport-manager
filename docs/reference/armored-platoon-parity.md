# Armored Platoon parity ledger

The full requested parity target remains **incomplete**. This is a provisional
requirements and evidence inventory, not a claim that a reduced proving ground
matches the complete reference. Initial baseline audit is against `749a9f6296f3beb665eedf1eda57ae8cbfd00b39`.
Earlier verification records implementation checkpoint `187dd821316cb334f13947780bb5e135878bda2c`.
The regenerated v2 collision/combat/logistics build passed focused integrated
Node/browser checks at `bbf8475e80d59754bef4df4448492979f492624c`; its
complete Wildlands gate passed **2,192/2,192 checks across 123 suites**.
That complete-gate evidence belongs to the collision/combat/logistics implementation;
it does not verify the later native material and geometry refinement. The latter
has separate authoring, replay and source-admission evidence described below.
Integrated changes require source-bound evidence before rows can close. See [current status](current-state.md)
and the [dated reference register, situations and budget proposals](../_archive/armored-platoon-2026-10-10-reference.md).

## Reading and updating rows

`S1`–`S8` and `V1`–`V2` resolve to URLs, dates and locators in the dated register.
`B` is the user's implementation brief, received 2026-10-10, not independent
reference evidence. Text-only evidence has no playback timestamp (`n/a`); motion
not retrieved is `unavailable`, never an invented timecode. A source key/date and
locator in a row supply its evidence identity. Evidence status is one of
`verified-claim`, `observed`, `inferred`, `planned`, `unknown`. Verified-claim
means the official text was read, not that installed behavior was tested.

Dependencies/module columns are intended ownership bindings, **not claims that
all modules exist**. `Runtime` means Wildlands versioned armored domain;
`Physics` its owned solver adapter; `Combat` shared weapons/damage/perception;
`World` presentation/assets; `Shell` browser application/input/audio;
`Content` declarative armored concept data; `Tools` Model Forge/Scene Forge/
Character Studio; `Network` shared authority server adapter. The integrator
should replace symbolic bindings with exact source files as those contracts land.

`partial` records implemented foundations with remaining parity work; `open`
records absent work or unverified scope. No row is fully accepted. A foundational
implementation still needs its full scenario, final source identity, artifact
and remaining-gap review before closure. No source-backed full vehicle/mission enumeration is
available. `V99` and `M99` must be resolved before the final content baseline can
freeze. Original mission narratives/artwork and independently authored geometry
must retain provenance; public screenshots/trailers are comparison evidence only.

## Gameplay, interaction and mode requirements

These acceptance scenarios operationalize the user's brief. Requirements marked
B remain required engineering work even where their exact reference tuning is
unknown; they must not be relabeled observed just because a prototype implements
them. Rows with S evidence retain the text locator; all have n/a playback time.

| ID | Category | Ref/date; locator | Evidence | Expected behavior | Dependency | Module/data | Acceptance scenario | Current | Remaining gap |
|---|---|---|---|---|---|---|---|---|---|
| G01 | Architecture | B/2026-10-10 §6 | planned | One match authority; detached queries never tick | ECS/session | Runtime | Repeated query/menu actions leave tick/state unchanged | partial | Armored contract and integration proof |
| G02 | Clock/coordinates | B §6 | planned | Versioned 60 Hz target; explicit meters/kg/radians/world frames | Fixed clock/tool transforms | Runtime/Tools | Cross-tool coordinate fixture; old RTS tick unchanged | partial | Measured step budget and fixture |
| G03 | Driving | B §7 | planned | Contact-driven differential forces, braking and reverse | Solver | Physics | Drive/brake/reverse at multiple render cadences | partial | Tracked contact calibration |
| G04 | Terrain | B §7 | planned | Suspension/slip/resistance on slopes and ditches | Terrain contacts | Physics/Content | Crest, ditch, side slope, uneven support | partial | Reference handling measurements |
| G05 | Collision/recovery | B §7 | planned | Hull collision, immobilization, rollover/recovery | Solver/topology | Physics | Wall push and blocked reversing without teleport | partial | Robust physical recovery |
| G06 | Cruise | S4/2026-10-01; cruise paragraph | verified-claim | Maintain selected speed; show active target | Motor/input | Runtime/Shell | Activate, steer, brake/cancel and restore focus | partial | Exact cancellation bindings/calibration |
| G07 | Articulation | B §7 | planned | Track/wheel/suspension/turret/elevation/recoil follow state | Rig/socket semantics | Tools/World | Slow-motion uneven-ground and fire capture | partial | Production rig plus motion review |
| G08 | Chase camera | S2/2025-09-16; simcade | verified-claim | Stable third-person direct driving | Perspective/collision | World | R02 matched gameplay sequence | partial | FOV/lag/collision calibration |
| G09 | Gunner view | S2; first-person | verified-claim | Optics zoom/reticle tracks intended aim | Camera/weapon frames | World/Combat | R03 near obstruction versus distant aim | partial | Model-specific optics observations |
| G10 | Binoculars | B §7; S3 August binoculars | verified-claim | Commander view and exposed station are coherent | Crew/stations | World/Combat | R04 entry, scan, damage and exit | partial | Frame sequence/settings |
| G11 | Exposed AA crew | B §7; S3 August crew | verified-claim | External gun exposes crew; internal selection retracts | Crew/animation | Combat/World | Switch stations during incoming fire | open | Animation/hit volumes/eligibility |
| G12 | Aim separation | B §7 | planned | Hull, turret, gun, camera and muzzle remain distinct | Transform authority | Runtime/Combat | Traverse/elevation limits and near wall fire | partial | Anchor/limit production data |
| G13 | Ammunition/reload | B §7 | planned | Select shell/reserve; emit/consume/reload once | Command sequencing | Combat/Content | Repeated/delayed fire across reload boundary | partial | Reference timing/ready-rack rules |
| G14 | Machine guns | B §7 | planned | Main/coax/AA ownership and distinct ammo/audio | Stations/ballistics | Combat/Shell | Fire, switch, pause, destroy without stuck loop | open | Verified station/ammo roster |
| G15 | Smoke/utility | B §7 | unknown | Implement only reference-supported utility availability | Effects/perception | Combat/Content | Utility consumption and shared concealment | partial | Vehicle-specific availability |
| G16 | Ballistics | S6/2025-07-19; penetration | verified-claim | Muzzle launch, travel and gravity; no target following | Continuous queries | Combat/Physics | Moving target evades; thin obstacle intercepts | partial | Tuned tables and continuous collision |
| G17 | Armor outcomes | S6; Hit Outcomes | verified-claim | Plate/angle/ammo distinguish block, ricochet, penetration | Armor volumes | Combat/Content | Equal shots front/side/oblique produce explained outcomes | partial | Authoritative regional data |
| G18 | Internal damage | S6; Penetration Physics | verified-claim | Bounded post-penetration effects hit components/crew | Semantic damage volumes | Combat/Content | Trace internal ray and finite residual effect | partial | Crew/components fidelity |
| G19 | Mantlet | S5/2026-05-12; damage section | verified-claim | Impair aim/elevation while preserving firing | Component state | Combat | Mantlet injury slows aim, valid shot still fires | partial | Distinct barrel/turret-drive rules |
| G20 | Vehicle lifecycle | B §7 | planned | Impaired/immobile/disabled/abandoned/destroyed as verified | State transactions | Combat | Damage/repair/death transitions and unavailable actions | partial | Reference state distinctions |
| G21 | Repair/fire/recovery | B §7 | planned | Explicit eligibility, resources and duration | Transactions | Combat/Content | Exhaust kits, interrupted repair, extinguish and recovery | partial | Costs/timings and station behavior |
| G22 | Resupply | B §7 | planned | Authoritative ammo/resource transfer | Transactions | Runtime/Content | Partial/full resupply and repeat request | partial | Finite v2 depot service implemented; reference station rules and advanced logistics remain |
| G23 | Death explanation | B §7; S3 August Death Cam | verified-claim | Retain shot/plate/component evidence for presentation | Hit records | Combat/World | R08 inspect final shot without changing state | partial | Camera/UI and trajectory accuracy |
| G24 | Direct handover | B §7 | planned | Select vehicle independently of orders; no held-input leak | Input/ownership | Runtime/Shell | Switch while accelerating and streaming | partial | All stations and controller navigation |
| G25 | Two-stage orders | B §7; S3 August orders | verified-claim | Order then recipient; whole-platoon first stage | Validated commands | Shell/Combat | Stage/cancel/release/replace without selecting wrong tank | partial | Exact interaction observations |
| G26 | Charge | B §7; S3 August orders | verified-claim | Aggressive destination or explicit target priority | Perception/navigation | Combat | Compare same destination against Secure | partial | Measured behavior and target-loss policy |
| G27 | Secure | B §7; S3 August orders | verified-claim | Advance methodically and clear threats | Perception/navigation | Combat | Threat interrupts approach, then safe continuation | partial | Reference prioritization |
| G28 | Follow | B §7; S3 August orders | verified-claim | Follow current controlled vehicle safely | Formation motor | Combat | Handover, choke and stopped leader | partial | Spacing/traffic policy |
| G29 | Hold | B §7; S3 August orders | verified-claim | Stop current movement with explicit replacement | Order lifecycle | Combat | Replace twice around tick boundary | partial | Verified threat response while holding |
| G30 | Perception | S5; foliage | verified-claim | Buildings/terrain/foliage/smoke occlude consistently | Shared visibility | Combat/World | Conceal target at every quality preset | partial | No hidden information leakage proof |
| G31 | Acquisition/memory | B §7 | planned | Finite aim settling and uncertain lost contacts | AI/state | Combat | First shot, obscured moving target, reacquisition | partial | Observed timings/contact sharing |
| G32 | Navigation | S4; vehicle improvements | verified-claim | Hull-aware paths, wreck avoidance, reversing, stuck recovery | Navmesh/topology/motor | Combat/Physics | Formation through village and blocked route | partial | Footprint/slope/bridge constraints |
| G33 | Infantry/AT | B §7 | planned | Animated meaningful infantry, cover and anti-tank attacks | Character Studio/combat | Tools/Combat | Dismount/cover/attack/crew vulnerability | open | Production rigs and gameplay data |
| G34 | Destruction | S2; destruction | verified-claim | Topology/collision/cover/presentation change together | Atomic revisions | Runtime/World | Destroy wall, replan, checkpoint, restore rubble | partial | Persistent topology transaction |
| G35 | Objectives | B §7 | planned | Declarative conditions/triggers/reinforcements/checkpoints | Validated graph | Content/Runtime | Alternate objective order and trigger-boundary save | partial | Full authored mission graph |
| G36 | Field HQ | S5; Field HQ | verified-claim | Spend earned points on eligible reinforcements/redeployment | Economy/mission transaction | Runtime/Content | Duplicate request and insufficient balance reject atomically | open | Exact reference pricing/unlocks |
| G37 | Rewards/medals | S5; medals | verified-claim | Persistent objective/assist/capture/component rewards once | Idempotent awards | Runtime/Content | Reload just before/after award and debrief | open | Reference thresholds and all reward kinds |
| G38 | Crew/unlocks | B §7 | planned | Observed crew/vehicle availability progression | Versioned campaign | Runtime/Content | Mission continuation and unlock persistence | open | Full progression audit |
| G39 | Full journey | B §7 | planned | Boot/menu/mode/briefing/setup/combat/debrief/continue | State machine | Shell/Content | Complete mission from cold boot, fail/restart too | partial | End-to-end shipping route |
| O01 | Solo campaign | S1/2026-10-10; Features | verified-claim | Offline after required assets available | Local authority/cache | Runtime/Content | Disconnect after asset load and finish/save mission | open | Full German campaign content |
| O02 | Conquest | S4/2026-10-01; mission | verified-claim | Standalone scenario selection and completion | Mission data | Content/Shell | Select independent scenario, win/fail/retry | open | Full Conquest roster/rules |
| O03 | Platoon skirmish | S1; About | verified-claim | Separate team/platoon mode and map rules | Shared combat | Content/Network | Configure bots/sides/capture rules | open | Current player/platoon limits |
| O04 | Cooperative | S1; Features | verified-claim | Real shared-authority mission with independent clients | Authoritative server | Network | Two remote clients cooperate, rejoin and complete | open | Hosting, caps, scaling/ownership rules |
| O05 | Competitive | S1; Features | verified-claim | Server owns damage/ammo/objectives/rewards | Interest/authority | Network | Opponents at latency; no hidden enemy state | open | Real internet session evidence |
| O06 | Testing Grounds | S8/2025-12-16; V0.05.02 | verified-claim | Dated 5v5, no AI platoons; empty slots may be bots | Mode policy | Network/Content | Audit actual lobby, slot filling and team sizes | open | Current October settings/cap need installed verification |
| O07 | Assistance presets | B §11; S3 August host settings | verified-claim | Host-shared Casual/Immersive/custom assists | Session config | Network/Shell | All clients share outlines/penetration/HUD policy | open | Complete options/rules audit |
| O08 | Communication | B §11 | planned | Quick/world/radial pings respect recipients and expiry | Transient events | Network/Shell | Enemy cannot receive private ping; stale markers expire | open | Exact categories, range and TTL |
| O09 | Lobby/reconnect | B §11 | planned | Version/ownership/rate limits, join/resume/status | Server lifecycle | Network | Mismatch, duplicate/reordered commands and reconnect | open | Protocol/server plus impairment test |
| O10 | Prediction/interest | B §11 | planned | Responsive prediction reconciles; hidden enemies withheld | Snapshot projection | Network/World | Latency/jitter/disconnect and cover destruction | open | Bandwidth/backpressure measurements |
| O11 | Manual zeroing | S3/2026-02-25; roadmap | planned | Pending shipped verification | Optics/weapon config | Combat/Shell | Installed settings and firing test | open | No later shipped corroboration |
| O12 | 10v10/extra factions | S3 roadmap; B §4 | unknown | Do not infer from roadmap or ten-player wording | Scope freeze | Content/Network | Inspect current mode/roster menus | open | Unsupported current claim |

## Named content candidates

Names below were found in official text; variants without an exact suffix remain
unresolved. This is not the advertised entire roster. All acceptance requires
separate authored geometry/articulation, materials, sockets and collision/damage
data, validated in the regular runtime; renamed copies do not close rows. Source
locators are dated section/vehicle/mission headings, with n/a playback timestamp.

| ID | Category/item | Ref/date | Evidence | Expected behavior | Dependency | Module/data | Acceptance scenario | Current | Remaining gap |
|---|---|---|---|---|---|---|---|---|---|
| V01 | M4A1 (75) Late Sherman | S4/2026-10-01 | verified-claim | Distinct authored variant | Vehicle pipeline | Content | Full inspect/drive/fire/damage route | open | Production model/tuning |
| V02 | M4A3; exact suffix unknown | S4/2026-10-01 | verified-claim | Preserve period/mission availability | Roster/mission data | Content | Compare summer/later availability | open | Exact subtype/current availability |
| V03 | M18 Hellcat | S3/2026-08-07 | verified-claim | Distinct authored assembly | Vehicle pipeline | Content | Open-crew/drive/fire route | open | Geometry/stations/tuning |
| V04 | M24 Chaffee | S3/2026-08-07 | verified-claim | Distinct authored assembly | Vehicle pipeline | Content | Drive/fire/damage route | open | Geometry/stations/tuning |
| V05 | Pz.Kpfw. III Ausf. N | S3/2026-03-17 | verified-claim | Distinct authored assembly | Vehicle pipeline | Content | All admitted ammo and articulation | open | Model/ammo/armor data |
| V06 | Pz.Kpfw. IV Ausf. G | S3/2026-03-17 optics fix | verified-claim | Variant-specific optics/geometry | Vehicle pipeline | Content | Optics and gun alignment review | open | Current optic capture/tuning |
| V07 | Pz.Kpfw. V Ausf. G Panther | S3/2026-03-17 skin note | verified-claim | Distinct assembly; licensed/original skin | Vehicle pipeline | Content | Variant geometry and material provenance | open | Production model; edition skin scope |
| V08 | Tiger; exact variant unknown | S1/retrieved 2026-10-10 | verified-claim | Resolve variant before authoring | Roster audit | Content | Installed hangar identity capture | open | Exact variant, then all assets/data |
| V09 | StuH 42 | S1/retrieved 2026-10-10 | verified-claim | Distinct assault-gun assembly | Vehicle pipeline | Content | Gun mount/traverse and damage route | open | Model and verified configuration |
| V10 | Stuart; exact variant unknown | S3/2026-10-01 steering fix | verified-claim | Resolve variant and reversing | Roster audit/motor | Content | Installed identity and reverse steering | open | Exact subtype and calibration |
| V99 | All other vehicles/variants/skins | S1 counts conflict | unknown | Enumerate full verified current scope | Installed roster | Content | Capture every roster entry/edition condition | open | Complete frozen list unavailable |
| M01 | Amblève River | S4/2026-10-01 | verified-claim | Standalone Conquest with authored objectives | Mission graph | Content | Start, alternate order, victory/failure | open | Exact topology/scripts |
| M02 | Le Mesnil-Adelée | S3/2026-08-07 | verified-claim | Campaign scenario | Mission graph | Content | Full playthrough and checkpoint continuation | open | Exact topology/scripts |
| M03 | Bastogne | S3/2026-08-07 | verified-claim | Campaign scenario | Mission graph | Content | Full playthrough and checkpoint continuation | open | Exact topology/scripts |
| M04 | St. Barthélemy | S5/2026-05-12 | verified-claim | Campaign scenario | Mission graph/night world | Content | Readable night combat and completion | open | Exact topology/scripts/lighting |
| M05 | Le Dézert | S3/2026-03-17 | verified-claim | Campaign scenario | Mission graph | Content | Full playthrough and checkpoints | open | Exact topology/scripts |
| M06 | Retake the Airfield | S3/2026-03-17 | verified-claim | Conquest scenario | Mission graph | Content | Independent start and completion | open | Exact topology/scripts |
| M07 | Radio Tower | S3/2026-03-17 | verified-claim | Skirmish map | Map/mode data | Content | Both teams; accessible objectives | open | Map and mode settings |
| M08 | Mont-Saint-Michel | S3/2026-06-25 | verified-claim | Multiplayer map | Map/mode data | Content | Both teams and long sight lines | open | Map and mode settings |
| M09 | St Vith | S3/2026-10-06 | verified-claim | Campaign progression remains completable | Reinforcement triggers | Content | Engineer trigger across checkpoint | open | Exact graph and repaired behavior |
| M10 | La Caplainerie | S3/2026-10-01 progression fix | verified-claim | Alternative progress orders cannot block | Mission graph | Content | Permute objective order | open | Exact graph |
| M11 | Schöneberg | S2/2025-09-16 caption | verified-claim | Historical campaign candidate | Installed mission audit | Content | Confirm current menu identity | open | Current availability/topology |
| M12 | Panzer Lehr | S3/2026-02-18 fix | verified-claim | Campaign candidate | Mission graph | Content | Current start and first encounter | open | Current availability/topology |
| M13 | ALG A-1 | S7/2025-12-16 | verified-claim | Skirmish map | Map/mode data | Content | Both teams and long sight lines | open | Topology/mode configuration |
| M99 | Remaining missions/maps/environments | S1 counts conflict | unknown | Full verified current enumeration | Installed selection audit | Content | Capture every mode's mission list | open | Exhaustive baseline unavailable |

## Presentation, browser, production and verification

All `B` rows below refer to the brief dated 2026-10-10; playback timestamp is n/a,
evidence status is `planned`; current implementation status is shown separately.
These shared fields are explicit to avoid implying observed reference behavior. The referenced
R scenarios are defined in the dated research record. Every visual requirement
must pass in the same shipping gameplay route used for performance measurement.

| ID | Category | Expected behavior | Dependency | Implementing module/data | Acceptance scenario | Remaining gap | Current |
|---|---|---|---|---|---|---|---|
| P01 | Vehicle fidelity | Accurate proportions, tracks, bevels, attachments/weathering | Production models/PBR | Tools/World | R01–R08 close and moving views | Revision-3 original fittings and native finishes are present; exact variants, production UV/detail/rigs and matched motion review remain | partial |
| P02 | World fidelity | Terrain roads/ruts/ditches/water, dense varied vegetation/villages | Streamed terrain/instances | World/Content | R05/R10/R11 same combat route | Representative content density | partial |
| P03 | Lighting | Calibrated sun/sky/IBL, shadows/contact shading | Renderer feature matrix | World | All R cases in declared daylight/night settings | Material/color/shadow calibration | partial |
| P04 | Effects | Depth-aware smoke/fire/dust/impacts/tracks with bounded lifetime | Event-driven effects | World | Six plumes plus active firing/destruction | Moving depth/stability and accumulation | partial |
| P05 | Image stability | AA/post effects preserve moving detail and aim | Pinned renderer | World | Matched still and motion, no camouflage by blur/fog | Real motion comparison | partial |
| P06 | HUD | Center aim, vehicle/crew/ammo/reload/kits/speed/gear/RPM/orders/minimap | Detached stable projections | Shell | R02–R12, UI scale and active combat | Full hierarchy and readable states | partial |
| P07 | Menus | Loading/progress/cancel/retry/briefing/hangar/pause/settings/saves/results | Stable application shell | Shell | Cold boot, canceled load, retry and full mission | Complete working journeys | partial |
| P08 | Controls/accessibility | Keyboard/controller navigation, rebinding conflicts, curves, dead zones | Input context/focus | Shell | Typing/menu actions never fire weapons; restart onboarding | Device coverage and focus recovery | partial |
| P09 | Audio | Layered positional voices, interiors/exteriors, crew priorities, bounded loops | Audio events/lifecycle | Shell | Fire, switch, pause, destroy and unload repeatedly | Licensed audio and attenuation mix | partial |
| P10 | Browser gestures | Audio/pointer lock/fullscreen denial/reacquire; clear held input | Browser adapters | Shell | Escape, blur, hidden/resume, rejected request | Real browser gesture coverage | partial |
| P11 | Storage | Versioned checkpoint/settings separate from evictable cache | Staged persistence adapter | Runtime/Shell | Corruption/quota/denial, backup import/export/migration | Complete format/recovery proof | partial |
| P12 | Physical checkpoint | State/solver/revision/RNG/commands/projectiles restored atomically | Solver snapshot contract | Runtime/Physics | Moving/damaged tank, airborne shell and destroyed wall | Full reconstruction and semantic validation | partial |
| P13 | Device/cache recovery | Reconstruct GPU resources; reject incomplete/mixed update sets | Manifest/resource lifecycle | World/Shell | Context loss, stale cache, interrupted download and reload | Fault injection and recovery evidence | open |
| P14 | Browser matrix | Chromium/Firefox/WebKit plus separate real Safari record | Available runners/hardware | Verification | Shipping route on actual reported adapters | Safari/macOS/iOS and hardware unavailable | partial |
| P15 | Production hosting | HTTPS/MIME/CORS/CORP/CSP/compression/cache compatibility | Deployment config | Build/hosting | Serve built worker/WASM/assets from production config | Development server is insufficient | open |
| T01 | Model materials | Semantic texture channels, color spaces, sampler/UV transforms | Shared model kernel | Tools | Texture/UV round-trip plus legacy scalar fixture | Native seeded PBR finish maps and bounded inline export are present; arbitrary production texture ingest, atlas authoring and loss checks remain | partial |
| T02 | Model ingest | Preserve supported hierarchy/pivots/textures/skins/animation | Dedicated production codec | Tools | Import/export real rigged asset; reject required loss | Static proxy path insufficient | open |
| T03 | Vehicle authoring | Stable rig/socket/anchor/collision/damage volume IDs | Guarded model workflow | Tools/Content | Model Forge → Scene Forge → runtime fixture | Revision-3 replay preserves all tagged nodes; production rigs, animated tracks and authoritative damage-volume integration remain | partial |
| T04 | Battlefield authoring | Terrain/road/scatter/destruction/objective editing with undo | Scene tooling/compiler | Tools/Content | Different topology/objective flow through documented commands | Reusable workflow and diagnostics | partial |
| T05 | Asset packs | Immutable hashes, provenance, bounded self-hosted formats/decoders | Explicit admission contract | Tools/Build | Corrupt/traversal/missing/oversize rejection | Binary distribution and license inventory | partial |
| T06 | LOD/streaming | Preserve simulation relevance and semantic anchors across LOD | Resource registry | World/Tools | Stream while switching direct control and firing | Measured working set and identity | open |
| T07 | Independent authoring | Different vehicle geometry/rig/material/socket/collision and mission | Documented public workflow | Tools/Content | Separate author produces variant without engine branch | M3 production demonstration | open |
| T08 | Renderer fallback | Feature matrix; controlled fallback resource reconstruction | Pinned Three.js | World | Force optional backend failure while simulation continues | No WebGPU parity assumed | open |
| Q01 | Performance | Named primary/compatibility targets and disclosed reductions | Shipping route/instrumentation | Verification | 12 vehicles/40 infantry/6 plumes plus max parity content | Real baseline GPUs unavailable | open |
| Q02 | Loading/memory | Separate cold/warm reports and class budgets | Asset manifest/profiler | Verification | Declared bandwidth/device then M1 budget freeze | Proposed caps unmeasured | open |
| Q03 | Long sessions | 30-minute combat and repeated mission cycles stabilize resources | Lifecycle counters | Verification | Hidden/pause/resume/control switching during streaming | Separate `187dd821`, `bbf8475e` and historical `09ed6726`-associated bounded software observations completed; current `de06f7c3` is reported separately; hardware/full stress/context loss and comprehensive resource measurements remain | partial |
| Q04 | Visual regression | Own approved captures separate from reference assessment | Deterministic fixtures | Verification | Fixed seed/time/camera/weather/assets and independent review | No capture proves parity by itself | partial |
| Q05 | Network quality | Independent clients with latency/jitter/loss/interruption | Impairment harness | Network/Verification | Reconnect and no duplicate shots/rewards or private state | Real authoritative online service | open |
| Q06 | Replay claim | Exact tested version/content/init order only | Recorded command stream | Runtime/Verification | Re-run declared scope; compare canonical checkpoints | Cross-browser lockstep unverified | partial |
| Q07 | Repository regression | Complete registered gates and regenerated CLI/demos | Integrator serialized build queue | Build/Verification | All relevant gates, old games, native boundaries | All ten `bbf8475e` workflows passed; Wildlands 123 suites/2,192 checks and native 103 suites/21,346 checks; full parity remains open | partial |
| Q08 | Handoff | Source identity/artifacts/gaps/reproduction; draft PR, no merge | Delivery evidence | Integrator | Reproduce built game from clean checkout | Final M0–M5 exits not achieved | partial |

## Integrated foundation and measured scope

Implementation is progressing in the same branch; the rows above remain open
for parity acceptance. The following source bindings replace symbolic ownership
for the initial slice. This is a capability boundary, not M1/M2 completion.

| Area / ledger rows | Current source | Implemented foundation / remaining limit |
|---|---|---|
| G01–G05, P12 | [session](../../source/wildlands/source/armored-session.ts), [physics](../../source/wildlands/source/armored-physics.ts), [checkpoint](../../source/wildlands/source/armored-checkpoint.ts) | Separate 60 Hz ECS authority; new v2 sessions add yaw-oriented rectangular continuous terrain-plane hull sweeps and bounded angular contacts. V1 restore preserves legacy force/circular-contact arithmetic without migration. No full rigid-body suspension, pitch/roll-oriented hull collision, impulse transfer or rollover parity. |
| G13, G16–G21 | [combat](../../source/wildlands/source/armored-combat.ts) | AP/HE/SMOKE ammo, swept fixed trajectories, coarse hull regions/angle outcomes and timed repair. V2 separates station eligibility from aggregate disabled status and adds occluded radial HE track damage. No historical calibration, complete spall, exposed-crew/internal blast, radial obstacle destruction or machine guns. |
| G22 | [logistics](../../source/wildlands/source/armored-logistics.ts) | V2 finite friendly depots, stationary timed service, selected-ammo priority, cancellation without partial consumption, deterministic shared stock and checkpointed transactions. No stock transport/replenishment, campaign economics or full reference logistics. |
| G25–G32 | [AI](../../source/wildlands/source/armored-ai.ts) | Orders, contact memory, 10 Hz acquisition and fresh line-of-sight checks before aiming. V2 selects useful finite AP/HE shots from sampled geometry and holds ineffective fire; bounded grid paths feed motors. No complete traffic/cover tactics, swept footprint navigation or formation-through-choke guarantee. |
| G35–G39 | [mission rules](../../source/wildlands/source/armored-missions.ts) | Eliminate/reach/survive and time-limit outcomes only; cumulative crew damage and disabled-vehicle neutralization correction is present; Pine and corrected Crossroads command-only completion are demonstrated; Pine also reaches a visible browser debrief through public commands with an accelerated supplied clock. No complete trigger graph, campaign, Field HQ/advanced logistics or reward progression. |
| T01–T06 | [catalog admission](../../source/wildlands/source/armored-catalog.ts), [visual admission](../../source/wildlands/source/armored-visuals.ts), [finish generator](../../source/model-forge/src/kernel/application/finish-pattern.ts) | Catalog v1 remains separate from visual envelope v2. Native seeded painted-metal/bare-metal/rubber recipes export bounded inline color, normal and packed roughness/metalness maps with retained semantic bindings; scalar visual v1 remains admitted. Arbitrary production texture/skin/animation ingest, LODs and binary streaming remain open. |
| P01–P10 | [renderer](../../source/wildlands/source/armored-renderer.ts), [world](../../source/wildlands/source/armored-world.ts), [audio](../../source/wildlands/source/armored-audio.ts) | Developing direct-control browser presentation with original assembled vehicle assets; no reference-matched motion/fidelity or baseline hardware claim. |

A read-only independent review used isolated in-memory TypeScript transpilation
against the working files (no generated build output modified). It reproduced
stale-contact live-pose disclosure, invalid restored enemy-follow orders and
malformed visual attribute admission. Subsequent focused rechecks confirmed
fresh-LOS snapshot omission, enemy-follow rejection, malformed route rejection,
reserved identity rejection, and unknown attribute-constructor/string-coordinate
rejection. These ad hoc boundary checks are not the complete registered gate;
consult the integration record for final source identity and executed suites.
All complete-scope gates remain open until their own acceptance evidence exists.

## Native asset refinement — bounded authoring evidence

The current original tank studies are Model Forge document revision 3. Sherman
has 7,508 triangles and 213 visible meshes; Panzer has 6,572 and 224. Native
primitives add hatches, periscopes, handles, tow/lifting rings, weld seams, lamp
guards, braces, tool clamps and exhausts; the Sherman also gains a smoother turret
and rounded transmission cover. Native `forge-finish-v1` materials generate
seeded painted-metal, bare-metal and rubber maps. No reference geometry, imagery
or paint samples were imported. These additions advance P01/T01/T03 without
closing their reference-fidelity or production-quality acceptance.

Guarded Model Forge edits, bundle exports and Scene Forge replacement/export
transactions produced the final assets. Both native audits passed with zero
warnings/errors against explicit caps of 12,000 triangles, 256 meshes,
12 materials, 64 geometries and 8 metres per model, requiring UVs and rejecting
transparent/double-sided materials. All 24 Sherman and 28 Panzer tagged
articulation/socket/volume nodes were unchanged. Source recipes, bundle entries
and imported recipes matched after excluding only the source document revision.
An isolated fresh creation replay produced byte-identical normalized Three
exports for both tanks.

Fixed-camera software reviews compared baseline, initial refinement and final
assets. The initial dense repeating paint/wear was reduced to paint scale 1 and
wear 0.055; the earlier state remains in model history. These asset captures
establish a reviewed authoring change, not matched gameplay motion, baseline-GPU
performance or AAA quality. Bespoke UV-atlas painting, uniform texture density,
interiors, crew, LODs, continuous tracks and exact variant fidelity remain absent.

The compiler's visual envelope v2 is distinct from `tracked-force-v2`. Its final
compact pack is **3,133,629 bytes**, SHA-256
`8e406de65dd806954ce24a691da434fdfbdeac93e0f4901cb800445348be19c5`.
Canonical base64 transport preserves the native exported RGBA8 pixels exactly:
decoded pack objects matched both original Three exports, with semantic bindings
unchanged. There are 96,685 aggregate values under the existing 3,000,000 limit,
and the same 1,572,864 decoded image bytes under the 2 MiB limit; each tank has
12 images/textures. The earlier 7,176,881-byte numeric-array pack fit the 8 MiB
game-file limit but made the complete HTML exceed its separate play budget.
Lossless transport reduces that overhead without reducing assets or raising
either budget. This isolated evidence is separate from the historical complete gates
below; a later integrated artifact needs its own source-bound verification.
The base64 pack passed the actual source admission and game-folder inventory checks.
Reproduction and remaining toolchain limits are in the
[authoring guide](../how-to/armored-platoon-authoring.md).

## Finish performance and dialog focus — current verification

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

The earlier `09ed672642aedee855d2d45f0e8c4a611127ca7b` full gate **failed**:
106 of 141 suites were attempted, with 2,055 accepted checks passing before
`asset-finish` exceeded its unchanged 120-second limit and was killed. Those
2,055 checks are an incomplete result, not a complete-gate pass. The timeout,
initial profiles and correction are retained in the
[performance diagnosis](../_archive/armored-platoon-2026-10-11-finishes/performance-correction/README.md).

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

Current results and raw identities belong to the [final evidence](../_archive/armored-platoon-2026-10-11-finishes/final/README.md).
Do not substitute the `09ed6726` observation counts below for this new run.
The earlier allied-traffic blockage remains a recorded limitation until a
source-bound follow-up establishes its behavior. No M1–M5 or complete parity row
closes from regression tests or software observations: production asset/content
coverage, reference calibration, infantry, campaign/mode completeness, genuine
online authority and target-hardware acceptance remain open.

## Native finishes, navigation and input — integrated verification (historical `09ed6726`)

Implementation `09ed672642aedee855d2d45f0e8c4a611127ca7b` integrates the native
asset refinement and independently versioned hull routing with current main.
CI merge `ec88210c205a674cdb77f85cc2cc59d9feb3874c` has the identical tree
`7eb1dc63ee7709b75c0a835dcb14cbb3d509cf99`.
The local fast tier passed 1,058 checks across 56 suites; Armored browser
verification passed 17/17. The complete gate subsequently **failed** after
106 of 141 suites were attempted and 2,055 accepted checks passed: `asset-finish`
exceeded 120 seconds and was killed. This incomplete result does not establish
full acceptance; the optimized successor and its separate evidence are above.

The frozen published demo completed **1,800.000 seconds / 121 samples** using
native browser timing in Chromium 151 with SwiftShader at 960×600:
**375/375 accepted scripted public workload commands**, **7/7 exact paused
checkpoint restores** and **7 mission switches**. Page errors, console errors,
console warnings, command rejections and observation failures were all zero.
The workload covered driving near deployment, aiming/main-gun fire and platoon
follow/hold orders. Automatic shell control/aim responses are excluded from the
command count. Repair/resupply, complete missions, worst-case crowded scenes,
multiplayer and context loss were not exercised by this observation.

The launch record retains precommit HEAD `3ce1c8df`; it is not relabeled as the
final implementation. A separate committed-association receipt proves that the
frozen demo and tracked source inventory match `09ed6726`. The observed demo is
4,438,590 bytes, SHA-256
`a15cb9df9468a2dbd5373f4ea4f345f8bf1ec83d80a0c598b63b59a626f7fdb6`;
it is distinct from the browser-test artifact.

Navigation remains conservative around allied hulls: **16 of 363 sampled
friendly-vehicle projections** reported `No safe route`, and one reported
`Reverse escape`. These are repeated sample observations, not distinct incidents
or a failure rate. Offline diagnostics of five saved blocked-actor contexts
found empty routes; separate copies omitting other allied hulls admitted direct
routes. That isolates allied blocking in those five contexts without changing
the observed gameplay or proving the cause of every blocked sample.

The final paused capture shows readable UI and visible original tanks/material
detail, with development-level stylized visual fidelity. It is not a mission
completion or reference-matched quality review. Unforced-GC JavaScript heap
measurements do not establish leak freedom; GPU memory, resource residency and
renderer geometry/texture counters were unavailable. Target-hardware performance,
actual Safari/device coverage, ordinary human play and full Q03 remain unaccepted.


Character Studio passed 52 unit, 2 integration and 3 browser checks, including
portable finish preview ownership; Model Forge passed 182 units, Scene Forge 57
and Process Studio 22. The clean advisory inventory covers 1,812 files, with
zero physical-code-budget overruns and 6,927 long-line advisories retained.
The final Runtime confidence Linux and Windows jobs passed on the identical
implementation/CI-merge tree. Their redirected Python test totals were not
retrieved because artifact download returned HTTP 403; no final totals are
inferred from the earlier local run. The separate
local `3ce1c8df` pinned run passed 360 of 361 discovered tests with one Windows skip;
its extra directory guard failure is explained by 110 native-generated files,
with original source bytes unchanged.

The archive retains pointer-lock failure reproduction, stale Character bundle
failure, merged-material admission regression, and both interrupted observations.
No acceptance row closes from software-only rendering or green regression alone.
The current material/physics/content/network/device gaps remain in the rows above.
See the [final receipts](../_archive/armored-platoon-2026-10-11-finishes/README.md).

## Previously verified physics-v2 slice — focused integrated verification

The implementation tested in this section is `bbf8475e80d59754bef4df4448492979f492624c`.
GitHub CI checks out merge commit `9357f10ee7c4fb0b1b1b11735c715149ac9e2d1a`;
both have the exact tree `d8993c022778faa911647e77bbc4a26cf8f16a40`, with empty
tree diff. Commit identities remain distinct. The [checkout identity receipt](../_archive/armored-platoon-2026-10-11-evidence/ci/checkout-identity.json)
records both commits.

All ten implementation workflows completed successfully for that tree:

| Workflow | Successful run |
|---|---|
| Source project | [38120778433](https://github.com/Luis85/motorsport-manager/actions/runs/38120778433) |
| Scene Forge | [38120778481](https://github.com/Luis85/motorsport-manager/actions/runs/38120778481) |
| Model Forge | [38120778507](https://github.com/Luis85/motorsport-manager/actions/runs/38120778507) |
| Advisory code quality | [38120778500](https://github.com/Luis85/motorsport-manager/actions/runs/38120778500) |
| Character Studio | [38120778508](https://github.com/Luis85/motorsport-manager/actions/runs/38120778508) |
| Standalone application | [38120778496](https://github.com/Luis85/motorsport-manager/actions/runs/38120778496) |
| Content/export | [38120778530](https://github.com/Luis85/motorsport-manager/actions/runs/38120778530) |
| Runtime confidence | [38120778520](https://github.com/Luis85/motorsport-manager/actions/runs/38120778520) |
| Native Godot | [38120778592](https://github.com/Luis85/motorsport-manager/actions/runs/38120778592) |
| Wildlands | [38120778477](https://github.com/Luis85/motorsport-manager/actions/runs/38120778477) |

Forge CI covers its unit/integration tiers, not separate browser e2e tiers;
advisory success is not fidelity certification. Native CI passed all six shards
and aggregation: **103 suites / 21,346 checks**, with **453 script loads per
shard**, using Godot **4.7.2.stable.official.ed1daf0bf**. Source SHA-256 is
`1fe7299f19d496c089017167270df438b17908bab515a857881c42f4c578e2bc`;
aggregate job **114421396940**. Its receipt is parsed from decoded GitHub job
logs; artifact ZIPs were not downloaded. Wildlands verification passed
**2,192/2,192 checks across 123 unique suites in 2,076.55 seconds**, using
**three jobs / two browser jobs**. Every suite count matched the registered named
inventory. Separate guarded Storytelling **24 checks** and Godot export
**21 checks** also passed. Raw artifact diagnostics could not be downloaded
(HTTP 403); the receipt is derived from decoded job logs and terminal summaries,
with uploaded artifact IDs/digests retained. The completed software observation
is described below. Portable receipts record [native](../_archive/armored-platoon-2026-10-11-evidence/ci/native/receipt.json),
[Wildlands](../_archive/armored-platoon-2026-10-11-evidence/ci/wildlands/receipt.json),
[supporting workflows](../_archive/armored-platoon-2026-10-11-evidence/ci/other/summary.json)
and [all terminal workflows](../_archive/armored-platoon-2026-10-11-evidence/ci/all-workflows-terminal.json).

The unchanged `bbf8475e` published demo completed a separate **1,800.000 wall
seconds / 121 samples** software observation: **7/7 exact paused checkpoint
restores**, **seven mission switches**, **338/338 scripted workload commands**
and **three accepted handovers after combat disability**. It recorded zero page
or console errors, warnings, command rejections or observation failures. Command
counts exclude shell automatic aim; final pause feedback that the gunner was
unavailable reflects station eligibility, not a runtime failure. Published bytes
were unchanged, and CDP, browser context and browser closed afterward.
The [stability summary](../_archive/armored-platoon-2026-10-11-evidence/stability/summary.json)
retains the source identity and raw scope.
This was native RAF on software SwiftShader at 960×600, not a hardware benchmark
or full Q03 acceptance. Unforced-GC heap observations do not establish leak
freedom; GPU residency, worst-case stress and context-loss recovery remain open.

New sessions select `tracked-force-v2`; checkpoint/catalog envelope version 1
is retained, and the saved solver determines behavior. Legacy v1 restores keep
their prior arithmetic and topology, without depot migration. This is runtime
restore compatibility: the browser host still requires a byte-equivalent
installed catalog. Saves predating supply/terrain catalog changes require their
matching old HTML build; new-demo compatibility with every old save is not claimed.
The final source passed the registered fast tier: **902/902 checks, 51 suites,
56.72 seconds**, explicitly partial acceptance. Included Armored Node suites
passed **68/68**: admission 5, runtime 11, original combat 17, collision 10,
v2 combat/AI 12 and logistics 13. The **local equivalent-tree** source SHA-256 is
`8b0c2b056e3bd005cc44ac5374709ec6cdc49e20fbc46c147a79b5f9ef74e7d1`.
The raw CI source hash was not printed. Successful CI identity guards verified
source/HTML against the gate before and after; the shared-tree receipt links
that checkout to the implementation without inventing an observed CI digest.
The complete **123-suite / 2,192-check** CI gate passed as recorded above. The final
12-check browser rerun **passed 12/12** using installed Chromium 151,
Playwright 1.63, software SwiftShader and offline fixture routing, including two
application-clock eight-second depot fixtures. Final CLI current-output and all
seven demo freshness checks also passed. An earlier intermediate build had its
own 12/12 result, retained separately from this corrected-artifact rerun.

The [11 October evidence archive](../_archive/armored-platoon-2026-10-11-evidence/README.md)
retains both identities. Its corrected visual captures observed zero page/console
errors and zero WebGL warnings, including mission replacement. These captures
use native RAF and explicitly admitted checkpoint positioning/enemy-ammunition
fixtures for isolated inspection; they are not command-only gameplay evidence.
All 133 obstacle bases now follow exact bilinear terrain, with Forge box centers
aligned to those authored bases. Earlier floating geometry and upload warnings
remain preserved as initial evidence. The collision legacy oracle uses unchanged
`0e7fede9` code; no broad reference parity follows.

| Final v2 artifact | Bytes | SHA-256 |
|---|---:|---|
| Published demo HTML | 1,843,079 | `d6371d5507f2d1d7ea442ca906b4ca4a499db216ee255f99356745ec28b80419` |
| Wildlands CLI | 13,722,773 | `cb23241d1863562fbc72b4c41372d08d20a99686de3c7c4d7f212cbd088e51bb` |
| Generated Armored HTML | 1,842,769 | `484b17fb09be946345d9efa5d6c7ddc109765590aabce8e2fee698e7feee51b7` |

The earlier 67/67 Node and 12/12 browser results and HTML SHA-256
`d7f8fde96476c39d8663a4d4ed3bd089d0d6e4ddcd33d466236c351d40a8ee2c`
remain intermediate evidence in that archive. Final browser/output acceptance
has its own rerun; the complete registered gate now has the separate CI pass
recorded above. Neither establishes reference fidelity or full M1–M5 acceptance.
Public-command Node routes, without checkpoint edits, reached the depot in all
three scenarios. Pine Ridge and Iron Counterattack each received one ammunition
round; enemy fire interrupted Crossroads service with depot stock unchanged.
These are route/service checks, not full v2 browser mission victories or human
balance evidence.

Continuous hull sweeps are planar yaw rectangles with a vertical height interval,
up to 64 subdivisions per tick, angular step at most 0.025 rad and total angular
travel capped at 1.6 rad/tick. Conservative turning, eight bounded depenetration
passes and four sliding iterations do not replace a full 3D rigid-body solver.
V2 mobility follows surviving driver/drivetrain/tracks even when aggregate status
is disabled; aim/fire follow gunner, gun and crew eligibility. Repair consumes a
kit on completion and cannot resurrect crew. HE affects one exposed track per
nearby hull, including friendlies, with cover occlusion and no internal blast.

Optional authored depots use finite ammo/kits, stationary timed transactions,
atomic completion and interruption without partial stock consumption. Faction
queries do not expose enemy depot stocks or active supply state. The
[current contract](armored-platoon.md) and [authoring guide](../how-to/armored-platoon-authoring.md)
specify limits and eligibility. UI depot fixtures and the complete registered
gate now have source-bound evidence; complete v2 mission journeys and reference
parity remain unverified. All prior mission, CI and
software stability records below remain attached to their earlier implementation.

## Earlier verification checkpoint and mission progression defect

At the earlier verified checkpoint, the integration branch was
`codex/armored-platoon`, published source checkpoint `187dd821316cb334f13947780bb5e135878bda2c`,
on base `749a9f6296f3beb665eedf1eda57ae8cbfd00b39`. Per-run source/content hashes
and complete-gate results belong
in the [integration record](../_archive/armored-platoon-2026-10-10-integration.md).
Old logs with failed type checks or formatting are retained evidence of their
own run; neither later source edits nor earlier green checks supersede them
without a corresponding rerun. Draft [PR #49](https://github.com/Luis85/motorsport-manager/pull/49)
is open on `claude/model-forge`, with published checkpoint HEAD
`187dd821316cb334f13947780bb5e135878bda2c`; the completed CI observation below
retains its earlier `f6d7c48d` identity. The PR is not merged. The integration
record maps earlier unpublished commit identities to public equivalents with
identical source trees after GitHub private-email protection required metadata-only
rebuilding. Native records under local `022da2a4` describe the same tree as public
`3e2bca33faef0d74aa3e400321b7e610a8365c3b`; they remain valid for that exact tree.

| Evidence | Observed result | What it establishes / does not establish |
|---|---|---|
| Runtime agent's isolated report `work/runtime-check/armored-runtime-results.json` | 11/11 focused checks passed in that report, including fresh LOS, ownership, restore, force/drive and slope cases | Domain foundation evidence; not the complete registered gate or reference handling calibration. |
| First compiled browser artifact, 1,796,897 bytes | 8/9 checks passed; exact paused checkpoint replacement failed | A stale compiled host released controls after replacing state, mutating restored motor/sequence. The source correction existed, but that tested artifact did not contain it. |
| Rebuilt browser artifact, 1,802,555 bytes, SHA-256 `dffbbdb19f615925a09631cd3e84621742b2fb243feae218e2d3452f5a339558` | Verification agent confirmed **9/9** focused checks, including UI save/load rejection and exact API restore, offline | Intermediate software SwiftShader artifact passed; this does not verify later regenerated artifacts or complete missions. |
| Browser captures | Chase/gunner, 1024/1440 and phone observation from Chromium 151 software SwiftShader | Actual application visual evidence, not hardware performance, Safari coverage, approved regression baselines or reference fidelity. |
| Real motion capture | 5.6066 m movement, 0.325 rad traverse, ammo 15 → 14, tick 0 → 127 across 15.196 seconds wall time / 21 captured frames | Actual application motion; sparse software capture is not a rendered-FPS benchmark or reference motion comparison. |
| Model Forge complete gate | 176 unit + 4 end-to-end tests passed after formatting correction | Tool gate evidence; no production-art or other-project gate acceptance inferred. |
| Scene Forge and generated-output checks | Existing inline-HTML e2e mode passed 15/15 after file-URL policy blocked the initial run; all four CLI and all seven demo checks passed at the earlier checkpoint, including both Forge check:cli | `FORGE_TEST_INLINE_HTML=1` disclosed; Character final handoff passed eight variants with all four CLI hashes unchanged. Complete Wildlands/native gate success is not inferred. |
| Native baseline | VIEWS failed at untouched `749a9f6296f3beb665eedf1eda57ae8cbfd00b39` with Godot 4.6.3; the same targeted test passed on CI-SHA-verified Godot 4.7.2: 1 test, 73.962 seconds | Targeted environment mismatch resolved; local full run on public-equivalent tree `3e2bca33faef0d74aa3e400321b7e610a8365c3b` was interrupted to free CPU; separate remote native gate passed 103 suites / 21,346 checks at `f6d7c48d`. |
| Wildlands complete gate | Earlier `187dd821` CI attempt 2 succeeded: 120 suites / 2,154 checks in 1,870.39 seconds; additional Storytelling 24/24 and Godot export passed. Original local run remains failed: 115/120 suites in 2,545.07 seconds | Engine-source SHA-256 `6f000038fcbdf3b3702cdb15af81c117c479492c25089dc049964e66ad10b541`. Local 2,084/2,084 excludes 70 expected checks from failing suites; successful CI has its own complete 2,154/2,154 evidence. Earlier interrupted/failed runs remain separate. |
| Forge authoring | At this historical checkpoint, two distinct original studies and guarded Model Forge → Scene Forge → runtime handoff were present | Then-scalar PBR geometry with semantic pivots/volumes; this historical evidence does not verify the later native finish refinement. Damage uses its approximation rather than authored semantic-volume collision. |

Earlier published head `f6d7c48d03f5bf85da5af63ee008933f45b831e6` has passing Model
Forge, Scene Forge, Character Studio, source, advisory, standalone and
content/export CI workflows. Native run 38085245903 passed all six shards and
aggregation: **103 suites / 21,346 checks**, source SHA-256
`c942e05697e6f3e0f5a0ec2269481560026b9536db3cb0cc787f9ffa821ef356`;
runtime-confidence run 38085245908 passed on Linux and Windows. The local Python
suite completed with exit 0: **346 tests in 1,558.848 seconds, 345 passed and one
expected Windows-only skip**, on the exact SHA-verified Godot 4.7.2. The skipped
Job Object regression was
`test_windows_engine_cannot_spawn_descendants_before_job_assignment`.
The Windows CI pass remains separate from that unexecuted Linux test. Exact
run links, the Wildlands evidence-file failure and concrete continuation commands
are in the [integration record](../_archive/armored-platoon-2026-10-10-integration.md#published-head-ci-and-local-evidence-report-correction).
These statuses belong to that head and do not verify the later Wildlands fixes.
The native-input diff (`scripts`, `tests`, `config`, `project.godot`) from that
head to `187dd821` is empty; the archived native result keeps its original identity.

The published corrected CSS checkpoint is `187dd821316cb334f13947780bb5e135878bda2c`,
following reporter fix `49ad1d477877cf759ba27b93b7930b3650af80a8`. The confirmed
regression was unscoped `armored.css` selectors changing shared-showcase controls.
Every selector is now scoped to the Armored host, with a compiled-CSS
computed-property isolation regression. The focused gate passed **10/10 in
90.62 seconds**. The corrected Wildlands CLI and all seven demo output checks
passed (`css-isolation-output-checks.log`). The complete **120-suite/2,154-expected-check**
gate **failed** in 2,545.07 seconds: **115 suites passed, five failed**. All 82 Node
suites, Armored **10/10**, and Storytelling **24/24** passed. The aggregate
**2,084/2,084** includes only passing suites, excluding 70 expected checks
from the failing suites. It must not be presented as full acceptance.

Scene Editor failed during seven-second `trialBegin` setup (**0/1**), Process
Present failed title vertical fit at 390 px (**9/10**), and Engine Export
failed desktop startup at 22,986 ms (**11/12**). Serial unchanged-budget reruns
passed Scene Editor **33/33 in 95.788 seconds** and Engine Export **12/12 in
91.094 seconds**. Process Present remained **9/10 in 74.777 seconds**. A clean
exact-base `749a9f62` control reproduced that same slide-one failure at
**390×844**, **9/10 in 122.451 seconds**, under Chromium 151. Base/current
results are byte-identical, SHA-256
`6c889e2b556e7d74279530a1a0344f324735f70987d664c903a7d817b1407a5b`.
This establishes baseline reproduction, not a font/browser causal diagnosis. Artifact play (**0/4**)
and Game demos (**1/11**) encountered 14 managed-Chromium `file://` navigation
blocks, `ERR_BLOCKED_BY_ADMINISTRATOR`; no policy bypass or retry is underway.
Installing pinned Chromium 153 failed with HTTP 403 / Domain forbidden at
`cdn.playwright.dev`. Local 151 differs from CI 153, but this is not a proven
cause of the first three failures. The archive retains complete-gate JSON/log,
`css-isolation-full-*-results.json` and `pinned-browser-install.log`. Independent
CI run **38088144186 attempt 1 failed after 58 attempted suites** on
renderers-browser **13/14**, with a five-second Office click-actionability
failure; local renderers passed **14/14**. Remote Scene Editor **33/33**, Process
Present **10/10**, Engine Export **12/12** and Game demos **11/11** passed;
artifact play was not attempted. `serial-*`, `base-process-present-*` and
`ci-attempt-1-*` reports preserve each identity. Attempt 2, after one failed-job
retry, completed **SUCCESS**, verify job **114325176853**: **2,154/2,154 checks
across 120 suites in 1,870.39 seconds, jobs 3**. Additional observer-independent
Storytelling **24/24** and Godot export passed. Armored admission **4/4**, runtime
**11/11**, combat **17/17**, browser **10/10**, and Artifact play **4/4** passed.
`ci-attempt-2-verification.log` and `ci-attempt-2-provenance.json` retain successful
identities. Neither later success rewrites the original failed local run or CI
attempt 1. All `187dd821` implementation CI workflows passed; those historical
verification, native and software stability runs completed.

The receipt is derived from the exact workflow log/status, not a raw gate JSON.
The diagnostic artifact reached File Service, but its signed URL returned HTTP
403 when fetched into the workspace; the raw second-attempt gate and additional
Storytelling receipt remain in CI artifacts. Artifact IDs/digests and the source
identity guard provenance are retained explicitly.

At the earlier published `187dd821`, eight other workflows passed: source project,
Scene Forge, Model Forge, advisory, standalone tools, Character Studio,
content/export and runtime confidence. Exact-head native run **38088144152**
passed all six shards and aggregate, **103 suites / 21,346 checks**, at `187dd821`,
source SHA-256 `8d07fd8e647e275bd4920b7b9e50b93cd3fb9867af87dec9e60aed918838e32d`.
The archived `native-remote-current.json` is separate from the earlier `f6d7c48d`
pass and the interrupted local run.
Run links are in the integration record. The earlier `ff1d5c…` full run
was interrupted, preserving storytelling's 720-second timeout and scene-editor
30/33 click-timeout evidence in `wildlands-pre-css-*` reports. Later source edits
do not convert those failures into passes.

The corrected compiled artifact is 1,809,185 bytes, SHA-256
`4e7a24b09f490c2c87dcae6a04c9635198f465a612e0eed40991e374d91c0a6f`;
the demo is 1,809,495 bytes, SHA-256
`8587053e9591e505313a86936b8b0036a1088f4cb2d270d27ffba3210742e93b`.
`css-isolation-artifact-identity.json` records CLI/hash/engine identities and all
22 inline scripts matching the earlier demo. CSS differs; previous Pine/motion
captures retain their earlier artifact identities and are not new-byte execution.

Earlier runnable `187dd821` passed focused/output checks and complete
registered CI acceptance. That does not establish full reference parity or M1. The
selected base `749a9f62` passed complete CI run 38068118648; that result does
not validate this implementation. Preserve tested implementation SHA `187dd821`
if a documentation-only follow-up changes HEAD.

A completed software stability observation of the unchanged `187dd821` demo
ran **1,800.002 wall seconds**, **121 samples**, on Chromium 151 / SwiftShader
at **960×600**, using native RAF. It completed **371 accepted commands**, **seven
exact paused checkpoint restores**, and **seven UI mission switches**, with
zero command rejections, page/console errors or workload failures. Eight
warnings repeat one Three.js shadow-map deprecation. Canvas count stayed one,
DOM elements 178; CDP DOM nodes are a different metric (389 first, 496 final,
389–698 range). JS heap used was **27,340,736 first / 37,664,388 final bytes**,
range **12,895,360–57,610,472**, without forced GC. Eight separate mission/tick
intervals ran slower than wall time and must not be summed across resets.
`stability-summary.json`, `stability-observations.json`, `stability-identity.json`
and selected captures preserve the record. **Q03 remains partial**: this does
not prove leak freedom, hardware performance, production-hardware soak,
worst-case crowding, GPU disposal/resource residency or device/context loss.

Portable captures, motion and the Pine browser route are indexed in the
[evidence archive](../_archive/armored-platoon-2026-10-10-evidence/README.md).
The intermediate browser report is emitted at
`source/wildlands/verification/v15/armored-browser-results.json`; its captures
share that directory with `armored-` prefixes. Read its source/artifact identity
before citing results because the rerun replaces the prior report. The browser
checks exercise briefing/deployment, drive, paused query stability, camera
switching on one canvas, ammunition/reload, handover/orders and persistence
boundaries. They do not finish a complete shipping mission or establish a
30-minute soak. UI save/corrupt-load/valid-load checks now passed, and a phone-size
observation was captured; mobile playability and actual Safari remain unverified.

A command-only Orchard Road / crossroads development mission run exposed a real
progression deadlock. After **360 simulated seconds and 10,776 commands**, the
reach objective was complete but `clear-road` remained zero; two player vehicles
were destroyed, while the surviving player and all three guards had exhausted
AP ammunition. Guards remained impaired/immobilized. The existing elimination
condition required destruction, and the authored 75-damage AP produced 67.5
side-hit damage below a single-hit 70 crew threshold, so repeated turret damage
did not cumulatively disable the gunner. The report is
`work/armored-combat-review/route-report.json`; this was a failed bounded route,
not completed playthrough evidence.

The combat source now links station loss to associated component health at or
below 30% of maximum and lets an elimination objective count **disabled or
destroyed** targets; immobilization alone does not count. Mantlet damage remains
excluded from crew loss/firing disable. The content correction changes objective
copy to “Neutralize.” The correction and focused
cumulative-hit/objective regression are in the integration source. A post-correction
Crossroads command route subsequently passed, and Pine reached a visible browser
debrief, as described below. These are original development
rules and a playability correction, not measured reference tuning. G18–G20,
G35 and G39 remain partial because full content, normal-play balance and broader
parity acceptance are not established by these development scenarios.

A separate **Pine Ridge** bounded run completed the actual authored runtime
mission: fresh session, 1,800 accepted drive commands, no checkpoint restore or
state injection. The rally completed at tick 921 (15.35 seconds), retreat to
spawn cover occurred by approximately 34 seconds, and both goals were latched
at **victory tick 10,800 / 180 seconds**. The controlled tank suffered a gunner
casualty and became disabled while the platoon remained alive. The source-bound
report `work/armored-combat-review/pine-route-report.json` records Node v24.19.0,
base `749a9f6296f3beb665eedf1eda57ae8cbfd00b39`, individual runtime source hashes,
and catalog SHA-256
`34150dde0b643234feebc3ec58db3a8bc8b03a8090725a47a49f7805b38929f9`.
This establishes one command-only original mission completion. The separate
browser route below additionally establishes functional deployment/debrief;
human balance, M2 and reference mission parity remain unverified.

The subsequent **corrected Crossroads** authored runtime route also succeeded:
**5,692 validated commands**, victory at **tick 12,069 / 201.15 seconds**, and
objectives `clear-road=3`, `secure-crossroads=1`, with no restore or state
injection. The source-bound
`work/armored-combat-review/crossroads-neutralize-report.json` carries the same
catalog/runtime hashes as the Pine report above. One player tank was lost;
after handover, allied reserves selected HE to conserve AP, the route waited
for guards to expend AP, then flanked east and used six upper-side/rear turret
shots to disable the three gunners. Two allies survived. This establishes
command-route reachability after the correction while exposing an AI/ammunition
balance weakness; it does not establish ordinary-play difficulty or human
usability. Keep the failed pre-correction route alongside this successful one.

The final-artifact **Pine browser route** passed menu → mission selection →
deployment → victory/debrief at **tick 10,800**, through **1,799 accepted drive
commands**, with `hold-ridge=180`, `rally-platoon=1` and zero script errors.
The artifact is **1,803,580 bytes**, SHA-256
`9b561acf571dcce27c76ba68bcdc85e0ef02b8215cefe1d471401b32a60f686e`.
The route used only public queries/commands, with no restore or state injection.
SwiftShader execution took **437.834 seconds wall time**, supplying 100 ms per
RAF callback through the application's six-tick cap. Route viewport was 480×320
then 320×240; the final visible debrief was captured at 1440×900. Report:
`work/armored-pine-browser/pine-browser-result.json`, preserved in the portable
evidence archive with `pine-victory-debrief.png`. This is functional browser
coverage under a supplied accelerated clock and disclosed small viewport,
not an ordinary human realtime session or performance/fidelity evidence.
It does not transfer the intermediate artifact's 9/9 suite result to a different
artifact or establish a complete Crossroads browser route.

## Continuation contract

Do not narrow the intended full reference scope to these three original
scenarios or two generic tank studies. Current development content is Orchard
Road, Pine Ridge and Iron Counterattack; none closes a named reference mission
row. The generic M4 Sherman and Panzer IV studies do not establish exact
Late-Sherman/Ausf.-G variant acceptance. All R01–R12 fidelity comparisons,
V99/M99 scope enumeration and O04–O10 online-mode work remain open.

A continuation must preserve this branch/worktree and record the actual HEAD,
last runnable artifact hash, frozen catalog/content digest, active owner changes,
executed/failed/skipped checks and report paths. The immediate executable work is:

1. Preserve the passed Pine browser deployment/debrief route and complete
   Crossroads browser coverage; assess ordinary-play balance with human input
   and realtime clocks. Retain failed/successful command reports and exact
   source/content/artifact identities.
2. Retain the intermediate 9/9 browser report and motion capture; revalidate
   changed shipping artifacts and remaining focus/mobile/persistence edges
   without weakening assertions or inventing performance from sparse frames.
3. Preserve the v2 final fast 902/902 and Armored Node 68/68 results, corrected
   captures, final browser 12/12 and output checks, plus distinct intermediate
   evidence and the complete CI pass (123 suites/2,192 checks). Record tested
   implementation and equal-tree CI checkout separately from later docs HEAD;
   new implementation changes require their own verification.
   Preserve the CSS-corrected local Wildlands 115/120 failure, interrupted
   pre-CSS run, CI attempt 1 renderer failure and successful complete CI attempt 2
   as separate evidence. Retain unchanged-budget serial reruns, exact-base
   Process Present reproduction and concrete file-policy/download blocks.
   Preserve tested v2 implementation `bbf8475e` and its equal-tree CI checkout
   separately from historical `187dd821` and any later documentation HEAD.
   Retain the completed `bbf8475e` software observation separately from the
   historical native/observation successes and current native aggregate;
   none substitutes for full
   hardware/stress-soak acceptance.
   Preserve the passed remote native aggregate; local native was interrupted,
   not passed. Retain the
   completed local Python report (345 passed, one expected platform skip).
   Runtime-confidence CI already passed Linux/Windows.
   Retain existing CLI/demo/Character passes only
   for their recorded source identity; distinguish unavailable hardware from failures.
4. Obtain installed reference build/roster evidence and ordinary-gameplay motion
   for all twelve situations. Continue production texture/rig/physics work and
   measured baseline-hardware review toward M1; the current models do not pass it.
5. Continue full mission/logistics, infantry, production assets/tooling, genuine
   authoritative online modes and all remaining frozen roster work toward M2–M5.

## Gate state and unresolved blockers

M0 remains provisional until the complete reference scope can freeze; an
executable browser shell and first contracts can progress while those questions
remain explicit. M1 requires detailed production vehicles and measured fidelity,
handling and budgets. M2 requires a complete mission, M3 independently authored
content, M4 all verified content/modes including online multiplayer, and M5
fidelity/resilience/regression closure. Neither a primitive scene nor one working
shot closes these gates.

Concrete reference blockers: no installed version/roster audit, no decoded
reference motion or exact timestamps, no measured handling/timing/scale, and no
comparison on declared primary/compatibility hardware. Official text research
succeeded through the supported web service despite executor egress denial.
Obtaining a versioned ordinary-gameplay capture pack resolves a different gap
than merely opening more announcement pages. It must include settings and the
full menu/hangar/mode inventory. Manual zeroing and enlarged multiplayer caps
remain unverified shipped features.

Concrete next research actions: verify S8 rules in the current installed lobby;
record the current build ID; enumerate every roster/mission item; populate R01–R12
with frame/timecoded ordinary gameplay; measure handling with uncertainty; run
an independent matched-build fidelity review. Preserve all unresolved rows while
development continues. The [historical reference record](../_archive/armored-platoon-2026-10-10-reference.md)
contains the measurement protocol and provisional budgets, not performance claims.
