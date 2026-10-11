# Armored Platoon — final implementation evidence

Historical verification evidence. Use the
[current contract](../../../reference/armored-platoon.md) and
[parity ledger](../../../reference/armored-platoon-parity.md) for active scope.

This archive records implementation
`de06f7c353e0a170f8f9f9681a28f2544c9393c2` on
`codex/armored-platoon`. CI checks out synthetic PR merge
`319eb893c6d10b3f5eaa387cbb1bdf2300465a75`; both have tree
`b63851baa951f93b87859c222d706e00cf6bf0f6`. Individual receipts retain their
actual source, checkout, artifact and execution identities.

All **11 final CI workflows passed** on the identical-tree CI merge. The
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

## Archive layout

| Directory | Evidence and scope |
| --- | --- |
| `ci/` | Final checkout/tree identity, workflow and job conclusions, source checks and retained CI artifacts/logs. |
| `forge/` | Four terminal Forge/Studio workflows, complete job logs, generated executable freshness and checkout/artifact receipts. |
| `quality/` | Quality reports, exact invocations, tool logs and receipts; advisory findings retain their original severity and status. |
| `local/` | Local type, architecture, build, freshness and fast checks; source comparisons; raw browser evidence and explicit association with the final unchanged inputs. |
| `runtime/` | Runtime workflow results, logs and execution provenance. |
| `native/` | Native/Godot shard and aggregate results, logs, pinned runtime and source identities. |
| `wildlands/` | Complete Wildlands gate results and logs, kept separate from the smaller fast check set. |
| `stability/` | Fresh final-build observation, workload, samples, errors and artifact/source association. |
| `earlier-e9c/` | Superseded `e9c5571c` attempts, including failed, cancelled and interrupted evidence; these do not establish final acceptance. |

Consult `staging-manifest.json` for original and stored byte counts
and SHA-256 hashes. Gzip storage is lossless; it does not alter the original
receipt or log identity. Raw receipts retain their original work-relative paths;
use the staging manifest to locate corresponding archived files. A manifest
hash establishes file integrity, not a test
pass. Historical harness scripts are retained as passive `.txt.gz` files.
The interrupted historical observation retains its raw samples, commands,
checkpoint and harness; duplicate served HTML and earlier captures are omitted.
The final observation retains all seven checkpoint payloads, raw observations
and command/sample logs, passive harnesses, and start/final PNGs. Its 14
intermediate PNGs remain in the original capture inventory; the exact served
HTML can be recovered from the committed demo. Original Markdown reports are
stored passively as `.md.txt`; the staging manifest records this path mapping.

## Associated local evidence

The local fast run passed **1,058/1,058 checks in 56 suites in 88.38 seconds**
at `e9c5571cd116723e285dad5af1bb9adbb8badd3d`. The local Armored browser suite
passed **17/17** at that same raw implementation identity. Its isolated fixture
and browser provenance are retained in `local/browser/`; the fixture has its
own artifact hash and must not be confused with the published demo hash below.

`local/focus-fix-association.json` records that the subsequent final commit
changed only Character Studio dialog UI, its journey test and
`bin/character-studio`. Wildlands, Model Forge and Scene Forge source,
Wildlands/Forge/Process executables, demos and game folders were unchanged.
The relevant local test/source and generated artifact comparisons associate
those checks with final inputs; they do not relabel the earlier raw execution.

The final published demo is **4,439,139 bytes**, SHA-256
`783d8dc2fba68251420b2ee61b477677994b8839be62f0660f03f0c49ceda883`.
Its engine identity is
`de4233eee6ec157e2144166cd7f05af2a8f42795356b9b75608ceb4d366919ed`.

The final Character Studio repair prevents queued modal-close events from
replacing a newer deliberate focus choice or disturbing a reopened dialog.
The bounded diagnostic improved from **17/20 to 20/20 transitions**. Its final
workflow passed **52 unit, 2 integration and 3 browser checks**, standalone
handoff and executable freshness. The separate
[Character focus diagnosis](../character-focus/README.md) preserves both the
failure and corrected evidence. Model Forge passed 182 unit checks, Scene
Forge 57 and Process Studio 22; Model/Scene workflows do not run browser tiers.

## Fresh observation

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

Observation conclusions apply only to the recorded workload, duration,
software renderer/browser and artifact. They do not establish target-GPU
performance, ordinary human play quality, leak freedom or reference fidelity.

## Historical attempts and preserved failures

The optimized predecessor was
`e9c5571cd116723e285dad5af1bb9adbb8badd3d`, tree
`61796691e66afcc440731dab2305ad72579e8b77`, CI merge
`ac15a782eccec6a59a8707660d05cd5be14a5d02`. Its Character Studio keyboard chapter
journey failed before the focus guard. Its Wildlands full gate was cancelled;
the logged fast pass is not a completed full gate. Its six native shards and
aggregate were cancelled, with no completed shard report or aggregate count.
Partial logs or uploaded artifacts do not turn these attempts into passes.
Its Armored observation stopped at **221.7 seconds** for focus reproduction;
it was not a completed 30-minute observation. These records belong in
`earlier-e9c/native-ci/`, `earlier-e9c/ci-wildlands/`,
`earlier-e9c/verification/` and `earlier-e9c/stability/`, preserving original
conclusions and source identities.

The earlier `09ed672642aedee855d2d45f0e8c4a611127ca7b` full gate failed after
**106 of 141 suites were attempted**, with **2,055 accepted checks passing**,
when `asset-finish` exceeded its unchanged **120-second** cutoff. The
[performance correction](../performance-correction/README.md) retains the
failure, original profiles and exact-pixel comparison. All **81 recipes /
243 channel hashes** are unchanged. Local CommonJS profiles improved by
approximately **25–31%**; the roughly **33×** native VM probe improvement mainly
reflects removal of repeated contextified global lookup. Three temporary
Float64 fields require **384 KiB per call**, plus small tables. This is CPU
profile evidence, not browser frame-rate or hardware evidence.

A separate older observation associated with `09ed6726` completed
**1,800.000 seconds / 121 samples**, **375/375** accepted scripted commands and
**7/7** exact paused restores across **7** mission switches. Its raw launch
HEAD remains `3ce1c8df`; its own source/artifact association explains the
`09ed6726` relationship. It does not verify the current implementation.
Conservative allied blocking appeared in **16 of 363 friendly-vehicle
samples** on that older build. Five separate offline blocked contexts admitted
routes after allied hulls were omitted; this neither explains every sample nor
changes the observed gameplay. Fresh observation counts must remain separate.

The archive does not close AAA quality, full-content parity, M1–M5 fidelity,
infantry, complete campaign or genuine online multiplayer requirements.
Installed-reference/roster capture, ordinary human review, actual Safari and
specified target hardware remain separate acceptance work.
