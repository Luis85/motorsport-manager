# Authored replay scenarios — 0.13.0

## Scope and dependency

This is a continuation of **RW-19**, with **RW-16** native interaction and regression work, from the supplied Race Weekend GDD v1.0 (sections 20.3–20.4, 21.3, 22.4, 24.3 and invariants V-03/V-18/V-19/V-20). It builds on the complete 0.12 replay core at `1fd797837b9b01b5b0514670db960b857027d19e`; that core's later documentation at `b3139b161169b4bb9868ce991cb35c1b59c2675e` is preserved. See [replay behavior](race-weekend-replay.md) for its independent simulations, recorded commands, bounded checkpoints and standalone result receipts.

The new player decision is **which captured situation to teach or revisit, which two approaches to compare, and which observed outcome to examine**. Authors cannot add performance bonuses, edit stock, script an incident, choose a winner or grant rewards. This is a bounded challenge-brief editor around an existing frozen state, not an unrestricted race-state editor or a complete scenario-production toolchain.

Standalone result acceptance remains a factual local archive. An external campaign still needs a validated entry manifest and atomic settlement of money, points, inventory and calendar. Neither this increment nor the inherited 0.12 receipt implements that campaign transaction. RW-19 and Stage D retain their wider validation gates.

## Play and author

Open `project.godot` with Godot **4.7.2 Standard** and press F5. Start a normal weekend or an existing scenario. **Review → Decision debrief → Keep checkpoint** retains a useful point; **Replay / sandbox** opens the independent viewer. The Weekend menu and Find / Ctrl+K remain alternative routes.

Choose the recording start or an earlier retained checkpoint. **Author scenario…** takes a separate copy of that displayed state and stops only replay playback, not the original weekend's saved pause/speed policy. Supply a title, a decision brief, two distinct approaches, a hint and one supported observed goal. **Export scenario…** validates the draft and then asks for an explicit JSON file destination. Canceling the file picker writes nothing. A successfully submitted brief remains a view-local draft, so reopening Author in that viewer retains it after a canceled destination; it is not saved across application restart. Cancel draft discards unsubmitted edits.

From the main menu, **Replays & experiments → Open recording or scenario…** validates the complete file before hiding the current view. The imported scenario first opens as a replay snapshot, not as a replacement original weekend. **Try another decision** creates an independently paused sandbox. Its brief is available through **Scenario brief** and its goal begins as pending. Normal preparation, formation, lights, commands, stock, weather and physical pit rules still apply from the captured phase onward.

**Return to replay** saves the experiment to the separate sandbox slot; **Return to original** restores the actual original view and its unapplied strategy drafts. **Resume saved sandbox** reopens the saved experiment from the main menu. A results checkpoint cannot create another decision or authored challenge; select an earlier checkpoint. There is no automatic award or next race.

## Brief and goal contract

| Field | Contract |
|---|---|
| `version` | Brief schema 1, integral JSON value |
| `title` | Nonempty, at most 80 characters |
| `briefing` | Nonempty, at most 600 characters |
| `approaches` | Exactly two distinct nonempty strings, at most 240 characters each |
| `hint` | Nonempty, at most 600 characters |
| `goal` | One supported identifier below; never evaluated as code |

The form trims outer whitespace. Brief content is inert display text. It cannot issue commands, change eligibility or reveal a guaranteed future outcome. Two different descriptions do **not** prove that both strategies are viable; the author must actually test them.

| Goal | Assessment |
|---|---|
| `observe` | Compare two approaches; no scored target |
| `finish_both` | Both player cars are marked finished by the race model |
| `mer_top_six` | Mercer is finished and in the first six of final standings |
| `mor_top_six` | Moreau is finished and in the first six of final standings |

Finishing goals remain pending until `phase == results`. A retired car does not satisfy a finishing goal merely because its numeric classification is high. A lapped finisher can satisfy a finishing goal; lap count remains visible and must be considered when comparing outcomes. Goal assessment never changes the race, receipts, resources, achievements or campaign state. It is repeated observation of the same facts, not a repeatable reward.

## Frozen scenario format

The new `motorsport-manager-scenario` **version 1** envelope contains `brief`, `record` and an integrity `digest`. Its record is a **sandbox-origin, zero-step** replay with identical initial and endpoint checkpoints, no recorded inputs and no retained marks. Parent lineage names the source event/digest/step/cursor and stores the same brief. The existing manifest retains track/roster/resource hashes, vehicle, seed, race length, incident exposure, rules, initial phase, existing scenario provenance and assistance context.

Validation checks the complete brief, inherited replay record, snapshot identity and chronology, sandbox origin, zero-step boundary, non-result starting phase, brief agreement and envelope digest. A mismatched briefing, altered digest, unexpected header type, unsupported goal or promoted original origin is rejected before replacing the displayed authority. Capturing changes identity for the experiment but draws no sporting RNG.

`ScenarioBrief` is a small pure validation/assessment helper. `ReplayScenario` creates and validates the frozen envelope. `ScenarioAuthor` owns staged native controls. The existing replay controller recognizes the new envelope and passes its validated record to the existing viewer; it does not introduce another simulation or inheritance layer. The original 0.12 sandbox autosave isolation is retained unchanged rather than replaced by a competing save framework.

## Record and result safeguards

Record validation now checks that the initial state, endpoint and retained checkpoints agree on frozen track, roster, vehicle, seed, lap count, weather configuration, incident exposure and ruleset identity. Observers can explicitly detach; reattaching resets their trace rather than mixing two weekends. JSON integer/float equivalence remains supported within the existing numeric tolerance; incompatible scalar types safely compare false.

`WeekendResult.validate` checks the versioned envelope, identity, manifest hashes, final status, twelve unique classified drivers with contiguous position fields, supported status/timing/points-eligibility fields, twelve resource owners, finite condition values and each driver's exact twelve-set allocation with valid wheel state. Statistics remain bounded nonnegative integers. There is no invented component diagnosis, championship eligibility or achievement reward. Result creation derives its order from the existing authoritative final standings; this schema validator is not an independent stewarding engine or cryptographic proof that a race happened.

`ResultReceipts` validates both the generated result and any existing ledger before mutation. A same-event/same-digest repeat is an acknowledged no-op with unchanged ledger bytes. A different digest for an existing event is refused; no correction workflow is invented. Malformed existing results, duplicate drivers, borrowed tyre identities, wrong scalar types and sandbox results do not gain original authority. Disk failures report failure rather than success.

The existing 16,000,000-byte storage ceiling now measures **UTF-8 bytes on writes**, matching the read boundary. Non-ASCII text cannot create a file that the application refuses to reopen merely because characters were counted instead of bytes. Oversized writes leave the prior file intact. The inherited four-checkpoint, 4,096-input, 3,000,000-step replay bounds and 256-result archive bound remain subject to that shared byte ceiling. These are limits, not promises that every maximal combination fits.

Digests detect corruption and inconsistent edits, not malicious authorship. Raw local JSON remains developer-readable, including private simulation data. The application has no multiplayer anti-cheat, signature authority or protection against someone manually replacing its local files. Campaign import must never treat a standalone or sandbox receipt as a validated campaign entry.

## Native interaction and layout

| Task | Location | State and feedback |
|---|---|---|
| Retain or revisit a decision | Existing Review / Weekend / Find routes | No new permanent pit-wall navigation row |
| Describe a challenge | Replay footer → Author scenario… | Frozen source, staged fields, no tactical commands |
| Correct invalid input | Author dialog | Remains open with a specific reason; values retained |
| Export | Fixed Export action → native file picker | Explicit destination; no write on cancel |
| Inspect long instructions | Sandbox → Scenario brief | Bounded native reader with scrolling and return focus |
| Assess a goal | Sandbox brief row | Pending until final classification; no reward |
| Recover original work | Return to original | Same original node, drafts, focus and sporting state |

The form uses a focus-following vertical scroll region for fields. Cancel and Export stay outside that region. The dialog is bounded at the supported small desktop size; longer hints use wrapped text editors and the existing bounded reading dialog. The author dialog hides before the next modal file picker opens, avoiding simultaneous exclusive-window errors. Text sizes 100%, 115% and 130% reuse the existing pit-wall preference. No new 200% or screen-reader/controller claim is made.

The small enlarged-text sandbox adds a brief row and therefore reduces the available circuit/timing height. Both player cards and time/return controls remain fixed; some timing rows require vertical scrolling. No horizontal scroll is needed for primary commands. This is a disclosed space trade-off, not a claim that all information fits without scrolling. Native captures and test targets are in [verification](scenario-authoring-verification.md).

## Compatibility

Application version **0.13.0** is distinct from scenario/brief **v1**, session/replay **v1**, result/receipt **v1**, and embedded native checkpoint **v10**. The sporting replay model identifier stays `race-weekend-0.12-v1`: authoring and validation do not change movement, random streams or race rules. Existing records without a scenario brief remain valid. Supported old raw native saves still begin a legacy-labeled history at their restored point; no earlier input history or authored goal is fabricated.

Same-engine/model requirements for original continuation remain. A structurally compatible mismatched-model snapshot may be inspected or used for a new labeled sandbox, but cannot be presented as an original verified continuation. Browser prototype saves remain unsupported. Scenario briefs persist in sandbox lineage; UI-only unapplied drafts remain view-local.

## Evidence and remaining work

The required runner preserves the 0.12 replay-domain, complete-weekend, native UI and observer-cost suites. Additional coverage exercises a complete physical twelve-lap original, exact JSON reconstruction, an authored alternate policy, final goal evaluation, unchanged original files, idempotent and conflicting receipts, invalid scenario promotion, strict returned stock, wrong JSON types and UTF-8 limits. Native checks use mouse/key events, an actual export destination, fixed scrolled actions, retained drafts and a long-brief reader. See [the executed evidence record](scenario-authoring-verification.md), rather than interpreting this coverage description as a completed run.

The paired fixture intentionally compares an early stop with conserving from the same captured race start. It is not an optimization proof or a guarantee that an arbitrary authored approach is competitive. Wider circuits/seeds, wet authored situations, goal feasibility, forecast calibration and participant comprehension remain open. An exploratory human session should ask an author to explain the two approaches, have another participant import and attempt both, and verify that they distinguish original, reconstructed and sandbox outcomes without moderator rescue.

No human playtest, controller/screen-reader certification, broad hardware target, maximum-archive profiling, complete scenario catalog, arbitrary resource/rules editing, pressure, itemized components, RW-20 or actual campaign settlement is delivered here.
