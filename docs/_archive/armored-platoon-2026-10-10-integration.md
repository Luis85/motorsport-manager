# Armored Platoon integration — 10 October 2026

> Historical implementation record. This is a development checkpoint, not parity acceptance.
> See the [current contract](../reference/armored-platoon.md) and [parity ledger](../reference/armored-platoon-parity.md).

## Selected integration base

Isolated branch `codex/armored-platoon`, worktree `/workspace/work/armored-platoon`.
Base `749a9f6296f3beb665eedf1eda57ae8cbfd00b39`, inspected head of open draft
[PR #47](https://github.com/Luis85/motorsport-manager/pull/47), `claude/model-forge`.
Fetched main is `65189223545f717dd70460f9da838aef3b061587`. Main's one unique
commit merges PR #43; PR #47 includes the actual Character Studio lineage and
has 33 unique commits. It extends the brief's older `ef8ce788` with procedural
model/terrain/scatter authoring and safety/CLI fixes. Files, ancestor graph and
PR metadata were inspected before editing. No unrelated checkout was changed.

[PR #48](https://github.com/Luis85/motorsport-manager/pull/48), head
`42a3c086e442381ee62ddb872c4841178200827d`, is stacked on Process Studio #46.
Its common ancestor with #47 is `01bc13385e550cd96f2b5827e0477fb3e92dc6e0`.
It is not a compatible successor of Model Forge and was not imported.

## Ownership and integration board

| Owner | Files / responsibility | Dependency | Acceptance | State |
|---|---|---|---|---|
| Root | Admission, build registrations, catalogs, architecture maps, generated artifacts, verification queue | All contracts | Existing templates intact; armored folder builds via CLI | Checkpoint integrated; generation/check chain then complete gate pending |
| Runtime | Armored contracts, session, application, physics, checkpoint | Existing ECS | Explicit fixed step; detached queries; validated restore | Checkpoint implemented/reviewed; full handling parity open |
| Combat | Ballistics, AI, mission systems, combat tests | Runtime context | Authority resolves shots/orders/objectives once | Checkpoint implemented/reviewed; Pine/Crossroads runtime completion; Pine browser debrief passed |
| Presentation | Armored world, renderer, controls, audio, UI, host, template | Snapshot and Forge asset map | Menu → deployment → running browser; stable scene and controls | Checkpoint implemented/reviewed; Pine browser route/debrief passed |
| Assets | Model/scene recipes, semantic bridge, game folder, provenance | Catalog and visual package contracts | Guarded Model Forge → Scene Forge → runtime | Checkpoint implemented/reviewed; development geometry only |
| Reference | Dated source evidence and full gap ledger | Official accessible sources | No invented version, count, timing or motion evidence | Reviewed; reference build/roster/motion unavailable |
| Verification | Capability inventory, independent review, browser suite | Integrated build | Reproducible checks and limitations | Scoped checkpoint and Pine browser mission reviewed; full gates pending |

Only root runs shared Wildlands build/check/verify commands. Agents write disjoint
files. Model-kernel changes require both Forge builds. Native game contracts,
RTS step/save semantics, and closed-folder resource limits remain unchanged.

## Contract decisions

The independently versioned `armored` template uses existing Wildlands ECS,
content-provider admission, offline artifact assembler and game-folder digest.
Units: metres, seconds, kilograms, right-handed +Y up and local +Z forward;
simulation angles radians, Forge recipe angles degrees at the boundary.
The initial deterministic `tracked-force-v1` adapter is a constrained vehicle
solver, not a claim of complete rigid-body suspension/rollover parity.
It retains all motor/velocity/contact reconstruction state in checkpoints.
No proprietary reference assets are imported.

## Verification and continuation

Implementation source checkpoint: `bc47aaeb65910ecae6f2c802800a288b81daea28`. Native full-run source
identity is separately `022da2a41bf1be7dc09681b041c04e2229608b72`. Per-artifact manifests and report hashes,
rather than the moving branch name, identify each run. Portable captures, motion
and the browser mission result are indexed in the
[evidence archive](armored-platoon-2026-10-10-evidence/README.md).
These are checkpoint results, not M1–M5 acceptance:

- Model Forge's complete gate passed: **176 unit tests and 4 end-to-end tests**.
  Its earlier formatting failure was corrected and rerun; the pass does not
  establish production vehicle fidelity or the other projects' complete gates.
- Scene Forge's unchanged end-to-end suite passed **15/15** with the existing
  `FORGE_TEST_INLINE_HTML=1` mode explicitly selected after file-URL policy blocked
  the initial run. Both Forge `check:cli` checks passed; all four CLI bundles have
  been regenerated. Character Studio's initial handoff check passed; final
  regeneration-bound handoff confirmation remains pending.
- The intermediate Armored browser artifact passed **9/9** focused checks in
  Chromium 151 with software SwiftShader, including offline execution. Artifact
  SHA-256: `dffbbdb19f615925a09631cd3e84621742b2fb243feae218e2d3452f5a339558`
  (1,802,555 bytes). The first, older artifact had 8/9 because the compiled host
  mutated restored controls after replacement; the rebuilt confirmation passed.
- A real moving application capture records **5.6066 m** chassis displacement,
  **0.325 rad** turret traverse, ammo **15 → 14**, and simulation tick **0 → 127**
  across **15.196 seconds wall time / 21 captured frames**. This sparse software
  capture is motion evidence, not rendered FPS, real-GPU performance or reference
  fidelity. It must not be compared with the baseline frame-time targets.
- Pine Ridge reached **victory at tick 10,800 / 180 simulated seconds** through a
  fresh authored session and 1,800 accepted commands, with no checkpoint/state
  injection. Source/content hashes and full trace are in
  `work/armored-combat-review/pine-route-report.json`. This is command-only runtime
  completion, separate from the browser route described below.
  A subsequent corrected Crossroads command route also reached victory at tick
  **12,069 / 201.15 simulated seconds** with **5,692 validated commands**, three
  neutralized guards and two surviving allies, without state injection. See
  `work/armored-combat-review/crossroads-neutralize-report.json`. The tactic waits
  for enemy AP exhaustion before flanking; this exposes AI/balance limitations
  and does not establish normal-play difficulty or reference parity.
- The final-artifact **browser Pine Ridge route passed**: menu → Pine selection →
  deployment → victory at **tick 10,800 / 180 simulated seconds** → visible
  debrief, through **1,799 accepted drive commands**, without checkpoint restore
  or state injection and with zero script errors. Artifact SHA-256 is
  `9b561acf571dcce27c76ba68bcdc85e0ef02b8215cefe1d471401b32a60f686e`
  (1,803,580 bytes). Software SwiftShader took **437.834 seconds wall time**;
  the runner supplied 100 ms RAF deltas with the application's six-tick cap,
  used 480×320 then 320×240 during the route, and 1440×900 for the debrief capture.
  This is an accelerated-clock functional browser journey, not ordinary human
  realtime play, a reference fidelity comparison or hardware performance proof.
  Raw report: `work/armored-pine-browser/pine-browser-result.json`; portable copy
  and `pine-victory-debrief.png` are in the evidence archive.
- Native verification failed in **VIEWS** on the exact unchanged base
  `749a9f6296f3beb665eedf1eda57ae8cbfd00b39` with installed **Godot 4.6.3**; CI pins
  **4.7.2**. The CI-SHA-verified pinned binary passed that same targeted baseline
  test on the untouched commit: **1 test, 73.962 seconds**. This resolves the
  targeted environment mismatch; it does not establish a passing full native
  gate. Full native **103-check execution is running** on `022da2a41bf1be7dc09681b041c04e2229608b72`
  with pinned Godot 4.7.2 and user-owned Xvfb. No complete native result is claimed.
- Wildlands generation/check chain is running before its complete registered
  gate; no final generation/check-chain or full-gate result is claimed here.

The [parity ledger](../reference/armored-platoon-parity.md) records the failed
360-second Crossroads route, its cumulative-damage/neutralization correction,
all remaining requirements, and continuation priorities. Final source commit,
generated manifest/digests and complete gate results must be appended by the
integrator after the runs finish. Intermediate artifact success cannot verify a
later changed artifact.

### Continuation priorities

Preserve branch `codex/armored-platoon`, actual HEAD, source/content hashes, the
last runnable artifact, generated outputs, active owner changes and all
failed/skipped reports. Finish Wildlands generation/checks and its complete gate,
the running native suite, and final Character Studio handoff. Retain the passed
Pine browser route and verify Crossroads through browser play; assess both with
ordinary human input and realtime clocks. Automated completion, including the
Crossroads ammo-exhaustion tactic, does not establish the full single-player
slice or normal-play balance.

1. **M1:** obtain installed reference build/roster and timecoded gameplay evidence;
   replace development assets with production materials/rigs, improve physical
   handling, and measure fidelity/loading/performance on the named hardware.
2. **M2:** complete robust authored objectives, infantry, logistics, damage,
   destruction/replanning and persistence; prove complete browser missions,
   alternative objective orders, failures/restarts and repeated continuation.
3. **M3:** demonstrate independent different vehicle and mission authoring,
   required-semantic round trips, production material/asset-pack distribution,
   LOD/streaming and complete old-game/tool regression.
4. **M4:** enumerate and deliver the full verified frozen vehicle/mission roster,
   campaign/Conquest/skirmish progression and genuine authoritative co-op/PvP.
5. **M5:** close explained visual/behavior gaps, run real hardware/browser tiers,
   hosting/cache/device failure checks and the 30-minute soak, complete every
   registered gate, and provide a reviewable draft PR without merging/publishing.

The two generic tank studies and three original development missions remain an
early milestone. They do not replace the requested full reference-game scope.
