# Armored Platoon parity ledger

The full requested parity target remains **incomplete**. This is a provisional
requirements and evidence inventory, not a claim that a reduced proving ground
matches the complete reference. Initial baseline audit is against `749a9f6296f3beb665eedf1eda57ae8cbfd00b39`.
The implementation update records source checkpoint `bc47aaeb65910ecae6f2c802800a288b81daea28`
and scoped reports; integrated changes require source-bound evidence before rows can close. See [current status](current-state.md)
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
| G22 | Resupply | B §7 | planned | Authoritative ammo/resource transfer | Transactions | Runtime/Content | Partial/full resupply and repeat request | open | Reference station and capacity rules |
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
| P01 | Vehicle fidelity | Accurate proportions, tracks, bevels, attachments/weathering | Production models/PBR | Tools/World | R01–R08 close and moving views | Detailed assets and comparative review | partial |
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
| T01 | Model materials | Semantic texture channels, color spaces, sampler/UV transforms | Shared model kernel | Tools | Texture/UV round-trip plus legacy scalar fixture | Production textures and loss checks | open |
| T02 | Model ingest | Preserve supported hierarchy/pivots/textures/skins/animation | Dedicated production codec | Tools | Import/export real rigged asset; reject required loss | Static proxy path insufficient | open |
| T03 | Vehicle authoring | Stable rig/socket/anchor/collision/damage volume IDs | Guarded model workflow | Tools/Content | Model Forge → Scene Forge → runtime fixture | Required semantics must survive | partial |
| T04 | Battlefield authoring | Terrain/road/scatter/destruction/objective editing with undo | Scene tooling/compiler | Tools/Content | Different topology/objective flow through documented commands | Reusable workflow and diagnostics | partial |
| T05 | Asset packs | Immutable hashes, provenance, bounded self-hosted formats/decoders | Explicit admission contract | Tools/Build | Corrupt/traversal/missing/oversize rejection | Binary distribution and license inventory | partial |
| T06 | LOD/streaming | Preserve simulation relevance and semantic anchors across LOD | Resource registry | World/Tools | Stream while switching direct control and firing | Measured working set and identity | open |
| T07 | Independent authoring | Different vehicle geometry/rig/material/socket/collision and mission | Documented public workflow | Tools/Content | Separate author produces variant without engine branch | M3 production demonstration | open |
| T08 | Renderer fallback | Feature matrix; controlled fallback resource reconstruction | Pinned Three.js | World | Force optional backend failure while simulation continues | No WebGPU parity assumed | open |
| Q01 | Performance | Named primary/compatibility targets and disclosed reductions | Shipping route/instrumentation | Verification | 12 vehicles/40 infantry/6 plumes plus max parity content | Real baseline GPUs unavailable | open |
| Q02 | Loading/memory | Separate cold/warm reports and class budgets | Asset manifest/profiler | Verification | Declared bandwidth/device then M1 budget freeze | Proposed caps unmeasured | open |
| Q03 | Long sessions | 30-minute combat and repeated mission cycles stabilize resources | Lifecycle counters | Verification | Hidden/pause/resume/control switching during streaming | Soak and disposal evidence | open |
| Q04 | Visual regression | Own approved captures separate from reference assessment | Deterministic fixtures | Verification | Fixed seed/time/camera/weather/assets and independent review | No capture proves parity by itself | partial |
| Q05 | Network quality | Independent clients with latency/jitter/loss/interruption | Impairment harness | Network/Verification | Reconnect and no duplicate shots/rewards or private state | Real authoritative online service | open |
| Q06 | Replay claim | Exact tested version/content/init order only | Recorded command stream | Runtime/Verification | Re-run declared scope; compare canonical checkpoints | Cross-browser lockstep unverified | partial |
| Q07 | Repository regression | Complete registered gates and regenerated CLI/demos | Integrator serialized build queue | Build/Verification | All relevant gates, old games, native boundaries | New source acceptance pending | partial |
| Q08 | Handoff | Source identity/artifacts/gaps/reproduction; draft PR, no merge | Delivery evidence | Integrator | Reproduce built game from clean checkout | Final M0–M5 exits not achieved | partial |

## Integrated foundation and measured scope

Implementation is progressing in the same branch; the rows above remain open
for parity acceptance. The following source bindings replace symbolic ownership
for the initial slice. This is a capability boundary, not M1/M2 completion.

| Area / ledger rows | Current source | Implemented foundation / remaining limit |
|---|---|---|
| G01–G05, P12 | [session](../../source/wildlands/source/armored-session.ts), [physics](../../source/wildlands/source/armored-physics.ts), [checkpoint](../../source/wildlands/source/armored-checkpoint.ts) | Separate 60 Hz ECS authority and tracked-force reconstruction; this is an explicit approximation, not proven rigid-body suspension/contact parity. Source tests cover query isolation, differential forces, braking/reverse, command rejection and checkpoint continuation. |
| G13, G16–G21 | [combat](../../source/wildlands/source/armored-combat.ts) | AP/HE/SMOKE ammo, reload, swept fixed trajectories, coarse oriented hull regions/angle outcomes, component/crew/fire state and timed repair. No historical calibration, complete spall, exposed-crew volumes, machine guns, blast-radius HE damage or resupply. |
| G25–G32 | [AI](../../source/wildlands/source/armored-ai.ts) | Orders, contact memory, 10 Hz acquisition and fresh line-of-sight checks before live target aiming; bounded grid path proposals feed motors. No complete traffic/cover tactics, swept footprint navigation or formation-through-choke guarantee. |
| G35–G39 | [mission rules](../../source/wildlands/source/armored-missions.ts) | Eliminate/reach/survive and time-limit outcomes only; cumulative crew damage and disabled-vehicle neutralization correction is present; Pine and corrected Crossroads command-only completion are demonstrated; Pine also reaches a visible browser debrief through public commands with an accelerated supplied clock. No complete trigger graph, campaign, Field HQ/logistics or reward progression. |
| T01–T06 | [catalog admission](../../source/wildlands/source/armored-catalog.ts), [visual admission](../../source/wildlands/source/armored-visuals.ts) | Bounded v1 data and static scalar-PBR Forge visuals/semantic bindings; production texture/skin/animation ingest and binary streaming remain open. |
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

## Verification checkpoint and mission progression defect

As of this ledger update, the authoritative integration branch is
`codex/armored-platoon`, source checkpoint `bc47aaeb65910ecae6f2c802800a288b81daea28`,
on base `749a9f6296f3beb665eedf1eda57ae8cbfd00b39`. Per-run source/content hashes
and complete-gate results belong
in the [integration record](../_archive/armored-platoon-2026-10-10-integration.md).
Old logs with failed type checks or formatting are retained evidence of their
own run; neither later source edits nor earlier green checks supersede them
without a corresponding rerun.

| Evidence | Observed result | What it establishes / does not establish |
|---|---|---|
| Runtime agent's isolated report `work/runtime-check/armored-runtime-results.json` | 11/11 focused checks passed in that report, including fresh LOS, ownership, restore, force/drive and slope cases | Domain foundation evidence; not the complete registered gate or reference handling calibration. |
| First compiled browser artifact, 1,796,897 bytes | 8/9 checks passed; exact paused checkpoint replacement failed | A stale compiled host released controls after replacing state, mutating restored motor/sequence. The source correction existed, but that tested artifact did not contain it. |
| Rebuilt browser artifact, 1,802,555 bytes, SHA-256 `dffbbdb19f615925a09631cd3e84621742b2fb243feae218e2d3452f5a339558` | Verification agent confirmed **9/9** focused checks, including UI save/load rejection and exact API restore, offline | Intermediate software SwiftShader artifact passed; this does not verify later regenerated artifacts or complete missions. |
| Browser captures | Chase/gunner, 1024/1440 and phone observation from Chromium 151 software SwiftShader | Actual application visual evidence, not hardware performance, Safari coverage, approved regression baselines or reference fidelity. |
| Real motion capture | 5.6066 m movement, 0.325 rad traverse, ammo 15 → 14, tick 0 → 127 across 15.196 seconds wall time / 21 captured frames | Actual application motion; sparse software capture is not a rendered-FPS benchmark or reference motion comparison. |
| Model Forge complete gate | 176 unit + 4 end-to-end tests passed after formatting correction | Tool gate evidence; no production-art or other-project gate acceptance inferred. |
| Scene Forge and CLI checks | Existing inline-HTML e2e mode passed 15/15 after file-URL policy blocked the initial run; both Forge check:cli checks passed; all four CLI bundles regenerated | `FORGE_TEST_INLINE_HTML=1` disclosed; Character initial handoff passed, final regeneration-bound handoff pending. |
| Native baseline | VIEWS failed at untouched `749a9f6296f3beb665eedf1eda57ae8cbfd00b39` with Godot 4.6.3; the same targeted test passed on CI-SHA-verified Godot 4.7.2: 1 test, 73.962 seconds | Targeted environment mismatch resolved; full native 103-check run is underway at `022da2a41bf1be7dc09681b041c04e2229608b72` with pinned 4.7.2 and user Xvfb; no full pass claimed. |
| Wildlands complete gate | Generation/check chain running before the complete gate; final results pending | Focused tests cannot substitute for the registered complete gate. |
| Forge authoring | Two distinct original studies and guarded Model Forge → Scene Forge → runtime handoff are present | Scalar-PBR development geometry with semantic pivots/volumes; not production-textured M1 assets. Damage still uses its approximation rather than authored semantic-volume collision. |

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
3. Finish the root-owned Wildlands generation/check chain and complete gate,
   the running native 103-check suite and final Character handoff. Both Forge
   CLI checks already passed; ensure every changed-engine demo is regenerated.
   Record each source identity and separate unavailable hardware from failures.
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
