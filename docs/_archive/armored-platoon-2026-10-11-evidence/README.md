# Armored Platoon v2 implementation evidence — 11 October 2026

Historical implementation record. This archive records a development increment,
not reference-game parity or final delivery. The [current contract](../../reference/armored-platoon.md)
and [parity ledger](../../reference/armored-platoon-parity.md) retain the broader scope.
The implementation continues the isolated `codex/armored-platoon` branch from
`0e7fede91f7de162accab4eeb36467a83a671f26`
on selected Model Forge base `749a9f6296f3beb665eedf1eda57ae8cbfd00b39`.
The tested implementation is `bbf8475e80d59754bef4df4448492979f492624c`.
GitHub's PR checkout is `9357f10ee7c4fb0b1b1b11735c715149ac9e2d1a`;
both have tree `d8993c022778faa911647e77bbc4a26cf8f16a40`, verified by
an empty tree diff in [checkout identity](ci/checkout-identity.json).

No integration-base change, shared-branch force push, merge or site deployment occurred.

## Implemented scope and ownership

| Owner | Integrated work | Acceptance boundary |
|---|---|---|
| Root | Solver/catalog/checkpoint contracts, finite logistics authority, integration, artifacts | Deterministic fixed ticks, bounded stock, staged save admission |
| Runtime | Frozen v1 adapter, v2 oriented planar hull collision | Swept translation, bounded rotation, world limits, legacy golden continuation |
| Combat | Independent crew stations, repair, ammunition decisions, HE blast | No wasted unviable AP; bounded external-track blast, cover and interruption |
| Assets | Three depot policies and grounded obstacle authoring | All 133 obstacle bases match bilinear terrain and Forge box centers |
| Presentation | Terrain/buildings/trees, lighting, service UI and lifecycle | Detached queries, CSS isolation, visible stock/progress and bounded feedback |
| Verification | Closed loader inventories, registered tests and authoring regression | Existing assertions and historical gate inventory preserved |
| Reference | Current contract, authoring guide and parity ledger | Explicit distinctions between implemented, observed and unverified behavior |

Fresh sessions use `tracked-force-v2`. Runtime restoration preserves the original
v1 solver, catalog and entity topology. Browser restoration still requires the
installed catalog to match the saved catalog; old browser saves need their
matching old HTML build. There is no silent content migration.

Depots have finite ammunition and repair-kit stocks. Service requires proximity,
neutral drive input and an available stationary crew. Completion transfers only
available stock up to vehicle capacity; movement, firing or damage interrupts
without partial payment. Tests cover competing vehicles, save continuation,
negative/over-cap stock, unfunded repairs, overlapping commitments, and damaging
hits on components whose health is already zero.

## Final local evidence

- Fast registered tier: **902/902 checks, 51 suites**, 56.72 seconds, three jobs.
  This is explicitly `partial-passed`, not the complete registered gate.
- Armored Node suites within that tier: **68/68** (admission 5, runtime 11,
  original combat 17, physics 10, combat v2 12, logistics 13).
- Final integrated browser suite: **12/12**, including CSS isolation, WebGL,
  driving/fire, pause/save/load and two timed depot UI fixtures.
- Final CLI and all seven demos match their fresh generator output.
- Registered full inventory: **123 suites / 2,192 checks**. The committed-build
  CI results below are separate from this partial local run.
- Strict TypeScript and TypeScript architecture **21/21** passed in the preflight.
  Native static architecture scanned **453 scripts** without violations.
- Scene Forge CLI rebuilt and checked current; its generated binary is unchanged.
- The final presentation capture observed **zero page/console errors and zero
  WebGL warnings**, including mission replacement. It uses software Chromium
  151, Playwright 1.63 and native RAF, with explicitly admitted checkpoint
  positioning and enemy-ammunition fixtures for isolated visual inspection.
- Public-command Node routes reached all three authored depots. Enemy fire
  interrupted Orchard Road service with stock unchanged; Pine Ridge and Iron
  Counterattack completed one-round transfers. These routes edit no checkpoints
  or private components. They do not establish browser mission completion,
  combat balance, hardware performance or human acceptance.

Final Wildlands source identity:
`8b0c2b056e3bd005cc44ac5374709ec6cdc49e20fbc46c147a79b5f9ef74e7d1`.
Artifact byte counts and SHA-256 values are in [artifact-identities.json](artifact-identities.json).
All archived files except this README and the manifest itself are indexed by
`manifest.json`; raw logs are losslessly gzip-compressed where applicable.

## Committed-build CI and software observation

All [ten implementation workflows](ci/all-workflows-terminal.json) passed.
Eight supporting workflows' exact counts, run/job identities and
scope are retained in [supporting workflow summary](ci/other/summary.json),
terminal receipts and complete compressed job logs.

- [Wildlands run 38120778477](https://github.com/Luis85/motorsport-manager/actions/runs/38120778477):
  **2,192/2,192 checks across 123 suites**, 2,076.55 seconds, three jobs.
  The separate Storytelling diagnostics-off **24-check** step and Godot export
  **21 checks** also passed. Verify job: `114414874915`; export job: `114414874751`.
  The [Wildlands receipt](ci/wildlands/receipt.json) matches every logged suite
  count to the committed named inventory. Its raw CI source digest was not
  printed; the local equivalent-tree digest above is labeled separately from
  CI's successful source/HTML identity guard.
- [Native run 38120778592](https://github.com/Luis85/motorsport-manager/actions/runs/38120778592):
  **103 suites / 21,346 checks**, all six shards and exact-coverage aggregate
  `114421396940` passed. The [native receipt](ci/native/receipt.json) retains
  source digest `1fe7299f19d496c089017167270df438b17908bab515a857881c42f4c578e2bc`,
  Godot `4.7.2.stable.official.ed1daf0bf`, Ubuntu 24.04.5 LTS and runner 2.337.0.

CI evidence is derived from terminal workflow metadata and complete decoded job
logs; it is not a claim that raw artifact ZIP contents were retrieved. Uploaded
artifact identifiers/digests remain in the receipts and logs. No failed-job
rerun was required for this implementation. Earlier failures remain preserved
with their original source identities. The returned diagnostics artifact's
signed download URL returned HTTP 403, so raw CI JSON reports were not retrieved.
Archived logs use `.gz`; receipts retain their original names and uncompressed
byte counts/hashes for verification after decompression.

The [software observation summary](stability/summary.json) records exactly
**1,800.000 wall seconds**, from 07:19:03.751 to 07:49:03.751 UTC on 11 October,
with **121 samples**, **seven exact paused checkpoint restores**, **seven menu
mission switches**, and **338/338 accepted scripted workload commands**. Three
control handovers followed combat disabling. It recorded zero page errors,
console errors/warnings, command rejections or observation failures. Published
demo bytes stayed unchanged; CDP, context and browser all closed successfully.

This used Chromium 151 / Playwright 1.63 / SwiftShader at 960×600 and native RAF,
without private ticks, fabricated checkpoint state or forced garbage collection.
The harness excluded destroyed allies and the current leader from follow/hold
recipients. Command totals cover explicit workload calls, not the shell's
automatic aiming. The final capture retains normal unavailable-gunner feedback;
it is not counted as a browser error. Repair/resupply coverage comes from the
separate focused tests, not this workload.

Canvas count stayed one and DOM element count 190. CDP DOM nodes ranged
418–826 (first 418, final 496). JS heap used was **19,741,072 first /
25,771,736 final bytes**, range **19,018,692–59,236,312**, without forced GC.
These measurements do not establish leak freedom, GPU resource disposal,
hardware performance or full Q03 acceptance. Separate mission tick intervals
must not be summed across resets; no FPS claim is derived from them.

`stability/` retains raw observations, JSONL logs (compressed), untouched
checkpoints, identities and exact scripts, plus start/final and the first/last
two transition captures. The local manifest also lists the unselected captures
and duplicate served HTML, retained locally in `work/armored-v2-stability/`.
The served HTML exactly matches the committed demo; it is not duplicated here.
To reproduce, copy `observe.cjs` and `summarize.cjs` into that work directory in
a built checkout at the tested implementation, then run them with Node.

## Findings preserved during implementation

The first rendered pass exposed obscured facade trim, protruding pine trunks,
floating obstacle bases and two WebGL texture-upload warnings during scene
replacement. The final source corrects these issues. `presentation/initial/`
retains the original captures and diagnostics; `presentation/` contains the
corrected captures and [visual review](presentation/visual-review.md). The initial generated HTML is retained compressed
in `intermediate/` with its distinct identity.

`intermediate/` also retains a failed experimental route assumption: it expected
an uninterrupted Orchard Road transfer despite enemy fire. The subsequent route
report records the actual interruption and verifies stock conservation instead
of claiming a completed transfer. A test run against a stale compiled logistics
test also failed after the source test had gained canonical entity sorting; the
freshly compiled registered run passed. That failure log remains preserved.

The earlier 10 October archive retains previous implementation failures,
baseline comparisons, full CI and the bounded 30-minute observation. Those
results do not verify this changed implementation.

## Reproduction and remaining scope

From the repository root, install the pinned Wildlands toolchain if needed, then
run `npm test -- --jobs 3` and `npm run verify -- --jobs 3 --browser-jobs 2` from
`source/wildlands/`. The complete runner uses its registered inventory unchanged.
Local software-browser checks use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`;
this override differs from CI's package-pinned bundled Chromium.

The archived capture and route scripts retain their original relative paths.
To rerun them, copy `presentation/capture.cjs` to
`work/armored-presentation-v2/capture.cjs` and `depot-command-route.cjs` to
`work/armored-v2-evidence/depot-command-route.cjs` in a built checkout.
They write only their respective `work/` directories and close browser resources.

Collision remains a terrain-plane approximation. HE affects exposed tracks,
not a full fragment/internal-component model. AI uses bounded shot selection,
not tactical flanking. Art remains original stylized studies; production assets,
infantry, complete reference roster/campaign, multiplayer, streaming, full device
recovery and target-hardware acceptance remain open. The installed reference
build and measured behavior baseline are still unavailable.
