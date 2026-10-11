# Armored Platoon v2 implementation evidence — 11 October 2026

Historical implementation record. This archive records a development increment,
not reference-game parity or final delivery. The [current contract](../../reference/armored-platoon.md)
and [parity ledger](../../reference/armored-platoon-parity.md) retain the broader scope.
The implementation continues the isolated `codex/armored-platoon` branch from
`0e7fede91f7de162accab4eeb36467a83a671f26`
on selected Model Forge base `749a9f6296f3beb665eedf1eda57ae8cbfd00b39`.

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
- Registered full inventory: **123 suites / 2,192 checks**. Complete CI results
  will be recorded separately after the implementation commit is tested.
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
