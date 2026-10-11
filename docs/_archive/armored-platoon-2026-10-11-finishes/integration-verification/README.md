# Armored Platoon integration verification — 11 October 2026

Historical verification evidence for implementation
`09ed672642aedee855d2d45f0e8c4a611127ca7b`. This checkpoint does not establish
AAA visual quality or full reference parity. The [current contract](../../../reference/armored-platoon.md)
and [parity ledger](../../../reference/armored-platoon-parity.md) define active scope.

## Source and generated output

GitHub Actions checked out synthetic merge
`ec88210c205a674cdb77f85cc2cc59d9feb3874c`. Both commits have tree
`7eb1dc63ee7709b75c0a835dcb14cbb3d509cf99`; the fetched commits have an empty
diff. The [checkout receipt](ci/checkout-identity.json) records that comparison.
The integration base is `3f56925b3532f015d9a29f19a998a05286b76f13`.
This attempt predates the subsequent finish-generation performance correction.

The shipped `demos/armored-platoon.html` is 4,438,590 bytes, SHA-256
`a15cb9df9468a2dbd5373f4ea4f345f8bf1ec83d80a0c598b63b59a626f7fdb6`.
All seven demos use engine
`b27121d71f43fff7f5af3cb5344118eac23781e3426610775f6e22a823268349`.
The [corrected artifact receipt](../review-fixes/corrected-artifacts.json)
identifies all five generated CLIs and the final demo.

## Completed verification

| Workflow | Result |
| --- | --- |
| [Source project](https://github.com/Luis85/motorsport-manager/actions/runs/38151353046) | Passed |
| [Godot verification](https://github.com/Luis85/motorsport-manager/actions/runs/38151353048) | Passed |
| [Wildlands complete gate](https://github.com/Luis85/motorsport-manager/actions/runs/38151353064) | Failed |
| [Scene Forge](https://github.com/Luis85/motorsport-manager/actions/runs/38151353022) | Passed |
| [Model Forge](https://github.com/Luis85/motorsport-manager/actions/runs/38151353075) | Passed |
| [Process Studio](https://github.com/Luis85/motorsport-manager/actions/runs/38151353182) | Passed |
| [Runtime confidence](https://github.com/Luis85/motorsport-manager/actions/runs/38151353080) | Passed |
| [Standalone application](https://github.com/Luis85/motorsport-manager/actions/runs/38151353083) | Passed |
| [Advisory quality](https://github.com/Luis85/motorsport-manager/actions/runs/38151353019) | Passed |
| [Character Studio](https://github.com/Luis85/motorsport-manager/actions/runs/38151353058) | Passed |
| [Content and exported runtime](https://github.com/Luis85/motorsport-manager/actions/runs/38151353043) | Passed |

The [complete Wildlands attempt](wildlands/receipt.json) failed after
106 of 141 suites were attempted: 2,055 recorded checks passed, but `asset-finish`
exceeded its unchanged 120-second limit. The job ran for 2,099.49 seconds in
the full gate. Its earlier fast tier passed the same nine finish checks in
79.45 seconds. The additional Storytelling 24 checks were skipped. This is
not a complete-gate pass. The separate native export passed 23 checks.
The [native Godot aggregate](native/receipt.json) passed all 103 suites /
21,346 checks across six shards with verified exact-run artifacts.

The separate local fast tier passed 1,058 checks in 56 suites; the Armored
browser fixtures passed 17/17. The [review corrections](../review-fixes/README.md)
retain the real pointer-lock reproduction, finish/surface admission regression,
Character Studio integration fix, and their exact artifact identities.

The [Forge and Studio receipt](forge/summary.json) records 182 Model Forge,
57 Scene Forge, 22 Process Studio and 52 Character Studio unit checks. Character
Studio also passed two integration checks, three browser checks and standalone
handoff. Model and Scene CI workflows do not run their browser tiers; earlier
local browser evidence retains its distinct environment and source scope.

The [runtime receipt](runtime/receipt.json) records successful Linux reproduction
and Windows SDK jobs. The Linux log exposes 19 reproduction checks and 453 script
loads. Exact final Python and Windows test totals were redirected to artifacts;
artifact downloads were blocked by the workspace proxy with HTTP 403. Artifact
IDs and reported digests are retained, without claiming their contents were
downloaded. Earlier local 361 discovered / 360 passed / one Windows-only skip
belongs to the previous source and remains separate evidence.

The complete [local quality analysis](quality/receipt.json) measured 1,812 files
on a clean copy of the final implementation. All five tools completed cleanly;
there were no size-budget, lint, formatting or complexity findings. The report
still contains 6,927 advisory long-line findings. Source digests before and after
analysis were identical.

## Browser observation and limits

The [frozen browser observation](stability/receipt.json) completed 1,800 wall
seconds, 121 samples, 375/375 scripted workload commands, seven exact paused
checkpoint restores and seven mission switches. There were no page errors,
console errors or warnings, command rejections or observation failures. Browser
resources closed successfully. Raw launch identity retains precommit `3ce1c8df`;
separate association receipts prove the frozen artifact and tracked source match
`09ed6726`. This observation does not verify later changed generator code.

Conservative allied blocking appeared in 16 of 363 sampled friendly projections;
five saved contexts admitted direct routes only in separate diagnostic copies
omitting allied hulls. These are sample observations, not incident counts.
Repair and resupply were covered by separate fixtures, not this observation.

The final capture shows development-level terrain, vegetation and vehicle detail.
Production art, articulated assets, world density, full content and multiplayer
remain unfinished. Procedural finish wear is generic surface detail. Installed
reference timings, ordinary human play review, actual Safari and target GPUs
remain unverified. This software-rendered observation establishes neither
hardware performance nor leak freedom.

## Evidence handling

The [staging manifest](staging-manifest.json) records original and stored file
hashes, byte counts and gzip transformations. The final `SHA256SUMS` covers every
stored file except itself. Original failed and interrupted attempts remain in
the parent archive and in the selected earlier receipts; they are not relabelled
as passes for this implementation. This attempt’s terminal CI metadata is retained
alongside readable summaries and complete compressed job logs.

The [runtime archive map](runtime/archive-map.json) resolves preserved execution-time
relative paths and compressed log names without rewriting original receipts.

HTTP response headers are stored as lossless gzip to preserve their original
CRLF bytes through Git checkout. The staging manifest records this transformation.
