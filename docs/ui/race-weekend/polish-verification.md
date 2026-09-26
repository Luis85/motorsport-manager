# Race-weekend engagement polish: verification and handoff

26 September 2026. Native Godot 4.7.2 Standard / GL Compatibility. This record supplements the existing UI finish ledgers; it does not turn their historical platform or human-playtest gaps into completed work.

## Source and CI diagnosis

The inspected PR #12 head was `a41abeba4b00faa1689fc999392e94d78cb24488`, tree `d3eb24d50faf9b460f0350db664a568945fdd220`. Its pull-request Godot verification run `36227640775` had succeeded; the duplicate push verification was cancelled. A historical text-scale preference contamination repair was already in that baseline and is preserved.

The workflow shared one cancellation group between push and pull-request events. Commit `8cf6ff8ec00f4b11c0c23b15e0d143f1bcc67671` includes the event name and PR number/ref in the concurrency group, retaining both event types while preventing cross-event cancellation. Newer runs of the same event/ref still supersede older ones. No assertions, suites, error detection or player-data isolation were removed.

The exact editor and source were recovered from the successful workflow artifacts. Local testing used a clean copied project with a unique verification application name, isolated user data, Xvfb, Dummy audio and the pinned `4.7.2.stable.official.ed1daf0bf` executable. Five runner-isolation unit tests passed, including the real engine user-data resolver.

## Regression-first evidence

The initial targeted suite performed ten checks against the baseline and reproduced nine failures. The repair then passed those same ten checks. The expanded final targeted suite passed **136 checks**, with **zero reported errors** and **eight native captures**. This is executed software evidence, not a count of manual playtests.

| ID | Contract checked | Disposition |
|---|---|---|
| P01 | No empty queue may claim an approved plan exists | Reproduced and fixed: accurate quiet state |
| P02 | Missing optional pit forecasts must not hide urgent fuel or tyre issues for either driver | Reproduced and fixed; underlying feed remains authoritative |
| P03 | Retired/finished cars clear stale queue entries, counts and acknowledgement actions | Reproduced and fixed, including empty forecast cache |
| P04 | Paused selection, finish and session changes invalidate battle outlines | Reproduced and fixed; inactive pairs excluded |
| P05 | Two stable named drivers, unchanged focus target, actual priority, no private rival resource leakage | Passed; no redundant unchanged panel assignments |
| P06 | Session, contest, closing-lap and finished readings reflect observed boundaries | Passed; synthetic boundaries disclosed rather than represented as full race runs |
| P07 | Reviewed native pit command precedes real physical entry and measured exit | Passed through unchanged command/simulation paths; accepted order is never an outcome |
| P08 | Native pointer/keyboard reading, fixed snapshot, focus return and compact/wide reachability | Passed for all six layout/text combinations; live production time continues beneath the reader |
| P09 | Observation must not alter authoritative simulation or random state | Passed after 240 identical fixed steps with/without reading; repeated timing samples also preserve state |

P07 starts from the existing disclosed race-entry fixture, invokes actual native confirmation, then advances the real model. The captured physical pit entry occurred at 25.45 simulated seconds. The subsequent measured exit supplies the visit-duration evidence. This is not a claim that the entire weekend was manually played from the main menu.

## Native interaction and visual profiles

Both **1440 × 900** and **1100 × 720** were exercised at **100%, 115% and 130% text scale**. Tests use native pointer input to open the reading, native Tab to reach selectable text, Page Down to verify real scroll movement, Page Up to return, and Escape to close and restore the exact invoker. A focused reader does not forward Space to the game. Both complete driver identities precede the longer explanatory sections.

The snapshot deliberately stays fixed while live state changes behind it. Its timestamp and pause/running state describe capture time, not a constantly refreshed forecast. Close/reopen explicitly refreshes it. The tests change fuel behind the modal to prove that reading is not overwritten; screenshots from that fixture can therefore show an urgent live card behind an older calm reading. This is intentional test evidence of the frozen-reading contract, not a live race prediction.

The wide observation and six reader captures are named `finish-polish-observation.png` and `finish-polish-reading-{width}x{height}-{scale}.png`; the eighth is `finish-polish-pit-entry.png`. Inspect `ui-polish.json` for each capture's phase, clock, viewport, scale, circuit, seed and fixture provenance.

## Performance and architectural boundaries

The presentation adapter has no command or persistence responsibility. It reads own-car state, public observed contests and optional existing forecasts. Recent outcomes scan at most 128 retained journal rows and show at most four relevant observed records. No new full-journal clone, forecast simulation, random draw, auto-pause, camera selection or forced racing incident was added.

A local 200-capture diagnostic measured **0.179 ms median**, **0.211 ms p95** and **1.117 ms maximum** for the two-driver read model. These are workload-specific measurements, not a player-device frame-rate guarantee or an improvement percentage against an unmatched baseline. `race-read-performance.json` retains the scope. Full snapshot equality after the matched 240-step experiment includes random state and accepted domain state.

## Full verification gate

The complete `scripts/verify.py` runner now includes `ui_polish_tests.gd`, requires its report and the bounded-read timing report, and retains all previous import, domain, scenario, native UI, replay, notebook, isolation and performance suites. It rejects engine script/parse errors as well as failed process exits. The targeted report above does not substitute for a successful full run on the published head.

Use the PR's exact-head Godot verification result and its `verification-evidence` artifact for the final full-run verdict and aggregate counts. `reports/verification.json` is generated only after all required phases pass. Hosted post-publication evidence belongs to that specific head or documented test-merge, not to an earlier successful commit. This document does not predict a future CI result.

Reproduce the full gate from the repository root with the pinned editor installed:

```sh
python3 scripts/verify.py --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

Linux native checks require a display or `xvfb-run`. `--headless-only` explicitly skips native UI acceptance and is not equivalent to the full gate. The normal short soak is not a new 30-minute soak claim.

## Player-facing route

Use **Race read** above the track, **Read both drivers** in the wide right rail, or **Find → Review / Read the race**. The live spotlight names one relevant situation; the opened reading includes both drivers, evidence, a trade-off, a next observation and bounded recent outcomes. **Race radio** opens the existing full radio view. Pause deliberately before opening the reader when reading time is needed; the reader never changes time controls. Closing/reopening gets a new snapshot.

A pit call is an accepted order, pit entry is execution, and a recorded exit is a measured outcome. Visit duration is not net race-time loss. A completed pass is not proof that one prior command caused it. Original and sandbox observations remain distinctly labeled. Strategy approval, Box, pit cancellation, ownership and result acceptance stay in their existing explicit action flows.

## Still-open validation boundaries

Windows/exported-build smoke, physical controller checks, actual assistive-technology sessions and newcomer/experienced-player playtests remain release gates. Automated focus and scale coverage does not certify those environments. No universal balance, calibrated probabilities, improved retention, or measured human enjoyment is claimed. The [research and product review](../../design/race-weekend-engagement-polish.md) records a concrete human evaluation plan and separates source evidence from design hypotheses.
