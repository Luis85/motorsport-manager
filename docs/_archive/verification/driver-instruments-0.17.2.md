# Driver instruments — 0.17.2 verification record

> Historical evidence from the 0.17.2 instrument increment. Source identities, counts and limitations below belong to that run; they are not verification of the current checkout. For the maintained behavior contract, see [Driver instruments](../../reference/race-weekend/driver-instruments.md).

## Scope and base

Built on merged PR #16, main `81a4f9bbc05fdbf084292c3ab7c7c710b8252849` (source tree `ae2d06ff1d22e8c6d2d18456969b1c309002b16a`). Native Godot remains the implementation. The existing five driver actions, session flow, time controls, timing tower and TrackCanvas are retained. No new action, automatic decision, sporting modifier, physics change or save-schema migration is introduced.

## Verification scope

All domain/service files and `minimal/controls.gd` are unchanged from the merged baseline. Existing required minimal suites are extended in place; the full verification-runner registration is unchanged. New checks cover independent stress, observation/RNG parity, save continuation, phase-correct laps, finished-leader context, four punctures, heat/fuel/damage separation, compact scaling, live resizing and existing native commands. The full physical weekend checks new bindings at every milestone. Synthetic boundary fixtures are labeled separately from actual physical execution.

Exact executed counts and source identity belong to the accompanying verification record and PR. A historical green CI run is not evidence for this head. Automated checks are not human comprehension or accessibility certification. Windows exports, physical DPI/controllers, screen readers, text above 130%, wider weather/endurance coverage and representative-device profiling remain unverified in this pass.

## Executed clean-copy verification

The frozen runtime/test tree passed **1,414 behavioral assertions**, plus **127 production script loads**, after fresh import in an isolated clean copy. The minimal suites are an included subset: **495 checks and 29 native PNG captures**. Five verification-runner isolation tests also passed with the pinned native engine, including the real user-directory probe. Repeated development runs are not added to these totals.

| Suite | Passed checks | Native captures |
|---|---:|---:|
| Minimal commands, readouts and timing | 107 | — |
| Minimal layout and native input | 270 | 20 |
| Complete native weekend journey | 118 | 9 |
| Retained general domain | 706 | — |
| Retained practice / Director / replay | 78 / 76 / 59 | — |
| Production script loads, counted separately | 127 | — |

The physical journey executed **14,609 production fixed steps**, from a new six-lap Pinecrest weekend (dry, calm incidents, seed 7314). Both drivers completed measured practice and qualifying, physical returns, formation/lights and the race; a real pit entry/service/fitting/exit and production session save/restore were exercised. Card bindings were checked at nine physical milestones. Synthetic warning and layout fixtures remain explicitly distinct from that journey.

Native profiles: **1440×900 and 1100×720 at 100%, 115% and 130% text**. Environment: Godot 4.7.2 Standard (`ed1daf0bf`), GL Compatibility, Linux/Xvfb, Mesa llvmpipe, Dummy audio and `LP_NUM_THREADS=2`. Clean-copy execution took 513.54 seconds; this is test duration, not a gameplay performance claim. No script/parse/runtime error markers occurred in final logs. The unsupported VSync warning is an environment limitation.

A SHA-256 comparison confirmed all **388 runtime/test/scene/data files** stayed unchanged after the final run began. All **103 domain/service/command-adapter files** remain byte-identical to the merged baseline. Python compilation and staged `git diff --check` passed. Only documentation was subsequently updated with these results.

Development checks reproduced footer overflow and a clipped last timing row at compact enlarged text. These were repaired with layout spacing, preserving numeric values, labels, actions and the selected text scale. Actual final race, compact warning, qualifying and results captures were visually inspected.

**The full historical corpus was not rerun locally.** Its existing registration in `scripts/verify.py` is unchanged and remains the hosted CI merge gate. Publication-time hosted status belongs to the current PR, not the earlier 0.17.1 run. Human approachability, platform exports and representative-device performance are not established by these automated passes.
