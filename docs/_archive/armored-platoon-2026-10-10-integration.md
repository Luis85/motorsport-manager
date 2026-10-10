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

Draft [PR #49](https://github.com/Luis85/motorsport-manager/pull/49) is now open,
stacked on `claude/model-forge` at the selected base
`749a9f6296f3beb665eedf1eda57ae8cbfd00b39`. Tested implementation source is
`187dd821316cb334f13947780bb5e135878bda2c`; the completed CI runs below retain
their earlier `f6d7c48d03f5bf85da5af63ee008933f45b831e6` identity. The PR remains a
draft; no merge or public deployment was performed.

GitHub's private-email protection required rebuilding only commit metadata for
three previously unpublished commits. Their trees are identical:

| Earlier local identity | Public equivalent |
|---|---|
| `022da2a41bf1be7dc09681b041c04e2229608b72` | `3e2bca33faef0d74aa3e400321b7e610a8365c3b` |
| `bc47aaeb65910ecae6f2c802800a288b81daea28` | `b2b10fbeabfcfb8460fad014fb3a2350c24fcf4b` |
| `6ec9f184` | `3679ff945d4e8975e56458c5bd6fcf8baeeefbf1` |

The native local run used its existing clean worktree under the earlier
`022da2a4` identity. Its exact source tree is public `3e2bca33`; this metadata-only
mapping preserves its source identity without pretending it executed under a new
commit identity. That local run was later interrupted to free CPU, not passed;
remote native CI subsequently passed on its separately recorded source below.
Earlier reports retain their identities.

## Ownership and integration board

| Owner | Files / responsibility | Dependency | Acceptance | State |
|---|---|---|---|---|
| Root | Admission, build registrations, catalogs, architecture maps, generated artifacts, verification queue | All contracts | Existing templates intact; armored folder builds via CLI | Checkpoint integrated; CLI/demo checks and current registered CI gates passed; full parity remains open |
| Runtime | Armored contracts, session, application, physics, checkpoint | Existing ECS | Explicit fixed step; detached queries; validated restore | Checkpoint implemented/reviewed; full handling parity open |
| Combat | Ballistics, AI, mission systems, combat tests | Runtime context | Authority resolves shots/orders/objectives once | Checkpoint implemented/reviewed; Pine/Crossroads runtime completion; Pine browser debrief passed |
| Presentation | Armored world, renderer, controls, audio, UI, host, template | Snapshot and Forge asset map | Menu → deployment → running browser; stable scene and controls | Checkpoint implemented/reviewed; Pine browser route/debrief passed |
| Assets | Model/scene recipes, semantic bridge, game folder, provenance | Catalog and visual package contracts | Guarded Model Forge → Scene Forge → runtime | Checkpoint implemented/reviewed; development geometry only |
| Reference | Dated source evidence and full gap ledger | Official accessible sources | No invented version, count, timing or motion evidence | Reviewed; reference build/roster/motion unavailable |
| Verification | Capability inventory, independent review, browser suite | Integrated build | Reproducible checks and limitations | Checkpoint, Pine browser route and software stability reviewed; current CI passed, full parity/hardware gaps remain |

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

Earlier implementation source checkpoint: `b2b10fbeabfcfb8460fad014fb3a2350c24fcf4b`.
Tested corrected implementation checkpoint: `187dd821316cb334f13947780bb5e135878bda2c`. Interrupted local native full-run source
identity is separately `3e2bca33faef0d74aa3e400321b7e610a8365c3b`. Per-artifact manifests and report hashes,
rather than the moving branch name, identify each run. Portable captures, motion
and the browser mission result are indexed in the
[evidence archive](armored-platoon-2026-10-10-evidence/README.md).
These are checkpoint results, not M1–M5 acceptance:

- Model Forge's complete gate passed: **176 unit tests and 4 end-to-end tests**.
  Its earlier formatting failure was corrected and rerun; the pass does not
  establish production vehicle fidelity or the other projects' complete gates.
- Scene Forge's unchanged end-to-end suite passed **15/15** with the existing
  `FORGE_TEST_INLINE_HTML=1` mode explicitly selected after file-URL policy blocked
  the initial run. The earlier checkpoint passed **all four CLI bundles and all seven
  generated demos**, including both Forge `check:cli` checks. Character Studio's
  final handoff passed **eight variants**; all four CLI bundle hashes stayed
  unchanged across that handoff. This confirms generated-output consistency,
  not complete Wildlands/native gate acceptance.
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
  gate. Local full native execution on the tree corresponding to
  `3e2bca33faef0d74aa3e400321b7e610a8365c3b`, with pinned Godot 4.7.2 and user Xvfb,
  was interrupted to free CPU. It is not a full pass. Separately, remote native
  CI passed all six shards and aggregation on `f6d7c48d`: **103 suites / 21,346
  checks**, with pinned Godot 4.7.2; see its exact source identity below.
- Wildlands CLI/demo generation and current-output checks passed as recorded
  above. The corrected complete registered gate failed in five browser suites,
  as recorded below; output checks do not establish full-gate success.

The [parity ledger](../reference/armored-platoon-parity.md) records the failed
360-second Crossroads route, its cumulative-damage/neutralization correction,
all remaining requirements, and continuation priorities. Source commits,
generated manifests/digests and complete results below identify each run. A
later documentation/evidence-only commit is not a new implementation test.
Intermediate artifact success cannot verify a later changed artifact.

### Published-head CI and local evidence-report correction

The following completed CI status belongs to the earlier published head
`f6d7c48d03f5bf85da5af63ee008933f45b831e6` on draft PR #49. The current published head is
`187dd821316cb334f13947780bb5e135878bda2c`; newer Wildlands changes require their
own source-bound validation.

| Workflow | Run | Observed status |
|---|---|---|
| Model Forge | [38085245889](https://github.com/Luis85/motorsport-manager/actions/runs/38085245889) | Passed |
| Scene Forge | [38085245882](https://github.com/Luis85/motorsport-manager/actions/runs/38085245882) | Passed |
| Character Studio | [38085245875](https://github.com/Luis85/motorsport-manager/actions/runs/38085245875) | Passed |
| Source checks | [38085245878](https://github.com/Luis85/motorsport-manager/actions/runs/38085245878) | Passed |
| Advisory quality | [38085245950](https://github.com/Luis85/motorsport-manager/actions/runs/38085245950) | Passed workflow; advisory scope retained |
| Standalone tools | [38085245883](https://github.com/Luis85/motorsport-manager/actions/runs/38085245883) | Passed |
| Content/export | [38085245907](https://github.com/Luis85/motorsport-manager/actions/runs/38085245907) | Passed |
| Native Godot | [38085245903](https://github.com/Luis85/motorsport-manager/actions/runs/38085245903) | Passed all six shards and aggregate: 103 suites / 21,346 checks |
| Runtime confidence | [38085245908](https://github.com/Luis85/motorsport-manager/actions/runs/38085245908) | Passed on Linux and Windows |
| Wildlands | [38085245890](https://github.com/Luis85/motorsport-manager/actions/runs/38085245890) | Failed: required combat evidence file missing despite 17/17 assertions passing |

Native evidence is preserved in
[native-remote-final.json](armored-platoon-2026-10-10-evidence/native-remote-final.json).
Its source SHA-256 is
`c942e05697e6f3e0f5a0ec2269481560026b9536db3cb0cc787f9ffa821ef356`,
using SHA-pinned Godot 4.7.2. The duel suite passed 149 checks in 1,154.617 seconds.
The diff from `f6d7c48d` to current `187dd821` is empty for `scripts`, `tests`,
`config` and `project.godot`; this preserves those native inputs, while the
remote result itself remains bound to its original commit.

The local Python suite completed with **exit 0: 346 tests in 1,558.848 seconds,
345 passed and one expected Windows-only skip**, using the exact SHA-verified
Godot 4.7.2. The skipped Windows Job Object regression is
`test_windows_engine_cannot_spawn_descendants_before_job_assignment`.
Runtime-confidence Windows CI passed independently; that workflow pass is a
separate result and does not relabel the Linux skip as an executed test.

The Wildlands failure is a real gate failure. The local correction writes
`armored-combat-results.json` from the test's existing results; it does not weaken
or remove assertions. The corrected source's fast tier passed **866/866 checks
across 48 suites** (`partial-passed`, 164.79 seconds in the retained log).
Its full **120-suite / 2,153-check** gate, engine-source SHA-256
`ff1d5c640032943a051d897a5b3d6a1d476b56e88bf4a163df0f75b44c6a0b5c`, was subsequently
**interrupted, not passed**, after a real CSS isolation defect was found.
`wildlands-pre-css-interrupted.json` and `wildlands-pre-css-progress.json` in the
evidence archive retain that disposition and prior progress. The old storytelling
suite timed out after 720 seconds; scene-editor browser checks had click timeouts
and 30/33 success. Do not attribute every timeout solely to the confirmed CSS
problem without a corrected rerun. The published CI failure remains failed until
a corrected push receives new evidence.

### Current published-head CI observation

At exact published head `187dd821316cb334f13947780bb5e135878bda2c`, these
additional workflows completed successfully. They are separate from the earlier
`f6d7c48d` results above:

| Workflow | Run | Observed status |
|---|---|---|
| Source project | [38088144210](https://github.com/Luis85/motorsport-manager/actions/runs/38088144210) | Passed |
| Scene Forge | [38088144169](https://github.com/Luis85/motorsport-manager/actions/runs/38088144169) | Passed |
| Model Forge | [38088144225](https://github.com/Luis85/motorsport-manager/actions/runs/38088144225) | Passed |
| Advisory quality | [38088144191](https://github.com/Luis85/motorsport-manager/actions/runs/38088144191) | Passed workflow; advisory scope retained |
| Standalone tools | [38088144147](https://github.com/Luis85/motorsport-manager/actions/runs/38088144147) | Passed |
| Character Studio | [38088144162](https://github.com/Luis85/motorsport-manager/actions/runs/38088144162) | Passed |
| Content/export | [38088144201](https://github.com/Luis85/motorsport-manager/actions/runs/38088144201) | Passed |
| Runtime confidence | [38088144154](https://github.com/Luis85/motorsport-manager/actions/runs/38088144154) | Passed |
| Native Godot | [38088144152](https://github.com/Luis85/motorsport-manager/actions/runs/38088144152) | Passed all six shards and aggregate: 103 suites / 21,346 checks |
| Wildlands | [38088144186](https://github.com/Luis85/motorsport-manager/actions/runs/38088144186) | Attempt 2 succeeded: 120 suites / 2,154 checks, additional Storytelling 24/24 and Godot export passed; attempt 1 failure retained |

Exact-current native evidence is archived in
[native-remote-current.json](armored-platoon-2026-10-10-evidence/native-remote-current.json),
bound to `187dd821` and source SHA-256
`8d07fd8e647e275bd4920b7b9e50b93cd3fb9867af87dec9e60aed918838e32d`.
All six shards and aggregation passed **103 suites / 21,346 checks**. The long
duel took **1,447.471 seconds** within its unchanged limit. The earlier `f6d7c48d`
pass and interrupted local run retain their own identities.

### Corrected CSS isolation checkpoint

Review found that global selectors in `armored.css` polluted the shared showcase
and could change other applications' controls/layout. Every selector is now
scoped beneath `html[data-wildlands-app="armored"]`. A new computed-property
regression checks the compiled stylesheet's isolation; no existing assertions
were removed. Reporter commit `49ad1d477877cf759ba27b93b7930b3650af80a8` precedes
CSS/regression/generated-output commit
`187dd821316cb334f13947780bb5e135878bda2c`, now pushed to draft PR #49.

The new focused strict-build/browser gate passed **10/10 checks in 90.62 seconds**
(52.12 seconds browser suite), explicitly `partial-passed`. Evidence is retained
as `css-isolation-focused-gate.json`, `css-isolation-armored-browser-results.json`,
the new chase capture and `css-isolation-artifact-identity.json` in the archive.
The corrected Wildlands CLI and all seven demo output checks passed; raw output
is in `css-isolation-output-checks.log` in the archive. The corrected full target
is **120 suites / 2,154 expected checks**, completed with **FAILED** status
in **2,545.07 seconds: 115 suites passed, five failed**, against engine-source
SHA-256 `6f000038fcbdf3b3702cdb15af81c117c479492c25089dc049964e66ad10b541`
at `187dd821`. All **82 Node suites passed**; Armored passed **10/10** in this
full run and Storytelling passed **24/24**. The report's **2,084/2,084** counts
accepted checks from passing suites only; it excludes 70 expected checks from
the five failing suites and is not a 2,154-check pass. Raw reports are archived
as `wildlands-complete-gate.json` and `wildlands-complete-gate.log`.

| Failed suite | Observed result | Remaining diagnostic |
|---|---|---|
| Scene Editor | 0/1; `trialBegin` setup exceeded seven seconds before assertions | Serial unchanged-budget rerun passed 33/33 in 95.788 seconds |
| Process Present | 9/10; title vertical fit failed at 390×844 | Serial rerun remained 9/10 in 74.777 seconds; exact-base control reproduced it |
| Engine Export | 11/12; desktop startup took 22,986 ms | Serial unchanged-budget rerun passed 12/12 in 91.094 seconds |
| Artifact play | 0/4 | Managed Chromium blocked `file://` navigation |
| Game demos | 1/11 | Managed Chromium blocked `file://` navigation |

The last two suites together encountered 14
`ERR_BLOCKED_BY_ADMINISTRATOR` file-navigation failures. No file-policy retry or
bypass is underway. Suite-level `css-isolation-full-*-results.json` and logs
preserve the original failures. Installing the standard pinned Chromium 153
failed with HTTP 403 / Domain forbidden at `cdn.playwright.dev`; the archive
retains `pinned-browser-install.log`. Local Chromium 151 differs from CI's
bundled 153, but that difference is not established as the cause of the first
three failures. The separate serial receipts/results/logs are retained as
`serial-scene-editor-browser-*`, `serial-engine-export-browser-*` and
`serial-process-present-browser-*`; none changes the original full-run outcome.

The clean exact selected-base `749a9f6296f3beb665eedf1eda57ae8cbfd00b39`
Process Present control also returned **9/10 in 122.451 seconds**, reproducing
the same slide-one title-fit failure at **390×844** under Chromium 151. Its
result is byte-identical to the current serial result, SHA-256
`6c889e2b556e7d74279530a1a0344f324735f70987d664c903a7d817b1407a5b`.
Base engine-source SHA-256 is
`b01c40daad1d0e48f443dd39a592fa5b01196671653a2a910ef970df5531e9e8`;
base HTML is 1,805,779 bytes, SHA-256
`4c578c4707bfa8a18258cc075a3a1806aacbbe75546c3a6417e94dd7b1c97bb1`.
The [base receipt](armored-platoon-2026-10-10-evidence/base-process-present-browser-receipt.json),
results and log preserve this evidence; its earlier harness launch-path failure
is separately retained. This establishes baseline reproduction on this browser,
not a causal font or browser-version diagnosis.

Independent CI run **38088144186 attempt 1 failed after 58 attempted suites**:
renderers-browser passed **13/14**, failing Office click actionability at five
seconds; the original local run passed **14/14**. CI passed Scene Editor
**33/33**, Process Present **10/10**, Engine Export **12/12** and Game demos
**11/11**. Artifact play was **not attempted**. Archived `ci-attempt-1-*` gate,
provenance and renderer reports retain these outcomes. One retry of the failed
CI job completed as **attempt 2, SUCCESS**, verify job **114325176853**. Its
complete registered gate passed **2,154/2,154 checks across 120 suites in
1,870.39 seconds, jobs 3**, on tested implementation `187dd821` and engine-source
SHA-256 `6f000038fcbdf3b3702cdb15af81c117c479492c25089dc049964e66ad10b541`.
Armored admission **4/4**, runtime **11/11**, combat **17/17**, browser **10/10**,
and Artifact play **4/4** passed. Additional observer-independent Storytelling
**24/24** and Godot export also passed. `ci-attempt-2-verification.log` and
`ci-attempt-2-provenance.json` in the archive preserve the successful run.
All current implementation CI workflows are now successful; no verification,
native or stability observation is still active. The original local 115/120
failure and CI attempt 1 remain failed historical outcomes, not overwritten.

The receipt is derived from the exact workflow log/status, not a raw gate JSON.
The diagnostic artifact reached File Service, but its signed URL returned HTTP
403 when fetched into the workspace; the raw second-attempt gate and additional
Storytelling receipt remain in CI artifacts. Artifact IDs/digests and the source
identity guard provenance are retained explicitly.

| Corrected artifact | Bytes | SHA-256 |
|---|---:|---|
| Wildlands CLI | 13,697,583 | `efdc491b1238c75cb2b8c1bb05d67b395cec5a0ecae4d447adf43fc64446d652` |
| Armored demo HTML | 1,809,495 | `8587053e9591e505313a86936b8b0036a1088f4cb2d270d27ffba3210742e93b` |
| Compiled Armored play HTML | 1,809,185 | `4e7a24b09f490c2c87dcae6a04c9635198f465a612e0eed40991e374d91c0a6f` |

The demo gzip size is 332,592 bytes; recorded engine identity is
`2338f02d9691a4629f35ddfa0b6d3c803832b3f9cc67ca468c54e42b01ccfe53`.
All 22 inline JavaScript scripts are byte-identical to the earlier `3679ff` demo;
CSS changed. This supports unchanged gameplay-code identity, not a new Pine
mission run. Earlier Pine/debrief/motion captures remain attached to their old
artifact hashes and cannot be claimed as execution of these corrected bytes.

### Completed software stability observation

The unchanged `187dd821` demo completed **1,800.002 wall seconds**, with native
requestAnimationFrame, Chromium 151 / SwiftShader at **960×600**. The archive
contains [stability-summary.json](armored-platoon-2026-10-10-evidence/stability-summary.json),
`stability-observations.json`, `stability-identity.json` and selected captures.
Across **121 samples**, the bounded workload completed **371 accepted commands**,
**seven exact paused checkpoint restores** and **seven UI mission switches**,
with **zero command rejections, page errors, console errors or workload failures**.
Eight warnings repeat the same Three.js shadow-map deprecation.

Canvas count remained one and DOM element count 178. CDP DOM-node count is a
separate measurement (389 first, 496 final, range 389–698). JS heap used was
**27,340,736 bytes first / 37,664,388 final**, range **12,895,360–57,610,472**,
without forced garbage collection. These observations do not establish leak
freedom, GPU resource disposal or hardware performance. The report retains
**eight separate mission/tick intervals**; simulation ran slower than wall time,
and reset intervals must not be summed as one continuous mission duration.
Q03 is **partial**: production hardware, crowded/full-stress scenarios,
GPU/resource counters and device/context-loss coverage remain outstanding.

The current runnable artifact is the `187dd821` demo identified above, with
focused Armored 10/10, generated-output checks and the complete registered
Wildlands gate passed. This is verified implementation acceptance, not full
reference parity or M1 acceptance. The selected base `749a9f62` had a passing complete
[CI run 38068118648](https://github.com/Luis85/motorsport-manager/actions/runs/38068118648),
which does not verify the new implementation. A later documentation-only HEAD
must be recorded separately from tested implementation SHA `187dd821`.

### Concrete resume commands

Inspect the retained completed runs and actual checkout identity before continuing.
No verification run remains active. Keep later builds serialized in the shared
Wildlands `.generated` directory:

```sh
gh run view 38085245890 --repo Luis85/motorsport-manager --log-failed
gh run view 38085245903 --repo Luis85/motorsport-manager
gh run view 38085245908 --repo Luis85/motorsport-manager
gh run view 38088144186 --repo Luis85/motorsport-manager --attempt 2
gh run view 38088144152 --repo Luis85/motorsport-manager
gh pr checks 49 --repo Luis85/motorsport-manager
git status --short
git rev-parse HEAD
git diff -- source/wildlands/source/test-armored-combat.cts
```

Preserve the failed full run and the separate completed serial/base-control reports.
Inspect `wildlands-complete-gate.json` and `wildlands-complete-gate.log` in the
evidence archive and CI run 38088144186. Do not rerun managed-browser file
navigation while its explicit policy block persists. If a new
source change requires rerunning, use the registered scripts sequentially from
`source/wildlands`:

```sh
npm test
npm run verify -- --jobs 3 --browser-jobs 2 --keep-going
npm run build:cli
npm run check:cli
npm run build:demos
npm run check:demos
```

The corrected harness and generated outputs are pushed through the existing
draft branch. Inspect the new CI run identities; do not reuse the old Wildlands
CI status as acceptance. For a needed native rerun, use a clean source worktree,
the CI-pinned Godot 4.7.2 binary and the repository display setup from
[verification](../how-to/verification.md). The local downloaded executable is
`work/godot4.7.2/Godot_v4.7.2-stable_linux.x86_64`, SHA-256
`8d106cbe6144c2dc7e881d61d2429c1a8a76e6b22ef48bd5e48dcf934953f71e`.
The native complete command is `python3 scripts/verify.py --godot <pinned-binary>`;
CI executes six registered shards and aggregates their exact coverage.

Remaining browser acceptance is explicit: Firefox/WebKit execution where
available, actual Safari/macOS/iOS, real controller/gesture/focus recovery,
ordinary realtime Crossroads/browser play, target GPU benchmarks, hosting
headers/cache/device-loss tests and full Q03 hardware/stress coverage. The successful software
Pine route and focused Chromium suite do not substitute for those checks.

### Continuation priorities

Preserve branch `codex/armored-platoon`, actual HEAD, source/content hashes, the
last runnable artifact, generated outputs, active owner changes and all
failed/skipped reports. Retain the five failed suites from the completed
120-suite local Wildlands run and serial/base-control outcomes as historical
evidence alongside the successful complete CI attempt 2. Retain exact-current
native success and the completed 30-minute software observation separately from full hardware/stress
requirements. The managed file-navigation policy and blocked browser download
are concrete environment constraints; neither converts a failed suite to a pass.
Preserve the passed remote native aggregate separately from the interrupted
local native run.
Retain CLI/demo and Character handoff results for their exact identities. Retain the passed
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
   hosting/cache/device failure checks and full hardware/stress soak coverage, complete every
   registered gate, and keep draft PR #49 reviewable without merging/publishing.

The two generic tank studies and three original development missions remain an
early milestone. They do not replace the requested full reference-game scope.
