# Armored Platoon reference research — 10 October 2026

> Historical research record. This records evidence available on 10 October 2026,
not acceptance of subsequent implementation. See the active
[parity ledger](../reference/armored-platoon-parity.md) and
[current status](../reference/current-state.md).

## Scope and source identity

The implementation brief requests a browser recreation of the observed gameplay
and presentation of Call to Arms: Panzer Elite with original/licensed assets.
This research does not authorize extracting its assets. Work began against
PR #47 head `749a9f6296f3beb665eedf1eda57ae8cbfd00b39`, supplied by the integrator,
with main identified as `65189223` (PR #43 merged). The integrator's ancestry
record remains authoritative for base selection. No installed reference game,
reference save, build manifest, or frame-accurate video capture was available.

The supported web browsing service opened the official sources below on
10 October 2026. Executor HTTP requests independently failed at its proxy with
`Tunnel connection failed: 403 Forbidden` for Steam and THQ hosts; the enforced
executor network policy permits package-manager/GitHub hosts. The web service is
a separate supported access path and successfully returned official page text.
Direct announcement-detail URLs failed in that service, but the official
announcement index returned their content. No bypass was attempted.

## Evidence register

IDs are stable keys used in the active ledger. Text paragraph names and dated
announcement headings are locators, not fabricated playback timestamps.

| ID | Source / reference date | Evidence and limits |
|---|---|---|
| S1 | [Steam listing](https://store.steampowered.com/app/1343070/Call_to_Arms_Panzer_Elite/), retrieved 2026-10-10 | Feature List advertises 5 campaign missions, 9 skirmish missions and 20 vehicles. Early Access answers retain launch counts of 3 campaign, 2 non-story and 3 skirmish maps; planned totals are separately stated. These are inconsistent scopes, not a current roster enumeration. German/US factions, solo/co-op/PvP are advertised. |
| S2 | [Developer explanation](https://store.steampowered.com/news/posts/?enddate=1758042104&feed=steam_community_announcements), 2025-09-16 | Locate “Call to Arms: Panzer Elite - What Is Early Access?” in the multi-game feed. Identifies first/third-person simcade and destructible combat. Schöneberg is named in a campaign image caption. This is historical scope, not current tuning. |
| S3 | [Official announcements](https://steamcommunity.com/app/1343070/announcements/), latest listed 2026-10-06 | Latest hotfix names St Vith engineer spawning. October update confirms M4A1 (75), Amblève River and cruise control. August completes the German campaign, adds M18/M24, individual orders and binoculars. March names Pz. III N, Le Dézert, Retake the Airfield, Radio Tower; June names Mont-Saint-Michel. Current numerical build is not stated in these headings. |
| S4 | [October update](https://thqnordic.com/news/rip-w-key-you-had-a-good-run-or-in-other-words-call-to-arms-panzer-elite-gets-a-fresh-update), 2026-10-01 | Corroborates M4A1 (75) Late Sherman, Amblève River Conquest, cruise control and navigation/control improvements. Its “summer 1944” replacement wording is less exact than Steam's “before September 1944”; prefer the latter for a later roster audit. |
| S5 | [Field HQ update](https://thqnordic.com/news/call-to-arms-panzer-elite-deploys-major-update-featuring-field-hq-system-and-new-mission-st-barthelemy), 2026-05-12 | Reinforcement points, persistent medals, St. Barthélemy, foliage occlusion and mantlet behavior are described. This verifies announced features; point values and repair timings remain unmeasured. |
| S6 | [Tank damage diary](https://store.steampowered.com/news/posts/?enddate=1752943622&feed=steam_community_announcements), 2025-07-19 | Locate “Dev Diary: Tank Damage System - Part 2.” Describes regional armor, projectile/angle-dependent penetration, ricochet and internal effects. Historical design description, not a validated formula/table for the current build. |
| S7 | [December content update](https://thqnordic.com/news/the-panther-is-out-of-the-bag-call-to-arms-panzer-elite-drops-new-content-update-today), 2025-12-16 | Panther, ALG A-1 and Testing Grounds described as 5v5 without AI. See S8's more specific bot distinction; do not conclude all bots are forbidden. |
| S8 | [December developer feed](https://store.steampowered.com/news/posts/?enddate=1765898660&feed=steam_community_announcements), 2025-12-16 | Complete official feed retrieved: content post says up to 5v5 without AI platoons; patch V0.05.02 explicitly permits bots in empty slots and caps total players at ten. This resolves the historical wording conflict, not current October lobby availability. |
| V1 | [Official August update trailer](https://www.youtube.com/watch?v=l1DcF9cthkk), linked from S3 | Web title identifies update 0.10.02. Promotional motion reference located, but frames/audio not decoded; no timecodes or measured motion claimed. This is not proof October's build is 0.10.02. |
| V2 | [Official earlier update trailer](https://www.youtube.com/watch?v=kzxs8ca3x90), linked from S4/S5 | Web title identifies patch 0.7.01. Promotional reference, not current ordinary gameplay. Frames/audio unavailable for this review. |

## Conflicts and unresolved baseline

Latest *listed announcement* is 6 October 2026; installed build number remains
unknown. The scope is **provisional**, not a frozen exhaustive roster. Steam
headline counts, launch FAQ counts and subsequent additions cannot be combined
arithmetically: replacements, modes and variants may overlap. The index's August
completion claim does not enumerate every campaign mission. A roadmap does not
establish shipped manual zeroing, 10v10, or extra factions. S8 establishes historical Testing Grounds 5v5, no AI platoons, and permitted
empty-slot bots. Neither it nor “up to 10 players” proves 10v10 or ordinary
platoon skirmish caps. S3's February roadmap discusses larger matches, not a
verified release. No numeric parity percentage is assigned.

Read the index's exact dated section before extending a row. A text claim is
`verified-claim`; an observed frame/interaction is `observed`. Neither alone
establishes tuning, availability in every mode, or current installed behavior.
Further research must record installed build, owned edition/content, settings,
full hangar roster and mission selection screens, plus continuous gameplay.

## Twelve required comparison situations

These are an evidence catalog and capture queue, not twelve completed visual
comparisons. S3 image locators name their surrounding announcement section;
they remain findable when CDN hosts change. Settings, resolution, FOV, weather,
quality and capture date are unknown unless the source declares them. Every
row requires still **and** motion review; all motion timestamps are currently
`unavailable`. V1/V2 are promotional leads only. No gameplay measurements were
inferred from their titles or static art.

The mandatory rubric for **each** row is: (1) silhouette/proportions, (2) PBR
surface/detail, (3) world/prop density, (4) illumination/shadows, (5) camera
composition, (6) articulation/motion, (7) effects, (8) HUD legibility. Acceptance
requires a reviewer to record a finding in all eight fields against a matched
shipping route and to name every unresolved difference. For screens without
live vehicles/effects, explicitly mark the field not applicable rather than
silently passing it. Production art cannot pass through a box proxy.

| ID | Situation / evidence lead | Observable capture and acceptance criterion in addition to the eight-field rubric | Motion / current evidence gap |
|---|---|---|---|
| R01 | Hangar/platoon setup — S3 October “HUD, Controls & Menus”; S1 | Capture vehicle inspect, add/remove, budget and deployment. Labels, selected vehicle, disabled reasons and focus remain legible; model dimensions/material detail remain comparable while rotating. | Unavailable; actual hangar screens and rotation clip needed. |
| R02 | Chase view — S4 M4A1 announcement; V1 | Follow a driven tank across a rise and next to a wall. Compare screen-space hull size, horizon, camera lag/collision, moving shadows and reticle obstruction. | Promotional still lead only; matched FOV and motion needed. |
| R03 | Gunner optics — S3 March “Panzer IV. Ausf G Optics Corrected”; V1 | Sweep a near fence then distant vehicle at each zoom. Reticle markings, muzzle/parallax offset, stability and distant contrast must remain readable during traverse. | No inspected optic frame or zoom timing. |
| R04 | Commander/binoculars — S3 August “Binoculars”; [official still](https://clan.fastly.steamstatic.com/images/45657808/a0a575aede9b6c81b456ce33f184a3a58d160eb1.jpg) | Capture entry, scan, mark, exit and exposed-crew consequence. Hatch/crew proportions, optics overlay, animation continuity and visibility must agree. | Still URL resolved; no decoded motion or settings. |
| R05 | Driving terrain — S4 AI/vehicle notes; V1 | Drive/brake/reverse/turn over slope and ditch. Review track contact, wheel travel, weight transfer, dust, ground material and frame stability. | No measured speed, brake distance or turn rate. |
| R06 | Firing/recoil — S6; V1/V2 | Fire stationary and moving, close and long range. Review barrel recoil, suspension response, smoke light/depth, reload HUD and persistent projectile trajectory. | No frame-accurate fire/reload/recoil clip. |
| R07 | Armor hit — S6 “Hit Outcomes” / “Armor” | Shoot repeatable front/side/oblique regions. Outcome feedback, impact placement, ricochet direction, plate silhouette and component explanation must remain coherent. | Diagram/text evidence only; live impact timing unavailable. |
| R08 | Vehicle damage — S5; S3 August “Death Cam”; [official still](https://clan.fastly.steamstatic.com/images/45657808/8937986f09a1bb2cd7cee6033294f45c45505c2d.jpg) | Record track, engine, mantlet and fatal impacts then repair. Visual state, mobility, gun response, fire, crew status and death explanation must agree. | Still URL resolved; destruction and repair motion unavailable. |
| R09 | Platoon orders — S3 August “Platoon Commands & Individual Orders” | Show order stage, recipient stage, release and cancellation, then traverse a choke point. Order markers, formations, path changes and readable menus must persist. | Image lead exists; radial image fetch failed; no interaction video. |
| R10 | Village destruction — S2 destruction claim; S4 wall-pushing notes | Push through successive walls; fire at masonry; revisit wreck/rubble. Compare structure detail, fracture/effects, lighting and changed collision/navigation/cover. | No before/after or continuous destruction sequence. |
| R11 | Forest/open-field combat — S5 foliage; S3 June Mont-Saint-Michel | Capture dense concealment and open long-range combat separately with multiple units, smoke and shadows; low quality must preserve gameplay concealment. | Text leads only; density, engagement range and moving detail unmeasured. |
| R12 | Mission/debrief UI — S5 medals; S3 May “Medals & Recognition” | Play briefing → victory/failure → rewards → next/return. Compare hierarchy, icon/text clarity, input focus and persistence; no duplicate awards after restore. | No inspected UI still/transition clip or full-mission timing. |

## Measurement protocol and provisional budgets

Do not invent reference acceleration, braking, turn/traverse/reload rates,
formation spacing or mission pacing. For each quantity, record source build,
mode, settings, sample start/end timestamps, frame rate, repeated samples and
uncertainty. Distance from uncalibrated perspective is an estimate. Use at least
three repeatable runs. Proposed comparison tolerances are ±10% for measured
handling/reload and ±5% for calibrated silhouette ratios; these are engineering
proposals to review after measurement, not accepted evidence or historical data.

Intended baselines (unavailable in this cloud executor): primary desktop Intel
Core i5-12400, RTX 3060 Ti 8 GB, 16 GB dual-channel RAM, Windows 11, plugged in,
1920×1080 output/DPR 1, native internal resolution; compatibility Ryzen 5 5600G,
Vega integrated graphics, 16 GB dual-channel DDR4-3200, Windows 11, plugged in,
1280×720 output/DPR 1/native internal resolution. Browser version and graphics
driver must be pinned at execution. WebGL2 is the provisional graphics route;
no WebGPU support claim. Intended hardware is not available test hardware.

Target the brief's 58 FPS / p95 ≤20 ms / p99 ≤33.3 ms primary and 29 FPS /
p95 ≤36 ms compatibility after warm-up. Use the same commit, immutable content
manifest, assets and quality profile for fidelity and performance. Record actual
GPU adapter/backend, OS, browser, output/internal resolution, AA/upscaler,
power mode, dynamic resolution, CPU/GPU time separately and every quality
reduction. Headless/software rendering establishes correctness only.

Provisional cold-load contract: 50 Mbit/s down, 40 ms RTT, cold cache, baseline
primary hardware, ≤5 seconds shell and ≤20 seconds first playable after start;
warm cache ≤5 seconds. Initial play closure ≤80 MiB compressed, whole downloaded
mission ≤180 MiB. These targets are not measured and must freeze only at M1.

| Asset class | Initial compressed closure cap | Resident estimate cap | Notes |
|---|---:|---:|---|
| Engine/worker/WASM/decoders | 12 MiB | 128 MiB | Self-host pinned dependencies. |
| Vehicle geometry/rig/collision | 12 MiB | 128 MiB | At least two production opposing assemblies. |
| Terrain/building/vegetation geometry | 16 MiB | 256 MiB | LOD and streamed cells retain semantics. |
| Texture payloads | 30 MiB | 512 MiB | Include decoded/source buffers and GPU allocation estimates. |
| Audio/UI/miscellaneous | 10 MiB | 128 MiB | Bound decoded audio and active voices. |
| Simulation/navigation/effects working state | Included above where serialized | 256 MiB | Additional resident cap; ≤1.4 GiB total estimate. |

These are admission/measurement proposals, not existing raised game-folder
limits. Closed UTF-8 folders keep their current bounds until an explicit asset
pack contract exists. Benchmark 12 vehicles, 40 infantry, six smoke/fire plumes,
dense roadside foliage, wrecks and destruction, plus maximum verified content.
Run 30 minutes and repeated mission unload/reload cycles; report stable resource
counts, long frames, memory, network and voice budgets. No numeric GPU time or
resident-memory acceptance has been measured in this research workstream.
