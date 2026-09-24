# Independent replay and sandbox experiments — 0.12.0

## Scope and integration

The supplied Race Weekend GDD v1.0, sections 20.3–20.4, 21.3, 22 and RW-19, is the design basis. This is the first playable RW-19 slice with RW-16 interaction coverage: an independent native replay, captured scenario data, an alternate-decision sandbox and a once-only **standalone factual result receipt**. It does not implement campaign settlement, an economy, rewards or all of Stage D. Driver pressure and RW-20 remain deferred.

PR #8, `feat/race-weekend-replay`, is stacked on the still-open PR #6 branch `feat/race-weekend-rivals-ui`, head `3bc9fbc384b3b9976b926cefb02121b4dade61c5`. Main remains the separate 0.10 baseline. Neither branch was merged or reset. Retarget this PR after #6 reaches main; do not assume a merge into a feature branch reaches main automatically.

## Player workflow

Open `project.godot` in Godot 4.7.2 Standard and press F5. New normal weekends and the current practice/rival recipes use the recording-capable native simulation. Existing older scenario models remain intact; they do not acquire a fictional full history. Continue a supported raw native save to start a legacy-labeled recording from the restored point.

At **Review → Decision debrief**, **Keep checkpoint** retains the current authoritative state without issuing a race command. **Replay / sandbox** is also in the Weekend menu and Find / Ctrl+K. Saving the weekend persists the record; merely retaining a checkpoint does not write to disk. Race start automatically retains a checkpoint when capacity remains.

The viewer has one checkpoint picker, Play/Pause record, a replay work-rate choice and **Try another decision**. Initial state, named checkpoints and saved endpoint are available. Selecting one is inspection, not a claim that prior steps have been reproduced. Playback applies the accepted inputs and fixed steps after that point. The status distinguishes **saved checkpoint**, **model re-simulation**, and **verified continuation**, including the number of reconstructed steps. Selecting the endpoint and verifying zero steps does not verify an entire race.

**Try another decision** creates a separately paused native pit wall, labeled **SANDBOX · SEPARATE SAVE**. Its existing legal approvals, orders, tyres, weather, rival policies and physical movement run normally. A changed call can change exposures and later outcomes; it is not a guaranteed answer to what would have happened. At results, choose an earlier checkpoint before branching again.

**Return to replay** saves the experiment separately and returns to the source recording. **Return to original** restores the same original view and its unapplied strategy drafts and invoking focus. During explicit replay navigation the original view is suspended: its clock does not advance, and its pause flag, selected speed, selection, orders and random streams are not rewritten. It resumes from that state on return. Alerts and guides still cannot seize time control.

Main menu **Replays & experiments** opens a recording/scenario or resumes the saved sandbox. Import opens observational evidence; it does not replace `App.weekend` or grant original-result authority. The sandbox has one separate local continuation slot, not an unlimited experiment library. Its inherited strategy-draft leave guard runs before exit. Unapplied drafts are not newly persisted across restart, and that guard is not advertised as coverage of every possible editor.

## Recording and deterministic reconstruction

`RaceRecord` is an optional observer attached to `PracticeRaceSim` through accepted-outer-input and completed-fixed-step signals. It adds no simulation inheritance layer. Internal autonomous decisions still execute through the existing model rather than being duplicated as player inputs. Rejected commands do not enter the exact input trace. A paused no-op does not count as a simulated step.

Records include an independent event ID; standalone/legacy/sandbox origin; parent lineage; model and engine versions; initial and endpoint checkpoints; exact accepted outer command payloads; their step indices and selection/pause/speed/accumulator context; bounded named checkpoints with input cursors; and a continuity status. The event ID uses a separate service identity source, never the sporting random streams.

The existing journal remains the evidence/debrief system. The new input trace has a different purpose: reproduce execution order. JSON numeric type paths preserve integral values whose runtime types affect existing ID/string or serialization behavior. Integrity fingerprints normalize JSON representation. Endpoint comparison retains all car, weather, tyre, strategy, journal and random-stream state, excluding only selection, pause, speed and the frame accumulator. Numerical equivalence uses an absolute 1e-8 tolerance in the supported engine, not a cross-platform bit-identical promise.

`RaceReplay` owns its own restored `PracticeRaceSim`. Each playback batch executes at most 64 actual steps and 32 same-step commands. Remaining work stays queued. The Steady/Fast/Fastest selector changes that viewer budget, not the original weekend speed; it does not promise a wall-time multiplier. Unknown or rejected recorded commands, missing approvals, endpoint divergence, incomplete history or incompatible model/engine stop reproduction with an explanation rather than inventing an outcome.

Checkpoints are bounded to four, including an automatically retained race start. There are at most 4,096 accepted input records and 3,000,000 replayable steps. The input/step limit marks continuous history incomplete without blocking live commands. Saved snapshots remain inspectable. A fifth bookmark is refused; no existing evidence is silently evicted. Snapshots are captured at explicit marks, sealing and race start, not every frame. Large save/export/import operations remain synchronous and can be noticeable.

## Scenario authoring data

**Export recording** writes the captured exact history. **Export this scenario** writes a new zero-step sandbox recording at the selected current state. Its lineage identifies the source event, source digest, step/cursor and whether that state was a saved checkpoint or model re-simulation.

The manifest records track, roster and starting-resource hashes; vehicle, seed, laps, initial phase and incident mode; implemented weather/reliability/rival/control modes; recorded scenario objectives where present; and an assistance explanation referring to the actual per-driver policies in the snapshot. Full native state contains finite allocation, applied settings and independent streams. The manifest is checked against the frozen initial state. Different resources or an untimed preparation grid are not passed off as measured qualifying outcomes.

This is **captured-state scenario export/import**, not a complete authoring editor with arbitrary roster, objectives, hints or rule editing. Ordinary new weekends may have no authored objectives; none are invented. File metadata and checksums provide local integrity, not encrypted rival secrecy or cryptographic anti-cheat authentication. Raw developer records necessarily contain private authoritative data. Player-facing rival inspection remains public-only.

## Immutable standalone result boundary

At completed original results, **Accept original result** first saves the session with its event ID, then requests `ResultReceipts.accept`. `WeekendResult` contains final lap-count-first classification, explicit driver IDs, status and recorded finish timestamps, roster/track/rules/model versions, actual aggregate condition and returned tyre identities, statistics, provenance and a digest. It does not infer itemized component failures. Achievements are empty rather than fabricated, and points eligibility explicitly says the standalone rules do not define it.

The local ledger at `user://weekend-results.json` stores a deep-copied factual result by event ID. The same event/digest is an already-accepted no-op without rewriting the file. A different digest for that ID is rejected; a correction workflow is not implemented. A sandbox is rejected even after finishing. Invalid existing ledgers are retained, not reset. The ledger allows at most 256 results and remains subject to the shared file-size limit; it does not silently purge receipts to make room.

This establishes a once-only local acceptance boundary, **not exactly-once campaign money, points, inventory reconciliation or calendar progression**. A future consumer must validate its own frozen entry and atomically persist settlement plus its receipt. Imported exhibitions are not implicitly eligible. Deleting local files or deliberately rewriting developer-readable records is outside competitive integrity guarantees.

## Persistence and migration

Application release **0.12.0**, replay/session envelope **v1**, result/receipt envelope **v1**, and embedded native checkpoint **v10** are separate version numbers. No artificial checkpoint v11 is introduced because the simulation snapshot schema has not changed.

`App.save_weekend` wraps recording-capable weekends in `motorsport-manager-session`; `ReplayStorage` validates the entire record before replacement. Original continuation uses `user://weekend.json`; sandbox continuation uses `user://sandbox.json`. Origin/slot mismatch is rejected. Native v1–v10 raw checkpoints still use the established migration chain and then acquire a **legacy** recording beginning now, without invented earlier inputs, profiles, practice or randomness. Browser prototype saves remain unsupported.

Original continuation and deterministic playback require the saved engine and model to match. A different engine/model can still expose structurally compatible saved checkpoints or create a new explicitly labeled sandbox; it cannot silently claim original continuation with rewritten provenance. An unsupported or malformed native snapshot is not promised inspectable.

Shared `Storage` keeps its atomic temporary/backup writing and 16 MB file ceiling. Record validation includes digest, bounded collections, type paths, physical snapshot validation, identities, chronology, seed/track continuity and scenario metadata. Unknown commands may be inspected structurally but cannot execute successfully during playback. Full archive growth to the ceiling has not been benchmarked; a size-limit error preserves existing on-disk data.

## Native integration and interaction specification

`ReplayController` composes the workspace into the existing main scene; it retains the actual original nodes rather than recreating a pit wall and losing drafts. `ReplayWorkspace` renders an independent track snapshot and uses the existing `PracticeWeekendView` for sandbox commands. `App.weekend` and the original recorder remain the original authority. Quit/return saves the sandbox first; failed saves keep the experiment available instead of discarding it.

| Task | Location / behavior |
|---|---|
| Keep a decision checkpoint | Review → Decision debrief → Keep checkpoint; no sporting command |
| Open replay | Review action, Weekend menu, or Find / Ctrl+K; all reach the same viewer |
| Inspect / reproduce | Checkpoint picker / Play record; saved-state versus reconstructed labels |
| Change a decision | Try another decision; separately paused, labeled existing pit wall |
| Return | Explicit Return to replay / Return to original; original instance, drafts and focus retained |
| Save or resume experiment | Separate sandbox slot; main menu Replays & experiments |
| Share evidence / captured scenario | Viewer export actions; imports remain observational |
| Accept result | Original completed debrief only; no reward or duplicate settlement |

No new permanent primary navigation group or simulation-control row is added. Fixed replay actions and sandbox return/time controls fit at 1440×900 and 1100×720 with 100%, 115% and 130% pit-wall text. The existing smaller inspector/timing-tower trade-off remains. Long inherited evidence can still scroll. The selected replay checkpoint and operation status remain visible; no focused action is reordered by timing refresh.

Native inspection identified two concrete corrections: the early sandbox draft inherited a misleading REPLAY title and an extra header row, now replaced by one explicit sandbox header; public rival masks indexed timing rows by rank instead of stable driver ID, now corrected and tested with reordered standings. These are observed implementation defects, not evidence of human usability improvement. Existing native theme, focus and text-scaling patterns are retained; no new external UX research or participant playtest is claimed.

## Verification and open gates

See [0.12 verification evidence](replay-verification.md) for exact revisions, executed suites, native captures, matched observer costs and historical versus current evidence. Use the unchanged command `python3 scripts/verify.py --godot /path/to/godot`. All previous suites remain, with replay domain, full-race, performance and native interaction suites now mandatory.

Exploratory human comprehension, controller/screen-reader coverage, text beyond 130%, cross-platform/GPU behavior, broad seed/circuit reconstruction, maximum-size archive performance, arbitrary scenario editing, replay timeline/rewind UX, external campaign settlement and model-upgrade replay migration remain open. The inherited guide stays resumable and non-commanding, but no new full replay onboarding tour is claimed. Automated checks do not close the GDD's human-playtest or overall Stage D acceptance gates.
